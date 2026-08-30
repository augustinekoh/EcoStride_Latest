import React, { useState, useEffect, useRef } from 'react';
import { X, Send, RefreshCw, AlertCircle, Sparkles, FileText, ChevronRight, Clock, User } from 'lucide-react';
import { useCopilotSession } from '../hooks/useCopilotSession';
import type { CopilotMessage } from '../hooks/useCopilotSession';
import { useCopilotWebSocket } from '../hooks/useCopilotWebSocket';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
interface ChatWidgetProps {
  sessionId: string;
  onClose: () => void;
  reportIds?: string[];
  reports?: any[];
  initialMessages?: CopilotMessage[];
}

export const AuthorityCopilotChatWidget: React.FC<ChatWidgetProps> = ({ 
  sessionId, 
  onClose, 
  reportIds = [], 
  reports = [],
  initialMessages = [] 
}) => {
  const { getSocketTicket } = useCopilotSession();
  const { status, messages, errorDetails, connect, disconnect, sendMessage, isProcessing } = useCopilotWebSocket(sessionId, initialMessages);
  
  const [input, setInput] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const establishConnection = async () => {
    try {
      const { ticket } = await getSocketTicket(sessionId);
      const isResume = initialMessages.length > 0 || messages.length > 0;
      connect(ticket, isResume, reportIds);
    } catch (e: any) {
      console.error("Failed to get ticket:", e);
    }
  };

  useEffect(() => {
    establishConnection();
    
    const handleReconnectEvent = (e: any) => {
      if (e.detail?.sessionId === sessionId) {
        establishConnection(); // re-fetch ticket and connect
      }
    };
    
    window.addEventListener('copilot_reconnect_needed', handleReconnectEvent);
    return () => {
      disconnect();
      window.removeEventListener('copilot_reconnect_needed', handleReconnectEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== 'connected') return;
    sendMessage(input.trim());
    setInput('');
  };

  const containerClasses = "fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-white to-[#F4FCE3] overflow-hidden transition-all duration-300";

  return (
    <div className={containerClasses}>
      {/* Subtle Abstract Background Forms */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-white rounded-full blur-[80px] opacity-60"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-[#EAF7D1] rounded-full blur-[100px] opacity-40"></div>
      </div>

      {/* Floating Header */}
      <div className="absolute top-4 left-4 right-4 z-20">
        <div className="flex items-center justify-between px-5 py-4 bg-white/60 backdrop-blur-2xl border border-white/80 rounded-3xl shadow-[0_8px_32px_rgba(197,240,79,0.15)]">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-white/80 flex items-center justify-center border border-[#C5F04F]/50 shadow-sm text-lg text-[#C5F04F]">
                <Sparkles size={22} className={status === 'connected' ? 'animate-pulse' : 'opacity-50'} fill="currentColor" />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${status === 'connected' ? 'bg-[#C5F04F] shadow-[0_0_12px_rgba(197,240,79,0.8)]' : status === 'error' || status === 'disconnected' ? 'bg-red-500' : 'bg-[#C8942A]'}`}></div>
            </div>
            <div className="flex flex-col justify-center">
              <h3 className="font-black text-[17px] leading-tight tracking-tight text-[#174F35]">Civic Intelligence Copilot</h3>
              {status !== 'connected' && (
                <p className="text-[11px] font-bold text-[#4A6B53]/80 uppercase tracking-widest mt-0.5">
                  {status === 'reconnecting' ? 'Reconnecting...' : status === 'error' ? 'Connection Error' : 'Connecting...'}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-white/40 hover:bg-white/80 text-[#174F35] rounded-full transition-colors border border-white/30 shadow-sm">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Connection Status Banner (if error) */}
      {status === 'error' && (
        <div className="absolute top-24 left-4 right-4 z-20 bg-rose-500/10 backdrop-blur-md p-3 text-xs text-rose-600 flex items-center gap-2 border border-rose-500/20 rounded-2xl shadow-sm font-bold">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1 truncate">{errorDetails}</span>
          <button onClick={establishConnection} className="bg-rose-500 text-white px-3 py-1.5 rounded-full uppercase tracking-wider text-[10px] shadow-sm active:scale-95 transition-transform">Retry</button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto pt-28 pb-32 px-4 md:px-6 flex flex-col gap-6 relative z-10 w-full h-full">
        {/* Selected Reports Context Section */}
        {((reportIds && reportIds.length > 0) || (reports && reports.length > 0)) && (
          <div className="self-center w-full max-w-2xl bg-[#E3F0E8]/60 backdrop-blur-xl border border-[#C8E0D2] rounded-3xl p-4 md:p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-[#C8E0D2]/60">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#2E8B57]" />
                <span className="text-xs font-black uppercase tracking-wider text-[#174F35]">
                  Investigation Reports ({reports.length > 0 ? reports.length : reportIds.length})
                </span>
              </div>
              <span className="text-[11px] font-bold text-[#4A6B53]">
                #{reportIds.length > 0 ? reportIds.join(', #') : reports.map(r => r.id).join(', #')}
              </span>
            </div>

            {reports && reports.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {reports.map((r) => {
                  let photos: string[] = [];
                  try {
                    if (r.photos && typeof r.photos === 'string') photos = JSON.parse(r.photos);
                    else if (Array.isArray(r.photos)) photos = r.photos;
                  } catch (e) {}
                  const cover = photos.length > 0 ? photos[0] : null;

                  return (
                    <div key={r.id} className="bg-white/90 rounded-2xl p-3 border border-white shadow-sm flex items-start gap-3 text-left">
                      {cover ? (
                        <img src={cover} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-100 shadow-sm" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#EAF0EC] flex items-center justify-center text-[#738F7C] shrink-0">
                          <FileText size={20} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#EAF0EC] text-[#1E432B]">#{r.id}</span>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                            r.severity === 'Critical' ? 'bg-rose-100 text-rose-700' :
                            r.severity === 'Major' ? 'bg-amber-100 text-amber-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>{r.severity}</span>
                          <span className="text-[9px] font-bold text-[#738F7C] capitalize ml-auto">{r.status}</span>
                        </div>
                        <h4 className="text-[13px] font-bold text-[#1E432B] truncate" title={r.title}>{r.title}</h4>
                        {r.author_username && (
                          <p className="text-[11px] text-[#738F7C] truncate mt-0.5 flex items-center gap-1">
                            <User size={10} /> {r.author_username}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 justify-center py-1">
                {reportIds.map(id => (
                  <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-[#C8E0D2] text-[#1E432B] text-xs font-black shadow-sm">
                    <FileText size={12} className="text-[#2E8B57]" /> Report #{id}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`max-w-[88%] md:max-w-[75%] flex flex-col ${msg.sender_role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
            <div className={`p-4 md:p-5 text-[15px] leading-relaxed shadow-[0_8px_24px_rgba(23,79,53,0.04)] backdrop-blur-xl border overflow-hidden max-w-full ${
              msg.sender_role === 'user' 
                ? 'bg-[#E3F0E8]/70 border-white/60 text-[#174F35] rounded-3xl rounded-tr-sm' 
                : 'bg-white/80 border-white/70 text-[#183D2A] rounded-3xl rounded-tl-sm'
            }`}>
              {msg.sender_role === 'user' ? (
                <div className="whitespace-pre-wrap font-medium break-words">{msg.content}</div>
              ) : (
                <div className="font-medium text-[#183D2A] break-words">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h3: ({node, ...props}) => <h3 className="text-[16px] font-black mt-4 mb-2 text-[#174F35]" {...props} />,
                      h4: ({node, ...props}) => <h4 className="text-[15px] font-black mt-3 mb-1 text-[#174F35]" {...props} />,
                      p: ({node, ...props}) => <p className="mb-3 leading-relaxed last:mb-0" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
                      li: ({node, ...props}) => <li className="pl-1" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-black text-[#0f3624]" {...props} />,
                      table: ({node, ...props}) => <div className="overflow-x-auto max-w-full my-4"><table className="w-full text-left border-collapse text-sm" {...props} /></div>,
                      thead: ({node, ...props}) => <thead className="border-b-2 border-[#174F35]/20 bg-[#F4FCE3]/50" {...props} />,
                      th: ({node, ...props}) => <th className="p-2.5 font-bold text-[#174F35] whitespace-nowrap" {...props} />,
                      td: ({node, ...props}) => <td className="p-2.5 border-b border-[#174F35]/10 align-top" {...props} />,
                      tr: ({node, ...props}) => <tr className="hover:bg-[#F4FCE3]/30 transition-colors" {...props} />,
                      pre: ({node, ...props}) => <pre className="overflow-x-auto max-w-full p-3 bg-white/50 rounded-xl text-xs my-3" {...props} />,
                      code: ({node, className, children, ...props}) => {
                        const match = /language-(\w+)/.exec(className || '');
                        return !match ? (
                          <code className="break-words bg-[#C5F04F]/20 text-[#174F35] px-1.5 py-0.5 rounded text-[13px]" {...props}>{children}</code>
                        ) : (
                          <code className="block w-fit min-w-full" {...props}>{children}</code>
                        );
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            <div className={`text-[10px] font-bold mt-2 uppercase tracking-widest ${msg.sender_role === 'user' ? 'text-[#718278] mr-2' : 'text-[#9BB3A3] ml-2'}`}>
              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
          </div>
        ))}
        
        {isProcessing && (
          <div className="max-w-[88%] md:max-w-[75%] flex flex-col self-start items-start">
            <div className="p-4 md:p-5 text-[15px] bg-white/80 border border-white/70 rounded-3xl rounded-tl-sm shadow-[0_8px_24px_rgba(23,79,53,0.04)] backdrop-blur-xl flex items-center gap-2">
              <Sparkles size={16} className="text-[#9BB3A3] animate-pulse shrink-0" />
              <span className="font-bold text-[#738F7C] text-sm animate-pulse">
                Copilot is {isProcessing === 'analyzing' ? 'analyzing' : 'thinking'}...
              </span>
            </div>
          </div>
        )}

        {status !== 'connected' && status !== 'error' && status !== 'disconnected' && (
          <div className="flex justify-center p-6">
            <RefreshCw size={24} className="animate-spin text-[#9BB3A3]" />
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Floating Input Bar */}
      <div className="absolute bottom-6 left-4 right-4 z-20">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-1.5 bg-white/60 backdrop-blur-2xl border border-white/60 rounded-full shadow-[0_12px_40px_rgba(23,79,53,0.08)]">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={status !== 'connected'}
            placeholder={status === 'connected' ? 'Message Copilot...' : 'Establishing Secure Link...'}
            className="flex-1 bg-transparent pl-6 pr-3 py-3.5 text-[16px] text-[#174F35] focus:outline-none placeholder:text-[#8BA394] placeholder:font-medium font-medium"
          />
          <button
            type="submit"
            disabled={status !== 'connected' || !input.trim()}
            className={`w-12 h-12 flex items-center justify-center rounded-full shrink-0 transition-all ${
              status === 'connected' && input.trim() 
                ? 'bg-white/90 border border-white shadow-[0_4px_12px_rgba(52,211,153,0.2)] text-[#34D399] hover:scale-105 active:scale-95' 
                : 'bg-white/40 text-[#9BB3A3] cursor-not-allowed'
            }`}
          >
            <Send size={18} className={status === 'connected' && input.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''} />
          </button>
        </form>
      </div>
    </div>
  );
};
