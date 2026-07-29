'use client';

import { useState, useEffect, useRef } from 'react';
import { Mail, RefreshCcw, Copy, Inbox, Sparkles, ChevronLeft, Shield, Zap, Lock, QrCode, X, History, Globe, AlertTriangle, Key } from 'lucide-react';
import { HUMAN_NAMES } from '../utils/names';
import { t, Language } from '../utils/translations';
import { playNotificationSound } from '../utils/audio';
import { scanEmailSecurity } from '../utils/security';

export default function TempMail() {
  const [lang, setLang] = useState<Language>('id');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);
  
  // Modals & Overlays
  const [showQrModal, setShowQrModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // History state
  const [emailHistory, setEmailHistory] = useState<string[]>([]);
  
  // Security / PIN state
  const [pin, setPin] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinError, setPinError] = useState(false);

  // Sound & Notification tracking
  const prevEmailCountRef = useRef<number>(0);
  const initialLoadRef = useRef<boolean>(true);

  const domain = 'brepremiumstore.store';

  // Ask for notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Check URL & LocalStorage on mount
  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem('tmail_history') || '[]');
    setEmailHistory(savedHistory);

    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    
    if (emailParam) {
      applyNewEmail(emailParam);
      window.history.replaceState({}, '', '/');
      return;
    }

    const savedEmail = localStorage.getItem('temp_email');
    if (savedEmail && savedEmail.endsWith(`@${domain}`)) {
      setEmailAddress(savedEmail);
      setEmailPrefix(savedEmail.split('@')[0]);
      checkPinStatus(savedEmail);
    } else {
      generateRandomEmail();
    }
  }, []);

  // Main Interval
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

  const addToHistory = (email: string) => {
    const saved = JSON.parse(localStorage.getItem('tmail_history') || '[]');
    const updated = [email, ...saved.filter((e: string) => e !== email)].slice(0, 5);
    localStorage.setItem('tmail_history', JSON.stringify(updated));
    setEmailHistory(updated);
  };

  const checkPinStatus = (email: string) => {
    const savedPin = localStorage.getItem(`tmail_pin_${email}`);
    if (savedPin) {
      setPin(savedPin);
      setIsLocked(true);
    } else {
      setPin('');
      setIsLocked(false);
    }
    setInputPin('');
    setPinError(false);
    setShowPinSetup(false);
  };

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
    prevEmailCountRef.current = 0;
    initialLoadRef.current = true;
    
    addToHistory(newEmail);
    checkPinStatus(newEmail);
  };

  const fetchEmails = async () => {
    if (!emailAddress || isLocked) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/emails?address=${emailAddress}`);
      const data = await res.json();
      if (data.emails) {
        setEmails(data.emails);
        
        // Notification logic
        if (!initialLoadRef.current && data.emails.length > prevEmailCountRef.current) {
          playNotificationSound();
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('TMail', {
              body: 'Anda mendapat email baru!',
              icon: '/icon.svg'
            });
          }
        }
        prevEmailCountRef.current = data.emails.length;
        initialLoadRef.current = false;
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

  const handleUnlock = () => {
    if (inputPin === pin) {
      setIsLocked(false);
      setPinError(false);
      initialLoadRef.current = true;
      fetchEmails();
    } else {
      setPinError(true);
    }
  };

  const savePin = () => {
    if (inputPin.length === 4) {
      localStorage.setItem(`tmail_pin_${emailAddress}`, inputPin);
      setPin(inputPin);
      setShowPinSetup(false);
    }
  };

  const selectedEmail = emails.find(e => e.id === selectedEmailId);
  const securityScan = selectedEmail ? scanEmailSecurity(selectedEmail.html, selectedEmail.text) : null;

  return (
    <div className="min-h-screen w-full bg-[#030712] text-slate-200 font-sans selection:bg-blue-500/30 relative">
      
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
          <button 
            onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-300 transition-colors border border-slate-700"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            {lang.toUpperCase()}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12 flex flex-col items-center">
        
        {/* HERO SECTION */}
        <div className="w-full max-w-3xl flex flex-col items-center text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">{t(lang, 'welcomeTitle')}</h2>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-10 max-w-2xl">
            {t(lang, 'welcomeDesc')}
          </p>

          <div className="w-full bg-slate-900/50 border border-blue-500/30 rounded-2xl p-4 md:p-6 shadow-[0_0_40px_-10px_rgba(59,130,246,0.15)] relative overflow-visible backdrop-blur-xl z-20">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
            
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">{t(lang, 'yourEmail')}</p>
              
              {/* History Dropdown & Lock */}
              <div className="flex gap-2 relative">
                {!pin && (
                  <button onClick={() => setShowPinSetup(!showPinSetup)} className="text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 text-xs font-semibold bg-slate-800 px-2 py-1 rounded">
                    <Key className="w-3.5 h-3.5" /> {t(lang, 'lockInbox')}
                  </button>
                )}
                {pin && !isLocked && (
                  <span className="text-emerald-400 flex items-center gap-1 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                    <Lock className="w-3.5 h-3.5" /> Locked
                  </span>
                )}
                
                <div className="relative">
                  <button onClick={() => setShowHistory(!showHistory)} className="text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1 text-xs font-semibold bg-slate-800 px-2 py-1 rounded">
                    <History className="w-3.5 h-3.5" /> {t(lang, 'history')}
                  </button>
                  {showHistory && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                      {emailHistory.map((h, i) => (
                        <button key={i} onClick={() => { applyNewEmail(h.split('@')[0]); setShowHistory(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 border-b border-slate-700/50 truncate">
                          {h}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PIN SETUP */}
            {showPinSetup && !pin && (
              <div className="mb-4 bg-slate-950 p-4 rounded-xl border border-emerald-500/30 flex gap-2">
                <input type="password" maxLength={4} placeholder="PIN" value={inputPin} onChange={e => setInputPin(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white w-32 focus:border-emerald-500 outline-none" />
                <button onClick={savePin} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded text-sm font-semibold">{t(lang, 'createPin')}</button>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full relative z-10">
              <div className="relative w-full flex items-center bg-slate-950 border border-slate-800 rounded-xl focus-within:border-blue-500/50 transition-colors pl-5 overflow-hidden">
                <input 
                  type="text" 
                  value={emailPrefix}
                  onChange={(e) => applyNewEmail(e.target.value)}
                  placeholder={t(lang, 'typeCustomName')}
                  className="w-full bg-transparent py-4 text-white font-mono text-lg md:text-xl focus:outline-none placeholder-slate-600"
                />
                <span className="text-slate-500 font-mono text-lg md:text-xl pr-5 py-4 shrink-0 select-none bg-slate-900/30 border-l border-slate-800 ml-2">
                  @{domain}
                </span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
                <button onClick={copyToClipboard} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl px-6 py-4 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                  {copied ? <span className="text-white">{t(lang, 'copied')}</span> : <><Copy className="w-5 h-5" /> {t(lang, 'copy')}</>}
                </button>
                <button onClick={() => setShowQrModal(true)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl px-4 py-4 transition-all border border-slate-700 hover:border-slate-500 flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 w-full">
              <button onClick={generateRandomEmail} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl px-4 py-3.5 transition-all text-sm flex items-center justify-center gap-2 border border-slate-700">
                <Sparkles className="w-4 h-4 text-cyan-400" /> {t(lang, 'randomize')}
              </button>
              <button onClick={() => { fetchEmails(); setCountdown(10); }} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl px-4 py-3.5 transition-all text-sm flex items-center justify-center gap-2 border border-slate-700">
                <RefreshCcw className={`w-4 h-4 text-blue-400 ${loading ? 'animate-spin' : ''}`} /> {t(lang, 'refresh')} ({countdown}s)
              </button>
            </div>
          </div>
        </div>

        {/* INBOX SECTION */}
        <div className="w-full bg-slate-900/30 border border-slate-800 rounded-3xl overflow-hidden flex flex-col lg:flex-row shadow-2xl min-h-[600px] max-h-[800px] relative">
          
          {/* PIN LOCK OVERLAY */}
          {isLocked && (
            <div className="absolute inset-0 z-50 bg-[#030712]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-2xl border border-slate-700">
                <Lock className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{t(lang, 'lockInbox')}</h3>
              <p className="text-slate-400 mb-8 max-w-md">{t(lang, 'lockedDesc')}</p>
              
              <div className="flex flex-col gap-3">
                <input type="password" maxLength={4} placeholder="PIN" value={inputPin} onChange={e => setInputPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUnlock()} className="bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl px-6 py-4 text-center text-2xl tracking-[0.5em] font-mono text-white outline-none w-64 shadow-inner" />
                {pinError && <p className="text-red-400 text-sm font-semibold">{t(lang, 'wrongPin')}</p>}
                <button onClick={handleUnlock} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-900/50">
                  {t(lang, 'unlock')}
                </button>
              </div>
            </div>
          )}

          {/* INBOX LIST */}
          <div className={`${selectedEmailId ? 'hidden lg:flex' : 'flex'} w-full lg:w-[380px] bg-slate-900/50 flex-col border-r border-slate-800 shrink-0`}>
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 shrink-0">
              <h3 className="font-bold text-lg text-slate-200 flex items-center gap-2.5">
                <Inbox className="w-5 h-5 text-slate-400" />
                {t(lang, 'inbox')}
                <span className="bg-blue-500/20 text-blue-400 text-xs px-2.5 py-0.5 rounded-full ml-1">{emails.length}</span>
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center border border-slate-700/50">
                    <Inbox className="w-6 h-6 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">{t(lang, 'emptyInbox')}</p>
                    <p className="text-xs text-slate-600 mt-1">{t(lang, 'autoRefreshHint')}</p>
                  </div>
                </div>
              ) : (
                emails.map((email) => (
                  <div key={email.id} onClick={() => setSelectedEmailId(email.id)} className={`p-4 rounded-xl cursor-pointer transition-all duration-200 relative overflow-hidden ${selectedEmailId === email.id ? 'bg-blue-900/20 border border-blue-500/30' : 'bg-transparent border border-transparent hover:bg-slate-800/50 hover:border-slate-700'}`}>
                    {selectedEmailId === email.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full"></div>}
                    <div className="flex justify-between items-baseline mb-1 gap-2 pl-1">
                      <h4 className={`font-semibold truncate text-sm ${selectedEmailId === email.id ? 'text-blue-100' : 'text-slate-200'}`}>{email.fromName || email.from.split('@')[0]}</h4>
                      <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0 font-medium">{new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className={`text-[11px] truncate mb-2 pl-1 ${selectedEmailId === email.id ? 'text-blue-300/80' : 'text-slate-400'}`}>{email.from}</p>
                    <p className="text-xs text-slate-500 truncate leading-relaxed pl-1">{email.subject}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* EMAIL READER */}
          <div className={`${!selectedEmailId ? 'hidden lg:flex' : 'flex'} flex-1 flex-col bg-slate-950 relative`}>
            {selectedEmail ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="p-5 md:p-8 border-b border-slate-800 bg-slate-900/40 shrink-0">
                  <button onClick={() => setSelectedEmailId(null)} className="lg:hidden flex items-center gap-1 text-blue-400 mb-5 hover:text-blue-300">
                    <ChevronLeft className="w-5 h-5" />
                    <span className="font-medium text-sm">Kembali</span>
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
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(selectedEmail.receivedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* SECURITY RADAR BANNER */}
                {securityScan && !securityScan.isSafe && (
                  <div className="bg-red-500/10 border-b border-red-500/30 p-4 flex gap-3 items-start shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-400 text-sm mb-1">Peringatan Keamanan!</p>
                      <ul className="text-red-300/80 text-xs space-y-1 list-disc pl-4">
                        {securityScan.warnings.map((warn: string, i: number) => <li key={i}>{warn}</li>)}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-auto bg-[#f8fafc] relative">
                  {selectedEmail.html ? (
                    <iframe srcDoc={selectedEmail.html} className="w-full h-full border-0 bg-white" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin" />
                  ) : (
                    <div className="p-8 text-sm font-mono text-slate-800 whitespace-pre-wrap h-full overflow-auto bg-white">
                      {selectedEmail.text || selectedEmail.rawBody || 'Tidak ada konten.'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
                <div className="relative w-48 h-48 flex items-center justify-center mb-6">
                  <div className="absolute inset-0 bg-blue-500/5 rounded-full blur-3xl"></div>
                  <Mail className="w-24 h-24 text-slate-800 drop-shadow-md" strokeWidth={1} />
                </div>
                <div className="text-center space-y-2 relative z-10">
                  <p className="text-xl font-semibold text-slate-300">Pilih pesan di daftar untuk mulai membaca.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-slate-800/60 bg-[#030712] py-8 text-center">
        <p className="text-slate-500 text-sm">Copyright © 2026 TMail. All rights reserved.</p>
      </footer>

      {showQrModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full relative">
            <button onClick={() => setShowQrModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="p-8 flex flex-col items-center text-center">
              <QrCode className="w-10 h-10 text-blue-500 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">{t(lang, 'accessQrTitle')}</h3>
              <p className="text-slate-400 text-sm mb-6">{t(lang, 'accessQrDesc')} <span className="text-blue-400 font-medium">{emailAddress}</span></p>
              <div className="bg-white p-4 rounded-xl shadow-inner mb-6">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://www.brepremiumstore.store/?email=${emailPrefix}`)}`} alt="QR Code" className="w-48 h-48 object-contain" />
              </div>
              <button onClick={() => setShowQrModal(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-xl transition-colors">{t(lang, 'close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
