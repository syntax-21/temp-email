import { createClient } from '@vercel/kv';
import { HUMAN_NAMES } from '@/utils/names';

export const kv = createClient({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
});

export const DEFAULT_DOMAINS = [
  'breonline.biz.id',
  'breonline.my.id',
  'brepremiumstore.my.id',
  'brepremiumstore.store'
];

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

export async function getSystemDomains(fallbackDomain?: string): Promise<string[]> {
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

export function getRandomPrefix(): string {
  const randomName = HUMAN_NAMES[Math.floor(Math.random() * HUMAN_NAMES.length)];
  const randomSuffix = Math.floor(Math.random() * 8999 + 1000);
  return `${randomName.toLowerCase()}${randomSuffix}`;
}

export async function isUserAdmin(chatId: number | string, fallbackAdminId?: string): Promise<boolean> {
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
