import React, { useState } from 'react';
import { ExternalLink, ShieldCheck, Copy, Check } from 'lucide-react';

interface OTPDisplayProps {
  secret: string;
}

export const OTPDisplay: React.FC<OTPDisplayProps> = ({ secret }) => {
  const [copied, setCopied] = useState(false);

  // Link to 2fa.live homepage as requested
  const live2faLink = "https://2fa.live/";

  const handleCopy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          Mã Đăng Nhập (2FA)
        </h3>
      </div>

      <div className="space-y-6">
        
        {/* Main Action Button */}
        <a 
          href={live2faLink} 
          target="_blank" 
          rel="noreferrer"
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
        >
          Lấy mã từ 2FA.LIVE
          <ExternalLink className="w-5 h-5" />
        </a>

        {/* Instructions Section */}
        <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-700/50">
          <h4 className="font-semibold text-slate-300 text-sm mb-4 border-b border-slate-700 pb-2">Hướng dẫn lấy mã thủ công:</h4>
          
          <div className="space-y-4 text-sm text-slate-400">
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-indigo-400 border border-slate-700">1</span>
              <div>
                <p className="mb-1">Bước 1: Vào web sau</p>
                <a href="https://2fa.live/" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                  https://2fa.live/
                </a>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-indigo-400 border border-slate-700">2</span>
              <div className="w-full">
                <p className="mb-2">Bước 2: Dán code bên dưới vào ô trống:</p>
                <button 
                  onClick={handleCopy}
                  className="w-full bg-slate-950 border border-slate-700 hover:border-indigo-500/50 rounded-lg p-3 flex items-center justify-between group transition-all"
                  title="Nhấn để sao chép"
                >
                  <code className="font-mono text-indigo-300 text-xs break-all text-left mr-2">
                    {secret}
                  </code>
                  <div className="bg-slate-800 p-1.5 rounded-md group-hover:bg-slate-700 transition-colors">
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400 group-hover:text-white" />
                    )}
                  </div>
                </button>
              </div>
            </div>

            <div className="flex gap-3">
               <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-indigo-400 border border-slate-700">3</span>
               <p>Bước 3: Nhấn submit để lấy mã đăng nhập.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};