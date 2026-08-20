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

export function extractOtp(text: string = '', subject: string = ''): string | null {
  const combined = `${subject} \n ${text}`;
  
  // 1. Specific keywords pattern (Kode verifikasi: 123456, OTP is: 1234, etc.)
  const keywordRegex = /(?:kode|code|otp|pin|verifikasi|verification|password|token|konfirmasi|confirm)[^0-9a-zA-Z\n]{1,15}([0-9]{4,8}|[A-Z0-9]{5,8})\b/i;
  const keywordMatch = combined.match(keywordRegex);
  if (keywordMatch && keywordMatch[1]) {
    return keywordMatch[1];
  }

  // 2. Standalone 4 to 6 digit code in subject
  const subjectDigitMatch = subject.match(/\b([0-9]{4,6})\b/);
  if (subjectDigitMatch && subjectDigitMatch[1]) {
    return subjectDigitMatch[1];
  }

  // 3. Standalone 6-digit number in text (very common for OTPs)
  const sixDigitMatch = text.match(/\b([0-9]{6})\b/);
  if (sixDigitMatch && sixDigitMatch[1]) {
    return sixDigitMatch[1];
  }

  // 4. Standalone 4-digit number
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
  if (fallbackDomain && !DEFAULT_DOMAINS.includes(fallbackDomain)) {
    return [fallbackDomain, ...DEFAULT_DOMAINS];
  }
  return DEFAULT_DOMAINS;
}

function getRandomPrefix(): string {
  const randomName = HUMAN_NAMES[Math.floor(Math.random() * HUMAN_NAMES.length)];
  const randomSuffix = Math.floor(Math.random() * 8999 + 1000);
  return `${randomName.toLowerCase()}${randomSuffix}`;
}

// ─── USER EMAIL STORAGE HELPERS ───────────────────────────────────────────────

