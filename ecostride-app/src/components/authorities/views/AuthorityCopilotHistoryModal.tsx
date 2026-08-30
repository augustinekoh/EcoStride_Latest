import React, { useEffect, useState } from 'react';
import { X, Clock, FileText, ChevronRight, Trash2 } from 'lucide-react';
import { useCopilotSession } from '../hooks/useCopilotSession';
import type { CopilotSession } from '../hooks/useCopilotSession';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string, initialMessages: any[], selectedReportIds?: string[]) => void;
}

export const AuthorityCopilotHistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, onSelectSession }) => {
  const { getSessionHistory, getSession, deleteSession, isFetchingHistory, isResumingSession } = useCopilotSession();
  const [sessions, setSessions] = useState<CopilotSession[]>([]);
  const [error, setError] = useState('');
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setIsEditMode(false);
      setSelectedToDelete(new Set());
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    try {
      setError('');
      const history = await getSessionHistory(20);
      setSessions(history);
    } catch (e: any) {
      setError(e.message || 'Failed to load history');
    }
  };

  const handleResume = async (sessionId: string) => {
    if (isEditMode) return;
    try {
      setError('');
      const data = await getSession(sessionId);
      onClose();
      onSelectSession(sessionId, data.messages, data.session?.selectedReportIds || []);
    } catch (e: any) {
      setError(e.message || 'Failed to resume session');
    }
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedToDelete.size} investigation(s)?`)) return;
    try {
      for (const id of Array.from(selectedToDelete)) {
        await deleteSession(id);
      }
      setIsEditMode(false);
      setSelectedToDelete(new Set());
      loadHistory();
    } catch (e: any) {
      setError(e.message || 'Failed to delete sessions');
    }
  };

  const toggleSelection = (sessionId: string) => {
    const next = new Set(selectedToDelete);
    if (next.has(sessionId)) next.delete(sessionId);
    else next.add(sessionId);
    setSelectedToDelete(next);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-[#1E432B]/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center p-6 border-b border-[#EAF0EC] shrink-0">
          <div>
            <h2 className="text-2xl font-black text-[#1E432B]">Copilot History</h2>
            <p className="text-[#738F7C] font-bold text-sm">Resume past investigations</p>
          </div>
          <div className="flex items-center gap-3">
            {sessions.length > 0 && (
              <button 
                onClick={() => { setIsEditMode(!isEditMode); setSelectedToDelete(new Set()); }}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all border ${isEditMode ? 'bg-[#1E432B] text-white border-[#1E432B]' : 'bg-white text-[#1E432B] border-[#EAF0EC] hover:border-[#34D399] hover:text-[#34D399]'}`}
              >
                {isEditMode ? 'Cancel' : 'Select'}
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-[#F3F7F4] rounded-full transition-colors">
              <X className="text-[#1E432B]" size={24} />
            </button>
          </div>
        </div>

        {isEditMode && selectedToDelete.size > 0 && (
          <div className="bg-rose-50 px-6 py-3 flex justify-between items-center border-b border-rose-100 shrink-0 shadow-inner">
            <span className="text-rose-600 font-bold text-sm tracking-wide">{selectedToDelete.size} selected for deletion</span>
            <button 
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-sm transition-all active:scale-95"
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 bg-[#F3F7F4]">
          {isFetchingHistory ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-[#34D399]"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center font-bold">
              {error}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-2xl">
              <FileText size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-[#1E432B]">No Previous Investigations</h3>
              <p className="text-[#738F7C] text-sm">You haven't started any Copilot sessions yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map(session => (
                <div
                  key={session.sessionId}
                  onClick={() => isEditMode ? toggleSelection(session.sessionId) : handleResume(session.sessionId)}
                  className={`w-full text-left p-4 rounded-[16px] transition-all border flex items-center justify-between group cursor-pointer ${
                    isResumingSession && !isEditMode ? 'opacity-50 pointer-events-none' : ''
                  } ${
                    isEditMode && selectedToDelete.has(session.sessionId) 
                      ? 'border-rose-300 bg-rose-50 shadow-sm' 
                      : 'border-transparent bg-white hover:border-[#34D399] hover:shadow-md'
                  }`}
                >
                  <div>
                    <h3 className={`font-bold mb-1 ${isEditMode && selectedToDelete.has(session.sessionId) ? 'text-rose-900' : 'text-[#1E432B]'}`}>{session.title}</h3>
                    <div className="flex items-center gap-4 text-xs font-bold text-[#9BB3A3]">
                      <span className="flex items-center gap-1"><Clock size={14} /> {new Date(session.updatedAt).toLocaleDateString()} {new Date(session.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                        isEditMode && selectedToDelete.has(session.sessionId) ? 'bg-rose-200 text-rose-700' :
                        session.status === 'active' ? 'bg-[#D1FAE5] text-[#059669]' : 'bg-gray-100 text-gray-600'
                      }`}>{session.status}</span>
                    </div>
                  </div>
                  {isEditMode ? (
                    <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${selectedToDelete.has(session.sessionId) ? 'bg-rose-500 text-white' : 'bg-gray-100 text-transparent border border-gray-200'}`}>
                      <X size={16} />
                    </div>
                  ) : (
                    <ChevronRight className="text-gray-300 group-hover:text-[#34D399] group-hover:translate-x-1 transition-all" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
