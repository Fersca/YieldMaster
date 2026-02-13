
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserProfile, Bank, Currency, BankSource, BankPromotion, ChatSpace } from './types';
import { BalanceCard } from './components/BalanceCard';
import { BankTable } from './components/BankTable';
import { BankForm } from './components/BankForm';
import { GrowthChart } from './components/GrowthChart';
import { ATMMap } from './components/ATMMap';
import { BankDiscounts } from './components/BankDiscounts';
import { BankInbox } from './components/BankInbox';
import { 
  LogIn, TrendingUp, RefreshCw, Layers, Map as MapIcon, 
  Settings, X, Sparkles, Cloud, Ticket, Loader2, Bell, 
  AlertTriangle, MessageSquare, Send, Camera, ShieldCheck
} from 'lucide-react';
import { 
  getOrCreateSpreadsheet, fetchBanksFromSheet, saveBanksToSheet, 
  fetchBalancesFromSheet, saveBalancesToSheet, getOrCreateFolder, 
  uploadImageToDrive 
} from './services/googleSheets';
import { fetchPublicBankRates } from './services/bankRates';
import { fetchDailyDiscounts } from './services/bankDiscounts';
import { createMaturityReminder } from './services/googleCalendar';
import { fetchChatSpaces, sendChatCard } from './services/googleChat';
import { requestNotificationPermission, sendLocalNotification } from './services/notifications';
import { GoogleGenAI, Type } from "@google/genai";

