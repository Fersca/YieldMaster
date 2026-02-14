import React, { useMemo, useState } from 'react';
import { Calculator, PiggyBank, TrendingUp } from 'lucide-react';

interface SimulationRow {
  month: string;
  invested: number;
}

const MONTH_LABELS = [
  'Mes 1', 'Mes 2', 'Mes 3', 'Mes 4', 'Mes 5', 'Mes 6',
  'Mes 7', 'Mes 8', 'Mes 9', 'Mes 10', 'Mes 11', 'Mes 12'
];

export const MoneyMarketSimulator: React.FC = () => {
  const [separatedAccountStart, setSeparatedAccountStart] = useState('100000');
  const [monthlyContribution, setMonthlyContribution] = useState('50000');
  const [annualRate, setAnnualRate] = useState('30');

  const simulation = useMemo(() => {
    const initial = Math.max(parseFloat(separatedAccountStart) || 0, 0);
    const monthly = Math.max(parseFloat(monthlyContribution) || 0, 0);
    const tna = Math.max(parseFloat(annualRate) || 0, 0);

    const monthlyRate = tna / 100 / 12;
    let accumulated = initial;
    const monthlyProjection: SimulationRow[] = [];

    for (let i = 0; i < 12; i++) {
      accumulated += monthly;
      accumulated += accumulated * monthlyRate;
      monthlyProjection.push({ month: MONTH_LABELS[i], invested: accumulated });
    }

    const totalSaved = initial + monthly * 12;
    const estimatedProfit = Math.max(accumulated - totalSaved, 0);

    return {
      finalAmount: accumulated,
      totalSaved,
      estimatedProfit,
      monthlyRatePercent: monthlyRate * 100,
      monthlyProjection,
    };
  }, [annualRate, monthlyContribution, separatedAccountStart]);

  return (
    <section className="bg-white rounded-3xl shadow-lg border border-slate-100 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Calculator size={16} />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-800">Simulador de Cuenta Separada + Money Market</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Proyección anual con aporte mensual e interés compuesto
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <label className="text-xs font-bold text-slate-600 space-y-1 block">
          Saldo inicial en la cuenta separada (ARS)
          <input
            type="number"
            min="0"
            value={separatedAccountStart}
            onChange={(e) => setSeparatedAccountStart(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="Ej: 100000"
          />
        </label>

        <label className="text-xs font-bold text-slate-600 space-y-1 block">
          Cuánto guardás por mes (ARS)
          <input
            type="number"
            min="0"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="Ej: 50000"
          />
        </label>

        <label className="text-xs font-bold text-slate-600 space-y-1 block">
          Tasa anual estimada del money market (%)
          <input
            type="number"
            min="0"
            step="0.01"
            value={annualRate}
            onChange={(e) => setAnnualRate(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="Ej: 30"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-500">
            <PiggyBank size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Total que vos pusiste</span>
          </div>
          <span className="text-sm font-black text-slate-800">
            $ {Math.round(simulation.totalSaved).toLocaleString('es-AR')}
          </span>
        </div>

        <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-emerald-700">
            <TrendingUp size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Ganancia estimada</span>
          </div>
          <span className="text-sm font-black text-emerald-700">
            $ {Math.round(simulation.estimatedProfit).toLocaleString('es-AR')}
          </span>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4 text-white">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-1">Plata estimada al año</p>
          <p className="text-2xl font-black">$ {Math.round(simulation.finalAmount).toLocaleString('es-AR')}</p>
          <p className="text-[10px] text-slate-300 mt-2">
            Tasa mensual usada: {simulation.monthlyRatePercent.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="border border-slate-100 rounded-2xl overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
          Evolución mensual estimada
        </div>
        <div className="max-h-44 overflow-y-auto divide-y divide-slate-50">
          {simulation.monthlyProjection.map((row) => (
            <div key={row.month} className="px-3 py-2 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500">{row.month}</span>
              <span className="font-black text-slate-800">$ {Math.round(row.invested).toLocaleString('es-AR')}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
