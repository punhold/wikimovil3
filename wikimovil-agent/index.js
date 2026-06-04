import "dotenv/config";
console.log(">>> INDEX NUEVO CARGADO <<<");
import express from "express";
import cors from "cors";
import { runAgent } from "./agent.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // necesario para imágenes base64

app.post("/api/ask", async (req, res) => {
  const { question, image } = req.body;
  if (!question && !image) {
    return res.status(400).json({ error: "Pregunta o imagen requerida" });
  }

  try {
    const result = await runAgent(question || "¿Qué ves en esta imagen?", image || null);
    res.json({
      answer: result.answer,
      sources: {
        internal: result.internal,
        external: result.external
      }
    });
  } catch (err) {
    console.error("🔥 ERROR REAL DEL AGENTE:");
    console.error(err);
    res.status(500).json({ error: err.message || "Error del agente" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🤖 Agente IA escuchando en puerto ${PORT}`);
});

console.log("OpenAI key cargada:", !!process.env.OPENAI_API_KEY);
