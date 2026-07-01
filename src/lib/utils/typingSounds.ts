/**
 * Typing sound effects, synthesized with the Web Audio API (no audio assets).
 *
 * Each theme maps a key kind (char / space / enter / backspace) to a short
 * synthesized hit built from two primitives: a filtered noise burst and a
 * decaying tone. Pitch and volume are lightly randomized per keystroke so
 * repeated keys sound organic rather than machine-gun identical.
 */

export const TYPING_SOUND_THEMES = [
  { id: "off", label: "Off" },
  { id: "typewriter", label: "Typewriter" },
  { id: "mechanical", label: "Mechanical keyboard" },
  { id: "soft", label: "Soft taps" },
  { id: "bubble", label: "Bubble pops" },
] as const;

export type TypingSoundTheme = (typeof TYPING_SOUND_THEMES)[number]["id"];

export const TYPING_SOUND_IDS = TYPING_SOUND_THEMES.map((t) => t.id);

type KeyKind = "char" | "space" | "enter" | "backspace";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let lastPlay = 0;

/** Minimum gap between hits — keeps held-key repeat from stacking up. */
const THROTTLE_MS = 24;

function ensureCtx(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.2), ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** value * (1 ± spread/2), for organic per-keystroke variation. */
function vary(value: number, spread: number): number {
  return value * (1 + (Math.random() - 0.5) * spread);
}

interface NoiseOpts {
  gain: number;
  decay: number;
  filter: BiquadFilterType;
  freq: number;
  q?: number;
  delay?: number;
}

function noiseBurst(o: NoiseOpts): void {
  if (!ctx || !master || !noiseBuf) return;
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = o.filter;
  filter.frequency.value = o.freq;
  filter.Q.value = o.q ?? 0.8;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(o.gain, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + o.decay);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
  src.stop(t0 + o.decay + 0.02);
}

interface ToneOpts {
  type: OscillatorType;
  from: number;
  to?: number;
  gain: number;
  decay: number;
  delay?: number;
}

function tone(o: ToneOpts): void {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.from, t0);
  if (o.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + o.decay);
  }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(o.gain, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + o.decay);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + o.decay + 0.02);
}

// --- Themes -------------------------------------------------------------------

function typewriter(kind: KeyKind): void {
  switch (kind) {
    case "char":
      // Typebar strike: sharp metallic snap.
      noiseBurst({ gain: vary(0.5, 0.5), decay: 0.035, filter: "highpass", freq: vary(2600, 0.3) });
      tone({ type: "triangle", from: vary(2300, 0.25), gain: 0.1, decay: 0.02 });
      break;
    case "space":
      // Spacebar: duller wooden thunk.
      noiseBurst({ gain: vary(0.55, 0.4), decay: 0.05, filter: "lowpass", freq: vary(750, 0.25) });
      break;
    case "backspace":
      noiseBurst({ gain: vary(0.4, 0.4), decay: 0.04, filter: "bandpass", freq: vary(1400, 0.25), q: 1.2 });
      break;
    case "enter":
      // Carriage return: thunk then the bell.
      noiseBurst({ gain: 0.6, decay: 0.06, filter: "lowpass", freq: 450 });
      tone({ type: "sine", from: 1570, gain: 0.22, decay: 0.55, delay: 0.05 });
      tone({ type: "sine", from: 3140, gain: 0.06, decay: 0.35, delay: 0.05 });
      break;
  }
}

function mechanical(kind: KeyKind): void {
  const deep = kind === "space" || kind === "enter";
  // Thock: rounded noise plus a low body knock.
  noiseBurst({
    gain: vary(deep ? 0.5 : 0.4, 0.4),
    decay: deep ? 0.05 : 0.04,
    filter: "lowpass",
    freq: vary(deep ? 850 : 1250, 0.25),
  });
  tone({
    type: "sine",
    from: vary(deep ? 95 : 150, 0.2),
    gain: deep ? 0.3 : 0.22,
    decay: 0.05,
  });
}

function soft(kind: KeyKind): void {
  noiseBurst({
    gain: vary(kind === "enter" ? 0.24 : 0.16, 0.4),
    decay: 0.05,
    filter: "lowpass",
    freq: vary(520, 0.3),
  });
}

function bubble(kind: KeyKind): void {
  const base = kind === "enter" ? 760 : kind === "space" ? 420 : 560;
  tone({
    type: "sine",
    from: vary(base, 0.25),
    to: 120,
    gain: vary(0.28, 0.3),
    decay: kind === "enter" ? 0.11 : 0.07,
  });
}

const THEME_FNS: Record<Exclude<TypingSoundTheme, "off">, (kind: KeyKind) => void> = {
  typewriter,
  mechanical,
  soft,
  bubble,
};

// --- Public API -----------------------------------------------------------------

function keyKindOf(e: KeyboardEvent): KeyKind | null {
  if (e.repeat) return null; // holding a key plays once, not per repeat
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === "Enter") return "enter";
  if (e.key === "Backspace" || e.key === "Delete") return "backspace";
  if (e.key === " ") return "space";
  if (e.key.length === 1) return "char";
  return null;
}

/** Play the keystroke sound for `e` under `theme`. Cheap no-op when off. */
export function playTypingSound(theme: TypingSoundTheme, e: KeyboardEvent): void {
  if (theme === "off") return;
  const kind = keyKindOf(e);
  if (!kind) return;
  const now = Date.now();
  if (now - lastPlay < THROTTLE_MS) return;
  lastPlay = now;
  if (!ensureCtx()) return;
  THEME_FNS[theme](kind);
}

/** A short demo riff so the theme can be auditioned from Settings. */
export function previewTypingSound(theme: TypingSoundTheme): void {
  if (theme === "off" || !ensureCtx()) return;
  const fn = THEME_FNS[theme];
  const steps: Array<[KeyKind, number]> = [
    ["char", 0],
    ["char", 110],
    ["char", 220],
    ["space", 340],
    ["char", 460],
    ["enter", 600],
  ];
  for (const [kind, delay] of steps) {
    setTimeout(() => fn(kind), delay);
  }
}