async function getUserEmails(chatId: number | string): Promise<string[]> {
  try {
    const list = await kv.get(`bot_user_emails:${chatId}`);
    if (Array.isArray(list)) return list as string[];
    // Backward compatibility with single email
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
  // Also register reverse mapping for instant push notifications
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

// Persistent bottom keyboard for high accessibility
export function getPersistentKeyboard() {
  return new Keyboard()
    .text('📬 Email Saya').text('➕ Buat Email').row()
    .text('📥 Kotak Masuk').text('🌐 Ganti Domain').row()
    .text('❓ Panduan & Bantuan')
    .resized();
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

  // ── COMMAND /start ──────────────────────────────────────────────────────────
  bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id;
    const startPayload = ctx.match?.trim() || '';

    // Handle deep-link sync from Web (e.g. /start sync_alex_breonline_biz_id or /start email@domain)
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
            existingEmails.pop(); // keep maximum 5 emails
          }
          existingEmails.unshift(targetEmail);
          await saveUserEmails(chatId, existingEmails);
        }
        await setActiveEmail(chatId, targetEmail);

        await ctx.reply(
          `✨ *Email Berhasil Disinkronkan!*\n\n` +
          `Email aktif Anda sekarang:\n` +
          `\`${targetEmail}\` _(tekan untuk salin)_\n\n` +
          `🔔 *Notifikasi Instan Aktif:* Anda akan menerima notifikasi otomatis begitu ada email/kode OTP masuk!`,
          {
            parse_mode: 'Markdown',
            reply_markup: getPersistentKeyboard(),
          }
        );
        return showDashboard(ctx, targetEmail, false);
      }
    }

    // Default start flow
    let activeEmail = await getActiveEmail(chatId);
    if (!activeEmail) {
      // Auto-create initial email for instant ease of use!
      const domains = await getSystemDomains(configuredDomain);
      const chosenDomain = domains[0] || 'breonline.biz.id';
      const prefix = getRandomPrefix();
      activeEmail = `${prefix}@${chosenDomain}`;

      await saveUserEmails(chatId, [activeEmail]);
      await setActiveEmail(chatId, activeEmail);
    }

    await ctx.reply(
      `👋 *Selamat Datang di Temp Mail Bot!*\n\n` +
      `Layanan email sementara kilat, aman & anti-spam. Gunakan email ini untuk pendaftaran akun, verifikasi OTP, atau uji coba tanpa mengotori email pribadi.\n\n` +
      `⚡ *Fitur Utama:*\n` +
      `• Deteksi otomatis kode OTP & tombol salin instan\n` +
      `• Notifikasi real-time email masuk langsung ke Telegram\n` +
      `• Kelola hingga 5 email sekaligus & kustom nama`,
      {
        parse_mode: 'Markdown',
        reply_markup: getPersistentKeyboard(),
      }
    );

    return showDashboard(ctx, activeEmail, false);
  });

  // ── COMMAND /help & /panduan ────────────────────────────────────────────────
  bot.command(['help', 'panduan'], async (ctx) => {
    return sendHelpMessage(ctx);
  });

  // ── COMMAND /myemail & /emails ──────────────────────────────────────────────
  bot.command(['myemail', 'emails', 'me'], async (ctx) => {
    const chatId = ctx.chat.id;
    const activeEmail = await getActiveEmail(chatId);
    return showDashboard(ctx, activeEmail, false);
  });

  // ── COMMAND /inbox ──────────────────────────────────────────────────────────
  bot.command('inbox', async (ctx) => {
    const chatId = ctx.chat.id;
    const activeEmail = await getActiveEmail(chatId);
    if (!activeEmail) {
      return ctx.reply('⚠️ Anda belum memiliki email aktif. Buat email terlebih dahulu dengan perintah /new atau tombol di bawah.', {
        reply_markup: getPersistentKeyboard(),
      });
    }
    return showInbox(ctx, activeEmail, false);
  });

  // ── COMMAND /new ────────────────────────────────────────────────────────────
  bot.command('new', async (ctx) => {
    const chatId = ctx.chat.id;
    const domains = await getSystemDomains(configuredDomain);
    const prefDomain = ((await kv.get(`bot_selected_domain:${chatId}`)) as string) || domains[0];
    const prefix = getRandomPrefix();
    const newEmail = `${prefix}@${prefDomain}`;

    const existing = await getUserEmails(chatId);
    const updated = [newEmail, ...existing.filter((e) => e !== newEmail)].slice(0, 5);
    await saveUserEmails(chatId, updated);
    await setActiveEmail(chatId, newEmail);

    return showDashboard(ctx, newEmail, false, `✨ *Email baru berhasil dibuat!*`);
  });

  // ── COMMAND /custom ─────────────────────────────────────────────────────────
  bot.command('custom', async (ctx) => {
    const chatId = ctx.chat.id;
    await kv.set(`bot_state:${chatId}`, 'awaiting_custom_prefix');
    const domains = await getSystemDomains(configuredDomain);
    const prefDomain = ((await kv.get(`bot_selected_domain:${chatId}`)) as string) || domains[0];

    return ctx.reply(
      `✏️ *Buat Email Kustom*\n\n` +
      `Domain terpilih: \`@${prefDomain}\`\n\n` +
      `Ketik nama email yang Anda inginkan (hanya huruf kecil, angka, titik, atau strip).\n` +
      `_Contoh: \`budi99\` atau \`sarah.online\`_`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('❌ Batal', 'action_cancel_state'),
      }
    );
  });

  // ── COMMAND /domain & /domains ──────────────────────────────────────────────
  bot.command(['domain', 'domains'], async (ctx) => {
    return showDomainSelector(ctx, false);
  });

  // ── COMMAND /admin ──────────────────────────────────────────────────────────
  bot.command('admin', async (ctx) => {
    if (!adminId || ctx.from?.id.toString() !== adminId) {
      return ctx.reply('⛔ Akses ditolak. Anda bukan admin.');
    }
    return showAdminPanel(ctx, false);
  });

  // ── TEXT MESSAGE HANDLER (PERSISTENT BUTTONS & STATES) ──────────────────────
  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text.trim();

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

      return showDashboard(ctx, newEmail, false, `✨ *Email baru berhasil dibuat!*`);
    }
    if (text === '📥 Kotak Masuk') {
      const activeEmail = await getActiveEmail(chatId);
      if (!activeEmail) {
        return ctx.reply('⚠️ Anda belum memiliki email aktif.', { reply_markup: getPersistentKeyboard() });
      }
      return showInbox(ctx, activeEmail, false);
    }
    if (text === '🌐 Ganti Domain') {
      return showDomainSelector(ctx, false);
    }
    if (text === '❓ Panduan & Bantuan') {
      return sendHelpMessage(ctx);
    }

    // 2. Check Interactive Input States (e.g. Custom Prefix)
    const state = await kv.get(`bot_state:${chatId}`);
    if (state === 'awaiting_custom_prefix') {
      const rawPrefix = text.toLowerCase().replace(/[^a-z0-9._-]/g, '');

      if (!rawPrefix || rawPrefix.length < 2) {
        return ctx.reply('⚠️ Nama email terlalu pendek (minimal 2 karakter). Coba ketik nama lain:', {
          reply_markup: new InlineKeyboard().text('❌ Batal', 'action_cancel_state'),
        });
      }

      // Check reserved names
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

      return showDashboard(ctx, newEmail, false, `✅ *Email kustom berhasil dibuat!*`);
    }

    // Fallback info
    return ctx.reply('Gunakan tombol menu di bawah atau ketik /help untuk melihat opsi:', {
      reply_markup: getPersistentKeyboard(),
    });
  });

  // ── CALLBACK QUERY HANDLERS (INLINE INTERACTIONS) ───────────────────────────

  // Dashboard Refresh & View
  bot.callbackQuery(/^refresh_dashboard:(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    await ctx.answerCallbackQuery('🔄 Memperbarui status...');
    return showDashboard(ctx, email, true);
  });

  bot.callbackQuery('action_dashboard', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const activeEmail = await getActiveEmail(chatId);
    await ctx.answerCallbackQuery();
    return showDashboard(ctx, activeEmail, true);
  });

  // Generate Random Email
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

    await ctx.answerCallbackQuery('✨ Email baru siap digunakan!');
    return showDashboard(ctx, newEmail, true, `✨ *Email baru berhasil dibuat!*`);
  });

  // Custom Prefix Prompt
  bot.callbackQuery('action_custom_email', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    await kv.set(`bot_state:${chatId}`, 'awaiting_custom_prefix');
    const domains = await getSystemDomains(configuredDomain);
    const prefDomain = ((await kv.get(`bot_selected_domain:${chatId}`)) as string) || domains[0];

    await ctx.answerCallbackQuery();
    const text =
      `✏️ *Buat Email Kustom*\n\n` +
      `Domain terpilih: \`@${prefDomain}\`\n\n` +
      `Silakan balas pesan ini dengan mengetik nama email yang Anda inginkan (misal: \`budi99\` atau \`sarah.store\`).`;

    const kb = new InlineKeyboard().text('❌ Batal', 'action_cancel_state');

    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    } catch {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
    }
  });

  // Cancel any active input state
  bot.callbackQuery('action_cancel_state', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    await kv.del(`bot_state:${chatId}`);
    await ctx.answerCallbackQuery('Dibatalkan');
    const activeEmail = await getActiveEmail(chatId);
    return showDashboard(ctx, activeEmail, true);
  });

  // Select Domain Flow
  bot.callbackQuery('action_select_domain', async (ctx) => {
    await ctx.answerCallbackQuery();
    return showDomainSelector(ctx, true);
  });

  bot.callbackQuery(/^set_domain:(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const domain = ctx.match[1];
    await kv.set(`bot_selected_domain:${chatId}`, domain);
    await ctx.answerCallbackQuery(`Domain terpilih: ${domain}`);

    // Update active email's domain or keep prefix
    const active = await getActiveEmail(chatId);
    if (active && active.includes('@')) {
      const prefix = active.split('@')[0];
      const newEmail = `${prefix}@${domain}`;
      const existing = await getUserEmails(chatId);
      const updated = [newEmail, ...existing.filter((e) => e !== newEmail)].slice(0, 5);
      await saveUserEmails(chatId, updated);
      await setActiveEmail(chatId, newEmail);
      return showDashboard(ctx, newEmail, true, `🌐 *Domain diubah ke @${domain}*`);
    }

    return showDomainSelector(ctx, true);
  });

  // List All User Emails (Multi-Email Manager - Screenshot 1 Style)
  bot.callbackQuery('action_list_emails', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    await ctx.answerCallbackQuery();
    return showEmailList(ctx, true);
  });

  // Switch Active Email
  bot.callbackQuery(/^select_email:(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const targetEmail = ctx.match[1];
    await setActiveEmail(chatId, targetEmail);
    await ctx.answerCallbackQuery(`Email aktif: ${targetEmail}`);
    return showDashboard(ctx, targetEmail, true);
  });

  // Delete Specific Email
  bot.callbackQuery(/^action_delete_email:(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const emailToDelete = ctx.match[1];

    const kb = new InlineKeyboard()
      .text('🗑 Ya, Hapus Sekarang', `confirm_delete_email:${emailToDelete}`)
      .text('❌ Batal', `refresh_dashboard:${emailToDelete}`);

    await ctx.answerCallbackQuery();
    const confirmText =
      `⚠️ *Konfirmasi Hapus Email*\n\n` +
      `Apakah Anda yakin ingin menghapus email \`${emailToDelete}\` beserta seluruh kotak masuknya?`;

    try {
      await ctx.editMessageText(confirmText, { parse_mode: 'Markdown', reply_markup: kb });
    } catch {
      await ctx.reply(confirmText, { parse_mode: 'Markdown', reply_markup: kb });
    }
  });

  bot.callbackQuery(/^confirm_delete_email:(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const emailToDelete = ctx.match[1];

    await removeUserEmail(chatId, emailToDelete);
    await kv.del(`inbox:${emailToDelete.toLowerCase()}`);
    await ctx.answerCallbackQuery('Email berhasil dihapus');

    const nextActive = await getActiveEmail(chatId);
    return showDashboard(ctx, nextActive, true, `🗑 *Email \`${emailToDelete}\` telah dihapus.*`);
  });

  // ── INBOX & EMAIL READER (Screenshot 2 Style & Instant Reader) ──────────────

  // View Inbox List
  bot.callbackQuery(/^view_inbox:(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    await ctx.answerCallbackQuery('Memuat kotak masuk...');
    return showInbox(ctx, email, true);
  });

  // Read Single Message Detail
  bot.callbackQuery(/^read_email:(.+):(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    const messageId = ctx.match[2];
    await ctx.answerCallbackQuery();
    return showEmailDetail(ctx, email, messageId, true);
  });

  // Delete Single Message
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

    await ctx.answerCallbackQuery('Pesan berhasil dihapus');
    return showInbox(ctx, email, true);
  });

  // Clear Entire Inbox
  bot.callbackQuery(/^clear_inbox:(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    await kv.del(`inbox:${email.toLowerCase()}`);
    await ctx.answerCallbackQuery('Kotak masuk telah dibersihkan');
    return showInbox(ctx, email, true);
  });

  // Help Action
  bot.callbackQuery('action_help', async (ctx) => {
    await ctx.answerCallbackQuery();
    return sendHelpMessage(ctx, true);
  });

  // Admin Actions
  bot.callbackQuery('admin_toggle_maintenance', async (ctx) => {
    if (!adminId || ctx.from?.id.toString() !== adminId) {
      return ctx.answerCallbackQuery('Akses ditolak!');
    }
    const current = await kv.get('settings:maintenance');
    const next = !current;
    if (next) {
      await kv.set('settings:maintenance', '1');
    } else {
      await kv.del('settings:maintenance');
    }
    await ctx.answerCallbackQuery(`Maintenance ${next ? 'Aktif' : 'Nonaktif'}`);
    return showAdminPanel(ctx, true);
  });

  bot.callbackQuery('admin_refresh_stats', async (ctx) => {
    if (!adminId || ctx.from?.id.toString() !== adminId) {
      return ctx.answerCallbackQuery('Akses ditolak!');
    }
    await ctx.answerCallbackQuery('Statistik diperbarui');
    return showAdminPanel(ctx, true);
  });

  cachedBot = bot;
  cachedToken = token;
  return bot;
}

