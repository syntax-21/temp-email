import { NextResponse } from 'next/server';
import { bot } from '@/bot/telegram';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Simple security check (replace 'admin-secret' with ADMIN_PASSWORD or something secure)
    if (secret !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const domain = process.env.DOMAIN;
    if (!domain) {
      return NextResponse.json({ error: 'DOMAIN is not set in environment variables' }, { status: 400 });
    }

    const webhookUrl = `${domain}/api/telegram-webhook`;
    
    // Set the webhook via grammy
    await bot.api.setWebhook(webhookUrl);

    return NextResponse.json({ 
      success: true, 
      message: `Webhook successfully set to ${webhookUrl}` 
    });
  } catch (error: any) {
    console.error('Failed to set webhook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
