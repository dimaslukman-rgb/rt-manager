// Emergency Siren & Panic Alarm Audio Synthesizer
// Works reliably across browsers and mobile webviews without needing external MP3 asset files

let audioCtx: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let sirenInterval: any = null;
let sirenActive = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function startEmergencySiren() {
  if (sirenActive) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    sirenActive = true;
    oscillator = ctx.createOscillator();
    gainNode = ctx.createGain();

    oscillator.type = 'sawtooth';
    gainNode.gain.setValueAtTime(0.25, ctx.currentTime);

    let high = false;
    oscillator.frequency.setValueAtTime(750, ctx.currentTime);

    sirenInterval = setInterval(() => {
      if (!ctx || !oscillator) return;
      const targetFreq = high ? 750 : 1200;
      high = !high;
      oscillator.frequency.cancelScheduledValues(ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(targetFreq, ctx.currentTime + 0.35);
    }, 400);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
  } catch (e) {
    console.warn('Could not start emergency siren audio:', e);
  }
}

export function stopEmergencySiren() {
  sirenActive = false;
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
  if (oscillator) {
    try {
      oscillator.stop();
      oscillator.disconnect();
    } catch {}
    oscillator = null;
  }
  if (gainNode) {
    try {
      gainNode.disconnect();
    } catch {}
    gainNode = null;
  }
}

export function isSirenPlaying(): boolean {
  return sirenActive;
}

export function playPanicAlertBeep() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.warn('Could not play beep:', e);
  }
}