// ─── UI RENDERERS ─────────────────────────────────────────────────────────────

// 1. Dashboard View
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
      `📬 *TEMPORARY EMAIL ANDA*\n\n` +
      `📧 *Alamat Aktif:*\n` +
      `\`${email}\` _(tap untuk salin)_\n\n` +
      `📊 *Status:* 🟢 Aktif & Siap Menerima Email\n` +
      `📨 *Pesan Masuk:* *${inboxCount}* pesan\n` +
      `🌐 *Domain:* \`@${domain}\`\n\n` +
      `_💡 Tips: Salin email di atas dan gunakan untuk verifikasi akun atau pendaftaran. Kode OTP akan otomatis muncul begitu email terkirim!_`;
  } else {
    text +=
      `📬 *TEMPORARY EMAIL*\n\n` +
      `Anda belum memiliki alamat email sementara aktif.\n` +
      `Klik tombol di bawah untuk membuat email baru dalam 1 detik!`;
  }

  const kb = buildDashboardKeyboard(email, inboxCount);

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
    }
  } catch (err: any) {
    if (!err.message?.includes('message is not modified')) {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
    }
  }
}

// 2. Multi-Email List (Screenshot 1 Style)
async function showEmailList(ctx: any, isEdit: boolean = false) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const emails = await getUserEmails(chatId);
  const activeEmail = await getActiveEmail(chatId);

  let text = `📋 *Daftar Email Sementara Anda* (${emails.length}/5):\n\n`;

  const kb = new InlineKeyboard();

  if (emails.length === 0) {
    text += `_Belum ada email tersimpan._\n`;
    kb.text('➕ Buat Email Baru', 'action_random_email').row();
  } else {
    for (let i = 0; i < emails.length; i++) {
      const e = emails[i];
      const isActive = e.toLowerCase() === activeEmail?.toLowerCase();
      const badge = isActive ? '⭐ (Aktif)' : '';
      const listCount = ((await kv.lrange(`inbox:${e.toLowerCase()}`, 0, -1)) || []).length;

      text += `${i + 1}. \`${e}\` ${badge}\n   └ 📨 ${listCount} pesan\n\n`;

      // Inline button for quick switch
      kb.text(`${isActive ? '✅' : '👉'} ${e}`, `select_email:${e}`).row();
    }
    kb.text('➕ Buat Baru', 'action_random_email')
      .text('🔄 Refresh', 'action_list_emails')
      .row();
  }

  kb.text('🔙 Kembali ke Dashboard', 'action_dashboard');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  }
}

