import { db } from "./firebase.js";
import { searchInternet } from "./search.js";
import { openai } from "./llm.js";

export async function searchInternal(query) {
  const results = [];
  const q = query.toLowerCase();

  // Buscar en biblioteca por nombre
  const libSnap = await db.collection("library").limit(20).get();
  libSnap.forEach(doc => {
    const data = doc.data();
    if (data.name?.toLowerCase().includes(q)) {
      results.push({
        type: "library",
        title: data.name,
        url: data.url,
        summary: `Documento interno: ${data.name}`
      });
    }
  });

  // Buscar en posts por título, contenido y tags
  const postSnap = await db.collection("posts").limit(30).get();
  postSnap.forEach(doc => {
    const data = doc.data();
    const hayCoincidencia =
      data.title?.toLowerCase().includes(q) ||
      data.content?.toLowerCase().includes(q) ||
      data.tags?.some(t => t.toLowerCase().includes(q));

    if (hayCoincidencia) {
      results.push({
        type: "post",
        title: data.title || "Post interno",
        tags: data.tags || [],
        summary: (data.content || "").replace(/<[^>]*>/g, "").slice(0, 300)
      });
    }
  });

  return results;
}

export async function runAgent(question, imageBase64 = null) {
  const internal = await searchInternal(question);
  const hasInternal = internal.length > 0;

  let external = [];
  if (!hasInternal && !imageBase64) {
    external = await searchInternet(question);
  }

  let context = "";
  if (internal.length > 0) {
    context += "INFORMACIÓN INTERNA (WikiMovil):\n";
    internal.forEach(item => {
      context += `- [${item.type.toUpperCase()}] ${item.title}`;
      if (item.tags?.length) context += ` [tags: ${item.tags.join(", ")}]`;
      context += `\n  ${item.summary}\n`;
    });
    context += "\n";
  }
  if (external.length > 0) {
    context += "INFORMACIÓN EXTERNA:\n";
    external.forEach(item => { context += `- ${item.summary}\n`; });
    context += "\n";
  }

  const systemPrompt = `Sos un asistente técnico de WikiMovil, una wiki interna para técnicos de telecomunicaciones.
Hay información interna disponible: ${hasInternal ? "SÍ" : "NO"}
Contexto disponible:
${context || "Sin contexto disponible."}
Reglas:
- Priorizá SIEMPRE la información interna si existe.
- Si usás información externa, aclaralo.
- No inventes datos técnicos.
- Sé conciso y directo. Respondé en español.
- Si hay información interna relevante, citá el título del post o documento.`;

  // Armar el mensaje con o sin imagen
  let userContent;
  if (imageBase64) {
    userContent = [
      {
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`,
          detail: "high"
        }
      },
      {
        type: "text",
        text: question
      }
    ];
  } else {
    userContent = question;
  }

  const completion = await openai.chat.completions.create({
    model: imageBase64 ? "gpt-4o" : "gpt-4.1-mini", // Vision requiere gpt-4o
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    temperature: 0.3,
    max_tokens: 1000
  });

  return {
    answer: completion.choices[0].message.content,
    internal,
    external
  };
}
