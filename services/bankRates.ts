import { GoogleGenAI, Type } from "@google/genai";
import { Bank, BankSource } from "../types";

export interface PublicRatesResponse {
  rates: Partial<Bank>[];
  sources: BankSource[];
  timestamp: string;
}

export async function fetchPublicBankRates(): Promise<PublicRatesResponse> {
  // Always use process.env.API_KEY directly for initialization as per @google/genai guidelines.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Busca las tasas de interés nominal anual (TNA) actuales para plazos fijos en pesos de los principales bancos de Argentina (como Banco Nación, Santander, Galicia, BBVA, Macro, etc.). 
  Devuelve una lista en formato JSON que contenga el nombre del banco y la TNA en pesos. Si no encuentras la TNA en dólares, usa 0.1 como valor por defecto.
  Formato esperado: [{"name": "Nombre Banco", "ratePesos": 35, "rateUsd": 0.1}]`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            ratePesos: { type: Type.NUMBER },
            rateUsd: { type: Type.NUMBER }
          },
          required: ["name", "ratePesos"]
        }
      }
    },
  });

  const sources: BankSource[] = [];
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  
  if (groundingChunks) {
    groundingChunks.forEach((chunk: any) => {
      if (chunk.web) {
        sources.push({
          title: chunk.web.title || "Fuente sin título",
          uri: chunk.web.uri
        });
      }
    });
  }

  const timestamp = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

  try {
    // Correctly accessing .text property on response.
    const text = response.text;
    const rates = JSON.parse(text || "[]");
    return { rates, sources, timestamp };
  } catch (e) {
    console.error("Error parsing bank rates:", e);
    return { rates: [], sources: [], timestamp };
  }
}