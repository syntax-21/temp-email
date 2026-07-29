import { NextResponse } from 'next/server';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

export const dynamic = 'force-dynamic';

// Password Master Admin dari Environment Variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export async function GET(request: Request) {
  try {
    // 1. Verifikasi Password
    if (!ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Sistem Belum Dikonfigurasi: ADMIN_PASSWORD tidak ditemukan.' }, { status: 500 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    // 2. Ambil semua kunci kotak masuk yang aktif di server
    // Catatan: kv.keys() mungkin memiliki limitasi pada database besar, 
    // tapi untuk Temp Mail dengan masa aktif singkat, ini sangat aman.
    const keys = await kv.keys('inbox:*');
    
    if (!keys || keys.length === 0) {
      return NextResponse.json({ inboxes: [] });
    }

    // 3. Ambil isi email dari masing-masing alamat
    const inboxes = await Promise.all(
      keys.map(async (key) => {
        const address = key.replace('inbox:', '');
        const emails = await kv.lrange(key, 0, -1) || [];
        return {
          address,
          count: emails.length,
          emails: emails
        };
      })
    );

    // 4. Urutkan berdasarkan yang memiliki pesan terbanyak
    inboxes.sort((a, b) => b.count - a.count);

    return NextResponse.json({ 
      totalActiveInboxes: keys.length,
      inboxes 
    });

  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
