import { NextResponse } from 'next/server';
import { createClient } from '@vercel/kv';
import PostalMime from 'postal-mime';

const kv = createClient({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { dari, tujuan, isi_email_mentah } = data;

    if (!tujuan) {
      return NextResponse.json({ error: 'Alamat tujuan tidak ditemukan' }, { status: 400 });
    }

    // Ekstrak alamat tujuan dengan huruf kecil semua (contoh: User@brepremiumstore.store -> user@brepremiumstore.store)
    const emailTo = tujuan.toLowerCase();
    
    // Cek apakah alamat ini diblokir (banned)
    const isBanned = await kv.sismember('banned_emails', emailTo);
    if (isBanned) {
      console.log(`Email ditolak (Banned): ${emailTo}`);
      return NextResponse.json({ error: 'Address is banned' }, { status: 403 });
    }

    // Cek apakah email tujuan menggunakan reserved name (Misal prefix 'admin')
    const prefix = emailTo.split('@')[0];
    const isReserved = await kv.sismember('reserved_names', prefix);
    if (isReserved) {
      console.log(`Email ditolak (Reserved Name): ${emailTo}`);
      return NextResponse.json({ error: 'Address is reserved' }, { status: 403 });
    }

    // Parse email mentah menggunakan postal-mime
    let parsedEmail: any = {};
    try {
      const parser = new PostalMime();
      parsedEmail = await parser.parse(isi_email_mentah);
    } catch (e) {
      console.error('Gagal parsing email', e);
    }

    // Siapkan data email yang akan disimpan ke Vercel KV (Database)
    const newEmail = {
      id: Date.now().toString(),
      from: parsedEmail.from?.address || dari || 'Unknown Sender',
      fromName: parsedEmail.from?.name || '',
      to: emailTo,
      subject: parsedEmail.subject || '(Tanpa Subjek)',
      text: parsedEmail.text || '',
      html: parsedEmail.html || '',
      rawBody: isi_email_mentah,
      receivedAt: new Date().toISOString()
    };

    // Simpan email ke dalam list (inbox) berdasarkan alamat tujuannya
    await kv.lpush(`inbox:${emailTo}`, newEmail);
    // Batasi maksimum 50 email per alamat agar penyimpanan tidak membengkak
    await kv.ltrim(`inbox:${emailTo}`, 0, 49);
    
    // Ambil setting expiry (default 86400 detik = 24 jam)
    const expirySetting = await kv.get('settings:expiry');
    const expiryTime = typeof expirySetting === 'number' ? expirySetting : 86400;
    
    // Set expiry
    await kv.expire(`inbox:${emailTo}`, expiryTime);

    // Update Statistik
    await kv.incr('stats:emails_received');

    // Catat ke System Logs
    const logEntry = {
      id: Date.now().toString(),
      type: 'webhook_received',
      message: `Pesan baru diterima untuk ${emailTo}`,
      timestamp: new Date().toISOString()
    };
    await kv.lpush('system_logs', logEntry);
    await kv.ltrim('system_logs', 0, 99); // Simpan 100 log terakhir

    return NextResponse.json({ success: true, message: 'Email berhasil disimpan ke KV' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
