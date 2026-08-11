import { webhookCallback } from 'grammy';
import { bot } from '@/bot/telegram';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const handleUpdate = webhookCallback(bot, 'std/http');
    
    // We need to pass the request to grammy's webhook handler
    // 'std/http' adapter in grammy expects a standard web request,
    // which Next.js `Request` almost perfectly matches, but we must use it properly.
    // The easiest way with Next.js App Router and grammy is standard web Response
    
    return await handleUpdate(request);
  } catch (err) {
    console.error('Error handling telegram update', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Telegram sometimes sends GET requests for verification or webhook setup
export async function GET() {
  return NextResponse.json({ status: 'Telegram Webhook is active' });
}
