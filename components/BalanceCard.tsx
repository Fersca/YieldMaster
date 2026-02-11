
import React, { useState } from 'react';
import { Wallet, Edit2, Check, X, Camera } from 'lucide-react';

interface BalanceCardProps {
  pesos: number;
  usd: number;
  onUpdate: (pesos: number, usd: number) => void;
  onScanClick: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ pesos, usd, onUpdate, onScanClick }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempPesos, setTempPesos] = useState(pesos.toString());
  const [tempUsd, setTempUsd] = useState(usd.toString());

  const handleSave = () => {
    onUpdate(parseFloat(tempPesos) || 0, parseFloat(tempUsd) || 0);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempPesos(pesos.toString());
    setTempUsd(usd.toString());
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg p-6 mb-6 border border-slate-100">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2 text-emerald-600">
          <Wallet size={20} />
          <h2 className="font-bold text-lg">Saldo Total</h2>
        </div>
        {!isEditing ? (
          <div className="flex gap-1">
            <button 
              onClick={onScanClick}
              className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
              title="Escanear con cámara"
            >
              <Camera size={18} />
            </button>
            <button 
              onClick={() => setIsEditing(true)}
              className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
              title="Editar manualmente"
            >
              <Edit2 size={18} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleSave} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full">
              <Check size={18} />
            </button>
            <button onClick={handleCancel} className="p-2 text-rose-500 hover:bg-rose-50 rounded-full">
              <X size={18} />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pesos (ARS)</p>
          {isEditing ? (
            <input 
              type="number"
              value={tempPesos}
              onChange={(e) => setTempPesos(e.target.value)}
              className="w-full text-xl font-bold border-b-2 border-emerald-500 focus:outline-none py-1"
              autoFocus
            />
          ) : (
            <p className="text-2xl font-bold text-slate-800">
              $ {pesos.toLocaleString('es-AR')}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Dólares (USD)</p>
          {isEditing ? (
            <input 
              type="number"
              value={tempUsd}
              onChange={(e) => setTempUsd(e.target.value)}
              className="w-full text-xl font-bold border-b-2 border-emerald-500 focus:outline-none py-1"
            />
          ) : (
            <p className="text-2xl font-bold text-slate-800">
              u$s {usd.toLocaleString('en-US')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
