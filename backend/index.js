import "dotenv/config";
import express from "express";
import cors from "cors";
import ImageKit from "imagekit";
import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Chat from "./models/chat.js";
import UserChats from "./models/userChats.js";
import { clerkMiddleware, getAuth } from "@clerk/express";

const port = process.env.PORT || 3000;
const requiredEnvVars = [
  "MONGO",
  "IMAGE_KIT_ENDPOINT",
  "IMAGE_KIT_PUBLIC_KEY",
  "IMAGE_KIT_PRIVATE_KEY",
];

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length) {
  console.error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
  process.exit(1);
}

const app = express();

const allowedOrigins = new Set([
  process.env.CLIENT_URL,
].filter(Boolean));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser tools and same-origin requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        return callback(null, true);
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(
  clerkMiddleware({
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  })
);

const ensureApiAuth = (req, res, next) => {
  const { userId: clerkUserId } = getAuth(req);
  let resolvedUserId = clerkUserId;

  // Dev fallback: if Clerk token verification fails locally, allow a signed-in
  // frontend-provided user id header so development is not blocked.
  if (!resolvedUserId && process.env.NODE_ENV !== "production") {
    const headerUserId = req.headers["x-user-id"];
    if (typeof headerUserId === "string" && headerUserId.trim()) {
      resolvedUserId = headerUserId.trim();
    }
  }

  if (!resolvedUserId) {
    return res.status(401).json({ error: "Unauthenticated" });
  }

  req.authUserId = resolvedUserId;
  return next();
};

const connect = async () => {
  await mongoose.connect(process.env.MONGO);
  console.log("Connected to MongoDB");
};

const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
  privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
});

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModelCandidates = (
  process.env.GEMINI_MODELS ||
  process.env.GEMINI_MODEL ||
  "gemini-3.1-flash-lite-preview"
)
  .split(",")
  .map((modelName) => modelName.trim())
  .filter(Boolean);
const allowQuotaFallback =
  (process.env.ALLOW_QUOTA_FALLBACK || "true").toLowerCase() === "true";

const buildQuotaFallbackText = (prompt = "") => {
  const normalizedPrompt = prompt.replace(/\s+/g, " ").trim();
  const clippedPrompt = normalizedPrompt.slice(0, 240);

  return [
    "I can still help, but live AI generation is temporarily limited right now.",
    clippedPrompt ? `\n\nLatest prompt: \"${clippedPrompt}\"` : "",
    "\n\nPlease try again shortly. If this continues, update Google AI Studio billing/quota for your backend key.",
  ].join("\n");
};

const mapGeminiError = (error) => {
  const message = error?.message || "Gemini request failed";

  if (/429|quota|rate\s*limit/i.test(message)) {
    return {
      status: 429,
      message:
        "Gemini quota is exhausted for this API project. Update billing/quota or use a project key with available quota.",
    };
  }

  if (/401|403|api key|permission|unauthor/i.test(message)) {
    return {
      status: 401,
      message:
        "Gemini API key is invalid or missing permission for this project/model.",
    };
  }

  if (/404|not\s*found|not\s*supported/i.test(message)) {
    return {
      status: 404,
      message: "Requested Gemini model is unavailable for this project.",
    };
  }

  return { status: 500, message: "Gemini request failed." };
};

const generateModelReply = async ({ prompt, image = null }) => {
  if (!geminiApiKey) {
    return {
      text: "Missing GEMINI_API_KEY in backend .env",
      model: "local-config-fallback",
      fallback: true,
    };
  }

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const parts = image?.inlineData ? [image, { text: prompt }] : [{ text: prompt }];

  for (const modelName of geminiModelCandidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(parts);
      const text = result?.response?.text?.() || "";

      if (!text) {
        return {
          text: "Gemini returned an empty response",
          model: "local-empty-fallback",
          fallback: true,
        };
      }

      return { text, model: modelName, fallback: false };
    } catch (error) {
      const mappedError = mapGeminiError(error);

      // Try next model when the selected one is unavailable.
      if (mappedError.status === 404) {
        continue;
      }

      if (mappedError.status === 429 && allowQuotaFallback) {
        return {
          text: buildQuotaFallbackText(prompt),
          model: "local-quota-fallback",
          fallback: true,
        };
      }

      throw new Error(mappedError.message);
    }
  }

  return {
    text: "No configured Gemini model is currently available for this project. Update GEMINI_MODEL/GEMINI_MODELS in backend .env.",
    model: "local-model-fallback",
    fallback: true,
  };
};

app.get("/", (req, res) => {
  console.log("Handling GET /");
  res.status(200).json({ status: "ok", service: "BrainWave API" });
});

app.get("/api/upload", (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
});

