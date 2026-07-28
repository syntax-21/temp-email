'use client';

import { useState, useEffect } from 'react';
import { Mail, RefreshCcw, Copy, Inbox } from 'lucide-react';

export default function TempMail() {
  const [emailPrefix, setEmailPrefix] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  // Ganti domain ini dengan domain Cloudflare Anda
  const domain = 'brepremiumstore.store';

  // Generate random email saat website dibuka
  useEffect(() => {
    const savedEmail = localStorage.getItem('temp_email');
    if (savedEmail && savedEmail.endsWith(`@${domain}`)) {
      setEmailAddress(savedEmail);
      setEmailPrefix(savedEmail.split('@')[0]);
    } else {
      generateRandomEmail();
    }
  }, []);

  // Fetch email secara berkala setiap 10 detik
  useEffect(() => {
    if (!emailAddress) return;
    
    fetchEmails();
    const interval = setInterval(fetchEmails, 10000); 
    return () => clearInterval(interval);
  }, [emailAddress]);

  const generateRandomEmail = () => {
    const randomString = Math.random().toString(36).substring(2, 10);
    applyNewEmail(randomString);
  };

  const applyNewEmail = (prefix: string) => {
    if (!prefix) return;
    const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9.-]/g, '');
    const newEmail = `${cleanPrefix}@${domain}`;
    setEmailPrefix(cleanPrefix);
    setEmailAddress(newEmail);
    localStorage.setItem('temp_email', newEmail);
    setEmails([]);
    setSelectedEmailId(null);
  };

  const fetchEmails = async () => {
    if (!emailAddress) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/emails?address=${emailAddress}`);
      const data = await res.json();
      if (data.emails) {
        setEmails(data.emails);
      }
    } catch (error) {
      console.error('Gagal mengambil email:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(emailAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedEmail = emails.find(e => e.id === selectedEmailId);

  return (
    <div className="flex h-screen w-full bg-[#0F172A] text-gray-200 font-sans overflow-hidden">
      
      {/* LEFT SIDEBAR (Controls) */}
      <aside className="w-72 bg-[#1d4ed8] flex flex-col p-6 shadow-2xl z-20 shrink-0 border-r border-blue-900/50">
        <div className="flex items-center justify-center gap-3 text-white mb-10 mt-4">
          <div className="bg-white/10 p-2.5 rounded-xl border border-white/20">
            <Mail className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">TMail</h1>
        </div>

        <div className="flex-1 flex flex-col space-y-6">
          {/* Input Group */}
          <div className="space-y-3">
            <div>
              <input 
                type="text" 
                value={emailPrefix}
                onChange={(e) => setEmailPrefix(e.target.value)}
                className="w-full bg-[#1e40af] border border-blue-400/30 rounded-lg px-4 py-3.5 text-white placeholder-blue-300/70 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all text-sm font-medium"
                placeholder="Enter Username"
              />
            </div>

            <div className="relative">
              <select 
                disabled
                className="w-full bg-[#1e40af] border border-blue-400/30 rounded-lg px-4 py-3.5 text-white appearance-none opacity-90 cursor-not-allowed text-sm font-medium"
              >
                <option>{domain}</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-80 text-white text-xs">
                ▼
              </div>
            </div>
            
            <button 
              onClick={() => applyNewEmail(emailPrefix)}
              className="w-full bg-[#22c55e] hover:bg-green-500 text-white font-bold rounded-lg px-4 py-3.5 transition-all shadow-lg shadow-green-500/20 border border-green-400/50"
            >
              Create
            </button>
          </div>

          <div className="w-full h-px bg-blue-400/30"></div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button 
              onClick={generateRandomEmail}
              className="w-full bg-[#eab308] hover:bg-yellow-400 text-white font-bold rounded-lg px-4 py-3.5 transition-all shadow-lg shadow-yellow-500/20 border border-yellow-400/50"
            >
              Random
            </button>

            <button 
              onClick={() => {
                if (emailAddress) setEmailPrefix(emailAddress.split('@')[0]);
              }}
              className="w-full bg-[#1e3a8a]/60 hover:bg-[#1e3a8a] text-blue-100 font-medium rounded-lg px-4 py-3.5 transition-all border border-blue-400/30"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Active Email Display (Fixed Wrapping) */}
        <div className="mt-auto pt-8">
          <p className="text-blue-200/80 text-xs font-medium mb-2 pl-1">Alamat Email Aktif:</p>
          <div 
            onClick={copyToClipboard}
            className="group relative bg-[#1e3a8a]/80 hover:bg-[#1e3a8a] border border-blue-400/30 rounded-xl p-3 cursor-pointer transition-all"
            title="Klik untuk menyalin"
          >
            <span className="font-mono text-white text-sm break-all leading-tight">
              {emailAddress || '...'}
            </span>
            {copied && (
              <span className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 bg-[#22c55e] rounded-full shadow-lg">
                <span className="text-white text-xs">✓</span>
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* MIDDLE COLUMN (Email List) */}
      <section className="w-80 lg:w-[350px] bg-[#0B1120] border-r border-gray-800 flex flex-col shrink-0 z-10">
        <div className="p-5 border-b border-gray-800/80 flex justify-between items-center bg-[#0B1120]">
          <h2 className="font-bold text-lg text-gray-200 flex items-center gap-2.5">
            <Inbox className="w-5 h-5 text-gray-400" />
            Kotak Masuk
          </h2>
          <button 
            onClick={fetchEmails} 
            className="p-2 hover:bg-gray-800 rounded-lg transition text-gray-400 hover:text-white"
            title="Refresh"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1d4ed8]' : ''}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500 space-y-3 p-6 text-center mt-10">
              <RefreshCcw className={`w-6 h-6 opacity-20 ${loading ? 'animate-spin' : ''}`} />
              <p className="text-sm">Belum ada pesan.<br/>Refresh otomatis (10s).</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {emails.map((email) => (
                <div 
                  key={email.id} 
                  onClick={() => setSelectedEmailId(email.id)}
                  className={`p-5 cursor-pointer transition-colors border-l-4 ${selectedEmailId === email.id ? 'bg-gray-800/80 border-[#1d4ed8]' : 'hover:bg-gray-800/40 border-transparent'}`}
                >
                  <div className="flex justify-between items-baseline mb-1.5 gap-2">
                    <h3 className="font-semibold text-gray-200 truncate text-base">
                      {email.fromName || email.from.split('@')[0]}
                    </h3>
                    <span className="text-xs text-gray-500 whitespace-nowrap shrink-0 font-medium">
                      {new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-blue-400/80 truncate mb-2 font-medium">{email.from}</p>
                  <p className="text-sm text-gray-400 truncate leading-snug">{email.subject}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* RIGHT COLUMN (Email Reader) */}
      <main className="flex-1 bg-[#0F172A] flex flex-col relative overflow-hidden">
        {selectedEmail ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Email Header Info */}
            <div className="p-8 border-b border-gray-800/60 bg-[#0B1120]/50 shrink-0">
              <h2 className="text-2xl font-bold text-white mb-5 leading-snug">{selectedEmail.subject}</h2>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-900/60 text-blue-400 flex items-center justify-center font-bold text-xl shrink-0 border border-blue-800/50">
                  {(selectedEmail.fromName || selectedEmail.from)[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-200">
                    {selectedEmail.fromName ? `${selectedEmail.fromName} ` : ''}
                    <span className="text-gray-400 font-normal">&lt;{selectedEmail.from}&gt;</span>
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(selectedEmail.receivedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Email Body Viewer */}
            <div className="flex-1 overflow-auto p-0 bg-[#0F172A]">
              {selectedEmail.html ? (
                <div className="w-full h-full bg-white">
                  <iframe 
                    srcDoc={selectedEmail.html} 
                    className="w-full h-full border-0 bg-white"
                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                  />
                </div>
              ) : (
                <div className="p-8 text-base font-mono text-gray-300 whitespace-pre-wrap h-full overflow-auto leading-relaxed">
                  {selectedEmail.text || selectedEmail.rawBody || 'Tidak ada konten.'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-6 p-8 relative">
            {/* Custom SVG Empty State */}
            <div className="relative w-48 h-48 opacity-10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5" className="w-full h-full text-blue-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-400">Pilih pesan di sebelah kiri untuk membacanya</p>
          </div>
        )}

        {/* Footer Area */}
        <div className="p-4 w-full bg-[#0B1120] border-t border-gray-800/80 text-center shrink-0 z-10">
          <p className="text-gray-500 text-sm">Copyright © 2026 TMail. All rights reserved.</p>
        </div>
      </main>

    </div>
  );
}
