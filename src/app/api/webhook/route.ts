import { NextResponse } from 'next/server';
import { createClient } from '@vercel/kv';
import PostalMime from 'postal-mime';
import { extractOtp, getBot } from '@/bot/telegram';

const kv = createClient({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { dari, tujuan, isi_email_mentah } = data;

    if (!tujuan) {
      return NextResponse.json({ error: 'Alamat tujuan tidak ditemukan' }, { status: 400 });
    }

    // Cek maintenance mode — tolak semua email masuk saat maintenance
    const maintenanceMode = await kv.get('settings:maintenance');
    if (maintenanceMode) {
      return NextResponse.json({ error: 'Sistem sedang dalam maintenance' }, { status: 503 });
    }

    const emailTo = tujuan.toLowerCase();
    const domain = emailTo.split('@')[1] || '';

    // Cek apakah alamat ini diblokir (banned)
    const isBanned = await kv.sismember('banned_emails', emailTo);
    if (isBanned) {
      console.log(`Email ditolak (Banned): ${emailTo}`);
      return NextResponse.json({ error: 'Address is banned' }, { status: 403 });
    }

    // Cek apakah email tujuan menggunakan reserved name
    const prefix = emailTo.split('@')[0];
    const isReserved = await kv.sismember('reserved_names', prefix);
    if (isReserved) {
      console.log(`Email ditolak (Reserved Name): ${emailTo}`);
      return NextResponse.json({ error: 'Address is reserved' }, { status: 403 });
    }

    // Parse email mentah menggunakan postal-mime
    let parsedEmail: any = {};
    try {
      const parser = new PostalMime();
      parsedEmail = await parser.parse(isi_email_mentah);
    } catch (e) {
      console.error('Gagal parsing email', e);
    }

    const fromAddress = parsedEmail.from?.address || dari || 'Unknown Sender';
    const subject = parsedEmail.subject || '(Tanpa Subjek)';

    // Siapkan data email
    const newEmail = {
      id: Date.now().toString(),
      from: fromAddress,
      fromName: parsedEmail.from?.name || '',
      to: emailTo,
      subject,
      text: parsedEmail.text || '',
      html: parsedEmail.html || '',
      rawBody: isi_email_mentah,
      receivedAt: new Date().toISOString()
    };

    // Simpan email ke dalam list (inbox)
    await kv.lpush(`inbox:${emailTo}`, newEmail);
    // Batasi maksimum 50 email per alamat
    await kv.ltrim(`inbox:${emailTo}`, 0, 49);

    // Cek whitelist email — email yang di-whitelist tidak pernah expire
    const isWhitelisted = await kv.sismember('whitelist_emails', emailTo);
    if (!isWhitelisted) {
      // Cek expiry per-domain dulu, fallback ke global
      const domainExpiry = await kv.get(`settings:expiry:${domain}`);
      const globalExpiry = await kv.get('settings:expiry');
      const expiryTime =
        (typeof domainExpiry === 'number' ? domainExpiry : null) ??
        (typeof globalExpiry === 'number' ? globalExpiry : 86400);
      await kv.expire(`inbox:${emailTo}`, expiryTime as number);
    }

    // Update statistik global
    await kv.incr('stats:emails_received');

    // Update statistik harian (untuk grafik analytics)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    await kv.incr(`stats:daily:${today}`);
    await kv.expire(`stats:daily:${today}`, 60 * 60 * 24 * 30); // simpan 30 hari

    // Update top senders (sorted set — zincrby)
    await kv.zincrby('stats:senders', 1, fromAddress);

    // Catat ke System Logs dengan detail lebih lengkap
    const logEntry = {
      id: Date.now().toString(),
      type: 'email_received',
      message: `Email diterima: "${subject}" dari ${fromAddress} → ${emailTo}`,
      detail: { from: fromAddress, to: emailTo, subject },
      timestamp: new Date().toISOString()
    };
    await kv.lpush('system_logs', logEntry);
    await kv.ltrim('system_logs', 0, 499); // simpan 500 log terakhir

    // ── Instant Realtime Push Notification to Telegram Users ────────────────
    try {
      const userChatIds = await kv.smembers(`bot_email_users:${emailTo}`) as string[];
      const botToken = ((await kv.get('telegram:bot_token')) as string) || process.env.TELEGRAM_BOT_TOKEN;
      const adminId = ((await kv.get('telegram:admin_id')) as string) || '';
      const customDomain = ((await kv.get('telegram:domain')) as string) || domain;

      if (botToken && userChatIds && userChatIds.length > 0) {
        const bot = getBot(botToken, adminId, customDomain);
        const otp = extractOtp(newEmail.text, newEmail.subject);

        let preview = (newEmail.text || '').replace(/\s+/g, ' ').trim();
        if (!preview && newEmail.html) {
          preview = newEmail.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        if (preview.length > 180) {
          preview = preview.substring(0, 180) + '...';
        }
        if (!preview) preview = '(Tidak ada teks preview)';

        const senderDisplay = newEmail.fromName ? `${newEmail.fromName} (${fromAddress})` : fromAddress;

        let pushText =
          `🔔 *EMAIL BARU DITERIMA!*\n\n` +
          `📫 *Alamat:* \`${emailTo}\`\n` +
          `👤 *Dari:* ${senderDisplay}\n` +
          `📌 *Subjek:* *${subject}*\n`;

        if (otp) {
          pushText +=
            `\n───────────────────────\n` +
            `🔑 *KODE OTP / VERIFIKASI:*\n` +
            `👉 \`${otp}\` 👈 _(tekan untuk salin)_\n` +
            `───────────────────────\n`;
        } else {
          pushText += `───────────────────────\n`;
        }

        pushText += `📝 *Cuplikan:*\n_${preview}_`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: '📖 Baca Email Lengkap', callback_data: `read_email:${emailTo}:${newEmail.id}` },
              { text: '📥 Kotak Masuk', callback_data: `view_inbox:${emailTo}` }
            ]
          ]
        };

        for (const chatId of userChatIds) {
          try {
            await bot.api.sendMessage(chatId, pushText, {
              parse_mode: 'Markdown',
              reply_markup: keyboard
            });
          } catch (sendErr) {
            console.error(`Failed to send telegram notification to chatId ${chatId}:`, sendErr);
          }
        }
      }
    } catch (pushErr) {
      console.error('Error dispatching telegram push notification:', pushErr);
    }

    return NextResponse.json({ success: true, message: 'Email berhasil disimpan ke KV' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
