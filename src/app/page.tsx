'use client';

import { useState, useEffect } from 'react';
import { Mail, RefreshCcw, Copy, CheckCircle2, Trash2 } from 'lucide-react';

export default function TempMail() {
  const [emailAddress, setEmailAddress] = useState('');
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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
              <span className="text-xl md:text-2xl font-mono text-gray-200 select-all break-all">
                {emailAddress || 'Generating...'}
              </span>
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
                  <div key={email.id} className="p-6 hover:bg-gray-800/50 transition-colors">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-4 gap-2">
                      <div>
                        <h3 className="font-medium text-lg text-gray-200">Dari: {email.from}</h3>
                        <p className="text-sm text-gray-500">{new Date(email.receivedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    {/* Raw email content viewer */}
                    <div className="bg-black/40 p-4 rounded-2xl text-sm font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto border border-gray-800/50">
                      {email.rawBody || 'Tidak ada konten / Gagal memproses'}
                    </div>
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
