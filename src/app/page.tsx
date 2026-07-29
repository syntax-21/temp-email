'use client';

import { useState, useEffect } from 'react';
import { Mail, RefreshCcw, Copy, Inbox, Sparkles, ChevronLeft, Shield, Zap, Lock, QrCode, X } from 'lucide-react';
import { HUMAN_NAMES } from '../utils/names';

export default function TempMail() {
  const [emailPrefix, setEmailPrefix] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [showQrModal, setShowQrModal] = useState(false);

  const domain = 'brepremiumstore.store';

  useEffect(() => {
    // Check for email in URL query parameters first (e.g. from QR scan)
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    
    if (emailParam) {
      applyNewEmail(emailParam);
      // Clean up the URL without refreshing the page
      window.history.replaceState({}, '', '/');
      return;
    }

    const savedEmail = localStorage.getItem('temp_email');
    if (savedEmail && savedEmail.endsWith(`@${domain}`)) {
      setEmailAddress(savedEmail);
      setEmailPrefix(savedEmail.split('@')[0]);
    } else {
      generateRandomEmail();
    }
  }, []);

  useEffect(() => {
    if (!emailAddress) return;
    
    fetchEmails();
    setCountdown(10);
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchEmails();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [emailAddress]);

  const generateRandomEmail = () => {
    const randomName = HUMAN_NAMES[Math.floor(Math.random() * HUMAN_NAMES.length)];
    const randomNumber = Math.floor(Math.random() * 999) + 1;
    applyNewEmail(`${randomName}${randomNumber}`);
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
    <div className="min-h-screen w-full bg-[#030712] text-slate-200 font-sans selection:bg-blue-500/30">
      
      {/* HEADER */}
      <header className="w-full border-b border-white/[0.05] bg-[#030712]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-1.5 rounded-lg shadow-lg shadow-blue-500/20">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              TMail<span className="text-blue-500">.</span>
            </h1>
          </div>
          {/* Removed Premium Text */}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12 flex flex-col items-center">
        
        {/* HERO SECTION (WELCOME & EMAIL INPUT) */}
        <div className="w-full max-w-3xl flex flex-col items-center text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">Selamat Datang di TMail</h2>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-10 max-w-2xl">
            TMail (Temporary Mail) adalah layanan penyedia alamat email sementara gratis. 
            Gunakan alamat email di bawah ini untuk mendaftar ke situs web, forum, atau aplikasi yang tidak Anda percayai 
            guna menjaga kotak masuk utama Anda tetap bersih dari pesan spam.
          </p>

          {/* Huge Email Box */}
          <div className="w-full bg-slate-900/50 border border-blue-500/30 rounded-2xl p-4 md:p-6 shadow-[0_0_40px_-10px_rgba(59,130,246,0.15)] relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
            
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Alamat Email Sementara Anda</p>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <div className="relative w-full flex items-center bg-slate-950 border border-slate-800 rounded-xl focus-within:border-blue-500/50 transition-colors pl-5 overflow-hidden">
                <input 
                  type="text" 
                  value={emailPrefix}
                  onChange={(e) => applyNewEmail(e.target.value)}
                  placeholder="ketik_nama_bebas"
                  className="w-full bg-transparent py-4 text-white font-mono text-lg md:text-xl focus:outline-none placeholder-slate-600"
                />
                <span className="text-slate-500 font-mono text-lg md:text-xl pr-5 py-4 shrink-0 select-none bg-slate-900/30 border-l border-slate-800 ml-2">
                  @{domain}
                </span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
                <button 
                  onClick={copyToClipboard}
                  className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl px-6 py-4 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  {copied ? <span className="text-white">Tersalin!</span> : <><Copy className="w-5 h-5" /> Copy</>}
                </button>
                <button 
                  onClick={() => setShowQrModal(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl px-4 py-4 transition-all border border-slate-700 hover:border-slate-500 flex items-center justify-center"
                  title="Tampilkan QR Code"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 w-full">
              <button 
                onClick={generateRandomEmail}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl px-4 py-3.5 transition-all text-sm flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-600"
              >
                <Sparkles className="w-4 h-4 text-cyan-400" /> Randomize Name
              </button>

              <button 
                onClick={() => {
                  fetchEmails();
                  setCountdown(10);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl px-4 py-3.5 transition-all text-sm flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-600"
              >
                <RefreshCcw className={`w-4 h-4 text-blue-400 ${loading ? 'animate-spin' : ''}`} /> Refresh ({countdown}s)
              </button>
            </div>
          </div>
        </div>

        {/* CONTENT AREA (INBOX & READER) */}
        <div className="w-full bg-slate-900/30 border border-slate-800 rounded-3xl overflow-hidden flex flex-col lg:flex-row shadow-2xl min-h-[600px] max-h-[800px]">
          
          {/* INBOX LIST (Left side on Desktop, toggled on Mobile) */}
          <div className={`${selectedEmailId ? 'hidden lg:flex' : 'flex'} w-full lg:w-[380px] bg-slate-900/50 flex-col border-r border-slate-800 shrink-0`}>
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 shrink-0">
              <h3 className="font-bold text-lg text-slate-200 flex items-center gap-2.5">
                <Inbox className="w-5 h-5 text-slate-400" />
                Kotak Masuk
                <span className="bg-blue-500/20 text-blue-400 text-xs px-2.5 py-0.5 rounded-full ml-1">
                  {emails.length}
                </span>
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center border border-slate-700/50">
                    <Inbox className="w-6 h-6 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Belum ada pesan masuk.</p>
                    <p className="text-xs text-slate-600 mt-1">Sistem menyegarkan otomatis setiap 10 detik.</p>
                  </div>
                </div>
              ) : (
                emails.map((email) => (
                  <div 
                    key={email.id} 
                    onClick={() => setSelectedEmailId(email.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all duration-200 relative overflow-hidden ${
                      selectedEmailId === email.id 
                        ? 'bg-blue-900/20 border border-blue-500/30' 
                        : 'bg-transparent border border-transparent hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    {selectedEmailId === email.id && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full"></div>
                    )}
                    <div className="flex justify-between items-baseline mb-1 gap-2 pl-1">
                      <h4 className={`font-semibold truncate text-sm ${selectedEmailId === email.id ? 'text-blue-100' : 'text-slate-200'}`}>
                        {email.fromName || email.from.split('@')[0]}
                      </h4>
                      <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0 font-medium">
                        {new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={`text-[11px] truncate mb-2 pl-1 ${selectedEmailId === email.id ? 'text-blue-300/80' : 'text-slate-400'}`}>
                      {email.from}
                    </p>
                    <p className="text-xs text-slate-500 truncate leading-relaxed pl-1">{email.subject}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* EMAIL READER (Right side on Desktop, toggled on Mobile) */}
          <div className={`${!selectedEmailId ? 'hidden lg:flex' : 'flex'} flex-1 flex-col bg-slate-950 relative`}>
            {selectedEmail ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="p-5 md:p-8 border-b border-slate-800 bg-slate-900/40 shrink-0">
                  <button 
                    onClick={() => setSelectedEmailId(null)}
                    className="lg:hidden flex items-center gap-1 text-blue-400 mb-5 hover:text-blue-300 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="font-medium text-sm">Kembali ke Inbox</span>
                  </button>

                  <h2 className="text-xl md:text-2xl font-bold text-slate-100 mb-6 leading-snug">{selectedEmail.subject}</h2>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-900/40 text-blue-400 flex items-center justify-center font-bold text-xl shrink-0 border border-blue-800/50">
                      {(selectedEmail.fromName || selectedEmail.from)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-200 text-sm truncate">
                        {selectedEmail.fromName ? `${selectedEmail.fromName} ` : ''}
                        <span className="text-slate-500 font-normal">&lt;{selectedEmail.from}&gt;</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{new Date(selectedEmail.receivedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                        <span>{new Date(selectedEmail.receivedAt).toLocaleTimeString()}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto bg-[#f8fafc] relative">
                  {selectedEmail.html ? (
                    <iframe 
                      srcDoc={selectedEmail.html} 
                      className="w-full h-full border-0 bg-white"
                      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                    />
                  ) : (
                    <div className="p-8 text-sm font-mono text-slate-800 whitespace-pre-wrap h-full overflow-auto bg-white">
                      {selectedEmail.text || selectedEmail.rawBody || 'Tidak ada konten.'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 relative">
                <div className="relative w-48 h-48 flex items-center justify-center mb-6">
                  <div className="absolute inset-0 bg-blue-500/5 rounded-full blur-3xl"></div>
                  <Mail className="w-24 h-24 text-slate-800 drop-shadow-md" strokeWidth={1} />
                </div>
                <div className="text-center space-y-2 relative z-10">
                  <p className="text-xl font-semibold text-slate-300">Pilih pesan di daftar untuk mulai membaca.</p>
                  <p className="text-sm text-slate-500">Pesan baru akan otomatis muncul di sebelah kiri.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FEATURES SECTION */}
        <div className="w-full max-w-5xl mt-24 mb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 md:p-8 text-center hover:bg-slate-900/60 transition-colors">
              <div className="w-14 h-14 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center mb-5">
                <Shield className="w-7 h-7 text-blue-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-200 mb-3">Anti Spam</h3>
              <p className="text-sm text-slate-400 leading-relaxed">Lindungi email utama Anda dari promosi, spam, dan ancaman phising di internet. Kotak masuk asli Anda tetap bersih.</p>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 md:p-8 text-center hover:bg-slate-900/60 transition-colors">
              <div className="w-14 h-14 mx-auto rounded-full bg-cyan-500/10 flex items-center justify-center mb-5">
                <Zap className="w-7 h-7 text-cyan-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-200 mb-3">Instan & Anonim</h3>
              <p className="text-sm text-slate-400 leading-relaxed">Tanpa perlu daftar, tanpa password. Sekali klik, alamat email langsung siap dipakai untuk verifikasi akun.</p>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 md:p-8 text-center hover:bg-slate-900/60 transition-colors">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-5">
                <Lock className="w-7 h-7 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-200 mb-3">Privasi Terjaga</h3>
              <p className="text-sm text-slate-400 leading-relaxed">Pesan yang masuk bersifat sementara dan tidak dapat dilacak. Kami menjaga privasi Anda dengan sangat ketat.</p>
            </div>
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="w-full border-t border-slate-800/60 bg-[#030712] py-8 text-center">
        <p className="text-slate-500 text-sm">Copyright © 2026 TMail. All rights reserved.</p>
      </footer>

      {/* QR CODE MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full relative">
            <button 
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="p-8 flex flex-col items-center text-center">
              <QrCode className="w-10 h-10 text-blue-500 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Akses Kembali Email Ini</h3>
              <p className="text-slate-400 text-sm mb-6">
                Pindai QR code ini di perangkat lain untuk membuka kotak masuk <span className="text-blue-400 font-medium">{emailAddress}</span>
              </p>
              
              <div className="bg-white p-4 rounded-xl shadow-inner mb-6">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://www.brepremiumstore.store/?email=${emailPrefix}`)}`} 
                  alt="QR Code" 
                  className="w-48 h-48 object-contain"
                />
              </div>
              
              <button 
                onClick={() => setShowQrModal(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
