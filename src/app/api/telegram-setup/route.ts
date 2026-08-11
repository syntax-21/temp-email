import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { 
      error: 'Endpoint deprecated', 
      message: 'Pengaturan webhook Telegram sekarang dipindahkan ke halaman Web Admin (Tab Pengaturan).' 
    }, 
    { status: 410 }
  );
}
