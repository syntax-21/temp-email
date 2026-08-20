import { InlineKeyboard } from 'grammy';
import { kv, escapeHtml, extractOtp, formatTimeAgo, getSystemDomains } from '../helpers';
import { getUserEmails, getActiveEmail } from '../storage';
import { buildDashboardKeyboard } from '../keyboards';
import { EmailMessage } from '../types';

export async function showDashboard(
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

export async function showEmailList(ctx: any, isEdit: boolean = false) {
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

export async function showInbox(ctx: any, email: string, isEdit: boolean = false) {
  const emailKey = email.toLowerCase();
  const rawEmails = ((await kv.lrange(`inbox:${emailKey}`, 0, -1)) || []) as EmailMessage[];

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

export async function showEmailDetail(ctx: any, email: string, messageId: string, isEdit: boolean = false) {
  const rawEmails = ((await kv.lrange(`inbox:${email.toLowerCase()}`, 0, -1)) || []) as EmailMessage[];
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

export async function showDomainSelector(ctx: any, isEdit: boolean = false) {
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

export async function sendHelpMessage(ctx: any, isEdit: boolean = false) {
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
