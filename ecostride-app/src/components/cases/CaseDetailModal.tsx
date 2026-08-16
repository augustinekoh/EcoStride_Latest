import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMapStore } from '../../stores/useMapStore';
import { useDemoStore } from '../../stores/useDemoStore';
import { apiClient, getApiBaseUrl } from '../../lib/api';
import { formatLocation } from '../../lib/locationData';
import { X, Send, Camera, Clock, Info, ChevronLeft, ChevronRight, MessageSquare, User, MapPin, CheckCircle, ShieldCheck, ImagePlus, Loader2 } from 'lucide-react';
import { compressImage } from '../../lib/imageUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  issue: any;
  onUpdate?: (updatedIssue: any) => void;
}

export const CaseDetailModal: React.FC<Props> = ({ isOpen, onClose, issue }) => {
  const { user } = useAuthStore();
  const { setFlyToLocation } = useMapStore();
  const { setActiveView } = useDemoStore();
  
  // Data states
  const [messages, setMessages] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  
  // UI states
  const [showChat, setShowChat] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [expandedTimeline, setExpandedTimeline] = useState(false);
  
  // Chat states
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Parse photos safely
  let photos: string[] = [];
  try {
    if (issue.photos) photos = typeof issue.photos === 'string' ? JSON.parse(issue.photos) : issue.photos;
  } catch(e) {}

  const isResolved = issue.status === 'resolved';

  // Fetch Timeline
  useEffect(() => {
    if (!isOpen) return;
    const fetchDetails = async () => {
      try {
        setIsLoadingTimeline(true);
        const res = await apiClient(`/issues/${issue.id}/timeline`);
        if (res.timeline) {
          setTimeline(res.timeline);
        }
      } catch (err) {
        console.error("Failed to fetch timeline", err);
      } finally {
        setIsLoadingTimeline(false);
      }
    };
    fetchDetails();
  }, [isOpen, issue.id]);

  // Fetch Chat Messages and handle WebSocket
  useEffect(() => {
    if (!showChat) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let isMounted = true;
    
    const connectChat = async () => {
      try {
        setIsLoadingMessages(true);
        // Load history first
        const res = await apiClient(`/issues/${issue.id}/messages`);
        if (res.messages && isMounted) {
          setMessages(res.messages);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      } catch (err) {
        console.error("Failed to fetch issue messages", err);
      } finally {
        if (isMounted) setIsLoadingMessages(false);
      }

      if (!isMounted) return;

      try {
        const token = await user?.getIdToken();
        const apiBase = getApiBaseUrl();
        const wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '');
        const wsUrl = `${wsBase}/api/issues/${issue.id}/chat?wsToken=${encodeURIComponent(token || '')}`;
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'message' && isMounted) {
               setMessages(prev => {
                  if (prev.some(m => m.id === data.message.id || (m.tempId && m.tempId === data.message.tempId))) {
                    return prev.map(m => (m.tempId === data.message.tempId ? data.message : m));
                  }
                  return [...prev, data.message];
               });
               setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }
          } catch(e) {}
        };
      } catch (err) {
        console.error("Failed to connect websocket", err);
      }
    };

    connectChat();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [showChat, issue.id, user]);

  const handleSendMessage = async (e?: React.FormEvent, uploadedImageUrl?: string) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !uploadedImageUrl) return;

    const currentInput = inputText.trim();
    const tempId = `temp-${Date.now()}`;
    
    const optimisticMsg = {
      id: tempId,
      tempId: tempId,
      issue_id: issue.id,
      sender_id: user?.uid,
      content: currentInput,
      image_url: uploadedImageUrl || null,
      created_at: new Date().toISOString(),
      sender_name: 'You'
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    setInputText('');
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'message', 
        content: currentInput, 
        imageUrl: uploadedImageUrl || null,
        tempId: tempId 
      }));
    } else {
      setMessages(prev => prev.filter(m => m.tempId !== tempId));
      alert("Chat connection lost. Please reopen the conversation.");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const compressedFile = await compressImage(file, 1200, 1200, 0.8);
      const formData = new FormData();
      formData.append('file', compressedFile);

      const uploadRes = await apiClient('/issues/images', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.success || !uploadRes.url) {
        throw new Error(uploadRes.error || 'Failed to upload photo');
      }

      await handleSendMessage(undefined, uploadRes.url);
    } catch (err: any) {
      alert(`Upload failed: ${err.message || 'Error uploading image'}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Background overlay click to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      {/* Main Responsive Dialog */}
      <div className="w-full sm:max-w-xl h-[92dvh] sm:h-[88vh] max-h-[92dvh] sm:max-h-[88vh] bg-[#f8faf9] dark:bg-slate-900 rounded-t-[28px] sm:rounded-[32px] shadow-2xl flex flex-col relative overflow-hidden border-t sm:border border-white/60 dark:border-white/10">
        
        {/* Mobile top drag pill */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {!showChat ? (
          /* Case Details View */
          <div className="flex-1 flex flex-col overflow-hidden relative">
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shrink-0 z-10">
              <div>
                <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 tracking-wider uppercase">
                  Case #{issue.id.substring(0, 8)}
                </span>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate max-w-[240px] sm:max-w-sm">
                  {issue.title}
                </h2>
              </div>
              <button 
                onClick={onClose} 
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
              
              {/* Status & Handler Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Status</span>
                  <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    issue.status === 'resolved' ? 'bg-green-100 text-green-700 border border-green-200' :
                    issue.status === 'in-progress' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                    'bg-amber-100 text-amber-700 border border-amber-200'
                  }`}>
                    {issue.status === 'resolved' ? <CheckCircle size={12}/> : <Clock size={12}/>}
                    <span>{issue.status}</span>
                  </div>
                </div>

                <div className="bg-white/80 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Handled By</span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                    <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                    <span className="truncate">{issue.authority_username || 'Pending Assignment'}</span>
                  </div>
                </div>
              </div>

              {/* Photos Gallery */}
              {photos.length > 0 && (
                <div className="bg-white/80 dark:bg-slate-800/80 rounded-2xl p-2 border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden relative">
                  <div className="aspect-[16/10] sm:aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 relative shadow-inner">
                    <img 
                      src={photos[activePhotoIndex]} 
                      alt={`Photo ${activePhotoIndex + 1}`} 
                      className="w-full h-full object-cover"
                    />
                    
                    {photos.length > 1 && (
                      <>
                        <button 
                          onClick={() => setActivePhotoIndex(prev => (prev === 0 ? photos.length - 1 : prev - 1))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/90 shadow-md text-slate-800 dark:text-white"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button 
                          onClick={() => setActivePhotoIndex(prev => (prev === photos.length - 1 ? 0 : prev + 1))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/90 shadow-md text-slate-800 dark:text-white"
                        >
                          <ChevronRight size={16} />
                        </button>
                        <div className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-lg text-[10px] font-black text-white">
                          {activePhotoIndex + 1} / {photos.length}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Description Card */}
              <div className="bg-white/80 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <h3 className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-1.5">Description</h3>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                  {issue.description || 'No description provided.'}
                </p>
              </div>

              {/* Location Card */}
              {!isResolved && (
                <div 
                  className="bg-white/80 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-start gap-3 cursor-pointer hover:border-emerald-500/50 transition-colors group"
                  onClick={() => {
                    setFlyToLocation([issue.lng, issue.lat]);
                    setActiveView('map');
                    onClose();
                  }}
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <MapPin size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-0.5">Location</h3>
                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                      {formatLocation(issue.city, issue.state, issue.country, issue.specific_location)}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {issue.lat.toFixed(5)}, {issue.lng.toFixed(5)}
                    </p>
                  </div>
                </div>
              )}

              {/* Timeline Card */}
              <div className="bg-white/80 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <h3 className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-3">Report Activity</h3>
                
                {isLoadingTimeline ? (
                  <div className="flex justify-center p-3"><Loader2 size={18} className="animate-spin text-emerald-700" /></div>
                ) : timeline.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No activity recorded yet.</p>
                ) : (
                  <div className="relative pl-4 border-l-2 border-emerald-100 dark:border-emerald-950 space-y-3">
                    {(expandedTimeline ? timeline : timeline.slice(0, 2)).map((event, idx) => {
                      const isActive = idx === 0;
                      return (
                        <div key={event.id} className="relative text-xs">
                          <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                            isActive ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                          }`} />
                          <h4 className="font-bold text-slate-900 dark:text-white">{event.title}</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{event.description}</p>
                          <span className="text-[9px] text-slate-400 font-medium block mt-1">
                            {new Date(event.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isLoadingTimeline && timeline.length > 2 && (
                  <button 
                    onClick={() => setExpandedTimeline(!expandedTimeline)}
                    className="mt-3 w-full py-1.5 bg-slate-100 dark:bg-slate-700/50 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    {expandedTimeline ? 'Show Less' : 'View Full History'}
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div className="p-4 bg-white/90 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button 
                onClick={() => setShowChat(true)}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-md hover:shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <MessageSquare size={16} />
                <span>{isResolved ? 'View Conversation' : 'Open Conversation'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Conversation Chat Screen (Responsive Mobile + Laptop) */
          <div className="flex-1 flex flex-col overflow-hidden relative">
            
            {/* Chat Sticky Header */}
            <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl shrink-0 z-20">
              <button 
                onClick={() => setShowChat(false)} 
                className="flex items-center gap-1 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-800 px-2.5 py-1.5 rounded-xl text-xs font-black transition-colors"
              >
                <ChevronLeft size={18} />
                <span>Details</span>
              </button>

              <div className="text-center">
                <h3 className="font-black text-slate-900 dark:text-white text-xs sm:text-sm uppercase tracking-tight">
                  Case #{issue.id.substring(0, 8)}
                </h3>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block -mt-0.5">
                  {issue.authority_username ? `Authority: ${issue.authority_username}` : 'City Authority'}
                </span>
              </div>

              <button 
                onClick={onClose} 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Chat Scrollable Message Body */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3 custom-scrollbar flex flex-col">
              
              {/* Informational connection badge */}
              <div className="mx-auto my-1 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm max-w-xs text-center">
                <Info size={13} className="text-emerald-600 shrink-0" />
                <span>Official communications channel with City Authority</span>
              </div>

              {isLoadingMessages && messages.length === 0 ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-emerald-700" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-10">
                  No messages yet. Send a message to get an update on your report.
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.sender_id === user?.uid;
                  return (
                    <div key={idx} className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isMe ? 'self-end' : 'self-start'}`}>
                      <div className={`text-[10px] font-bold text-slate-400 mb-0.5 px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                        {isMe ? 'You' : msg.sender_name || 'Authority'}
                      </div>
                      
                      <div className={`rounded-2xl p-3 sm:p-3.5 shadow-sm text-xs sm:text-sm leading-relaxed ${
                        isMe 
                          ? 'bg-emerald-700 text-white rounded-tr-xs' 
                          : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-700/80 rounded-tl-xs'
                      }`}>
                        {msg.image_url && (
                          <img 
                            src={msg.image_url} 
                            alt="Attached" 
                            className="max-w-full max-h-56 rounded-xl mb-2 object-cover border border-black/10 cursor-pointer hover:opacity-95" 
                            onClick={() => window.open(msg.image_url, '_blank')} 
                          />
                        )}
                        {msg.content && <p className="whitespace-pre-wrap font-medium">{msg.content}</p>}
                      </div>
                      
                      <span className={`text-[9px] font-bold text-slate-400 mt-0.5 px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Sticky Bottom Input Bar */}
            <div className="p-2.5 sm:p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <label className={`shrink-0 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200 transition-colors shadow-sm ${isUploading ? 'opacity-50 pointer-events-none' : 'active:scale-95'}`}>
                  {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                </label>
                
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  value={inputText} 
                  onChange={(e) => setInputText(e.target.value)} 
                  className="flex-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400" 
                  disabled={isUploading} 
                />
                
                <button 
                  type="submit" 
                  disabled={(!inputText.trim() && !isUploading) || isUploading} 
                  className="shrink-0 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white rounded-2xl shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={16} className="ml-0.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
