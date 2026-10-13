/**
 * Web Audio API synthesizer for instant zero-latency game sound effects.
 * No external audio files needed - runs natively in all browsers.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playThinkMusic(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Jeopardy think motif notes (frequencies in Hz)
    // C4, F4, C4, F3, C4, F4, C4
    const notes = [
      { freq: 261.63, dur: 0.35, delay: 0.0 },
      { freq: 349.23, dur: 0.35, delay: 0.35 },
      { freq: 261.63, dur: 0.35, delay: 0.70 },
      { freq: 174.61, dur: 0.35, delay: 1.05 },
      { freq: 261.63, dur: 0.35, delay: 1.40 },
      { freq: 349.23, dur: 0.35, delay: 1.75 },
      { freq: 261.63, dur: 0.70, delay: 2.10 },
      // Second phrase
      { freq: 261.63, dur: 0.35, delay: 2.90 },
      { freq: 349.23, dur: 0.35, delay: 3.25 },
      { freq: 440.00, dur: 0.35, delay: 3.60 },
      { freq: 392.00, dur: 0.35, delay: 3.95 },
      { freq: 349.23, dur: 0.35, delay: 4.30 },
      { freq: 329.63, dur: 0.35, delay: 4.65 },
      { freq: 293.66, dur: 0.70, delay: 5.00 },
    ];

    notes.forEach(({ freq, dur, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);
      
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.18, now + delay + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + dur);
    });
  } catch (err) {
    console.warn('Audio playback error', err);
  }
}

export function playWrongBuzzer(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Two low dissonant sawtooth waves
    [130.81, 123.47].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 0.8, now + 0.6);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.65);
    });
  } catch (err) {
    console.warn('Audio error', err);
  }
}

export function playBuzzerSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.25);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch (err) {
    console.warn('Audio error', err);
  }
}

export function playAirHorn(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const blasts = [0.0, 0.15, 0.35];
    const freqs = [370, 466.16]; // F#4 and A#4 chord for classic stadium horn

    blasts.forEach((blastOffset) => {
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + blastOffset);
        osc.frequency.linearRampToValueAtTime(freq * 1.05, now + blastOffset + 0.12);

        gain.gain.setValueAtTime(0.2, now + blastOffset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + blastOffset + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + blastOffset);
        osc.stop(now + blastOffset + 0.13);
      });
    });
  } catch (err) {
    console.warn('Audio error', err);
  }
}

export function playApplause(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Fanfare chords + noise claps
    const chords = [
      { f: 523.25, t: 0.0 }, // C5
      { f: 659.25, t: 0.0 }, // E5
      { f: 783.99, t: 0.0 }, // G5
      { f: 1046.50, t: 0.2 }, // C6
    ];

    chords.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + t);

      gain.gain.setValueAtTime(0.2, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + t);
      osc.stop(now + t + 0.75);
    });
  } catch (err) {
    console.warn('Audio error', err);
  }
}

export function playDailyDouble(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const notes = [
      { f: 440, t: 0.0 },
      { f: 554.37, t: 0.12 },
      { f: 659.25, t: 0.24 },
      { f: 880, t: 0.36 },
    ];

    notes.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + t);

      gain.gain.setValueAtTime(0.25, now + t);
      gain.gain.exponentialRampToValueAtTime(0.01, now + t + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + t);
      osc.stop(now + t + 0.55);
    });
  } catch (err) {
    console.warn('Audio error', err);
  }
}
