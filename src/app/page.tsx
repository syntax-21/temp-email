'use client';

import { useState, useEffect } from 'react';
import { Mail, RefreshCcw, Copy, Inbox, Sparkles, Menu, X, ChevronLeft } from 'lucide-react';

// Bank nama manusia populer untuk fungsi Randomize
const HUMAN_NAMES = [
  "alex", "jordan", "taylor", "morgan", "casey", "riley", "cameron", "avery", "quinn", "skyler", 
  "ryan", "dylan", "logan", "lucas", "liam", "emma", "olivia", "ava", "sophia", "isabella", 
  "mia", "charlotte", "amelia", "harper", "evelyn", "abigail", "emily", "elizabeth", "sofia", "ella", 
  "madison", "scarlett", "victoria", "aria", "grace", "chloe", "camila", "penelope", "layla", "lillian", 
  "nora", "zoey", "mila", "aubrey", "hannah", "addison", "eleanor", "natalie", "luna", "savannah", 
  "brooklyn", "leah", "zoe", "stella", "hazel", "ellie", "paisley", "audrey", "skylar", "violet", 
  "claire", "bella", "aurora", "lucy", "anna", "samantha", "caroline", "genesis", "aaliyah", "kennedy", 
  "kinsley", "allison", "maya", "sarah", "madelyn", "adeline", "alexa", "ariana", "elena", "gabriella", 
  "naomi", "alice", "sadie", "hailey", "eva", "emilia", "autumn", "nevaeh", "piper", "ruby", 
  "serenity", "willow", "everly", "cora", "kaylee", "lydia", "aubree", "ariel", "oliver", "elijah", 
  "william", "james", "benjamin", "henry", "alexander", "michael", "daniel", "matthew", "jackson", "sebastian", 
  "jack", "john", "luke", "wyatt", "levi", "isaac", "gabriel", "julian", "mateo", "anthony", 
  "jaxon", "lincoln", "joshua", "christopher", "andrew", "theodore", "caleb", "asher", "nathan", "thomas", 
  "leo", "isaiah", "charles", "josiah", "hudson", "christian", "hunter", "connor", "eli", "ezra", 
  "aaron", "landon", "adrian", "jonathan", "nolan", "jeremiah", "easton", "elias", "colton", "carson", 
  "robert", "angel", "maverick", "nicholas", "dominic", "jaxson", "greyson", "adam", "ian", "austin", 
  "santiago", "cooper", "brayden", "roman", "evan", "ezekiel", "xavier", "jose", "jace", "jameson", 
  "leonardo", "bryson", "axel", "everett", "parker", "kayden", "miles", "sawyer", "jason"
];

