import { InlineKeyboard, Keyboard } from 'grammy';

export function getPersistentKeyboard(isAdmin: boolean = false) {
  const kb = new Keyboard()
    .text('📬 Email Saya').text('➕ Buat Email').row()
    .text('📥 Kotak Masuk').text('🌐 Ganti Domain').row();
  
  if (isAdmin) {
    kb.text('🛠 Panel Admin').text('❓ Panduan & Bantuan');
  } else {
    kb.text('❓ Panduan & Bantuan');
  }

  return kb.resized();
}

export function buildDashboardKeyboard(activeEmail: string | null, inboxCount: number) {
  const kb = new InlineKeyboard();

  if (activeEmail) {
    kb.text(`📥 Buka Kotak Masuk (${inboxCount})`, `view_inbox:${activeEmail}`)
      .text('🔄 Refresh', `refresh_dashboard:${activeEmail}`)
      .row();
    kb.text('🎲 Email Acak Baru', 'action_random_email')
      .text('✏️ Kustom Nama', 'action_custom_email')
      .row();
    kb.text('📋 Daftar Email Saya', 'action_list_emails')
      .text('🌐 Ganti Domain', 'action_select_domain')
      .row();
    kb.text('🗑 Hapus Email Ini', `action_delete_email:${activeEmail}`)
      .text('❓ Panduan', 'action_help');
  } else {
    kb.text('➕ Buat Email Sekarang', 'action_random_email').row();
    kb.text('✏️ Buat Nama Kustom', 'action_custom_email')
      .text('🌐 Pilih Domain', 'action_select_domain')
      .row();
    kb.text('❓ Panduan & Bantuan', 'action_help');
  }

  return kb;
}
