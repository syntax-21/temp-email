import { Language } from './translations';

export function playNotificationSound(lang: Language = 'id') {
  try {
    if ('speechSynthesis' in window) {
      const text = lang === 'en' ? 'You have a new message!' : 'Ada pesan masuk!';
      const msg = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      
      if (lang === 'en') {
        // Try to find an English voice (US/UK)
        const enVoice = voices.find(voice => voice.lang.startsWith('en-') || voice.lang === 'en');
        if (enVoice) msg.voice = enVoice;
      } else {
        // Try to find an Indonesian voice
        const idVoice = voices.find(voice => voice.lang === 'id-ID' || voice.lang === 'id');
        if (idVoice) msg.voice = idVoice;
      }
      
      msg.rate = 1.0;
      msg.pitch = 1.2;
      
      window.speechSynthesis.speak(msg);
    }
  } catch (error) {
    console.warn("Audio/Speech API not supported or blocked by browser", error);
  }
}
