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
    // Set expiry (pesan dihapus otomatis setelah 24 jam)
    await kv.expire(`inbox:${emailTo}`, 86400);

    return NextResponse.json({ success: true, message: 'Email berhasil disimpan ke KV' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
