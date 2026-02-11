
import React, { useState, useEffect } from 'react';
import { Bank } from '../types';
import { X } from 'lucide-react';

interface BankFormProps {
  bank?: Bank | null;
  onSave: (bank: Bank) => void;
  onCancel: () => void;
}

export const BankForm: React.FC<BankFormProps> = ({ bank, onSave, onCancel }) => {
  const [name, setName] = useState(bank?.name || '');
  const [ratePesos, setRatePesos] = useState(bank?.ratePesos.toString() || '');
  const [rateUsd, setRateUsd] = useState(bank?.rateUsd.toString() || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: bank?.id || crypto.randomUUID(),
      name,
      ratePesos: parseFloat(ratePesos) || 0,
      rateUsd: parseFloat(rateUsd) || 0
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-800">
              {bank ? 'Editar Banco' : 'Nuevo Banco'}
            </h3>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Nombre del Banco</label>
              <input 
                required
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Banco Nación"
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Tasa Anual Pesos (%)</label>
              <input 
                required
                type="number"
                step="0.01"
                value={ratePesos}
                onChange={(e) => setRatePesos(e.target.value)}
                placeholder="Ej. 35"
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Tasa Anual Dólares (%)</label>
              <input 
                required
                type="number"
                step="0.01"
                value={rateUsd}
                onChange={(e) => setRateUsd(e.target.value)}
                placeholder="Ej. 1.5"
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 mt-4"
            >
              Guardar Banco
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