// 3. Inbox List (Screenshot 2 Style)
async function showInbox(ctx: any, email: string, isEdit: boolean = false) {
  const emailKey = email.toLowerCase();
  const rawEmails = ((await kv.lrange(`inbox:${emailKey}`, 0, -1)) || []) as any[];

  const kb = new InlineKeyboard();

  if (rawEmails.length === 0) {
    const emptyText =
      `📥 *Kotak Masuk Kosong*\n\n` +
      `Alamat: \`${email}\`\n\n` +
      `Belum ada email yang masuk. Begitu ada email dikirimkan ke alamat ini, pesan akan langsung muncul di sini secara otomatis.\n\n` +
      `_Status: Menunggu email masuk..._`;

    kb.text('🔄 Refresh Inbox', `view_inbox:${email}`).row();
    kb.text('🔙 Kembali ke Dashboard', 'action_dashboard');

    try {
      if (isEdit) {
        return await ctx.editMessageText(emptyText, { parse_mode: 'Markdown', reply_markup: kb });
      }
      return await ctx.reply(emptyText, { parse_mode: 'Markdown', reply_markup: kb });
    } catch {
      return await ctx.reply(emptyText, { parse_mode: 'Markdown', reply_markup: kb });
    }
  }

  let text = `📥 *Kotak Masuk untuk* \`${email}\`\n`;
  text += `*Total Pesan:* ${rawEmails.length}\n`;
  text += `───────────────────────\n\n`;

  const maxShow = Math.min(rawEmails.length, 6);
  for (let i = 0; i < maxShow; i++) {
    const msg = rawEmails[i];
    const timeAgo = formatTimeAgo(msg.receivedAt);
    const otp = extractOtp(msg.text || '', msg.subject || '');
    const sender = msg.fromName ? `${msg.fromName}` : (msg.from || 'Unknown');
    const subject = msg.subject || '(Tanpa Subjek)';

    text += `*${i + 1}.* 👤 *${sender}* • 🕒 _${timeAgo}_\n`;
    text += `   📌 *Subjek:* ${subject}\n`;
    if (otp) {
      text += `   🔑 *Kode OTP:* \`${otp}\`\n`;
    }
    text += `\n`;

    // Button to read full message
    const btnLabel = `📖 [${i + 1}] ${subject.length > 22 ? subject.substring(0, 22) + '...' : subject}`;
    kb.text(btnLabel, `read_email:${email}:${msg.id}`).row();
  }

  if (rawEmails.length > 6) {
    text += `_Terdapat ${rawEmails.length - 6} pesan lainnya._\n\n`;
  }

  text += `_Klik salah satu tombol di bawah untuk membaca isi pesan lengkap._`;

  kb.text('🔄 Refresh', `view_inbox:${email}`)
    .text('🗑 Kosongkan Inbox', `clear_inbox:${email}`)
    .row();
  kb.text('🔙 Kembali ke Dashboard', 'action_dashboard');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  }
}

