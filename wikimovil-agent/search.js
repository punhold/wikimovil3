import fetch from "node-fetch";

export async function searchInternet(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&ia=web`;

  const res = await fetch(url);
  const text = await res.text();

  // Ultra simple (primer MVP)
  return [
    {
      source: "internet",
      summary: "Información general obtenida de búsqueda web (DuckDuckGo).",
    }
  ];
}
