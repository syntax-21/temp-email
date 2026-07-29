'use client';

import { useState, useEffect } from 'react';
import { Lock, Mail, Activity, Eye, ChevronDown, ChevronUp, ShieldAlert, LogOut, RefreshCcw, Search } from 'lucide-react';

export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [expandedInboxes, setExpandedInboxes] = useState<Record<string, boolean>>({});

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
      setError('Gagal menghubungi server server database.');
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

  return (
    <div className="min-h-screen w-full bg-[#030712] text-slate-200 font-sans selection:bg-red-500/30">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex items-center gap-6">
            <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
              <Mail className="w-7 h-7 text-blue-500" />
            </div>
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Total Alamat Email Aktif</p>
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
        </div>

        {/* DATA TABLE */}
        <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
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

          <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
            {filteredInboxes.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                Tidak ada data kotak masuk yang ditemukan.
              </div>
            ) : (
              filteredInboxes.map((inbox: any) => (
                <div key={inbox.address} className="bg-transparent hover:bg-slate-800/30 transition-colors">
                  <div 
                    onClick={() => toggleExpand(inbox.address)}
                    className="p-5 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 font-bold uppercase shrink-0">
                        {inbox.address[0]}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-200 text-sm md:text-base break-all">{inbox.address}</h4>
                        <p className="text-xs text-slate-500">{inbox.count} Pesan</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="bg-blue-500/10 text-blue-400 text-xs px-3 py-1 rounded-full font-medium hidden md:block">
                        Aktif
                      </span>
                      {expandedInboxes[inbox.address] ? (
                        <ChevronUp className="w-5 h-5 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                  </div>

                  {/* EXPANDED EMAIL LIST */}
                  {expandedInboxes[inbox.address] && (
                    <div className="bg-slate-950 p-4 border-t border-slate-800/50">
                      {inbox.count === 0 ? (
                        <p className="text-center text-sm text-slate-500 py-4">Kotak masuk kosong.</p>
                      ) : (
                        <div className="space-y-3">
                          {inbox.emails.map((emailStr: string, idx: number) => {
                            // KV might return parsed JSON or stringified JSON depending on client config
                            const email = typeof emailStr === 'string' ? JSON.parse(emailStr) : emailStr;
                            return (
                              <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
                                <div className="flex justify-between items-start gap-2">
                                  <h5 className="font-semibold text-slate-200 text-sm">{email.subject || '(Tanpa Subjek)'}</h5>
                                  <span className="text-[10px] text-slate-500 shrink-0 bg-slate-800 px-2 py-0.5 rounded">
                                    {new Date(email.receivedAt).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400"><span className="text-slate-500">Dari:</span> {email.from}</p>
                                
                                {/* Snippet of content */}
                                <div className="mt-2 bg-[#f8fafc] text-slate-800 p-3 rounded-lg text-xs font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
                                  {email.text ? email.text.substring(0, 300) + (email.text.length > 300 ? '...' : '') : 'Hanya HTML/Tidak ada teks.'}
                                </div>
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
        </div>

      </main>
    </div>
  );
}
