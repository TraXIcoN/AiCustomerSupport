import { NextResponse } from "next/server";
import axios from "axios";

// Define task-specific model configurations
const models = {
  general: "gpt-3.5-turbo",
  instruct: "gpt-4o-mini",
};

// Function to call OpenAI's API with a specific model
async function callModel(model: string, messages: any[]): Promise<string> {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data.choices[0].message.content.trim();
}

// Router function to determine which model to use
function router(query: string): string {
  // Define routing rules (simplified example)
  if (query.includes("step-by-step") || query.includes("instructions")) {
    console.log("Using instruct model");
    return models.instruct;
  } else {
    console.log("Using general model");
    return models.general;
  }
}

// Main function to handle a query
export async function POST(req: Request): Promise<NextResponse> {
  // Parse the request body
  const data = await req.json();
  const question = data.findLast(
    (msg: { role: string }) => msg.role === "user"
  )?.content;

  // Determine the appropriate model
  const selectedModel = router(question);

  // Prepare messages for the API call
  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: question },
  ];

  // Call the selected model
  const responseText = await callModel(selectedModel, messages);

  // Stream the response back to the client
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Enqueue the response text
        controller.enqueue(new TextEncoder().encode(responseText));
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream);
}
