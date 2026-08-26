import React, { useState, useRef } from 'react';
import { X, FileText, Download, Copy, Loader2, Calendar } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiClient } from '../../lib/api';
import { Capacitor } from '@capacitor/core';

interface GHGReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  guildId: string;
}

interface ReportData {
  reportId: string;
  reportMarkdown: string;
  dailyData: { day: string; daily_distance: number }[];
}

export function GHGReportModal({ isOpen, onClose, guildId }: GHGReportModalProps) {
  const [startDate, setStartDate] = useState<string>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setReportData(null);
    try {
      const periodStart = new Date(startDate).getTime();
      const periodEnd = new Date(endDate).getTime() + (24 * 60 * 60 * 1000) - 1; // End of the day
      
      const res = await apiClient(`/guilds/${guildId}/ghg-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodStart, periodEnd })
      });
      
      if (res.error) throw new Error(res.error);
      
      setReportData({
        reportId: res.reportId,
        reportMarkdown: res.reportMarkdown,
        dailyData: res.dailyData || []
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!reportData) return;
    navigator.clipboard.writeText(reportData.reportMarkdown)
      .then(() => alert('Report copied to clipboard!'))
      .catch(() => alert('Failed to copy.'));
  };

  const handleDownloadMD = () => {
    if (!reportData) return;
    const blob = new Blob([reportData.reportMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GHG_Scope3_Report_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    try {
      const element = reportRef.current;
      const opt = {
        margin:       10,
        filename:     `GHG_Scope3_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      if (Capacitor.isNativePlatform()) {
        // Native Export Flow
        // @ts-ignore
        const pdfWorker = html2pdf().set(opt).from(element).output('datauristring');
        const pdfBase64 = await pdfWorker;
        
        // Dynamically import Capacitor Share to avoid breaking if not installed
        const { Share } = await import('@capacitor/share');
        
        // On Android, we need to save the file first using Filesystem before sharing,
        // OR we can just use Web Share API for Base64, but typically Filesystem is required.
        // Since we want to avoid native plugins as much as possible, let's try direct share if supported,
        // otherwise notify the user.
        alert('PDF generated! Please use the Web Version to download files, or use the Copy Text button on mobile.');
      } else {
        // Web Export Flow
        html2pdf().set(opt).from(element).save();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF. Please ensure html2pdf.js is installed.');
    }
  };

  // Simple Markdown renderer
  const markdownComponents = {
    h1: ({node, ...props}: any) => <h1 style={{ color: '#0f172a', fontSize: '24px', fontWeight: 'bold', marginTop: '24px', marginBottom: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }} {...props} />,
    h2: ({node, ...props}: any) => {
      const isTrends = props.children?.toString().includes('Trends & Anomalies');
      return (
        <>
          <h2 style={{ color: '#1e293b', fontSize: '20px', fontWeight: 'bold', marginTop: '20px', marginBottom: '12px' }} {...props} />
          {isTrends && reportData?.dailyData && reportData.dailyData.length > 0 && (
            <div style={{ margin: '24px 0', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b', fontWeight: 'bold' }}>Daily Low-Carbon Commuting Trend (km)</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', height: '120px', gap: '4px' }}>
                {reportData.dailyData.map((d: any, i: number) => {
                  const dist = Number(d.daily_distance) || 0;
                  const maxDist = Math.max(...reportData.dailyData.map((x: any) => Number(x.daily_distance) || 0), 1);
                  const heightPct = (dist / maxDist) * 100;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', position: 'relative' }}>
                      <div style={{ 
                        width: '100%', 
                        backgroundColor: '#10b981', 
                        height: `${heightPct}%`,
                        minHeight: dist > 0 ? '4px' : '0',
                        borderTopLeftRadius: '2px', 
                        borderTopRightRadius: '2px',
                        opacity: 0.9
                      }}></div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
                <span>{reportData.dailyData[0]?.day}</span>
                <span>{reportData.dailyData[reportData.dailyData.length - 1]?.day}</span>
              </div>
            </div>
          )}
        </>
      );
    },
    h3: ({node, ...props}: any) => <h3 style={{ color: '#334155', fontSize: '18px', fontWeight: 'bold', marginTop: '16px', marginBottom: '8px' }} {...props} />,
    p: ({node, ...props}: any) => <p style={{ color: '#334155', fontSize: '14px', lineHeight: '1.6', marginBottom: '12px' }} {...props} />,
    ul: ({node, ...props}: any) => <ul style={{ color: '#334155', fontSize: '14px', paddingLeft: '20px', marginBottom: '12px', listStyleType: 'disc' }} {...props} />,
    ol: ({node, ...props}: any) => <ol style={{ color: '#334155', fontSize: '14px', paddingLeft: '20px', marginBottom: '12px', listStyleType: 'decimal' }} {...props} />,
    li: ({node, ...props}: any) => <li style={{ marginBottom: '6px' }} {...props} />,
    table: ({node, ...props}: any) => <div style={{ overflowX: 'auto', marginBottom: '16px' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }} {...props} /></div>,
    th: ({node, ...props}: any) => <th style={{ borderBottom: '2px solid #cbd5e1', padding: '10px 8px', color: '#0f172a', fontWeight: 'bold', backgroundColor: '#f8fafc' }} {...props} />,
    td: ({node, ...props}: any) => <td style={{ borderBottom: '1px solid #e2e8f0', padding: '10px 8px', color: '#334155' }} {...props} />,
    strong: ({node, ...props}: any) => <strong style={{ fontWeight: 'bold', color: '#0f172a' }} {...props} />,
    blockquote: ({node, ...props}: any) => <blockquote style={{ textAlign: 'center', padding: '16px', color: '#475569', fontStyle: 'italic', margin: '24px 0', backgroundColor: '#f8fafc', borderRadius: '8px' }} {...props} />
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">GHG Scope 3 Report</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Generated Verification</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {!reportData ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Calendar size={48} className="text-slate-200 mb-6" />
              <h3 className="text-lg font-bold text-slate-700 mb-2">Select Reporting Period</h3>
              <p className="text-sm text-slate-500 mb-8 text-center max-w-md">
                Generate an AI-audited ESG report based on your community's low-carbon commuting data.
              </p>
              
              <div className="flex flex-col w-full max-w-sm space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Start Date</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    max={endDate}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500 transition-colors bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">End Date</label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500 transition-colors bg-slate-50"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold w-full max-w-md mb-6 text-center">
                  {error}
                </div>
              )}

              <button 
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full max-w-xs bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-black transition-all flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <><Loader2 className="animate-spin mr-2" size={20} /> Generating...</>
                ) : 'Generate Report'}
              </button>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div 
                ref={reportRef} 
                className="p-10 border rounded-2xl shadow-sm"
                style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#334155', fontFamily: 'Arial, sans-serif' }}
              >
                {/* Professional Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #10b981', paddingBottom: '20px', marginBottom: '24px' }}>
                  <div>
                    <h2 style={{ margin: 0, color: '#0f172a', fontSize: '28px', fontWeight: 'bold' }}>EcoStride</h2>
                    <p style={{ margin: '4px 0 0 0', color: '#10b981', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Sustainability Report</p>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '13px', color: '#64748b' }}>
                    <p style={{ margin: '0 0 4px 0' }}><strong>Period:</strong> {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}</p>
                    <p style={{ margin: '0 0 4px 0' }}><strong>Generated:</strong> {new Date().toLocaleDateString()}</p>
                    <p style={{ margin: '0 0 4px 0' }}><strong>Community ID:</strong> {guildId}</p>
                    <p style={{ margin: 0 }}><strong>Document ID:</strong> {reportData.reportId.split('-')[2] || 'N/A'}</p>
                  </div>
                </div>

                {/* Markdown Content */}
                <div style={{ padding: '0 8px' }}>
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {reportData.reportMarkdown}
                  </ReactMarkdown>
                </div>
                
                {/* Official Sign-off Area */}
                <div style={{ marginTop: '40px', paddingTop: '32px', borderTop: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 'bold' }}>
                    Report Generation System: <span style={{ color: '#10b981' }}>EcoStride AI ESG Engine</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                    <div style={{ width: '45%' }}>
                      <div style={{ borderBottom: '1px solid #0f172a', marginBottom: '8px', height: '24px' }}></div>
                      <div style={{ fontSize: '13px', color: '#475569', fontWeight: 'bold' }}>Sign-off (Authorized Personnel)</div>
                    </div>
                    <div style={{ width: '45%' }}>
                      <div style={{ borderBottom: '1px solid #0f172a', marginBottom: '8px', height: '24px' }}></div>
                      <div style={{ fontSize: '13px', color: '#475569', fontWeight: 'bold' }}>Corporate Reviewer (ESG / HR)</div>
                    </div>
                  </div>
                </div>

                {/* Professional Footer */}
                <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
                  <p style={{ margin: 0 }}>Powered by AI Verification. This GHG Report conforms to EcoStride Community Auditing Standards.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {reportData && (
          <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-end space-x-3">
            <button 
              onClick={handleCopy}
              className="px-4 py-2 flex items-center text-slate-600 hover:bg-slate-100 rounded-lg font-bold text-sm transition-colors"
            >
              <Copy size={16} className="mr-2" /> Copy Text
            </button>
            <button 
              onClick={handleDownloadMD}
              className="px-4 py-2 flex items-center text-slate-600 hover:bg-slate-100 rounded-lg font-bold text-sm transition-colors"
            >
              <Download size={16} className="mr-2" /> Download .md
            </button>
            <button 
              onClick={handleDownloadPDF}
              className="px-4 py-2 flex items-center bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg font-bold text-sm transition-colors"
            >
              <Download size={16} className="mr-2" /> Export PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
