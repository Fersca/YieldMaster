
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { MapPin, Navigation, Loader2, ExternalLink, Info, X, ChevronRight, AlertCircle } from 'lucide-react';

interface ATM {
  name: string;
  address: string;
  uri: string;
}

export const ATMMap: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atms, setAtms] = useState<ATM[]>([]);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [closestAtm, setClosestAtm] = useState<ATM | null>(null);

  const findAtms = async () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Tu navegador no soporta geolocalización.");
      setLoading(false);
      return;
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });

        try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          // Usamos gemini-2.5-flash que es el modelo compatible con Maps Grounding
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Busca cajeros automáticos (ATM) cercanos a mi ubicación actual. Prioriza los que estén a menos de 1km. Devuelve una lista de opciones con sus nombres y enlaces de ubicación.",
            config: {
              // Combinamos Maps con Search para máxima fiabilidad
              tools: [{ googleMaps: {} }, { googleSearch: {} }],
              toolConfig: {
                retrievalConfig: {
                  latLng: { latitude, longitude }
                }
              }
            },
          });

          const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
          const chunks = groundingMetadata?.groundingChunks;
          const foundAtms: ATM[] = [];

          if (chunks && chunks.length > 0) {
            chunks.forEach((chunk: any) => {
              if (chunk.maps) {
                foundAtms.push({
                  name: chunk.maps.title || "Cajero Automático",
                  address: "Ubicación encontrada en Maps",
                  uri: chunk.maps.uri
                });
              }
            });
          } else if (groundingMetadata?.searchEntryPoint) {
            // Si no hay chunks directos de maps, intentamos avisar que use el buscador
            setError("No se encontraron chunks directos, intenta buscar manualmente en el mapa abajo.");
          }

          if (foundAtms.length > 0) {
            setAtms(foundAtms);
            setClosestAtm(foundAtms[0]);
          } else {
            // Si la IA no devuelve chunks pero respondió, mostramos un mensaje informativo
            if (!error) setError("La IA no pudo localizar cajeros específicos en esta zona exacta.");
          }
          
        } catch (err: any) {
          console.error("Gemini Maps Error:", err);
          setError(`Error de IA: ${err.message || "Servicio no disponible"}`);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("Geolocation Error:", err);
        let msg = "Error de GPS.";
        if (err.code === 1) msg = "Permiso de ubicación denegado. Actívalo en tu navegador.";
        if (err.code === 3) msg = "Tiempo de espera agotado al obtener ubicación.";
        setError(msg);
        setLoading(false);
      },
      geoOptions
    );
  };

  useEffect(() => {
    findAtms();
  }, []);

  return (
    <div className="bg-white rounded-[32px] shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white">
            <MapPin size={20} />
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-sm">Cajeros Cercanos</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Geolocalización Activa</p>
          </div>
        </div>
        <button 
          onClick={findAtms}
          disabled={loading}
          className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-all active:scale-90"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
        </button>
      </div>

      <div className="relative aspect-video w-full bg-slate-100 border-b border-slate-100">
        {location ? (
          <iframe
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={`https://www.google.com/maps?q=cajeros+automaticos&ll=${location.lat},${location.lng}&z=14&output=embed`}
          ></iframe>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sincronizando GPS...</p>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-rose-600 text-[10px] font-bold flex items-start gap-3">
            <AlertCircle size={16} className="shrink-0" /> 
            <span>{error}</span>
          </div>
        )}

        {closestAtm && (
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl shadow-sm">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-white px-2 py-0.5 rounded-full border border-emerald-100">Cajero más cercano</span>
              <a href={closestAtm.uri} target="_blank" rel="noopener noreferrer" className="text-emerald-600 p-1 hover:bg-white rounded-lg transition-colors"><ExternalLink size={16} /></a>
            </div>
            <h4 className="font-black text-slate-800 text-sm">{closestAtm.name}</h4>
          </div>
        )}

        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {atms.slice(1).map((atm, i) => (
            <a 
              key={i} 
              href={atm.uri} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                  <MapPin size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-700">{atm.name}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Ver ruta en Maps</span>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-300" />
            </a>
          ))}
        </div>

        {atms.length === 0 && !loading && !error && (
          <div className="text-center py-6">
            <Info className="mx-auto mb-2 text-slate-300" size={24} />
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Usa el mapa interactivo arriba</p>
          </div>
        )}
      </div>
    </div>
  );
};
