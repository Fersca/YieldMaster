
import React, { useState, useEffect } from 'react';
import { BankEmail } from '../types';
import { fetchBankEmails } from '../services/gmail';
import { ArrowLeft, Inbox, Mail, Calendar, User, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface BankInboxProps {
  accessToken: string;
  bankNames: string[];
  onBack: () => void;
}

export const BankInbox: React.FC<BankInboxProps> = ({ accessToken, bankNames, onBack }) => {
  const [emails, setEmails] = useState<BankEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<BankEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBankEmails(accessToken, bankNames);
      setEmails(data);
      if (data.length > 0) setSelectedEmail(data[0]);
    } catch (err: any) {
      setError("No pudimos sincronizar con tu Gmail. Verifica los permisos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, [accessToken]);

  return (
    <div className="fixed inset-0 bg-slate-50 z-[200] flex flex-col animate-in slide-in-from-right duration-500 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            Bandeja de Entrada <Inbox size={18} className="text-blue-500" />
          </h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Notificaciones de mis bancos</p>
        </div>
        <button 
          onClick={loadEmails}
          disabled={loading}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Top Section: Email List */}
        <div className="h-2/5 border-b border-slate-200 bg-white overflow-y-auto shrink-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Loader2 className="animate-spin text-blue-500" size={32} />
              <p className="text-[10px] font-black uppercase tracking-widest">Escaneando casilla...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
              <AlertCircle size={40} className="text-rose-500" />
              <p className="text-xs font-bold text-slate-600 leading-relaxed">{error}</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Inbox size={48} className="opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">No se encontraron correos</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {emails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={`w-full text-left p-4 flex gap-4 transition-all ${selectedEmail?.id === email.id ? 'bg-blue-50/50 border-l-4 border-l-blue-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${selectedEmail?.id === email.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Mail size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-[10px] font-black text-slate-800 uppercase truncate max-w-[120px]">{email.from}</span>
                      <span className="text-[9px] font-bold text-slate-400">{email.date}</span>
                    </div>
                    <h4 className={`text-xs truncate ${selectedEmail?.id === email.id ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>{email.subject}</h4>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{email.snippet}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Section: Email Viewer */}
        <div className="flex-1 bg-slate-50 overflow-hidden flex flex-col">
          {selectedEmail ? (
            <div className="h-full flex flex-col">
              <div className="p-6 bg-white border-b border-slate-200 shrink-0">
                <h3 className="text-sm font-black text-slate-800 mb-4">{selectedEmail.subject}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400"><User size={12} /></div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Remitente</span>
                      <span className="text-[10px] font-black text-slate-700 truncate">{selectedEmail.from}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400"><Calendar size={12} /></div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Fecha</span>
                      <span className="text-[10px] font-black text-slate-700">{selectedEmail.date}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto bg-white m-4 rounded-3xl shadow-sm border border-slate-100">
                {selectedEmail.body?.includes('<') ? (
                   <div className="text-xs text-slate-700 leading-relaxed break-words email-html-container" dangerouslySetInnerHTML={{ __html: selectedEmail.body }} />
                ) : (
                  <pre className="text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap break-words">{selectedEmail.body}</pre>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <Mail size={48} className="opacity-10 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">Selecciona un mensaje para leerlo</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
