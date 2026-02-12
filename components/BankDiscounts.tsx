
import React from 'react';
import { BankPromotion, BankSource } from '../types';
import { Tag, ShoppingCart, Fuel, Utensils, Pill, ExternalLink, Clock, Sparkles } from 'lucide-react';

interface BankDiscountsProps {
  data: BankPromotion[];
  sources: BankSource[];
  timestamp: string;
}

const CategoryIcon = ({ category }: { category: string }) => {
  const c = category.toLowerCase();
  if (c.includes('super')) return <ShoppingCart size={14} />;
  if (c.includes('combust') || c.includes('nafta')) return <Fuel size={14} />;
  if (c.includes('gastro') || c.includes('restaurante')) return <Utensils size={14} />;
  if (c.includes('farma')) return <Pill size={14} />;
  return <Tag size={14} />;
};

export const BankDiscounts: React.FC<BankDiscountsProps> = ({ data, sources, timestamp }) => {
  if (data.length === 0) return null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end px-2">
        <div>
          <h3 className="text-slate-800 font-black text-sm flex items-center gap-2">
            Beneficios del Día <Sparkles size={14} className="text-amber-500" />
          </h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
            <Clock size={10} /> Actualizado {timestamp}
          </p>
        </div>
        {sources.length > 0 && (
          <a 
            href={sources[0].uri} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-blue-100 transition-colors"
          >
            FUENTES <ExternalLink size={10} />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {data.map((promo, idx) => (
          <div key={idx} className="bg-white rounded-[24px] shadow-md border border-slate-100 overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{promo.bankName}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            </div>
            <div className="p-3 space-y-2">
              {promo.benefits.map((benefit, bIdx) => (
                <div key={bIdx} className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <CategoryIcon category={benefit.category} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter">{benefit.category}</span>
                      {benefit.discount && (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-1.5 rounded-md">
                          {benefit.discount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-tight mt-0.5">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