app.post("/api/generate", ensureApiAuth, async (req, res) => {
  const userId = req.authUserId;
  const { prompt, image } = req.body;

  if (!userId) {
    return res.status(401).send("Unauthenticated");
  }

  if (!prompt?.trim()) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const generation = await generateModelReply({ prompt, image });
    return res.status(200).json(generation);
  } catch (error) {
    const mappedError = mapGeminiError(error);
    return res.status(mappedError.status).json({ error: mappedError.message });
  }
});

// app.get("/api/test", requireAuth(), (req, res) => {
//   const { userId } = getAuth(req);
//   console.log(userId);
//   res.send("Success!");
// });

app.post("/api/chats", ensureApiAuth, async (req, res) => {
  const userId = req.authUserId;
  const { text } = req.body;

  if (!userId) {
    return res.status(401).send("Unauthenticated");
  }

  if (!text?.trim()) {
    return res.status(400).send("Text is required");
  }

  try {
    // CREATE A NEW CHAT
    const newChat = new Chat({
      userId: userId,
      history: [{ role: "user", parts: [{ text }] }],
    });

    const savedChat = await newChat.save();

    // CHECK IF THE USERCHATS EXIST
    const userChats = await UserChats.find({ userId: userId });

    // IF DOESNT EXIXT CREATE A NEW ONE AND ADD THE CHAT IN THE CHATS ARRAY
    if (!userChats.length) {
      const newUserChats = new UserChats({
        userId: userId,
        chats: [
          {
            _id: savedChat._id.toString(),
            title: text.substring(0, 40),
          },
        ],
      });

      await newUserChats.save();
    } else {
      // IF EXIST, PUSH THE CHAT TO THE EXISTING ARRAY
      await UserChats.updateOne(
        { userId: userId },
        {
          $push: {
            chats: {
              _id: savedChat._id.toString(),
              title: text.substring(0, 40),
            },
          },
        }
      );
    }

    const chatId = savedChat._id.toString();

    // Generate and persist the very first model reply so the initial prompt
    // is both title and real LLM input.
    try {
      const generation = await generateModelReply({ prompt: text });
      const firstAnswer = generation?.text?.trim();

      if (firstAnswer) {
        await Chat.updateOne(
          { _id: savedChat._id, userId },
          {
            $push: {
              history: {
                role: "model",
                parts: [{ text: firstAnswer }],
              },
            },
          }
        );
      }
    } catch (generationError) {
      // Keep chat creation resilient even if generation fails unexpectedly.
      console.log("Initial generation failed:", generationError.message);
    }

    console.log("Created chat:", chatId);
    res.status(201).json({ id: chatId });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating chat!");
  }
});
app.get("/api/userchats", ensureApiAuth, async (req, res) => {
  const userId = req.authUserId;

  if (!userId) {
    return res.status(401).send("Unauthenticated");
  }

  try {
    // const chat = await Chat.findOne({_id:req.params.id, userId });
    const userChats = await UserChats.find({ userId });

    res.status(200).send(userChats[0]?.chats || []);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error fetching userchats!");
  }
});

app.put("/api/chats/:id", ensureApiAuth, async (req, res) => {
  const userId = req.authUserId;
  const { question, answer, img, skipUser } = req.body;

  if (!userId) {
    return res.status(401).send("Unauthenticated");
  }

  if (!answer || (!skipUser && !question)) {
    return res.status(400).send("Answer is required, and question is required unless skipUser=true");
  }

  try {
    const historyItems = [];

    if (!skipUser) {
      historyItems.push({
        role: "user",
        parts: [{ text: question }],
        ...(img ? { img } : {}),
      });
    }

    historyItems.push({
      role: "model",
      parts: [{ text: answer }],
    });

    const updatedChat = await Chat.findOneAndUpdate(
      { _id: req.params.id, userId },
      { $push: { history: { $each: historyItems } } },
      { new: true }
    );

    if (!updatedChat) {
      return res.status(404).send("Chat not found");
    }

    res.status(200).send(updatedChat);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error updating chat!");
  }
});
//
app.get("/api/chats/:id", ensureApiAuth, async (req, res) => {
  const userId = req.authUserId;

  if (!userId) {
    return res.status(401).send("Unauthenticated");
  }

  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId });

    if (!chat) {
      return res.status(404).send("Chat not found");
    }

    res.status(200).send(chat);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error fetching chat!");
  }
});

// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(401).send("Unauthenticated!");
// });

const startServer = async () => {
  try {
    await connect();
    const server = app.listen(port, () => {
      console.log(`server running on ${port} (restarted at ${new Date().toLocaleTimeString()})`);
    });

    server.on("error", (err) => {
      if (err?.code === "EADDRINUSE") {
        console.error(
          `Port ${port} is already in use. Backend is probably already running in another terminal.`
        );
      } else {
        console.error("Server listen error:", err.message);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();
