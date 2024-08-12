import axios from "axios";
import path from "path";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

// Custom Embeddings Interface
class OpenAIEmbeddings {
  async embedDocuments(texts: any) {
    return this._generateEmbeddings(texts);
  }

  async embedQuery(text: any) {
    return this._generateEmbeddings([text]).then((embeddings) => embeddings[0]);
  }

  async _generateEmbeddings(texts: any) {
    const response = await axios.post(
      "https://api.openai.com/v1/embeddings",
      {
        model: "text-embedding-ada-002",
        input: texts,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.data.map((item: { embedding: any }) => item.embedding);
  }
}

export async function getRetriever() {
  const dataDirectory = path.join(process.cwd(), "data/");

  const loader = new DirectoryLoader(dataDirectory, {
    ".json": (filePath: string) => new JSONLoader(filePath),
    ".pdf": (filePath) => new PDFLoader(filePath),
  });

  const docs = await loader.load();

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const allSplits = await textSplitter.splitDocuments(docs);

  // Instantiate the custom OpenAI embeddings
  const embeddings = new OpenAIEmbeddings();

  // Create the vector store using the custom embeddings
  const vectorStore = new MemoryVectorStore(embeddings);

  // Add documents to the vector store
  await vectorStore.addDocuments(allSplits);

  const retriever = vectorStore.asRetriever({
    k: 8,
    searchType: "similarity",
  });

  return retriever;
}
