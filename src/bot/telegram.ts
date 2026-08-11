import { Bot, InlineKeyboard, Context } from 'grammy';
import { createClient } from '@vercel/kv';
import { HUMAN_NAMES } from '@/utils/names';

const kv = createClient({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

// Cache the bot instance to avoid recreating it on every request
let cachedBot: Bot | null = null;
let cachedToken: string | null = null;

export function getBot(token: string, adminId: string, domain: string) {
  // Return cached bot if token hasn't changed
  if (cachedBot && cachedToken === token) {
    return cachedBot;
  }

  const bot = new Bot(token);
  const EMAIL_DOMAIN = domain || 'tempmail.com';

  function getRandomName() {
    return HUMAN_NAMES[Math.floor(Math.random() * HUMAN_NAMES.length)];
  }

  const mainMenuKeyboard = new InlineKeyboard()
    .text('✉️ Buat Email Baru', 'generate_email')
    .text('📥 Cek Inbox', 'inbox')
    .row()
    .text('⚙️ Email Kustom', 'set_custom_email')
    .text('👤 Email Saya', 'my_email');

  const adminKeyboard = new InlineKeyboard()
    .text('🛠 Toggle Maintenance', 'admin_maintenance')
    .text('📊 Statistik', 'admin_stats');

  bot.command('start', async (ctx) => {
    await ctx.reply('Selamat datang di Temp Mail Bot! Pilih menu di bawah ini:', {
      reply_markup: mainMenuKeyboard,
    });
  });

  bot.command('admin', async (ctx) => {
    if (!adminId || ctx.from?.id.toString() !== adminId) {
      return ctx.reply('Akses ditolak. Anda bukan admin.');
    }
    await ctx.reply('Panel Admin:', { reply_markup: adminKeyboard });
  });

  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;
    const state = await kv.get(`bot_state:${chatId}`);

    if (state === 'awaiting_custom_email') {
      let prefix = ctx.message.text.toLowerCase().trim();
      if (!/^[a-z0-9]+$/.test(prefix)) {
        return ctx.reply('Format salah! Hanya gunakan huruf kecil dan angka. Coba lagi:', {
          reply_markup: new InlineKeyboard().text('❌ Batal', 'cancel_action')
        });
      }

      const isReserved = await kv.sismember('reserved_names', prefix);
      if (isReserved) {
        return ctx.reply('Nama email ini dilarang digunakan (Reserved). Coba nama lain:', {
          reply_markup: new InlineKeyboard().text('❌ Batal', 'cancel_action')
        });
      }

      const newEmail = `${prefix}@${EMAIL_DOMAIN}`;
      await kv.set(`bot_email:${chatId}`, newEmail);
      await kv.del(`bot_state:${chatId}`);

      return ctx.reply(`✅ Email aktif Anda sekarang:\n\n\`${newEmail}\``, {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard
      });
    }

    await ctx.reply('Gunakan tombol di bawah ini untuk berinteraksi dengan bot:', {
      reply_markup: mainMenuKeyboard,
    });
  });

  bot.callbackQuery('generate_email', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const randomName = getRandomName();
    const randomSuffix = Math.floor(Math.random() * 9999);
    const newEmail = `${randomName}${randomSuffix}@${EMAIL_DOMAIN}`;

    await kv.set(`bot_email:${chatId}`, newEmail);
    
    await ctx.answerCallbackQuery('Email baru berhasil dibuat!');
    await ctx.editMessageText(`✅ Email baru Anda siap digunakan:\n\n\`${newEmail}\``, {
      parse_mode: 'Markdown',
      reply_markup: mainMenuKeyboard,
    });
  });

  bot.callbackQuery('my_email', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const email = await kv.get(`bot_email:${chatId}`);
    if (!email) {
      await ctx.answerCallbackQuery('Anda belum memiliki email aktif.');
      return ctx.editMessageText('Anda belum memiliki email aktif. Silakan buat baru.', {
        reply_markup: mainMenuKeyboard,
      });
    }

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`📧 Email aktif Anda saat ini:\n\n\`${email}\``, {
      parse_mode: 'Markdown',
      reply_markup: mainMenuKeyboard,
    });
  });

  bot.callbackQuery('inbox', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const email = await kv.get(`bot_email:${chatId}`);
    if (!email) {
      await ctx.answerCallbackQuery('Anda belum memiliki email aktif.');
      return;
    }

    const emails = await kv.lrange(`inbox:${email}`, 0, -1);
    await ctx.answerCallbackQuery();
    
    if (!emails || emails.length === 0) {
      return ctx.editMessageText(`📥 Kotak masuk untuk \`${email}\` masih kosong.`, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('🔄 Refresh', 'inbox').row().text('🔙 Kembali', 'back_to_main'),
      });
    }

    let inboxText = `📥 **Inbox untuk** \`${email}\`\n\n`;
    const maxEmails = Math.min(emails.length, 5);
    for (let i = 0; i < maxEmails; i++) {
      const e = emails[i] as any;
      inboxText += `*Dari:* ${e.from?.address || 'Unknown'}\n`;
      inboxText += `*Subjek:* ${e.subject || '(Tanpa Subjek)'}\n`;
      const preview = e.text ? (e.text.substring(0, 100) + '...') : '(Tidak ada teks preview)';
      inboxText += `*Isi:* ${preview}\n`;
      inboxText += `--- \n`;
    }
    
    if (emails.length > 5) {
      inboxText += `\n_Terdapat ${emails.length - 5} pesan lainnya._\n`;
    }

    await ctx.editMessageText(inboxText, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('🔄 Refresh', 'inbox').row().text('🔙 Kembali', 'back_to_main'),
    });
  });

  bot.callbackQuery('set_custom_email', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    await kv.set(`bot_state:${chatId}`, 'awaiting_custom_email');
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('Silakan ketik prefix email yang Anda inginkan (misal: "budi" untuk budi@domain.com):', {
      reply_markup: new InlineKeyboard().text('❌ Batal', 'cancel_action'),
    });
  });

  bot.callbackQuery('cancel_action', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    await kv.del(`bot_state:${chatId}`);
    await ctx.answerCallbackQuery('Dibatalkan');
    await ctx.editMessageText('Aksi dibatalkan. Pilih menu di bawah ini:', {
      reply_markup: mainMenuKeyboard,
    });
  });

  bot.callbackQuery('back_to_main', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('Pilih menu di bawah ini:', {
      reply_markup: mainMenuKeyboard,
    });
  });

  bot.callbackQuery('admin_maintenance', async (ctx) => {
    if (!adminId || ctx.from?.id.toString() !== adminId) {
      return ctx.answerCallbackQuery('Akses ditolak!');
    }

    const currentMode = await kv.get('settings:maintenance');
    const newMode = currentMode ? null : '1';
    
    if (newMode) {
      await kv.set('settings:maintenance', '1');
    } else {
      await kv.del('settings:maintenance');
    }

    await ctx.answerCallbackQuery(`Maintenance mode ${newMode ? 'ON' : 'OFF'}`);
    await ctx.editMessageText(`Status Maintenance: **${newMode ? 'AKTIF' : 'NONAKTIF'}**`, {
      parse_mode: 'Markdown',
      reply_markup: adminKeyboard,
    });
  });

  bot.callbackQuery('admin_stats', async (ctx) => {
    if (!adminId || ctx.from?.id.toString() !== adminId) {
      return ctx.answerCallbackQuery('Akses ditolak!');
    }

    const keys = await kv.keys('inbox:*');
    const reserved = await kv.smembers('reserved_names');
    const banned = await kv.smembers('banned_ips');

    const stats = `📊 **Statistik Bot & Aplikasi:**\n\n` +
      `• Total Akun/Inbox Aktif: ${keys.length}\n` +
      `• Total Reserved Names: ${reserved.length}\n` +
      `• Total Banned IPs: ${banned.length}\n`;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(stats, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('🔙 Kembali ke Admin', 'back_to_admin'),
    });
  });

  bot.callbackQuery('back_to_admin', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('Panel Admin:', { reply_markup: adminKeyboard });
  });

  cachedBot = bot;
  cachedToken = token;
  return bot;
}
