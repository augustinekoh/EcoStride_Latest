import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, Maximize2, RefreshCw } from 'lucide-react';
import { apiClient } from '../../lib/api';

export const AdminPhotoProofs: React.FC = () => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Full image preview modal state
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const res = await apiClient(`/city-events/admin/submissions?t=${Date.now()}`);
      setSubmissions(res.submissions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this proof?`)) return;
    setActionLoading(id);
    try {
      await apiClient(`/city-events/admin/submissions/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      await fetchSubmissions();
    } catch (e) {
      alert(`Failed to ${action} proof.`);
    } finally {
      setActionLoading(null);
    }
  };

  // Group submissions by event_title, then by user
  const grouped = submissions.reduce((acc: any, sub: any) => {
    const title = sub.event_title || 'Unknown Event';
    const userKey = `${sub.username || 'Unknown User'}:::${sub.email || 'No email'}`;
    
    if (!acc[title]) acc[title] = {};
    if (!acc[title][userKey]) acc[title][userKey] = [];
    acc[title][userKey].push(sub);
    return acc;
  }, {});

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-teal-950">Photo Proofs</h2>
        <button 
          onClick={fetchSubmissions}
          className="bg-white/80 backdrop-blur-md text-teal-700 font-bold px-4 py-2 rounded-xl border border-teal-200/50 hover:bg-white transition-colors flex items-center gap-2 shadow-sm"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Refresh Data
        </button>
      </div>
      
      {loading && submissions.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-teal-700/60 font-bold gap-4">
          <Loader2 className="animate-spin" size={32} />
          <p>Loading submissions...</p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-lg rounded-3xl p-12 text-center border border-white/80 shadow-xl shadow-teal-900/5">
          <CheckCircle size={48} className="mx-auto text-teal-300 mb-4" />
          <h3 className="text-xl font-bold text-teal-900 mb-2">No Submissions Found</h3>
          <p className="text-teal-700/60">There are no photo proofs uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([eventTitle, userGroups]: [string, any]) => (
            <div key={eventTitle} className="bg-white/60 backdrop-blur-lg rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80 p-6">
              <h3 className="text-xl font-black text-teal-950 mb-6 flex items-center gap-2">
                <div className="w-2 h-6 bg-amber-400 rounded-full"></div>
                {eventTitle}
              </h3>
              
              <div className="space-y-8">
                {Object.entries(userGroups).map(([userKey, subs]: [string, any]) => {
                  const [username, email] = userKey.split(':::');
                  return (
                    <div key={userKey} className="border-l-4 border-teal-300 pl-4">
                      <div className="flex items-center gap-2 mb-4">
                        <h4 className="text-lg font-bold text-slate-800">{username}</h4>
                        <span className="text-sm font-medium text-slate-500">({email})</span>
                      </div>
                      
                      <div className="space-y-4">
                        {subs.map((s: any) => (
                          <div key={s.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex gap-6 items-center shadow-sm hover:shadow-md transition-shadow relative group">
                            
                            {/* Small Image Preview */}
                            <div className="relative shrink-0 cursor-pointer overflow-hidden rounded-xl bg-slate-100 border border-slate-200" onClick={() => setPreviewImage(s.proof_url)}>
                              <img 
                                src={s.proof_url} 
                                alt="Proof" 
                                className="w-24 h-24 object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <Maximize2 size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                              </div>
                            </div>
                            
                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-2">
                                <p className="text-sm font-medium text-slate-700 break-words">{s.description || <span className="text-slate-400 italic">No description provided</span>}</p>
                              </div>
                              <p className="text-xs font-bold text-slate-400">{new Date(s.created_at).toLocaleString()}</p>
                            </div>

                            {/* Status & Actions */}
                            <div className="shrink-0 flex flex-col items-end gap-3 w-40">
                              {s.status === 'pending' && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-200 w-full text-center">Pending Review</span>}
                              {s.status === 'approved' && <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-200 w-full text-center flex justify-center items-center gap-1"><CheckCircle size={14}/> Approved</span>}
                              {s.status === 'rejected' && <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 w-full text-center flex justify-center items-center gap-1"><XCircle size={14}/> Rejected</span>}
                              
                              {s.status === 'pending' && (
                                <div className="flex gap-2 w-full">
                                  <button 
                                    onClick={() => handleReview(s.id, 'approve')}
                                    disabled={actionLoading === s.id}
                                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50"
                                  >
                                    {actionLoading === s.id ? <Loader2 size={16} className="animate-spin mx-auto"/> : 'Approve'}
                                  </button>
                                  <button 
                                    onClick={() => handleReview(s.id, 'reject')}
                                    disabled={actionLoading === s.id}
                                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50"
                                  >
                                    {actionLoading === s.id ? <Loader2 size={16} className="animate-spin mx-auto"/> : 'Reject'}
                                  </button>
                                </div>
                              )}
                            </div>

                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Image Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full flex justify-center">
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 text-white bg-black/50 hover:bg-white/20 p-2 rounded-full transition-colors"
            >
              <XCircle size={32} />
            </button>
            <img 
              src={previewImage} 
              alt="Proof Full Size" 
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        </div>
      )}
    </div>
  );
};
