/**
 * Web Audio gentle two-note chime synthesizer for Barista KDS.
 * Reuses a shared AudioContext instance and increments window.__chimeCount for deterministic verification.
 */

let sharedAudioCtx = null;
let autoUnlockBound = false;

function getOrCreateAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

export function getChimeAudioState() {
  return sharedAudioCtx ? sharedAudioCtx.state : "uninitialized";
}

export async function unlockChimeAudio() {
  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended" && typeof ctx.resume === "function") {
      await ctx.resume();
    }
    return ctx.state === "running";
  } catch (_err) {
    return false;
  }
}

export function bindChimeAutoUnlock() {
  if (typeof window === "undefined" || autoUnlockBound) return;
  autoUnlockBound = true;
  const handleGesture = () => {
    unlockChimeAudio().then((running) => {
      if (running) {
        window.removeEventListener("pointerdown", handleGesture, true);
        window.removeEventListener("keydown", handleGesture, true);
      }
    });
  };
  window.addEventListener("pointerdown", handleGesture, true);
  window.addEventListener("keydown", handleGesture, true);
}

function scheduleNotes(ctx) {
  const now = ctx.currentTime;
  const notes = [523.25, 659.25]; // C5 -> E5 warm chime
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + idx * 0.14);

    gain.gain.setValueAtTime(0.001, now + idx * 0.14);
    gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.14 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.14);
    osc.stop(now + idx * 0.14 + 0.46);
  });
  if (typeof window !== "undefined") {
    window.__chimeSynthSuccessCount = (window.__chimeSynthSuccessCount || 0) + 1;
  }
}

export function playGentleChime() {
  if (typeof window !== "undefined") {
    window.__chimeCount = (window.__chimeCount || 0) + 1;
  }
  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended" && typeof ctx.resume === "function") {
      ctx.resume().catch(() => {});
    }
    scheduleNotes(ctx);
    return true;
  } catch (_err) {
    return false;
  }
}
