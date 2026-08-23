import React from 'react';
import { X, Leaf } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';

interface CarbonStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

const getDistanceForDate = (date: Date, history: any[]) => {
  return history
    .filter(h => isSameDay(new Date(h.date), date))
    .reduce((sum, h) => sum + h.distance, 0);
};

export const CarbonStatsModal: React.FC<CarbonStatsModalProps> = ({ isOpen, onClose }) => {
  const { activityHistory, totalDistanceKm, totalCarbonSaved } = useUserStore();

  if (!isOpen) return null;

  const calculatedTotalDistance = totalDistanceKm;
  const calculatedCarbonSaved = totalCarbonSaved;

  const today = new Date();
  const startOfWeek = getMonday(today);
  const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  
  const weeklyData = days.map((dayLabel, index) => {
    const currentDate = new Date(startOfWeek);
    currentDate.setDate(startOfWeek.getDate() + index);
    const distance = getDistanceForDate(currentDate, activityHistory);
    // Industry average: Walking saves CO2 compared to driving
    const carbon = distance / 5.88;
    return { label: dayLabel, carbon, active: carbon > 0 };
  });

  const maxCarbon = Math.max(...weeklyData.map(d => d.carbon), 1);
  const yAxisSteps = [maxCarbon, maxCarbon * 0.66, maxCarbon * 0.33, 0].map(v => v.toFixed(1));

  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-end md:justify-center animate-in fade-in duration-300 p-4 md:p-0">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 rounded-[24px] flex flex-col animate-in slide-in-from-bottom-10">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm">
              <Leaf size={24} className="text-[var(--color-teal-dark)]" />
            </div>
            <h2 className="text-2xl font-black text-[var(--color-text-main)]">Carbon Stats</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
          >
            <X size={20} className="text-[var(--color-text-main)]" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 mb-6 text-center border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-sm font-bold text-[var(--color-text-muted)] mb-1">Total Carbon Saved</p>
            <p className="text-4xl font-black text-[var(--color-text-main)]">{calculatedCarbonSaved.toFixed(2)} <span className="text-xl">kg CO₂</span></p>
            <div className="mt-4 bg-[var(--color-pastel-yellow)] text-[var(--color-text-main)] px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 inline-block shadow-sm">
              Formula: Total Distance ({calculatedTotalDistance.toFixed(1)} km) / 5.88 kg/km
            </div>
          </div>

          <h3 className="font-black text-lg text-[var(--color-text-main)] mb-4 px-2">This Week's Impact</h3>
          
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 h-48 flex items-end justify-between gap-2 relative pt-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[11px] text-[var(--color-text-muted)] pb-8 pr-2 font-bold pl-4">
              {yAxisSteps.map((step, i) => (
                <span key={i}>{step}</span>
              ))}
            </div>

            <div className="flex-1 flex justify-between items-end h-full pl-8 w-full">
              {weeklyData.map((data, index) => (
                <div key={index} className="flex flex-col items-center gap-2 h-full justify-end w-full group">
                  <div className="w-full max-w-[1.5rem] bg-white/30 rounded-t-lg h-full relative overflow-hidden flex items-end">
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-700 ease-out ${data.active ? 'bg-[var(--color-teal-mid)]' : 'bg-transparent'}`}
                      style={{ height: `${(data.carbon / maxCarbon) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{data.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
