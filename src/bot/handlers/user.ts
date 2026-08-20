import { Bot, InlineKeyboard } from 'grammy';
import { kv, escapeHtml, getSystemDomains, getRandomPrefix, isUserAdmin } from '../helpers';
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

export function registerUserHandlers(bot: Bot, adminId: string, configuredDomain: string) {
  // ── COMMAND /start ──────────────────────────────────────────────────────────
  bot.command('start', async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const isAdmin = await isUserAdmin(chatId, adminId);

      if (isAdmin) {
        await kv.set(`bot_user_status:${chatId}`, 'approved');
        await kv.sadd('bot_approved_users', String(chatId));
        await kv.srem('bot_pending_users', String(chatId));
      }

      // Check User Approval Status
      const { status, isNew } = await checkUserStatus(chatId, ctx.from, adminId);

      if (status === 'banned' || status === 'rejected') {
        return ctx.reply(
          `⛔ <b>Akses Ditolak / Akun Diblokir</b>\n\n` +
          `Akun Anda belum diizinkan atau telah diblokir oleh Admin untuk menggunakan Temp Mail Bot ini.`,
          { parse_mode: 'HTML' }
        );
      }

      if (status === 'pending') {
        const name = `${ctx.from?.first_name || ''} ${ctx.from?.last_name || ''}`.trim() || 'Pengguna';
        const username = ctx.from?.username ? `@${ctx.from.username}` : '(Tidak ada username)';

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

  // ── USER COMMANDS ───────────────────────────────────────────────────────────
  bot.command(['help', 'panduan'], async (ctx) => {
    return sendHelpMessage(ctx);
  });

  bot.command(['myemail', 'emails', 'me'], async (ctx) => {
    const chatId = ctx.chat.id;
    const { status } = await checkUserStatus(chatId, ctx.from, adminId);
    if (status !== 'approved') {
      return ctx.reply('⚠️ Akses Anda masih menunggu persetujuan dari Admin.');
    }
    const activeEmail = await getActiveEmail(chatId);
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
    return showDomainSelector(ctx, false);
  });

  // ── USER CALLBACK QUERIES ───────────────────────────────────────────────────

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
}
