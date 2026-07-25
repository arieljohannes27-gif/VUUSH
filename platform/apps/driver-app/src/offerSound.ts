/** Driver offer alert — Bolt-style looping chime until stop or timeout. */

let sharedCtx: AudioContext | null = null;
let unlocked = false;
let alertGeneration = 0;
let loopTimer: number | null = null;
let stopAt = 0;

function getCtx(): AudioContext | null {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) sharedCtx = new AC();
  return sharedCtx;
}

/** Call after any user tap so Safari/Chrome allow sound. */
export async function unlockOfferAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
    unlocked = true;
  } catch {
    /* ignore */
  }
}

function tone(
  ctx: AudioContext,
  dest: AudioNode,
  {
    freq,
    start,
    duration,
    peak,
    type = "sine",
  }: {
    freq: number;
    start: number;
    duration: number;
    peak: number;
    type?: OscillatorType;
  },
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  const attack = Math.min(0.035, duration * 0.18);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration - 0.001);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + duration + 0.02);

  if (type === "sine") {
    const harm = ctx.createOscillator();
    const hg = ctx.createGain();
    harm.type = "triangle";
    harm.frequency.setValueAtTime(freq * 2, start);
    hg.gain.setValueAtTime(0.0001, start);
    hg.gain.exponentialRampToValueAtTime(peak * 0.1, start + attack);
    hg.gain.exponentialRampToValueAtTime(0.0001, start + duration - 0.001);
    harm.connect(hg);
    hg.connect(dest);
    harm.start(start);
    harm.stop(start + duration + 0.02);
  }
}

/** One soft ascending motif (~0.9s). */
function playMotif(ctx: AudioContext) {
  const master = ctx.createGain();
  master.gain.value = 0.58;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 4200;
  filter.Q.value = 0.7;
  master.connect(filter);
  filter.connect(ctx.destination);

  const t0 = ctx.currentTime + 0.01;

  tone(ctx, master, {
    freq: 220,
    start: t0,
    duration: 0.7,
    peak: 0.05,
    type: "sine",
  });
  tone(ctx, master, {
    freq: 440,
    start: t0,
    duration: 0.38,
    peak: 0.22,
  });
  tone(ctx, master, {
    freq: 554.37,
    start: t0 + 0.12,
    duration: 0.4,
    peak: 0.2,
  });
  tone(ctx, master, {
    freq: 659.25,
    start: t0 + 0.24,
    duration: 0.48,
    peak: 0.18,
  });
  tone(ctx, master, {
    freq: 880,
    start: t0 + 0.28,
    duration: 0.35,
    peak: 0.045,
    type: "triangle",
  });
}

const LOOP_MS = 1100;
/** Keep ringing like Bolt until accept/decline or this duration. */
export const OFFER_ALERT_MS = 30_000;
const DEFAULT_RING_MS = OFFER_ALERT_MS;

function clearLoop() {
  if (loopTimer != null) {
    window.clearTimeout(loopTimer);
    loopTimer = null;
  }
}

export function stopOfferAlert() {
  alertGeneration += 1;
  clearLoop();
  stopAt = 0;
}

/**
 * Bolt-style: repeat the chime for several seconds (or until stopOfferAlert).
 * Call stopOfferAlert() when the driver accepts or declines.
 */
export async function startOfferAlert(durationMs = DEFAULT_RING_MS) {
  stopOfferAlert();
  const gen = alertGeneration;
  const ctx = getCtx();
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }

  unlocked = true;
  stopAt = Date.now() + durationMs;

  const tick = () => {
    if (gen !== alertGeneration) return;
    if (Date.now() >= stopAt) {
      clearLoop();
      return;
    }
    try {
      playMotif(ctx);
    } catch {
      /* ignore */
    }
    if (navigator.vibrate) {
      navigator.vibrate([50, 40, 50]);
    }
    loopTimer = window.setTimeout(tick, LOOP_MS);
  };

  tick();
  return true;
}

/** @deprecated use startOfferAlert — kept for one-shot tests if needed */
export async function playOfferBeep() {
  return startOfferAlert(DEFAULT_RING_MS);
}

export function isOfferAudioUnlocked() {
  return unlocked;
}

export function isOfferAlertPlaying() {
  return loopTimer != null && Date.now() < stopAt;
}
