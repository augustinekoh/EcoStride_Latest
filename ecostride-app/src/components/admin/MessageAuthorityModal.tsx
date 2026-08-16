import React, { useState } from 'react';
import { X, Send, Mail, Loader2, Shield, MapPin } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { formatLocation } from '../../lib/locationData';

interface MessageAuthorityModalProps {
  isOpen: boolean;
  onClose: () => void;
  authority: {
    id: string;
    username: string;
    email: string;
    position?: string;
    country?: string;
    state?: string;
    city?: string;
    avatar?: string;
  } | null;
  onSent?: () => void;
}

export function MessageAuthorityModal({ isOpen, onClose, authority, onSent }: MessageAuthorityModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen || !authority) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Message content is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await apiClient('/admin/authority-message', {
        method: 'POST',
        body: JSON.stringify({
          authorityId: authority.id,
          title: title.trim() || 'Admin Notice',
          content: content.trim()
        })
      });

      setSuccess(true);
      setTitle('');
      setContent('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
        if (onSent) onSent();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-teal-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-teal-100 flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-teal-50 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-50 rounded-xl text-teal-600">
              <Mail size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-teal-950">Message Authority</h2>
              <p className="text-xs text-teal-600/70 font-medium">Direct administration notice to department</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-teal-900/40 hover:bg-teal-50 hover:text-teal-600 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Recipient Profile Summary */}
        <div className="bg-teal-50/40 px-6 py-4 border-b border-teal-100/50 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm overflow-hidden border border-white shadow-sm shrink-0">
            {authority.avatar ? (
              <img src={authority.avatar} alt={authority.username} className="w-full h-full object-cover" />
            ) : (
              <Shield size={20} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-sm text-teal-950 truncate">{authority.username}</h4>
            <p className="text-xs text-teal-700/80 truncate font-medium">{authority.position || 'Local Government'}</p>
            <div className="flex items-center gap-1 text-[11px] text-teal-600/80 mt-0.5 truncate">
              <MapPin size={11} className="shrink-0" />
              <span>{formatLocation(authority.city, authority.state, authority.country) || 'Jurisdiction Unassigned'}</span>
            </div>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSend} className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span>✅</span> Message delivered directly to authority's inbox!
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">Subject / Title</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Jurisdiction Update, Escalation Notice"
              className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1.5">Message Content *</label>
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your direct administrative instruction or update..."
              required
              rows={4}
              className="w-full bg-slate-50 border border-teal-200 focus:border-teal-600 focus:bg-white rounded-xl p-3.5 text-sm font-medium text-slate-800 outline-none transition-all resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading || !content.trim() || success}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              <span>Send Message</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
