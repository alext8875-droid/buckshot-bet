// Web Audio API synthesized sounds — no external files needed

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
  }
  return ctx;
}

function resume(): AudioContext {
  const c = getCtx();
  if (c.state === 'suspended') c.resume();
  return c;
}

function makeNoise(c: AudioContext, duration: number): AudioBufferSourceNode {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

export function playLiveShot() {
  const c = resume();
  const t = c.currentTime;

  const boom = makeNoise(c, 0.6);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1200, t);
  lp.frequency.exponentialRampToValueAtTime(150, t + 0.5);
  const g = c.createGain();
  g.gain.setValueAtTime(4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  boom.connect(lp); lp.connect(g); g.connect(c.destination);
  boom.start(t); boom.stop(t + 0.6);

  // Sharp crack transient
  const crack = makeNoise(c, 0.07);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(2500, t);
  const cg = c.createGain();
  cg.gain.setValueAtTime(1.8, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  crack.connect(hp); hp.connect(cg); cg.connect(c.destination);
  crack.start(t); crack.stop(t + 0.07);
}

export function playBlankShot() {
  const c = resume();
  const t = c.currentTime;
  const n = makeNoise(c, 0.1);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(900, t);
  bp.Q.setValueAtTime(2, t);
  const g = c.createGain();
  g.gain.setValueAtTime(0.7, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  n.connect(bp); bp.connect(g); g.connect(c.destination);
  n.start(t); n.stop(t + 0.1);
}

export function playShellEject() {
  const c = resume();
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1400, t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.22);
  const g = c.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(g); g.connect(c.destination);
  osc.start(t); osc.stop(t + 0.22);
}

export function playMagnifier() {
  const c = resume();
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(900, t);
  osc.frequency.linearRampToValueAtTime(1400, t + 0.12);
  const g = c.createGain();
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(g); g.connect(c.destination);
  osc.start(t); osc.stop(t + 0.2);
}

export function playCigarettes() {
  const c = resume();
  [500, 650, 820].forEach((freq, i) => {
    const t = c.currentTime + i * 0.13;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.18);
  });
}

export function playHandcuffs() {
  const c = resume();
  [0, 0.09].forEach((delay) => {
    const t = c.currentTime + delay;
    const n = makeNoise(c, 0.06);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(4500, t);
    bp.Q.setValueAtTime(10, t);
    const g = c.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    n.connect(bp); bp.connect(g); g.connect(c.destination);
    n.start(t); n.stop(t + 0.06);
  });
}

export function playInverter() {
  const c = resume();
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(500, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.18);
  osc.frequency.exponentialRampToValueAtTime(500, t + 0.36);
  const g = c.createGain();
  g.gain.setValueAtTime(0.22, t);
  g.gain.setValueAtTime(0.22, t + 0.18);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
  osc.connect(g); g.connect(c.destination);
  osc.start(t); osc.stop(t + 0.36);
}

export function playReload() {
  const c = resume();
  [0, 0.13, 0.24].forEach((delay, i) => {
    const t = c.currentTime + delay;
    const n = makeNoise(c, 0.07);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700 - i * 120, t);
    const g = c.createGain();
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    n.connect(lp); lp.connect(g); g.connect(c.destination);
    n.start(t); n.stop(t + 0.07);
  });
}

export function playGameOver(won: boolean) {
  const c = resume();
  const freqs = won ? [350, 440, 550, 700] : [440, 370, 300, 220];
  freqs.forEach((freq, i) => {
    const t = c.currentTime + i * 0.2;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.55);
  });
}

export function playItem(item: string) {
  switch (item) {
    case 'magnifier': playMagnifier(); break;
    case 'cigarettes': playCigarettes(); break;
    case 'handcuffs': playHandcuffs(); break;
    case 'beer': playShellEject(); break;
    case 'inverter': playInverter(); break;
  }
}
