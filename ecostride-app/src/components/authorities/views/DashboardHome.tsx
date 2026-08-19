import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useUserStore } from '../../../stores/useUserStore';
import { Calendar as CalendarIcon, CheckCircle, Clock, AlertCircle, X, ChevronLeft, ChevronRight, Edit2, TrendingUp, BarChart2, Briefcase, Plus, CalendarDays, Activity, ClipboardList, Radio, Map, Network, Layers } from 'lucide-react';

interface Stats {
  today: { pending: number; 'in-progress': number; resolved: number };
  monthly: { reported: number; severity: { Minor: number; Major: number; Critical: number } };
}

interface Task {
  id: string;
  title: string;
  description: string;
  importance: 'Low' | 'Medium' | 'High';
  scheduled_at: number;
  completed: number;
  created_at: number;
}

interface Issue {
  id: string;
  title: string;
  status: string;
  severity: string;
  created_at: number;
  updated_at: number;
  location?: string;
  photos?: string;
  unread_count?: number;
  takedown_status?: string;
}

function ErrorFallback({ error, reset }: { error: Error, reset: () => void }) {
  return (
    <div className="p-8 flex flex-col items-center justify-center h-full text-center">
      <div className="bg-red-100 text-red-600 p-4 rounded-full mb-4">
        <AlertCircle size={48} />
      </div>
      <h2 className="text-2xl font-black text-slate-900 mb-2">Something went wrong</h2>
      <p className="text-[#4A6B53] mb-6">{error.message}</p>
      <button onClick={reset} className="px-6 py-3 bg-[#224C31] text-white rounded-xl font-bold hover:bg-[#224C31]/90 transition-colors">
        Try Again
      </button>
    </div>
  );
}