export default function TempMail() {
  const [emailPrefix, setEmailPrefix] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  
  // State khusus untuk navigasi Mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const domain = 'brepremiumstore.store';

  useEffect(() => {
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
    const interval = setInterval(fetchEmails, 10000); 
    return () => clearInterval(interval);
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
    setIsSidebarOpen(false); // Tutup sidebar di HP saat email baru dibuat
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
    <div className="flex flex-col lg:flex-row h-screen w-full bg-[#050505] text-gray-200 font-sans overflow-hidden selection:bg-indigo-500/30">
      
      {/* Background Ambient Glow (Visible mainly on Desktop) */}
      <div className="hidden lg:block absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none"></div>
      <div className="hidden lg:block absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[150px] pointer-events-none"></div>

      {/* MOBILE HEADER (Visible only on lg:hidden) */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/[0.05] z-40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 rounded-lg shadow-lg shadow-indigo-500/20">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            TMail<span className="text-indigo-500">.</span>
          </h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 bg-white/[0.05] rounded-lg text-gray-300 hover:text-white transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* LEFT SIDEBAR (Glassmorphism) - Responsive drawer on mobile */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#050505]/95 lg:bg-white/[0.02] backdrop-blur-3xl flex flex-col p-7 border-r border-white/[0.05] transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        lg:relative lg:shrink-0
      `}>
        {/* Mobile Sidebar Close Button & Logo */}
        <div className="flex items-center justify-between mb-10 mt-2">
          <div className="flex items-center gap-3 text-white">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 hidden lg:block">
              TMail<span className="text-indigo-500">.</span>
            </h1>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex flex-col space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider ml-1">Username</label>
              <input 
                type="text" 
                value={emailPrefix}
                onChange={(e) => setEmailPrefix(e.target.value)}
                className="w-full bg-white/[0.03] lg:bg-black/40 border border-white/[0.08] rounded-xl px-4 py-3.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm"
                placeholder="Enter Username"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider ml-1">Domain</label>
              <div className="relative">
                <select 
                  disabled
                  className="w-full bg-white/[0.03] lg:bg-black/40 border border-white/[0.08] rounded-xl px-4 py-3.5 text-gray-400 appearance-none opacity-80 cursor-not-allowed text-sm"
                >
                  <option>{domain}</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600 text-xs">
                  ▼
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => applyNewEmail(emailPrefix)}
              className="w-full relative group mt-2"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-500"></div>
              <div className="relative w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl px-4 py-3.5 transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25">
                <Sparkles className="w-4 h-4" />
                Generate Inbox
              </div>
            </button>
          </div>

          <div className="w-full h-px bg-white/[0.05] my-4"></div>

          <div className="space-y-3">
            <button 
              onClick={generateRandomEmail}
              className="w-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] text-gray-300 font-medium rounded-xl px-4 py-3 transition-all text-sm"
            >
              Randomize Name
            </button>

            <button 
              onClick={() => {
                if (emailAddress) setEmailPrefix(emailAddress.split('@')[0]);
              }}
              className="w-full bg-transparent hover:bg-white/[0.03] text-gray-500 hover:text-gray-300 font-medium rounded-xl px-4 py-3 transition-all text-sm"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-auto pt-8">
          <div 
            onClick={copyToClipboard}
            className="group relative bg-white/[0.03] lg:bg-black/30 border border-white/[0.05] hover:border-indigo-500/30 rounded-2xl p-4 cursor-pointer transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <p className="text-gray-500 text-[10px] font-medium uppercase tracking-widest mb-1.5 relative z-10">Active Address</p>
            <span className="font-mono text-gray-200 text-sm break-all leading-tight relative z-10 block pr-6">
              {emailAddress || '...'}
            </span>
            {copied && (
              <span className="absolute top-4 right-4 flex items-center justify-center w-5 h-5 bg-indigo-500 rounded-full shadow-lg shadow-indigo-500/20">
                <span className="text-white text-xs">✓</span>
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* Overlay untuk menutup sidebar di mobile saat terbuka */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* MIDDLE COLUMN (Email List) */}
      <section className={`
        ${selectedEmailId ? 'hidden lg:flex' : 'flex'} 
        w-full lg:w-[340px] xl:w-[380px] bg-[#0a0a0c]/80 backdrop-blur-xl border-r border-white/[0.05] flex-col shrink-0 z-10 h-[calc(100vh-73px)] lg:h-screen
      `}>
        <div className="p-4 lg:p-6 border-b border-white/[0.05] flex justify-between items-center bg-transparent shrink-0">
          <h2 className="font-semibold text-base text-gray-200 flex items-center gap-2">
            Inbox
            <span className="bg-indigo-500/20 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2">
              {emails.length}
            </span>
          </h2>
          <button 
            onClick={fetchEmails} 
            className="p-2.5 bg-white/[0.02] hover:bg-white/[0.08] border border-white/[0.05] rounded-xl transition-all text-gray-400 hover:text-white"
            title="Sync"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2">
          {emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
                <Inbox className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-400 font-medium mb-1">No messages yet</p>
                <p className="text-xs text-gray-600">Auto-syncing every 10 seconds.</p>
              </div>
            </div>
          ) : (
            emails.map((email) => (
              <div 
                key={email.id} 
                onClick={() => setSelectedEmailId(email.id)}
                className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden group ${
                  selectedEmailId === email.id 
                    ? 'bg-indigo-500/10 border border-indigo-500/20' 
                    : 'bg-transparent border border-transparent hover:bg-white/[0.02] hover:border-white/[0.05]'
                }`}
              >
                {selectedEmailId === email.id && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full hidden lg:block"></div>
                )}
                
                <div className="flex justify-between items-baseline mb-1 gap-2 pl-1">
                  <h3 className={`font-semibold truncate text-sm ${selectedEmailId === email.id ? 'text-indigo-100' : 'text-gray-300 group-hover:text-gray-200'}`}>
                    {email.fromName || email.from.split('@')[0]}
                  </h3>
                  <span className={`text-[11px] whitespace-nowrap shrink-0 font-medium ${selectedEmailId === email.id ? 'text-indigo-400/80' : 'text-gray-600'}`}>
                    {new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className={`text-[11px] truncate mb-2 pl-1 ${selectedEmailId === email.id ? 'text-indigo-300/70' : 'text-gray-500'}`}>
                  {email.from}
                </p>
                <p className="text-xs text-gray-400 truncate leading-relaxed pl-1">{email.subject}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* RIGHT COLUMN (Email Reader) */}
      <main className={`
        ${!selectedEmailId ? 'hidden lg:flex' : 'flex'} 
        flex-1 bg-transparent flex-col relative overflow-hidden z-10 h-[calc(100vh-73px)] lg:h-screen
      `}>
        {selectedEmail ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden lg:m-6 bg-white/[0.01] border-0 lg:border border-white/[0.05] lg:rounded-3xl shadow-2xl backdrop-blur-sm">
            {/* Email Header Info */}
            <div className="p-4 lg:p-8 border-b border-white/[0.05] bg-gradient-to-b from-white/[0.03] to-transparent shrink-0">
              
              {/* Back button for mobile */}
              <button 
                onClick={() => setSelectedEmailId(null)}
                className="lg:hidden flex items-center gap-1 text-indigo-400 mb-4 hover:text-indigo-300 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="font-medium text-sm">Kembali ke Inbox</span>
              </button>

              <h2 className="text-xl lg:text-2xl font-bold text-gray-100 mb-6 leading-snug">{selectedEmail.subject}</h2>
              <div className="flex items-center gap-3 lg:gap-4">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 text-indigo-400 flex items-center justify-center font-bold text-lg lg:text-xl shrink-0 border border-indigo-500/20 shadow-inner">
                  {(selectedEmail.fromName || selectedEmail.from)[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-200 text-sm truncate">
                    {selectedEmail.fromName ? `${selectedEmail.fromName} ` : ''}
                    <span className="text-gray-500 font-normal">&lt;{selectedEmail.from}&gt;</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span>{new Date(selectedEmail.receivedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-700 hidden sm:block"></span>
                    <span>{new Date(selectedEmail.receivedAt).toLocaleTimeString()}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Email Body Viewer */}
            <div className="flex-1 overflow-auto p-0 bg-transparent lg:rounded-b-3xl">
              {selectedEmail.html ? (
                <div className="w-full h-full bg-[#f8fafc] transition-all relative">
                  <div className="absolute inset-0 border-t border-white/[0.05] pointer-events-none"></div>
                  <iframe 
                    srcDoc={selectedEmail.html} 
                    className="w-full h-full border-0 bg-transparent"
                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                  />
                </div>
              ) : (
                <div className="p-4 lg:p-8 text-sm font-mono text-gray-300 whitespace-pre-wrap h-full overflow-auto leading-relaxed bg-[#050505] lg:bg-transparent">
                  {selectedEmail.text || selectedEmail.rawBody || 'Tidak ada konten.'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-8 p-8 relative">
            <div className="relative w-64 h-64 flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-600/10 rounded-full blur-3xl"></div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5" className="w-32 h-32 text-indigo-500/30 drop-shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <div className="text-center space-y-2 relative z-10">
              <p className="text-xl font-semibold text-gray-300">Your Inbox is Ready</p>
              <p className="text-sm text-gray-500">Select a message from the sidebar to view its contents.</p>
            </div>
          </div>
        )}
      </main>

    </div>
  );
}
