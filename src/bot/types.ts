export interface TelegramUserInfo {
  id: string;
  name: string;
  username: string;
  status?: 'approved' | 'pending' | 'banned' | 'rejected';
  requestedAt?: string;
  createdAt?: string;
  notes?: string;
}

export interface EmailMessage {
  id: string;
  from: string;
  fromName?: string;
  subject?: string;
  text?: string;
  html?: string;
  receivedAt?: string;
}
