
import React, { useState } from 'react';
import { Bank, BankSource } from '../types';
import { Plus, Edit3, Trash2, Globe, PencilLine, Sparkles, ArrowUpDown, Star, StarOff, Info, X, ExternalLink, Calendar } from 'lucide-react';

interface BankTableProps {
  banks: Bank[];
  selectedBankId: string | null;
  currentBankId: string | null;
  sortConfig: { key: 'ratePesos' | 'rateUsd' | 'name', direction: 'asc' | 'desc' } | null;
  publicSources: BankSource[];
  lastPublicUpdate: string | null;
  onSelect: (id: string) => void;
  onSetCurrent: (id: string) => void;
  onSort: (key: 'ratePesos' | 'rateUsd' | 'name') => void;
  onAdd: () => void;
  onEdit: (bank: Bank) => void;
  onDelete: (id: string) => void;
  onFetchPublic: () => void;
  isFetching?: boolean;
}

export const BankTable: React.FC<BankTableProps> = ({ 
  banks, 
  selectedBankId,
  currentBankId,
  sortConfig,
  publicSources,
  lastPublicUpdate,
  onSelect, 
  onSetCurrent,
  onSort,
  onAdd, 
  onEdit, 
  onDelete,
  onFetchPublic,
  isFetching = false
}) => {
  const [showSourcesModal, setShowSourcesModal] = useState(false);

  return (
    <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden mb-6">
      <div className="p-4 border-b border-slate-50 flex justify-between items-center">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xs">
          Bancos y Tasas
          {isFetching && <Sparkles size={14} className="text-emerald-500 animate-pulse" />}
        </h3>
        <div className="flex gap-1.5">
          <button 
            onClick={onFetchPublic}
            disabled={isFetching}
            className={`p-2 rounded-xl transition-colors ${isFetching ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
            title="Actualizar tasas de internet"
          >
            <Globe size={18} className={isFetching ? 'animate-spin' : ''} />
          </button>
          
          <button 
            onClick={() => setShowSourcesModal(true)}
            className={`p-2 rounded-xl transition-colors ${lastPublicUpdate ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
            title="Ver fuentes y última actualización"
          >
            <Info size={18} />
          </button>

          <button 
            onClick={onAdd}
            className="bg-emerald-50 text-emerald-600 p-2 rounded-xl hover:bg-emerald-100 transition-colors"
            title="Agregar banco manualmente"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden">
        <table className="w-full text-left table-fixed">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold">
            <tr>
              <th className="px-3 py-2 w-[42%] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onSort('name')}>
                <div className="flex items-center gap-1">Banco <ArrowUpDown size={10} /></div>
              </th>
              <th className="px-1 py-2 w-[19%] text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onSort('ratePesos')}>
                <div className="flex items-center justify-center gap-1">ARS <ArrowUpDown size={10} /></div>
              </th>
              <th className="px-1 py-2 w-[19%] text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onSort('rateUsd')}>
                <div className="flex items-center justify-center gap-1">USD <ArrowUpDown size={10} /></div>
              </th>
              <th className="px-2 py-2 w-[20%] text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {banks.map((bank) => (
              <tr 
                key={bank.id} 
                className={`transition-colors cursor-pointer group text-xs ${selectedBankId === bank.id ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}
                onClick={() => onSelect(bank.id)}
              >
                <td className="px-3 py-2.5 overflow-hidden">
                  <div className="flex items-center gap-2 min-w-0">
                    <input 
                      type="radio" 
                      name="bank-selection"
                      checked={selectedBankId === bank.id}
                      readOnly
                      className="w-3.5 h-3.5 text-emerald-600 bg-gray-100 border-gray-300 focus:ring-emerald-500"
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-semibold text-slate-700 truncate">{bank.name}</span>
                        {currentBankId === bank.id && (
                          <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {bank.source === 'public' ? (
                          <>
                            <Globe size={10} className="text-blue-400 shrink-0" />
                            {bank.lastUpdated && (
                              <span className="text-[8px] text-slate-400 font-medium">
                                {bank.lastUpdated.split(',')[0]}
                              </span>
                            )}
                          </>
                        ) : (
                          <PencilLine size={10} className="text-slate-300 shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-1 py-2.5 text-center">
                  <span className="text-blue-700 font-bold">{bank.ratePesos}%</span>
                </td>
                <td className="px-1 py-2.5 text-center">
                  <span className="text-emerald-700 font-bold">{bank.rateUsd}%</span>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <div className="flex gap-0 justify-end">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onSetCurrent(bank.id); }}
                      className={`p-1 rounded-lg transition-colors ${currentBankId === bank.id ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'}`}
                      title="Marcar como mi banco"
                    >
                      {currentBankId === bank.id ? <Star size={14} fill="currentColor" /> : <StarOff size={14} />}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onEdit(bank); }}
                      className="p-1 text-slate-300 hover:text-emerald-600 rounded-lg hover:bg-emerald-50"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(bank.id); }}
                      className="p-1 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {banks.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400 italic text-xs">
                  Sin bancos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sources Modal */}
      {showSourcesModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-[70] backdrop-blur-sm">
          <div className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <Info size={20} />
                  <h3 className="text-lg font-black">Fuentes de Información</h3>
                </div>
                <button onClick={() => setShowSourcesModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-3 mb-4 flex items-center gap-2">
                <Calendar size={14} className="text-blue-500" />
                <p className="text-[10px] font-bold text-blue-700">
                  Última búsqueda: <span className="font-black">{lastPublicUpdate || 'Nunca realizada'}</span>
                </p>
              </div>

              <div className="border border-slate-100 rounded-2xl overflow-hidden mb-6">
                <table className="w-full text-left table-fixed">
                  <thead className="bg-slate-50 text-[9px] uppercase font-bold text-slate-500">
                    <tr>
                      <th className="px-3 py-2 w-[70%]">Sitio Web</th>
                      <th className="px-3 py-2 w-[30%] text-center">Ver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {publicSources.length > 0 ? publicSources.map((src, i) => (
                      <tr key={i} className="text-[10px] text-slate-600 hover:bg-slate-50">
                        <td className="px-3 py-2 truncate font-medium">{src.title}</td>
                        <td className="px-3 py-2 text-center">
                          <a 
                            href={src.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={2} className="p-6 text-center text-slate-400 italic text-[10px]">
                          {isFetching ? 'Buscando fuentes...' : 'Haz clic en el planeta para buscar datos y ver sus fuentes aquí.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <button 
                onClick={() => setShowSourcesModal(false)}
                className="w-full py-3 bg-slate-900 text-white font-bold rounded-2xl text-xs"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
