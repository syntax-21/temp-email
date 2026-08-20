import { Bot, InlineKeyboard } from 'grammy';
import { kv, escapeHtml, getSystemDomains, getRandomPrefix, isUserAdmin, logBotActivity } from '../helpers';
import { checkUserStatus, getUserEmails, saveUserEmails, getActiveEmail, setActiveEmail, removeUserEmail } from '../storage';
import { getPersistentKeyboard } from '../keyboards';
import {
  showDashboard,
  showEmailList,
  showInbox,
  showEmailDetail,
  showDomainSelector,
  sendHelpMessage
} from '../views/user';
import {
  showAdminPanel,
  showAdminUsersHub,
  showAdminUserDetail,
  showAdminDomains,
  showAdminSecurity
} from '../views/admin';

export function registerUserHandlers(bot: Bot, adminId: string, configuredDomain: string) {
  // ── COMMAND /start ──────────────────────────────────────────────────────────
  bot.command('start', async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const isAdmin = await isUserAdmin(chatId, adminId);
      const username = ctx.from?.username ? `@${ctx.from.username}` : '';
      const name = `${ctx.from?.first_name || ''} ${ctx.from?.last_name || ''}`.trim() || 'Pengguna';

      await logBotActivity(
        'TELEGRAM_USER',
        `User ${name} ${username} (ID: ${chatId}) menjalankan perintah /start`,
        { chatId, username, name, isAdmin }
      );

      if (isAdmin) {
        await kv.set(`bot_user_status:${chatId}`, 'approved');
        await kv.sadd('bot_approved_users', String(chatId));
        await kv.srem('bot_pending_users', String(chatId));
      }

      // Check User Approval Status
      const { status, isNew } = await checkUserStatus(chatId, ctx.from, adminId);

      if (status === 'banned' || status === 'rejected') {
        await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} diblokir mencoba mengakses bot`);
        return ctx.reply(
          `⛔ <b>Akses Ditolak / Akun Diblokir</b>\n\n` +
          `Akun Anda belum diizinkan atau telah diblokir oleh Admin untuk menggunakan Temp Mail Bot ini.`,
          { parse_mode: 'HTML' }
        );
      }

      if (status === 'pending') {
        await logBotActivity('TELEGRAM_USER', `Permintaan akses baru dari ${name} ${username} (ID: ${chatId}) menunggu persetujuan admin`);
        await ctx.reply(
          `👋 <b>Halo, ${escapeHtml(name)}!</b>\n\n` +
          `🔐 <b>Verifikasi Akses Diperlukan</b>\n` +
          `Untuk menjaga keamanan &amp; kualitas layanan, penggunaan bot ini memerlukan persetujuan dari Admin.\n\n` +
          `📩 <b>Permintaan akses Anda telah dikirimkan ke Admin.</b>\n` +
          `Mohon menunggu beberapa saat, Anda akan menerima notifikasi otomatis begitu disetujui!`,
          { parse_mode: 'HTML' }
        );

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
                `🏷️ <b>Username:</b> ${escapeHtml(username || '(tidak ada)')}\n` +
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

          await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} menyinkronkan email dari web: ${targetEmail}`);

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

      let activeEmail = await getActiveEmail(chatId);
      if (!activeEmail) {
        const domains = await getSystemDomains(configuredDomain);
        const chosenDomain = domains[0] || 'breonline.biz.id';
        const prefix = getRandomPrefix();
        activeEmail = `${prefix}@${chosenDomain}`;

        await saveUserEmails(chatId, [activeEmail]);
        await setActiveEmail(chatId, activeEmail);

        await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} membuat email awal: ${activeEmail}`);
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

  // ── USER COMMANDS ───────────────────────────────────────────────────────────
  bot.command(['help', 'panduan'], async (ctx) => {
    const chatId = ctx.chat.id;
    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} membuka panduan & bantuan (/help)`);
    return sendHelpMessage(ctx);
  });

  bot.command(['myemail', 'emails', 'me'], async (ctx) => {
    const chatId = ctx.chat.id;
    const { status } = await checkUserStatus(chatId, ctx.from, adminId);
    if (status !== 'approved') {
      return ctx.reply('⚠️ Akses Anda masih menunggu persetujuan dari Admin.');
    }
    const activeEmail = await getActiveEmail(chatId);
    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} melihat dashboard email aktif (/myemail: ${activeEmail})`);
    return showDashboard(ctx, activeEmail, false);
  });

  bot.command('inbox', async (ctx) => {
    const chatId = ctx.chat.id;
    const { status } = await checkUserStatus(chatId, ctx.from, adminId);
    if (status !== 'approved') {
      return ctx.reply('⚠️ Akses Anda masih menunggu persetujuan dari Admin.');
    }
    const activeEmail = await getActiveEmail(chatId);
    if (!activeEmail) {
      const isAdmin = await isUserAdmin(chatId, adminId);
      return ctx.reply('⚠️ Anda belum memiliki email aktif. Buat email baru via tombol di bawah.', {
        reply_markup: getPersistentKeyboard(isAdmin),
      });
    }
    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} membuka inbox (/inbox: ${activeEmail})`);
    return showInbox(ctx, activeEmail, false);
  });

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

    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} membuat email acak baru (/new: ${newEmail})`);
    return showDashboard(ctx, newEmail, false, `✨ <b>Email baru berhasil dibuat!</b>`);
  });

  bot.command('custom', async (ctx) => {
    const chatId = ctx.chat.id;
    const { status } = await checkUserStatus(chatId, ctx.from, adminId);
    if (status !== 'approved') {
      return ctx.reply('⚠️ Akses Anda masih menunggu persetujuan dari Admin.');
    }
    await kv.set(`bot_state:${chatId}`, 'awaiting_custom_prefix');
    const domains = await getSystemDomains(configuredDomain);
    const prefDomain = ((await kv.get(`bot_selected_domain:${chatId}`)) as string) || domains[0];

    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} meminta pembuatan email kustom (/custom)`);
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

  bot.command(['domain', 'domains'], async (ctx) => {
    const chatId = ctx.chat.id;
    const { status } = await checkUserStatus(chatId, ctx.from, adminId);
    if (status !== 'approved') {
      return ctx.reply('⚠️ Akses Anda masih menunggu persetujuan dari Admin.');
    }
    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} membuka pemilih domain (/domain)`);
    return showDomainSelector(ctx, false);
  });

  // ── TEXT MESSAGE HANDLER (PERSISTENT BUTTONS & CHAT STATES) ─────────────────
  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text.trim();
    const isAdmin = await isUserAdmin(chatId, adminId);
    const { status } = await checkUserStatus(chatId, ctx.from, adminId);

    // If user is not approved, reject normal commands
    if (!isAdmin && status !== 'approved') {
      if (status === 'banned' || status === 'rejected') {
        return ctx.reply('⛔ Akses Anda telah diblokir oleh Admin.');
      }
      return ctx.reply('⏳ Permintaan akses Anda masih menunggu persetujuan dari Admin.');
    }

    // 1. MATCH PERSISTENT BOTTOM KEYBOARD BUTTONS
    const lowerText = text.toLowerCase();

    // Button: Email Saya
    if (text.includes('Email Saya') || lowerText === 'email saya') {
      const activeEmail = await getActiveEmail(chatId);
      await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} menekan tombol 'Email Saya' (${activeEmail})`);
      return showDashboard(ctx, activeEmail, false);
    }

    // Button: Buat Email
    if (text.includes('Buat Email') || lowerText === 'buat email' || text === '+ Buat Email') {
      const domains = await getSystemDomains(configuredDomain);
      const prefDomain = ((await kv.get(`bot_selected_domain:${chatId}`)) as string) || domains[0];
      const prefix = getRandomPrefix();
      const newEmail = `${prefix}@${prefDomain}`;

      const existing = await getUserEmails(chatId);
      const updated = [newEmail, ...existing.filter((e) => e !== newEmail)].slice(0, 5);
      await saveUserEmails(chatId, updated);
      await setActiveEmail(chatId, newEmail);

      await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} menekan tombol 'Buat Email' ➔ ${newEmail}`);
      return showDashboard(ctx, newEmail, false, `✨ <b>Email baru berhasil dibuat!</b>`);
    }

    // Button: Kotak Masuk
    if (text.includes('Kotak Masuk') || lowerText === 'kotak masuk') {
      const activeEmail = await getActiveEmail(chatId);
      if (!activeEmail) {
        return ctx.reply('⚠️ Anda belum memiliki email aktif.', { reply_markup: getPersistentKeyboard(isAdmin) });
      }
      await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} menekan tombol 'Kotak Masuk' (${activeEmail})`);
      return showInbox(ctx, activeEmail, false);
    }

    // Button: Ganti Domain
    if (text.includes('Ganti Domain') || lowerText === 'ganti domain') {
      await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} menekan tombol 'Ganti Domain'`);
      return showDomainSelector(ctx, false);
    }

    // Button: Panduan & Bantuan
    if (text.includes('Panduan') || text.includes('Bantuan') || lowerText === 'help') {
      await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} menekan tombol 'Panduan & Bantuan'`);
      return sendHelpMessage(ctx);
    }

    // Button: Panel Admin
    if (text.includes('Panel Admin') || lowerText === 'panel admin') {
      if (!isAdmin) return ctx.reply('⛔ Akses ditolak.');
      await logBotActivity('TELEGRAM_ADMIN', `Admin ID: ${chatId} membuka Panel Admin via tombol`);
      return showAdminPanel(ctx, false);
    }

    // 2. CHECK INTERACTIVE INPUT STATES
    const state = (await kv.get(`bot_state:${chatId}`)) as string;

    // State: Custom Prefix
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

      await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} berhasil membuat email kustom: ${newEmail}`);
      return showDashboard(ctx, newEmail, false, `✅ <b>Email kustom berhasil dibuat!</b>`);
    }

    // State: Admin Add User Manual
    if (state === 'admin_awaiting_add_user' && isAdmin) {
      await kv.del(`bot_state:${chatId}`);
      const parts = text.split(' ');
      const targetId = parts[0]?.trim();
      const targetName = parts.slice(1).join(' ').trim() || `User ${targetId}`;

      if (!targetId || isNaN(Number(targetId))) {
        return ctx.reply('⚠️ ID Telegram tidak valid (harus angka). Coba ulangi dari menu kelola user.', {
          reply_markup: new InlineKeyboard().text('🔙 Kembali ke Kelola User', 'admin_users'),
        });
      }

      const userInfo = {
        id: targetId,
        name: targetName,
        username: '',
        requestedAt: new Date().toISOString(),
        notes: 'Ditambahkan via Bot Admin'
      };

      await kv.set(`bot_user_info:${targetId}`, userInfo);
      await kv.set(`bot_user_status:${targetId}`, 'approved');
      await kv.sadd('bot_all_users', targetId);
      await kv.sadd('bot_approved_users', targetId);
      await kv.srem('bot_pending_users', targetId);
      await kv.srem('bot_banned_users', targetId);

      await logBotActivity('TELEGRAM_ADMIN', `Admin ID: ${chatId} menambahkan user baru manual: ${targetName} (${targetId})`);

      try {
        await bot.api.sendMessage(
          targetId,
          `🎉 <b>Selamat! Akun Anda Telah Diaktifkan oleh Admin!</b>\n\n` +
          `Anda sekarang dapat menggunakan Temp Mail Bot.\n` +
          `Ketik <b>/start</b> untuk memulai!`,
          { parse_mode: 'HTML' }
        );
      } catch {}

      await ctx.reply(`✅ Pengguna <b>${escapeHtml(targetName)}</b> (ID: <code>${targetId}</code>) berhasil ditambahkan &amp; diaktifkan!`, {
        parse_mode: 'HTML',
      });
      return showAdminUsersHub(ctx, false);
    }

    // State: Admin Search User
    if (state === 'admin_awaiting_search_user' && isAdmin) {
      await kv.del(`bot_state:${chatId}`);
      const query = text.toLowerCase().replace(/^@/, '');
      const allIds = ((await kv.smembers('bot_all_users')) || []) as string[];
      let foundId = '';

      for (const uid of allIds) {
        if (uid === query) { foundId = uid; break; }
        const info = ((await kv.get(`bot_user_info:${uid}`)) as any) || {};
        if (info.username?.toLowerCase() === query || info.name?.toLowerCase().includes(query)) {
          foundId = uid;
          break;
        }
      }

      if (foundId) {
        await logBotActivity('TELEGRAM_ADMIN', `Admin mencari user: '${text}', ditemukan ID: ${foundId}`);
        return showAdminUserDetail(ctx, foundId, false);
      } else {
        await logBotActivity('TELEGRAM_ADMIN', `Admin mencari user: '${text}', tidak ditemukan`);
        return ctx.reply(`⚠️ Pengguna dengan kata kunci "<b>${escapeHtml(text)}</b>" tidak ditemukan.`, {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('🔙 Kembali ke Kelola User', 'admin_users'),
        });
      }
    }

    // State: Admin Send DM
    if (state && state.startsWith('admin_awaiting_dm:') && isAdmin) {
      const targetId = state.replace('admin_awaiting_dm:', '');
      await kv.del(`bot_state:${chatId}`);

      try {
        await bot.api.sendMessage(
          targetId,
          `📩 <b>PESAN DARI ADMIN:</b>\n\n${escapeHtml(text)}`,
          { parse_mode: 'HTML' }
        );
        await logBotActivity('TELEGRAM_ADMIN', `Admin mengirim pesan DM ke User ID: ${targetId} ➔ "${text}"`);
        await ctx.reply(`✅ Pesan berhasil terkirim ke user (ID: <code>${targetId}</code>)!`, {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('🔙 Kembali ke Detail User', `admin_user_detail:${targetId}`),
        });
      } catch (err: any) {
        await ctx.reply(`❌ Gagal mengirim pesan ke user: ${err.message}`, {
          reply_markup: new InlineKeyboard().text('🔙 Kembali ke Kelola User', 'admin_users'),
        });
      }
      return;
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
      await logBotActivity('TELEGRAM_ADMIN', `Admin menambahkan domain baru: @${domainInput}`);
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
      await logBotActivity('TELEGRAM_ADMIN', `Admin menambahkan reserved name: ${nameInput}`);
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
      await logBotActivity('TELEGRAM_ADMIN', `Admin memblokir email spammer: ${emailInput}`);
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
      await logBotActivity('TELEGRAM_ADMIN', `Admin mengirim broadcast ke ${sentCount}/${users.length} user: "${text}"`);
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

  // ── USER CALLBACK QUERIES ───────────────────────────────────────────────────

  bot.callbackQuery(/^refresh_dashboard:(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    const chatId = ctx.chat?.id;
    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} merefresh dashboard email: ${email}`);
    await ctx.answerCallbackQuery('🔄 Memperbarui status...').catch(() => {});
    return showDashboard(ctx, email, true);
  });

  bot.callbackQuery('action_dashboard', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const activeEmail = await getActiveEmail(chatId);
    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} kembali ke dashboard`);
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

    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} klik tombol inline 'Email Acak Baru' ➔ ${newEmail}`);
    await ctx.answerCallbackQuery('✨ Email baru siap digunakan!').catch(() => {});
    return showDashboard(ctx, newEmail, true, `✨ <b>Email baru berhasil dibuat!</b>`);
  });

  bot.callbackQuery('action_custom_email', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    await kv.set(`bot_state:${chatId}`, 'awaiting_custom_prefix');
    const domains = await getSystemDomains(configuredDomain);
    const prefDomain = ((await kv.get(`bot_selected_domain:${chatId}`)) as string) || domains[0];

    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} klik tombol inline 'Kustom Nama'`);
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
      await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} mengubah domain ke @${domain} ➔ ${newEmail}`);
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
    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} berganti ke email aktif: ${targetEmail}`);
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
    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} menghapus email: ${emailToDelete}`);
    await ctx.answerCallbackQuery('Email berhasil dihapus').catch(() => {});

    const nextActive = await getActiveEmail(chatId);
    return showDashboard(ctx, nextActive, true, `🗑 <b>Email <code>${escapeHtml(emailToDelete)}</code> telah dihapus.</b>`);
  });

  bot.callbackQuery(/^view_inbox:(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    const chatId = ctx.chat?.id;
    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} membuka kotak masuk: ${email}`);
    await ctx.answerCallbackQuery('Memuat kotak masuk...').catch(() => {});
    return showInbox(ctx, email, true);
  });

  bot.callbackQuery(/^read_email:(.+):(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    const messageId = ctx.match[2];
    const chatId = ctx.chat?.id;
    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} membaca email ID: ${messageId} pada ${email}`);
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

    const chatId = ctx.chat?.id;
    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} menghapus pesan ID: ${messageId} dari ${email}`);
    await ctx.answerCallbackQuery('Pesan berhasil dihapus').catch(() => {});
    return showInbox(ctx, email, true);
  });

  bot.callbackQuery(/^clear_inbox:(.+)$/, async (ctx) => {
    const email = ctx.match[1];
    await kv.del(`inbox:${email.toLowerCase()}`);
    const chatId = ctx.chat?.id;
    await logBotActivity('TELEGRAM_USER', `User ID: ${chatId} mengosongkan seluruh kotak masuk: ${email}`);
    await ctx.answerCallbackQuery('Kotak masuk telah dibersihkan').catch(() => {});
    return showInbox(ctx, email, true);
  });

  bot.callbackQuery('action_help', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    return sendHelpMessage(ctx, true);
  });
}
