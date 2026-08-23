import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useMapStore } from '../../../stores/useMapStore';
import { useNavigate } from 'react-router-dom';
import { apiClient, getApiBaseUrl, resolveImageUrl } from '../../../lib/api';
import { formatLocation } from '../../../lib/locationData';
import { X, Send, Camera, Clock, Info, RefreshCw, User, MapPin, ChevronLeft, ChevronRight, ImageOff, Plus, FileText, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { compressImage } from '../../../lib/imageUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  issue: any;
  onRefresh: () => void;
}

export const AuthorityIssueDetailModal: React.FC<Props> = ({ isOpen, onClose, issue, onRefresh }) => {
  const { user } = useAuthStore();
  const { setFlyToLocation } = useMapStore();
  const navigate = useNavigate();

  // Chat states
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Timeline states
  const [timeline, setTimeline] = useState<any[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true);
  const [expandedTimeline, setExpandedTimeline] = useState(false);
  const [taskUpdateText, setTaskUpdateText] = useState('');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Photo states
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [activePhotoIndex, issue.id]);

  const fetchTimeline = async () => {
    if (!isOpen) return;
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

  useEffect(() => {
    fetchTimeline();
  }, [isOpen, issue.id]);

  // Fetch Chat Messages and handle WebSocket
  useEffect(() => {
    if (!showChat || !isOpen) {
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

        // Mark as read in the background
        apiClient(`/issues/${issue.id}/read`, { method: 'POST' }).catch(() => { });
      } catch (err) {
        console.error("Failed to fetch issue messages", err);
      } finally {
        if (isMounted) setIsLoadingMessages(false);
      }

      if (!isMounted) return;

      try {
        const token = await user?.getIdToken();
        const apiBase = getApiBaseUrl();
        // Derive WebSocket URL from the API base URL
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
                  // Reconcile optimistic message
                  return prev.map(m => (m.tempId === data.message.tempId ? data.message : m));
                }
                return [...prev, data.message];
              });
              setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }
          } catch (e) { }
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
  }, [isOpen, showChat, issue.id, user]);

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
      sender_name: 'You (Authority)'
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
      // Reconcile if socket is closed
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

  const handleClaim = async () => {
    try {
      await apiClient(`/authorities/issues/${issue.id}/claim`, { method: 'PATCH' });
      onRefresh();
      onClose();
    } catch (err) {
      alert("Failed to claim issue");
    }
  };

  const handleUnclaim = async () => {
    if (!window.confirm("Are you sure you want to unclaim this issue? It will be returned to the pending queue for other authorities to claim.")) return;
    try {
      await apiClient(`/authorities/issues/${issue.id}/unclaim`, { method: 'PATCH' });
      onRefresh();
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to unclaim issue");
    }
  };

  const [showTakeDownModal, setShowTakeDownModal] = useState(false);
  const [isTakingDown, setIsTakingDown] = useState(false);
  const [takeDownReason, setTakeDownReason] = useState("");

  const handleTakeDown = async () => {
    setIsTakingDown(true);
    try {
      await apiClient(`/authorities/issues/${issue.id}/take-down`, {
        method: 'POST',
        body: JSON.stringify({ reason: takeDownReason })
      });
      setShowTakeDownModal(false);
      onRefresh();
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to take down issue");
    } finally {
      setIsTakingDown(false);
    }
  };

  const handleResolve = async () => {
    try {
      await apiClient(`/authorities/issues/${issue.id}/resolve`, {
        method: 'PATCH'
      });
      onRefresh();
      onClose();
    } catch (err) {
      alert("Failed to resolve issue");
    }
  };

  const handleSubmitTaskUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskUpdateText.trim()) return;

    setIsSubmittingTask(true);
    try {
      await apiClient(`/authorities/issues/${issue.id}/updates`, {
        method: 'POST',
        body: JSON.stringify({ description: taskUpdateText.trim() })
      });
      setTaskUpdateText('');
      fetchTimeline();
    } catch (err) {
      console.error("Failed to submit update", err);
      alert("Failed to submit task update.");
    } finally {
      setIsSubmittingTask(false);
    }
  };

  if (!isOpen) return null;

  let photos: string[] = [];
  try {
    if (issue.photos && typeof issue.photos === 'string') {
      photos = JSON.parse(issue.photos);
    } else if (Array.isArray(issue.photos)) {
      photos = issue.photos;
    }
  } catch (e) { }

  const isReadOnly = issue.status === 'resolved' || issue.takedown_status === 'taken-down';
  const canPostUpdates = issue.status === 'in-progress' && issue.authority_id === user?.uid && !isReadOnly;

  const modalContent = (
    <div className="fixed inset-0 z-[150] flex flex-col md:items-center md:justify-center bg-slate-900/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full h-[100dvh] md:h-auto md:max-w-2xl md:max-h-[90vh] overflow-hidden flex flex-col md:rounded-3xl shadow-2xl relative">

        {/* Header Area */}
        <div className="p-6 pb-4 flex flex-col shrink-0 border-b border-slate-100 relative">
          <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition-colors">
            <X size={20} />
          </button>

          <span className="text-slate-400 text-sm font-semibold tracking-wide">Report #{issue.id.toUpperCase()}</span>
          <h2 className="text-slate-800 font-bold text-2xl mt-1 leading-tight pr-10">{issue.title}</h2>

          {/* Status & Date */}
          <div className="flex items-center gap-4 mt-4">
            <div 
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                issue.takedown_status === 'taken-down' ? 'bg-red-100 text-red-800' :
                issue.takedown_status === 'requested' ? 'bg-orange-100 text-orange-800' :
                issue.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                issue.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                'bg-slate-100 text-slate-800'
              }`}
              title={issue.takedown_reason ? `Reason: ${issue.takedown_reason}` : ''}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                issue.takedown_status === 'taken-down' ? 'bg-red-500' :
                issue.takedown_status === 'requested' ? 'bg-orange-500' :
                issue.status === 'resolved' ? 'bg-emerald-500' :
                issue.status === 'in-progress' ? 'bg-blue-500' :
                'bg-slate-500'
              }`}></span>
              {issue.takedown_status === 'taken-down' ? 'Taken Down' : issue.takedown_status === 'requested' ? 'Takedown Requested' : issue.status === 'pending' ? 'Pending' : issue.status}
            </div>

            <div className="text-[13px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Clock size={14} />
              {new Date(issue.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6 md:gap-8 bg-slate-50/50 pb-24 md:pb-6">

          {/* Takedown Request Banner */}
          {issue.takedown_status === 'requested' && (
            <div className="bg-orange-50 border border-orange-200 rounded-[20px] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-orange-900 font-bold text-base mb-1">User Takedown Request</h3>
                  <p className="text-sm text-orange-800/80 mb-4">
                    The user requested to take down this issue. Reason: <span className="font-semibold text-orange-900">{issue.takedown_reason || 'No reason provided'}</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!window.confirm("Approve the user's takedown request?")) return;
                        const res = await fetch(`${getApiBaseUrl()}/authorities/issues/${issue.id}/approve-takedown`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${await user?.getIdToken()}` }
                        }).then(r => r.json());
                        if (res.success) {
                          onRefresh();
                          alert("Takedown approved.");
                          onClose();
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-5 rounded-xl transition-colors shadow-sm"
                    >
                      Approve Takedown
                    </button>
                    <button
                      onClick={async () => {
                        const reason = window.prompt("Reason for rejecting takedown:");
                        if (reason === null) return;
                        const res = await fetch(`${getApiBaseUrl()}/authorities/issues/${issue.id}/reject-takedown`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await user?.getIdToken()}` },
                          body: JSON.stringify({ reason })
                        }).then(r => r.json());
                        if (res.success) {
                          onRefresh();
                          alert("Takedown rejected.");
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2 px-5 rounded-xl transition-colors shadow-sm"
                    >
                      Reject Request
                    </button>
                  </div>
                </div>
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} className="text-orange-600" />
                </div>
              </div>
            </div>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Attached Photos</h3>
              <div className="w-full relative group bg-slate-100 rounded-[20px] aspect-video flex items-center justify-center border border-slate-200/60 overflow-hidden">
                {!imageError ? (
                  <img
                    src={resolveImageUrl(photos[activePhotoIndex])}
                    alt="Report attachment"
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => window.open(resolveImageUrl(photos[activePhotoIndex]), '_blank')}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                    <ImageOff size={32} className="opacity-50" />
                    <span className="text-sm font-medium">Image unavailable</span>
                  </div>
                )}

                {photos.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActivePhotoIndex(prev => (prev - 1 + photos.length) % photos.length); }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 backdrop-blur shadow-sm rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:scale-105 transition-all border border-slate-200"
                    >
                      <ChevronLeft size={20} className="-ml-0.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActivePhotoIndex(prev => (prev + 1) % photos.length); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 backdrop-blur shadow-sm rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:scale-105 transition-all border border-slate-200"
                    >
                      <ChevronRight size={20} className="-mr-0.5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-full font-bold tracking-wide pointer-events-none">
                      {activePhotoIndex + 1} / {photos.length}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Problem Description</h3>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-slate-700 text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {issue.description || 'No description provided.'}
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Reported By</h3>
              <div className="flex items-center gap-3">
                {issue.author_avatar ? (
                  <img src={issue.author_avatar} alt="" className="w-9 h-9 rounded-full object-cover bg-slate-200 shadow-sm border border-slate-100" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
                    <User size={16} />
                  </div>
                )}
                <span className="font-semibold text-slate-700 text-sm">{issue.author_username || 'Unknown Citizen'}</span>
              </div>
            </div>

            {!isReadOnly && (
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Location</h3>
                <div
                  className="flex items-start gap-2 text-slate-700 font-medium text-sm cursor-pointer hover:text-[#1B4A2E] transition-colors"
                  onClick={() => {
                    setFlyToLocation([issue.lng, issue.lat]);
                    navigate('/authorities/map');
                    onClose();
                  }}
                >
                  <MapPin size={18} className="text-slate-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-slate-800">{formatLocation(issue.city, issue.state, issue.country, issue.specific_location)}</span>
                    <span className="text-slate-400 text-xs font-mono">GPS: {issue.lat.toFixed(6)}, {issue.lng.toFixed(6)}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                {issue.status === 'resolved' ? 'Resolved By' : 'Assigned Authority'}
              </h3>
              <div className="flex items-center gap-3">
                {issue.authority_username ? (
                  <>
                    <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                      <User size={16} />
                    </div>
                    <span className="font-semibold text-slate-700 text-sm">{issue.authority_username}</span>
                  </>
                ) : (
                  <span className="font-semibold text-slate-400 text-sm italic">Unassigned</span>
                )}
              </div>
            </div>
          </div>

          {/* Timeline & Task Updates */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Timeline & Updates</h3>

            {canPostUpdates && (
              <form onSubmit={handleSubmitTaskUpdate} className="mb-6">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a task update or progress note..."
                    value={taskUpdateText}
                    onChange={e => setTaskUpdateText(e.target.value)}
                    disabled={isSubmittingTask}
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1B4A2E] focus:bg-white transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!taskUpdateText.trim() || isSubmittingTask}
                    className="shrink-0 bg-[#1B4A2E] text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-[#123620] disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} /> Update
                  </button>
                </div>
              </form>
            )}

            {isLoadingTimeline ? (
              <div className="flex justify-center p-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1B4A2E]"></div></div>
            ) : timeline.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No activity recorded yet.</p>
            ) : (
              <div className="relative pl-3 border-l-2 border-slate-100 flex flex-col gap-5">
                {(expandedTimeline ? timeline : timeline.slice(0, 3)).map((event, idx) => (
                  <div key={event.id} className="relative">
                    <div className={`absolute -left-[17px] top-1 w-3 h-3 rounded-full border-2 border-white ${idx === 0 ? 'bg-[#1B4A2E]' : 'bg-slate-300'
                      }`} />

                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      {event.title}
                      {event.activity_type === 'TASK_UPDATE' && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] uppercase tracking-wider font-bold">Update</span>}
                    </h4>
                    <p className="text-sm text-slate-600 font-medium mt-0.5 mb-1">{event.description}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <span>{new Date(event.created_at).toLocaleDateString()} at {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {event.actor_username && (
                        <>
                          <span>•</span>
                          <span className="text-slate-500">{event.actor_username}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoadingTimeline && timeline.length > 3 && (
              <button
                onClick={() => setExpandedTimeline(!expandedTimeline)}
                className="mt-5 w-full py-2 bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors"
              >
                {expandedTimeline ? 'Show Less' : `View all ${timeline.length} events`}
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0 flex flex-col gap-3 mt-auto sticky bottom-0 z-20 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!showChat ? (
            <>
              {issue.status === 'in-progress' && issue.authority_id !== user?.uid && (
                <div className="text-sm font-semibold text-slate-500 italic text-center w-full pb-1">
                  Claimed by another authority
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                {issue.status === 'pending' && issue.takedown_status !== 'taken-down' ? (
                  <button
                    onClick={handleClaim}
                    className="w-full bg-[#1B4A2E] hover:bg-[#123620] text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-sm flex-1"
                  >
                    Claim Issue
                  </button>
                ) : null}
                {issue.status === 'in-progress' && issue.authority_id === user?.uid && !isReadOnly && (
                  <>
                    <button
                      onClick={() => setShowChat(true)}
                      className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition-colors shadow-sm relative flex items-center justify-center gap-2"
                    >
                      Open Conversation
                      {(issue.unread_count || 0) > 0 && (
                        <div className="absolute -top-2 -right-2 shrink-0 min-w-[20px] h-[20px] bg-rose-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10">
                          <span className="text-[10px] font-bold text-white leading-none pt-[1px] px-1">{issue.unread_count > 99 ? '99+' : issue.unread_count}</span>
                        </div>
                      )}
                    </button>
                    <button
                      onClick={handleUnclaim}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition-colors shadow-sm"
                    >
                      Unclaim
                    </button>
                    <button
                      onClick={handleResolve}
                      className="flex-1 bg-[#1B4A2E] hover:bg-[#123620] text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-sm"
                    >
                      Mark Resolved
                    </button>
                  </>
                )}
                {isReadOnly && (
                  <button
                    onClick={() => setShowChat(true)}
                    className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition-colors shadow-sm flex-1"
                  >
                    View Conversation
                  </button>
                )}
                {!isReadOnly && (
                  <button
                    onClick={() => setShowTakeDownModal(true)}
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2.5 px-4 rounded-xl transition-colors border border-red-200 shadow-sm flex items-center justify-center gap-2"
                    title="Take down this issue due to incorrect location"
                  >
                    <Trash2 size={16} />
                    <span>Take Down</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 h-[400px] w-full">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 px-2">
                <div className="flex-1 flex justify-start">
                  <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-slate-700 p-1 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1">
                    <ChevronLeft size={18} />
                    <span className="text-xs font-bold">Details</span>
                  </button>
                </div>

                <h3 className="font-bold text-slate-800 shrink-0 text-center text-sm">
                  Conversation with {issue.author_username || 'Citizen'}
                </h3>

                <div className="flex-1 flex justify-end">
                  <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-100/80 rounded-2xl p-4 flex flex-col gap-4 border border-slate-200 shadow-inner">
                {isLoadingMessages && messages.length === 0 ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1B4A2E]"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm font-medium py-6">No messages yet.</div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.sender_id === user?.uid;
                    return (
                      <div key={idx} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end' : 'self-start'}`}>
                        <div className={`text-[11px] font-semibold text-slate-400 mb-1 px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                          {isMe ? 'You (Authority)' : msg.sender_name || 'Citizen'}
                        </div>
                        <div className={`rounded-2xl p-3 shadow-sm text-sm whitespace-pre-wrap leading-relaxed ${isMe ? 'bg-[#1B4A2E] text-white rounded-tr-sm' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm'
                          }`}>
                          {msg.image_url && (
                            <img
                              src={resolveImageUrl(msg.image_url)}
                              alt="Attached"
                              className="max-w-full max-h-56 rounded-xl mb-2 object-cover border border-black/10 cursor-pointer hover:opacity-95"
                              onClick={() => window.open(resolveImageUrl(msg.image_url), '_blank')}
                            />
                          )}
                          {msg.content && <p>{msg.content}</p>}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {!isReadOnly && (
                <form onSubmit={handleSendMessage} className="flex items-center gap-2 mt-1">
                  <label className={`shrink-0 flex items-center justify-center w-10 h-10 bg-slate-100 text-[#1B4A2E] rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : 'active:scale-95'}`}>
                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                  </label>

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#1B4A2E] focus:bg-white transition-colors"
                    disabled={isUploading}
                  />
                  <button
                    type="submit"
                    disabled={(!inputText.trim() && !isUploading) || isUploading}
                    className="bg-[#1B4A2E] text-white p-2.5 rounded-xl disabled:opacity-50 hover:bg-[#123620] transition-colors shadow-sm shrink-0"
                  >
                    <Send size={18} />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Take Down Confirmation Modal */}
      {showTakeDownModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 flex flex-col gap-3 animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">Take Down Issue Report?</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                This will remove the issue report from the map and send an official notification to the reporter's mailbox.
              </p>
            </div>

            <div className="flex flex-col gap-1.5 mt-1">
              <label className="text-xs font-bold text-slate-700">Reason for take down (Optional)</label>
              <textarea
                value={takeDownReason}
                onChange={(e) => setTakeDownReason(e.target.value)}
                placeholder="e.g. Location is incorrect, issue already resolved, spam report..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all h-20"
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowTakeDownModal(false)}
                disabled={isTakingDown}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTakeDown}
                disabled={isTakingDown}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                {isTakingDown ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Confirm Take Down</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
};