// 4. Single Email Detail Reader
async function showEmailDetail(ctx: any, email: string, messageId: string, isEdit: boolean = false) {
  const rawEmails = ((await kv.lrange(`inbox:${email.toLowerCase()}`, 0, -1)) || []) as any[];
  const msg = rawEmails.find((e) => e.id === messageId);

  const kb = new InlineKeyboard();

  if (!msg) {
    kb.text('🔙 Kembali ke Inbox', `view_inbox:${email}`);
    const notFoundText = `⚠️ *Pesan tidak ditemukan atau sudah dihapus.*`;
    try {
      if (isEdit) return await ctx.editMessageText(notFoundText, { parse_mode: 'Markdown', reply_markup: kb });
      return await ctx.reply(notFoundText, { parse_mode: 'Markdown', reply_markup: kb });
    } catch {
      return await ctx.reply(notFoundText, { parse_mode: 'Markdown', reply_markup: kb });
    }
  }

  const otp = extractOtp(msg.text || '', msg.subject || '');
  const timeStr = msg.receivedAt ? new Date(msg.receivedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-';

  let text = `✉️ *DETAIL PESAN MASUK*\n\n`;
  text += `👤 *Dari:* ${msg.fromName ? `${msg.fromName} <${msg.from}>` : msg.from}\n`;
  text += `📫 *Kepada:* \`${email}\`\n`;
  text += `📌 *Subjek:* *${msg.subject || '(Tanpa Subjek)'}*\n`;
  text += `🕒 *Waktu:* ${timeStr} WIB\n`;

  if (otp) {
    text += `\n───────────────────────\n`;
    text += `🔑 *KODE VERIFIKASI / OTP TERDETEKSI:*\n`;
    text += `👉 \`${otp}\` 👈 _(tekan untuk salin)_\n`;
    text += `───────────────────────\n`;
  } else {
    text += `───────────────────────\n`;
  }

  // Clean body text preview
  let bodyText = (msg.text || '').trim();
  if (!bodyText && msg.html) {
    // Basic strip tags if only HTML is present
    bodyText = msg.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  if (!bodyText) {
    bodyText = '_(Tidak ada isi teks pada email ini)_';
  }

  // Cap length to avoid Telegram 4096 character limit
  if (bodyText.length > 2500) {
    bodyText = bodyText.substring(0, 2500) + '\n\n_... (Pesan dipotong karena terlalu panjang)_';
  }

  text += `\n📄 *Isi Pesan:*\n\n${bodyText}`;

  kb.text('🔙 Kembali ke Inbox', `view_inbox:${email}`)
    .text('🗑 Hapus Pesan', `del_msg:${email}:${messageId}`)
    .row();
  kb.text('🏠 Dashboard', 'action_dashboard');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  }
}

// 5. Domain Selector View
async function showDomainSelector(ctx: any, isEdit: boolean = false) {
  const chatId = ctx.chat?.id;
  const domains = await getSystemDomains();
  const currentPref = chatId ? ((await kv.get(`bot_selected_domain:${chatId}`)) as string) : null;

  let text =
    `🌐 *Pilih Domain Email*\n\n` +
    `Pilih domain yang ingin Anda gunakan untuk pembuatan email baru:\n\n`;

  const kb = new InlineKeyboard();
  for (const d of domains) {
    const isSelected = d === (currentPref || domains[0]);
    text += `${isSelected ? '✅' : '▫️'} \`@${d}\`\n`;
    kb.text(`${isSelected ? '✅ ' : ''}@${d}`, `set_domain:${d}`).row();
  }

  kb.text('🔙 Kembali ke Dashboard', 'action_dashboard');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  }
}

