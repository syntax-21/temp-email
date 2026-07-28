import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Memastikan API ini tidak di-cache oleh Vercel (karena email masuk harus realtime)
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
  }

  try {
    const emailTo = address.toLowerCase();
    
    // Mengambil seluruh isi inbox dari Vercel KV
    const emails = await kv.lrange(`inbox:${emailTo}`, 0, -1);
    
    return NextResponse.json({ emails: emails || [] });
  } catch (error) {
    console.error('Get emails error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
