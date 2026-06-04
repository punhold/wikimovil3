export async function askAgent(question: string) {
  const res = await fetch("http://localhost:3001/api/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ question })
  });

  if (!res.ok) {
    throw new Error("Error consultando al agente IA");
  }

  return res.json();
}
