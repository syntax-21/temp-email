export type Language = 'id' | 'en';

export const translations = {
  id: {
    welcomeTitle: "Selamat Datang di TMail",
    welcomeDesc: "TMail (Temporary Mail) adalah layanan penyedia alamat email sementara gratis. Gunakan alamat email di bawah ini untuk mendaftar ke situs web, forum, atau aplikasi yang tidak Anda percayai guna menjaga kotak masuk utama Anda tetap bersih dari pesan spam.",
    yourEmail: "Alamat Email Sementara Anda",
    typeCustomName: "ketik_nama_bebas",
    copied: "Tersalin!",
    copy: "Copy",
    randomize: "Randomize Name",
    refresh: "Refresh",
    inbox: "Kotak Masuk",
    emptyInbox: "Belum ada pesan masuk.",
    autoRefreshHint: "Sistem menyegarkan otomatis setiap 10 detik.",
    from: "Dari",
    to: "Kepada",
    subject: "Subjek",
    date: "Tanggal",
    close: "Tutup",
    accessQrTitle: "Akses Kembali Email Ini",
    accessQrDesc: "Pindai QR code ini di perangkat lain untuk membuka kotak masuk",
    history: "Riwayat",
    lockInbox: "Kunci Pesan",
    enterPin: "Masukkan PIN",
    createPin: "Buat PIN (4 Angka)",
    pinSaved: "PIN Tersimpan!",
    wrongPin: "PIN Salah!",
    unlock: "Buka",
    lockedDesc: "Kotak masuk ini dilindungi oleh PIN. Masukkan PIN yang benar untuk melihat isi pesan."
  },
  en: {
    welcomeTitle: "Welcome to TMail",
    welcomeDesc: "TMail (Temporary Mail) is a free temporary email service. Use the email address below to sign up for websites, forums, or untrusted apps to keep your main inbox clean from spam.",
    yourEmail: "Your Temporary Email Address",
    typeCustomName: "type_custom_name",
    copied: "Copied!",
    copy: "Copy",
    randomize: "Randomize Name",
    refresh: "Refresh",
    inbox: "Inbox",
    emptyInbox: "No messages yet.",
    autoRefreshHint: "System automatically refreshes every 10 seconds.",
    from: "From",
    to: "To",
    subject: "Subject",
    date: "Date",
    close: "Close",
    accessQrTitle: "Access This Email Again",
    accessQrDesc: "Scan this QR code on another device to open the inbox",
    history: "History",
    lockInbox: "Lock Inbox",
    enterPin: "Enter PIN",
    createPin: "Create PIN (4 Digits)",
    pinSaved: "PIN Saved!",
    wrongPin: "Wrong PIN!",
    unlock: "Unlock",
    lockedDesc: "This inbox is protected by a PIN. Enter the correct PIN to view your messages."
  }
};

export function t(lang: Language, key: keyof typeof translations.id) {
  return translations[lang][key] || translations.id[key];
}
