// ============================================================================
//  sound.js — Trivia1v1 sound engine
//
//  Two modes:
//    1. AUDIO FILES (preferred): Load .mp3/.ogg from assets/sounds/
//    2. SYNTHESIS FALLBACK: Rich Web Audio synthesis if files aren't found
//
//  Autoplay policy: browsers block audio until the first user gesture, so
//  the AudioContext is created lazily and "unlocked" on the first tap/keypress.
//  The mute preference survives reloads (localStorage "df_muted").
//
//  Usage:
//    Sound.playCorrect() / Sound.playWrong()
//    Sound.playTick()    / Sound.playTimesUp()
//    Sound.playMatchFound() / Sound.playVictory() / Sound.playDefeat()
//    Sound.toggle()      — flips the mute switch
//    Sound.isMuted()
// ============================================================================

const Sound = (function () {
  let ctx = null;        // the shared AudioContext
  let master = null;     // master volume gain (mute = 0)
  let muted = false;
  let useFiles = false;  // true if audio files loaded successfully
  let audioBuffers = {}; // decoded AudioBuffers for file mode

  // remember the player's preference
  try { muted = localStorage.getItem("df_muted") === "1"; } catch (e) { /* private mode */ }

  // ---- Audio file loading ---------------------------------------------------
  // We try to load short .mp3 files from assets/sounds/. If the files don't
  // exist (404), we silently fall back to synthesis.

  const SOUND_FILES = {
    correct:    "assets/sounds/correct.mp3",
    wrong:      "assets/sounds/wrong.mp3",
    tick:       "assets/sounds/tick.mp3",
    timesup:    "assets/sounds/timesup.mp3",
    matchFound: "assets/sounds/match-found.mp3",
    victory:    "assets/sounds/victory.mp3",
    defeat:     "assets/sounds/defeat.mp3",
  };

  async function loadAudioFiles() {
    if (!ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    let loaded = 0;
    const total = Object.keys(SOUND_FILES).length;

    for (const [name, url] of Object.entries(SOUND_FILES)) {
      try {
        const resp = await fetch(url, { method: "HEAD" });
        if (!resp.ok) continue; // file doesn't exist, skip
        const fullResp = await fetch(url);
        const arrayBuf = await fullResp.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuf);
        audioBuffers[name] = decoded;
        loaded++;
      } catch (e) {
        // skip this file
      }
    }

    useFiles = loaded > 0;
    if (useFiles) {
      console.log("[Sound] Loaded " + loaded + "/" + total + " audio files — using real sounds");
    } else {
      console.log("[Sound] No audio files found — using synthesis engine");
    }
  }

  function playBuffer(name) {
    if (!ctx || !master || !audioBuffers[name]) return false;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffers[name];
    source.connect(master);
    source.start(ctx.currentTime);
    return true;
  }

  // ---- lazily build the audio graph -----------------------------------------
  function ensure() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume().catch(function () {});
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    // try loading audio files in the background
    loadAudioFiles();
    return true;
  }

  // browsers block audio until the first user interaction — unlock then
  function unlock() {
    if (muted) return;
    ensure();
  }
  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("keydown", unlock, { passive: true });

  // ---- Enhanced synthesis engine --------------------------------------------
  // Much richer sounds using noise, filters, multiple oscillators, and
  // proper ADSR envelopes.

  // play one oscillator with envelope
  function osc(freq, start, dur, type, vol, slideTo, detune) {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    if (detune) o.detune.setValueAtTime(detune, t0);
    // ADSR envelope
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);           // attack
    g.gain.linearRampToValueAtTime(vol * 0.7, t0 + dur * 0.3); // decay
    g.gain.setValueAtTime(vol * 0.7, t0 + dur * 0.7);          // sustain
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);     // release
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  // white noise burst (for harsh sounds)
  function noise(start, dur, vol, filterFreq, filterQ) {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + start;
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFreq || 2000, t0);
    if (filterQ) filter.Q.setValueAtTime(filterQ, t0);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // chord helper — play multiple oscillators at once
  function chord(freqs, start, dur, type, vol) {
    freqs.forEach(function (f, i) {
      osc(f, start, dur, type, vol / freqs.length, null, i * 3); // slight detune for warmth
    });
  }

  // ---- sound definitions (synthesis) ----------------------------------------

  const synth = {
    // bright, satisfying two-note chime with harmonics
    correct: function () {
      chord([523.25, 659.25, 783.99], 0, 0.15, "sine", 0.18);     // C5+E5+G5 triad
      chord([1046.5, 1318.5], 0.08, 0.25, "sine", 0.14);           // C6+E6 octave up
      osc(523.25, 0, 0.4, "triangle", 0.08, 1046.5);               // rising body
      noise(0, 0.06, 0.04, 4000, 1);                                // crisp attack transient
    },

    // harsh buzzer with noise
    wrong: function () {
      osc(110, 0, 0.35, "sawtooth", 0.14, 80);                     // low descending buzz
      osc(115, 0.02, 0.3, "square", 0.08, 75);                     // detuned second voice
      noise(0, 0.2, 0.06, 800, 2);                                  // gritty noise layer
      noise(0.15, 0.15, 0.04, 400, 3);                              // tail noise
    },

    // subtle tick for countdown
    tick: function () {
      osc(1200, 0, 0.035, "square", 0.08);
      osc(800, 0, 0.025, "sine", 0.06);
      noise(0, 0.02, 0.03, 3000, 1);                               // click transient
    },

    // dramatic descending "time's up"
    timesup: function () {
      osc(440, 0, 0.5, "sawtooth", 0.12, 65);                      // A3 -> G1 big fall
      osc(430, 0, 0.45, "square", 0.06, 70);                       // detuned layer
      noise(0, 0.15, 0.05, 1500, 2);                               // harsh onset
      chord([220, 165, 110], 0.25, 0.35, "sine", 0.06);            // low rumble tail
    },

    // exciting "match found" notification
    matchFound: function () {
      chord([523.25, 659.25], 0, 0.1, "sine", 0.16);               // C5+E5
      chord([783.99, 1046.5], 0.1, 0.15, "sine", 0.18);            // G5+C6
      chord([1046.5, 1318.5, 1567.98], 0.2, 0.3, "sine", 0.14);   // C6+E6+G6
      osc(523.25, 0, 0.5, "triangle", 0.06, 1567.98);              // rising sweep
      noise(0, 0.04, 0.03, 5000, 1);                               // sparkle
    },

    // victory fanfare — triumphant ascending chords
    victory: function () {
      chord([392, 493.88, 587.33], 0, 0.2, "sine", 0.14);         // G4+B4+D5
      chord([523.25, 659.25, 783.99], 0.2, 0.2, "sine", 0.16);    // C5+E5+G5
      chord([659.25, 783.99, 987.77], 0.4, 0.2, "sine", 0.18);    // E5+G5+B5
      chord([783.99, 987.77, 1174.66], 0.6, 0.5, "sine", 0.2);    // G5+B5+D6
      chord([1046.5, 1318.5, 1567.98], 0.8, 0.6, "sine", 0.16);   // C6+E6+G6 final
      osc(392, 0, 1.0, "triangle", 0.05, 1567.98);                 // long rise sweep
      noise(0, 0.05, 0.03, 6000, 1);                               // sparkle burst
      noise(0.6, 0.05, 0.03, 6000, 1);                             // sparkle at climax
    },

    // defeat — descending minor chord, sad
    defeat: function () {
      chord([440, 523.25, 622.25], 0, 0.3, "sine", 0.12);         // A4+C5+Eb5 (A minor)
      chord([392, 466.16, 587.33], 0.3, 0.3, "sine", 0.1);        // G4+Bb4+D5
      chord([329.63, 392, 493.88], 0.6, 0.4, "sine", 0.08);       // E4+G4+B4
      chord([261.63, 329.63, 392], 1.0, 0.6, "sine", 0.06);       // C4+E4+G4 fade
      osc(440, 0, 1.2, "triangle", 0.04, 196);                     // slow descend
      noise(0.9, 0.2, 0.03, 600, 2);                               // soft noise tail
    },
  };

  // ---- play helper ----------------------------------------------------------
  function play(name) {
    if (muted) return;
    if (!ensure()) return;
    // try file first, then synthesis
    if (useFiles && playBuffer(name)) return;
    if (synth[name]) synth[name]();
  }

  // ---- public API -----------------------------------------------------------
  return {
    isMuted: function () { return muted; },

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

    playCorrect:    function () { play("correct"); },
    playWrong:      function () { play("wrong"); },
    playTick:       function () { play("tick"); },
    playTimesUp:    function () { play("timesup"); },
    playMatchFound: function () { play("matchFound"); },
    playVictory:    function () { play("victory"); },
    playDefeat:     function () { play("defeat"); },
  };
})();

// keep every .sound-toggle button in sync with the current mute state
function refreshButtons() {
  const on = !Sound.isMuted();
  document.querySelectorAll(".sound-toggle").forEach(function (btn) {
    btn.textContent = (on ? "\uD83D\uDD0A" : "\uD83D\uDD07") + " Sound";
    btn.classList.toggle("muted", !on);
    btn.setAttribute("aria-pressed", String(on));
  });
  if (typeof refreshMusicButton === "function") refreshMusicButton();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refreshButtons);
else refreshButtons();
