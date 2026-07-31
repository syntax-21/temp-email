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
    const bannedEmails = await kv.smembers('banned_emails') || [];
    
    // Enterprise Features Data
    const customDomains = await kv.smembers('domains') || [];
    const reservedNames = await kv.smembers('reserved_names') || [];
    const bannedIps = await kv.smembers('banned_ips') || [];
    
    const expirySetting = await kv.get('settings:expiry');
    const expiryTime = typeof expirySetting === 'number' ? expirySetting : 86400;
    
    const emailsReceived = await kv.get('stats:emails_received') || 0;
    
    const systemLogs = await kv.lrange('system_logs', 0, 99) || [];

    let inboxes: any[] = [];
    if (keys && keys.length > 0) {
      inboxes = await Promise.all(
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
    }

    return NextResponse.json({ 
      totalActiveInboxes: keys.length || 0,
      inboxes,
      bannedEmails,
      domains: customDomains,
      reservedNames,
      bannedIps,
      settings: { expiry: expiryTime },
      stats: { emailsReceived },
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

    // Master Reset (Hapus Semua)
    if (type === 'all_inboxes') {
      const keys = await kv.keys('inbox:*');
      if (keys && keys.length > 0) {
        // kv.del takes multiple keys
        await kv.del(...keys);
      }
      // Catat log
      const logEntry = {
        id: Date.now().toString(),
        type: 'master_reset',
        message: `Admin melakukan Master Reset (${keys.length} inbox dihapus)`,
        timestamp: new Date().toISOString()
      };
      await kv.lpush('system_logs', logEntry);
      return NextResponse.json({ success: true, message: `Berhasil menghapus ${keys.length} kotak masuk.` });
    }

    // Hapus Single Inbox
    if (!address) return NextResponse.json({ error: 'Address required' }, { status: 400 });

    await kv.del(`inbox:${address}`);
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
    const { action, value } = data; // generic payload for new actions
    const address = data.address; // old payload backward compatibility

    if (!action) return NextResponse.json({ error: 'Action required' }, { status: 400 });

    // Old ban actions
    if (action === 'ban' && address) {
      await kv.sadd('banned_emails', address);
      await kv.del(`inbox:${address}`);
      return NextResponse.json({ success: true, message: `${address} banned` });
    } else if (action === 'unban' && address) {
      await kv.srem('banned_emails', address);
      return NextResponse.json({ success: true, message: `${address} unbanned` });
    }

    // New actions
    switch (action) {
      case 'save_settings':
        if (value && typeof value.expiry === 'number') {
          await kv.set('settings:expiry', value.expiry);
          return NextResponse.json({ success: true });
        }
        break;
      case 'add_domain':
        if (value) await kv.sadd('domains', value);
        return NextResponse.json({ success: true });
      case 'remove_domain':
        if (value) await kv.srem('domains', value);
        return NextResponse.json({ success: true });
      case 'add_reserved':
        if (value) await kv.sadd('reserved_names', value);
        return NextResponse.json({ success: true });
      case 'remove_reserved':
        if (value) await kv.srem('reserved_names', value);
        return NextResponse.json({ success: true });
      case 'ban_ip':
        if (value) await kv.sadd('banned_ips', value);
        return NextResponse.json({ success: true });
      case 'unban_ip':
        if (value) await kv.srem('banned_ips', value);
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action or missing parameters' }, { status: 400 });
  } catch (error) {
    console.error('Admin POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
