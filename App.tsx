
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserProfile, Bank, Currency, BankSource } from './types';
import { BalanceCard } from './components/BalanceCard';
import { BankTable } from './components/BankTable';
import { BankForm } from './components/BankForm';
import { GrowthChart } from './components/GrowthChart';
import { LogIn, LogOut, TrendingUp, RefreshCw, Layers, DollarSign, Settings, Copy, CheckCircle2, ShieldAlert, Bug, ExternalLink, Download, Globe, Check, X, FileDown, Share2, Camera, CameraOff, Sparkles } from 'lucide-react';
import { getOrCreateSpreadsheet, fetchBanksFromSheet, saveBanksToSheet, fetchBalancesFromSheet, saveBalancesToSheet } from './services/googleSheets';
import { fetchPublicBankRates } from './services/bankRates';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
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
  const [copied, setCopied] = useState(false);
  
  const [suggestedRates, setSuggestedRates] = useState<Partial<Bank>[] | null>(null);
  const [publicSources, setPublicSources] = useState<BankSource[]>([]);
  const [lastPublicUpdate, setLastPublicUpdate] = useState<string | null>(null);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

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

  // OCR/Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [detectedAmount, setDetectedAmount] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Refs for PDF capture
  const tableRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const balanceRef = useRef<HTMLDivElement>(null);

  // Persistence: Restore user on mount
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY);
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        if (parsedUser.accessToken) {
          syncWithSheets(parsedUser.accessToken);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Camera Management
  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
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
      const prompt = "Actúa como un experto en OCR financiero. De esta imagen (resumen de banco o pantalla), extrae únicamente el saldo total o monto principal. Devuelve el resultado en formato JSON con la llave 'amount' y el valor numérico. Ejemplo: {\"amount\": 12500.50}. Si no hay monto claro, devuelve 0.";
      
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
            properties: {
              amount: { type: Type.NUMBER }
            },
            required: ["amount"]
          }
        }
      });

      const result = JSON.parse(response.text || '{"amount": 0}');
      if (result.amount > 0) {
        setDetectedAmount(result.amount);
      } else {
        setAuthError("No pudimos detectar un monto claro. Intenta de nuevo.");
      }
    } catch (err) {
      console.error("OCR error:", err);
      setAuthError("Error procesando la imagen con IA.");
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
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue === undefined || bValue === undefined) return 0;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [banks, sortConfig]);

  const handleSort = (key: 'ratePesos' | 'rateUsd' | 'name') => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const logout = () => {
    setUser(null);
    setSid(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const syncWithSheets = async (token: string) => {
    setIsSyncing(true);
    setAuthError(null);
    try {
      const sheetId = await getOrCreateSpreadsheet(token);
      setSid(sheetId);
      const fetchedBanks = await fetchBanksFromSheet(token, sheetId);
      if (fetchedBanks && fetchedBanks.length > 0) setBanks(fetchedBanks);
      const fetchedBalances = await fetchBalancesFromSheet(token, sheetId);
      if (fetchedBalances) {
        setPesosBalance(fetchedBalances.pesos);
        setUsdBalance(fetchedBalances.usd);
      }
    } catch (error: any) { 
      console.error("Sync error:", error);
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        setAuthError("Tu sesión de Google ha expirado. Por favor, vuelve a ingresar.");
        logout();
      } else {
        setAuthError(`Error de sincronización: ${error.message}`);
      }
    } finally { 
      setIsSyncing(false); 
    }
  };

  const handleLogin = () => {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) return;
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile email openid',
        callback: async (response: any) => {
          if (response.access_token) {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { 
              headers: { Authorization: `Bearer ${response.access_token}` } 
            });
            const data = await res.json();
            const newUser = { 
              name: data.name, 
              email: data.email, 
              picture: data.picture, 
              accessToken: response.access_token 
            };
            setUser(newUser);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
            syncWithSheets(response.access_token);
          }
        }
      });
      client.requestAccessToken();
    } catch (err: any) { 
      setAuthError(`Error al abrir login: ${err.message}`); 
    }
  };

  const handleFetchRates = async () => {
    setIsFetchingRates(true);
    try {
      const result = await fetchPublicBankRates();
      setSuggestedRates(result.rates);
      setPublicSources(result.sources);
      setLastPublicUpdate(result.timestamp);
      setShowRatesModal(true);
    } catch (e) { 
      setAuthError("No se pudieron obtener las tasas públicas."); 
    } finally { 
      setIsFetchingRates(false); 
    }
  };

  const generatePDF = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFillColor(5, 150, 105);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('YieldMaster Report', 20, 25);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generado el: ${new Date().toLocaleString()}`, 20, 33);

      let currentY = 50;

      if (balanceRef.current) {
        const canvas = await html2canvas(balanceRef.current, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 170;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        doc.addImage(imgData, 'PNG', 20, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 10;
      }

      if (tableRef.current) {
        const canvas = await html2canvas(tableRef.current, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 170;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        if (currentY + imgHeight > 270) { doc.addPage(); currentY = 20; }
        doc.addImage(imgData, 'PNG', 20, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 10;
      }

      if (chartRef.current) {
        const canvas = await html2canvas(chartRef.current, { 
          scale: 2,
          ignoreElements: (element) => element.hasAttribute('data-html2canvas-ignore')
        });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 170;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        if (currentY + imgHeight > 270) { doc.addPage(); currentY = 20; }
        doc.addImage(imgData, 'PNG', 20, currentY, imgWidth, imgHeight);
      }

      doc.save(`YieldMaster_Reporte_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      setAuthError("No se pudo generar el PDF. Intenta nuevamente.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const applySuggestedRates = () => {
    if (!suggestedRates) return;
    const newBanks = [...banks];
    const now = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    
    suggestedRates.forEach(suggested => {
      const suggestedName = suggested.name || "";
      const existingIndex = newBanks.findIndex(b => b.name.toLowerCase().includes(suggestedName.toLowerCase()));
      if (existingIndex > -1) {
        newBanks[existingIndex] = { ...newBanks[existingIndex], ratePesos: suggested.ratePesos || 0, source: 'public', lastUpdated: now };
      }
    });

    setBanks(newBanks);
    setShowRatesModal(false);
    if (user?.accessToken && sid) saveBanksToSheet(user.accessToken, sid, newBanks);
  };

  const calculationData = useMemo(() => {
    const selectedBank = banks.find(b => b.id === selectedBankId);
    const currentBank = banks.find(b => b.id === currentBankId);
    if (!selectedBank) return { chartData: [], totalGain: 0 };
    
    const initialBalance = chartCurrency === 'ARS' ? pesosBalance : usdBalance;
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const data = [];
    const selAnnualRate = chartCurrency === 'ARS' ? selectedBank.ratePesos : selectedBank.rateUsd;
    const selMonthlyRate = (selAnnualRate / 100) / 12;
    const curAnnualRate = currentBank ? (chartCurrency === 'ARS' ? currentBank.ratePesos : currentBank.rateUsd) : 0;
    const curMonthlyRate = (curAnnualRate / 100) / 12;

    let selCurrent = initialBalance;
    let curCurrent = initialBalance;
    data.push({ monthName: 'Hoy', potentialValue: Math.round(selCurrent), currentValue: currentBank ? Math.round(curCurrent) : undefined });

    for (let i = 1; i <= 12; i++) {
      selCurrent *= (1 + selMonthlyRate);
      curCurrent *= (1 + curMonthlyRate);
      data.push({ monthName: months[i-1], potentialValue: Math.round(selCurrent), currentValue: currentBank ? Math.round(curCurrent) : undefined });
    }

    return { 
      chartData: data, 
      totalGain: selCurrent - initialBalance,
      comparisonTotalGain: currentBank ? (curCurrent - initialBalance) : undefined,
      potentialBankName: selectedBank.name,
      currentBankName: currentBank?.name
    };
  }, [banks, selectedBankId, currentBankId, pesosBalance, usdBalance, chartCurrency]);

  return (
    <div className="max-w-md mx-auto min-h-screen pb-12 flex flex-col bg-slate-50 relative overflow-x-hidden border-x border-slate-200 shadow-2xl">
      <header className="p-6 flex justify-between items-center bg-white/90 backdrop-blur-md sticky top-0 z-10 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-lg"><TrendingUp size={20} /></div>
          <h1 className="font-black text-xl text-slate-800">YieldMaster</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowConfig(!showConfig)} className={`p-2 transition-colors ${showConfig ? 'text-emerald-600 bg-emerald-50 rounded-lg' : 'text-slate-400 hover:text-emerald-600'}`}><Settings size={20} /></button>
          {user ? (
            <img src={user.picture} onClick={logout} className="w-8 h-8 rounded-full border-2 border-emerald-500 cursor-pointer" title="Cerrar sesión" />
          ) : (
            <button onClick={handleLogin} className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-xl flex items-center gap-1.5"><LogIn size={12} /> Ingresar</button>
          )}
        </div>
      </header>

      {showConfig && (
        <div className="bg-white border-b border-emerald-100 p-6 space-y-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldAlert size={16} className="text-emerald-600" /> Configuración</h3>
            <button onClick={() => { navigator.clipboard.writeText(window.location.origin); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-[10px] bg-slate-100 px-2 py-1 rounded-md font-bold uppercase">{copied ? '¡OK!' : 'Copiar URL'}</button>
          </div>
          <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full p-3 text-xs border border-slate-200 rounded-xl outline-none" placeholder="Client ID..." />
          <button onClick={() => setShowConfig(false)} className="w-full bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold">Aceptar</button>
        </div>
      )}

      <main className="flex-1 p-5 space-y-5">
        {authError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start justify-between gap-3 text-rose-800 text-xs shadow-sm">
            <div className="flex items-start gap-3">
              <Bug size={16} className="shrink-0 mt-0.5" />
              <div><p className="font-bold">Aviso:</p><p>{authError}</p></div>
            </div>
            <button onClick={() => setAuthError(null)} className="text-rose-400 hover:text-rose-600"><X size={16} /></button>
          </div>
        )}

        <div ref={balanceRef}>
          <BalanceCard 
            pesos={pesosBalance} 
            usd={usdBalance} 
            onUpdate={(p, u) => { setPesosBalance(p); setUsdBalance(u); if (user?.accessToken && sid) saveBalancesToSheet(user.accessToken, sid, p, u); }}
            onScanClick={startCamera}
          />
        </div>
        
        <div ref={tableRef}>
          <BankTable 
            banks={sortedBanks} selectedBankId={selectedBankId} currentBankId={currentBankId} sortConfig={sortConfig} publicSources={publicSources} lastPublicUpdate={lastPublicUpdate}
            onSelect={setSelectedBankId} onSetCurrent={setCurrentBankId} onSort={handleSort} onAdd={() => { setEditingBank(null); setIsBankFormOpen(true); }} onEdit={(bank) => { setEditingBank(bank); setIsBankFormOpen(true); }} onDelete={(id) => { const nb = banks.filter(b => b.id !== id); setBanks(nb); if (user?.accessToken && sid) saveBanksToSheet(user.accessToken, sid, nb); }} onFetchPublic={handleFetchRates} isFetching={isFetchingRates} 
          />
        </div>

        {selectedBankId ? (
          <div className="space-y-4">
            <div ref={chartRef}>
              <GrowthChart 
                data={calculationData.chartData} currency={chartCurrency} totalGain={calculationData.totalGain} comparisonTotalGain={calculationData.comparisonTotalGain} potentialBankName={calculationData.potentialBankName} currentBankName={calculationData.currentBankName} onDownloadPdf={generatePDF} isDownloading={isGeneratingPdf}
              />
            </div>
            <div className="flex p-1 bg-slate-200/50 rounded-2xl shadow-inner">
              <button onClick={() => setChartCurrency('ARS')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black transition-all text-xs ${chartCurrency === 'ARS' ? 'bg-white text-emerald-600 shadow-lg' : 'text-slate-500'}`}><DollarSign size={14} /> ARS</button>
              <button onClick={() => setChartCurrency('USD')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black transition-all text-xs ${chartCurrency === 'USD' ? 'bg-white text-emerald-600 shadow-lg' : 'text-slate-500'}`}><DollarSign size={14} className="rotate-12" /> USD</button>
            </div>
          </div>
        ) : <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200"><Layers className="mx-auto text-slate-200 mb-2" size={32} /><p className="text-slate-400 text-xs">Selecciona un banco</p></div>}
      </main>

      {/* Camera Modal */}
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

            <div className="absolute top-10 left-0 w-full px-6 flex justify-between items-center">
              <button onClick={stopCamera} className="bg-black/40 text-white p-3 rounded-full backdrop-blur-md"><X size={24} /></button>
              <div className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">IA Escáner</div>
            </div>
          </div>
          <div className="bg-slate-900 p-8 flex justify-center items-center gap-8">
            <button 
              onClick={captureAndScan}
              disabled={isProcessingOcr}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
            >
              <div className="w-16 h-16 border-4 border-slate-900 rounded-full flex items-center justify-center">
                {isProcessingOcr ? <RefreshCw className="animate-spin text-slate-900" /> : <Camera size={32} className="text-slate-900" />}
              </div>
            </button>
          </div>
        </div>
      )}

      {/* OCR Result Confirmation */}
      {detectedAmount !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-[110] backdrop-blur-md">
          <div className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl p-8 text-center animate-in zoom-in duration-200">
            <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
              <Sparkles size={32} />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">¡Monto Detectado!</h3>
            <p className="text-slate-500 text-sm mb-6">Hemos encontrado el siguiente saldo en tu imagen:</p>
            <div className="text-4xl font-black text-emerald-600 mb-8">$ {detectedAmount.toLocaleString('es-AR')}</div>
            <div className="flex gap-3">
              <button onClick={() => setDetectedAmount(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl text-xs">Descartar</button>
              <button onClick={confirmDetectedAmount} className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-2xl text-xs shadow-lg shadow-emerald-100">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Processing OCR Overlay */}
      {isProcessingOcr && (
        <div className="fixed inset-0 bg-slate-900/90 z-[120] flex flex-col items-center justify-center text-white">
          <div className="relative">
             <RefreshCw size={64} className="animate-spin text-emerald-500 opacity-20" />
             <Sparkles size={32} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-400 animate-pulse" />
          </div>
          <p className="mt-6 font-black text-sm uppercase tracking-widest">Analizando con IA...</p>
        </div>
      )}

      {/* Other Modals... */}
      {showRatesModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in duration-200 p-6">
            <div className="flex items-center gap-3 mb-3 text-blue-600"><Globe size={24} /><h3 className="text-lg font-black">Nuevas Tasas</h3></div>
            <p className="text-slate-500 text-xs mb-4">¿Actualizar con datos encontrados?</p>
            <div className="space-y-2 mb-6 max-h-40 overflow-y-auto pr-1">
              {suggestedRates?.map((r, i) => (
                <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded-xl border border-slate-100 text-[10px]">
                  <span className="font-bold text-slate-700">{r.name}</span>
                  <span className="text-blue-600 font-black">{r.ratePesos}%</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowRatesModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl text-xs">Cancelar</button>
              <button onClick={applySuggestedRates} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-2xl text-xs shadow-lg shadow-blue-200">Actualizar</button>
            </div>
          </div>
        </div>
      )}

      {isBankFormOpen && <BankForm bank={editingBank} onSave={(b) => { 
        const nb: Bank[] = editingBank ? banks.map(old => old.id === b.id ? { ...b, source: 'local' as const } : old) : [...banks, { ...b, source: 'local' as const }];
        setBanks(nb); setIsBankFormOpen(false); if (user?.accessToken && sid) saveBanksToSheet(user.accessToken, sid, nb);
      }} onCancel={() => setIsBankFormOpen(false)} />}
      
      {isSyncing && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in zoom-in"><RefreshCw size={14} className="animate-spin text-emerald-400" /><span className="text-[10px] font-black uppercase tracking-widest">Cloud Sync...</span></div>}
    </div>
  );
};

export default App;
