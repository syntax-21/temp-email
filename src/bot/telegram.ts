import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { createClient } from '@vercel/kv';
import { HUMAN_NAMES } from '@/utils/names';

const kv = createClient({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

const DEFAULT_DOMAINS = [
  'breonline.biz.id',
  'breonline.my.id',
  'brepremiumstore.my.id',
  'brepremiumstore.store'
];

let cachedBot: Bot | null = null;
let cachedToken: string | null = null;

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

export function escapeHtml(str: string = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function extractOtp(text: string = '', subject: string = ''): string | null {
  const combined = `${subject} \n ${text}`;
  
  const keywordRegex = /(?:kode|code|otp|pin|verifikasi|verification|password|token|konfirmasi|confirm)[^0-9a-zA-Z\n]{1,15}([0-9]{4,8}|[A-Z0-9]{5,8})\b/i;
  const keywordMatch = combined.match(keywordRegex);
  if (keywordMatch && keywordMatch[1]) {
    return keywordMatch[1];
  }

  const subjectDigitMatch = subject.match(/\b([0-9]{4,6})\b/);
  if (subjectDigitMatch && subjectDigitMatch[1]) {
    return subjectDigitMatch[1];
  }

  const sixDigitMatch = text.match(/\b([0-9]{6})\b/);
  if (sixDigitMatch && sixDigitMatch[1]) {
    return sixDigitMatch[1];
  }

  const fourDigitMatch = text.match(/\b([0-9]{4})\b/);
  if (fourDigitMatch && fourDigitMatch[1]) {
    return fourDigitMatch[1];
  }

  return null;
}

export function formatTimeAgo(isoString?: string): string {
  if (!isoString) return 'Baru saja';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}j lalu`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}h lalu`;
}

async function getSystemDomains(fallbackDomain?: string): Promise<string[]> {
  try {
    const customDomains = (await kv.smembers('domains')) as string[];
    if (customDomains && customDomains.length > 0) {
      return customDomains;
    }
  } catch (e) {
    console.error('Failed to get domains from KV', e);
  }
  if (fallbackDomain && fallbackDomain.trim() && !DEFAULT_DOMAINS.includes(fallbackDomain)) {
    return [fallbackDomain, ...DEFAULT_DOMAINS];
  }
  return DEFAULT_DOMAINS;
}

function getRandomPrefix(): string {
  const randomName = HUMAN_NAMES[Math.floor(Math.random() * HUMAN_NAMES.length)];
  const randomSuffix = Math.floor(Math.random() * 8999 + 1000);
  return `${randomName.toLowerCase()}${randomSuffix}`;
}

async function isUserAdmin(chatId: number | string, fallbackAdminId?: string): Promise<boolean> {
  try {
    const rawAdmin = (await kv.get('telegram:admin_id')) ?? fallbackAdminId ?? process.env.TELEGRAM_ADMIN_ID ?? '';
    const adminStr = String(rawAdmin).trim();
    const userStr = String(chatId).trim();
    if (!adminStr || !userStr) return false;
    return userStr === adminStr;
  } catch (err) {
    console.error('Error checking isUserAdmin:', err);
    return false;
  }
}

// ─── USER APPROVAL & AUTH CHECKERS ───────────────────────────────────────────

export async function checkUserStatus(
  chatId: number | string,
  ctxUser?: any,
  fallbackAdminId?: string
): Promise<{ status: 'approved' | 'pending' | 'rejected'; isNew: boolean }> {
  // Admin is ALWAYS approved and whitelisted immediately
  const isAdmin = await isUserAdmin(chatId, fallbackAdminId);
  if (isAdmin) {
    try {
      await kv.set(`bot_user_status:${chatId}`, 'approved');
      await kv.sadd('bot_approved_users', String(chatId));
      await kv.srem('bot_pending_users', String(chatId));
    } catch {}
    return { status: 'approved', isNew: false };
  }

  // Check if mandatory approval mode is enabled (default: true)
  const approvalMode = (await kv.get('settings:approval_mode')) !== false;
  if (!approvalMode) {
    return { status: 'approved', isNew: false };
  }

  const existingStatus = (await kv.get(`bot_user_status:${chatId}`)) as string;
  if (existingStatus === 'approved' || existingStatus === 'pending' || existingStatus === 'rejected') {
    return { status: existingStatus, isNew: false };
  }

  // Brand new user -> set to pending and save profile
  const name = ctxUser ? `${ctxUser.first_name || ''} ${ctxUser.last_name || ''}`.trim() || 'Pengguna Telegram' : 'Pengguna Telegram';
  const username = ctxUser?.username || '';

  const userInfo = {
    id: String(chatId),
    username,
    name,
    requestedAt: new Date().toISOString()
  };

  await kv.set(`bot_user_info:${chatId}`, userInfo);
  await kv.set(`bot_user_status:${chatId}`, 'pending');
  await kv.sadd('bot_pending_users', String(chatId));
  await kv.sadd('bot_all_users', String(chatId));

  return { status: 'pending', isNew: true };
}

// ─── USER EMAIL STORAGE HELPERS ───────────────────────────────────────────────

async function getUserEmails(chatId: number | string): Promise<string[]> {
  try {
    const list = await kv.get(`bot_user_emails:${chatId}`);
    if (Array.isArray(list)) return list as string[];
    const single = await kv.get(`bot_email:${chatId}`);
    if (single && typeof single === 'string') return [single];
    return [];
  } catch {
    return [];
  }
}

async function saveUserEmails(chatId: number | string, emails: string[]): Promise<void> {
  await kv.set(`bot_user_emails:${chatId}`, emails);
}

async function getActiveEmail(chatId: number | string): Promise<string | null> {
  const active = await kv.get(`bot_active_email:${chatId}`);
  if (active && typeof active === 'string') return active;
  const emails = await getUserEmails(chatId);
  if (emails.length > 0) {
    await kv.set(`bot_active_email:${chatId}`, emails[0]);
    return emails[0];
  }
  return null;
}

async function setActiveEmail(chatId: number | string, email: string): Promise<void> {
  await kv.set(`bot_active_email:${chatId}`, email);
  await kv.sadd(`bot_email_users:${email.toLowerCase()}`, chatId.toString());
}

async function removeUserEmail(chatId: number | string, email: string): Promise<void> {
  const emails = await getUserEmails(chatId);
  const filtered = emails.filter((e) => e.toLowerCase() !== email.toLowerCase());
  await saveUserEmails(chatId, filtered);
  await kv.srem(`bot_email_users:${email.toLowerCase()}`, chatId.toString());
  
  const currentActive = await kv.get(`bot_active_email:${chatId}`);
  if (currentActive === email) {
    if (filtered.length > 0) {
      await kv.set(`bot_active_email:${chatId}`, filtered[0]);
    } else {
      await kv.del(`bot_active_email:${chatId}`);
    }
  }
}

// ─── KEYBOARDS GENERATION ─────────────────────────────────────────────────────

export function getPersistentKeyboard(isAdmin: boolean = false) {
  const kb = new Keyboard()
    .text('📬 Email Saya').text('➕ Buat Email').row()
    .text('📥 Kotak Masuk').text('🌐 Ganti Domain').row();
  
  if (isAdmin) {
    kb.text('🛠 Panel Admin').text('❓ Panduan & Bantuan');
  } else {
    kb.text('❓ Panduan & Bantuan');
  }

  return kb.resized();
}

export function buildDashboardKeyboard(activeEmail: string | null, inboxCount: number) {
  const kb = new InlineKeyboard();

  if (activeEmail) {
    kb.text(`📥 Buka Kotak Masuk (${inboxCount})`, `view_inbox:${activeEmail}`)
      .text('🔄 Refresh', `refresh_dashboard:${activeEmail}`)
      .row();
    kb.text('🎲 Email Acak Baru', 'action_random_email')
      .text('✏️ Kustom Nama', 'action_custom_email')
      .row();
    kb.text('📋 Daftar Email Saya', 'action_list_emails')
      .text('🌐 Ganti Domain', 'action_select_domain')
      .row();
    kb.text('🗑 Hapus Email Ini', `action_delete_email:${activeEmail}`)
      .text('❓ Panduan', 'action_help');
  } else {
    kb.text('➕ Buat Email Sekarang', 'action_random_email').row();
    kb.text('✏️ Buat Nama Kustom', 'action_custom_email')
      .text('🌐 Pilih Domain', 'action_select_domain')
      .row();
    kb.text('❓ Panduan & Bantuan', 'action_help');
  }

  return kb;
}

// ─── MAIN BOT FACTORY ─────────────────────────────────────────────────────────

export function getBot(token: string, adminId: string, configuredDomain: string) {
  if (cachedBot && cachedToken === token) {
    return cachedBot;
  }

  const bot = new Bot(token);

  // Global Error Handler
  bot.catch((err) => {
    console.error(`Grammy bot error on update ${err.ctx.update.update_id}:`, err.error);
  });

  // ── COMMAND /start ──────────────────────────────────────────────────────────
  bot.command('start', async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const isAdmin = await isUserAdmin(chatId, adminId);

      // Check User Approval Status
      const { status, isNew } = await checkUserStatus(chatId, ctx.from, adminId);

      if (status === 'rejected') {
        return ctx.reply(
          `⛔ <b>Akses Ditolak</b>\n\n` +
          `Akun Anda belum diizinkan atau telah diblokir oleh Admin untuk menggunakan Temp Mail Bot ini.`,
          { parse_mode: 'HTML' }
        );
      }

      if (status === 'pending') {
        const name = `${ctx.from?.first_name || ''} ${ctx.from?.last_name || ''}`.trim() || 'Pengguna';
        const username = ctx.from?.username ? `@${ctx.from.username}` : '(Tidak ada username)';

        // 1. Reply to user
        await ctx.reply(
          `👋 <b>Halo, ${escapeHtml(name)}!</b>\n\n` +
          `🔐 <b>Verifikasi Akses Diperlukan</b>\n` +
          `Untuk menjaga keamanan &amp; kualitas layanan, penggunaan bot ini memerlukan persetujuan dari Admin.\n\n` +
          `📩 <b>Permintaan akses Anda telah dikirimkan ke Admin.</b>\n` +
          `Mohon menunggu beberapa saat, Anda akan menerima notifikasi otomatis begitu disetujui!`,
          { parse_mode: 'HTML' }
        );

        // 2. Notify Admin if brand new request (and not admin himself)
        if (isNew && !isAdmin) {
          const rawAdminId = (await kv.get('telegram:admin_id')) ?? adminId ?? process.env.TELEGRAM_ADMIN_ID;
          const currentAdminId = rawAdminId ? String(rawAdminId).trim() : '';
          
          if (currentAdminId && currentAdminId !== String(chatId).trim()) {
            const approvalKb = new InlineKeyboard()
              .text('✅ Setujui Akses', `admin_approve_user:${chatId}`)
              .text('❌ Tolak Akses', `admin_reject_user:${chatId}`);

            try {
              await bot.api.sendMessage(
                currentAdminId,
                `🔔 <b>PERMINTAAN AKSES PENGGUNA BARU</b>\n\n` +
                `👤 <b>Nama:</b> ${escapeHtml(name)}\n` +
                `🏷️ <b>Username:</b> ${escapeHtml(username)}\n` +
                `🆔 <b>User ID:</b> <code>${chatId}</code>\n` +
                `🕒 <b>Waktu:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n\n` +
                `Silakan tentukan persetujuan:`,
                {
                  parse_mode: 'HTML',
                  reply_markup: approvalKb,
                }
              );
            } catch (err) {
              console.error('Failed to notify admin of new user approval request:', err);
            }
          }
        }
        return;
      }

      // Approved User Flow
      const startPayload = ctx.match?.trim() || '';

      // Deep link sync from web
      if (startPayload) {
        let targetEmail = '';
        if (startPayload.startsWith('sync_')) {
          const clean = startPayload.replace('sync_', '').replace(/_/g, '.');
          if (clean.includes('@')) {
            targetEmail = clean.toLowerCase();
          }
        } else if (startPayload.includes('@')) {
          targetEmail = startPayload.toLowerCase();
        }

        if (targetEmail) {
          const existingEmails = await getUserEmails(chatId);
          if (!existingEmails.includes(targetEmail)) {
            if (existingEmails.length >= 5) {
              existingEmails.pop();
            }
            existingEmails.unshift(targetEmail);
            await saveUserEmails(chatId, existingEmails);
          }
          await setActiveEmail(chatId, targetEmail);

          await ctx.reply(
            `✨ <b>Email Berhasil Disinkronkan!</b>\n\n` +
            `Email aktif Anda sekarang:\n` +
            `<code>${escapeHtml(targetEmail)}</code> <i>(tekan untuk salin)</i>\n\n` +
            `🔔 <b>Notifikasi Instan Aktif:</b> Anda akan menerima notifikasi otomatis begitu ada email/kode OTP masuk!`,
            {
              parse_mode: 'HTML',
              reply_markup: getPersistentKeyboard(isAdmin),
            }
          );
          return showDashboard(ctx, targetEmail, false);
        }
      }

      // Default start flow for approved user
      let activeEmail = await getActiveEmail(chatId);
      if (!activeEmail) {
        const domains = await getSystemDomains(configuredDomain);
        const chosenDomain = domains[0] || 'breonline.biz.id';
        const prefix = getRandomPrefix();
        activeEmail = `${prefix}@${chosenDomain}`;

        await saveUserEmails(chatId, [activeEmail]);
        await setActiveEmail(chatId, activeEmail);
      }

      await ctx.reply(
        `👋 <b>Selamat Datang di Temp Mail Bot!</b>\n\n` +
        `Layanan email sementara kilat, aman &amp; anti-spam. Gunakan email ini untuk pendaftaran akun, verifikasi OTP, atau uji coba tanpa mengotori email pribadi.\n\n` +
        `⚡ <b>Fitur Utama:</b>\n` +
        `• Deteksi otomatis kode OTP &amp; tombol salin instan\n` +
        `• Notifikasi real-time email masuk langsung ke Telegram\n` +
        `• Kelola hingga 5 email sekaligus &amp; kustom nama` +
        `${isAdmin ? '\n\n👑 <i>Mode Admin Aktif: Buka menu admin via /admin</i>' : ''}`,
        {
          parse_mode: 'HTML',
          reply_markup: getPersistentKeyboard(isAdmin),
        }
      );

      return showDashboard(ctx, activeEmail, false);
    } catch (e) {
      console.error('Error in /start command:', e);
    }
  });

  // ── COMMAND /help & /panduan ────────────────────────────────────────────────
  bot.command(['help', 'panduan'], async (ctx) => {
    return sendHelpMessage(ctx);
  });

  // ── COMMAND /myemail & /emails ──────────────────────────────────────────────
  bot.command(['myemail', 'emails', 'me'], async (ctx) => {
    const chatId = ctx.chat.id;
    const { status } = await checkUserStatus(chatId, ctx.from, adminId);
    if (status !== 'approved') {
      return ctx.reply('⚠️ Akses Anda masih menunggu persetujuan dari Admin.');
    }
    const activeEmail = await getActiveEmail(chatId);
    return showDashboard(ctx, activeEmail, false);
  });

  // ── COMMAND /inbox ──────────────────────────────────────────────────────────
  bot.command('inbox', async (ctx) => {
    const chatId = ctx.chat.id;
    const { status } = await checkUserStatus(chatId, ctx.from, adminId);
    if (status !== 'approved') {
      return ctx.reply('⚠️ Akses Anda masih menunggu persetujuan dari Admin.');
    }
    const activeEmail = await getActiveEmail(chatId);
    if (!activeEmail) {
      const isAdmin = await isUserAdmin(chatId, adminId);
      return ctx.reply('⚠️ Anda belum memiliki email aktif. Buat email terlebih dahulu dengan perintah /new atau tombol di bawah.', {
        reply_markup: getPersistentKeyboard(isAdmin),
      });
    }
    return showInbox(ctx, activeEmail, false);
  });

  // ── COMMAND /new ────────────────────────────────────────────────────────────
  bot.command('new', async (ctx) => {
    const chatId = ctx.chat.id;
    const { status } = await checkUserStatus(chatId, ctx.from, adminId);
    if (status !== 'approved') {
      return ctx.reply('⚠️ Akses Anda masih menunggu persetujuan dari Admin.');
    }
    const domains = await getSystemDomains(configuredDomain);
    const prefDomain = ((await kv.get(`bot_selected_domain:${chatId}`)) as string) || domains[0];
    const prefix = getRandomPrefix();
    const newEmail = `${prefix}@${prefDomain}`;

    const existing = await getUserEmails(chatId);
    const updated = [newEmail, ...existing.filter((e) => e !== newEmail)].slice(0, 5);
    await saveUserEmails(chatId, updated);
    await setActiveEmail(chatId, newEmail);

    return showDashboard(ctx, newEmail, false, `✨ <b>Email baru berhasil dibuat!</b>`);
  });

  // ── COMMAND /custom ─────────────────────────────────────────────────────────
  bot.command('custom', async (ctx) => {
    const chatId = ctx.chat.id;
    const { status } = await checkUserStatus(chatId, ctx.from, adminId);
    if (status !== 'approved') {
      return ctx.reply('⚠️ Akses Anda masih menunggu persetujuan dari Admin.');
    }
    await kv.set(`bot_state:${chatId}`, 'awaiting_custom_prefix');
    const domains = await getSystemDomains(configuredDomain);
    const prefDomain = ((await kv.get(`bot_selected_domain:${chatId}`)) as string) || domains[0];

    return ctx.reply(
      `✏️ <b>Buat Email Kustom</b>\n\n` +
      `Domain terpilih: <code>@${escapeHtml(prefDomain)}</code>\n\n` +
      `Ketik nama email yang Anda inginkan (hanya huruf kecil, angka, titik, atau strip).\n` +
      `<i>Contoh: <code>budi99</code> atau <code>sarah.online</code></i>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Batal', 'action_cancel_state'),
      }
    );
  });

  // ── COMMAND /domain & /domains ──────────────────────────────────────────────
  bot.command(['domain', 'domains'], async (ctx) => {
    const chatId = ctx.chat.id;
    const { status } = await checkUserStatus(chatId, ctx.from, adminId);
    if (status !== 'approved') {
      return ctx.reply('⚠️ Akses Anda masih menunggu persetujuan dari Admin.');
    }
    return showDomainSelector(ctx, false);
  });

  // ── COMMAND /admin ──────────────────────────────────────────────────────────
  bot.command('admin', async (ctx) => {
    const chatId = ctx.chat.id;
    const isAdmin = await isUserAdmin(chatId, adminId);
    if (!isAdmin) {
      return ctx.reply('⛔ Akses ditolak. ID Telegram Anda tidak terdaftar sebagai Admin di Web Panel.');
    }
    return showAdminPanel(ctx, false);
  });

  // ── TEXT MESSAGE HANDLER (PERSISTENT BUTTONS & STATES) ──────────────────────
  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text.trim();
    const isAdmin = await isUserAdmin(chatId, adminId);
    const { status } = await checkUserStatus(chatId, ctx.from, adminId);

    // If not approved, block standard usage
    if (!isAdmin && status !== 'approved') {
      if (status === 'rejected') {
        return ctx.reply('⛔ Akses Anda telah ditolak oleh Admin.');
      }
      return ctx.reply('⏳ Permintaan akses Anda masih menunggu persetujuan dari Admin.');
    }

    // 1. Check Persistent Keyboard Buttons
    if (text === '📬 Email Saya') {
      const activeEmail = await getActiveEmail(chatId);
      return showDashboard(ctx, activeEmail, false);
    }
    if (text === '➕ Buat Email') {
      const domains = await getSystemDomains(configuredDomain);
      const prefDomain = ((await kv.get(`bot_selected_domain:${chatId}`)) as string) || domains[0];
      const prefix = getRandomPrefix();
      const newEmail = `${prefix}@${prefDomain}`;

      const existing = await getUserEmails(chatId);
      const updated = [newEmail, ...existing.filter((e) => e !== newEmail)].slice(0, 5);
      await saveUserEmails(chatId, updated);
      await setActiveEmail(chatId, newEmail);

      return showDashboard(ctx, newEmail, false, `✨ <b>Email baru berhasil dibuat!</b>`);
    }
    if (text === '📥 Kotak Masuk') {
      const activeEmail = await getActiveEmail(chatId);
      if (!activeEmail) {
        return ctx.reply('⚠️ Anda belum memiliki email aktif.', { reply_markup: getPersistentKeyboard(isAdmin) });
      }
      return showInbox(ctx, activeEmail, false);
    }
    if (text === '🌐 Ganti Domain') {
      return showDomainSelector(ctx, false);
    }
    if (text === '❓ Panduan & Bantuan') {
      return sendHelpMessage(ctx);
    }
    if (text === '🛠 Panel Admin') {
      if (!isAdmin) return ctx.reply('⛔ Akses ditolak.');
      return showAdminPanel(ctx, false);
    }

    // 2. Check Interactive Input States
    const state = await kv.get(`bot_state:${chatId}`);

    // State: User Custom Prefix
    if (state === 'awaiting_custom_prefix') {
      const rawPrefix = text.toLowerCase().replace(/[^a-z0-9._-]/g, '');

      if (!rawPrefix || rawPrefix.length < 2) {
        return ctx.reply('⚠️ Nama email terlalu pendek (minimal 2 karakter). Coba ketik nama lain:', {
          reply_markup: new InlineKeyboard().text('❌ Batal', 'action_cancel_state'),
        });
      }

      const isReserved = await kv.sismember('reserved_names', rawPrefix);
      if (isReserved) {
        return ctx.reply('⚠️ Nama email ini dilarang oleh sistem (Reserved). Silakan ketik nama lain:', {
          reply_markup: new InlineKeyboard().text('❌ Batal', 'action_cancel_state'),
        });
      }

      const domains = await getSystemDomains(configuredDomain);
      const prefDomain = ((await kv.get(`bot_selected_domain:${chatId}`)) as string) || domains[0];
      const newEmail = `${rawPrefix}@${prefDomain}`;

      const existing = await getUserEmails(chatId);
      const updated = [newEmail, ...existing.filter((e) => e !== newEmail)].slice(0, 5);
      await saveUserEmails(chatId, updated);
      await setActiveEmail(chatId, newEmail);
      await kv.del(`bot_state:${chatId}`);

      return showDashboard(ctx, newEmail, false, `✅ <b>Email kustom berhasil dibuat!</b>`);
    }

    // State: Admin Add Domain
    if (state === 'admin_awaiting_new_domain' && isAdmin) {
      const domainInput = text.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (!domainInput.includes('.')) {
        return ctx.reply('⚠️ Format domain tidak valid (contoh: domainku.com). Ketik lagi:', {
          reply_markup: new InlineKeyboard().text('❌ Batal', 'admin_cancel_state'),
        });
      }
      await kv.sadd('domains', domainInput);
      await kv.del(`bot_state:${chatId}`);
      await ctx.reply(`✅ Domain <code>${escapeHtml(domainInput)}</code> berhasil ditambahkan ke sistem!`, {
        parse_mode: 'HTML',
      });
      return showAdminDomains(ctx, false);
    }

    // State: Admin Add Reserved Name
    if (state === 'admin_awaiting_new_reserved' && isAdmin) {
      const nameInput = text.toLowerCase().trim();
      await kv.sadd('reserved_names', nameInput);
      await kv.del(`bot_state:${chatId}`);
      await ctx.reply(`✅ Nama reserved <code>${escapeHtml(nameInput)}</code> berhasil disimpan!`, {
        parse_mode: 'HTML',
      });
      return showAdminSecurity(ctx, false);
    }

    // State: Admin Ban Email
    if (state === 'admin_awaiting_ban_email' && isAdmin) {
      const emailInput = text.toLowerCase().trim();
      await kv.sadd('banned_emails', emailInput);
      await kv.del(`inbox:${emailInput}`);
      await kv.del(`bot_state:${chatId}`);
      await ctx.reply(`🚫 Email <code>${escapeHtml(emailInput)}</code> berhasil diblokir (banned) & inbox dibersihkan!`, {
        parse_mode: 'HTML',
      });
      return showAdminSecurity(ctx, false);
    }

    // State: Admin Broadcast Message
    if (state === 'admin_awaiting_broadcast' && isAdmin) {
      await kv.del(`bot_state:${chatId}`);
      const users = (await kv.smembers('bot_all_users')) as string[];
      let sentCount = 0;
      
      await ctx.reply(`⏳ Memulai pengiriman siaran ke ${users.length} pengguna...`);
      for (const u of users) {
        try {
          await bot.api.sendMessage(
            u,
            `📢 <b>PENGUMUMAN DARI ADMIN:</b>\n\n${escapeHtml(text)}`,
            { parse_mode: 'HTML' }
          );
          sentCount++;
        } catch {}
      }
      await ctx.reply(`✅ Siaran selesai! Berhasil terkirim ke <b>${sentCount}</b> dari ${users.length} pengguna.`, {
        parse_mode: 'HTML',
      });
      return showAdminPanel(ctx, false);
    }

    // Fallback info
    return ctx.reply('Gunakan tombol menu di bawah atau ketik /help untuk melihat opsi:', {
      reply_markup: getPersistentKeyboard(isAdmin),
    });
  });

  // ── CALLBACK QUERY HANDLERS (USER INTERACTIONS) ─────────────────────────────

  bot.callbackQuery(/^refresh_dashboard:(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    await ctx.answerCallbackQuery('🔄 Memperbarui status...').catch(() => {});
    return showDashboard(ctx, email, true);
  });

  bot.callbackQuery('action_dashboard', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const activeEmail = await getActiveEmail(chatId);
    await ctx.answerCallbackQuery().catch(() => {});
    return showDashboard(ctx, activeEmail, true);
  });

  bot.callbackQuery('action_random_email', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const domains = await getSystemDomains(configuredDomain);
    const prefDomain = ((await kv.get(`bot_selected_domain:${chatId}`)) as string) || domains[0];
    const prefix = getRandomPrefix();
    const newEmail = `${prefix}@${prefDomain}`;

    const existing = await getUserEmails(chatId);
    const updated = [newEmail, ...existing.filter((e) => e !== newEmail)].slice(0, 5);
    await saveUserEmails(chatId, updated);
    await setActiveEmail(chatId, newEmail);

    await ctx.answerCallbackQuery('✨ Email baru siap digunakan!').catch(() => {});
    return showDashboard(ctx, newEmail, true, `✨ <b>Email baru berhasil dibuat!</b>`);
  });

  bot.callbackQuery('action_custom_email', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    await kv.set(`bot_state:${chatId}`, 'awaiting_custom_prefix');
    const domains = await getSystemDomains(configuredDomain);
    const prefDomain = ((await kv.get(`bot_selected_domain:${chatId}`)) as string) || domains[0];

    await ctx.answerCallbackQuery().catch(() => {});
    const text =
      `✏️ <b>Buat Email Kustom</b>\n\n` +
      `Domain terpilih: <code>@${escapeHtml(prefDomain)}</code>\n\n` +
      `Silakan balas pesan ini dengan mengetik nama email yang Anda inginkan (misal: <code>budi99</code> atau <code>sarah.store</code>).`;

    const kb = new InlineKeyboard().text('❌ Batal', 'action_cancel_state');

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  });

  bot.callbackQuery('action_cancel_state', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    await kv.del(`bot_state:${chatId}`);
    await ctx.answerCallbackQuery('Dibatalkan').catch(() => {});
    const activeEmail = await getActiveEmail(chatId);
    return showDashboard(ctx, activeEmail, true);
  });

  bot.callbackQuery('action_select_domain', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    return showDomainSelector(ctx, true);
  });

  bot.callbackQuery(/^set_domain:(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const domain = ctx.match[1];
    await kv.set(`bot_selected_domain:${chatId}`, domain);
    await ctx.answerCallbackQuery(`Domain terpilih: ${domain}`).catch(() => {});

    const active = await getActiveEmail(chatId);
    if (active && active.includes('@')) {
      const prefix = active.split('@')[0];
      const newEmail = `${prefix}@${domain}`;
      const existing = await getUserEmails(chatId);
      const updated = [newEmail, ...existing.filter((e) => e !== newEmail)].slice(0, 5);
      await saveUserEmails(chatId, updated);
      await setActiveEmail(chatId, newEmail);
      return showDashboard(ctx, newEmail, true, `🌐 <b>Domain diubah ke @${escapeHtml(domain)}</b>`);
    }

    return showDomainSelector(ctx, true);
  });

  bot.callbackQuery('action_list_emails', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    await ctx.answerCallbackQuery().catch(() => {});
    return showEmailList(ctx, true);
  });

  bot.callbackQuery(/^select_email:(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const targetEmail = ctx.match[1];
    await setActiveEmail(chatId, targetEmail);
    await ctx.answerCallbackQuery(`Email aktif: ${targetEmail}`).catch(() => {});
    return showDashboard(ctx, targetEmail, true);
  });

  bot.callbackQuery(/^action_delete_email:(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const emailToDelete = ctx.match[1];

    const kb = new InlineKeyboard()
      .text('🗑 Ya, Hapus Sekarang', `confirm_delete_email:${emailToDelete}`)
      .text('❌ Batal', `refresh_dashboard:${emailToDelete}`);

    await ctx.answerCallbackQuery().catch(() => {});
    const confirmText =
      `⚠️ <b>Konfirmasi Hapus Email</b>\n\n` +
      `Apakah Anda yakin ingin menghapus email <code>${escapeHtml(emailToDelete)}</code> beserta seluruh kotak masuknya?`;

    try {
      await ctx.editMessageText(confirmText, { parse_mode: 'HTML', reply_markup: kb });
    } catch {
      await ctx.reply(confirmText, { parse_mode: 'HTML', reply_markup: kb });
    }
  });

  bot.callbackQuery(/^confirm_delete_email:(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const emailToDelete = ctx.match[1];

    await removeUserEmail(chatId, emailToDelete);
    await kv.del(`inbox:${emailToDelete.toLowerCase()}`);
    await ctx.answerCallbackQuery('Email berhasil dihapus').catch(() => {});

    const nextActive = await getActiveEmail(chatId);
    return showDashboard(ctx, nextActive, true, `🗑 <b>Email <code>${escapeHtml(emailToDelete)}</code> telah dihapus.</b>`);
  });

  bot.callbackQuery(/^view_inbox:(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    await ctx.answerCallbackQuery('Memuat kotak masuk...').catch(() => {});
    return showInbox(ctx, email, true);
  });

  bot.callbackQuery(/^read_email:(.+):(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    const messageId = ctx.match[2];
    await ctx.answerCallbackQuery().catch(() => {});
    return showEmailDetail(ctx, email, messageId, true);
  });

  bot.callbackQuery(/^del_msg:(.+):(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    const messageId = ctx.match[2];

    const emails = ((await kv.lrange(`inbox:${email.toLowerCase()}`, 0, -1)) || []) as any[];
    const filtered = emails.filter((e) => e.id !== messageId);
    await kv.del(`inbox:${email.toLowerCase()}`);
    if (filtered.length > 0) {
      for (let i = filtered.length - 1; i >= 0; i--) {
        await kv.lpush(`inbox:${email.toLowerCase()}`, filtered[i]);
      }
    }

    await ctx.answerCallbackQuery('Pesan berhasil dihapus').catch(() => {});
    return showInbox(ctx, email, true);
  });

  bot.callbackQuery(/^clear_inbox:(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    await kv.del(`inbox:${email.toLowerCase()}`);
    await ctx.answerCallbackQuery('Kotak masuk telah dibersihkan').catch(() => {});
    return showInbox(ctx, email, true);
  });

  bot.callbackQuery('action_help', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    return sendHelpMessage(ctx, true);
  });

  // ── ADMIN USER APPROVAL CALLBACKS ───────────────────────────────────────────

  // Admin approves a user request
  bot.callbackQuery(/^admin_approve_user:(\d+)$/, async (ctx) => {
    const currentChatId = ctx.chat?.id;
    if (!currentChatId || !(await isUserAdmin(currentChatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }

    const targetChatId = ctx.match[1];
    await kv.set(`bot_user_status:${targetChatId}`, 'approved');
    await kv.srem('bot_pending_users', targetChatId);
    await kv.srem('bot_rejected_users', targetChatId);
    await kv.sadd('bot_approved_users', targetChatId);

    const userInfo = ((await kv.get(`bot_user_info:${targetChatId}`)) as any) || { name: `User ${targetChatId}` };

    await ctx.answerCallbackQuery('✅ Akses pengguna disetujui!').catch(() => {});

    // Update Admin Message
    try {
      await ctx.editMessageText(
        `✅ <b>PERMINTAAN DISETUJUI</b>\n\n` +
        `Pengguna <b>${escapeHtml(userInfo.name)}</b> (ID: <code>${targetChatId}</code>) telah <b>DISETUJUI</b> dan dapat menggunakan bot secara penuh.`,
        { parse_mode: 'HTML' }
      );
    } catch {}

    // Send instant welcome notification to User
    try {
      await bot.api.sendMessage(
        targetChatId,
        `🎉 <b>Selamat! Permintaan Akses Anda Telah Disetujui Admin!</b>\n\n` +
        `Anda sekarang dapat membuat email sementara, membaca kotak masuk, dan menerima notifikasi kode OTP secara langsung.\n\n` +
        `Ketik <b>/start</b> atau gunakan menu di bawah untuk memulai!`,
        {
          parse_mode: 'HTML',
          reply_markup: getPersistentKeyboard(false),
        }
      );
    } catch (sendErr) {
      console.error(`Could not send approval notice to user ${targetChatId}:`, sendErr);
    }
  });

  // Admin rejects a user request
  bot.callbackQuery(/^admin_reject_user:(\d+)$/, async (ctx) => {
    const currentChatId = ctx.chat?.id;
    if (!currentChatId || !(await isUserAdmin(currentChatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }

    const targetChatId = ctx.match[1];
    await kv.set(`bot_user_status:${targetChatId}`, 'rejected');
    await kv.srem('bot_pending_users', targetChatId);
    await kv.srem('bot_approved_users', targetChatId);
    await kv.sadd('bot_rejected_users', targetChatId);

    const userInfo = ((await kv.get(`bot_user_info:${targetChatId}`)) as any) || { name: `User ${targetChatId}` };

    await ctx.answerCallbackQuery('❌ Akses pengguna ditolak!').catch(() => {});

    // Update Admin Message
    try {
      await ctx.editMessageText(
        `❌ <b>PERMINTAAN DITOLAK</b>\n\n` +
        `Pengguna <b>${escapeHtml(userInfo.name)}</b> (ID: <code>${targetChatId}</code>) telah <b>DITOLAK</b>.`,
        { parse_mode: 'HTML' }
      );
    } catch {}

    // Send rejection notice to User
    try {
      await bot.api.sendMessage(
        targetChatId,
        `⛔ <b>Pemberitahuan</b>\n\n` +
        `Maaf, permintaan akses Anda untuk menggunakan Temp Mail Bot telah <b>ditolak</b> oleh Admin.`,
        { parse_mode: 'HTML' }
      );
    } catch (sendErr) {
      console.error(`Could not send rejection notice to user ${targetChatId}:`, sendErr);
    }
  });

  // ── ADMIN HUB CALLBACKS ─────────────────────────────────────────────────────

  bot.callbackQuery('admin_hub', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return showAdminPanel(ctx, true);
  });

  bot.callbackQuery('admin_toggle_maintenance', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    const current = await kv.get('settings:maintenance');
    const next = !current;
    if (next) {
      await kv.set('settings:maintenance', '1');
    } else {
      await kv.del('settings:maintenance');
    }
    await ctx.answerCallbackQuery(`Maintenance ${next ? 'Aktif' : 'Nonaktif'}`).catch(() => {});
    return showAdminPanel(ctx, true);
  });

  bot.callbackQuery('admin_stats', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return showAdminStats(ctx, true);
  });

  bot.callbackQuery('admin_inboxes', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await ctx.answerCallbackQuery('Memuat kotak masuk server...').catch(() => {});
    return showAdminInboxes(ctx, 0, true);
  });

  bot.callbackQuery(/^admin_inboxes_page:(\d+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    const page = parseInt(ctx.match[1], 10) || 0;
    await ctx.answerCallbackQuery().catch(() => {});
    return showAdminInboxes(ctx, page, true);
  });

  // User Management Menu
  bot.callbackQuery('admin_users', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return showAdminUsersHub(ctx, true);
  });

  bot.callbackQuery('admin_toggle_approval_mode', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    const current = (await kv.get('settings:approval_mode')) !== false;
    const next = !current;
    await kv.set('settings:approval_mode', next);
    await ctx.answerCallbackQuery(`Persetujuan Wajib ${next ? 'AKTIF' : 'NONAKTIF'}`).catch(() => {});
    return showAdminUsersHub(ctx, true);
  });

  bot.callbackQuery('admin_view_pending_users', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return showAdminPendingUsers(ctx, true);
  });

  bot.callbackQuery('admin_view_approved_users', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return showAdminApprovedUsers(ctx, true);
  });

  bot.callbackQuery('admin_domains', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return showAdminDomains(ctx, true);
  });

  bot.callbackQuery('admin_add_domain_prompt', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await kv.set(`bot_state:${chatId}`, 'admin_awaiting_new_domain');
    await ctx.answerCallbackQuery().catch(() => {});
    const text =
      `🌐 <b>Tambah Domain Baru</b>\n\n` +
      `Ketik nama domain yang ingin ditambahkan ke sistem (contoh: <code>domainku.com</code>):`;
    const kb = new InlineKeyboard().text('❌ Batal', 'admin_cancel_state');
    return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.callbackQuery(/^admin_delete_domain:(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    const domainToDelete = ctx.match[1];
    await kv.srem('domains', domainToDelete);
    await ctx.answerCallbackQuery(`Domain ${domainToDelete} dihapus`).catch(() => {});
    return showAdminDomains(ctx, true);
  });

  bot.callbackQuery('admin_security', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return showAdminSecurity(ctx, true);
  });

  bot.callbackQuery('admin_add_reserved_prompt', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await kv.set(`bot_state:${chatId}`, 'admin_awaiting_new_reserved');
    await ctx.answerCallbackQuery().catch(() => {});
    const text =
      `🛡️ <b>Tambah Reserved Name</b>\n\n` +
      `Ketik awalan email yang dilarang digunakan (contoh: <code>admin</code>, <code>support</code>):`;
    const kb = new InlineKeyboard().text('❌ Batal', 'admin_cancel_state');
    return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.callbackQuery('admin_ban_email_prompt', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await kv.set(`bot_state:${chatId}`, 'admin_awaiting_ban_email');
    await ctx.answerCallbackQuery().catch(() => {});
    const text =
      `🚫 <b>Blokir (Ban) Alamat Email</b>\n\n` +
      `Ketik alamat email lengkap yang ingin diblokir (contoh: <code>spammer@domain.com</code>):`;
    const kb = new InlineKeyboard().text('❌ Batal', 'admin_cancel_state');
    return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.callbackQuery('admin_logs', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return showAdminLogs(ctx, true);
  });

  bot.callbackQuery('admin_broadcast_prompt', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    const userCount = ((await kv.smembers('bot_all_users')) || []).length;
    await kv.set(`bot_state:${chatId}`, 'admin_awaiting_broadcast');
    await ctx.answerCallbackQuery().catch(() => {});
    const text =
      `📢 <b>Kirim Pesan Siaran (Broadcast)</b>\n\n` +
      `Target Pengguna: <b>${userCount} pengguna</b> bot terdaftar.\n\n` +
      `Silakan ketik isi pesan yang ingin Anda siarkan ke semua pengguna:`;
    const kb = new InlineKeyboard().text('❌ Batal', 'admin_cancel_state');
    return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.callbackQuery('admin_cancel_state', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    await kv.del(`bot_state:${chatId}`);
    await ctx.answerCallbackQuery('Dibatalkan').catch(() => {});
    return showAdminPanel(ctx, true);
  });

  bot.callbackQuery('admin_master_reset_confirm', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    const kb = new InlineKeyboard()
      .text('⚠️ YA, HAPUS SEMUA INBOX', 'admin_do_master_reset')
      .row()
      .text('❌ Batal', 'admin_hub');
    const text =
      `⚠️ <b>KONFIRMASI MASTER RESET</b>\n\n` +
      `Apakah Anda yakin ingin menghapus <b>SEMUA KOTAK MASUK</b> di database server? Tindakan ini tidak dapat dibatalkan!`;
    return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.callbackQuery('admin_do_master_reset', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    const keys = await kv.keys('inbox:*');
    if (keys && keys.length > 0) {
      await kv.del(...keys);
    }
    await ctx.answerCallbackQuery(`Berhasil reset ${keys.length} inbox`).catch(() => {});
    return showAdminPanel(ctx, true);
  });

  cachedBot = bot;
  cachedToken = token;
  return bot;
}

// ─── UI RENDERERS ─────────────────────────────────────────────────────────────

// 1. User Dashboard View
async function showDashboard(
  ctx: any,
  email: string | null,
  isEdit: boolean = false,
  noticeHeader?: string
) {
  let inboxCount = 0;
  if (email) {
    const emails = ((await kv.lrange(`inbox:${email.toLowerCase()}`, 0, -1)) || []) as any[];
    inboxCount = emails.length;
  }

  let text = '';
  if (noticeHeader) {
    text += `${noticeHeader}\n\n`;
  }

  if (email) {
    const domain = email.split('@')[1] || '-';
    text +=
      `📬 <b>TEMPORARY EMAIL ANDA</b>\n\n` +
      `📧 <b>Alamat Aktif:</b>\n` +
      `<code>${escapeHtml(email)}</code> <i>(tap untuk salin)</i>\n\n` +
      `📊 <b>Status:</b> 🟢 Aktif &amp; Siap Menerima Email\n` +
      `📨 <b>Pesan Masuk:</b> <b>${inboxCount}</b> pesan\n` +
      `🌐 <b>Domain:</b> <code>@${escapeHtml(domain)}</code>\n\n` +
      `<i>💡 Tips: Salin email di atas dan gunakan untuk verifikasi akun atau pendaftaran. Kode OTP akan otomatis muncul begitu email terkirim!</i>`;
  } else {
    text +=
      `📬 <b>TEMPORARY EMAIL</b>\n\n` +
      `Anda belum memiliki alamat email sementara aktif.\n` +
      `Klik tombol di bawah untuk membuat email baru dalam 1 detik!`;
  }

  const kb = buildDashboardKeyboard(email, inboxCount);

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch (err: any) {
    if (!err.message?.includes('message is not modified')) {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  }
}

// 2. Multi-Email List View
async function showEmailList(ctx: any, isEdit: boolean = false) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const emails = await getUserEmails(chatId);
  const activeEmail = await getActiveEmail(chatId);

  let text = `📋 <b>Daftar Email Sementara Anda</b> (${emails.length}/5):\n\n`;

  const kb = new InlineKeyboard();

  if (emails.length === 0) {
    text += `<i>Belum ada email tersimpan.</i>\n`;
    kb.text('➕ Buat Email Baru', 'action_random_email').row();
  } else {
    for (let i = 0; i < emails.length; i++) {
      const e = emails[i];
      const isActive = e.toLowerCase() === activeEmail?.toLowerCase();
      const badge = isActive ? '⭐ (Aktif)' : '';
      const listCount = ((await kv.lrange(`inbox:${e.toLowerCase()}`, 0, -1)) || []).length;

      text += `${i + 1}. <code>${escapeHtml(e)}</code> ${badge}\n   └ 📨 ${listCount} pesan\n\n`;
      kb.text(`${isActive ? '✅' : '👉'} ${e}`, `select_email:${e}`).row();
    }
    kb.text('➕ Buat Baru', 'action_random_email')
      .text('🔄 Refresh', 'action_list_emails')
      .row();
  }

  kb.text('🔙 Kembali ke Dashboard', 'action_dashboard');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

// 3. Inbox List View
async function showInbox(ctx: any, email: string, isEdit: boolean = false) {
  const emailKey = email.toLowerCase();
  const rawEmails = ((await kv.lrange(`inbox:${emailKey}`, 0, -1)) || []) as any[];

  const kb = new InlineKeyboard();

  if (rawEmails.length === 0) {
    const emptyText =
      `📥 <b>Kotak Masuk Kosong</b>\n\n` +
      `Alamat: <code>${escapeHtml(email)}</code>\n\n` +
      `Belum ada email yang masuk. Begitu ada email dikirimkan ke alamat ini, pesan akan langsung muncul di sini secara otomatis.\n\n` +
      `<i>Status: Menunggu email masuk...</i>`;

    kb.text('🔄 Refresh Inbox', `view_inbox:${email}`).row();
    kb.text('🔙 Kembali ke Dashboard', 'action_dashboard');

    try {
      if (isEdit) {
        return await ctx.editMessageText(emptyText, { parse_mode: 'HTML', reply_markup: kb });
      }
      return await ctx.reply(emptyText, { parse_mode: 'HTML', reply_markup: kb });
    } catch {
      return await ctx.reply(emptyText, { parse_mode: 'HTML', reply_markup: kb });
    }
  }

  let text = `📥 <b>Kotak Masuk untuk</b> <code>${escapeHtml(email)}</code>\n`;
  text += `<b>Total Pesan:</b> ${rawEmails.length}\n`;
  text += `───────────────────────\n\n`;

  const maxShow = Math.min(rawEmails.length, 6);
  for (let i = 0; i < maxShow; i++) {
    const msg = rawEmails[i];
    const timeAgo = formatTimeAgo(msg.receivedAt);
    const otp = extractOtp(msg.text || '', msg.subject || '');
    const sender = msg.fromName ? `${msg.fromName}` : (msg.from || 'Unknown');
    const subject = msg.subject || '(Tanpa Subjek)';

    text += `<b>${i + 1}.</b> 👤 <b>${escapeHtml(sender)}</b> • 🕒 <i>${escapeHtml(timeAgo)}</i>\n`;
    text += `   📌 <b>Subjek:</b> ${escapeHtml(subject)}\n`;
    if (otp) {
      text += `   🔑 <b>Kode OTP:</b> <code>${escapeHtml(otp)}</code>\n`;
    }
    text += `\n`;

    const btnLabel = `📖 [${i + 1}] ${subject.length > 22 ? subject.substring(0, 22) + '...' : subject}`;
    kb.text(btnLabel, `read_email:${email}:${msg.id}`).row();
  }

  if (rawEmails.length > 6) {
    text += `<i>Terdapat ${rawEmails.length - 6} pesan lainnya.</i>\n\n`;
  }

  text += `<i>Klik salah satu tombol di bawah untuk membaca isi pesan lengkap.</i>`;

  kb.text('🔄 Refresh', `view_inbox:${email}`)
    .text('🗑 Kosongkan Inbox', `clear_inbox:${email}`)
    .row();
  kb.text('🔙 Kembali ke Dashboard', 'action_dashboard');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

// 4. Single Email Detail Reader
async function showEmailDetail(ctx: any, email: string, messageId: string, isEdit: boolean = false) {
  const rawEmails = ((await kv.lrange(`inbox:${email.toLowerCase()}`, 0, -1)) || []) as any[];
  const msg = rawEmails.find((e) => e.id === messageId);

  const kb = new InlineKeyboard();

  if (!msg) {
    kb.text('🔙 Kembali ke Inbox', `view_inbox:${email}`);
    const notFoundText = `⚠️ <b>Pesan tidak ditemukan atau sudah dihapus.</b>`;
    try {
      if (isEdit) return await ctx.editMessageText(notFoundText, { parse_mode: 'HTML', reply_markup: kb });
      return await ctx.reply(notFoundText, { parse_mode: 'HTML', reply_markup: kb });
    } catch {
      return await ctx.reply(notFoundText, { parse_mode: 'HTML', reply_markup: kb });
    }
  }

  const otp = extractOtp(msg.text || '', msg.subject || '');
  const timeStr = msg.receivedAt ? new Date(msg.receivedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-';

  let text = `✉️ <b>DETAIL PESAN MASUK</b>\n\n`;
  text += `👤 <b>Dari:</b> ${escapeHtml(msg.fromName ? `${msg.fromName} <${msg.from}>` : msg.from)}\n`;
  text += `📫 <b>Kepada:</b> <code>${escapeHtml(email)}</code>\n`;
  text += `📌 <b>Subjek:</b> <b>${escapeHtml(msg.subject || '(Tanpa Subjek)')}</b>\n`;
  text += `🕒 <b>Waktu:</b> ${timeStr} WIB\n`;

  if (otp) {
    text += `\n───────────────────────\n`;
    text += `🔑 <b>KODE VERIFIKASI / OTP TERDETEKSI:</b>\n`;
    text += `👉 <code>${escapeHtml(otp)}</code> 👈 <i>(tekan untuk salin)</i>\n`;
    text += `───────────────────────\n`;
  } else {
    text += `───────────────────────\n`;
  }

  let bodyText = (msg.text || '').trim();
  if (!bodyText && msg.html) {
    bodyText = msg.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  if (!bodyText) {
    bodyText = '(Tidak ada isi teks pada email ini)';
  }

  if (bodyText.length > 2500) {
    bodyText = bodyText.substring(0, 2500) + '\n\n... (Pesan dipotong karena terlalu panjang)';
  }

  text += `\n📄 <b>Isi Pesan:</b>\n\n${escapeHtml(bodyText)}`;

  kb.text('🔙 Kembali ke Inbox', `view_inbox:${email}`)
    .text('🗑 Hapus Pesan', `del_msg:${email}:${messageId}`)
    .row();
  kb.text('🏠 Dashboard', 'action_dashboard');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

// 5. Domain Selector View
async function showDomainSelector(ctx: any, isEdit: boolean = false) {
  const chatId = ctx.chat?.id;
  const domains = await getSystemDomains();
  const currentPref = chatId ? ((await kv.get(`bot_selected_domain:${chatId}`)) as string) : null;

  let text =
    `🌐 <b>Pilih Domain Email</b>\n\n` +
    `Pilih domain yang ingin Anda gunakan untuk pembuatan email baru:\n\n`;

  const kb = new InlineKeyboard();
  for (const d of domains) {
    const isSelected = d === (currentPref || domains[0]);
    text += `${isSelected ? '✅' : '▫️'} <code>@${escapeHtml(d)}</code>\n`;
    kb.text(`${isSelected ? '✅ ' : ''}@${d}`, `set_domain:${d}`).row();
  }

  kb.text('🔙 Kembali ke Dashboard', 'action_dashboard');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

// 6. Help Message
async function sendHelpMessage(ctx: any, isEdit: boolean = false) {
  const text =
    `❓ <b>PANDUAN &amp; BANTUAN TEMP MAIL BOT</b>\n\n` +
    `Bot ini memungkinkan Anda memiliki kotak masuk email sementara tanpa perlu registrasi atau membuka browser.\n\n` +
    `📌 <b>Daftar Perintah Cepat:</b>\n` +
    `• /start — Mulai bot &amp; buka dashboard utama\n` +
    `• /new — Buat alamat email acak baru\n` +
    `• /inbox — Buka &amp; periksa kotak masuk aktif\n` +
    `• /myemail — Lihat alamat email aktif saat ini\n` +
    `• /custom — Buat email dengan nama kustom\n` +
    `• /domain — Ganti domain email aktif\n` +
    `• /admin — Buka Panel Admin (Khusus Admin)\n` +
    `• /help — Tampilkan panduan ini\n\n` +
    `⚡ <b>Fitur Unggulan:</b>\n` +
    `1. <b>Sistem Konfirmasi Admin:</b> Keamanan pengguna baru termonitor.\n` +
    `2. <b>Realtime Alert:</b> Notifikasi pesan baru otomatis terkirim ke Telegram.\n` +
    `3. <b>Auto OTP:</b> Kode verifikasi 4-8 digit otomatis terdeteksi &amp; siap disalin.\n` +
    `4. <b>Multi-Email:</b> Simpan hingga 5 email sementara dan ganti kapan saja.\n` +
    `5. <b>Sinkronisasi Web:</b> Sinkronkan email dari web ke bot via deep link.`;

  const kb = new InlineKeyboard().text('🔙 Kembali ke Dashboard', 'action_dashboard');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

// ─── ADMIN DASHBOARD VIEWS (RICH ADMIN HUB) ───────────────────────────────────

// 1. Main Admin Hub
async function showAdminPanel(ctx: any, isEdit: boolean = false) {
  const keys = await kv.keys('inbox:*');
  const isMaintenance = await kv.get('settings:maintenance');
  const totalEmailsRecv = (await kv.get('stats:emails_received')) || 0;
  const pendingUsers = ((await kv.smembers('bot_pending_users')) || []).length;
  const approvedUsers = ((await kv.smembers('bot_approved_users')) || []).length;
  const customDomains = ((await kv.smembers('domains')) || []).length;

  const text =
    `🛠️ <b>PANEL ADMIN TEMP MAIL</b>\n\n` +
    `📊 <b>Ringkasan Sistem:</b>\n` +
    `• Total Inbox Aktif Server: <b>${keys.length}</b>\n` +
    `• Total Email Masuk: <b>${totalEmailsRecv}</b>\n` +
    `• ⏳ Menunggu Persetujuan: <b>${pendingUsers}</b> user\n` +
    `• ✅ Pengguna Disetujui: <b>${approvedUsers}</b> user\n` +
    `• Custom Domain: <b>${customDomains}</b> domain\n` +
    `• Mode Maintenance: <b>${isMaintenance ? '🔴 AKTIF (Terkunci)' : '🟢 NONAKTIF (Normal)'}</b>\n\n` +
    `Pilih menu kelola sistem di bawah ini:`;

  const kb = new InlineKeyboard()
    .text(`👥 Kelola User (${pendingUsers > 0 ? `⏳ ${pendingUsers}` : approvedUsers})`, 'admin_users')
    .text('📊 Statistik & Analytics', 'admin_stats')
    .row()
    .text('📬 Pantau Inbox Server', 'admin_inboxes')
    .text('🌐 Kelola Domain', 'admin_domains')
    .row()
    .text('🚫 Keamanan & Ban', 'admin_security')
    .text('📜 Log Aktivitas', 'admin_logs')
    .row()
    .text('📢 Broadcast Pesan', 'admin_broadcast_prompt')
    .text(isMaintenance ? '🔓 Buka Maintenance' : '🔒 Kunci Maintenance', 'admin_toggle_maintenance')
    .row()
    .text('⚠️ Master Reset', 'admin_master_reset_confirm')
    .text('🏠 User Dashboard', 'action_dashboard');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

// 2. Admin Users Hub
async function showAdminUsersHub(ctx: any, isEdit: boolean = false) {
  const pendingUsers = ((await kv.smembers('bot_pending_users')) || []) as string[];
  const approvedUsers = ((await kv.smembers('bot_approved_users')) || []) as string[];
  const rejectedUsers = ((await kv.smembers('bot_rejected_users')) || []) as string[];
  const approvalMode = (await kv.get('settings:approval_mode')) !== false;

  let text =
    `👥 <b>MANAJEMEN PENGGUNA TELEGRAM BOT</b>\n\n` +
    `🔐 <b>Wajib Konfirmasi Admin:</b> <b>${approvalMode ? '🟢 AKTIF (Setiap user baru wajib di-approve)' : '⚪ NONAKTIF (Semua bebas pakai)'}</b>\n\n` +
    `📊 <b>Data Pengguna:</b>\n` +
    `• ⏳ Menunggu Konfirmasi: <b>${pendingUsers.length}</b> user\n` +
    `• ✅ Disetujui (Approved): <b>${approvedUsers.length}</b> user\n` +
    `• ⛔ Ditolak (Rejected): <b>${rejectedUsers.length}</b> user\n\n` +
    `Pilih aksi di bawah ini:`;

  const kb = new InlineKeyboard()
    .text(`⏳ Lihat Menunggu (${pendingUsers.length})`, 'admin_view_pending_users')
    .row()
    .text(`✅ Lihat Disetujui (${approvedUsers.length})`, 'admin_view_approved_users')
    .row()
    .text(approvalMode ? '🔓 Matikan Wajib Approval' : '🔒 Aktifkan Wajib Approval', 'admin_toggle_approval_mode')
    .row()
    .text('🔙 Kembali ke Admin Hub', 'admin_hub');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

// 3. Admin Pending Users View
async function showAdminPendingUsers(ctx: any, isEdit: boolean = false) {
  const pendingUserIds = ((await kv.smembers('bot_pending_users')) || []) as string[];

  let text =
    `⏳ <b>PENGGUNA MENUNGGU PERSETUJUAN (${pendingUserIds.length})</b>\n\n`;

  const kb = new InlineKeyboard();

  if (pendingUserIds.length === 0) {
    text += `<i>Tidak ada pengguna yang sedang menunggu persetujuan. Semua permintaan telah diproses!</i>\n`;
  } else {
    for (const uid of pendingUserIds) {
      const info = ((await kv.get(`bot_user_info:${uid}`)) as any) || { name: `User ${uid}`, username: '', requestedAt: '' };
      const timeStr = info.requestedAt ? formatTimeAgo(info.requestedAt) : '-';
      text += `👤 <b>${escapeHtml(info.name)}</b> ${info.username ? `(@${escapeHtml(info.username)})` : ''}\n`;
      text += `   └ ID: <code>${uid}</code> • 🕒 <i>${timeStr}</i>\n\n`;

      kb.text(`✅ Setujui ${info.name.substring(0, 10)}`, `admin_approve_user:${uid}`)
        .text(`❌ Tolak`, `admin_reject_user:${uid}`)
        .row();
    }
  }

  kb.text('🔙 Kembali ke Kelola User', 'admin_users');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

// 4. Admin Approved Users View
async function showAdminApprovedUsers(ctx: any, isEdit: boolean = false) {
  const approvedUserIds = ((await kv.smembers('bot_approved_users')) || []) as string[];

  let text =
    `✅ <b>PENGGUNA TERVERIFIKASI / DISETUJUI (${approvedUserIds.length})</b>\n\n`;

  const kb = new InlineKeyboard();

  if (approvedUserIds.length === 0) {
    text += `<i>Belum ada pengguna yang disetujui.</i>\n`;
  } else {
    const maxShow = Math.min(approvedUserIds.length, 8);
    for (let i = 0; i < maxShow; i++) {
      const uid = approvedUserIds[i];
      const info = ((await kv.get(`bot_user_info:${uid}`)) as any) || { name: `User ${uid}`, username: '' };
      text += `• <b>${escapeHtml(info.name)}</b> ${info.username ? `(@${escapeHtml(info.username)})` : ''} — <code>${uid}</code>\n`;
      kb.text(`🚫 Cabut Akses (${info.name.substring(0, 10)})`, `admin_reject_user:${uid}`).row();
    }
    if (approvedUserIds.length > 8) {
      text += `\n<i>...dan ${approvedUserIds.length - 8} pengguna lainnya.</i>\n`;
    }
  }

  kb.text('🔙 Kembali ke Kelola User', 'admin_users');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

// 5. Admin Stats View
async function showAdminStats(ctx: any, isEdit: boolean = false) {
  const keys = await kv.keys('inbox:*');
  const totalEmailsRecv = (await kv.get('stats:emails_received')) || 0;
  
  const today = new Date().toISOString().split('T')[0];
  const todayCount = (await kv.get(`stats:daily:${today}`)) || 0;

  const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const yesterdayCount = (await kv.get(`stats:daily:${yesterdayDate}`)) || 0;

  const topSenderMembers = ((await kv.zrange('stats:senders', 0, 4, { rev: true })) || []) as string[];

  let text =
    `📊 <b>STATISTIK &amp; ANALYTICS SISTEM</b>\n\n` +
    `• Total Kotak Masuk Aktif: <b>${keys.length}</b>\n` +
    `• Total Email Masuk: <b>${totalEmailsRecv}</b>\n` +
    `• Email Hari Ini (${today}): <b>${todayCount}</b>\n` +
    `• Email Kemarin (${yesterdayDate}): <b>${yesterdayCount}</b>\n\n` +
    `🏆 <b>Top Pengirim Email:</b>\n`;

  if (topSenderMembers.length === 0) {
    text += `<i>Belum ada data pengirim terekam.</i>\n`;
  } else {
    for (let i = 0; i < topSenderMembers.length; i++) {
      const sender = topSenderMembers[i];
      const count = await kv.zscore('stats:senders', sender);
      text += `${i + 1}. <code>${escapeHtml(sender)}</code> (${count || 0}x)\n`;
    }
  }

  const kb = new InlineKeyboard()
    .text('🔄 Refresh', 'admin_stats')
    .text('🔙 Kembali ke Admin Hub', 'admin_hub');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

// 6. Admin Inboxes Monitor View
async function showAdminInboxes(ctx: any, page: number = 0, isEdit: boolean = false) {
  const keys = ((await kv.keys('inbox:*')) || []) as string[];
  const pageSize = 6;
  const totalPages = Math.ceil(keys.length / pageSize) || 1;
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));

  const pageKeys = keys.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  let text =
    `📬 <b>PANTAU KOTAK MASUK SERVER</b>\n\n` +
    `Total Inbox Aktif: <b>${keys.length}</b> (Halaman ${currentPage + 1}/${totalPages})\n` +
    `<i>Pilih salah satu inbox untuk memeriksa pesan yang ada di dalamnya:</i>\n\n`;

  const kb = new InlineKeyboard();

  if (pageKeys.length === 0) {
    text += `<i>Tidak ada kotak masuk aktif saat ini.</i>\n`;
  } else {
    for (const key of pageKeys) {
      const address = key.replace('inbox:', '');
      const count = ((await kv.lrange(key, 0, -1)) || []).length;
      text += `• <code>${escapeHtml(address)}</code> (${count} pesan)\n`;
      kb.text(`🔍 ${address} (${count})`, `view_inbox:${address}`).row();
    }
  }

  if (currentPage > 0) {
    kb.text('⬅️ Sebelumnya', `admin_inboxes_page:${currentPage - 1}`);
  }
  if (currentPage < totalPages - 1) {
    kb.text('Selanjutnya ➡️', `admin_inboxes_page:${currentPage + 1}`);
  }
  kb.row();

  kb.text('🔄 Refresh', 'admin_inboxes')
    .text('🔙 Kembali ke Admin Hub', 'admin_hub');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

// 7. Admin Domains View
async function showAdminDomains(ctx: any, isEdit: boolean = false) {
  const customDomains = ((await kv.smembers('domains')) || []) as string[];

  let text =
    `🌐 <b>KELOLA DOMAIN SISTEM</b>\n\n` +
    `<b>Domain Bawaan (Default):</b>\n`;
  for (const d of DEFAULT_DOMAINS) {
    text += `• <code>${escapeHtml(d)}</code>\n`;
  }

  text += `\n<b>Custom Domain Anda:</b>\n`;
  const kb = new InlineKeyboard();

  if (customDomains.length === 0) {
    text += `<i>Belum ada domain tambahan.</i>\n`;
  } else {
    for (const d of customDomains) {
      text += `• <code>${escapeHtml(d)}</code>\n`;
      kb.text(`🗑 Hapus @${d}`, `admin_delete_domain:${d}`).row();
    }
  }

  kb.text('➕ Tambah Domain Baru', 'admin_add_domain_prompt').row();
  kb.text('🔙 Kembali ke Admin Hub', 'admin_hub');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

// 8. Admin Security View
async function showAdminSecurity(ctx: any, isEdit: boolean = false) {
  const bannedEmails = ((await kv.smembers('banned_emails')) || []) as string[];
  const bannedIps = ((await kv.smembers('banned_ips')) || []) as string[];
  const reservedNames = ((await kv.smembers('reserved_names')) || []) as string[];

  let text =
    `🚫 <b>PENGATURAN KEAMANAN &amp; BAN</b>\n\n` +
    `• Banned Emails: <b>${bannedEmails.length}</b> alamat\n` +
    `• Banned IPs: <b>${bannedIps.length}</b> IP\n` +
    `• Reserved Names: <b>${reservedNames.length}</b> kata kunci\n\n` +
    `<b>Contoh Reserved Names Terkunci:</b>\n`;

  const previewReserved = reservedNames.slice(0, 8);
  if (previewReserved.length === 0) {
    text += `<i>(Belum ada reserved names yang disetel)</i>\n`;
  } else {
    text += `<code>${escapeHtml(previewReserved.join(', '))}</code>\n`;
  }

  const kb = new InlineKeyboard()
    .text('➕ Tambah Reserved Name', 'admin_add_reserved_prompt')
    .row()
    .text('🚫 Ban Email Spammer', 'admin_ban_email_prompt')
    .row()
    .text('🔙 Kembali ke Admin Hub', 'admin_hub');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

// 9. Admin Logs View
async function showAdminLogs(ctx: any, isEdit: boolean = false) {
  const logs = ((await kv.lrange('system_logs', 0, 7)) || []) as any[];

  let text = `📜 <b>LOG AKTIVITAS SISTEM TERBARU</b>\n\n`;

  if (logs.length === 0) {
    text += `<i>Belum ada catatan log aktivitas.</i>\n`;
  } else {
    for (let i = 0; i < logs.length; i++) {
      const l = logs[i];
      const timeAgo = formatTimeAgo(l.timestamp);
      text += `<b>${i + 1}.</b> 🕒 <i>${escapeHtml(timeAgo)}</i> [${escapeHtml(l.type || 'info')}]\n`;
      text += `   📝 ${escapeHtml(l.message || '-')}\n\n`;
    }
  }

  const kb = new InlineKeyboard()
    .text('🔄 Refresh Logs', 'admin_logs')
    .text('🔙 Kembali ke Admin Hub', 'admin_hub');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}
