import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, ArrowLeft, Send, User } from 'lucide-react';
import { useCommunityChat } from '../../hooks/useCommunityChat';
import { auth } from '../../firebase';
import { useDemoStore } from '../../stores/useDemoStore';
import { apiClient, resolveAvatarUrl } from '../../lib/api';

export function PrivateChatRoom() {
  const { activePrivateChat, setActivePrivateChat } = useDemoStore();
  const [token, setToken] = useState<string | null>(null);
  
  const currentUserId = auth.currentUser?.uid;
  const friendId = activePrivateChat?.friendId || '';
  
  // Generate unique room ID for the 2 users
  const roomId = currentUserId && friendId 
    ? `1to1_${[currentUserId, friendId].sort().join('_')}` 
    : '';

  const { messages, isConnected, sendMessage } = useCommunityChat(roomId, token);
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(t => setToken(t)).catch(console.error);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (roomId && activePrivateChat) {
      apiClient(`/chat/read/${roomId}`, { method: 'POST' }).catch(console.error);
    }
  }, [roomId, messages.length, activePrivateChat]);

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

  if (!activePrivateChat || !currentUserId) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--color-bg-main)]/95 backdrop-blur-xl flex flex-col pointer-events-auto transition-colors">
      <div className="flex-1 w-full h-full flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-black/5 dark:border-white/5 flex items-center justify-center glass-card border-none rounded-none backdrop-blur-xl z-10 sticky top-0 shadow-sm">
          <button 
            onClick={() => setActivePrivateChat(null)}
            className="p-2 -ml-2 rounded-full text-[#5496a2] hover:text-[var(--color-text-main)] active:bg-black/5 transition-colors absolute left-4 flex items-center"
          >
            <ArrowLeft size={24} strokeWidth={2} />
          </button>
          <div className="flex-1 flex flex-col items-center justify-center">
            <h2 className="text-[16px] font-bold text-[var(--color-text-main)]">{activePrivateChat.friendUsername}</h2>
            <div className="flex items-center text-[10px] font-semibold text-[#5496a2]">
              <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isConnected ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`} />
              {isConnected ? 'Online' : 'Connecting...'}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500 font-bold">
              No messages yet. Say hi to {activePrivateChat.friendUsername}!
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.user_id === currentUserId;
              const messageDate = new Date(msg.created_at);
              const messageDateString = messageDate.toDateString();
              
              let showDateDivider = false;
              let dateHeaderText = '';
              
              if (idx === 0) {
                showDateDivider = true;
              } else {
                const prevDate = new Date(messages[idx - 1].created_at);
                if (prevDate.toDateString() !== messageDateString) {
                  showDateDivider = true;
                }
              }

              if (showDateDivider) {
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                
                if (messageDateString === today.toDateString()) {
                  dateHeaderText = 'Today';
                } else if (messageDateString === yesterday.toDateString()) {
                  dateHeaderText = 'Yesterday';
                } else {
                  dateHeaderText = messageDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                }
              }

              return (
                <React.Fragment key={msg.id || idx}>
                  {showDateDivider && (
                    <div className="flex justify-center my-6">
                      <span className="bg-white dark:bg-slate-800 text-[#5496a2] text-xs font-bold px-3 py-1 rounded-full border border-[#1d3539]/10 shadow-sm">
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
                            <span className="text-sm">{msg.avatar}</span>
                          ) : (
                            <User size={16} />
                          )}
                        </div>
                      )}
                      <div className={`max-w-[75%] rounded-[1.3rem] px-4 py-2.5 shadow-sm ${
                        isMe 
                          ? 'bg-gradient-to-br from-[#5496a2] to-[#3a7c88] text-white rounded-br-sm shadow-[0_4px_12px_rgba(84,150,162,0.2)]' 
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-black/5 dark:border-white/10 rounded-bl-sm shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
                      }`}>
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
        <div className="p-4 glass-card border-none rounded-none border-t border-[#1d3539]/10 dark:border-white/10 backdrop-blur-md pb-8">
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
                // On desktop, Enter sends the message (unless Shift is held).
                // On mobile, the virtual keyboard's return key should just insert a newline. 
                // The user will tap the physical send button to send.
                if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              disabled={!isConnected}
              className="w-full bg-white dark:bg-slate-800 text-[#1d3539] dark:text-slate-100 placeholder-slate-400 rounded-2xl py-4 pl-6 pr-14 outline-none border border-[#1d3539]/10 dark:border-white/10 shadow-sm font-medium focus:border-[var(--color-teal-dark)] focus:ring-4 focus:ring-[var(--color-teal-dark)]/20 transition-all resize-none min-h-[56px] max-h-[150px]"
              rows={1}
              style={{ height: '56px' }}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || !isConnected}
              className="absolute right-2 bottom-2 p-2 bg-[var(--color-teal-dark)] text-white rounded-full hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
