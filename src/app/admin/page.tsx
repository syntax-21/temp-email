'use client';

import { useState, useEffect } from 'react';
import { Lock, Mail, Activity, Eye, ChevronDown, ChevronUp, ShieldAlert, LogOut, RefreshCcw, Search, Inbox, Trash2, Ban, ShieldCheck, X } from 'lucide-react';

export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'inboxes' | 'banned'>('inboxes');
  
  const [expandedInboxes, setExpandedInboxes] = useState<Record<string, boolean>>({});
  const [selectedHtmlEmail, setSelectedHtmlEmail] = useState<string | null>(null);

  const fetchDashboardData = async (pwd: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin', {
        headers: { 'Authorization': `Bearer ${pwd}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
        setIsAuthenticated(true);
        setError('');
      } else {
        setError('Password Akses Salah atau Ditolak!');
        setIsAuthenticated(false);
      }
    } catch (err) {
      setError('Gagal menghubungi server database.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDashboardData(password);
  };

  const handleRefresh = () => {
    fetchDashboardData(password);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    setDashboardData(null);
  };

  const toggleExpand = (address: string) => {
    setExpandedInboxes(prev => ({
      ...prev,
      [address]: !prev[address]
    }));
  };

  const handleDeleteInbox = async (address: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus seluruh isi inbox untuk ${address}?`)) return;
    try {
      const res = await fetch(`/api/admin?address=${encodeURIComponent(address)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${password}` }
      });
      if (res.ok) {
        handleRefresh();
      } else {
        alert('Gagal menghapus inbox');
      }
    } catch (e) {
      alert('Terjadi kesalahan jaringan');
    }
  };

  const handleBanToggle = async (address: string, isBanned: boolean) => {
    const action = isBanned ? 'unban' : 'ban';
    if (!confirm(`Apakah Anda yakin ingin ${isBanned ? 'Membuka Blokir' : 'Memblokir'} email ${address}?`)) return;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${password}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address, action })
      });
      if (res.ok) {
        handleRefresh();
      } else {
        alert(`Gagal melakukan ${action}`);
      }
    } catch (e) {
      alert('Terjadi kesalahan jaringan');
    }
  };

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full bg-[#030712] flex items-center justify-center p-4 selection:bg-red-500/30">
        <div className="w-full max-w-md bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
          
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
              <ShieldAlert className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Restricted Area</h1>
            <p className="text-slate-400 text-sm">Halaman ini hanya untuk Administrator TMail.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password Admin"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                autoFocus
              />
            </div>
            
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl py-3.5 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : 'Akses Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // DASHBOARD SCREEN
  const filteredInboxes = dashboardData?.inboxes?.filter((inbox: any) => 
    inbox.address.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const bannedEmails = dashboardData?.bannedEmails || [];

  return (
    <div className="min-h-screen w-full bg-[#030712] text-slate-200 font-sans selection:bg-red-500/30">
      
      {/* HTML EMAIL MODAL */}
      {selectedHtmlEmail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" /> Tampilan HTML Asli
              </h3>
              <button 
                onClick={() => setSelectedHtmlEmail(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-white relative overflow-hidden">
              <iframe 
                srcDoc={selectedHtmlEmail}
                className="w-full h-full border-none absolute inset-0"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="w-full border-b border-white/[0.05] bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/20 p-1.5 rounded-lg border border-red-500/30">
              <Activity className="w-5 h-5 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-white">
              TMail <span className="text-slate-500 font-normal">| Admin Panel</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleRefresh} className="text-slate-400 hover:text-white transition-colors p-2" title="Refresh Data">
              <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-semibold text-slate-300 transition-colors border border-slate-700">
              <LogOut className="w-4 h-4" /> Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        
        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex items-center gap-6">
            <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
              <Mail className="w-7 h-7 text-blue-500" />
            </div>
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Total Alamat Aktif</p>
              <h2 className="text-3xl font-bold text-white">{dashboardData?.totalActiveInboxes || 0}</h2>
            </div>
          </div>
          
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex items-center gap-6">
            <div className="w-14 h-14 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
              <Inbox className="w-7 h-7 text-emerald-500" />
            </div>
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Total Pesan Tersimpan</p>
              <h2 className="text-3xl font-bold text-white">
                {dashboardData?.inboxes?.reduce((acc: number, curr: any) => acc + curr.count, 0) || 0}
              </h2>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex items-center gap-6">
            <div className="w-14 h-14 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
              <Ban className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Total Alamat Diblokir</p>
              <h2 className="text-3xl font-bold text-white">{bannedEmails.length}</h2>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-4 mb-6 border-b border-slate-800 pb-2">
          <button 
            onClick={() => setActiveTab('inboxes')}
            className={`font-semibold pb-2 px-2 transition-colors relative ${activeTab === 'inboxes' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Kotak Masuk Aktif
            {activeTab === 'inboxes' && <div className="absolute bottom-[-9px] left-0 w-full h-0.5 bg-blue-500 rounded-t-full"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('banned')}
            className={`font-semibold pb-2 px-2 transition-colors relative ${activeTab === 'banned' ? 'text-red-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Alamat Diblokir
            {activeTab === 'banned' && <div className="absolute bottom-[-9px] left-0 w-full h-0.5 bg-red-500 rounded-t-full"></div>}
          </button>
        </div>

        {/* DATA TABLE */}
        <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          
          {activeTab === 'inboxes' && (
            <>
              <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900">
                <h3 className="text-lg font-bold text-white">Log Aktivitas Kotak Masuk</h3>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Cari alamat email..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="divide-y divide-slate-800 max-h-[700px] overflow-y-auto">
                {filteredInboxes.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    Tidak ada data kotak masuk yang ditemukan.
                  </div>
                ) : (
                  filteredInboxes.map((inbox: any) => (
                    <div key={inbox.address} className="bg-transparent hover:bg-slate-800/30 transition-colors">
                      
                      {/* HEADER ROW */}
                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div 
                          className="flex items-center gap-3 sm:gap-4 cursor-pointer flex-1 overflow-hidden"
                          onClick={() => toggleExpand(inbox.address)}
                        >
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-800 rounded-xl flex items-center justify-center text-slate-300 font-bold uppercase shrink-0 border border-slate-700">
                            {inbox.address[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-slate-100 text-base sm:text-lg truncate" title={inbox.address}>
                              {inbox.address}
                            </h4>
                            <p className="text-xs sm:text-sm text-blue-400 font-medium mt-0.5">{inbox.count} Pesan Tersimpan</p>
                          </div>
                        </div>

                        {/* ADMIN ACTIONS */}
                        <div className="flex items-center gap-2 sm:gap-3 self-start sm:self-auto shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleBanToggle(inbox.address, false); }}
                            className="flex-1 sm:flex-none justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs sm:text-sm px-3 py-2 sm:py-2.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 border border-red-500/20"
                            title="Blokir alamat ini dari menerima pesan"
                          >
                            <Ban className="w-4 h-4" /> Blokir
                          </button>
                          
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteInbox(inbox.address); }}
                            className="flex-1 sm:flex-none justify-center bg-slate-800 hover:bg-red-600 hover:text-white text-slate-300 text-xs sm:text-sm px-3 py-2 sm:py-2.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 border border-slate-700"
                            title="Hapus semua pesan"
                          >
                            <Trash2 className="w-4 h-4" /> Bersihkan
                          </button>

                          <button onClick={() => toggleExpand(inbox.address)} className="p-2 sm:p-2.5 text-slate-400 hover:text-white bg-slate-800/50 rounded-lg sm:bg-transparent sm:rounded-none">
                            {expandedInboxes[inbox.address] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* EXPANDED EMAIL LIST */}
                      {expandedInboxes[inbox.address] && (
                        <div className="bg-slate-950 p-4 sm:p-6 border-t border-slate-800/50 shadow-inner">
                          {inbox.count === 0 ? (
                            <p className="text-center text-sm text-slate-500 py-4">Kotak masuk kosong.</p>
                          ) : (
                            <div className="space-y-4">
                              {inbox.emails.map((emailStr: string, idx: number) => {
                                const email = typeof emailStr === 'string' ? JSON.parse(emailStr) : emailStr;
                                return (
                                  <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-3 relative group">
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                      <div>
                                        <h5 className="font-bold text-slate-200 text-base">{email.subject || '(Tanpa Subjek)'}</h5>
                                        <p className="text-xs text-slate-400 mt-1"><span className="text-slate-500">Dari:</span> {email.from}</p>
                                      </div>
                                      <span className="text-xs font-medium text-slate-500 shrink-0 bg-slate-950 px-3 py-1 rounded-md border border-slate-800">
                                        {new Date(email.receivedAt).toLocaleString()}
                                      </span>
                                    </div>
                                    
                                    {/* Snippet of content */}
                                    <div className="mt-2 bg-[#0a0f1c] text-slate-400 p-4 rounded-xl text-sm font-mono max-h-40 overflow-y-auto whitespace-pre-wrap border border-slate-800/50">
                                      {email.text ? email.text.substring(0, 500) + (email.text.length > 500 ? '...' : '') : 'Hanya HTML/Tidak ada teks.'}
                                    </div>

                                    {/* Read HTML Button */}
                                    {email.html && (
                                      <div className="flex justify-end mt-2">
                                        <button 
                                          onClick={() => setSelectedHtmlEmail(email.html)}
                                          className="flex items-center gap-2 text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-4 py-2 rounded-lg border border-blue-500/20 transition-colors"
                                        >
                                          <Eye className="w-4 h-4" /> Lihat HTML Penuh
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'banned' && (
            <div className="divide-y divide-slate-800">
              <div className="p-6 border-b border-slate-800 bg-slate-900">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Ban className="w-5 h-5 text-red-500" /> Daftar Alamat Terblokir
                </h3>
                <p className="text-sm text-slate-400 mt-1">Alamat di bawah ini tidak akan bisa menerima pesan masuk dari webhook.</p>
              </div>
              
              <div className="p-2">
                {bannedEmails.length === 0 ? (
                   <div className="p-12 text-center text-slate-500">
                     Tidak ada alamat yang diblokir.
                   </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                    {bannedEmails.map((email: string) => (
                      <div key={email} className="bg-slate-950 border border-red-900/30 rounded-xl p-4 flex items-center justify-between">
                        <span className="font-medium text-slate-300 break-all">{email}</span>
                        <button 
                          onClick={() => handleBanToggle(email, true)}
                          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 border border-emerald-500/20 shrink-0 ml-2"
                        >
                          <ShieldCheck className="w-4 h-4" /> Buka Blokir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
