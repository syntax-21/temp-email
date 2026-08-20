import { NextResponse } from 'next/server';
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

export const dynamic = 'force-dynamic';

const DEFAULT_DOMAINS = ['breonline.biz.id', 'breonline.my.id', 'brepremiumstore.my.id', 'brepremiumstore.store'];

export async function GET() {
  try {
    const customDomains = await kv.smembers('domains');
    const reservedNames = (await kv.smembers('reserved_names')) || [];
    const botUsername = (await kv.get('telegram:bot_username')) || process.env.TELEGRAM_BOT_USERNAME || '';
    
    // If no custom domains in DB, use default ones
    const activeDomains = (customDomains && customDomains.length > 0) ? customDomains : DEFAULT_DOMAINS;

    return NextResponse.json({
      domains: activeDomains,
      reservedNames: reservedNames,
      telegramBotUsername: botUsername
    });
  } catch (error) {
    console.error('Settings API error:', error);
    return NextResponse.json({ 
      domains: DEFAULT_DOMAINS,
      reservedNames: [],
      telegramBotUsername: ''
    });
  }
}
