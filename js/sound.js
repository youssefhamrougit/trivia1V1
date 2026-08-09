// ============================================================================
//  sound.js — tiny synthesized sound effects (no audio files needed)
//
//  The game's sounds (correct chime, wrong buzz, timer tick, times-up) are
//  generated on the fly with the Web Audio API instead of shipping audio
//  files — zero assets, zero extra bytes, works offline.
//
//  Autoplay policy: browsers block audio until the first user gesture, so the
//  AudioContext is created lazily and "unlocked" on the first tap/keypress.
//  The mute preference survives reloads (localStorage "df_muted").
//
//  Usage:
//    Sound.playCorrect() / Sound.playWrong()
//    Sound.playTick()    / Sound.playTimesUp()
//    Sound.toggle()      — flips the mute switch (and repaints the buttons)
//    Sound.isMuted()
// ============================================================================

const Sound = (function () {
  let ctx = null;        // the shared AudioContext
  let master = null;     // master volume gain (mute = 0)
  let muted = false;

  // remember the player's preference
  try { muted = localStorage.getItem("df_muted") === "1"; } catch (e) { /* private mode */ }

  // lazily build the audio graph (must happen inside/after a user gesture)
  function ensure() {
    if (ctx) {
      // iOS Safari suspends the context when idle — wake it (safe to call
      // outside a gesture; it just resolves once the browser allows it)
      if (ctx.state === "suspended") ctx.resume().catch(function () {});
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false; // no Web Audio — stay silent, never error
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    return true;
  }

  // browsers block audio until the first user interaction — unlock then
  function unlock() {
    if (muted) return;
    ensure();
  }
  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("keydown", unlock, { passive: true });

  // play one tone with a quick attack + exponential decay
  function tone(freq, at, dur, type, vol, slideTo) {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // every sound funnels through here: muted or no ctx => silent
  function play(fn) {
    if (muted) return;
    if (!ensure()) return;
    fn();
  }

  return {
    isMuted: function () { return muted; },

    // flip the mute switch, persist it, and repaint the toggle buttons.
    // ensure() runs here, inside the click gesture, so unmuting from a cold
    // start still creates a RUNNING context — otherwise the first sound after
    // unmute could be dropped by the browser's autoplay policy.
    toggle: function () {
      muted = !muted;
      try { localStorage.setItem("df_muted", muted ? "1" : "0"); } catch (e) {}
      if (muted) {
        if (master) master.gain.value = 0;
      } else {
        ensure();
      }
      refreshButtons();
      return muted;
    },

    // right answer: a bright two-note rising chime
    playCorrect: function () {
      play(function () {
        tone(659.25, 0, 0.12, "sine", 0.28);       // E5
        tone(987.77, 0.09, 0.22, "sine", 0.28);    // B5
      });
    },

    // wrong answer: a low, dull double-buzz
    playWrong: function () {
      play(function () {
        tone(174.61, 0, 0.16, "square", 0.16);     // F3
        tone(116.54, 0.12, 0.24, "square", 0.16);  // Bb2
      });
    },

    // the final seconds of the countdown: a short, quiet click
    playTick: function () {
      play(function () {
        tone(1180, 0, 0.045, "square", 0.10);
      });
    },

    // the clock ran out: a quick descending "time's up" tone
    playTimesUp: function () {
      play(function () {
        tone(392, 0, 0.34, "sawtooth", 0.18, 98);  // G4 -> G2
      });
    },
  };
})();

// keep every .sound-toggle button in sync with the current mute state
function refreshButtons() {
  const on = !Sound.isMuted();
  document.querySelectorAll(".sound-toggle").forEach(function (btn) {
    btn.textContent = (on ? "🔊" : "🔇") + " Sound";
    btn.classList.toggle("muted", !on);
    btn.setAttribute("aria-pressed", String(on));
  });
}
// scripts load at the end of <body>, so the buttons already exist; the guard
// covers the odd case where this runs before the DOM is ready anyway
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refreshButtons);
else refreshButtons();
