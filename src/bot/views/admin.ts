import { InlineKeyboard } from 'grammy';
import { kv, escapeHtml, formatTimeAgo, DEFAULT_DOMAINS } from '../helpers';
import { TelegramUserInfo } from '../types';

export async function showAdminPanel(ctx: any, isEdit: boolean = false) {
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

export async function showAdminUsersHub(ctx: any, isEdit: boolean = false) {
  const allUsers = ((await kv.smembers('bot_all_users')) || []) as string[];
  const pendingUsers = ((await kv.smembers('bot_pending_users')) || []) as string[];
  const approvedUsers = ((await kv.smembers('bot_approved_users')) || []) as string[];
  const bannedUsers = ((await kv.smembers('bot_banned_users')) || []) as string[];
  const approvalMode = (await kv.get('settings:approval_mode')) !== false;

  let text =
    `👥 <b>MANAJEMEN PENGGUNA TELEGRAM BOT</b>\n\n` +
    `🔐 <b>Wajib Konfirmasi Admin:</b> <b>${approvalMode ? '🟢 AKTIF (User baru wajib di-approve)' : '⚪ NONAKTIF (Semua bebas pakai)'}</b>\n\n` +
    `📊 <b>Data Pengguna:</b>\n` +
    `• Total Terdaftar: <b>${allUsers.length}</b> user\n` +
    `• ⏳ Menunggu Konfirmasi: <b>${pendingUsers.length}</b> user\n` +
    `• ✅ Disetujui (Aktif): <b>${approvedUsers.length}</b> user\n` +
    `• ⛔ Diblokir (Banned): <b>${bannedUsers.length}</b> user\n\n` +
    `Pilih menu di bawah ini:`;

  const kb = new InlineKeyboard()
    .text('➕ Tambah User Manual', 'admin_add_user_prompt')
    .text('🔍 Cari Pengguna', 'admin_search_user_prompt')
    .row()
    .text(`⏳ Menunggu (${pendingUsers.length})`, 'admin_view_pending_users')
    .text(`✅ Aktif (${approvedUsers.length})`, 'admin_view_approved_users')
    .row()
    .text(`🚫 Diblokir (${bannedUsers.length})`, 'admin_view_banned_users')
    .text(approvalMode ? '🔓 Matikan Approval' : '🔒 Aktifkan Approval', 'admin_toggle_approval_mode')
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

export async function showAdminPendingUsers(ctx: any, isEdit: boolean = false) {
  const pendingUserIds = ((await kv.smembers('bot_pending_users')) || []) as string[];

  let text = `⏳ <b>PENGGUNA MENUNGGU PERSETUJUAN (${pendingUserIds.length})</b>\n\n`;
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

export async function showAdminApprovedUsers(ctx: any, isEdit: boolean = false) {
  const approvedUserIds = ((await kv.smembers('bot_approved_users')) || []) as string[];

  let text =
    `✅ <b>PENGGUNA TERVERIFIKASI / AKTIF (${approvedUserIds.length})</b>\n\n` +
    `<i>Pilih pengguna untuk melihat detail, kelola akses, atau kirim pesan:</i>\n\n`;

  const kb = new InlineKeyboard();

  if (approvedUserIds.length === 0) {
    text += `<i>Belum ada pengguna yang disetujui.</i>\n`;
  } else {
    const maxShow = Math.min(approvedUserIds.length, 10);
    for (let i = 0; i < maxShow; i++) {
      const uid = approvedUserIds[i];
      const info = ((await kv.get(`bot_user_info:${uid}`)) as any) || { name: `User ${uid}`, username: '' };
      text += `• <b>${escapeHtml(info.name)}</b> ${info.username ? `(@${escapeHtml(info.username)})` : ''} — <code>${uid}</code>\n`;
      kb.text(`👤 ${info.name.substring(0, 16)}`, `admin_user_detail:${uid}`).row();
    }
    if (approvedUserIds.length > 10) {
      text += `\n<i>...dan ${approvedUserIds.length - 10} pengguna lainnya. Gunakan menu Cari untuk menemukan user tertentu.</i>\n`;
    }
  }

  kb.text('➕ Tambah User Manual', 'admin_add_user_prompt').row();
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

export async function showAdminBannedUsers(ctx: any, isEdit: boolean = false) {
  const bannedUserIds = ((await kv.smembers('bot_banned_users')) || []) as string[];

  let text = `🚫 <b>PENGGUNA DIBLOKIR / BANNED (${bannedUserIds.length})</b>\n\n`;
  const kb = new InlineKeyboard();

  if (bannedUserIds.length === 0) {
    text += `<i>Tidak ada pengguna yang diblokir saat ini.</i>\n`;
  } else {
    for (const uid of bannedUserIds) {
      const info = ((await kv.get(`bot_user_info:${uid}`)) as any) || { name: `User ${uid}`, username: '' };
      text += `• <b>${escapeHtml(info.name)}</b> (ID: <code>${uid}</code>)\n`;
      kb.text(`♻️ Buka Blokir (${info.name.substring(0, 10)})`, `admin_unban_user:${uid}`).row();
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

export async function showAdminUserDetail(ctx: any, targetId: string, isEdit: boolean = false) {
  const info: TelegramUserInfo = ((await kv.get(`bot_user_info:${targetId}`)) as any) || { name: `User ${targetId}`, username: '' };
  const status = (await kv.get(`bot_user_status:${targetId}`)) || 'unknown';
  const emails = ((await kv.get(`bot_user_emails:${targetId}`)) as string[]) || [];

  let text =
    `👤 <b>DETAIL PENGGUNA TELEGRAM</b>\n\n` +
    `• <b>Nama:</b> ${escapeHtml(info.name)}\n` +
    `• <b>Username:</b> ${info.username ? `@${escapeHtml(info.username)}` : '<i>(Tidak ada username)</i>'}\n` +
    `• <b>User ID:</b> <code>${targetId}</code>\n` +
    `• <b>Status Akses:</b> <b>${status === 'approved' ? '🟢 Aktif / Disetujui' : status === 'banned' ? '🔴 Diblokir' : '⏳ Menunggu'}</b>\n` +
    `• <b>Waktu Gabung:</b> ${info.requestedAt ? new Date(info.requestedAt).toLocaleString('id-ID') : '-'}\n` +
    `• <b>Catatan:</b> ${escapeHtml(info.notes || '-')}\n\n` +
    `📬 <b>Email Sementara Dimiliki (${emails.length}):</b>\n`;

  if (emails.length === 0) {
    text += `<i>Belum membuat email sementara.</i>\n`;
  } else {
    for (const e of emails) {
      text += `• <code>${escapeHtml(e)}</code>\n`;
    }
  }

  const kb = new InlineKeyboard();

  if (status === 'approved') {
    kb.text('🚫 Blokir User Ini', `admin_reject_user:${targetId}`).row();
  } else if (status === 'banned' || status === 'rejected') {
    kb.text('♻️ Buka Blokir (Aktifkan)', `admin_unban_user:${targetId}`).row();
  } else if (status === 'pending') {
    kb.text('✅ Setujui User', `admin_approve_user:${targetId}`)
      .text('❌ Tolak / Blokir', `admin_reject_user:${targetId}`)
      .row();
  }

  kb.text('✉️ Kirim Pesan DM', `admin_send_dm_prompt:${targetId}`)
    .text('🗑 Hapus Permanen', `admin_delete_user_confirm:${targetId}`)
    .row();
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

export async function showAdminStats(ctx: any, isEdit: boolean = false) {
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

export async function showAdminInboxes(ctx: any, page: number = 0, isEdit: boolean = false) {
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

export async function showAdminDomains(ctx: any, isEdit: boolean = false) {
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

export async function showAdminSecurity(ctx: any, isEdit: boolean = false) {
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

export async function showAdminLogs(ctx: any, isEdit: boolean = false) {
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
