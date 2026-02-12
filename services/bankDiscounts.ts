
import { GoogleGenAI, Type } from "@google/genai";
import { BankPromotion, BankSource } from "../types";

export interface DiscountsResponse {
  promotions: BankPromotion[];
  sources: BankSource[];
  timestamp: string;
}

export async function fetchDailyDiscounts(bankNames: string[]): Promise<DiscountsResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  
  const prompt = `Busca las promociones, beneficios y descuentos bancarios vigentes en Argentina para el día de hoy (${today}) para los siguientes bancos: ${bankNames.join(", ")}. 
  Enfócate en rubros como Supermercados, Combustible, Gastronomía y Farmacias. 
  Devuelve un JSON con la estructura: [{"bankName": "Nombre", "benefits": [{"category": "Rubro", "description": "Detalle", "discount": "Porcentaje o monto"}]}]`;

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
            bankName: { type: Type.STRING },
            benefits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  description: { type: Type.STRING },
                  discount: { type: Type.STRING }
                },
                required: ["category", "description"]
              }
            }
          },
          required: ["bankName", "benefits"]
        }
      }
    },
  });

  const sources: BankSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web) {
        sources.push({ title: chunk.web.title || "Fuente", uri: chunk.web.uri });
      }
    });
  }

  try {
    const promotions = JSON.parse(response.text || "[]");
    return { 
      promotions, 
      sources, 
      timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) 
    };
  } catch (e) {
    console.error("Error parsing discounts:", e);
    return { promotions: [], sources: [], timestamp: "" };
  }
}
