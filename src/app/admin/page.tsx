'use client';

import { useState } from 'react';
import {
  Lock, Mail, Eye, ChevronDown, ChevronUp, ShieldAlert, LogOut, RefreshCcw,
  Search, Inbox, Trash2, Ban, ShieldCheck, X, Settings, Shield, BarChart3,
  Database, Globe, List, Download, Star, AlertTriangle, Clock, Filter,
  CheckCircle, XCircle
} from 'lucide-react';

// ─── SVG Bar Chart (no external dependencies) ───────────────────────────────
function BarChart({ data }: { data: { date: string; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const chartH = 100;
  const barW = 34;
  const gap = 8;
  const padL = 8;
  const totalW = data.length * (barW + gap) - gap + padL * 2;

  return (
    <svg viewBox={`0 0 ${totalW} ${chartH + 38}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={padL} y1={chartH * (1 - f)} x2={totalW - padL} y2={chartH * (1 - f)}
          stroke="#1e293b" strokeWidth={1} />
      ))}
      {data.map((d, i) => {
        const barH = Math.max((d.count / maxCount) * chartH, d.count > 0 ? 4 : 0);
        const x = padL + i * (barW + gap);
        const y = chartH - barH;
        const label = d.date.slice(5); // MM-DD
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={barH} fill="url(#barGrad)" rx={4} />
            <text x={x + barW / 2} y={chartH + 16} textAnchor="middle"
              fill="#475569" fontSize={9} fontFamily="monospace">{label}</text>
            {d.count > 0 && (
              <text x={x + barW / 2} y={y - 5} textAnchor="middle"
                fill="#60a5fa" fontSize={9} fontWeight="bold">{d.count}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Log type color map ──────────────────────────────────────────────────────
const LOG_COLORS: Record<string, string> = {
  email_received:  'bg-blue-500/20 text-blue-400',
  webhook_received:'bg-blue-500/20 text-blue-400',
  ban:             'bg-orange-500/20 text-orange-400',
  unban:           'bg-green-500/20 text-green-400',
  ban_ip:          'bg-red-500/20 text-red-400',
  unban_ip:        'bg-green-500/20 text-green-400',
  auth_fail:       'bg-yellow-500/20 text-yellow-400',
  settings:        'bg-purple-500/20 text-purple-400',
  whitelist:       'bg-cyan-500/20 text-cyan-400',
  master_reset:    'bg-red-500/20 text-red-400',
  delete_inbox:    'bg-orange-500/20 text-orange-400',
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [data, setData] = useState<any>({
    inboxes: [], bannedEmails: [], bannedIps: [], whitelistIps: [], whitelistEmails: [],
    domains: [], reservedNames: [], domainExpiry: {},
    settings: { expiry: 86400, maintenance: false, autoBanThreshold: 0 },
    stats: { emailsReceived: 0, dailyStats: [], topSenders: [], topInboxes: [] },
    systemLogs: []
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('inboxes');

  // Inbox filters
  const [search, setSearch] = useState('');
  const [filterDomain, setFilterDomain] = useState('all');
  const [filterMinCount, setFilterMinCount] = useState(0);
  const [expandedInbox, setExpandedInbox] = useState<string | null>(null);
  const [selectedHtmlEmail, setSelectedHtmlEmail] = useState<string | null>(null);

  // Log filters
  const [logTypeFilter, setLogTypeFilter] = useState('all');
  const [logDateFilter, setLogDateFilter] = useState('');

  // Form states
  const [newDomain, setNewDomain] = useState('');
  const [newReserved, setNewReserved] = useState('');
  const [newBannedIp, setNewBannedIp] = useState('');
  const [newBannedEmail, setNewBannedEmail] = useState('');
  const [newWhitelistIp, setNewWhitelistIp] = useState('');
  const [newWhitelistEmail, setNewWhitelistEmail] = useState('');
  const [newTempBanIp, setNewTempBanIp] = useState('');
  const [newTempBanHours, setNewTempBanHours] = useState(24);
  const [expiryHours, setExpiryHours] = useState(24);
  const [domainExpiryInputs, setDomainExpiryInputs] = useState<Record<string, number>>({});
  const [autoBanInput, setAutoBanInput] = useState(0);

  // Telegram settings states
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramAdminId, setTelegramAdminId] = useState('');
  const [telegramDomain, setTelegramDomain] = useState('');
  const [telegramBotUsername, setTelegramBotUsername] = useState('');

  // ─── Auth ─────────────────────────────────────────────────────────
  const applyData = (result: any) => {
    setData(result);
    if (result.settings?.expiry) setExpiryHours(result.settings.expiry / 3600);
    if (result.settings?.autoBanThreshold !== undefined) setAutoBanInput(result.settings.autoBanThreshold);
    if (result.telegramSettings) {
      setTelegramBotToken(result.telegramSettings.botToken || '');
      setTelegramAdminId(result.telegramSettings.adminId || '');
      setTelegramDomain(result.telegramSettings.domain || '');
      setTelegramBotUsername(result.telegramSettings.botUsername || '');
    }
    if (result.domainExpiry) {
      const inputs: Record<string, number> = {};
      for (const [d, sec] of Object.entries(result.domainExpiry)) {
        inputs[d] = Number(sec) / 3600;
      }
      setDomainExpiryInputs(inputs);
    }
  };

  const checkAuth = async (pass: string) => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin', { headers: { 'Authorization': `Bearer ${pass}` } });
      if (res.ok) { setIsAuthenticated(true); applyData(await res.json()); }
      else setError('Password salah atau sistem belum dikonfigurasi.');
    } catch { setError('Terjadi kesalahan jaringan.'); }
    setLoading(false);
  };

  const refreshData = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin', { headers: { 'Authorization': `Bearer ${password}` } });
      if (res.ok) applyData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); checkAuth(password); };
  const handleLogout = () => { setIsAuthenticated(false); setPassword(''); setData({}); };

  // ─── Actions ──────────────────────────────────────────────────────
  /** POST with confirm dialog */
  const doAction = async (action: string, address?: string, value?: any) => {
    if (!confirm(`Yakin ingin melakukan aksi: ${action}?`)) return;
    await silentPost(action, address, value);
  };

  /** POST without confirm dialog */
  const silentAction = async (action: string, value?: any, address?: string) => {
    await silentPost(action, address, value);
  };

  const silentPost = async (action: string, address?: string, value?: any) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${password}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, address, value })
      });
      if (res.ok) refreshData();
      else alert('Gagal melakukan aksi');
    } catch { alert('Error jaringan'); }
  };

  const handleDeleteInbox = async (address: string) => {
    if (!confirm(`Yakin ingin menghapus seluruh email untuk ${address}?`)) return;
    try {
      const res = await fetch(`/api/admin?address=${address}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${password}` }
      });
      if (res.ok) refreshData(); else alert('Gagal menghapus inbox');
    } catch { alert('Error jaringan'); }
  };

  const handleMasterReset = async () => {
    if (!confirm('PERINGATAN BAHAYA!\nApakah Anda yakin ingin MENGHAPUS SEMUA DATA EMAIL? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      const res = await fetch('/api/admin?type=all_inboxes', {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${password}` }
      });
      if (res.ok) { alert('Semua inbox berhasil dibersihkan.'); refreshData(); }
      else alert('Gagal melakukan Master Reset.');
    } catch { alert('Error jaringan'); }
  };

  const saveSettings = () => doAction('save_settings', undefined, { expiry: expiryHours * 3600 });

  const toggleMaintenance = async () => {
    const current = data.settings?.maintenance;
    if (!confirm(`${current ? 'Nonaktifkan' : 'Aktifkan'} maintenance mode?`)) return;
    await silentPost('toggle_maintenance');
  };

  const setupTelegramWebhook = async () => {
    try {
      const targetDomain = telegramDomain || window.location.origin;
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${password}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup_telegram_webhook', value: targetDomain })
      });
      const json = await res.json();
      if (res.ok) {
        alert(json.message || 'Webhook Telegram berhasil diaktifkan!');
        refreshData();
      } else {
        alert('Gagal mengaktifkan webhook: ' + json.error);
      }
    } catch { alert('Error jaringan saat mengaktifkan webhook'); }
  };

  const saveTelegramSettings = async () => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${password}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'save_telegram_settings', 
          value: { botToken: telegramBotToken, adminId: telegramAdminId, domain: telegramDomain } 
        })
      });
      const json = await res.json();
      if (res.ok) {
        if (json.botUsername) setTelegramBotUsername(json.botUsername);
        alert(json.message || 'Konfigurasi Telegram berhasil disimpan!');
        refreshData();
      } else {
        alert('Gagal menyimpan konfigurasi Telegram.');
      }
    } catch { alert('Error jaringan'); }
  };

  const testTelegramBot = async () => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${password}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_telegram_bot' })
      });
      const json = await res.json();
      if (res.ok) {
        if (json.botUsername) setTelegramBotUsername(json.botUsername);
        alert(json.message || 'Koneksi bot berhasil!');
      } else {
        alert('Gagal tes bot: ' + json.error);
      }
    } catch {
      alert('Error jaringan saat menguji koneksi bot');
    }
  };

  const handleExport = async (format: string) => {
    try {
      const res = await fetch(`/api/admin?action=export&format=${format}`, {
        headers: { 'Authorization': `Bearer ${password}` }
      });
      if (!res.ok) { alert('Gagal export data'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extMap: Record<string, string> = { json: 'json', logs_csv: 'csv', banned_emails: 'txt', banned_ips: 'txt' };
      a.download = `tmail-${format}-${new Date().toISOString().split('T')[0]}.${extMap[format] || 'txt'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Error saat mengunduh'); }
  };

  const saveDomainExpiry = async (domain: string) => {
    const hours = domainExpiryInputs[domain] || 24;
    await silentPost('set_domain_expiry', undefined, { domain, expiry: hours * 3600 });
    alert(`Expiry untuk ${domain} disimpan!`);
  };

  const clearLogs = async () => {
    if (!confirm('Yakin ingin menghapus semua log sistem?')) return;
    await silentPost('clear_logs');
  };

  // ─── Computed ─────────────────────────────────────────────────────
  const filteredInboxes = (data.inboxes || []).filter((inbox: any) => {
    const matchSearch = inbox.address.toLowerCase().includes(search.toLowerCase());
    const matchDomain = filterDomain === 'all' || inbox.address.endsWith(`@${filterDomain}`);
    const matchCount = inbox.count >= filterMinCount;
    return matchSearch && matchDomain && matchCount;
  });

  const filteredLogs = (data.systemLogs || []).filter((log: any) => {
    const matchType = logTypeFilter === 'all' || log.type === logTypeFilter;
    const matchDate = !logDateFilter || log.timestamp?.startsWith(logDateFilter);
    return matchType && matchDate;
  });

  // ─── Login Screen ─────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
          <div className="flex justify-center mb-6">
            <div className="bg-red-500/20 p-4 rounded-full">
              <ShieldAlert className="w-10 h-10 text-red-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">Admin Portal</h1>
          <p className="text-slate-400 text-center mb-8 text-sm">Masuk dengan kata sandi admin</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Kata Sandi Admin"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-red-500/50 transition-colors" />
            </div>
            {error && <p className="text-red-400 text-sm font-medium text-center">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-red-900/20 disabled:opacity-50">
              {loading ? 'Memeriksa...' : 'Akses Sistem'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'inboxes',   label: 'Kotak Masuk',   icon: Inbox },
    { id: 'analytics', label: 'Statistik',      icon: BarChart3 },
    { id: 'export',    label: 'Ekspor',         icon: Download },
    { id: 'settings',  label: 'Pengaturan',     icon: Settings },
    { id: 'security',  label: 'Keamanan',       icon: Shield },
    { id: 'logs',      label: 'Log Sistem',     icon: List },
  ];

  // ─── Dashboard ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-4 md:p-8">

      {/* HTML Email Modal */}
      {selectedHtmlEmail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-slate-100 px-6 py-4 flex justify-between items-center border-b border-slate-200">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-500" /> Tampilan HTML Asli
              </h3>
              <button onClick={() => setSelectedHtmlEmail(null)} className="p-2 hover:bg-slate-200 rounded-full">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="flex-1 relative">
              <iframe srcDoc={selectedHtmlEmail} className="absolute inset-0 w-full h-full border-0"
                title="Email HTML" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin" />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <div>
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-red-500" /> TMail Enterprise Admin
            </h1>
            <p className="text-slate-400 mt-1 text-sm">Sistem manajemen dan kendali penuh</p>
            {data.settings?.maintenance && (
              <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" /> MAINTENANCE MODE AKTIF
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={refreshData} disabled={loading}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors font-medium text-sm">
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Segarkan
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-2 bg-red-950/30 text-red-400 hover:bg-red-900/40 hover:text-red-300 px-4 py-2 rounded-lg transition-colors font-medium text-sm border border-red-900/30">
              <LogOut className="w-4 h-4" /> Keluar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all whitespace-nowrap text-sm ${
                activeTab === tab.id
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* ════════ TAB: INBOXES ════════════════════════════════════ */}
        {activeTab === 'inboxes' && (
          <div className="space-y-4">
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari alamat email..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:border-red-500/50 text-sm" />
                </div>
                <select value={filterDomain} onChange={e => setFilterDomain(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 focus:outline-none focus:border-red-500/50 text-sm">
                  <option value="all">Semua Domain</option>
                  {(data.domains || []).map((d: string) => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-500 whitespace-nowrap">Min email:</span>
                  <input type="number" min={0} value={filterMinCount} onChange={e => setFilterMinCount(Number(e.target.value))}
                    className="bg-transparent text-white w-12 focus:outline-none" />
                </div>
                <button onClick={handleMasterReset}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-3 rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap text-sm shadow-lg shadow-red-900/20">
                  <Trash2 className="w-4 h-4" /> Master Reset
                </button>
              </div>
              <p className="text-slate-500 text-xs">Menampilkan {filteredInboxes.length} dari {data.inboxes?.length || 0} inbox</p>
            </div>

            <div className="space-y-3">
              {filteredInboxes.map((inbox: any) => (
                <div key={inbox.address} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all">
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 cursor-pointer flex-1"
                      onClick={() => setExpandedInbox(expandedInbox === inbox.address ? null : inbox.address)}>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <Mail className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white font-mono truncate">{inbox.address}</h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{inbox.count} pesan</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button onClick={() => doAction('ban', inbox.address)}
                        className="flex-1 sm:flex-none bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 px-3 py-2 rounded-lg font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 border border-orange-500/20">
                        <Ban className="w-3.5 h-3.5" /> Blokir
                      </button>
                      <button onClick={() => handleDeleteInbox(inbox.address)}
                        className="flex-1 sm:flex-none bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-2 rounded-lg font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 border border-red-500/20">
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                      <button onClick={() => setExpandedInbox(expandedInbox === inbox.address ? null : inbox.address)}
                        className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700 transition-colors">
                        {expandedInbox === inbox.address ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
                      </button>
                    </div>
                  </div>
                  {expandedInbox === inbox.address && (
                    <div className="bg-slate-950 border-t border-slate-800 p-4 space-y-3">
                      {inbox.emails.map((email: any, i: number) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                            <div>
                              <h4 className="font-bold text-white text-sm mb-1">{email.subject}</h4>
                              <p className="text-slate-500 text-xs font-mono">{email.from}</p>
                            </div>
                            <div className="text-xs text-slate-500 font-mono whitespace-nowrap bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 shrink-0">
                              {new Date(email.receivedAt).toLocaleString('id-ID')}
                            </div>
                          </div>
                          <div className="text-slate-400 text-sm whitespace-pre-wrap line-clamp-3">
                            {email.text || 'Hanya HTML'}
                          </div>
                          {email.html && (
                            <button onClick={() => setSelectedHtmlEmail(email.html)}
                              className="mt-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                              <Eye className="w-3.5 h-3.5" /> Lihat HTML
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {filteredInboxes.length === 0 && (
                <div className="text-center py-12 text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Tidak ada kotak masuk yang ditemukan.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════ TAB: ANALYTICS ══════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <p className="text-slate-400 font-bold mb-2 text-sm">Total Inbox Aktif</p>
                <p className="text-5xl font-black text-white">{data.totalActiveInboxes || 0}</p>
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <p className="text-slate-400 font-bold mb-2 text-sm">Total Email Diterima</p>
                <p className="text-5xl font-black text-blue-500">{data.stats?.emailsReceived || 0}</p>
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <p className="text-slate-400 font-bold mb-2 text-sm">Domain Terdaftar</p>
                <p className="text-5xl font-black text-emerald-500">{data.domains?.length || 0}</p>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" /> Email Masuk 7 Hari Terakhir
              </h3>
              {data.stats?.dailyStats?.some((d: any) => d.count > 0) ? (
                <div className="bg-slate-950 rounded-xl p-4">
                  <BarChart data={data.stats.dailyStats} />
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 bg-slate-950 rounded-xl">
                  <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Belum ada data statistik harian.<br />Data grafik muncul setelah email pertama masuk.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" /> Top 5 Inbox Aktif
                </h3>
                <div className="space-y-3">
                  {(data.stats?.topInboxes || []).map((inbox: any, i: number) => (
                    <div key={inbox.address} className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                          i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-slate-400/20 text-slate-400' : 'bg-amber-700/20 text-amber-600'
                        }`}>{i + 1}</span>
                        <span className="font-mono text-slate-300 text-sm truncate max-w-[160px]">{inbox.address}</span>
                      </div>
                      <span className="text-blue-400 font-bold text-sm shrink-0">{inbox.count} email</span>
                    </div>
                  ))}
                  {(!data.stats?.topInboxes?.length) && <p className="text-slate-500 text-sm text-center py-4">Belum ada data.</p>}
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-red-400" /> Top 5 Pengirim Terbanyak
                </h3>
                <div className="space-y-3">
                  {(data.stats?.topSenders || []).map((sender: any, i: number) => (
                    <div key={sender.email} className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                          i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-slate-400/20 text-slate-400' : 'bg-amber-700/20 text-amber-600'
                        }`}>{i + 1}</span>
                        <span className="font-mono text-slate-300 text-sm truncate max-w-[160px]">{sender.email}</span>
                      </div>
                      <span className="text-red-400 font-bold text-sm shrink-0">{sender.count}x</span>
                    </div>
                  ))}
                  {(!data.stats?.topSenders?.length) && <p className="text-slate-500 text-sm text-center py-4">Belum ada data pengirim.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════ TAB: EXPORT ════════════════════════════════════ */}
        {activeTab === 'export' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-2">Ekspor & Backup Data</h3>
              <p className="text-slate-400 text-sm mb-6">Unduh data sistem sebagai file untuk backup atau analisis eksternal.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-blue-500/20 p-3 rounded-xl"><Database className="w-5 h-5 text-blue-400" /></div>
                    <div>
                      <h4 className="font-bold text-white">Semua Inbox</h4>
                      <p className="text-slate-500 text-xs">{data.totalActiveInboxes || 0} inbox aktif</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">Export seluruh inbox beserta isi email dalam format JSON.</p>
                  <button onClick={() => handleExport('json')}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                    <Download className="w-4 h-4" /> Download JSON
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-purple-500/20 p-3 rounded-xl"><List className="w-5 h-5 text-purple-400" /></div>
                    <div>
                      <h4 className="font-bold text-white">Log Sistem</h4>
                      <p className="text-slate-500 text-xs">{data.systemLogs?.length || 0} entri log</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">Export riwayat aktivitas sistem dalam format CSV.</p>
                  <button onClick={() => handleExport('logs_csv')}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                    <Download className="w-4 h-4" /> Download CSV
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-orange-500/20 p-3 rounded-xl"><Ban className="w-5 h-5 text-orange-400" /></div>
                    <div>
                      <h4 className="font-bold text-white">Email Terblokir</h4>
                      <p className="text-slate-500 text-xs">{data.bannedEmails?.length || 0} email</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">Export daftar email yang diblokir dalam format TXT.</p>
                  <button onClick={() => handleExport('banned_emails')}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                    <Download className="w-4 h-4" /> Download TXT
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-red-500/20 p-3 rounded-xl"><ShieldAlert className="w-5 h-5 text-red-400" /></div>
                    <div>
                      <h4 className="font-bold text-white">IP Terblokir</h4>
                      <p className="text-slate-500 text-xs">{data.bannedIps?.length || 0} IP</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">Export daftar IP yang diblokir dalam format TXT.</p>
                  <button onClick={() => handleExport('banned_ips')}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                    <Download className="w-4 h-4" /> Download TXT
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════ TAB: SETTINGS ══════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="space-y-6">

            {/* Maintenance Mode */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-yellow-900/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" /> Mode Maintenance
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">Saat aktif, semua akses user dan penerimaan email ditolak sementara.</p>
                </div>
                <button onClick={toggleMaintenance}
                  className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                    data.settings?.maintenance
                      ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}>
                  {data.settings?.maintenance
                    ? <><XCircle className="w-4 h-4" /> Nonaktifkan</>
                    : <><CheckCircle className="w-4 h-4" /> Aktifkan</>}
                </button>
              </div>
            </div>

            {/* Telegram Webhook Setup */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-blue-900/30">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-400" /> Setup Bot Telegram
                </h3>
                {telegramBotUsername && (
                  <a
                    href={`https://t.me/${telegramBotUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    @{telegramBotUsername} (Buka Bot)
                  </a>
                )}
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Atur Token dari <b>@BotFather</b> dan ID Admin Anda untuk mengendalikan & menerima email instan di Telegram.
              </p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">TELEGRAM BOT TOKEN</label>
                  <input type="password" value={telegramBotToken} onChange={e => setTelegramBotToken(e.target.value)}
                    placeholder="Contoh: 123456789:ABCDefgh..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 outline-none text-sm font-mono" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">TELEGRAM ADMIN ID (Chat ID)</label>
                    <input type="text" value={telegramAdminId} onChange={e => setTelegramAdminId(e.target.value)}
                      placeholder="Dapatkan via @userinfobot (misal: 12345678)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 outline-none text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">DOMAIN BOT (Default: URL Web)</label>
                    <input type="text" value={telegramDomain} onChange={e => setTelegramDomain(e.target.value)}
                      placeholder="contoh: breonline.biz.id"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 outline-none text-sm font-mono" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-800 pt-5">
                <button onClick={saveTelegramSettings}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl font-bold transition-colors text-center text-sm">
                  1. Simpan Konfigurasi
                </button>
                <button onClick={setupTelegramWebhook}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-center text-sm shadow-lg shadow-blue-900/20">
                  <RefreshCcw className="w-4 h-4" /> 2. Set Webhook
                </button>
                <button onClick={testTelegramBot}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-center text-sm shadow-lg shadow-emerald-900/20">
                  ⚡ 3. Tes Koneksi Bot
                </button>
              </div>
            </div>

            {/* Global Expiry */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-2">Expiry Global</h3>
              <p className="text-slate-400 text-sm mb-4">Default berapa lama email disimpan jika domain tidak punya expiry sendiri.</p>
              <div className="flex gap-4 items-center">
                <input type="number" value={expiryHours} onChange={e => setExpiryHours(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white w-32 focus:border-red-500 outline-none" />
                <span className="text-slate-400">Jam</span>
                <button onClick={saveSettings} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-bold">Simpan</button>
              </div>
            </div>

            {/* Per-Domain Expiry */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" /> Expiry Per-Domain
              </h3>
              <p className="text-slate-400 text-sm mb-4">Set waktu expiry berbeda untuk setiap domain. Kosong = pakai expiry global.</p>
              <div className="space-y-3">
                {(data.domains || []).map((d: string) => (
                  <div key={d} className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="font-mono text-slate-300 flex-1 text-sm">{d}</span>
                    <input type="number" min={1} value={domainExpiryInputs[d] ?? ''}
                      placeholder="jam (global)"
                      onChange={e => setDomainExpiryInputs(prev => ({ ...prev, [d]: Number(e.target.value) }))}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white w-28 focus:border-blue-500 outline-none text-sm" />
                    <span className="text-slate-500 text-xs">jam</span>
                    <button onClick={() => saveDomainExpiry(d)}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-bold">Simpan</button>
                    <button onClick={() => silentAction('remove_domain_expiry', d)}
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(!data.domains?.length) && (
                  <p className="text-slate-500 text-sm text-center py-4">Tambahkan domain di bagian bawah terlebih dahulu.</p>
                )}
              </div>
            </div>

            {/* Whitelist Email */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" /> Whitelist Email (Tidak Pernah Expire)
              </h3>
              <p className="text-slate-400 text-sm mb-4">Email di daftar ini tidak akan dihapus otomatis berapapun setting expiry.</p>
              <div className="flex gap-2 mb-4">
                <input value={newWhitelistEmail} onChange={e => setNewWhitelistEmail(e.target.value)}
                  placeholder="email@domain.com"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white flex-1 focus:border-emerald-500 outline-none text-sm" />
                <button onClick={() => { silentAction('add_whitelist_email', newWhitelistEmail); setNewWhitelistEmail(''); }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm">Tambah</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(data.whitelistEmails || []).map((email: string) => (
                  <div key={email} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                    <span className="font-mono text-emerald-300 text-sm">{email}</span>
                    <button onClick={() => silentAction('remove_whitelist_email', email)} className="text-emerald-500 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {(!data.whitelistEmails?.length) && <p className="text-slate-500 text-sm py-1">Belum ada email di whitelist.</p>}
              </div>
            </div>

            {/* Domains */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-4">Manajemen Domain</h3>
              <div className="flex gap-2 mb-4">
                <input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="contoh.com"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white flex-1 focus:border-red-500 outline-none" />
                <button onClick={() => { silentAction('add_domain', newDomain); setNewDomain(''); }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold">Tambah</button>
              </div>
              <div className="space-y-2">
                {(data.domains || []).map((d: string) => (
                  <div key={d} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="font-mono text-slate-300 text-sm">{d}</span>
                    <button onClick={() => doAction('remove_domain', undefined, d)} className="text-red-500 hover:bg-red-500/20 p-2 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Reserved Names */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-4">Nama Email Dilarang</h3>
              <div className="flex gap-2 mb-4">
                <input value={newReserved} onChange={e => setNewReserved(e.target.value)} placeholder="admin"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white flex-1 focus:border-red-500 outline-none" />
                <button onClick={() => { silentAction('add_reserved', newReserved); setNewReserved(''); }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold">Tambah</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(data.reservedNames || []).map((r: string) => (
                  <div key={r} className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    <span className="font-mono text-slate-300 text-sm">{r}</span>
                    <button onClick={() => silentAction('remove_reserved', r)} className="text-red-500 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════ TAB: SECURITY ══════════════════════════════════ */}
        {activeTab === 'security' && (
          <div className="space-y-6">

            {/* Auto-Ban Config */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-red-900/30">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-400" /> Konfigurasi Auto-Ban
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                Threshold request per menit sebelum IP otomatis di-ban.
                Isi <span className="text-white font-mono bg-slate-800 px-1 rounded">0</span> untuk nonaktifkan.
              </p>
              <div className="flex gap-4 items-center">
                <input type="number" min={0} value={autoBanInput} onChange={e => setAutoBanInput(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white w-36 focus:border-red-500 outline-none" />
                <span className="text-slate-400 text-sm">req/menit</span>
                <button onClick={() => silentAction('set_autoban', autoBanInput)}
                  className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-bold">Simpan</button>
              </div>
              <p className="text-slate-500 text-xs mt-3">
                Status:{' '}
                <span className={data.settings?.autoBanThreshold > 0 ? 'text-red-400 font-bold' : 'text-slate-400'}>
                  {data.settings?.autoBanThreshold > 0 ? `Aktif (limit: ${data.settings.autoBanThreshold} req/menit)` : 'Nonaktif'}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Banned Emails */}
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col">
                <div className="flex items-center gap-3 mb-5">
                  <div className="bg-orange-500/20 p-3 rounded-xl"><Ban className="w-5 h-5 text-orange-500" /></div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Email Terblokir</h2>
                    <p className="text-slate-400 text-xs">Alamat yang tidak bisa menerima pesan</p>
                  </div>
                </div>
                <div className="flex gap-2 mb-3">
                  <input value={newBannedEmail} onChange={e => setNewBannedEmail(e.target.value)} placeholder="email@domain.com"
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white flex-1 focus:border-orange-500 outline-none text-sm" />
                  <button onClick={() => { silentAction('ban', undefined, newBannedEmail); setNewBannedEmail(''); }}
                    className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-2 rounded-lg font-bold text-sm">Blokir</button>
                </div>
                <div className="space-y-2 overflow-y-auto max-h-60">
                  {(!data.bannedEmails?.length) && <p className="text-slate-500 text-center py-4 text-sm">Belum ada</p>}
                  {(data.bannedEmails || []).map((email: string) => (
                    <div key={email} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex justify-between items-center">
                      <span className="text-slate-300 font-mono text-xs truncate">{email}</span>
                      <button onClick={() => silentAction('unban', undefined, email)}
                        className="text-slate-500 hover:text-orange-400 px-2 py-1 bg-slate-900 text-xs font-bold rounded ml-2 shrink-0">UNBAN</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Banned IPs */}
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col">
                <div className="flex items-center gap-3 mb-5">
                  <div className="bg-red-500/20 p-3 rounded-xl"><ShieldAlert className="w-5 h-5 text-red-500" /></div>
                  <div>
                    <h2 className="text-lg font-bold text-white">IP Blacklist (Permanen)</h2>
                    <p className="text-slate-400 text-xs">IP yang diblokir secara permanen</p>
                  </div>
                </div>
                <div className="flex gap-2 mb-3">
                  <input value={newBannedIp} onChange={e => setNewBannedIp(e.target.value)} placeholder="192.168.1.1"
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white flex-1 focus:border-red-500 outline-none text-sm" />
                  <button onClick={() => { silentAction('ban_ip', newBannedIp); setNewBannedIp(''); }}
                    className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg font-bold text-sm">Blokir</button>
                </div>
                <div className="space-y-2 overflow-y-auto max-h-60">
                  {(!data.bannedIps?.length) && <p className="text-slate-500 text-center py-4 text-sm">Belum ada</p>}
                  {(data.bannedIps || []).map((ip: string) => (
                    <div key={ip} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex justify-between items-center">
                      <span className="text-slate-300 font-mono text-xs">{ip}</span>
                      <button onClick={() => silentAction('unban_ip', ip)}
                        className="text-slate-500 hover:text-red-400 px-2 py-1 bg-slate-900 text-xs font-bold rounded ml-2 shrink-0">UNBAN</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Whitelist IPs */}
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col">
                <div className="flex items-center gap-3 mb-5">
                  <div className="bg-emerald-500/20 p-3 rounded-xl"><CheckCircle className="w-5 h-5 text-emerald-500" /></div>
                  <div>
                    <h2 className="text-lg font-bold text-white">IP Whitelist</h2>
                    <p className="text-slate-400 text-xs">IP yang tidak bisa di-ban oleh sistem</p>
                  </div>
                </div>
                <div className="flex gap-2 mb-3">
                  <input value={newWhitelistIp} onChange={e => setNewWhitelistIp(e.target.value)} placeholder="192.168.1.1"
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white flex-1 focus:border-emerald-500 outline-none text-sm" />
                  <button onClick={() => { silentAction('add_whitelist_ip', newWhitelistIp); setNewWhitelistIp(''); }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg font-bold text-sm">Tambah</button>
                </div>
                <div className="space-y-2 overflow-y-auto max-h-60">
                  {(!data.whitelistIps?.length) && <p className="text-slate-500 text-center py-4 text-sm">Belum ada</p>}
                  {(data.whitelistIps || []).map((ip: string) => (
                    <div key={ip} className="bg-slate-950 border border-emerald-900/30 p-3 rounded-xl flex justify-between items-center">
                      <span className="text-emerald-300 font-mono text-xs">{ip}</span>
                      <button onClick={() => silentAction('remove_whitelist_ip', ip)} className="text-slate-500 hover:text-red-400 p-1 ml-2 shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Temp Ban */}
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-3 mb-5">
                  <div className="bg-yellow-500/20 p-3 rounded-xl"><Clock className="w-5 h-5 text-yellow-500" /></div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Temporary Ban IP</h2>
                    <p className="text-slate-400 text-xs">Ban IP sementara — auto-unban setelah durasi</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <input value={newTempBanIp} onChange={e => setNewTempBanIp(e.target.value)}
                    placeholder="IP Address (contoh: 1.2.3.4)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none text-sm" />
                  <div className="flex gap-2 items-center">
                    <input type="number" min={1} value={newTempBanHours} onChange={e => setNewTempBanHours(Number(e.target.value))}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white w-24 focus:border-yellow-500 outline-none text-sm" />
                    <span className="text-slate-400 text-sm shrink-0">jam</span>
                    <button onClick={() => {
                      if (!newTempBanIp.trim()) return;
                      silentAction('temp_ban_ip', { ip: newTempBanIp, hours: newTempBanHours });
                      setNewTempBanIp('');
                    }} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4" /> Ban Sementara
                    </button>
                  </div>
                  <p className="text-slate-500 text-xs">IP akan otomatis di-unban setelah durasi berakhir (TTL via Vercel KV).</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════ TAB: LOGS ══════════════════════════════════════ */}
        {activeTab === 'logs' && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
              <h3 className="text-xl font-bold text-white">Riwayat Aktivitas Sistem</h3>
              <button onClick={clearLogs}
                className="flex items-center gap-2 bg-red-950/30 text-red-400 hover:bg-red-900/40 px-4 py-2 rounded-lg text-sm font-semibold border border-red-900/30 transition-colors">
                <Trash2 className="w-4 h-4" /> Hapus Semua Log
              </button>
            </div>

            {/* Log Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <select value={logTypeFilter} onChange={e => setLogTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-300 focus:outline-none focus:border-blue-500 text-sm flex-1">
                <option value="all">Semua Tipe Log</option>
                <option value="email_received">📧 Email Masuk</option>
                <option value="ban">🚫 Ban Email</option>
                <option value="unban">✅ Unban Email</option>
                <option value="ban_ip">🔴 Ban IP</option>
                <option value="unban_ip">✅ Unban IP</option>
                <option value="auth_fail">⚠️ Auth Gagal</option>
                <option value="settings">⚙️ Pengaturan</option>
                <option value="whitelist">🌟 Whitelist</option>
                <option value="master_reset">💥 Master Reset</option>
                <option value="delete_inbox">🗑️ Hapus Inbox</option>
              </select>
              <input type="date" value={logDateFilter} onChange={e => setLogDateFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                style={{ colorScheme: 'dark' }} />
              {(logTypeFilter !== 'all' || logDateFilter) && (
                <button onClick={() => { setLogTypeFilter('all'); setLogDateFilter(''); }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm flex items-center gap-2 font-medium">
                  <X className="w-4 h-4" /> Reset
                </button>
              )}
            </div>

            <p className="text-slate-500 text-xs mb-4">
              Menampilkan {filteredLogs.length} dari {data.systemLogs?.length || 0} log
            </p>

            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredLogs.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <List className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Tidak ada log yang sesuai filter.</p>
                </div>
              )}
              {filteredLogs.map((log: any, index: number) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className={`px-2 py-1 rounded text-[10px] font-bold w-max shrink-0 ${LOG_COLORS[log.type] || 'bg-slate-500/20 text-slate-400'}`}>
                    {(log.type || 'log').toUpperCase().replace(/_/g, ' ')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-300 text-sm">{log.message}</div>
                    {log.detail && typeof log.detail === 'object' && (
                      <div className="text-slate-600 text-[11px] font-mono mt-0.5 truncate">
                        {JSON.stringify(log.detail)}
                      </div>
                    )}
                  </div>
                  <div className="text-slate-500 text-[11px] font-mono whitespace-nowrap shrink-0">
                    {new Date(log.timestamp).toLocaleString('id-ID')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