const DEFAULT_CLIENT_ID = '999301723526-fss4uphevi3q781oo58vv5jcm2umopbr.apps.googleusercontent.com';
const STORAGE_KEY = 'yieldmaster_user_session';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [clientId, setClientId] = useState<string>(DEFAULT_CLIENT_ID);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetchingRates, setIsFetchingRates] = useState(false);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [sid, setSid] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showAtms, setShowAtms] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  
  // Chat States
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatSpaces, setChatSpaces] = useState<ChatSpace[]>([]);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [isSendingToChat, setIsSendingToChat] = useState(false);

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

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [detectedAmount, setDetectedAmount] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY);
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        if (parsedUser.accessToken) syncWithSheets(parsedUser.accessToken);
      } catch (e) { localStorage.removeItem(STORAGE_KEY); }
    }
    requestNotificationPermission();
  }, []);

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
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
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
      const prompt = "Actúa como un experto en OCR financiero. Extrae únicamente el saldo total o monto principal de esta imagen de homebanking. Devuelve un JSON con la llave 'amount'.";
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [
          { text: prompt },
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
        ]},
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
          } catch (driveErr) { console.error(driveErr); } finally { setIsUploadingToDrive(false); }
        }
      } else { setAuthError("No pudimos detectar un monto claro."); }
    } catch (err) { setAuthError("Error procesando con IA."); } finally { setIsProcessingOcr(false); }
  };

  const syncWithSheets = async (token: string) => {
    setIsSyncing(true); setAuthError(null);
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

  const logout = () => { 
    setUser(null); setSid(null); setAuthError(null);
    localStorage.removeItem(STORAGE_KEY); 
  };

  const handleLogin = () => {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) return;
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/chat.messages.create https://www.googleapis.com/auth/chat.spaces.readonly email openid',
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

  const calculationData = useMemo(() => {
    const selectedBank = banks.find(b => b.id === selectedBankId);
    const currentBank = banks.find(b => b.id === currentBankId);
    
    const balance = chartCurrency === 'ARS' ? pesosBalance : usdBalance;
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const currentMonth = new Date().getMonth();
    
    const data = [];
    let potentialAccumulated = balance;
    let currentAccumulated = balance;
    
    const ratePotential = (selectedBank ? (chartCurrency === 'ARS' ? selectedBank.ratePesos : selectedBank.rateUsd) : 0) / 100 / 12;
    const rateCurrent = (currentBank ? (chartCurrency === 'ARS' ? currentBank.ratePesos : currentBank.rateUsd) : 0) / 100 / 12;

    for (let i = 0; i <= 12; i++) {
      const monthIdx = (currentMonth + i) % 12;
      data.push({
        monthName: months[monthIdx],
        potentialValue: Math.round(potentialAccumulated),
        currentValue: currentBankId ? Math.round(currentAccumulated) : undefined
      });
      potentialAccumulated += potentialAccumulated * ratePotential;
      currentAccumulated += currentAccumulated * rateCurrent;
    }
    
    return {
      chartData: data,
      totalGain: potentialAccumulated - balance,
      comparisonTotalGain: currentBankId ? currentAccumulated - balance : undefined
    };
  }, [banks, selectedBankId, currentBankId, pesosBalance, usdBalance, chartCurrency]);

  const handleUpdateBalance = async (p: number, u: number) => {
    setPesosBalance(p); setUsdBalance(u);
    if (user?.accessToken && sid) {
      await saveBalancesToSheet(user.accessToken, sid, p, u);
    }
  };

  const handleSaveBank = async (bank: Bank) => {
    const updatedBanks = editingBank 
      ? banks.map(b => b.id === bank.id ? bank : b)
      : [...banks, bank];
    setBanks(updatedBanks);
    setIsBankFormOpen(false);
    setEditingBank(null);
    if (user?.accessToken && sid) {
      await saveBanksToSheet(user.accessToken, sid, updatedBanks);
    }
  };

  const handleAddCalendarEvent = async (date: string) => {
    if (!user?.accessToken || !selectedBankId) return;
    const bank = banks.find(b => b.id === selectedBankId);
    if (!bank) return;
    setIsAddingEvent(true);
    try {
      const balance = chartCurrency === 'ARS' ? pesosBalance : usdBalance;
      const rate = chartCurrency === 'ARS' ? bank.ratePesos : bank.rateUsd;
      const estimatedGain = balance * (rate / 100);
      await createMaturityReminder(user.accessToken, bank.name, balance + estimatedGain, chartCurrency, date);
      sendLocalNotification("Recordatorio Agendado", { body: `Se agendó el vencimiento en Google Calendar para el ${date}.` });
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setIsAddingEvent(false);
    }
  };

  const handleSendToChat = async (spaceName: string) => {
    if (!user?.accessToken || !selectedBankId) return;
    const bank = banks.find(b => b.id === selectedBankId);
    if (!bank) return;

    setIsSendingToChat(true);
    try {
      const details = [
        { label: 'Banco Seleccionado', value: bank.name },
        { label: 'Tasa Anual', value: `${chartCurrency === 'ARS' ? bank.ratePesos : bank.rateUsd}%` },
        { label: 'Moneda', value: chartCurrency },
        { label: 'Ganancia Est. Anual', value: `${chartCurrency === 'ARS' ? '$' : 'u$s'} ${calculationData.totalGain.toLocaleString()}` }
      ];
      await sendChatCard(user.accessToken, spaceName, `Proyección: ${bank.name}`, 'Resumen generado vía YieldMaster', details);
      setShowChatModal(false);
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setIsSendingToChat(false);
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
    } catch (e) { setAuthError("No se pudieron obtener las tasas."); } finally { setIsFetchingRates(false); }
  };

  // Added handleSearchDiscounts to fix the error
  const handleSearchDiscounts = async () => {
    if (banks.length === 0) {
      setAuthError("Agrega bancos para buscar sus descuentos.");
      return;
    }
    setIsFetchingDiscounts(true);
    try {
      const result = await fetchDailyDiscounts(banks.map(b => b.name));
      setDiscountsData(result);
      if (result.promotions.length > 0) {
        sendLocalNotification("Descuentos del día", { body: `Se encontraron beneficios para tus bancos.` });
      } else {
        setAuthError("No se encontraron beneficios para tus bancos hoy.");
      }
    } catch (e: any) {
      setAuthError("No se pudieron obtener los descuentos.");
    } finally {
      setIsFetchingDiscounts(false);
    }
  };

  const applySuggestedRates = async () => {
    if (!suggestedRates) return;
    const updatedBanks = [...banks];
    suggestedRates.forEach(sug => {
      const idx = updatedBanks.findIndex(b => b.name.toLowerCase() === sug.name?.toLowerCase());
      if (idx !== -1) {
        updatedBanks[idx] = { ...updatedBanks[idx], ratePesos: sug.ratePesos || 0, source: 'public', lastUpdated: lastPublicUpdate || undefined };
      } else {
        updatedBanks.push({ 
          id: crypto.randomUUID(), 
          name: sug.name || 'Nuevo Banco', 
          ratePesos: sug.ratePesos || 0, 
          rateUsd: sug.rateUsd || 0, 
          source: 'public', 
          lastUpdated: lastPublicUpdate || undefined 
        });
      }
    });
    setBanks(updatedBanks);
    setShowRatesModal(false);
    if (user?.accessToken && sid) await saveBanksToSheet(user.accessToken, sid, updatedBanks);
    sendLocalNotification("Tasas Actualizadas", { body: "Se han aplicado las tasas más recientes obtenidas de internet." });
  };

  const sortedBanks = useMemo(() => {
    if (!sortConfig) return banks;
    return [...banks].sort((a, b) => {
      const aVal = a[sortConfig.key] || 0;
      const bVal = b[sortConfig.key] || 0;
      return sortConfig.direction === 'asc' ? (aVal < bVal ? -1 : 1) : (aVal > bVal ? -1 : 1);
    });
  }, [banks, sortConfig]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]"></div>
        </div>
        <div className="bg-white p-10 rounded-[48px] shadow-2xl w-full max-w-sm text-center relative z-10 border border-white/20">
          <div className="bg-emerald-600 w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-emerald-200">
            <TrendingUp size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">YieldMaster</h1>
          <p className="text-slate-500 mb-8 text-sm font-medium leading-relaxed">Tu arquitectura financiera privada impulsada por Google Sheets & IA.</p>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
          >
            <LogIn size={20} /> Iniciar con Google
          </button>
          <p className="mt-6 text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <ShieldCheck size={12} /> Privacy First Infrastructure
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen pb-24 relative bg-slate-50">
      {/* App Bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={user.picture} className="w-10 h-10 rounded-2xl border-2 border-emerald-100 shadow-sm" alt="Profile" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Hola,</span>
            <span className="text-xs font-black text-slate-800 leading-none">{user.name.split(' ')[0]}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSyncing && <RefreshCw size={18} className="text-emerald-500 animate-spin" />}
          <button onClick={() => setShowConfig(!showConfig)} className="p-2 text-slate-400 hover:text-slate-800 transition-colors">
            <Settings size={22} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-6">
        <BalanceCard 
          pesos={pesosBalance} 
          usd={usdBalance} 
          onUpdate={handleUpdateBalance} 
          onScanClick={startCamera} 
        />

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => setChartCurrency(chartCurrency === 'ARS' ? 'USD' : 'ARS')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${chartCurrency === 'ARS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'}`}
          >
            VER EN {chartCurrency === 'ARS' ? 'USD' : 'ARS'}
          </button>
          <button 
            onClick={handleFetchRates}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-slate-200"
          >
            <Sparkles size={12} /> Sugerencias IA
          </button>
          <button 
            onClick={async () => {
              setIsLoadingSpaces(true);
              setShowChatModal(true);
              try {
                const spaces = await fetchChatSpaces(user.accessToken!);
                setChatSpaces(spaces);
              } catch (e) { setAuthError("Error cargando chats."); } finally { setIsLoadingSpaces(false); }
            }}
            className="px-4 py-2 bg-white border border-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm"
          >
            <Send size={12} /> Enviar Reporte
          </button>
        </div>

        <GrowthChart 
          data={calculationData.chartData}
          currency={chartCurrency}
          totalGain={calculationData.totalGain}
          comparisonTotalGain={calculationData.comparisonTotalGain}
          potentialBankName={banks.find(b => b.id === selectedBankId)?.name}
          currentBankName={banks.find(b => b.id === currentBankId)?.name}
          onAddCalendarEvent={handleAddCalendarEvent}
          isAddingEvent={isAddingEvent}
        />

        <BankTable 
          banks={sortedBanks}
          selectedBankId={selectedBankId}
          currentBankId={currentBankId}
          sortConfig={sortConfig}
          publicSources={publicSources}
          lastPublicUpdate={lastPublicUpdate}
          onSelect={setSelectedBankId}
          onSetCurrent={setCurrentBankId}
          onSort={(key) => setSortConfig(prev => prev?.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'desc' })}
          onAdd={() => setIsBankFormOpen(true)}
          onEdit={(b) => { setEditingBank(b); setIsBankFormOpen(true); }}
          onDelete={(id) => {
            const up = banks.filter(b => b.id !== id);
            setBanks(up);
            if (user.accessToken && sid) saveBanksToSheet(user.accessToken, sid, up);
          }}
          onFetchPublic={handleFetchRates}
          isFetching={isFetchingRates}
        />

        {showAtms && <ATMMap />}
        
        {discountsData && (
          <BankDiscounts 
            data={discountsData.promotions} 
            sources={discountsData.sources} 
            timestamp={discountsData.timestamp} 
          />
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-6 left-4 right-4 bg-slate-900/90 backdrop-blur-2xl rounded-[32px] p-2 flex justify-around items-center shadow-2xl z-40 border border-white/10">
        <button onClick={() => { setShowAtms(false); setDiscountsData(null); }} className="p-4 text-emerald-400"><TrendingUp size={24} /></button>
        <button onClick={() => setShowAtms(!showAtms)} className={`p-4 transition-all ${showAtms ? 'text-blue-400 scale-110' : 'text-slate-500'}`}><MapIcon size={24} /></button>
        <button onClick={handleSearchDiscounts} className={`p-4 transition-all ${isFetchingDiscounts ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`}><Ticket size={24} /></button>
        <button onClick={() => setShowInbox(true)} className="p-4 text-slate-500"><Bell size={24} /></button>
      </nav>

      {/* Modals */}
      {isBankFormOpen && (
        <BankForm 
          bank={editingBank} 
          onSave={handleSaveBank} 
          onCancel={() => { setIsBankFormOpen(false); setEditingBank(null); }} 
        />
      )}

      {showConfig && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] p-6 flex items-center justify-center">
          <div className="bg-white rounded-[40px] w-full max-w-sm p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800">Ajustes</h3>
              <button onClick={() => setShowConfig(false)} className="text-slate-400"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Spreadsheet ID</p>
                <p className="text-[11px] font-mono text-slate-600 break-all">{sid || 'No vinculado'}</p>
              </div>
              <button onClick={logout} className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-black text-xs">Cerrar Sesión</button>
            </div>
          </div>
        </div>
      )}

      {/* OCR Overlay */}
      {isCameraActive && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
          <video ref={videoRef} autoPlay playsInline className="flex-1 object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
            <div className="w-full max-w-xs aspect-[4/3] border-2 border-emerald-500 rounded-3xl relative">
              <div className="absolute -top-10 left-0 right-0 text-center">
                <span className="bg-emerald-500 text-white text-[10px] font-black px-4 py-1 rounded-full">ENMARCA EL SALDO</span>
              </div>
            </div>
          </div>
          <div className="p-8 flex justify-between items-center bg-black/80 backdrop-blur-xl">
            <button onClick={stopCamera} className="p-4 text-white/60"><X size={32} /></button>
            <button onClick={captureAndScan} className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform">
              <div className="w-16 h-16 rounded-full border-4 border-slate-900" />
            </button>
            <div className="w-12" />
          </div>
        </div>
      )}

      {detectedAmount !== null && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[110] p-8 flex items-center justify-center">
          <div className="bg-white rounded-[48px] w-full max-w-sm p-8 text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl mx-auto mb-6 flex items-center justify-center">
              <Sparkles size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">¡Saldo Detectado!</h3>
            <p className="text-slate-500 text-sm mb-6">Hemos escaneado un saldo de:</p>
            <p className="text-4xl font-black text-emerald-600 mb-8">${detectedAmount.toLocaleString('es-AR')}</p>
            <div className="flex gap-3">
              <button onClick={() => setDetectedAmount(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs">DESCARTAR</button>
              <button 
                onClick={async () => {
                  const amt = detectedAmount;
                  setPesosBalance(amt);
                  setDetectedAmount(null);
                  if (user.accessToken && sid) saveBalancesToSheet(user.accessToken, sid, amt, usdBalance);
                  sendLocalNotification("Saldo Actualizado", { body: `Nuevo saldo: $${amt.toLocaleString()}` });
                }} 
                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-200"
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}

      {showRatesModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] p-6 flex items-center justify-center">
          <div className="bg-white rounded-[40px] w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-black text-slate-800">Nuevas Tasas Encontradas</h3>
              <button onClick={() => setShowRatesModal(false)} className="text-slate-400"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {suggestedRates?.map((sug, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
                  <span className="text-xs font-black text-slate-700">{sug.name}</span>
                  <span className="text-xs font-black text-blue-600">{sug.ratePesos}%</span>
                </div>
              ))}
            </div>
            <div className="p-6 bg-white border-t border-slate-100">
              <button 
                onClick={applySuggestedRates}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-200"
              >
                ACTUALIZAR MIS DATOS
              </button>
            </div>
          </div>
        </div>
      )}

      {showChatModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[80] p-6 flex items-center justify-center">
          <div className="bg-white rounded-[40px] w-full max-w-sm p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-800">Enviar a Google Chat</h3>
              <button onClick={() => setShowChatModal(false)} className="text-slate-400"><X size={20} /></button>
            </div>
            {isLoadingSpaces ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-emerald-500" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buscando espacios...</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto mb-6">
                {chatSpaces.map((space) => (
                  <button 
                    key={space.name}
                    onClick={() => handleSendToChat(space.name)}
                    disabled={isSendingToChat}
                    className="w-full text-left p-4 hover:bg-slate-50 rounded-2xl flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><MessageSquare size={16} /></div>
                      <span className="text-xs font-bold text-slate-700">{space.displayName}</span>
                    </div>
                    <Send size={14} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                  </button>
                ))}
              </div>
            )}
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center">Tus datos nunca salen del ecosistema Google</p>
          </div>
        </div>
      )}

      {showInbox && user.accessToken && (
        <BankInbox 
          accessToken={user.accessToken} 
          bankNames={banks.map(b => b.name)} 
          onBack={() => setShowInbox(false)} 
        />
      )}

      {/* Global Error Banner */}
      {authError && (
        <div className="fixed top-20 left-4 right-4 bg-rose-600 text-white p-4 rounded-2xl shadow-2xl z-[200] flex justify-between items-center animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            <p className="text-xs font-bold">{authError}</p>
          </div>
          <button onClick={() => setAuthError(null)} className="p-1"><X size={18} /></button>
        </div>
      )}
    </div>
  );
};

export default App;
