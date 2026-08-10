import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, ArrowLeft, Send, User, Camera, Loader2, X } from 'lucide-react';
import { useCommunityChat } from '../../hooks/useCommunityChat';
import { auth } from '../../firebase';
import { useDemoStore } from '../../stores/useDemoStore';
import { resolveAvatarUrl, apiClient } from '../../lib/api';
import { SharedSignpostCard } from './SharedSignpostCard';

export function PrivateChatRoom() {
  const { activePrivateChat, setActivePrivateChat } = useDemoStore();
  const [token, setToken] = useState<string | null>(null);
  
  const currentUserId = auth.currentUser?.uid;
  const friendId = activePrivateChat?.friendId || '';
  
  // Generate unique room ID for the 2 users
  const roomId = currentUserId && friendId 
    ? `1to1_${[currentUserId, friendId].sort().join('_')}` 
    : '';

  const { messages, isConnected, sendMessage, editMessage, deleteMessage } = useCommunityChat(roomId, token);
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // New features state
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showOptionsFor, setShowOptionsFor] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (editingMessageId) {
        editMessage(editingMessageId, inputMessage);
        setEditingMessageId(null);
      } else {
        sendMessage(inputMessage);
      }
      setInputMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = '56px';
      }
    }
  };

  const handleMessagePointerDown = (msgId: string) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setShowOptionsFor(msgId);
    }, 1500);
  };

  const handleMessagePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startEdit = (msg: any) => {
    setEditingMessageId(msg.id);
    setInputMessage(msg.content);
    setShowOptionsFor(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setInputMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = '56px';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const confirmImageUpload = async () => {
    if (!selectedImage) return;

    try {
      setIsUploading(true);
      
      const extension = selectedImage.name.split('.').pop() || 'webp';

      // 1. Get Presigned URL
      const data = await apiClient(`/chat/presigned-url?ext=${extension}`, {
        method: 'GET'
      });

      if (!data.success || !data.uploadUrl || !data.publicUrl) {
        throw new Error(data.error || 'Failed to get upload URL');
      }

      // 2. Upload directly to R2
      const uploadResponse = await fetch(data.uploadUrl, {
        method: 'PUT',
        body: selectedImage,
        headers: {
          'Content-Type': selectedImage.type || 'application/octet-stream',
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image to storage');
      }

      // 3. Send message
      sendMessage(`[IMAGE:${data.publicUrl}]`, data.objectKey);
      
      setSelectedImage(null);
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl(null);
      }
    } catch (err: any) {
      console.error("Upload error", err);
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const cancelImageUpload = () => {
    setSelectedImage(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
  };

  if (!activePrivateChat || !currentUserId) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--color-bg-main)]/95 backdrop-blur-xl flex flex-col pointer-events-auto transition-colors">
      {/* Fullscreen Image Overlay */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out animate-in fade-in"
          onClick={() => setEnlargedImage(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors"
            onClick={(e) => { e.stopPropagation(); setEnlargedImage(null); }}
          >
            <X size={24} />
          </button>
          <img 
            src={enlargedImage} 
            alt="Enlarged" 
            className="max-w-full max-h-full object-contain select-none"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

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
                      <div className={`relative max-w-[75%] rounded-[1.3rem] px-4 py-2.5 shadow-sm select-none ${
                        isMe 
                          ? 'bg-[#e6f0f2] dark:bg-gradient-to-br dark:from-[#5496a2] dark:to-[#3a7c88] text-[#1d3539] dark:text-white rounded-br-sm border border-[#5496a2]/20 dark:border-none shadow-[0_4px_12px_rgba(84,150,162,0.05)] dark:shadow-[0_4px_12px_rgba(84,150,162,0.2)]'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-black/5 dark:border-white/10 rounded-bl-sm shadow-[0_4px_12px_rgba(0,0,0,0.03)]'
                      }`}
                        onPointerDown={() => handleMessagePointerDown(msg.id)}
                        onPointerUp={handleMessagePointerUp}
                        onPointerLeave={handleMessagePointerUp}
                        onPointerCancel={handleMessagePointerUp}
                      >
                        <div className="text-[15px] font-medium leading-relaxed whitespace-pre-wrap break-words">
                          {msg.content.split(/(\[IMAGE:.*?\]|\[SIGNPOST:.*?\])/g).map((part, i) => {
                            if (part.startsWith('[IMAGE:')) {
                              const url = part.replace('[IMAGE:', '').replace(']', '');
                              return <img 
                                key={i} 
                                src={url} 
                                alt="Shared image" 
                                className="max-w-full rounded-lg mt-2 mb-1 shadow-sm border border-black/5 cursor-zoom-in hover:opacity-95 transition-opacity" 
                                loading="lazy" 
                                onClick={(e) => { e.stopPropagation(); setEnlargedImage(url); }}
                              />;
                            }
                            if (part.startsWith('[SIGNPOST:')) {
                              const match = part.match(/\[SIGNPOST:(.*?):(.*?):(.*?)\]/);
                              if (match) {
                                const [_, id, emoji, title] = match;
                                return (
                                  <div key={i} className="mt-2 mb-1" onClick={e => e.stopPropagation()}>
                                    <SharedSignpostCard signpostId={id} fallbackEmoji={emoji} fallbackTitle={title} />
                                  </div>
                                );
                              }
                            }
                            return part ? <span key={i}>{part}</span> : null;
                          })}
                        </div>
                        <div className={`text-[10px] mt-1 font-bold ${isMe ? 'text-[#5496a2]/80 dark:text-emerald-50' : 'text-slate-400'} text-right opacity-80 flex items-center justify-end gap-1`}>
                          {msg.is_edited && <span className="italic opacity-70">(edited)</span>}
                          {messageDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </div>

                        {/* Options Modal/Overlay for this message */}
                        {showOptionsFor === msg.id && isMe && (
                          <div 
                            className="absolute z-30 bottom-[calc(100%+5px)] right-0 bg-white dark:bg-slate-800 shadow-xl border border-black/5 dark:border-white/10 rounded-xl p-1 flex flex-col gap-1 min-w-[120px] animate-in fade-in zoom-in-95"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1 flex justify-between items-center">
                              Options
                              <button onClick={() => setShowOptionsFor(null)} className="hover:text-slate-600"><X size={12} /></button>
                            </div>
                            
                            {/* Can only edit if it's text and within 5 minutes */}
                            {!msg.content.includes('[IMAGE:') && !msg.content.includes('[SIGNPOST:') && (Date.now() - msg.created_at) <= 5 * 60 * 1000 && (
                              <button 
                                className="text-sm font-bold px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                onClick={() => startEdit(msg)}
                              >
                                Edit Message
                              </button>
                            )}
                            
                            <button 
                              className="text-sm font-bold px-3 py-2 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                              onClick={() => {
                                deleteMessage(msg.id);
                                setShowOptionsFor(null);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 glass-card border-none rounded-none border-t border-[#1d3539]/10 dark:border-white/10 backdrop-blur-md pb-8 relative">
          <div className="relative max-w-2xl mx-auto">
            {/* Image Preview Modal */}
            {selectedImage && imagePreviewUrl && (
              <div className="absolute bottom-full left-0 right-0 mb-4 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-black/10 dark:border-white/10 p-4 z-20 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2">
                <button 
                  type="button"
                  onClick={cancelImageUpload}
                  disabled={isUploading}
                  className="absolute top-2 right-2 p-1.5 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-full text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
                >
                  <X size={18} />
                </button>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 w-full text-center">
                  Send this image?
                </div>
                <div className="relative max-w-full max-h-[30vh] rounded-lg overflow-hidden border border-black/5 flex items-center justify-center bg-black/5 mb-4">
                  <img src={imagePreviewUrl} alt="Preview" className="max-w-full max-h-[30vh] object-contain" />
                </div>
                <button 
                  type="button"
                  onClick={confirmImageUpload}
                  disabled={isUploading}
                  className="w-full py-3 bg-[var(--color-teal-dark)] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#3a7c88] transition-colors shadow-md disabled:opacity-70"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Send Image
                    </>
                  )}
                </button>
              </div>
            )}
          
            {editingMessageId ? (
              <div className="relative max-w-2xl mx-auto flex flex-col gap-2 w-full">
                <div className="flex justify-between items-center px-2">
                  <span className="text-xs font-bold text-[#5496a2]">Editing message...</span>
                  <button onClick={cancelEdit} className="text-xs font-bold text-slate-400 hover:text-slate-600">Cancel</button>
                </div>
                <form onSubmit={handleSend} className="relative flex items-end">
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
                    placeholder="Edit your message..."
                    autoFocus
                    disabled={!isConnected}
                    className="w-full bg-amber-50 dark:bg-amber-900/20 text-[#1d3539] dark:text-slate-100 placeholder-slate-400 rounded-2xl py-4 pl-4 pr-14 outline-none border border-amber-200 dark:border-amber-700/50 shadow-sm font-medium focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 transition-all resize-none min-h-[56px] max-h-[150px]"
                    rows={1}
                    style={{ height: '56px' }}
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || !isConnected}
                    className="absolute right-2 bottom-2 p-2 bg-amber-500 text-white rounded-full hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />
                  </button>
                </form>
              </div>
            ) : (
              <form onSubmit={handleSend} className="relative flex items-end">
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
                className="w-full bg-white dark:bg-slate-800 text-[#1d3539] dark:text-slate-100 placeholder-slate-400 rounded-2xl py-4 pl-12 pr-14 outline-none border border-[#1d3539]/10 dark:border-white/10 shadow-sm font-medium focus:border-[var(--color-teal-dark)] focus:ring-4 focus:ring-[var(--color-teal-dark)]/20 transition-all resize-none min-h-[56px] max-h-[150px]"
                rows={1}
                style={{ height: '56px' }}
              />
              
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!isConnected || isUploading}
                className="absolute left-2 bottom-2 p-2 text-slate-400 hover:text-[var(--color-teal-dark)] hover:bg-[var(--color-teal-dark)]/10 rounded-full transition-all disabled:opacity-50"
              >
                <Camera size={18} />
              </button>

              <button
                type="submit"
                disabled={!inputMessage.trim() || !isConnected}
                className="absolute right-2 bottom-2 p-2 bg-[var(--color-teal-dark)] text-white rounded-full hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />
              </button>
            </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
