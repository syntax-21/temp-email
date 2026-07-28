'use client';

import { useState, useEffect } from 'react';
import { Mail, RefreshCcw, Copy, CheckCircle2, Inbox } from 'lucide-react';

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
    <div className="flex h-screen w-full bg-gray-950 text-gray-200 font-sans overflow-hidden">
      
      {/* LEFT SIDEBAR (Controls) */}
      <aside className="w-72 bg-[#0948b3] flex flex-col p-6 shadow-xl z-20 shrink-0">
        <div className="flex items-center gap-3 text-white mb-10 justify-center">
          <Mail className="w-10 h-10" />
          <h1 className="text-3xl font-bold tracking-tight">TMail</h1>
        </div>

        <div className="space-y-4 flex-1">
          <div>
            <input 
              type="text" 
              value={emailPrefix}
              onChange={(e) => setEmailPrefix(e.target.value)}
              className="w-full bg-[#1b64d8] border-none rounded px-4 py-3 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all"
              placeholder="Enter Username"
            />
          </div>

          <div className="relative">
            <select 
              disabled
              className="w-full bg-[#1b64d8] border-none rounded px-4 py-3 text-white appearance-none opacity-90 cursor-not-allowed"
            >
              <option>{domain}</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-80 text-white text-xs">
              ▼
            </div>
          </div>

          <button 
            onClick={() => applyNewEmail(emailPrefix)}
            className="w-full bg-[#22c55e] hover:bg-green-600 text-white font-semibold rounded px-4 py-3 transition-colors mt-2"
          >
            Create
          </button>

          <div className="w-full h-[1px] bg-blue-400/30 my-6"></div>

          <button 
            onClick={generateRandomEmail}
            className="w-full bg-[#eab308] hover:bg-yellow-600 text-white font-semibold rounded px-4 py-3 transition-colors"
          >
            Random
          </button>

          <button 
            onClick={() => {
              if (emailAddress) setEmailPrefix(emailAddress.split('@')[0]);
            }}
            className="w-full bg-[#1456c7] hover:bg-blue-700 text-white rounded px-4 py-3 transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="mt-auto pt-6 text-center">
          <p className="text-blue-200 text-xs opacity-70 mb-2">Alamat Email Aktif:</p>
          <span className="font-mono text-white text-sm block bg-black/20 py-2 px-2 rounded cursor-pointer hover:bg-black/30 transition truncate" onClick={copyToClipboard} title="Click to copy">
            {emailAddress || '...'} {copied && '✓'}
          </span>
        </div>
      </aside>

      {/* MIDDLE COLUMN (Email List) */}
      <section className="w-80 lg:w-96 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 z-10">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <h2 className="font-semibold text-lg text-gray-100 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-gray-400" />
            Inbox
          </h2>
          <button 
            onClick={fetchEmails} 
            className="p-2 hover:bg-gray-800 rounded-full transition text-gray-400 hover:text-white"
            title="Refresh"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500 space-y-3 p-6 text-center">
              <RefreshCcw className={`w-6 h-6 opacity-20 ${loading ? 'animate-spin' : ''}`} />
              <p className="text-sm">Belum ada pesan.<br/>Otomatis refresh (10s).</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {emails.map((email) => (
                <div 
                  key={email.id} 
                  onClick={() => setSelectedEmailId(email.id)}
                  className={`p-5 cursor-pointer transition-colors border-l-4 ${selectedEmailId === email.id ? 'bg-gray-800 border-blue-500' : 'hover:bg-gray-800/50 border-transparent'}`}
                >
                  <div className="flex justify-between items-baseline mb-1 gap-2">
                    <h3 className="font-semibold text-gray-100 truncate text-base">
                      {email.fromName || email.from.split('@')[0]}
                    </h3>
                    <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
                      {/* Format to relative time like "6 hours ago" could be added, using LocaleString for now */}
                      {new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mb-2">{email.from}</p>
                  <p className="text-sm text-gray-300 truncate">{email.subject}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* RIGHT COLUMN (Email Reader) */}
      <main className="flex-1 bg-gray-950 flex flex-col relative overflow-hidden">
        {selectedEmail ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Email Header Info */}
            <div className="p-6 lg:p-8 border-b border-gray-800 bg-gray-900/30 shrink-0">
              <h2 className="text-2xl font-bold text-gray-100 mb-4">{selectedEmail.subject}</h2>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-900/50 text-blue-400 flex items-center justify-center font-bold text-lg shrink-0">
                  {(selectedEmail.fromName || selectedEmail.from)[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-200 text-sm">
                    {selectedEmail.fromName ? `${selectedEmail.fromName} <${selectedEmail.from}>` : selectedEmail.from}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(selectedEmail.receivedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Email Body Viewer */}
            <div className="flex-1 overflow-auto p-0 bg-gray-900">
              {selectedEmail.html ? (
                <div className="w-full h-full bg-white">
                  <iframe 
                    srcDoc={selectedEmail.html} 
                    className="w-full h-full border-0 bg-white"
                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                  />
                </div>
              ) : (
                <div className="p-6 lg:p-8 text-base font-mono text-gray-300 whitespace-pre-wrap h-full overflow-auto">
                  {selectedEmail.text || selectedEmail.rawBody || 'Tidak ada konten.'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 space-y-6 p-8 relative">
            <Mail className="w-32 h-32 opacity-10" strokeWidth={1} />
            <p className="text-xl font-medium">Pilih pesan di sebelah kiri untuk membacanya</p>
            
            {/* Background illustration decoration */}
            <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center overflow-hidden">
                <svg viewBox="0 0 800 600" className="w-[800px] h-auto">
                    <path d="M100 200 L400 400 L700 200 L700 500 L100 500 Z" fill="currentColor"/>
                    <path d="M100 200 L400 400 L700 200" stroke="white" strokeWidth="10" fill="none"/>
                </svg>
            </div>
          </div>
        )}

        {/* Footer Area */}
        <div className="p-4 w-full bg-gray-900 border-t border-gray-800 text-center shrink-0">
          <p className="text-gray-500 text-sm">Copyright © 2026 TMail. All rights reserved.</p>
        </div>
      </main>

    </div>
  );
}