// 6. Help Message
async function sendHelpMessage(ctx: any, isEdit: boolean = false) {
  const text =
    `❓ *PANDUAN & BANTUAN TEMP MAIL BOT*\n\n` +
    `Bot ini memungkinkan Anda memiliki kotak masuk email sementara tanpa perlu registrasi atau membuka browser.\n\n` +
    `📌 *Daftar Perintah Cepat:*\n` +
    `• /start — Mulai bot & buka dashboard utama\n` +
    `• /new — Buat alamat email acak baru\n` +
    `• /inbox — Buka & periksa kotak masuk aktif\n` +
    `• /myemail — Lihat alamat email aktif saat ini\n` +
    `• /custom — Buat email dengan nama kustom\n` +
    `• /domain — Ganti domain email aktif\n` +
    `• /help — Tampilkan panduan ini\n\n` +
    `⚡ *Fitur Unggulan:*\n` +
    `1. *Realtime Alert:* Notifikasi pesan baru otomatis terkirim ke Telegram.\n` +
    `2. *Auto OTP:* Kode verifikasi 4-8 digit otomatis terdeteksi & siap disalin.\n` +
    `3. *Multi-Email:* Simpan hingga 5 email sementara dan ganti kapan saja.\n` +
    `4. *Sinkronisasi Web:* Sinkronkan email dari web ke bot via deep link.`;

  const kb = new InlineKeyboard().text('🔙 Kembali ke Dashboard', 'action_dashboard');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  }
}

// 7. Admin Panel View
async function showAdminPanel(ctx: any, isEdit: boolean = false) {
  const keys = await kv.keys('inbox:*');
  const isMaintenance = await kv.get('settings:maintenance');
  const totalEmailsRecv = (await kv.get('stats:emails_received')) || 0;

  const text =
    `🛠 *PANEL ADMIN BOT*\n\n` +
    `📊 *Statistik Sistem:*\n` +
    `• Total Inbox Aktif: *${keys.length}*\n` +
    `• Total Email Diterima: *${totalEmailsRecv}*\n` +
    `• Status Maintenance: *${isMaintenance ? '🔴 AKTIF (Terkunci)' : '🟢 NONAKTIF (Normal)'}*\n`;

  const kb = new InlineKeyboard()
    .text(isMaintenance ? '🔓 Matikan Maintenance' : '🔒 Aktifkan Maintenance', 'admin_toggle_maintenance')
    .row()
    .text('🔄 Perbarui Statistik', 'admin_refresh_stats')
    .row()
    .text('🏠 Kembali ke User View', 'action_dashboard');

  try {
    if (isEdit) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  }
}
