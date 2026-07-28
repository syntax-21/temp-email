'use client';

import { useState, useEffect } from 'react';
import { Mail, RefreshCcw, Copy, CheckCircle2, Trash2 } from 'lucide-react';

export default function TempMail() {
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
    } else {
      generateNewEmail();
    }
  }, []);

  // Fetch email secara berkala setiap 10 detik
  useEffect(() => {
    if (!emailAddress) return;
    
    fetchEmails();
    const interval = setInterval(fetchEmails, 10000); 
    return () => clearInterval(interval);
  }, [emailAddress]);

  const generateNewEmail = () => {
    const randomString = Math.random().toString(36).substring(2, 10);
    const newEmail = `${randomString}@${domain}`;
    setEmailAddress(newEmail);
    localStorage.setItem('temp_email', newEmail);
    setEmails([]);
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

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4 pt-12">
          <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-full mb-4">
            <Mail className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            Temp Mail VIP
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Email sementara eksklusif Anda di domain {domain}. Terlindungi dari spam, bot, dan phishing.
          </p>
        </div>

        {/* Email Generator Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 md:p-10 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full bg-black/50 border border-gray-800 rounded-2xl p-4 flex items-center justify-between group hover:border-gray-700 transition-colors">
              <div className="flex items-center text-xl md:text-2xl font-mono text-gray-200 overflow-hidden w-full">
                <input 
                  type="text" 
                  value={emailAddress ? emailAddress.split('@')[0] : ''}
                  onChange={(e) => {
                    const prefix = e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, '');
                    if (!prefix) return;
                    const newEmail = `${prefix}@${domain}`;
                    setEmailAddress(newEmail);
                    localStorage.setItem('temp_email', newEmail);
                    setEmails([]);
                  }}
                  className="bg-transparent border-b-2 border-transparent hover:border-gray-600 focus:border-blue-500 focus:outline-none w-full max-w-[200px] md:max-w-[300px] text-right truncate"
                  placeholder="Ketik nama..."
                />
                <span className="text-gray-500 shrink-0">@{domain}</span>
              </div>
              <button 
                onClick={copyToClipboard}
                className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-gray-300 hover:text-white shrink-0 ml-2"
                title="Copy Email"
              >
                {copied ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <Copy className="w-6 h-6" />}
              </button>
            </div>
            
            <div className="flex gap-4 w-full md:w-auto">
              <button 
                onClick={fetchEmails}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-medium transition-colors"
              >
                <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button 
                onClick={generateNewEmail}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl font-medium transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                Ganti Email
              </button>
            </div>
          </div>
        </div>

        {/* Inbox Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-semibold">Kotak Masuk (Inbox)</h2>
            <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-medium">
              {emails.length} pesan
            </span>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-xl">
            {emails.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center text-gray-500 space-y-4">
                <div className="p-4 bg-gray-800/50 rounded-full animate-pulse">
                  <Mail className="w-8 h-8 opacity-50" />
                </div>
                <p>Menunggu email masuk...</p>
                <p className="text-sm opacity-50">Halaman ini otomatis me-refresh setiap 10 detik.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {emails.map((email) => (
                  <div key={email.id} className="p-0 hover:bg-gray-800/20 transition-colors">
                    {/* Header Email (Klik untuk buka/tutup) */}
                    <div 
                      onClick={() => setSelectedEmailId(selectedEmailId === email.id ? null : email.id)}
                      className="p-6 cursor-pointer flex flex-col md:flex-row md:justify-between md:items-center gap-2"
                    >
                      <div className="overflow-hidden">
                        <h3 className="font-semibold text-lg text-gray-200 truncate">
                          {email.fromName ? `${email.fromName} <${email.from}>` : email.from}
                        </h3>
                        <p className="text-gray-400 font-medium truncate mt-1">{email.subject}</p>
                      </div>
                      <p className="text-sm text-gray-500 shrink-0">{new Date(email.receivedAt).toLocaleString()}</p>
                    </div>

                    {/* Isi Email (Terbuka jika diklik) */}
                    {selectedEmailId === email.id && (
                      <div className="px-6 pb-6 pt-2 border-t border-gray-800/50">
                        {email.html ? (
                          <div className="bg-white rounded-2xl overflow-hidden mt-4 shadow-inner">
                            <iframe 
                              srcDoc={email.html} 
                              className="w-full min-h-[500px] border-0 bg-white"
                              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                            />
                          </div>
                        ) : (
                          <div className="bg-black/40 p-6 rounded-2xl text-base font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap mt-4 border border-gray-800/50">
                            {email.text || email.rawBody || 'Tidak ada konten teks / gagal memproses'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
