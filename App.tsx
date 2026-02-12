
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserProfile, Bank, Currency, BankSource, BankPromotion } from './types';
import { BalanceCard } from './components/BalanceCard';
import { BankTable } from './components/BankTable';
import { BankForm } from './components/BankForm';
import { GrowthChart } from './components/GrowthChart';
import { ATMMap } from './components/ATMMap';
import { BankDiscounts } from './components/BankDiscounts';
import { LogIn, TrendingUp, RefreshCw, Layers, Map as MapIcon, Settings, X, Sparkles, Cloud, Ticket, Loader2 } from 'lucide-react';
import { getOrCreateSpreadsheet, fetchBanksFromSheet, saveBanksToSheet, fetchBalancesFromSheet, saveBalancesToSheet, getOrCreateFolder, uploadImageToDrive } from './services/googleSheets';
import { fetchPublicBankRates } from './services/bankRates';
import { fetchDailyDiscounts } from './services/bankDiscounts';
import { jsPDF } from 'jspdf';
import { GoogleGenAI, Type } from "@google/genai";

const DEFAULT_CLIENT_ID = '999301723526-fss4uphevi3q781oo58vv5jcm2umopbr.apps.googleusercontent.com';
const STORAGE_KEY = 'yieldmaster_user_session';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [clientId, setClientId] = useState<string>(DEFAULT_CLIENT_ID);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetchingRates, setIsFetchingRates] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [sid, setSid] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showAtms, setShowAtms] = useState(false);
  
  // Discounts states
  const [isFetchingDiscounts, setIsFetchingDiscounts] = useState(false);
  const [discountsData, setDiscountsData] = useState<{promotions: BankPromotion[], sources: BankSource[], timestamp: string} | null>(null);

  const [suggestedRates, setSuggestedRates] = useState<Partial<Bank>[] | null>(null);
  const [publicSources, setPublicSources] = useState<BankSource[]>([]);
  const [lastPublicUpdate, setLastPublicUpdate] = useState<string | null>(null);
  const [showRatesModal, setShowRatesModal] = useState(false);

  const [pesosBalance, setPesosBalance] = useState<number>(0);
  const [usdBalance, setUsdBalance] = useState<number>(0);
  const [banks, setBanks] = useState<Bank[]>([
    { id: '1', name: 'Banco Nación', ratePesos: 35, rateUsd: 0.5, source: 'local' },
    { id: '2', name: 'Santander', ratePesos: 32, rateUsd: 1.5, source: 'local' },
    { id: '3', name: 'Galicia', ratePesos: 33, rateUsd: 1.0, source: 'local' }
  ]);
  
  const [selectedBankId, setSelectedBankId] = useState<string | null>(banks[0]?.id || null);
  const [currentBankId, setCurrentBankId] = useState<string | null>(null);
  const [chartCurrency, setChartCurrency] = useState<Currency>('ARS');
  const [sortConfig, setSortConfig] = useState<{ key: 'ratePesos' | 'rateUsd' | 'name', direction: 'asc' | 'desc' } | null>(null);

  const [isBankFormOpen, setIsBankFormOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);

  // OCR/Camera/Drive states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [detectedAmount, setDetectedAmount] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Persistence: Restore user on mount
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY);
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        if (parsedUser.accessToken) syncWithSheets(parsedUser.accessToken);
      } catch (e) { localStorage.removeItem(STORAGE_KEY); }
    }
  }, []);

  // Camera Management
  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setAuthError("No se pudo acceder a la cámara.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsCameraActive(false);
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsProcessingOcr(true);
    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);
    
    const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];
    stopCamera();

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = "Actúa como un experto en OCR financiero. Extrae únicamente el saldo total o monto principal. Devuelve un JSON con la llave 'amount'. Si no hay monto claro, devuelve 0.";
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { parts: [
            { text: prompt },
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
          ]}
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { amount: { type: Type.NUMBER } },
            required: ["amount"]
          }
        }
      });

      const result = JSON.parse(response.text || '{"amount": 0}');
      if (result.amount > 0) {
        setDetectedAmount(result.amount);
        if (user?.accessToken) {
          setIsUploadingToDrive(true);
          try {
            const folderId = await getOrCreateFolder(user.accessToken);
            const fileName = `YieldCapture_${new Date().getTime()}.jpg`;
            await uploadImageToDrive(user.accessToken, folderId, base64Image, fileName);
          } catch (driveErr) {
            console.error("Drive upload error:", driveErr);
          } finally {
            setIsUploadingToDrive(false);
          }
        }
      } else {
        setAuthError("No pudimos detectar un monto claro.");
      }
    } catch (err) {
      setAuthError("Error procesando con IA.");
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const confirmDetectedAmount = () => {
    if (detectedAmount !== null) {
      setPesosBalance(detectedAmount);
      if (user?.accessToken && sid) saveBalancesToSheet(user.accessToken, sid, detectedAmount, usdBalance);
      setDetectedAmount(null);
    }
  };

  const sortedBanks = useMemo(() => {
    if (!sortConfig) return banks;
    return [...banks].sort((a, b) => {
      const aValue = a[sortConfig.key] || 0;
      const bValue = b[sortConfig.key] || 0;
      return sortConfig.direction === 'asc' ? (aValue < bValue ? -1 : 1) : (aValue > bValue ? -1 : 1);
    });
  }, [banks, sortConfig]);

  const handleSort = (key: 'ratePesos' | 'rateUsd' | 'name') => {
    setSortConfig(prev => (prev?.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'desc' }));
  };

  const logout = () => { setUser(null); setSid(null); localStorage.removeItem(STORAGE_KEY); };

  const syncWithSheets = async (token: string) => {
    setIsSyncing(true);
    setAuthError(null);
    try {
      const sheetId = await getOrCreateSpreadsheet(token);
      setSid(sheetId);
      const fetchedBanks = await fetchBanksFromSheet(token, sheetId);
      if (fetchedBanks?.length) setBanks(fetchedBanks);
      const fb = await fetchBalancesFromSheet(token, sheetId);
      if (fb) { setPesosBalance(fb.pesos); setUsdBalance(fb.usd); }
    } catch (error: any) {
      if (error.message.includes('401')) logout();
      else setAuthError(`Error de sincronización: ${error.message}`);
    } finally { setIsSyncing(false); }
  };

  const handleLogin = () => {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) return;
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile email openid',
      callback: async (resp: any) => {
        if (resp.access_token) {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${resp.access_token}` } });
          const data = await res.json();
          const newUser = { name: data.name, email: data.email, picture: data.picture, accessToken: resp.access_token };
          setUser(newUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
          syncWithSheets(resp.access_token);
        }
      }
    });
    client.requestAccessToken();
  };

  const handleFetchRates = async () => {
    setIsFetchingRates(true);
    try {
      const result = await fetchPublicBankRates();
      setSuggestedRates(result.rates);
      setPublicSources(result.sources);
      setLastPublicUpdate(result.timestamp);
      setShowRatesModal(true);
    } catch (e) { setAuthError("No se pudieron obtener las tasas públicas."); } finally { setIsFetchingRates(false); }
  };

  const handleSearchDiscounts = async () => {
    setIsFetchingDiscounts(true);
    setAuthError(null);
    try {
      const bankNames = banks.map(b => b.name);
      const result = await fetchDailyDiscounts(bankNames);
      setDiscountsData(result);
    } catch (e) {
      setAuthError("No se pudieron buscar los descuentos del día.");
    } finally {
      setIsFetchingDiscounts(false);
    }
  };

  const generatePDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      doc.setFillColor(5, 150, 105);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255);
      doc.setFontSize(24);
      doc.text('YieldMaster Report', 20, 25);
      doc.save(`YieldMaster_Reporte.pdf`);
    } catch (err) { setAuthError("Error generando PDF."); } finally { setIsGeneratingPdf(false); }
  };

  const calculationData = useMemo(() => {
    const sb = banks.find(b => b.id === selectedBankId);
    const cb = banks.find(b => b.id === currentBankId);
    if (!sb) return { chartData: [], totalGain: 0 };
    const initial = chartCurrency === 'ARS' ? pesosBalance : usdBalance;
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const data = [];
    const selM = ((chartCurrency === 'ARS' ? sb.ratePesos : sb.rateUsd) / 100) / 12;
    const curM = cb ? ((chartCurrency === 'ARS' ? cb.ratePesos : cb.rateUsd) / 100) / 12 : 0;
    let sc = initial, cc = initial;
    data.push({ monthName: 'Hoy', potentialValue: Math.round(sc), currentValue: cb ? Math.round(cc) : undefined });
    for (let i = 0; i < 12; i++) { sc *= (1 + selM); cc *= (1 + curM); data.push({ monthName: months[i], potentialValue: Math.round(sc), currentValue: cb ? Math.round(cc) : undefined }); }
    return { chartData: data, totalGain: sc - initial, comparisonTotalGain: cb ? (cc - initial) : undefined, potentialBankName: sb.name, currentBankName: cb?.name };
  }, [banks, selectedBankId, currentBankId, pesosBalance, usdBalance, chartCurrency]);

  return (
    <div className="max-w-md mx-auto min-h-screen pb-12 flex flex-col bg-slate-50 relative overflow-x-hidden border-x border-slate-200 shadow-2xl">
      <header className="p-6 flex justify-between items-center bg-white/90 backdrop-blur-md sticky top-0 z-10 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-lg"><TrendingUp size={20} /></div>
          <h1 className="font-black text-xl text-slate-800">YieldMaster</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowConfig(!showConfig)} className={`p-2 ${showConfig ? 'text-emerald-600 bg-emerald-50 rounded-lg' : 'text-slate-400'}`}><Settings size={20} /></button>
          {user ? <img src={user.picture} onClick={logout} className="w-8 h-8 rounded-full border-2 border-emerald-500 cursor-pointer" /> : <button onClick={handleLogin} className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-xl flex items-center gap-1.5"><LogIn size={12} /> Ingresar</button>}
        </div>
      </header>

      {showConfig && (
        <div className="bg-white border-b border-emerald-100 p-6 space-y-4 animate-in slide-in-from-top duration-300">
          <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full p-3 text-xs border border-slate-200 rounded-xl outline-none" />
          <button onClick={() => setShowConfig(false)} className="w-full bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold">Cerrar</button>
        </div>
      )}

      <main className="flex-1 p-5 space-y-5">
        {authError && <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex justify-between gap-3 text-rose-800 text-xs"><p>{authError}</p><button onClick={() => setAuthError(null)}><X size={16} /></button></div>}

        <BalanceCard 
          pesos={pesosBalance} usd={usdBalance} 
          onUpdate={(p, u) => { setPesosBalance(p); setUsdBalance(u); if (user?.accessToken && sid) saveBalancesToSheet(user.accessToken, sid, p, u); }}
          onScanClick={startCamera}
        />

        {/* Map Trigger Section */}
        <div className="flex justify-center -mb-2">
          <button 
            onClick={() => setShowAtms(!showAtms)}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest transition-all duration-300 shadow-lg ${showAtms ? 'bg-rose-500 text-white' : 'bg-blue-600 text-white hover:scale-105 active:scale-95'}`}
          >
            {showAtms ? <><X size={14} /> Cerrar Mapa</> : <><MapIcon size={14} /> Buscar Cajeros</>}
          </button>
        </div>

        {showAtms && <ATMMap />}
        
        <BankTable 
          banks={sortedBanks} selectedBankId={selectedBankId} currentBankId={currentBankId} sortConfig={sortConfig} publicSources={publicSources} lastPublicUpdate={lastPublicUpdate}
          onSelect={setSelectedBankId} onSetCurrent={setCurrentBankId} onSort={handleSort} onAdd={() => { setEditingBank(null); setIsBankFormOpen(true); }} onEdit={(b) => { setEditingBank(b); setIsBankFormOpen(true); }} onDelete={(id) => { const nb = banks.filter(b => b.id !== id); setBanks(nb); if (user?.accessToken && sid) saveBanksToSheet(user.accessToken, sid, nb); }} onFetchPublic={handleFetchRates} isFetching={isFetchingRates} 
        />

        {/* Discounts Trigger & List */}
        <div className="space-y-4">
          <button 
            onClick={handleSearchDiscounts}
            disabled={isFetchingDiscounts}
            className={`w-full py-4 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl ${isFetchingDiscounts ? 'bg-slate-100 text-slate-400' : 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95'}`}
          >
            {isFetchingDiscounts ? (
              <><Loader2 size={16} className="animate-spin" /> Escaneando Beneficios...</>
            ) : (
              <><Ticket size={16} /> Buscar descuentos del día</>
            )}
          </button>

          {discountsData && (
            <BankDiscounts 
              data={discountsData.promotions} 
              sources={discountsData.sources} 
              timestamp={discountsData.timestamp} 
            />
          )}
        </div>

        {selectedBankId ? (
          <div className="space-y-4">
            <GrowthChart data={calculationData.chartData} currency={chartCurrency} totalGain={calculationData.totalGain} comparisonTotalGain={calculationData.comparisonTotalGain} potentialBankName={calculationData.potentialBankName} currentBankName={calculationData.currentBankName} onDownloadPdf={generatePDF} isDownloading={isGeneratingPdf} />
            <div className="flex p-1 bg-slate-200/50 rounded-2xl">
              <button onClick={() => setChartCurrency('ARS')} className={`flex-1 py-3 rounded-xl font-black text-xs ${chartCurrency === 'ARS' ? 'bg-white text-emerald-600 shadow-lg' : 'text-slate-500'}`}>ARS</button>
              <button onClick={() => setChartCurrency('USD')} className={`flex-1 py-3 rounded-xl font-black text-xs ${chartCurrency === 'USD' ? 'bg-white text-emerald-600 shadow-lg' : 'text-slate-500'}`}>USD</button>
            </div>
          </div>
        ) : <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 text-xs"><Layers className="mx-auto mb-2" size={32} />Selecciona un banco</div>}
      </main>

      {/* Overlays (Camera, Detected Amount, Loading, Modals) */}
      {isCameraActive && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
          <div className="relative flex-1 bg-slate-900 flex items-center justify-center overflow-hidden">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none">
              <div className="w-full h-full border-2 border-emerald-500/50 rounded-3xl relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-emerald-500/30 animate-pulse" />
              </div>
            </div>
            <button onClick={stopCamera} className="absolute top-10 left-6 bg-black/40 text-white p-3 rounded-full"><X size={24} /></button>
          </div>
          <div className="bg-slate-900 p-8 flex justify-center">
            <button onClick={captureAndScan} className="w-20 h-20 bg-white rounded-full flex items-center justify-center"><div className="w-16 h-16 border-4 border-slate-900 rounded-full flex items-center justify-center"><Sparkles size={32} className="text-slate-900" /></div></button>
          </div>
        </div>
      )}

      {detectedAmount !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-[110] backdrop-blur-md">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-8 text-center animate-in zoom-in">
            <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600"><Sparkles size={32} /></div>
            <h3 className="text-lg font-black text-slate-800 mb-2">¡Monto Detectado!</h3>
            <div className="text-4xl font-black text-emerald-600 mb-4">$ {detectedAmount.toLocaleString('es-AR')}</div>
            {isUploadingToDrive && <div className="flex items-center justify-center gap-2 text-[10px] text-blue-500 font-bold mb-4 animate-pulse"><Cloud size={14} /> Guardando copia en Drive...</div>}
            <div className="flex gap-3">
              <button onClick={() => setDetectedAmount(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl text-xs">Descartar</button>
              <button onClick={confirmDetectedAmount} className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-2xl text-xs shadow-lg">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {(isProcessingOcr || isUploadingToDrive || isFetchingDiscounts) && (
        <div className="fixed inset-0 bg-slate-900/90 z-[120] flex flex-col items-center justify-center text-white p-6 text-center">
          <RefreshCw size={64} className="animate-spin text-amber-500 opacity-20" />
          <p className="mt-6 font-black text-sm uppercase tracking-[0.2em]">
            {isUploadingToDrive ? 'Guardando en Drive...' : 
             isFetchingDiscounts ? 'Buscando Beneficios del Día...' : 
             'Analizando con IA...'}
          </p>
          <p className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">Esto puede tomar unos segundos</p>
        </div>
      )}

      {showRatesModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden p-6 animate-in zoom-in">
            <h3 className="text-lg font-black mb-4">Nuevas Tasas Detectadas</h3>
            <div className="space-y-2 mb-6 max-h-40 overflow-y-auto">
              {suggestedRates?.map((r, i) => (
                <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded-xl text-[10px]">
                  <span className="font-bold text-slate-700">{r.name}</span>
                  <span className="text-blue-600 font-black">{r.ratePesos}%</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowRatesModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl text-xs">Cancelar</button>
              <button onClick={() => {
                const nb = [...banks];
                const now = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
                suggestedRates?.forEach(s => {
                  const idx = nb.findIndex(b => b.name.toLowerCase().includes(s.name?.toLowerCase() || ''));
                  if (idx > -1) nb[idx] = { ...nb[idx], ratePesos: s.ratePesos || 0, source: 'public', lastUpdated: now };
                });
                setBanks(nb); setShowRatesModal(false); if (user?.accessToken && sid) saveBanksToSheet(user.accessToken, sid, nb);
              }} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-2xl text-xs">Actualizar</button>
            </div>
          </div>
        </div>
      )}

      {isBankFormOpen && <BankForm bank={editingBank} onSave={(b) => { 
        const nb = editingBank ? banks.map(old => old.id === b.id ? { ...b, source: 'local' as const } : old) : [...banks, { ...b, source: 'local' as const }];
        setBanks(nb); setIsBankFormOpen(false); if (user?.accessToken && sid) saveBanksToSheet(user.accessToken, sid, nb);
      }} onCancel={() => setIsBankFormOpen(false)} />}
      
      {isSyncing && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in"><RefreshCw size={14} className="animate-spin text-emerald-400" /><span className="text-[10px] font-black uppercase tracking-widest">Cloud Sync...</span></div>}
    </div>
  );
};

export default App;
