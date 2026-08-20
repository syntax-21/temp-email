import { Bot, InlineKeyboard } from 'grammy';
import { kv, escapeHtml, isUserAdmin } from '../helpers';
import { getPersistentKeyboard } from '../keyboards';
import {
  showAdminPanel,
  showAdminUsersHub,
  showAdminPendingUsers,
  showAdminApprovedUsers,
  showAdminBannedUsers,
  showAdminUserDetail,
  showAdminStats,
  showAdminInboxes,
  showAdminDomains,
  showAdminSecurity,
  showAdminLogs
} from '../views/admin';
import { TelegramUserInfo } from '../types';

export function registerAdminHandlers(bot: Bot, adminId: string, configuredDomain: string) {
  // ── COMMAND /admin ──────────────────────────────────────────────────────────
  bot.command('admin', async (ctx) => {
    const chatId = ctx.chat.id;
    const isAdmin = await isUserAdmin(chatId, adminId);
    if (!isAdmin) {
      return ctx.reply('⛔ Akses ditolak. ID Telegram Anda tidak terdaftar sebagai Admin di Web Panel.');
    }
    return showAdminPanel(ctx, false);
  });

  // ── ADMIN USER APPROVAL & MANAGEMENT CALLBACKS ──────────────────────────────

  bot.callbackQuery(/^admin_approve_user:(\d+)$/, async (ctx) => {
    const currentChatId = ctx.chat?.id;
    if (!currentChatId || !(await isUserAdmin(currentChatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }

    const targetChatId = ctx.match[1];
    await kv.set(`bot_user_status:${targetChatId}`, 'approved');
    await kv.srem('bot_pending_users', targetChatId);
    await kv.srem('bot_rejected_users', targetChatId);
    await kv.srem('bot_banned_users', targetChatId);
    await kv.sadd('bot_approved_users', targetChatId);

    const userInfo: TelegramUserInfo = ((await kv.get(`bot_user_info:${targetChatId}`)) as any) || { name: `User ${targetChatId}` };

    await ctx.answerCallbackQuery('✅ Akses pengguna disetujui!').catch(() => {});

    try {
      await ctx.editMessageText(
        `✅ <b>PERMINTAAN DISETUJUI</b>\n\n` +
        `Pengguna <b>${escapeHtml(userInfo.name)}</b> (ID: <code>${targetChatId}</code>) telah <b>DISETUJUI</b> dan dapat menggunakan bot secara penuh.`,
        { parse_mode: 'HTML' }
      );
    } catch {}

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
    } catch {}
  });

  bot.callbackQuery(/^admin_reject_user:(\d+)$/, async (ctx) => {
    const currentChatId = ctx.chat?.id;
    if (!currentChatId || !(await isUserAdmin(currentChatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }

    const targetChatId = ctx.match[1];
    await kv.set(`bot_user_status:${targetChatId}`, 'banned');
    await kv.srem('bot_pending_users', targetChatId);
    await kv.srem('bot_approved_users', targetChatId);
    await kv.sadd('bot_banned_users', targetChatId);

    const userInfo: TelegramUserInfo = ((await kv.get(`bot_user_info:${targetChatId}`)) as any) || { name: `User ${targetChatId}` };

    await ctx.answerCallbackQuery('❌ Akses pengguna ditolak / diblokir!').catch(() => {});

    try {
      await ctx.editMessageText(
        `❌ <b>PENGGUNA DIBLOKIR / DITOLAK</b>\n\n` +
        `Pengguna <b>${escapeHtml(userInfo.name)}</b> (ID: <code>${targetChatId}</code>) telah <b>DIBLOKIR</b>.`,
        { parse_mode: 'HTML' }
      );
    } catch {}

    try {
      await bot.api.sendMessage(
        targetChatId,
        `⛔ <b>Pemberitahuan</b>\n\nMaaf, akun Anda telah <b>diblokir</b> oleh Admin dari layanan Temp Mail Bot.`,
        { parse_mode: 'HTML' }
      );
    } catch {}
  });

  bot.callbackQuery(/^admin_unban_user:(\d+)$/, async (ctx) => {
    const currentChatId = ctx.chat?.id;
    if (!currentChatId || !(await isUserAdmin(currentChatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }

    const targetChatId = ctx.match[1];
    await kv.set(`bot_user_status:${targetChatId}`, 'approved');
    await kv.srem('bot_banned_users', targetChatId);
    await kv.srem('bot_rejected_users', targetChatId);
    await kv.srem('bot_pending_users', targetChatId);
    await kv.sadd('bot_approved_users', targetChatId);

    await ctx.answerCallbackQuery('♻️ Blokir dibuka!').catch(() => {});

    try {
      await bot.api.sendMessage(
        targetChatId,
        `♻️ <b>Pemberitahuan Pemulihan Akun</b>\n\n` +
        `Blokir pada akun Anda telah <b>dibuka</b> oleh Admin. Ketik <b>/start</b> untuk melanjutkan.`,
        { parse_mode: 'HTML' }
      );
    } catch {}

    return showAdminUserDetail(ctx, targetChatId, true);
  });

  bot.callbackQuery(/^admin_user_detail:(\d+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    const targetChatId = ctx.match[1];
    await ctx.answerCallbackQuery().catch(() => {});
    return showAdminUserDetail(ctx, targetChatId, true);
  });

  bot.callbackQuery(/^admin_send_dm_prompt:(\d+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    const targetChatId = ctx.match[1];
    await kv.set(`bot_state:${chatId}`, `admin_awaiting_dm:${targetChatId}`);
    await ctx.answerCallbackQuery().catch(() => {});

    const text =
      `✉️ <b>Kirim Pesan ke User (ID: <code>${targetChatId}</code>)</b>\n\n` +
      `Ketik pesan yang ingin Anda kirimkan langsung ke pengguna ini di bawah:`;

    const kb = new InlineKeyboard().text('❌ Batal', `admin_user_detail:${targetChatId}`);
    return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.callbackQuery(/^admin_delete_user_confirm:(\d+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    const targetChatId = ctx.match[1];
    await ctx.answerCallbackQuery().catch(() => {});

    const kb = new InlineKeyboard()
      .text('⚠️ YA, HAPUS PERMANEN', `admin_do_delete_user:${targetChatId}`)
      .row()
      .text('❌ Batal', `admin_user_detail:${targetChatId}`);

    const text =
      `⚠️ <b>KONFIRMASI HAPUS PENGGUNA</b>\n\n` +
      `Yakin ingin menghapus pengguna ID: <code>${targetChatId}</code> beserta seluruh kotak masuk &amp; alamat email sementaranya?`;

    return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.callbackQuery(/^admin_do_delete_user:(\d+)$/, async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    const targetChatId = ctx.match[1];

    const emails = ((await kv.get(`bot_user_emails:${targetChatId}`)) as string[]) || [];
    for (const email of emails) {
      await kv.del(`inbox:${email.toLowerCase()}`);
      await kv.srem(`bot_email_users:${email.toLowerCase()}`, targetChatId);
    }

    await kv.del(`bot_user_info:${targetChatId}`);
    await kv.del(`bot_user_status:${targetChatId}`);
    await kv.del(`bot_user_emails:${targetChatId}`);
    await kv.del(`bot_active_email:${targetChatId}`);

    await kv.srem('bot_all_users', targetChatId);
    await kv.srem('bot_approved_users', targetChatId);
    await kv.srem('bot_pending_users', targetChatId);
    await kv.srem('bot_banned_users', targetChatId);

    await ctx.answerCallbackQuery('Pengguna berhasil dihapus permanen').catch(() => {});
    return showAdminUsersHub(ctx, true);
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

  bot.callbackQuery('admin_users', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return showAdminUsersHub(ctx, true);
  });

  bot.callbackQuery('admin_add_user_prompt', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await kv.set(`bot_state:${chatId}`, 'admin_awaiting_add_user');
    await ctx.answerCallbackQuery().catch(() => {});
    const text =
      `➕ <b>Tambah User Telegram Baru</b>\n\n` +
      `Ketik ID Telegram dan Nama Pengguna (opsional).\n` +
      `<i>Contoh: <code>123456789 Budi Pratama</code></i>`;
    const kb = new InlineKeyboard().text('❌ Batal', 'admin_users');
    return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.callbackQuery('admin_search_user_prompt', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await kv.set(`bot_state:${chatId}`, 'admin_awaiting_search_user');
    await ctx.answerCallbackQuery().catch(() => {});
    const text =
      `🔍 <b>Cari Pengguna</b>\n\n` +
      `Ketik ID Telegram, Nama, atau Username (@) pengguna yang ingin dicari:`;
    const kb = new InlineKeyboard().text('❌ Batal', 'admin_users');
    return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
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

  bot.callbackQuery('admin_view_banned_users', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !(await isUserAdmin(chatId, adminId))) {
      return ctx.answerCallbackQuery('Akses ditolak!').catch(() => {});
    }
    await ctx.answerCallbackQuery().catch(() => {});
    return showAdminBannedUsers(ctx, true);
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
}
