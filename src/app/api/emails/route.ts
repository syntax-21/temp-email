import { NextResponse } from 'next/server';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

// Memastikan API ini tidak di-cache oleh Vercel (karena email masuk harus realtime)
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Cek IP Address
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const isBannedIp = await kv.sismember('banned_ips', ip);
  if (isBannedIp) {
    return NextResponse.json({ error: 'Akses Ditolak (Banned IP)' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
  }

  try {
    const emailTo = address.toLowerCase();
    
    // Cek Reserved Names
    const prefix = emailTo.split('@')[0];
    const isReserved = await kv.sismember('reserved_names', prefix);
    if (isReserved) {
      return NextResponse.json({ error: 'Nama email ini dilarang digunakan (Reserved)' }, { status: 403 });
    }

    // Mengambil seluruh isi inbox dari Vercel KV
    const emails = await kv.lrange(`inbox:${emailTo}`, 0, -1);
    
    return NextResponse.json({ emails: emails || [] });
  } catch (error) {
    console.error('Get emails error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
