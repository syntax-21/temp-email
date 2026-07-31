'use client';

import { useState, useEffect } from 'react';
import { Lock, Mail, Activity, Eye, ChevronDown, ChevronUp, ShieldAlert, LogOut, RefreshCcw, Search, Inbox, Trash2, Ban, ShieldCheck, X, Settings, Shield, BarChart3, Database, Globe, List } from 'lucide-react';

export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Data States
  const [data, setData] = useState<any>({
    inboxes: [],
    bannedEmails: [],
    domains: [],
    reservedNames: [],
    bannedIps: [],
    settings: { expiry: 86400 },
    stats: { emailsReceived: 0 },
    systemLogs: []
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // UI States
  const [activeTab, setActiveTab] = useState('inboxes');
  const [search, setSearch] = useState('');
  const [expandedInbox, setExpandedInbox] = useState<string | null>(null);
  const [selectedHtmlEmail, setSelectedHtmlEmail] = useState<string | null>(null);

  // Form States
  const [newDomain, setNewDomain] = useState('');
  const [newReserved, setNewReserved] = useState('');
  const [newBannedIp, setNewBannedIp] = useState('');
  const [newBannedEmail, setNewBannedEmail] = useState('');
  const [expiryHours, setExpiryHours] = useState(24);

  // Authentication & Fetching
  const checkAuth = async (pass: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin', {
        headers: { 'Authorization': `Bearer ${pass}` }
      });
      if (res.ok) {
        setIsAuthenticated(true);
        const result = await res.json();
        setData(result);
        if (result.settings?.expiry) {
          setExpiryHours(result.settings.expiry / 3600);
        }
      } else {
        setError('Password salah atau sistem belum dikonfigurasi.');
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan.');
    }
    setLoading(false);
  };

  const refreshData = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin', {
        headers: { 'Authorization': `Bearer ${password}` }
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    checkAuth(password);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    setData({});
  };

  // --- ACTIONS ---
  const doAction = async (action: string, address?: string, value?: any) => {
    if (!confirm(`Yakin ingin melakukan aksi: ${action}?`)) return;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${password}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, address, value })
      });
      if (res.ok) {
        refreshData();
      } else {
        alert('Gagal melakukan aksi');
      }
    } catch (err) {
      alert('Error jaringan');
    }
  };

  const handleDeleteInbox = async (address: string) => {
    if (!confirm(`Yakin ingin menghapus seluruh email untuk ${address}?`)) return;
    try {
      const res = await fetch(`/api/admin?address=${address}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${password}` }
      });
      if (res.ok) {
        refreshData();
      } else {
        alert('Gagal menghapus inbox');
      }
    } catch (err) {
      alert('Error jaringan');
    }
  };

  const handleMasterReset = async () => {
    if (!confirm('PERINGATAN BAHAYA!\nApakah Anda yakin ingin MENGHAPUS SEMUA DATA EMAIL di server? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      const res = await fetch(`/api/admin?type=all_inboxes`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${password}` }
      });
      if (res.ok) {
        alert('Semua inbox berhasil dibersihkan.');
        refreshData();
      } else {
        alert('Gagal melakukan Master Reset.');
      }
    } catch (err) {
      alert('Error jaringan');
    }
  };

  const saveSettings = async () => {
    const expirySeconds = expiryHours * 3600;
    await doAction('save_settings', undefined, { expiry: expirySeconds });
    alert('Pengaturan berhasil disimpan!');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
          <div className="flex justify-center mb-6">
            <div className="bg-red-500/20 p-4 rounded-full">
              <ShieldAlert className="w-10 h-10 text-red-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">Admin Portal</h1>
          <p className="text-slate-400 text-center mb-8 text-sm">Masuk dengan kata sandi admin (ADMIN_PASSWORD)</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Kata Sandi Admin"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>
            </div>
            {error && <p className="text-red-400 text-sm font-medium text-center">{error}</p>}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-red-900/20 disabled:opacity-50"
            >
              {loading ? 'Memeriksa...' : 'Akses Sistem'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredInboxes = data.inboxes?.filter((inbox: any) => 
    inbox.address.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-4 md:p-8">
      {/* HTML EMAIL MODAL */}
      {selectedHtmlEmail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl ring-1 ring-white/10">
            <div className="bg-slate-100 px-4 sm:px-6 py-4 flex justify-between items-center border-b border-slate-200">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-500" /> Tampilan HTML Asli
              </h3>
              <button 
                onClick={() => setSelectedHtmlEmail(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="flex-1 w-full bg-white relative">
              <iframe 
                srcDoc={selectedHtmlEmail} 
                className="absolute inset-0 w-full h-full border-0"
                title="Email HTML View"
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <div>
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-red-500" />
              TMail Enterprise Admin
            </h1>
            <p className="text-slate-400 mt-1">Sistem manajemen dan kendali penuh</p>
          </div>
          <div className="flex gap-3">
            <button onClick={refreshData} disabled={loading} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors font-medium text-sm">
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Segarkan
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 bg-red-950/30 text-red-400 hover:bg-red-900/40 hover:text-red-300 px-4 py-2 rounded-lg transition-colors font-medium text-sm border border-red-900/30">
              <LogOut className="w-4 h-4" /> Keluar
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex overflow-x-auto gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800 hide-scrollbar">
          {[
            { id: 'inboxes', name: 'Kotak Masuk', icon: Inbox },
            { id: 'analytics', name: 'Statistik', icon: BarChart3 },
            { id: 'settings', name: 'Pengaturan Sistem', icon: Settings },
            { id: 'security', name: 'Keamanan', icon: Shield },
            { id: 'logs', name: 'Log Sistem', icon: List },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-red-500 text-white shadow-lg' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" /> {tab.name}
            </button>
          ))}
        </div>

        {/* MAIN CONTENT AREA */}
        
        {/* TAB 1: INBOXES */}
        {activeTab === 'inboxes' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <div className="relative w-full md:w-96">
                <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari alamat email..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>
              <button onClick={handleMasterReset} className="w-full md:w-auto bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-900/20 transition-colors">
                <Trash2 className="w-5 h-5" /> Master Reset (Hapus Semua)
              </button>
            </div>

            <div className="space-y-4">
              {filteredInboxes.map((inbox: any) => (
                <div key={inbox.address} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-all hover:border-slate-700">
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div 
                      className="flex items-center gap-3 sm:gap-4 cursor-pointer flex-1"
                      onClick={() => setExpandedInbox(expandedInbox === inbox.address ? null : inbox.address)}
                    >
                      <div className="bg-slate-950 p-2 sm:p-3 rounded-xl border border-slate-800">
                        <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-white font-mono truncate">{inbox.address}</h3>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">{inbox.count} pesan masuk</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button 
                        onClick={() => doAction('ban', inbox.address)}
                        className="flex-1 sm:flex-none bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 border border-orange-500/20"
                      >
                        <Ban className="w-4 h-4" /> Blokir
                      </button>
                      <button 
                        onClick={() => handleDeleteInbox(inbox.address)}
                        className="flex-1 sm:flex-none bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 border border-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" /> Bersihkan
                      </button>
                      <button 
                        onClick={() => setExpandedInbox(expandedInbox === inbox.address ? null : inbox.address)}
                        className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700 transition-colors"
                      >
                        {expandedInbox === inbox.address ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
                      </button>
                    </div>
                  </div>

                  {expandedInbox === inbox.address && (
                    <div className="bg-slate-950 border-t border-slate-800 p-4 sm:p-5">
                      <div className="space-y-4">
                        {inbox.emails.map((email: any, i: number) => (
                          <div key={i} className="bg-slate-900 border border-slate-800 p-4 rounded-xl relative overflow-hidden group">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                              <div>
                                <h4 className="font-bold text-white text-base sm:text-lg mb-1">{email.subject}</h4>
                                <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm">
                                  <span className="font-semibold">{email.fromName || email.from}</span>
                                  <span>•</span>
                                  <span className="font-mono">{email.from}</span>
                                </div>
                              </div>
                              <div className="text-xs sm:text-sm text-slate-500 font-mono whitespace-nowrap bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                                {new Date(email.receivedAt).toLocaleString('id-ID')}
                              </div>
                            </div>
                            
                            <div className="mt-3 text-slate-400 text-sm whitespace-pre-wrap line-clamp-3 px-1">
                              {email.text ? email.text : 'Hanya HTML'}
                            </div>

                            {email.html && (
                              <button 
                                onClick={() => setSelectedHtmlEmail(email.html)}
                                className="mt-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors w-full sm:w-auto justify-center"
                              >
                                <Eye className="w-4 h-4" /> Lihat HTML Asli
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filteredInboxes.length === 0 && (
                <div className="text-center py-12 text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Tidak ada kotak masuk yang ditemukan.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <div className="text-slate-400 font-bold mb-2">Total Kotak Masuk Aktif</div>
                <div className="text-5xl font-black text-white">{data.totalActiveInboxes}</div>
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <div className="text-slate-400 font-bold mb-2">Total Email Diterima (All Time)</div>
                <div className="text-5xl font-black text-blue-500">{data.stats?.emailsReceived || 0}</div>
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <div className="text-slate-400 font-bold mb-2">Domain Terdaftar</div>
                <div className="text-5xl font-black text-emerald-500">{data.domains?.length || 0}</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            
            {/* Expiry Settings */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-4">Pengaturan Pembersihan Otomatis</h3>
              <p className="text-slate-400 text-sm mb-4">Atur berapa lama email akan disimpan di server sebelum dihapus secara otomatis.</p>
              <div className="flex gap-4 items-center">
                <input 
                  type="number" 
                  value={expiryHours}
                  onChange={e => setExpiryHours(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white w-32 focus:border-red-500 outline-none"
                />
                <span className="text-slate-400">Jam</span>
                <button onClick={saveSettings} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-bold">Simpan</button>
              </div>
            </div>

            {/* Domains */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-4">Manajemen Domain Dinamis</h3>
              <p className="text-slate-400 text-sm mb-4">Daftar domain yang tersedia untuk dipilih pengunjung di halaman utama.</p>
              <div className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  value={newDomain}
                  onChange={e => setNewDomain(e.target.value)}
                  placeholder="contoh.com"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white flex-1 focus:border-red-500 outline-none"
                />
                <button onClick={() => doAction('add_domain', undefined, newDomain)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold">Tambah</button>
              </div>
              <div className="space-y-2">
                {data.domains?.map((d: string) => (
                  <div key={d} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="font-mono text-slate-300">{d}</span>
                    <button onClick={() => doAction('remove_domain', undefined, d)} className="text-red-500 hover:bg-red-500/20 p-2 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Reserved Names */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-4">Nama Email Dilarang (Reserved Names)</h3>
              <p className="text-slate-400 text-sm mb-4">Mencegah pengunjung membuat atau membaca alamat email dengan nama depan berikut (contoh: admin, root).</p>
              <div className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  value={newReserved}
                  onChange={e => setNewReserved(e.target.value)}
                  placeholder="admin"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white flex-1 focus:border-red-500 outline-none"
                />
                <button onClick={() => doAction('add_reserved', undefined, newReserved)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold">Tambah</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.reservedNames?.map((r: string) => (
                  <div key={r} className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    <span className="font-mono text-slate-300">{r}</span>
                    <button onClick={() => doAction('remove_reserved', undefined, r)} className="text-red-500 hover:text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: SECURITY */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Banned Emails */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-orange-500/20 p-3 rounded-xl"><Ban className="w-6 h-6 text-orange-500" /></div>
                <div>
                  <h2 className="text-xl font-bold text-white">Email Terblokir</h2>
                  <p className="text-slate-400 text-sm">Alamat yang tidak bisa menerima pesan</p>
                </div>
              </div>
              <div className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  value={newBannedEmail}
                  onChange={e => setNewBannedEmail(e.target.value)}
                  placeholder="email@domain.com"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white flex-1 focus:border-orange-500 outline-none text-sm"
                />
                <button onClick={() => doAction('ban', newBannedEmail)} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-sm">Blokir</button>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto pr-2 max-h-96 custom-scrollbar">
                {data.bannedEmails.length === 0 && <p className="text-slate-500 text-center py-4 text-sm">Belum ada email yang diblokir</p>}
                {data.bannedEmails.map((email: string) => (
                  <div key={email} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex justify-between items-center group">
                    <span className="text-slate-300 font-mono text-sm">{email}</span>
                    <button onClick={() => doAction('unban', email)} className="text-slate-500 hover:text-orange-500 px-2 py-1 rounded bg-slate-900 text-xs font-bold transition-colors">UNBAN</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Banned IPs */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-red-500/20 p-3 rounded-xl"><ShieldAlert className="w-6 h-6 text-red-500" /></div>
                <div>
                  <h2 className="text-xl font-bold text-white">IP Blacklist</h2>
                  <p className="text-slate-400 text-sm">IP yang diblokir dari akses web (Anti-bot)</p>
                </div>
              </div>
              <div className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  value={newBannedIp}
                  onChange={e => setNewBannedIp(e.target.value)}
                  placeholder="192.168.1.1"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white flex-1 focus:border-red-500 outline-none text-sm"
                />
                <button onClick={() => doAction('ban_ip', undefined, newBannedIp)} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm">Blokir IP</button>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto pr-2 max-h-96 custom-scrollbar">
                {data.bannedIps?.length === 0 && <p className="text-slate-500 text-center py-4 text-sm">Belum ada IP yang diblokir</p>}
                {data.bannedIps?.map((ip: string) => (
                  <div key={ip} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex justify-between items-center group">
                    <span className="text-slate-300 font-mono text-sm">{ip}</span>
                    <button onClick={() => doAction('unban_ip', undefined, ip)} className="text-slate-500 hover:text-red-500 px-2 py-1 rounded bg-slate-900 text-xs font-bold transition-colors">UNBAN</button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 5: SYSTEM LOGS */}
        {activeTab === 'logs' && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
            <h3 className="text-xl font-bold text-white mb-6">Riwayat Aktivitas Sistem</h3>
            <div className="space-y-3">
              {data.systemLogs?.length === 0 && <p className="text-slate-500 text-center py-4">Belum ada log sistem tercatat.</p>}
              {data.systemLogs?.map((log: any, index: number) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className={`px-2 py-1 rounded text-xs font-bold w-max ${log.type === 'master_reset' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {log.type.toUpperCase()}
                  </div>
                  <div className="text-slate-300 text-sm flex-1">{log.message}</div>
                  <div className="text-slate-500 text-xs font-mono">{new Date(log.timestamp).toLocaleString('id-ID')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
