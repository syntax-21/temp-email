import { Bot } from 'grammy';
import { registerUserHandlers } from './handlers/user';
import { registerAdminHandlers } from './handlers/admin';

let cachedBot: Bot | null = null;
let cachedToken: string | null = null;

export function getBot(token: string, adminId: string, configuredDomain: string): Bot {
  if (cachedBot && cachedToken === token) {
    return cachedBot;
  }

  const bot = new Bot(token);

  // Global Error Handler
  bot.catch((err) => {
    console.error(`Grammy bot error on update ${err.ctx.update.update_id}:`, err.error);
  });

  // Register Handlers
  registerUserHandlers(bot, adminId, configuredDomain);
  registerAdminHandlers(bot, adminId, configuredDomain);

  cachedBot = bot;
  cachedToken = token;
  return bot;
}

// Re-export modules for clean import across the project
export * from './types';
export * from './helpers';
export * from './storage';
export * from './keyboards';
export * from './views/user';
export * from './views/admin';
