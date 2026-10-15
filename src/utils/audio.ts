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

// Think-music motif: [frequency Hz, duration s, start offset s]. Loops every THINK_LOOP_SECONDS.
const THINK_NOTES: ReadonlyArray<readonly [number, number, number]> = [
  [261.63, 0.35, 0.0],
  [349.23, 0.35, 0.35],
  [261.63, 0.35, 0.7],
  [174.61, 0.35, 1.05],
  [261.63, 0.35, 1.4],
  [349.23, 0.35, 1.75],
  [261.63, 0.7, 2.1],
  [261.63, 0.35, 2.9],
  [349.23, 0.35, 3.25],
  [440.0, 0.35, 3.6],
  [392.0, 0.35, 3.95],
  [349.23, 0.35, 4.3],
  [329.63, 0.35, 4.65],
  [293.66, 0.7, 5.0],
];
const THINK_LOOP_SECONDS = 6;
const THINK_VOLUME = 0.18;

let thinkTimer: ReturnType<typeof setTimeout> | null = null;
let thinkGain: GainNode | null = null;
let thinkOscillators: OscillatorNode[] = [];

function scheduleThinkMotif(): void {
  const ctx = getAudioContext();
  if (!thinkGain) return;
  const now = ctx.currentTime;
  const master = thinkGain;

  thinkOscillators = thinkOscillators.filter((o) => o.context.currentTime < now + 7);
  THINK_NOTES.forEach(([freq, dur, delay]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(THINK_VOLUME, now + delay + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now + delay);
    osc.stop(now + delay + dur);
    thinkOscillators.push(osc);
  });

  thinkTimer = setTimeout(scheduleThinkMotif, THINK_LOOP_SECONDS * 1000);
}

/** Loops the think music in the background until stopThinkMusic() is called. Safe to call twice. */
export function startThinkMusic(): void {
  if (thinkTimer !== null) return;
  try {
    const ctx = getAudioContext();
    thinkGain = ctx.createGain();
    thinkGain.gain.value = 1;
    thinkGain.connect(ctx.destination);
    scheduleThinkMotif();
  } catch (err) {
    console.warn('Audio playback error', err);
  }
}

export function stopThinkMusic(): void {
  if (thinkTimer !== null) {
    clearTimeout(thinkTimer);
    thinkTimer = null;
  }
  const master = thinkGain;
  thinkGain = null;
  if (!master) return;
  try {
    const ctx = getAudioContext();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
    thinkOscillators.forEach((osc) => {
      try {
        osc.stop(ctx.currentTime + 0.12);
      } catch {
        // already stopped
      }
    });
    thinkOscillators = [];
    setTimeout(() => master.disconnect(), 200);
  } catch {
    master.disconnect();
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

/** One-shot preview of the think music (soundboard button). Does nothing if it is already looping. */
export function playThinkMusic(): void {
  if (thinkTimer !== null) return;
  startThinkMusic();
  setTimeout(stopThinkMusic, (THINK_LOOP_SECONDS - 0.2) * 1000);
}
