import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Post } from "../types";

// In a real app, this should be proxied via backend to protect the key.
// Since this is a client-side demo, we use the env var directly.
const apiKey = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

// Helper to convert File to Base64 for Gemini
export const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        // remove data:image/jpeg;base64, prefix
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
    };
    reader.readAsDataURL(file);
  });

  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type,
    },
  };
};

export const createKnowledgeBasePrompt = (posts: Post[]): string => {
  const context = posts.map(p => 
    `Author: ${p.authorName}\nDate: ${new Date(p.timestamp).toLocaleDateString()}\nTags: ${p.tags.join(', ')}\nContent: ${p.content.replace(/<[^>]*>?/gm, '')}\n---\n`
  ).join('\n');

  return `
    Eres el asistente inteligente de "WikiMovil 3", una red social corporativa para técnicos de telecomunicaciones.
    Tu objetivo es ayudar a los técnicos a encontrar información, resolver dudas técnicas y resumir discusiones.
    
    A continuación se presenta la BASE DE CONOCIMIENTOS actual (posts recientes de los usuarios):
    
    ${context}
    
    Instrucciones:
    1. Responde basándote principalmente en la información provista arriba.
    2. Si la información no está en los posts, usa tu conocimiento general sobre telecomunicaciones, fibra óptica, energía y redes, pero aclara que es información externa.
    3. Tienes capacidad de VISION: Si el usuario te envía una imagen, analízala detalladamente. Identifica modelos de equipos, estado de luces (leds), cableado o daños visibles.
    4. Sé conciso, técnico y profesional.
  `;
};

export const getGeminiChat = (posts: Post[]): Chat => {
  const systemInstruction = createKnowledgeBasePrompt(posts);
  
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction,
      temperature: 0.3, // Low temperature for more factual answers
    },
  });
};

export const generateSmartTagSuggestion = async (content: string, existingTags: string[]): Promise<string[]> => {
  try {
    const prompt = `
      Analyze this text from a telecom technician: "${content}".
      Select the most relevant tags from this list: ${existingTags.join(', ')}.
      Return only the tags as a JSON array of strings.
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json'
        }
    });
    
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (e) {
    console.error("Error suggesting tags", e);
    return [];
  }
};