export function DashboardHome() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const [stats, setStats] = useState<Stats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [criticalReports, setCriticalReports] = useState<Issue[]>([]);
  const [workload, setWorkload] = useState<Issue[]>([]);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [newTaskData, setNewTaskData] = useState({ title: '', description: '', importance: 'Medium' as 'Low'|'Medium'|'High' });
  const [workloadTab, setWorkloadTab] = useState<'cases'|'tasks'>('cases');

  const fetchData = async () => {
    try {
      const statsRes = await apiClient('/authorities/dashboard/stats');
      setStats(statsRes);
      
      const tasksRes = await apiClient(`/authorities/tasks?page=1&limit=100`);
      setTasks(tasksRes.tasks || []);
      
      const criticalRes = await apiClient(`/authorities/dashboard/critical`);
      setCriticalReports(criticalRes.critical || []);
      
      const workloadRes = await apiClient(`/authorities/dashboard/workload`);
      const fetchedWorkload = (workloadRes.workload || []).filter((w: any) => w.takedown_status !== 'taken-down');
      setWorkload(fetchedWorkload);
      
      const unreadTotal = fetchedWorkload.reduce((sum: number, w: any) => sum + (w.unread_count || 0), 0);
      useUserStore.getState().setLocalData({ authorityUnreadCount: unreadTotal });
      
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    try {
      await apiClient(`/authorities/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          ...newTaskData,
          scheduled_at: selectedDate
        }),
      });
      setIsTaskModalOpen(false);
      setNewTaskData({ title: '', description: '', importance: 'Medium' });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to create task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await apiClient(`/authorities/tasks/${taskId}`, {
        method: 'DELETE',
      });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete task');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
  
  // Tasks by day
  const tasksByDay: Record<string, Task[]> = {};
  tasks.forEach(t => {
    const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(t.scheduled_at));
    if (!tasksByDay[dStr]) tasksByDay[dStr] = [];
    tasksByDay[dStr].push(t);
  });

  if (error) return <ErrorFallback error={error} reset={() => { setLoading(true); setError(null); fetchData(); }} />;

  return (
    <div className="h-full bg-[#224C31] overflow-y-auto relative overflow-x-hidden">
      {/* Subtle organic background artwork */}
      <Network size={800} className="absolute -top-40 -left-20 text-[#34D399] opacity-[0.15] pointer-events-none stroke-1 mix-blend-overlay" />
      <Map size={800} className="absolute bottom-0 right-0 text-[#FBBF24] opacity-[0.12] pointer-events-none stroke-1 mix-blend-overlay translate-y-1/4 translate-x-1/4" />
      
      <div className="w-full max-w-[1600px] mx-auto p-4 md:p-8 animate-in fade-in duration-500 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              {getGreeting()}, {user?.username || 'Authority'}
            </h1>
            <p className="text-emerald-100/70 mt-2 font-bold flex items-center gap-2">
              <Clock size={16} />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="bg-gradient-to-r from-[#42694D] to-[#D5A754] text-white px-5 md:px-6 py-2.5 md:py-3 rounded-[24px] font-bold flex items-center gap-2 md:gap-3 shadow-lg border-none text-sm md:text-base">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
            </span>
            System Online & Syncing
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          
          {/* Left Column (Content & Widgets) */}
          <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-8">
            
            {/* Top Widgets Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Calendar */}
              <div className="col-span-1 bg-white rounded-[32px] p-6 shadow-xl border-4 border-white flex flex-col h-full min-h-[320px] relative overflow-hidden">
                <CalendarDays size={180} className="absolute -top-10 -right-10 text-[#34D399] opacity-10 pointer-events-none stroke-1 rotate-12" />
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <h3 className="font-black text-[#1E432B] text-lg flex items-center gap-2">
                    <span>📅</span> Schedule
                  </h3>
                </div>
                <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center flex-1 content-center relative z-10">
                  {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-xs font-black text-[#1E432B]">{d}</div>)}
                  {Array.from({ length: 30 }).map((_, i) => {
                    const dateObj = new Date();
                    dateObj.setDate(dateObj.getDate() - dateObj.getDate() + 1 + i); // 1st to 30th
                    const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(dateObj);
                    const isToday = dStr === todayStr;
                    const hasTasks = tasksByDay[dStr] && tasksByDay[dStr].length > 0;
                    
                    return (
                      <div 
                        key={i} 
                        onClick={() => { setSelectedDate(dateObj.getTime()); setIsTaskModalOpen(true); }}
                        className={`p-2 rounded-xl text-sm font-bold transition-all relative cursor-pointer
                          ${isToday ? 'bg-[#8DAA91] text-white shadow-md scale-105' : 'text-[#4A6B53] hover:bg-[#EAF0EC]'}
                        `}
                      >
                        {i + 1}
                        {hasTasks && (
                          <div className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-[#D5B054]'}`}></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Today's Reports */}
              <div className="col-span-1 bg-white rounded-[32px] p-6 shadow-xl border-4 border-white flex flex-col justify-between min-h-[320px] relative overflow-hidden">
                <Activity size={180} className="absolute -top-6 -right-6 text-[#FBBF24] opacity-15 pointer-events-none stroke-1 -rotate-12" />
                <h3 className="font-black text-[#1E432B] text-lg flex items-center gap-2 mb-4 relative z-10">
                  <span>📊</span> Today's Reports
                </h3>
                {loading || !stats ? (
                  <div className="flex-1 animate-pulse bg-[#EAF0EC] rounded-2xl relative z-10"></div>
                ) : (
                  <div className="flex-1 flex flex-col justify-center gap-4 relative z-10">
                    <div className="bg-gradient-to-r from-[#42694D] to-[#D5A754] p-4 rounded-2xl flex justify-between items-center shadow-md border-none">
                      <span className="font-bold text-white/90">Pending</span>
                      <span className="font-black text-2xl text-white drop-shadow-sm">{stats.today.pending}</span>
                    </div>
                    <div className="bg-gradient-to-r from-[#365A42] to-[#B09A4D] p-4 rounded-2xl flex justify-between items-center shadow-md border-none">
                      <span className="font-bold text-white/90">In Progress</span>
                      <span className="font-black text-2xl text-white drop-shadow-sm">{stats.today['in-progress']}</span>
                    </div>
                    <div className="bg-gradient-to-r from-[#294B35] to-[#8C8F47] p-4 rounded-2xl flex justify-between items-center shadow-md border-none">
                      <span className="font-bold text-white/90">Resolved</span>
                      <span className="font-black text-2xl text-white drop-shadow-sm">{stats.today.resolved}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Monthly Severity */}
              <div className="col-span-1 bg-white rounded-[32px] p-6 shadow-xl border-4 border-white flex flex-col min-h-[320px] relative overflow-hidden">
                <TrendingUp size={200} className="absolute -top-10 -right-10 text-[#34D399] opacity-10 pointer-events-none stroke-1 rotate-12" />
                <div className="absolute inset-0 bg-gradient-to-br from-[#34D399]/5 via-transparent to-[#FBBF24]/5 pointer-events-none"></div>
                <h3 className="font-black text-[#1E432B] text-lg flex items-center gap-2 mb-2 z-10 relative">
                  <span>🔴</span> Monthly Severity
                </h3>
                {loading || !stats ? (
                  <div className="flex-1 animate-pulse bg-[#EAF0EC] rounded-2xl mt-4 relative z-10"></div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center relative z-10 mt-4">
                    <div className="relative w-36 h-36">
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#34D399]/40 to-[#FBBF24]/40 rounded-full blur-3xl scale-[1.75] mix-blend-multiply"></div>
                      <svg className="w-full h-full transform -rotate-90 drop-shadow-md" viewBox="0 0 100 100">
                        {/* Circle logic */}
                        {(() => {
                          const { Minor, Major, Critical } = stats.monthly.severity;
                          const total = Minor + Major + Critical || 1;
                          const r = 36;
                          const c = 2 * Math.PI * r;
                          
                          const minorPct = Minor / total;
                          const majorPct = Major / total;
                          const criticalPct = Critical / total;
                          
                          let offset = 0;
                          
                          const minorDash = minorPct * c;
                          const majorDash = majorPct * c;
                          const criticalDash = criticalPct * c;
                          
                          return (
                            <>
                              <circle cx="50" cy="50" r={r} stroke="#EAF0EC" strokeWidth="18" fill="transparent" />
                              {Minor > 0 && <circle cx="50" cy="50" r={r} stroke="#34D399" strokeWidth="18" fill="transparent" strokeDasharray={`${minorDash} ${c}`} strokeDashoffset={-offset} className="transition-all duration-1000" /> }
                              {(() => { offset += minorDash; return null; })()}
                              {Major > 0 && <circle cx="50" cy="50" r={r} stroke="#FBBF24" strokeWidth="18" fill="transparent" strokeDasharray={`${majorDash} ${c}`} strokeDashoffset={-offset} className="transition-all duration-1000" /> }
                              {(() => { offset += majorDash; return null; })()}
                              {Critical > 0 && <circle cx="50" cy="50" r={r} stroke="#FB7185" strokeWidth="18" fill="transparent" strokeDasharray={`${criticalDash} ${c}`} strokeDashoffset={-offset} className="transition-all duration-1000" /> }
                            </>
                          );
                        })()}
                      </svg>
                      <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
                        <span className="text-2xl font-black text-[#1E432B]">{stats.monthly.reported}</span>
                        <span className="text-[10px] font-bold text-[#9BB3A3] uppercase">Total</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 mt-6">
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#34D399]"></div><span className="text-xs font-bold text-[#4A6B53]">Minor</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#FBBF24]"></div><span className="text-xs font-bold text-[#4A6B53]">Major</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#FB7185]"></div><span className="text-xs font-bold text-[#4A6B53]">Critical</span></div>
                    </div>
                  </div>
                )}
                
                {/* Decorative background element */}
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br from-[#D5B054]/20 to-transparent rounded-full blur-3xl pointer-events-none"></div>
              </div>
            </div>

            {/* Bottom Section: My Workload */}
            <div className="bg-white rounded-[32px] p-8 shadow-xl border-4 border-white flex-1 min-h-[300px] relative overflow-hidden">
              <ClipboardList size={300} className="absolute -bottom-20 -right-10 text-[#34D399] opacity-10 pointer-events-none stroke-1 -rotate-6" />
              <Layers size={250} className="absolute -top-20 right-1/4 text-[#FBBF24] opacity-[0.08] pointer-events-none stroke-1 rotate-12" />
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 relative z-10">
                <h3 className="font-black text-[#1E432B] text-xl flex items-center gap-2">
                  <span>💼</span> My Workload
                </h3>
                
                <div className="flex bg-[#EAF0EC] p-1 rounded-full relative z-10 w-full sm:w-auto overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <button 
                    onClick={() => setWorkloadTab('cases')}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-black transition-all whitespace-nowrap shrink-0 ${workloadTab === 'cases' ? 'bg-white text-[#1E432B] shadow-sm' : 'text-[#9BB3A3] hover:text-[#4A6B53]'}`}
                  >
                    Active Cases <span className="bg-slate-200 text-[#4A6B53] px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs">{workload.length}</span>
                  </button>
                  <button 
                    onClick={() => setWorkloadTab('tasks')}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-black transition-all whitespace-nowrap shrink-0 ${workloadTab === 'tasks' ? 'bg-white text-[#1E432B] shadow-sm' : 'text-[#9BB3A3] hover:text-[#4A6B53]'}`}
                  >
                    Calendar Tasks <span className="bg-slate-200 text-[#4A6B53] px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs">{tasks.length}</span>
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                {workloadTab === 'cases' ? (
                  loading && workload.length === 0 ? (
                    [1,2,3].map(i => <div key={i} className="h-32 bg-[#F3F7F4] animate-pulse rounded-[24px]"></div>)
                  ) : workload.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center py-12 text-[#9BB3A3]">
                      <CheckCircle size={48} className="mb-3 text-slate-200" />
                      <p className="font-bold">No active workload</p>
                    </div>
                  ) : (
                    workload.map(issue => {
                      const daysOpen = Math.floor((Date.now() - issue.created_at) / (1000 * 60 * 60 * 24));
                      let photos: string[] = [];
                      try {
                        if (issue.photos && typeof issue.photos === 'string') {
                          photos = JSON.parse(issue.photos);
                        } else if (Array.isArray(issue.photos)) {
                          photos = issue.photos;
                        }
                      } catch (e) {}
                      const coverPhoto = photos.length > 0 ? photos[0] : null;

                      return (
                        <div 
                          key={issue.id} 
                          onClick={() => navigate('/authorities/issues', { state: { openIssue: issue } })}
                          className="p-6 rounded-[24px] bg-white border border-[#EAF0EC] shadow-[0_2px_10px_-4px_rgba(34,76,49,0.1)] hover:-translate-y-1 hover:shadow-[0_8px_20px_-6px_rgba(34,76,49,0.15)] transition-all duration-300 cursor-pointer group flex flex-col h-full relative overflow-visible"
                        >
                          {(issue.unread_count || 0) > 0 && (
                            <div className="absolute -top-2 -right-2 shrink-0 min-w-[20px] h-[20px] bg-rose-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-20">
                              <span className="text-[10px] font-bold text-white leading-none pt-[1px] px-1">{(issue.unread_count || 0) > 99 ? '99+' : issue.unread_count}</span>
                            </div>
                          )}
                          <div className="absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-br from-[#34D399]/10 to-transparent rounded-full blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>
                          <div className="flex items-start justify-between gap-2 z-10 mb-1.5 relative">
                            <h4 className="text-[17px] font-black text-[#1E432B] truncate">{issue.title}</h4>
                          </div>
                          <p className="text-[13px] font-medium text-[#738F7C] line-clamp-1 mb-4 relative z-10">
                            <Clock size={12} className="inline mr-1" /> {daysOpen === 0 ? 'Opened today' : `${daysOpen} days open`}
                          </p>
                          {coverPhoto && (
                            <div className="relative w-full h-32 rounded-[16px] overflow-hidden mb-4 bg-[#F3F7F4] shrink-0 z-10">
                              <img src={coverPhoto} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-auto relative z-10">
                            <div className="flex flex-wrap gap-2">
                              <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                issue.severity === 'Critical' ? 'bg-[#FFE4E6] text-[#E11D48]' :
                                issue.severity === 'Major' ? 'bg-[#FEF3C7] text-[#D97706]' :
                                'bg-[#D1FAE5] text-[#059669]'
                              }`}>{issue.severity}</span>
                              <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                issue.takedown_status === 'taken-down' ? 'bg-[#FFE4E6] text-[#E11D48]' :
                                issue.takedown_status === 'requested' ? 'bg-[#FFEDD5] text-[#C2410C]' :
                                'bg-blue-50 text-blue-600'
                              }`}>
                                {issue.takedown_status === 'taken-down' ? 'Taken Down' : issue.takedown_status === 'requested' ? 'Takedown Pending' : issue.status}
                              </span>
                            </div>
                            <span className="text-xs font-black text-[#1E432B] opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  loading && tasks.length === 0 ? (
                    [1,2,3].map(i => <div key={i} className="h-32 bg-[#F3F7F4] animate-pulse rounded-[24px]"></div>)
                  ) : tasks.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center py-12 text-[#9BB3A3]">
                      <CheckCircle size={48} className="mb-3 text-slate-200" />
                      <p className="font-bold">No scheduled tasks</p>
                    </div>
                  ) : (
                    tasks.map(task => {
                      const dateStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(task.scheduled_at)).toUpperCase();
                      return (
                        <div key={task.id} className="p-6 rounded-[24px] bg-white border border-[#EAF0EC] shadow-[0_2px_10px_-4px_rgba(34,76,49,0.1)] hover:-translate-y-1 hover:shadow-[0_8px_20px_-6px_rgba(34,76,49,0.15)] transition-all duration-300 cursor-pointer group flex flex-col relative h-full overflow-hidden">
                          <div className="absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-br from-[#FBBF24]/10 to-transparent rounded-full blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                            className="absolute top-4 right-4 text-[#B5C9BE] hover:text-[#E11D48] hover:bg-[#FFE4E6] p-1.5 rounded-full transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 z-20"
                            title="Delete Task"
                          >
                            <X size={16} strokeWidth={3} />
                          </button>
                          <h4 className="text-[17px] font-black text-[#1E432B] truncate pr-8 mb-1.5 relative z-10">{task.title}</h4>
                          <p className="text-[13px] font-medium text-[#738F7C] line-clamp-2 flex-1 mb-6 relative z-10">{task.description || 'No description provided.'}</p>
                          <div className="flex flex-wrap gap-2 mt-auto relative z-10">
                            <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              task.importance === 'High' ? 'bg-[#FFE4E6] text-[#E11D48]' :
                              task.importance === 'Medium' ? 'bg-[#FEF3C7] text-[#D97706]' :
                              'bg-[#D1FAE5] text-[#059669]'
                            }`}>{task.importance}</span>
                            <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#EAF0EC] text-[#4A6B53] flex items-center gap-1.5">
                              <CalendarIcon size={12} /> {dateStr}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>

          </div>

          {/* Right Column (Critical Reports) */}
          <div className="lg:col-span-1 xl:col-span-1 flex flex-col h-full min-h-[800px]">
            <div className="bg-white rounded-[32px] p-6 shadow-xl border-4 border-white flex-1 flex flex-col overflow-hidden relative">
              <Radio size={350} className="absolute -top-24 -right-24 text-[#FB7185] opacity-10 pointer-events-none stroke-1" />
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-[#FB7185]/20 to-transparent rounded-bl-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between mb-6 z-10">
                <h3 className="font-black text-[#1E432B] text-xl flex items-center gap-2">
                  <span>🚨</span> Critical Reports
                </h3>
                {criticalReports.length > 0 && (
                  <span className="bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-sm">
                    {criticalReports.length}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar z-10">
                {loading && criticalReports.length === 0 ? (
                  [1,2,3,4,5].map(i => <div key={i} className="h-32 bg-[#F3F7F4] animate-pulse rounded-[24px]"></div>)
                ) : criticalReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-[#9BB3A3] pb-12">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle size={32} className="text-emerald-500" />
                    </div>
                    <p className="font-black text-[#4A6B53] text-center">No critical reports</p>
                    <p className="text-xs font-medium text-[#9BB3A3] text-center mt-1">Everything is under control.</p>
                  </div>
                ) : (
                  criticalReports.map(report => {
                    const timeAgo = Math.floor((Date.now() - report.created_at) / (1000 * 60 * 60));
                    const timeStr = timeAgo < 24 ? `${timeAgo} hours ago` : `${Math.floor(timeAgo/24)} days ago`;
                          return (
                        <div key={report.id} className="p-5 rounded-[24px] bg-white border border-[#EAF0EC] shadow-[0_2px_10px_-4px_rgba(34,76,49,0.1)] hover:-translate-y-1 hover:shadow-[0_8px_20px_-6px_rgba(34,76,49,0.15)] transition-all duration-300 cursor-pointer group flex flex-col relative h-full overflow-hidden">
                          <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-[#FB7185]/10 to-transparent rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-700"></div>
                          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#FFE4E6] to-transparent rounded-tr-[24px] rounded-bl-[100px] pointer-events-none"></div>
                          <h4 className="text-[15px] font-black text-[#1E432B] line-clamp-2 mb-2 group-hover:text-[#E11D48] transition-colors z-10 pr-2">{report.title}</h4>
                          
                          <div className="flex justify-between items-center text-[12px] font-bold text-[#738F7C] mb-4 flex-1 z-10">
                            <span className="flex items-center gap-1.5"><Clock size={12} /> {timeStr}</span>
                          </div>
  
                          <div className="flex items-center justify-between mt-auto z-10">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFE4E6] border border-[#FB7185]/20 text-[9px] font-black uppercase tracking-wider text-[#E11D48]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] animate-pulse"></span> Critical
                              </span>
                              <span className={`text-[9px] font-black uppercase tracking-wider ${report.status === 'in-progress' ? 'text-blue-600' : 'text-[#D97706]'}`}>
                                {report.status}
                              </span>
                            </div>
                            <span className="text-[#E11D48] opacity-0 group-hover:opacity-100 transition-opacity font-black text-[11px] uppercase tracking-wider">Review →</span>
                          </div>
                        </div>
                      );
                  })
                )}
              </div>
              
              {criticalReports.length > 0 && (
                <div className="pt-4 mt-2 border-t border-[#E1EAE4] z-10">
                  <button className="w-full py-3 rounded-2xl text-sm font-black text-[#738F7C] hover:bg-[#F3F7F4] hover:text-[#1E432B] transition-colors">
                    View All Critical Cases
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Task Creation Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#224C31]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[32px] shadow-2xl animate-in zoom-in-95 duration-200 border-4 border-white/50 custom-scrollbar">
            <div className="px-8 py-6 border-b border-[#E1EAE4] flex items-center justify-between bg-[#F3F7F4]/50">
              <div>
                <h3 className="font-black text-2xl text-[#1E432B]">Record Task</h3>
                <p className="text-sm font-bold text-[#9BB3A3] mt-1">
                  {selectedDate && new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-[#9BB3A3] hover:text-[#4A6B53] bg-white hover:bg-[#EAF0EC] p-2.5 rounded-full transition-colors shadow-sm">
                <X size={20} strokeWidth={3} />
              </button>
            </div>
            
            <form onSubmit={handleCreateTask} className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#738F7C] mb-2">Task Title</label>
                <input 
                  required
                  type="text" 
                  placeholder="E.g. Review road repairs"
                  value={newTaskData.title} 
                  onChange={e => setNewTaskData({...newTaskData, title: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl bg-[#F3F7F4] border border-[#CFDDD3] focus:ring-4 focus:ring-[#224C31]/10 focus:border-[#224C31] transition-all text-[#1E432B] font-bold outline-none placeholder:text-[#B5C9BE] placeholder:font-medium" 
                />
              </div>
              
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#738F7C] mb-2">Short Description</label>
                <textarea 
                  value={newTaskData.description} 
                  placeholder="Optional details..."
                  onChange={e => setNewTaskData({...newTaskData, description: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl bg-[#F3F7F4] border border-[#CFDDD3] focus:ring-4 focus:ring-[#224C31]/10 focus:border-[#224C31] transition-all text-[#1E432B] font-bold outline-none min-h-[100px] resize-none placeholder:text-[#B5C9BE] placeholder:font-medium" 
                />
              </div>
              
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#738F7C] mb-3">Degree of Importance</label>
                <div className="flex gap-3">
                  {(['Low', 'Medium', 'High'] as const).map(imp => (
                    <button
                      key={imp}
                      type="button"
                      onClick={() => setNewTaskData({...newTaskData, importance: imp})}
                      className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all border-2 ${
                        newTaskData.importance === imp 
                          ? (imp === 'High' ? 'bg-red-50 border-red-200 text-red-700 shadow-sm' : imp === 'Medium' ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm' : 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm')
                          : 'bg-white border-[#E1EAE4] text-[#9BB3A3] hover:bg-[#F3F7F4]'
                      }`}
                    >
                      {imp}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="pt-4 mt-2">
                <button type="submit" className="w-full py-4 font-black text-white bg-[#224C31] hover:bg-[#224C31]/90 rounded-2xl transition-all shadow-lg shadow-[#224C31]/30 flex items-center justify-center gap-2">
                  <Plus size={18} strokeWidth={3} /> Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Custom Scrollbar Styles for the component */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}
