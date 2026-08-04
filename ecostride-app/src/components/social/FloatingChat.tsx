import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, User } from 'lucide-react';
import { useCommunityChat } from '../../hooks/useCommunityChat';
import { auth } from '../../firebase';
import { useDemoStore } from '../../stores/useDemoStore';
import { resolveAvatarUrl } from '../../lib/api';

interface FloatingChatProps {
  guildId: string;
}

export function FloatingChat({ guildId }: FloatingChatProps) {
  const { isChatExpanded, setIsChatExpanded } = useDemoStore();
  const [token, setToken] = useState<string | null>(null);
  
  // Dragging state
  const [position, setPosition] = useState({ x: 20, y: 110 }); // Default bottom right, moved up for nav bar
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, hasMoved: false });
  
  // Chat state
  const { messages, isConnected, isMuted, sendMessage } = useCommunityChat(guildId, token);
  const [inputMessage, setInputMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevLastMessageId = useRef<string | null>(null);
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    auth.currentUser?.getIdToken().then(t => setToken(t)).catch(console.error);
  }, []);

  useEffect(() => {
    if (isChatExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
    }
  }, [messages, isChatExpanded]);

  useEffect(() => {
    if (messages.length === 0) return;
    
    const currentLastMessageId = messages[messages.length - 1].id;
    if (prevLastMessageId.current !== null && currentLastMessageId !== prevLastMessageId.current) {
      if (!isChatExpanded) {
        setUnreadCount(prev => prev + 1);
      }
    }
    prevLastMessageId.current = currentLastMessageId;
  }, [messages, isChatExpanded]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag when collapsed
    if (isChatExpanded) return;
    
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
      hasMoved: false
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragRef.current.hasMoved = true;
    }

    // Update position relative to bottom right
    // dx > 0 means moving right (which decreases 'right' property)
    // dy > 0 means moving down (which decreases 'bottom' property)
    const newX = dragRef.current.initialX - dx;
    const newY = dragRef.current.initialY - dy;
    
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    // If it was just a click and we didn't really move, expand chat
    if (!dragRef.current.hasMoved) {
      setIsChatExpanded(true);
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputMessage.trim() && isConnected) {
      sendMessage(inputMessage);
      setInputMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = '56px';
      }
    }
  };

  if (isChatExpanded) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#faf9f6]/95 backdrop-blur-xl flex flex-col pointer-events-auto">
        <div className="flex-1 max-w-2xl mx-auto w-full h-full flex flex-col shadow-2xl bg-white/30">
          {/* Header */}
          <div className="px-4 py-4 border-b border-black/10 flex justify-between items-center bg-white/60 backdrop-blur-md">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-teal-dark)] flex items-center justify-center">
                <MessageCircle size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#1d3539]">Community Chat</h2>
                <div className="flex items-center text-xs font-bold text-[#5496a2]">
                  <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`} />
                  {isConnected ? 'Connected' : 'Reconnecting...'}
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsChatExpanded(false)}
              className="p-2 rounded-full hover:bg-black/5 text-[#5496a2] hover:text-[#1d3539] transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-500">
                No messages yet. Be the first to say hi!
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = msg.user_id === currentUserId;
                const messageDate = new Date(msg.created_at);
                const messageDateString = messageDate.toDateString();
                
                let showDateDivider = false;
                
                if (idx === 0) {
                  showDateDivider = true;
                } else {
                  const prevDate = new Date(messages[idx - 1].created_at);
                  if (prevDate.toDateString() !== messageDateString) {
                    showDateDivider = true;
                  }
                }

                let dateHeaderText = '';
                const today = new Date();
                const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  
                  if (messageDateString === today.toDateString()) {
                    dateHeaderText = 'Today';
                  } else if (messageDateString === yesterday.toDateString()) {
                    dateHeaderText = 'Yesterday';
                  } else {
                    dateHeaderText = messageDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                  }

                  if (msg.user_id === 'system') {
                    return (
                      <React.Fragment key={idx}>
                        {showDateDivider && (
                          <div className="flex justify-center my-4">
                            <span className="bg-white text-[#5496a2] text-xs font-bold px-3 py-1 rounded-full border border-[#1d3539]/10 shadow-sm">
                              {dateHeaderText}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-center my-2">
                          <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                            {msg.content}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  }

                  return (
                    <React.Fragment key={idx}>
                      {showDateDivider && (
                        <div className="flex justify-center my-4">
                          <span className="bg-white text-[#5496a2] text-xs font-bold px-3 py-1 rounded-full border border-[#1d3539]/10 shadow-sm">
                            {dateHeaderText}
                          </span>
                        </div>
                      )}
                      <div className={`flex gap-2 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {!isMe && (
                              <div className="w-8 h-8 rounded-full bg-[var(--color-teal-dark)]/10 flex items-center justify-center text-[var(--color-teal-dark)] overflow-hidden shrink-0 mt-auto border border-black/5">
                                {msg.avatar && (msg.avatar.startsWith('http') || msg.avatar.includes('.') || msg.avatar.includes('/')) ? (
                                  <img src={resolveAvatarUrl(msg.avatar, msg.username)} alt={msg.username} className="w-full h-full object-cover" />
                                ) : msg.avatar ? (
                                  <span className="text-sm font-bold">{msg.avatar}</span>
                                ) : (
                                  <User size={14} />
                                )}
                              </div>
                            )}
                          <div className={`max-w-[75%] rounded-[1.3rem] px-4 py-2.5 shadow-sm ${
                            isMe 
                              ? 'bg-gradient-to-br from-[#5496a2] to-[#3a7c88] text-white rounded-br-sm shadow-[0_4px_12px_rgba(84,150,162,0.2)]' 
                              : 'bg-white text-slate-800 border border-black/5 rounded-bl-sm shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
                          }`}>
                            {!isMe && (
                              <div className="text-[11px] font-black text-[#5496a2] mb-1">
                                {msg.username || `${msg.user_id.substring(0,8)}...`}
                              </div>
                            )}
                            <p className="text-[15px] font-medium leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                            <div className={`text-[10px] mt-1 font-bold ${isMe ? 'text-emerald-50' : 'text-slate-400'} text-right opacity-80`}>
                              {messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                    </React.Fragment>
                  );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white/60 border-t border-black/10 backdrop-blur-md pb-8">
            {isMuted ? (
              <div className="max-w-2xl mx-auto flex items-center justify-center p-4 bg-red-50 border border-red-100 rounded-2xl">
                <span className="text-sm font-bold text-red-600 flex items-center">
                  You have been muted by the admin.
                </span>
              </div>
            ) : (
              <form onSubmit={handleSend} className="relative max-w-2xl mx-auto flex items-end">
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => {
                    setInputMessage(e.target.value);
                    e.target.style.height = '56px';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                  }}
                  onKeyDown={(e) => {
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Message your community..."
                  disabled={!isConnected}
                  className="w-full bg-white text-[#1d3539] placeholder-slate-400 rounded-2xl py-4 pl-6 pr-14 outline-none border border-[#1d3539]/10 shadow-sm font-medium focus:border-[var(--color-teal-dark)] focus:ring-4 focus:ring-[var(--color-teal-dark)]/20 transition-all resize-none min-h-[56px] max-h-[150px]"
                  rows={1}
                  style={{ height: '56px' }}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || !isConnected}
                  className="absolute right-2 bottom-2 p-2 bg-[var(--color-teal-dark)] text-white rounded-full hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed z-50 pointer-events-auto touch-none"
      style={{
        bottom: `${position.y}px`,
        right: `${position.x}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="relative group cursor-grab active:cursor-grabbing">
        {/* Unread badge */}
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-rose-500 rounded-full border-2 border-slate-900 z-10 animate-bounce shadow-md flex items-center justify-center px-1">
            <span className="text-[10px] font-bold text-white leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </div>
        )}
        
        {/* Glassmorphic Icon */}
        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.37)] flex items-center justify-center transition-transform hover:scale-105 active:scale-95">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-400 flex items-center justify-center opacity-90">
            <MessageCircle size={28} className="text-slate-900" />
          </div>
        </div>
      </div>
    </div>
  );
}
