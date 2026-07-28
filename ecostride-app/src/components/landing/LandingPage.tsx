import React, { useState, useEffect } from 'react';
import { useUserStore } from '../../stores/useUserStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { Bell, Activity, Map as MapIcon, ChevronRight, ChevronDown, ChevronLeft, Calendar as CalendarIcon, X, Trophy, Gift, Mail, Store, Menu } from 'lucide-react';
import { CarbonStatsModal } from '../modals/CarbonStatsModal';
import { MailboxModal } from '../modals/MailboxModal';
import { PointsStoreModal } from '../modals/PointsStoreModal';
import { LeaderboardModal } from '../modals/LeaderboardModal';
import { useMailStore } from '../../stores/useMailStore';

import { useDemoStore } from '../../stores/useDemoStore';

// --- Utility Functions for Dates ---
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

export const LandingPage: React.FC = () => {
  const { activityHistory, notifications, clearNotifications, totalCarbonSaved, totalDistanceKm, hasReadAlerts, setHasReadAlerts, username } = useUserStore();
  const { user, role } = useAuthStore();
  const { unreadCount } = useMailStore();
  const { setActiveView } = useDemoStore();
  
  const [greeting, setGreeting] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMailbox, setShowMailbox] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  

  const [isActionMenuOpen, setIsActionMenuOpen] = useState(true);
  
  const [progressView, setProgressView] = useState<'Week' | 'Month'>('Week');
  
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarView, setCalendarView] = useState<'Week' | 'Month'>('Week');
  const [baseDate, setBaseDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [showAllActivities, setShowAllActivities] = useState(false);
  const [showCarbonModal, setShowCarbonModal] = useState(false);

  const calculateStreak = () => {
    let streak = 0;
    let d = new Date();
    
    // If today is 0, check yesterday to start the streak loop just in case
    if (getDistanceForDate(d, activityHistory) === 0) {
      d.setDate(d.getDate() - 1);
    }
    
    // Keep going backwards day by day as long as distance > 0
    while (getDistanceForDate(d, activityHistory) > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  };

  const calculatedStreak = calculateStreak();
  // Using direct variables to guarantee sync with Admin Dashboard
  const calculatedCarbonSaved = totalCarbonSaved;

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else if (hour < 22) setGreeting('Good evening');
    else setGreeting('Good night');
  }, []);

  const generateMainChartData = () => {
    const today = new Date();
    
    if (progressView === 'Week') {
      const startOfWeek = getMonday(today);
      const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
      return days.map((dayLabel, index) => {
        const currentDate = new Date(startOfWeek);
        currentDate.setDate(startOfWeek.getDate() + index);
        const distance = getDistanceForDate(currentDate, activityHistory);
        return { label: dayLabel, value: distance, active: distance > 0 };
      });
    } else {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const numDays = lastDayOfMonth.getDate();
      
      const weeksData = [];
      let currentWeekDist = 0;
      let weekCounter = 1;
      
      for (let i = 1; i <= numDays; i++) {
        const d = new Date(today.getFullYear(), today.getMonth(), i);
        currentWeekDist += getDistanceForDate(d, activityHistory);
        
        if (d.getDay() === 0 || i === numDays) {
          weeksData.push({ label: `W${weekCounter}`, value: currentWeekDist, active: currentWeekDist > 0 });
          weekCounter++;
          currentWeekDist = 0;
        }
      }
      return weeksData;
    }
  };

  const chartData = generateMainChartData();
  const maxChartVal = Math.max(...chartData.map(d => d.value), 10);
  const yAxisSteps = [maxChartVal, (maxChartVal * 2/3), (maxChartVal * 1/3), 0].map(v => Math.ceil(v));

  const changeBaseDate = (direction: 1 | -1) => {
    const newDate = new Date(baseDate);
    if (calendarView === 'Week') {
      newDate.setDate(baseDate.getDate() + (direction * 7));
    } else {
      newDate.setMonth(baseDate.getMonth() + direction);
    }
    setBaseDate(newDate);
    setSelectedDate(null);
  };

  const getModalWeekData = () => {
    const startOfWeek = getMonday(baseDate);
    const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    return days.map((dayLabel, index) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + index);
      return { 
        dateObj: d, 
        label: dayLabel, 
        dateNum: d.getDate(),
        distance: getDistanceForDate(d, activityHistory)
      };
    });
  };

  const getModalMonthData = () => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let firstDayIndex = firstDay.getDay() - 1;
    if (firstDayIndex === -1) firstDayIndex = 6;
    
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({
        dateObj: d,
        dateNum: i,
        distance: getDistanceForDate(d, activityHistory)
      });
    }
    return days;
  };

  const displayName = username || user?.email?.split('@')[0] || 'Explorer';
  const capitalizedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  const selectedDateHistory = selectedDate 
    ? activityHistory.filter(h => isSameDay(new Date(h.date), selectedDate)).reverse()
    : [];

  return (
    <div className="h-full w-full p-4 md:p-8 pb-32 overflow-y-auto relative">
      
      {/* 3D Ethereal Floating Tree Illusion Component (Abstract representation) */}
      <div className="absolute top-20 right-0 w-64 h-64 bg-[var(--color-pastel-yellow)] rounded-full mix-blend-overlay filter blur-3xl opacity-60 animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-40 left-[-2rem] w-80 h-80 bg-[var(--color-soft-green-2)] rounded-full mix-blend-overlay filter blur-3xl opacity-40 pointer-events-none"></div>

      {/* Top Header */}
      <div className="flex items-center mb-8 mt-2 relative z-[40] w-max">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full glass-card p-1 flex items-center justify-center">
            <img 
              src="https://api.dicebear.com/7.x/bottts/svg?seed=EcoStride" 
              alt="Profile" 
              className="w-full h-full object-cover rounded-full bg-white/30 backdrop-blur-sm"
            />
          </div>
          <div>
            <p className="text-sm text-[var(--color-text-muted)] font-bold tracking-wide">{greeting}</p>
            <p className="text-2xl font-black text-[var(--color-text-main)] tracking-wide">{capitalizedName}</p>
          </div>
        </div>
      </div>

      {/* Top Action Bar (Expandable) */}
      <div className="flex justify-end mb-6 relative z-50 mt-[-4rem]">
        <div className="flex items-center">
          <div className={`flex items-center gap-2 overflow-hidden py-2 px-1 transition-all duration-500 ease-out origin-right ${isActionMenuOpen ? 'max-w-[600px] opacity-100 pr-3' : 'max-w-0 opacity-0 pr-0'}`}>
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) setHasReadAlerts(true);
                }}
                className="w-10 h-10 glass-card rounded-full flex items-center justify-center relative transition-transform hover:-translate-y-1 active:translate-y-0"
              >
                <Bell className="text-[var(--color-text-main)]" size={18} />
                {notifications.length > 0 && !hasReadAlerts && (
                  <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-[var(--color-teal-dark)] rounded-full border border-white shadow-sm"></div>
                )}
              </button>
            </div>
            <button 
              onClick={() => setShowMailbox(true)}
              className="glass-card px-4 py-2 rounded-2xl flex items-center gap-2 hover:-translate-y-1 transition-transform whitespace-nowrap relative shadow-sm"
            >
              <Mail size={16} className="text-[var(--color-teal-dark)]" />
              <span className="text-xs font-bold text-[var(--color-text-main)]">Mailbox</span>
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black min-w-[20px] text-center shadow-sm animate-bounce">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
            </button>
            <button 
              onClick={() => setShowStore(true)}
              className="glass-card px-4 py-2 rounded-2xl flex items-center gap-2 hover:-translate-y-1 transition-transform whitespace-nowrap shadow-sm"
            >
              <Gift size={16} className="text-[var(--color-teal-dark)]" />
              <span className="text-xs font-bold text-[var(--color-text-main)]">Store</span>
            </button>
            <button 
              onClick={() => setShowLeaderboard(true)}
              className="glass-card px-4 py-2 rounded-2xl flex items-center gap-2 hover:-translate-y-1 transition-transform whitespace-nowrap shadow-sm"
            >
              <Trophy size={16} className="text-[var(--color-teal-dark)]" />
              <span className="text-xs font-bold text-[var(--color-text-main)]">Ranks</span>
            </button>
            {user && role === 'merchant' && (
              <button 
                onClick={() => setActiveView('merchant_dashboard')}
                className="glass-card px-4 py-2 rounded-2xl flex items-center gap-2 hover:-translate-y-1 transition-transform whitespace-nowrap shadow-sm"
              >
                <Store size={16} className="text-[var(--color-teal-dark)]" />
                <span className="text-xs font-bold text-[var(--color-text-main)]">Hub</span>
              </button>
            )}
          </div>
          
          <button 
            onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
            className="w-10 h-10 glass-card rounded-full flex items-center justify-center z-10 hover:-translate-y-1 transition-transform shadow-md border-2 border-white/60 bg-white/40"
          >
            <Menu size={20} className="text-[var(--color-text-main)]" />
          </button>
        </div>

        {showNotifications && (
          <div className="absolute right-0 top-12 w-72 glass-card p-5 z-[100] animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-black text-[var(--color-text-main)]">Alerts</h3>
              {notifications.length > 0 && (
                <button onClick={() => clearNotifications()} className="text-xs font-bold text-[var(--color-teal-dark)] hover:underline">Clear</button>
              )}
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm font-bold text-[var(--color-text-muted)] py-4 text-center">No new alerts.</p>
              ) : (
                notifications.map((notif, idx) => (
                  <div key={notif.id || idx} className="p-4 glass-active rounded-2xl flex items-start gap-3 shadow-sm border border-white/40 animate-in slide-in-from-right-2">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-teal-dark)] flex-shrink-0 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                      {notif.icon || '🔔'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--color-text-main)]">{notif.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1 font-semibold leading-relaxed">{notif.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Goal Crusher - Main Progress Card */}
      <div className="mb-6 relative z-10">
        <div 
          onClick={() => {
            setBaseDate(new Date());
            setSelectedDate(null);
            setShowCalendar(true);
          }}
          className="glass-card p-7 cursor-pointer hover:-translate-y-1 transition-all"
        >
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 glass-active rounded-full flex items-center justify-center shadow-sm">
                <Activity size={20} className="text-[var(--color-teal-dark)]" />
              </div>
              <h3 className="text-2xl font-black tracking-wide text-[var(--color-text-main)]">Goal Crusher</h3>
            </div>
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setProgressView(progressView === 'Week' ? 'Month' : 'Week');
              }}
              className="flex items-center gap-2 glass-active px-5 py-2.5 rounded-full text-sm font-bold transition-colors shadow-sm text-[var(--color-text-main)]"
            >
              {progressView} <ChevronDown size={16} />
            </div>
          </div>

          <div className="h-44 flex items-end justify-between gap-2 md:gap-4 relative pt-6 pointer-events-none">
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[11px] text-[var(--color-text-muted)] pb-8 pr-2 font-bold">
              {yAxisSteps.map((step, i) => (
                <span key={i}>{step}km</span>
              ))}
            </div>

            <div className="flex-1 flex justify-between items-end h-full pl-10">
              {chartData.map((data, index) => (
                <div key={index} className="flex flex-col items-center gap-3 h-full justify-end w-full group">
                  <div className="w-full max-w-[2rem] bg-white/20 rounded-full h-full relative overflow-hidden flex items-end border-2 border-[var(--color-text-main)]">
                    <div 
                      className={`w-full rounded-full transition-all duration-700 ease-out ${data.active ? 'bg-[var(--color-teal-dark)] shadow-[0_0_10px_rgba(84,150,162,0.4)]' : 'bg-transparent'}`}
                      style={{ height: `${(data.value / maxChartVal) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-[var(--color-text-muted)]">{data.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
        <div className="glass-card p-6 relative group cursor-pointer hover:-translate-y-1 transition-all">
          <p className="text-sm font-bold text-[var(--color-text-muted)] mb-2">Active Streak</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-[var(--color-text-main)] drop-shadow-sm">{calculatedStreak}</span>
            <span className="text-sm font-bold text-[var(--color-text-muted)]">days</span>
          </div>
        </div>

        <div onClick={() => setShowCarbonModal(true)} className="glass-card p-6 relative group cursor-pointer hover:-translate-y-1 transition-all">
          <p className="text-sm font-bold text-[var(--color-text-muted)] mb-2">Carbon Saved</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-[var(--color-text-main)] drop-shadow-sm">{calculatedCarbonSaved.toFixed(1)}</span>
            <span className="text-sm font-bold text-[var(--color-text-muted)]">kg</span>
          </div>
        </div>
      </div>

      {/* Activity History Snapshot */}
      <div className="relative z-10">
        <h3 className="text-2xl font-black text-[var(--color-text-main)] mb-5 tracking-wide">Recent Activity</h3>
        <div className="space-y-4">
          {(showAllActivities ? activityHistory : activityHistory.slice(-3)).reverse().map((trip, idx) => (
             <div key={idx} className="glass-card p-5 flex items-center justify-between cursor-pointer hover:-translate-y-1 transition-all">
             <div className="flex items-center gap-5">
               <div className="w-16 h-16 rounded-[1.5rem] glass-active flex items-center justify-center shadow-sm">
                 <MapIcon size={28} className="text-[var(--color-teal-dark)]" />
               </div>
               <div>
                 <p className="font-black text-[var(--color-text-main)] text-lg">Walking Session</p>
                 <div className="flex gap-5 mt-1">
                   <div>
                     <p className="text-[11px] text-[var(--color-text-muted)] uppercase font-bold tracking-wider">Distance</p>
                     <p className="text-sm font-black text-[var(--color-teal-dark)]">{trip.distance.toFixed(1)} km</p>
                   </div>
                   <div>
                     <p className="text-[11px] text-[var(--color-text-muted)] uppercase font-bold tracking-wider">Date</p>
                     <p className="text-sm font-bold text-[var(--color-text-main)]">{new Date(trip.date).toLocaleDateString()}</p>
                   </div>
                 </div>
               </div>
             </div>
           </div>
          ))}
          {activityHistory.length === 0 && (
            <div className="glass-card p-6 flex justify-center">
              <p className="text-[var(--color-text-muted)] font-bold text-center">No logs found. Start walking!</p>
            </div>
          )}
          {activityHistory.length > 3 && (
            <button 
              onClick={() => setShowAllActivities(!showAllActivities)} 
              className="w-full mt-2 glass-active py-3 rounded-xl font-bold text-[var(--color-text-main)] shadow-sm hover:shadow-md transition-all text-sm"
            >
              {showAllActivities ? 'View Less' : 'View More'}
            </button>
          )}
        </div>
      </div>

      {/* Interactive Calendar Modal */}
      {showCalendar && (
        <div className="fixed inset-0 z-[120] bg-[var(--color-teal-dark)]/20 backdrop-blur-xl flex flex-col items-center justify-end md:justify-center animate-in fade-in duration-300">
          
          <div className="w-full max-w-md glass-card rounded-b-none md:rounded-b-[24px] h-[85vh] md:h-auto md:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-full md:slide-in-from-bottom-10">
            <div className="flex justify-between items-center p-8 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 glass-active rounded-full flex items-center justify-center shadow-sm">
                  <CalendarIcon size={24} className="text-[var(--color-teal-dark)]" />
                </div>
                <h2 className="text-2xl font-black text-[var(--color-text-main)]">Time Log</h2>
              </div>
              <button 
                onClick={() => setShowCalendar(false)}
                className="w-12 h-12 glass-active rounded-full flex items-center justify-center hover:scale-105 transition-transform"
              >
                <X size={24} className="text-[var(--color-text-main)]" />
              </button>
            </div>

            <div className="p-8 pt-4 flex-1 overflow-y-auto">
              {/* View Toggle */}
              <div className="flex gap-2 mb-8 glass-active p-1.5 rounded-full w-full mx-auto shadow-inner">
                <button 
                  onClick={() => { setCalendarView('Week'); setSelectedDate(null); }}
                  className={`flex-1 py-3 rounded-full font-bold text-sm transition-all ${calendarView === 'Week' ? 'glass-card shadow-sm text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                >
                  Weekly
                </button>
                <button 
                  onClick={() => { setCalendarView('Month'); setSelectedDate(null); }}
                  className={`flex-1 py-3 rounded-full font-bold text-sm transition-all ${calendarView === 'Month' ? 'glass-card shadow-sm text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                >
                  Monthly
                </button>
              </div>

              {/* Calendar Controls */}
              <div className="flex justify-between items-center mb-8">
                <button onClick={() => changeBaseDate(-1)} className="w-10 h-10 flex items-center justify-center glass-active rounded-full text-[var(--color-text-main)] hover:scale-105 transition-all"><ChevronLeft size={20}/></button>
                <span className="font-black text-xl text-[var(--color-text-main)] tracking-wide">
                  {calendarView === 'Week' 
                    ? `Week of ${getMonday(baseDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                    : baseDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                  }
                </span>
                <button onClick={() => changeBaseDate(1)} className="w-10 h-10 flex items-center justify-center glass-active rounded-full text-[var(--color-text-main)] hover:scale-105 transition-all"><ChevronRight size={20}/></button>
              </div>

              {/* Calendar View Area */}
              {calendarView === 'Week' ? (
                <div className="flex justify-between mb-8">
                  {getModalWeekData().map((d, i) => {
                    const isActive = d.distance > 0;
                    const isSelected = selectedDate && isSameDay(selectedDate, d.dateObj);
                    
                    return (
                      <div key={i} className="flex flex-col items-center gap-3">
                        <span className="text-xs font-bold text-[var(--color-text-muted)]">{d.label}</span>
                        <button 
                          onClick={() => setSelectedDate(d.dateObj)}
                          className={`w-12 h-[4.5rem] rounded-[1.5rem] flex flex-col items-center justify-center gap-1 transition-all
                            ${isActive ? 'bg-[var(--color-teal-dark)] text-white shadow-sm hover:-translate-y-1' : 'glass-active text-[var(--color-text-main)] hover:scale-105'}
                            ${isSelected ? 'ring-4 ring-[var(--color-teal-dark)] ring-opacity-40' : ''}
                          `}
                        >
                          <span className="text-lg font-black">{d.dateNum}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mb-8">
                  <div className="grid grid-cols-7 gap-2 text-center mb-4">
                    {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                      <span key={d} className="text-xs font-bold text-[var(--color-text-muted)]">{d}</span>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-7 gap-3">
                    {getModalMonthData().map((dayData, i) => {
                      if (!dayData) return <div key={i} className="aspect-square"></div>;
                      
                      const isActive = dayData.distance > 0;
                      const isSelected = selectedDate && isSameDay(selectedDate, dayData.dateObj);
                      
                      return (
                        <button 
                          key={i} 
                          onClick={() => setSelectedDate(dayData.dateObj)}
                          className={`aspect-square rounded-full flex flex-col items-center justify-center relative transition-all
                            ${isActive ? 'bg-[var(--color-teal-dark)] text-white shadow-sm hover:scale-105' : 'glass-active text-[var(--color-text-main)] hover:scale-105'}
                            ${isSelected ? 'ring-4 ring-[var(--color-teal-dark)] ring-opacity-40 scale-105' : ''}
                          `}
                        >
                          <span className="text-sm font-black">{dayData.dateNum}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Selected Date History List */}
              <div className="mt-8">
                {selectedDate ? (
                  <>
                    <h3 className="font-bold text-[var(--color-text-muted)] text-sm tracking-wide mb-4">
                      {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h3>
                    
                    {selectedDateHistory.length > 0 ? (
                      selectedDateHistory.map((activity, idx) => (
                        <div key={idx} className="flex justify-between items-center py-4 glass-active rounded-[2rem] px-5 mb-3 shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-[var(--color-teal-dark)] flex items-center justify-center text-white shadow-sm">
                              <MapIcon size={20} />
                            </div>
                            <span className="font-black text-[var(--color-text-main)] text-lg">Walk</span>
                          </div>
                          <span className="font-black text-[var(--color-teal-dark)] text-xl">+{activity.distance.toFixed(1)} km</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10">
                        <Activity size={48} className="mb-4 text-white/40" />
                        <p className="font-bold text-[var(--color-text-muted)]">No activity on this date.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <CalendarIcon size={48} className="mb-4 text-white/40" />
                    <p className="font-bold text-[var(--color-text-muted)] text-center px-8">Select a date above to view your logs.</p>
                  </div>
                )}
              </div>
              
            </div>
          </div>
        </div>
      )}

      {showCarbonModal && <CarbonStatsModal isOpen={showCarbonModal} onClose={() => setShowCarbonModal(false)} />}
      {showMailbox && <MailboxModal onClose={() => setShowMailbox(false)} />}
      {showStore && <PointsStoreModal onClose={() => setShowStore(false)} />}
      <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
    </div>
  );
};
