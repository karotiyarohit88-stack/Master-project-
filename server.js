import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const apiKey = process.env.GEMINI_API_KEY;

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use(express.static('public'));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    apiKeyConfigured: Boolean(apiKey)
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const message = req.body?.message;

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        error: 'Please enter a message.'
      });
    }

    if (message.length > 10000) {
      return res.status(413).json({
        error: 'Message is too long.'
      });
    }

    if (!apiKey) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server.'
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message.trim()
    });

    const reply = response.text;

    if (typeof reply !== 'string' || !reply.trim()) {
      return res.status(502).json({
        error: 'The AI returned an empty response.'
      });
    }

    return res.json({ reply });
  } catch (error) {
    console.error('Chat request failed:', error.message);
    return res.status(500).json({
      error: 'AI request failed. Check the server logs and API configuration.'
    });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON request body.'
    });
  }

  console.error('Request error:', err.message);
  return res.status(500).json({
    error: 'Internal server error.'
  });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${port}`);
});
