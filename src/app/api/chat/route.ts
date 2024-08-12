import { NextResponse } from "next/server";
import axios from "axios";
import { getRetriever } from "@/lib/retriever";

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
    // Adjust the threshold as necessary
    return new NextResponse(
      "The information you're asking for is not available in the provided documents."
    );
  }

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: question },
        { role: "assistant", content: context },
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
