import { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api';
import { useUserStore } from '../../../stores/useUserStore';
import { Calendar as CalendarIcon, CheckCircle, Clock, AlertCircle, X, ChevronLeft, ChevronRight, Edit2, TrendingUp } from 'lucide-react';

interface Stats {
  today: { reported: number };
  monthly: { reported: number; resolved: number; data: Array<{ date: string; reported: number; resolved: number }> };
  response: { responded: number; unresponded: number; respondedPercentage: number };
}

interface Task {
  id: number;
  title: string;
  description: string;
  scheduled_at: string;
  completed: number;
  created_at: string;
}

function ErrorFallback({ error, reset }: { error: Error, reset: () => void }) {
  return (
    <div className="p-8 flex flex-col items-center justify-center h-full text-center">
      <div className="bg-red-100 text-red-600 p-4 rounded-full mb-4">
        <AlertCircle size={48} />
      </div>
      <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Something went wrong</h2>
      <p className="text-slate-600 dark:text-slate-400 mb-6">{error.message}</p>
      <button onClick={reset} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-colors">
        Try Again
      </button>
    </div>
  );
}

export function DashboardHome() {
  const user = useUserStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const [stats, setStats] = useState<Stats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editFormData, setEditFormData] = useState({ title: '', description: '', scheduled_at: '', completed: 0 });

  const fetchData = async () => {
    try {
      const statsRes = await apiClient('/authorities/dashboard/stats');
      setStats(statsRes);
      
      const tasksRes = await apiClient(`/authorities/tasks?page=${page}&limit=5`);
      setTasks(tasksRes.tasks || []);
      setTotalPages(tasksRes.pagination?.totalPages || 1);
      
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // 5 min refresh
    return () => clearInterval(interval);
  }, [page]);

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    try {
      await apiClient(`/authorities/tasks/${selectedTask.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editFormData),
      });
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to update task');
    }
  };

  if (error) return <ErrorFallback error={error} reset={() => { setLoading(true); setError(null); fetchData(); }} />;

  return (
    <div className="p-8 w-full max-w-[1600px] mx-auto animate-in fade-in duration-500 relative">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* LEFT / CENTER COLUMN */}
        <div className="xl:col-span-2 flex flex-col gap-8">
          
          {/* Top: User Info Block */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">
                Welcome back, Authority
              </h1>
              <p className="text-emerald-100/70 mt-2 text-lg">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="bg-white/10 text-white border border-white/20 backdrop-blur-md px-6 py-3 rounded-[24px] font-bold flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D5B054] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#D5B054]"></span>
              </span>
              System Online & Syncing
            </div>
          </div>

          {/* Loading State for Stats */}
          {loading && !stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-64 bg-white/10 animate-pulse rounded-[32px]"></div>
              <div className="h-64 bg-white/10 animate-pulse rounded-[32px]"></div>
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Left: Minimal Calendar (Takes up full height of this grid cell) */}
              <div className="bg-white rounded-[32px] p-8 shadow-xl border-4 border-white/50 backdrop-blur-md flex flex-col justify-center">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-black text-[#1B4A2E] text-lg flex items-center">
                    <CalendarIcon size={22} className="mr-3 text-[#699361] stroke-[2.5px]" /> 
                    Schedule
                  </h3>
                </div>
                <div className="grid grid-cols-7 gap-y-4 gap-x-2 text-center flex-1 items-center">
                  {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-xs font-black text-slate-400">{d}</div>)}
                  {Array.from({ length: 30 }).map((_, i) => {
                    const isToday = i + 1 === new Date().getDate();
                    return (
                      <div key={i} className={`p-2 rounded-2xl text-sm font-bold transition-all ${isToday ? 'bg-[#699361] text-white shadow-lg shadow-[#699361]/30 scale-110' : 'text-slate-600 hover:bg-slate-50 cursor-pointer'}`}>
                        {i + 1}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* Today Card */}
                <div className="col-span-1 bg-gradient-to-r from-[#699361] to-[#C99C3D] rounded-[28px] p-6 text-white shadow-lg relative overflow-hidden group flex flex-col justify-between">
                  <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                  <div>
                    <p className="text-white/90 font-bold tracking-wider text-xs mb-1">Today's Reports</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black tracking-tighter drop-shadow-md">{stats.today.reported}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between z-10">
                    <div className="flex items-center text-[10px] font-bold text-white bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-md">
                      <TrendingUp size={12} className="mr-1 stroke-[3px]" /> Live
                    </div>
                  </div>
                </div>

                {/* Monthly Stats */}
                <div className="col-span-1 bg-white rounded-[28px] p-6 shadow-xl flex flex-col justify-between relative overflow-hidden border-4 border-white/50 backdrop-blur-md">
                  <p className="text-[#1B4A2E] font-black tracking-wider text-xs mb-2">Monthly</p>
                  <div className="flex justify-between items-end gap-2 h-full z-10">
                    <div className="flex-1">
                      <p className="text-2xl font-black text-slate-800">{stats.monthly.reported}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">Rpt.</p>
                    </div>
                    <div className="w-[2px] h-6 bg-slate-100 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-2xl font-black text-[#699361]">{stats.monthly.resolved}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">Res.</p>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full h-16 opacity-20 pointer-events-none">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full fill-[#C99C3D]">
                      <path d="M0,100 L0,50 Q25,20 50,60 T100,40 L100,100 Z" />
                    </svg>
                  </div>
                </div>

                {/* Response Chart - Stretching across 2 columns */}
                <div className="col-span-2 bg-white rounded-[28px] p-6 shadow-xl flex items-center relative border-4 border-white/50 backdrop-blur-md">
                  <div className="flex-1 pr-4">
                    <p className="text-[#1B4A2E] font-black tracking-wider text-xs mb-3">Response Rate</p>
                    <div className="space-y-3 mt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[#699361]"></div>
                          <span className="text-xs font-bold text-slate-500">Responded</span>
                        </div>
                        <span className="text-sm font-black text-slate-800">{stats.response.responded}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                          <span className="text-xs font-bold text-slate-500">Pending</span>
                        </div>
                        <span className="text-sm font-black text-slate-800">{stats.response.unresponded}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative w-24 h-24 shrink-0">
                    <div className="absolute inset-0 bg-[#699361]/10 rounded-full blur-xl scale-110"></div>
                    <svg className="w-full h-full transform -rotate-90 relative z-10 drop-shadow-sm" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="38" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-slate-100" />
                      <circle 
                        cx="50" cy="50" r="38" stroke="currentColor" strokeWidth="16" fill="transparent" 
                        strokeDasharray={`${2 * Math.PI * 38}`}
                        strokeDashoffset={`${2 * Math.PI * 38 * (1 - stats.response.respondedPercentage / 100)}`}
                        className="text-[#699361] transition-all duration-1000 ease-out" 
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center flex-col z-20">
                      <span className="text-xl font-black text-slate-800">{stats.response.respondedPercentage.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : null}

          {/* Bottom Row: Reporter Cards Empty Plug */}
          <div className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'Jel Chibuzo', role: 'Citizen' },
                { name: 'Emlen Beaver', role: 'Staff' },
                { name: 'Jaquon Hart', role: 'Citizen' },
                { name: 'Joe Desuza', role: 'Staff' },
              ].map((reporter, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-md rounded-[28px] p-5 flex flex-col items-center justify-center border border-white/20 transition-all hover:bg-white/15 cursor-pointer group">
                  <div className="w-14 h-14 bg-white/20 rounded-full mb-3 flex items-center justify-center">
                    <span className="text-white font-black opacity-50 text-xl">{reporter.name[0]}</span>
                  </div>
                  <p className="text-white font-bold text-sm text-center">{reporter.name}</p>
                  <p className="text-emerald-100/60 text-xs font-semibold mb-3">{reporter.role}</p>
                  <p className="text-[#D5B054] text-xs font-black uppercase tracking-wider group-hover:text-white transition-colors">Assign →</p>
                </div>
              ))}
            </div>
          </div>
          
        </div>

        {/* RIGHT COLUMN: Tasks */}
        <div className="xl:col-span-1 flex flex-col h-full min-h-[600px]">
          <div className="bg-white rounded-[32px] p-8 shadow-xl border-4 border-white/50 backdrop-blur-md flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-[#1B4A2E] text-2xl">Tasks</h3>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-600 transition-colors"><ChevronLeft size={20} strokeWidth={3} /></button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-600 transition-colors"><ChevronRight size={20} strokeWidth={3} /></button>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              {loading && tasks.length === 0 ? (
                [1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-50 animate-pulse rounded-[24px]"></div>)
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                  <CheckCircle size={64} className="mb-4 text-slate-200" strokeWidth={1.5} />
                  <p className="font-black text-slate-500">No active tasks</p>
                  <p className="text-sm font-medium mt-1">You're all caught up!</p>
                </div>
              ) : (
                tasks.map((task, i) => (
                  <div 
                    key={task.id} 
                    onClick={() => {
                      setSelectedTask(task);
                      setEditFormData({ title: task.title, description: task.description, scheduled_at: task.scheduled_at, completed: task.completed });
                      setIsModalOpen(true);
                    }}
                    className="p-6 rounded-[24px] border-2 border-transparent hover:border-[#699361]/20 hover:bg-emerald-50/30 transition-all cursor-pointer bg-slate-50 flex items-center justify-between group shadow-sm"
                  >
                    <div className="flex-1 pr-4">
                      <h4 className="font-black text-slate-800 uppercase tracking-wide text-sm">{task.title}</h4>
                      <p className="text-xs font-bold text-slate-400 mt-1 line-clamp-1">{task.description}</p>
                      <p className="text-[10px] font-black text-[#699361] uppercase tracking-wider mt-3 group-hover:text-[#1B4A2E] transition-colors">Process →</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-2xl font-black text-slate-800">{String(i + 1 + (page - 1) * 5).padStart(2, '0')}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Tasks</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Modal */}
      {isModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
              <h3 className="font-bold text-lg dark:text-white flex items-center"><Edit2 size={18} className="mr-2" /> Edit Task</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateTask} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input 
                  required
                  type="text" 
                  value={editFormData.title} 
                  onChange={e => setEditFormData({...editFormData, title: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all dark:text-white outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea 
                  value={editFormData.description} 
                  onChange={e => setEditFormData({...editFormData, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all dark:text-white outline-none min-h-[100px] resize-none" 
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Schedule Date</label>
                  <input 
                    type="date" 
                    value={editFormData.scheduled_at ? editFormData.scheduled_at.split('T')[0] : ''} 
                    onChange={e => setEditFormData({...editFormData, scheduled_at: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all dark:text-white outline-none color-scheme-light dark:color-scheme-dark" 
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:border-emerald-500 transition-all">
                    <input 
                      type="checkbox" 
                      checked={editFormData.completed === 1}
                      onChange={e => setEditFormData({...editFormData, completed: e.target.checked ? 1 : 0})}
                      className="w-5 h-5 rounded text-emerald-500 focus:ring-emerald-500 accent-emerald-500"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Completed</span>
                  </label>
                </div>
              </div>
              
              <div className="pt-4 mt-6 border-t border-slate-100 dark:border-slate-700/50 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-lg shadow-indigo-500/30">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
