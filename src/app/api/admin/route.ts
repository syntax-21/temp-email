import { NextResponse } from 'next/server';
import { createClient } from '@vercel/kv';
import { getBot } from '@/bot/telegram';

const kv = createClient({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

export const dynamic = 'force-dynamic';

function verifyAuth(request: Request): { error: string; status: number } | null {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim();
  if (!ADMIN_PASSWORD) return { error: 'Sistem Belum Dikonfigurasi', status: 500 };
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${ADMIN_PASSWORD}`) return { error: 'Unauthorized Access', status: 401 };
  return null;
}

async function addLog(type: string, message: string, detail?: any) {
  const logEntry = {
    id: Date.now().toString(),
    type,
    message,
    detail: detail || null,
    timestamp: new Date().toISOString()
  };
  await kv.lpush('system_logs', logEntry);
  await kv.ltrim('system_logs', 0, 499);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const format = searchParams.get('format');

  // Auth check (log failures)
  const authError = verifyAuth(request);
  if (authError) {
    if (authError.status === 401) {
      const ip = request.headers.get('x-forwarded-for') || 'unknown';
      await addLog('auth_fail', `Percobaan akses admin gagal dari IP: ${ip}`);
    }
    return NextResponse.json({ error: authError.error }, { status: authError.status });
  }

  // ── EXPORT ACTIONS ───────────────────────────────────────────────
  if (action === 'export') {
    const keys = await kv.keys('inbox:*');

    if (format === 'json') {
      let inboxes: any[] = [];
      if (keys && keys.length > 0) {
        inboxes = await Promise.all(
          keys.map(async (key) => {
            const address = key.replace('inbox:', '');
            const emails = await kv.lrange(key, 0, -1) || [];
            return { address, emails };
          })
        );
      }
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalInboxes: inboxes.length,
        inboxes
      };
      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="tmail-inboxes-${new Date().toISOString().split('T')[0]}.json"`
        }
      });
    }

    if (format === 'logs_csv') {
      const logs = (await kv.lrange('system_logs', 0, -1) || []) as any[];
      const csvLines = ['id,type,message,timestamp'];
      for (const log of logs) {
        const msg = (log.message || '').replace(/"/g, '""');
        csvLines.push(`"${log.id}","${log.type}","${msg}","${log.timestamp}"`);
      }
      return new Response(csvLines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="tmail-logs-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    if (format === 'banned_emails') {
      const bannedEmails = (await kv.smembers('banned_emails') || []) as string[];
      return new Response(bannedEmails.join('\n'), {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="banned-emails-${new Date().toISOString().split('T')[0]}.txt"`
        }
      });
    }

    if (format === 'banned_ips') {
      const bannedIps = (await kv.smembers('banned_ips') || []) as string[];
      return new Response(bannedIps.join('\n'), {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="banned-ips-${new Date().toISOString().split('T')[0]}.txt"`
        }
      });
    }

    return NextResponse.json({ error: 'Format export tidak dikenali' }, { status: 400 });
  }

  // ── REGULAR GET ───────────────────────────────────────────────────
  try {
    const keys = await kv.keys('inbox:*');
    const bannedEmails = (await kv.smembers('banned_emails')) || [];
    const customDomains = (await kv.smembers('domains')) || [];
    const reservedNames = (await kv.smembers('reserved_names')) || [];
    const bannedIps = (await kv.smembers('banned_ips')) || [];
    const whitelistIps = (await kv.smembers('whitelist_ips')) || [];
    const whitelistEmails = (await kv.smembers('whitelist_emails')) || [];

    const expirySetting = await kv.get('settings:expiry');
    const expiryTime = typeof expirySetting === 'number' ? expirySetting : 86400;

    const maintenanceMode = (await kv.get('settings:maintenance')) || false;
    const autoBanThreshold = (await kv.get('settings:autoban_threshold')) || 0;
    
    const telegramSettings = {
      botToken: (await kv.get('telegram:bot_token')) || '',
      adminId: (await kv.get('telegram:admin_id')) || '',
      domain: (await kv.get('telegram:domain')) || '',
      botUsername: (await kv.get('telegram:bot_username')) || ''
    };

    const emailsReceived = (await kv.get('stats:emails_received')) || 0;

    // Analytics: last 7 days daily stats
    const dailyStats: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = (await kv.get(`stats:daily:${dateStr}`)) || 0;
      dailyStats.push({ date: dateStr, count: Number(count) });
    }

    // Top 5 senders from sorted set
    const topSenderMembers = (await kv.zrange('stats:senders', 0, 4, { rev: true })) || [];
    const topSenders = await Promise.all(
      (topSenderMembers as string[]).map(async (email) => {
        const score = await kv.zscore('stats:senders', email);
        return { email, count: Number(score || 0) };
      })
    );

    // Per-domain expiry settings
    const domainExpiry: Record<string, number> = {};
    for (const d of customDomains as string[]) {
      const de = await kv.get(`settings:expiry:${d}`);
      if (typeof de === 'number') domainExpiry[d] = de;
    }

    // Inboxes
    let inboxes: any[] = [];
    if (keys && keys.length > 0) {
      inboxes = await Promise.all(
        keys.map(async (key) => {
          const address = key.replace('inbox:', '');
          const emails = (await kv.lrange(key, 0, -1)) || [];
          return { address, count: emails.length, emails };
        })
      );
      inboxes.sort((a, b) => b.count - a.count);
    }

    // Top 5 inboxes by count
    const topInboxes = [...inboxes]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ address, count }) => ({ address, count }));

    const systemLogs = (await kv.lrange('system_logs', 0, 299)) || [];

    return NextResponse.json({
      totalActiveInboxes: keys.length || 0,
      inboxes,
      bannedEmails,
      domains: customDomains,
      reservedNames,
      bannedIps,
      whitelistIps,
      whitelistEmails,
      settings: { expiry: expiryTime, maintenance: maintenanceMode, autoBanThreshold },
      telegramSettings,
      domainExpiry,
      stats: { emailsReceived, dailyStats, topSenders, topInboxes },
      systemLogs
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authError = verifyAuth(request);
    if (authError) return NextResponse.json({ error: authError.error }, { status: authError.status });

    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const type = searchParams.get('type');

    if (type === 'all_inboxes') {
      const keys = await kv.keys('inbox:*');
      if (keys && keys.length > 0) {
        await kv.del(...keys);
      }
      await addLog('master_reset', `Admin melakukan Master Reset (${keys.length} inbox dihapus)`);
      return NextResponse.json({ success: true, message: `Berhasil menghapus ${keys.length} kotak masuk.` });
    }

    if (!address) return NextResponse.json({ error: 'Address required' }, { status: 400 });
    await kv.del(`inbox:${address}`);
    await addLog('delete_inbox', `Inbox dihapus: ${address}`);
    return NextResponse.json({ success: true, message: `Inbox ${address} deleted` });
  } catch (error) {
    console.error('Admin DELETE error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authError = verifyAuth(request);
    if (authError) return NextResponse.json({ error: authError.error }, { status: authError.status });

    const data = await request.json();
    const { action, value } = data;
    const address = data.address;

    if (!action) return NextResponse.json({ error: 'Action required' }, { status: 400 });

    // ── EMAIL BAN / UNBAN ─────────────────────────────────────────
    if (action === 'ban' && address) {
      await kv.sadd('banned_emails', address);
      await kv.del(`inbox:${address}`);
      await addLog('ban', `Email diblokir: ${address}`);
      return NextResponse.json({ success: true });
    }
    if (action === 'unban' && address) {
      await kv.srem('banned_emails', address);
      await addLog('unban', `Email di-unban: ${address}`);
      return NextResponse.json({ success: true });
    }

    switch (action) {

      // ── SETTINGS ─────────────────────────────────────────────────
      case 'save_settings':
        if (value && typeof value.expiry === 'number') {
          await kv.set('settings:expiry', value.expiry);
          await addLog('settings', `Expiry global diubah: ${value.expiry / 3600} jam`);
          return NextResponse.json({ success: true });
        }
        break;

      case 'toggle_maintenance': {
        const current = await kv.get('settings:maintenance');
        const next = !current;
        await kv.set('settings:maintenance', next);
        await addLog('settings', `Maintenance mode: ${next ? 'AKTIF' : 'NONAKTIF'}`);
        return NextResponse.json({ success: true, maintenance: next });
      }

      // ── PER-DOMAIN EXPIRY ────────────────────────────────────────
      case 'set_domain_expiry':
        if (value && value.domain && typeof value.expiry === 'number') {
          await kv.set(`settings:expiry:${value.domain}`, value.expiry);
          await addLog('settings', `Expiry domain [${value.domain}] diubah: ${value.expiry / 3600} jam`);
          return NextResponse.json({ success: true });
        }
        break;

      case 'remove_domain_expiry':
        if (value) {
          await kv.del(`settings:expiry:${value}`);
          return NextResponse.json({ success: true });
        }
        break;

      // ── WHITELIST EMAIL ───────────────────────────────────────────
      case 'add_whitelist_email':
        if (value) {
          await kv.sadd('whitelist_emails', value);
          await addLog('whitelist', `Email ditambah ke whitelist (tidak expire): ${value}`);
          return NextResponse.json({ success: true });
        }
        break;

      case 'remove_whitelist_email':
        if (value) {
          await kv.srem('whitelist_emails', value);
          return NextResponse.json({ success: true });
        }
        break;

      // ── WHITELIST IP ──────────────────────────────────────────────
      case 'add_whitelist_ip':
        if (value) {
          await kv.sadd('whitelist_ips', value);
          await addLog('whitelist', `IP ditambah ke whitelist: ${value}`);
          return NextResponse.json({ success: true });
        }
        break;

      case 'remove_whitelist_ip':
        if (value) {
          await kv.srem('whitelist_ips', value);
          return NextResponse.json({ success: true });
        }
        break;

      // ── AUTO-BAN THRESHOLD ────────────────────────────────────────
      case 'set_autoban':
        if (typeof value === 'number') {
          await kv.set('settings:autoban_threshold', value);
          await addLog('settings', `Auto-ban threshold: ${value > 0 ? `${value} req/menit` : 'NONAKTIF'}`);
          return NextResponse.json({ success: true });
        }
        break;

      // ── IP BAN / UNBAN ────────────────────────────────────────────
      case 'ban_ip':
        if (value) {
          await kv.sadd('banned_ips', value);
          await addLog('ban_ip', `IP diblokir permanen: ${value}`);
          return NextResponse.json({ success: true });
        }
        break;

      case 'unban_ip':
        if (value) {
          await kv.srem('banned_ips', value);
          await addLog('unban_ip', `IP di-unban: ${value}`);
          return NextResponse.json({ success: true });
        }
        break;

      // ── TEMPORARY BAN IP ──────────────────────────────────────────
      case 'temp_ban_ip':
        if (value && value.ip && typeof value.hours === 'number') {
          const ttlSeconds = value.hours * 3600;
          await kv.set(`banned_ips:temp:${value.ip}`, '1', { ex: ttlSeconds });
          await addLog('ban_ip', `IP di-ban sementara ${value.hours} jam: ${value.ip}`);
          return NextResponse.json({ success: true });
        }
        break;

      // ── CLEAR LOGS ────────────────────────────────────────────────
      case 'clear_logs':
        await kv.del('system_logs');
        return NextResponse.json({ success: true });

      // ── DOMAIN MANAGEMENT ─────────────────────────────────────────
      case 'add_domain':
        if (value) {
          await kv.sadd('domains', value);
          await addLog('settings', `Domain ditambah: ${value}`);
          return NextResponse.json({ success: true });
        }
        break;

      case 'remove_domain':
        if (value) {
          await kv.srem('domains', value);
          await addLog('settings', `Domain dihapus: ${value}`);
          return NextResponse.json({ success: true });
        }
        break;

      // ── RESERVED NAMES ────────────────────────────────────────────
      case 'add_reserved':
        if (value) {
          await kv.sadd('reserved_names', value);
          return NextResponse.json({ success: true });
        }
        break;

      case 'remove_reserved':
        if (value) {
          await kv.srem('reserved_names', value);
          return NextResponse.json({ success: true });
        }
        break;

      // ── TELEGRAM WEBHOOK & SETTINGS ───────────────────────────────
      case 'save_telegram_settings':
        if (value && typeof value === 'object') {
          if (value.botToken !== undefined) await kv.set('telegram:bot_token', value.botToken);
          if (value.adminId !== undefined) await kv.set('telegram:admin_id', value.adminId);
          if (value.domain !== undefined) await kv.set('telegram:domain', value.domain);
          
          let botUsername = '';
          if (value.botToken) {
            try {
              const tempBot = getBot(value.botToken, '', '');
              const me = await tempBot.api.getMe();
              if (me && me.username) {
                botUsername = me.username;
                await kv.set('telegram:bot_username', me.username);
              }
            } catch (e) {
              console.warn('Could not auto-fetch bot username', e);
            }
          }
          await addLog('settings', `Konfigurasi Bot Telegram disimpan ${botUsername ? `(@${botUsername})` : ''}`);
          return NextResponse.json({ success: true, botUsername, message: 'Pengaturan Telegram berhasil disimpan!' });
        }
        break;

      case 'setup_telegram_webhook':
        if (value) {
          const webhookUrl = `${value.toString().replace(/\/$/, '')}/api/telegram-webhook`;
          try {
            const botToken = ((await kv.get('telegram:bot_token')) as string) || process.env.TELEGRAM_BOT_TOKEN;
            if (!botToken) {
              return NextResponse.json({ error: 'Bot Token belum dikonfigurasi!' }, { status: 400 });
            }
            const tempBot = getBot(botToken, '', '');
            const me = await tempBot.api.getMe();
            if (me && me.username) {
              await kv.set('telegram:bot_username', me.username);
            }
            await tempBot.api.setWebhook(webhookUrl);
            await addLog('settings', `Telegram Webhook disetel ke: ${webhookUrl} (@${me.username || 'bot'})`);
            return NextResponse.json({
              success: true,
              botUsername: me.username,
              message: `Webhook Telegram berhasil diaktifkan untuk @${me.username || 'bot'}!`
            });
          } catch (err: any) {
            await addLog('auth_fail', `Gagal set Webhook Telegram: ${err.message}`);
            return NextResponse.json({ error: err.message }, { status: 500 });
          }
        }
        break;

      case 'test_telegram_bot': {
        const botToken = ((await kv.get('telegram:bot_token')) as string) || process.env.TELEGRAM_BOT_TOKEN;
        const adminId = ((await kv.get('telegram:admin_id')) as string) || process.env.TELEGRAM_ADMIN_ID;
        if (!botToken) {
          return NextResponse.json({ error: 'Bot Token belum diisi!' }, { status: 400 });
        }
        try {
          const tempBot = getBot(botToken, adminId || '', '');
          const me = await tempBot.api.getMe();
          if (me && me.username) {
            await kv.set('telegram:bot_username', me.username);
          }
          if (adminId) {
            await tempBot.api.sendMessage(
              adminId,
              `✅ *Tes Koneksi Bot Berhasil!*\n\nBot *@${me.username}* terhubung dengan server Temp Mail dan siap digunakan.`,
              { parse_mode: 'Markdown' }
            );
          }
          return NextResponse.json({
            success: true,
            botUsername: me.username,
            message: `Koneksi berhasil! Bot: @${me.username}${adminId ? ' (Pesan tes terkirim ke Admin ID Telegram Anda)' : ''}`
          });
        } catch (err: any) {
          return NextResponse.json({ error: `Gagal tes koneksi: ${err.message}` }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ error: 'Invalid action or missing parameters' }, { status: 400 });
  } catch (error) {
    console.error('Admin POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
