
import React, { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Currency } from '../types';
import { FileDown, RefreshCw, CalendarPlus, Check, Calendar as CalendarIcon, X } from 'lucide-react';

interface GrowthChartDataPoint {
  monthName: string;
  potentialValue: number;
  currentValue?: number;
}

interface GrowthChartProps {
  data: GrowthChartDataPoint[];
  currency: Currency;
  totalGain: number;
  comparisonTotalGain?: number;
  potentialBankName?: string;
  currentBankName?: string;
  onDownloadPdf?: () => void;
  isDownloading?: boolean;
  onAddCalendarEvent?: (date: string) => Promise<void>;
  isAddingEvent?: boolean;
}

export const GrowthChart: React.FC<GrowthChartProps> = ({ 
  data, 
  currency, 
  totalGain, 
  comparisonTotalGain,
  potentialBankName = "Banco Seleccionado",
  currentBankName = "Mi Banco",
  onDownloadPdf,
  isDownloading = false,
  onAddCalendarEvent,
  isAddingEvent = false
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]
  );
  const [eventCreated, setEventCreated] = useState(false);

  const hasComparison = comparisonTotalGain !== undefined;
  const difference = hasComparison ? totalGain - (comparisonTotalGain || 0) : 0;

  const handleCalendarAction = async () => {
    if (onAddCalendarEvent) {
      await onAddCalendarEvent(selectedDate);
      setEventCreated(true);
      setShowDatePicker(false);
      setTimeout(() => setEventCreated(false), 3000);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg p-6 border border-slate-100 relative">
      <div className="flex flex-col mb-4 gap-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-base">Proyección a 12 Meses</h3>
              <div className="flex gap-1" data-html2canvas-ignore="true">
                {onDownloadPdf && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDownloadPdf(); }}
                    disabled={isDownloading}
                    className={`p-1.5 rounded-lg transition-colors ${isDownloading ? 'text-slate-300' : 'text-emerald-500 hover:bg-emerald-50'}`}
                    title="Descargar reporte PDF"
                  >
                    {isDownloading ? <RefreshCw size={16} className="animate-spin" /> : <FileDown size={16} />}
                  </button>
                )}
                {onAddCalendarEvent && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowDatePicker(true); }}
                    disabled={isAddingEvent || eventCreated}
                    className={`p-1.5 rounded-lg transition-all ${eventCreated ? 'bg-emerald-100 text-emerald-600' : 'text-amber-500 hover:bg-amber-50'}`}
                    title="Agendar vencimiento"
                  >
                    {eventCreated ? <Check size={16} /> : isAddingEvent ? <RefreshCw size={16} className="animate-spin" /> : <CalendarPlus size={16} />}
                  </button>
                )}
              </div>
            </div>
            <p className="text-slate-500 text-[10px] leading-tight">Crecimiento estimado mensual acumulado</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Ganancia Est. Anual</p>
            <p className="text-lg font-black text-emerald-600">
              {currency === 'ARS' ? '$' : 'u$s'} {totalGain.toLocaleString(currency === 'ARS' ? 'es-AR' : 'en-US', { maximumFractionDigits: 0 })}
            </p>
            {hasComparison && difference !== 0 && (
              <p className={`text-[10px] font-bold ${difference > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {difference > 0 ? '+' : ''}{difference.toLocaleString(undefined, { maximumFractionDigits: 0 })} vs actual
              </p>
            )}
          </div>
        </div>
      </div>

      {showDatePicker && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 rounded-3xl p-6 flex flex-col justify-center animate-in fade-in zoom-in duration-200">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <CalendarIcon size={14} className="text-amber-500" /> Fecha de Vencimiento
            </h4>
            <button onClick={() => setShowDatePicker(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full p-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none mb-4 text-xs font-bold"
          />
          <button 
            onClick={handleCalendarAction}
            className="w-full py-3 bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-100 flex items-center justify-center gap-2"
          >
            Confirmar en Google Calendar
          </button>
        </div>
      )}

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorPotential" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="monthName" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 9 }} 
              dy={5}
            />
            <YAxis hide domain={['dataMin * 0.99', 'dataMax * 1.01']} />
            <Tooltip 
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
              formatter={(value: number) => [`${currency === 'ARS' ? '$' : 'u$s'} ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, '']}
            />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', paddingBottom: '10px' }} />
            
            {hasComparison && (
              <Area 
                name={currentBankName}
                type="monotone" 
                dataKey="currentValue" 
                stroke="#94a3b8" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorCurrent)" 
                strokeDasharray="5 5"
                animationDuration={1000}
              />
            )}
            
            <Area 
              name={potentialBankName}
              type="monotone" 
              dataKey="potentialValue" 
              stroke="#10b981" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorPotential)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
