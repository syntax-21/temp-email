// This utility uses the native Web Speech API to announce new emails
// without needing any external MP3 files.

export function playNotificationSound() {
  try {
    // 1. Optional small "Ting" sound as a prefix (uncomment if you want a bell before the voice)
    /*
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
    */

    // 2. Text-to-Speech (Voice Notification)
    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance('Ada pesan masuk!');
      
      // Try to find an Indonesian voice if available
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(voice => voice.lang === 'id-ID');
      if (idVoice) {
        msg.voice = idVoice;
      }
      
      msg.rate = 1.0; // Normal speed
      msg.pitch = 1.2; // Slightly higher pitch for a friendly tone
      
      window.speechSynthesis.speak(msg);
    }
  } catch (error) {
    console.warn("Audio/Speech API not supported or blocked by browser", error);
  }
}
