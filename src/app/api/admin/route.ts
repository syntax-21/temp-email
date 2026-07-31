import { NextResponse } from 'next/server';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

export const dynamic = 'force-dynamic';

function verifyAuth(request: Request) {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim();
  if (!ADMIN_PASSWORD) return { error: 'Sistem Belum Dikonfigurasi', status: 500 };
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${ADMIN_PASSWORD}`) return { error: 'Unauthorized Access', status: 401 };
  return null;
}

export async function GET(request: Request) {
  try {
    const authError = verifyAuth(request);
    if (authError) return NextResponse.json({ error: authError.error }, { status: authError.status });

    const keys = await kv.keys('inbox:*');
    
    // Ambil daftar email yang diblokir
    const bannedEmails = await kv.smembers('banned_emails') || [];

    if (!keys || keys.length === 0) {
      return NextResponse.json({ inboxes: [], bannedEmails });
    }

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

    inboxes.sort((a, b) => b.count - a.count);

    return NextResponse.json({ 
      totalActiveInboxes: keys.length,
      inboxes,
      bannedEmails
    });

  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: Untuk menghapus semua email di satu inbox
export async function DELETE(request: Request) {
  try {
    const authError = verifyAuth(request);
    if (authError) return NextResponse.json({ error: authError.error }, { status: authError.status });

    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) return NextResponse.json({ error: 'Address required' }, { status: 400 });

    await kv.del(`inbox:${address}`);
    return NextResponse.json({ success: true, message: `Inbox ${address} deleted` });
  } catch (error) {
    console.error('Admin DELETE error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Untuk blokir / unblokir alamat email
export async function POST(request: Request) {
  try {
    const authError = verifyAuth(request);
    if (authError) return NextResponse.json({ error: authError.error }, { status: authError.status });

    const data = await request.json();
    const { address, action } = data;

    if (!address || !action) return NextResponse.json({ error: 'Address and action required' }, { status: 400 });

    if (action === 'ban') {
      await kv.sadd('banned_emails', address);
      // Optional: Delete existing inbox when banned
      await kv.del(`inbox:${address}`);
      return NextResponse.json({ success: true, message: `${address} banned` });
    } else if (action === 'unban') {
      await kv.srem('banned_emails', address);
      return NextResponse.json({ success: true, message: `${address} unbanned` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Admin POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
