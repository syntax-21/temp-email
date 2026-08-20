import { kv, isUserAdmin } from './helpers';
import { TelegramUserInfo } from './types';

export async function checkUserStatus(
  chatId: number | string,
  ctxUser?: any,
  fallbackAdminId?: string
): Promise<{ status: 'approved' | 'pending' | 'banned' | 'rejected'; isNew: boolean }> {
  const isAdmin = await isUserAdmin(chatId, fallbackAdminId);
  if (isAdmin) {
    try {
      await kv.set(`bot_user_status:${chatId}`, 'approved');
      await kv.sadd('bot_approved_users', String(chatId));
      await kv.srem('bot_pending_users', String(chatId));
    } catch {}
    return { status: 'approved', isNew: false };
  }

  const approvalMode = (await kv.get('settings:approval_mode')) !== false;
  const existingStatus = (await kv.get(`bot_user_status:${chatId}`)) as string;

  if (existingStatus === 'banned' || existingStatus === 'rejected') {
    return { status: 'banned', isNew: false };
  }

  if (existingStatus === 'approved' || existingStatus === 'pending') {
    return { status: existingStatus as any, isNew: false };
  }

  if (!approvalMode) {
    await kv.set(`bot_user_status:${chatId}`, 'approved');
    await kv.sadd('bot_approved_users', String(chatId));
    await kv.sadd('bot_all_users', String(chatId));
    return { status: 'approved', isNew: false };
  }

  // Brand new user -> set to pending
  const name = ctxUser ? `${ctxUser.first_name || ''} ${ctxUser.last_name || ''}`.trim() || 'Pengguna Telegram' : 'Pengguna Telegram';
  const username = ctxUser?.username || '';

  const userInfo: TelegramUserInfo = {
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

export async function getUserEmails(chatId: number | string): Promise<string[]> {
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

export async function saveUserEmails(chatId: number | string, emails: string[]): Promise<void> {
  await kv.set(`bot_user_emails:${chatId}`, emails);
}

export async function getActiveEmail(chatId: number | string): Promise<string | null> {
  const active = await kv.get(`bot_active_email:${chatId}`);
  if (active && typeof active === 'string') return active;
  const emails = await getUserEmails(chatId);
  if (emails.length > 0) {
    await kv.set(`bot_active_email:${chatId}`, emails[0]);
    return emails[0];
  }
  return null;
}

export async function setActiveEmail(chatId: number | string, email: string): Promise<void> {
  await kv.set(`bot_active_email:${chatId}`, email);
  await kv.sadd(`bot_email_users:${email.toLowerCase()}`, chatId.toString());
}

export async function removeUserEmail(chatId: number | string, email: string): Promise<void> {
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
