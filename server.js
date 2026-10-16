import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.use(express.static("public"));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Standalone AI Agent"
  });
});

app.post("/api/chat", async (req, res) => {
  const message = req.body?.message;

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      error: "Message likhna zaroori hai."
    });
  }

  if (message.length > 8000) {
    return res.status(413).json({
      error: "Message bahut lamba hai."
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: "Gemini API key abhi configure nahi hai."
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: message.trim()
    });

    return res.json({
      reply: result.text || "AI se text response nahi mila."
    });
  } catch (error) {
    console.error("Gemini request failed.");

    return res.status(502).json({
      error: "AI se jawab nahi mil saka. API configuration check karein."
    });
  }
});

app.listen(port, () => {
  console.log(`Standalone AI Agent server listening on port ${port}`);
});￼Enter
