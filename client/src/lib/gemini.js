import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
  ];

const geminiApiKey = import.meta.env.VITE_GEMINI_PUBLIC_KEY;

if (!geminiApiKey) {
  throw new Error("Missing VITE_GEMINI_PUBLIC_KEY in client .env");
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const geminiModel = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.0-flash";

const model = genAI.getGenerativeModel({
  model: geminiModel,
    safetySettings,
 });

export default model;