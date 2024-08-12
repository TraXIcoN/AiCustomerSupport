import { NextResponse } from "next/server";
import axios from "axios";
import { getRetriever } from "@/lib/retriever";

// Custom function to generate RAG prompt
function generateCustomRAGPrompt(context: string, question: string): string {
  return `
  You are a helpful assistant. Below is some context that may help answer the user's question:
  Context:
  ${context}
  Based on the above context, answer the following question:
  
  Question: ${question}
  Provide a clear and concise response.
  If asked a question not in the context, do not answer it and say I'm sorry, I do not know the answer to that question.
  If you don't know the answer or if it is not provided in the context, just say that you don't know, don't try to make up an answer.
  If the answer is in the context, don't say mentioned in the context.
  If the user asks you to generate code, say that you cannot generate code.
  Please provide a detailed explanation and if applicable, give examples or historical context.
  `;
}

// Define the models object
const models = {
  general: "gpt-3.5-turbo",
  instruct: "gpt-4o-mini",
};

// Function to decide which model to use
function decideModel(question: string): string {
  if (
    question.includes("detail") ||
    question.includes("details") ||
    question.includes("instructions") ||
    question.includes("step-by-step")
  ) {
    console.log("Using instruct");
    return models.instruct;
  } else {
    console.log("Using general");
    return models.general;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const retriever = await getRetriever();

  const data = await req.json();
  const question = data.findLast(
    (msg: { role: string }) => msg.role === "user"
  )?.content;

  // Retrieve relevant documents based on the user's query
  const contextDocs = await retriever.getRelevantDocuments(question);
  const context = contextDocs.map((doc) => doc.pageContent).join("\n");

  // Check if context is relevant or contains useful information
  if (!context || context.length < 50) {
    return new NextResponse(
      "The information you're asking for is not available in the provided documents."
    );
  }

  // Generate the custom RAG prompt using the template
  const customRAGPrompt = generateCustomRAGPrompt(context, question);

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: decideModel(question),
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: customRAGPrompt },
      ],
      stream: true, // Enable streaming
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      responseType: "stream",
    }
  );

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";
      response.data.on("data", (chunk: { toString: () => string }) => {
        buffer += chunk.toString();
        let boundaryIndex;
        while ((boundaryIndex = buffer.indexOf("\n")) !== -1) {
          const part = buffer.slice(0, boundaryIndex).trim();
          buffer = buffer.slice(boundaryIndex + 1);
          if (part.startsWith("data: ")) {
            const jsonString = part.slice(6).trim(); // Remove "data: " prefix
            if (jsonString !== "[DONE]") {
              try {
                const parsedChunk = JSON.parse(jsonString);
                if (parsedChunk.choices && parsedChunk.choices.length > 0) {
                  const content = parsedChunk.choices[0].delta?.content || "";
                  controller.enqueue(new TextEncoder().encode(content));
                }
              } catch (error) {
                console.error("Failed to parse JSON chunk:", error);
              }
            }
          }
        }
      });
      response.data.on("end", () => {
        controller.close();
      });
      response.data.on("error", (err: any) => {
        controller.error(err);
      });
    },
  });

  return new NextResponse(stream);
}
