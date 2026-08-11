import { webhookCallback } from 'grammy';
import { getBot } from '@/bot/telegram';
import { NextResponse } from 'next/server';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Fetch Telegram Settings from KV
    const botToken = await kv.get('telegram:bot_token') as string;
    const adminId = await kv.get('telegram:admin_id') as string;
    const domain = await kv.get('telegram:domain') as string;

    if (!botToken) {
      console.error('Telegram Bot Token is not configured in Admin Panel.');
      // Return 200 so Telegram stops retrying, or 400. We use 200 so Telegram knows we received it.
      return NextResponse.json({ error: 'Bot Token not configured' }, { status: 200 });
    }

    const bot = getBot(botToken, adminId, domain);
    const handleUpdate = webhookCallback(bot, 'std/http');
    
    return await handleUpdate(request);
  } catch (err) {
    console.error('Error handling telegram update', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Telegram Webhook is active' });
}
