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

  // Global Error Handler to prevent silent crashes
  bot.catch((err) => {
    console.error(`Grammy bot error on update ${err.ctx.update.update_id}:`, err.error);
  });

  // ── COMMAND /start ──────────────────────────────────────────────────────────
  bot.command('start', async (ctx) => {
    try {
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
              existingEmails.pop(); // keep max 5 emails
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
              reply_markup: getPersistentKeyboard(),
            }
          );
          return showDashboard(ctx, targetEmail, false);
        }
      }

      // Default start flow
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
        `• Kelola hingga 5 email sekaligus &amp; kustom nama`,
        {
          parse_mode: 'HTML',
          reply_markup: getPersistentKeyboard(),
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

    return showDashboard(ctx, newEmail, false, `✨ <b>Email baru berhasil dibuat!</b>`);
  });

  // ── COMMAND /custom ─────────────────────────────────────────────────────────
  bot.command('custom', async (ctx) => {
    const chatId = ctx.chat.id;
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

      return showDashboard(ctx, newEmail, false, `✨ <b>Email baru berhasil dibuat!</b>`);
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

      return showDashboard(ctx, newEmail, false, `✅ <b>Email kustom berhasil dibuat!</b>`);
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

    await ctx.answerCallbackQuery('✨ Email baru siap digunakan!').catch(() => {});
    return showDashboard(ctx, newEmail, true, `✨ <b>Email baru berhasil dibuat!</b>`);
  });

  // Custom Prefix Prompt
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

  // Cancel any active input state
  bot.callbackQuery('action_cancel_state', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    await kv.del(`bot_state:${chatId}`);
    await ctx.answerCallbackQuery('Dibatalkan').catch(() => {});
    const activeEmail = await getActiveEmail(chatId);
    return showDashboard(ctx, activeEmail, true);
  });

  // Select Domain Flow
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

  // List All User Emails (Multi-Email Manager - Screenshot 1 Style)
  bot.callbackQuery('action_list_emails', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    await ctx.answerCallbackQuery().catch(() => {});
    return showEmailList(ctx, true);
  });

  // Switch Active Email
  bot.callbackQuery(/^select_email:(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const targetEmail = ctx.match[1];
    await setActiveEmail(chatId, targetEmail);
    await ctx.answerCallbackQuery(`Email aktif: ${targetEmail}`).catch(() => {});
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

  // ── INBOX & EMAIL READER (Screenshot 2 Style & Instant Reader) ──────────────

  // View Inbox List
  bot.callbackQuery(/^view_inbox:(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    await ctx.answerCallbackQuery('Memuat kotak masuk...').catch(() => {});
    return showInbox(ctx, email, true);
  });

  // Read Single Message Detail
  bot.callbackQuery(/^read_email:(.+):(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    const messageId = ctx.match[2];
    await ctx.answerCallbackQuery().catch(() => {});
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

    await ctx.answerCallbackQuery('Pesan berhasil dihapus').catch(() => {});
    return showInbox(ctx, email, true);
  });

  // Clear Entire Inbox
  bot.callbackQuery(/^clear_inbox:(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    await kv.del(`inbox:${email.toLowerCase()}`);
    await ctx.answerCallbackQuery('Kotak masuk telah dibersihkan').catch(() => {});
    return showInbox(ctx, email, true);
  });

  // Help Action
  bot.callbackQuery('action_help', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    return sendHelpMessage(ctx, true);
  });

  // Admin Actions
  bot.callbackQuery('admin_toggle_maintenance', async (ctx) => {
    if (!adminId || ctx.from?.id.toString() !== adminId) {
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

  bot.callbackQuery('admin_refresh_stats', async (ctx) => {
    if (!adminId || ctx.from?.id.toString() !== adminId) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await ctx.answerCallbackQuery('Statistik diperbarui').catch(() => {});
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

// 2. Multi-Email List (Screenshot 1 Style)
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
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  }
}

// 3. Inbox List (Screenshot 2 Style)
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

    // Button to read full message
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

  // Clean body text preview
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
    `• /help — Tampilkan panduan ini\n\n` +
    `⚡ <b>Fitur Unggulan:</b>\n` +
    `1. <b>Realtime Alert:</b> Notifikasi pesan baru otomatis terkirim ke Telegram.\n` +
    `2. <b>Auto OTP:</b> Kode verifikasi 4-8 digit otomatis terdeteksi &amp; siap disalin.\n` +
    `3. <b>Multi-Email:</b> Simpan hingga 5 email sementara dan ganti kapan saja.\n` +
    `4. <b>Sinkronisasi Web:</b> Sinkronkan email dari web ke bot via deep link.`;

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

// 7. Admin Panel View
async function showAdminPanel(ctx: any, isEdit: boolean = false) {
  const keys = await kv.keys('inbox:*');
  const isMaintenance = await kv.get('settings:maintenance');
  const totalEmailsRecv = (await kv.get('stats:emails_received')) || 0;

  const text =
    `🛠 <b>PANEL ADMIN BOT</b>\n\n` +
    `📊 <b>Statistik Sistem:</b>\n` +
    `• Total Inbox Aktif: <b>${keys.length}</b>\n` +
    `• Total Email Diterima: <b>${totalEmailsRecv}</b>\n` +
    `• Status Maintenance: <b>${isMaintenance ? '🔴 AKTIF (Terkunci)' : '🟢 NONAKTIF (Normal)'}</b>\n`;

  const kb = new InlineKeyboard()
    .text(isMaintenance ? '🔓 Matikan Maintenance' : '🔒 Aktifkan Maintenance', 'admin_toggle_maintenance')
    .row()
    .text('🔄 Perbarui Statistik', 'admin_refresh_stats')
    .row()
    .text('🏠 Kembali ke User View', 'action_dashboard');

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
