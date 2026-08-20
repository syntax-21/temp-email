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
    // Fetch Telegram Settings from KV (fallback to environment variables if present)
    const botToken = ((await kv.get('telegram:bot_token')) as string) || process.env.TELEGRAM_BOT_TOKEN || '';
    const adminId = ((await kv.get('telegram:admin_id')) as string) || process.env.TELEGRAM_ADMIN_ID || '';
    const domain = ((await kv.get('telegram:domain')) as string) || process.env.TELEGRAM_DEFAULT_DOMAIN || '';

    if (!botToken) {
      console.warn('Telegram Bot Token is not configured in Admin Panel or ENV.');
      // Return 200 so Telegram webhook acknowledges receipt without endless retries
      return NextResponse.json({ error: 'Bot Token not configured' }, { status: 200 });
    }

    const bot = getBot(botToken, adminId, domain);
    const handleUpdate = webhookCallback(bot, 'std/http');

    return await handleUpdate(request);
  } catch (err) {
    console.error('Error handling telegram webhook update:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Telegram Webhook is active',
    timestamp: new Date().toISOString()
  });
}
