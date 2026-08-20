// ============================================================================
//  music.js — Trivia1v1 ambient background music
//
//  A generative lo-fi ambient engine using Web Audio API. Plays a dreamy
//  chord progression with gentle arpeggios — light enough to never compete
//  with the game sounds. Pauses during matches so the SFX take focus.
//
//  Drop a real .mp3 into assets/sounds/bgm.mp3 to override the generator.
//
//  Usage:
//    Music.start()   — begin playing (call after first user gesture)
//    Music.stop()    — fade out and stop
//    Music.pause()   — pause during a match (fades down)
//    Music.resume()  — resume after match ends (fades back up)
//    Music.toggle()  — flip the music mute switch
//    Music.isPlaying()
// ============================================================================

const Music = (function () {
  let ctx = null;         // shared AudioContext (from Sound)
  let master = null;      // music master gain
  let running = false;
  let paused = false;
  let muted = false;
  let bgmBuffer = null;   // decoded .mp3 if loaded
  let bgmSource = null;   // currently playing buffer source
  let loopTimer = null;   // interval for chord changes
  let currentNodes = [];  // active oscillators (for cleanup)

  // persist mute preference
  try { muted = localStorage.getItem("df_music_muted") === "1"; } catch (e) {}

  // ---- chord progression: Cmaj7 → Am7 → Fmaj7 → G7 -----------------------
  // Each chord is an array of MIDI-derived frequencies. The progression
  // loops every ~16 seconds (4 chords × 4 seconds each).
  const PROGRESSION = [
    // Cmaj7: C4 E4 G4 B4
    [261.63, 329.63, 392.00, 493.88],
    // Am7: A3 C4 E4 G4
    [220.00, 261.63, 329.63, 392.00],
    // Fmaj7: F4 A4 C5 E5
    [349.23, 440.00, 523.25, 659.25],
    // G7: G3 B3 D4 F4
    [196.00, 246.94, 293.66, 349.23],
  ];

  const CHORD_DUR = 4; // seconds per chord
  const ARP_NOTES = [0, 2, 1, 3, 2, 0, 3, 1]; // arpeggio pattern (indices into chord)

  // ---- helpers --------------------------------------------------------------

  function ensure() {
    // try to grab the AudioContext from Sound
    if (typeof Sound !== "undefined" && Sound._ctx) {
      ctx = Sound._ctx;
    }
    // if Sound hasn't been initialized yet, create our own context
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume().catch(function () {});
    return true;
  }

  function createMaster() {
    if (master) return;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.15;
    master.connect(ctx.destination);
  }

  // ---- ambient pad voice ----------------------------------------------------
  // A soft, filtered pad that sustains through each chord

  function playPad(chord, duration) {
    if (!ctx || !master) return;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;
    filter.Q.value = 0.5;
    filter.connect(master);

    const padGain = ctx.createGain();
    padGain.gain.value = 0;
    padGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.5);
    padGain.gain.setValueAtTime(0.08, ctx.currentTime + duration - 1.5);
    padGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    padGain.connect(filter);

    chord.forEach(function (freq, i) {
      // two detuned oscillators per note for warmth
      [0, 7].forEach(function (detune) {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = freq;
        o.detune.value = detune;
        o.connect(padGain);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + duration + 0.1);
        currentNodes.push(o);
      });
    });

    currentNodes.push(padGain, filter);
  }

  // ---- gentle arpeggio ------------------------------------------------------

  function playArpeggio(chord, duration) {
    if (!ctx || !master) return;

    const arpGain = ctx.createGain();
    arpGain.gain.value = 0.04;
    arpGain.connect(master);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2000;
    filter.connect(arpGain);

    const noteLen = duration / ARP_NOTES.length;

    ARP_NOTES.forEach(function (idx, i) {
      const freq = chord[idx] * 2; // one octave up
      const t = ctx.currentTime + i * noteLen;

      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = freq;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + noteLen * 0.9);

      o.connect(g);
      g.connect(filter);
      o.start(t);
      o.stop(t + noteLen + 0.05);

      currentNodes.push(o, g);
    });

    currentNodes.push(arpGain, filter);
  }

  // ---- bass drone -----------------------------------------------------------

  function playBass(chord, duration) {
    if (!ctx || !master) return;

    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.05;
    bassGain.connect(master);

    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = chord[0] / 2; // root, one octave down

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.8);
    g.gain.setValueAtTime(1, ctx.currentTime + duration - 0.8);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    o.connect(g);
    g.connect(bassGain);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + duration + 0.1);

    currentNodes.push(o, g, bassGain);
  }

  // ---- sparkle / texture (random tiny notes) --------------------------------

  function playSparkle(chord, duration) {
    if (!ctx || !master) return;

    const sparkleGain = ctx.createGain();
    sparkleGain.gain.value = 0.025;
    sparkleGain.connect(master);

    // scatter 4–6 random high notes
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const freq = chord[Math.floor(Math.random() * chord.length)] * (2 + Math.floor(Math.random() * 2));
      const t = ctx.currentTime + Math.random() * (duration - 0.3);

      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4 + Math.random() * 0.6);

      o.connect(g);
      g.connect(sparkleGain);
      o.start(t);
      o.stop(t + 1.2);

      currentNodes.push(o, g);
    }

    currentNodes.push(sparkleGain);
  }

  // ---- chord change loop ----------------------------------------------------

  let chordIndex = 0;

  function playChord() {
    if (!running || paused || muted) return;

    const chord = PROGRESSION[chordIndex % PROGRESSION.length];
    chordIndex++;

    // layer everything together
    playPad(chord, CHORD_DUR);
    playBass(chord, CHORD_DUR);

    // start arpeggio slightly delayed for a dreamy feel
    setTimeout(function () {
      if (running && !paused && !muted) playArpeggio(chord, CHORD_DUR - 0.3);
    }, 600);

    // random sparkle texture
    setTimeout(function () {
      if (running && !paused && !muted) playSparkle(chord, CHORD_DUR - 0.5);
    }, 1200);
  }

  // ---- try loading a real .mp3 file -----------------------------------------

  async function tryLoadBGM() {
    try {
      const resp = await fetch("assets/sounds/bgm.mp3", { method: "HEAD" });
      if (!resp.ok) return;
      const fullResp = await fetch("assets/sounds/bgm.mp3");
      const arrayBuf = await fullResp.arrayBuffer();
      bgmBuffer = await ctx.decodeAudioData(arrayBuf);
      console.log("[Music] Loaded bgm.mp3 — using real background music");
    } catch (e) {
      console.log("[Music] No bgm.mp3 found — using generative ambient engine");
    }
  }

  function playBGMFile() {
    if (!bgmBuffer || !ctx || !master) return false;
    bgmSource = ctx.createBufferSource();
    bgmSource.buffer = bgmBuffer;
    bgmSource.loop = true;
    bgmSource.connect(master);
    bgmSource.start();
    return true;
  }

  function stopBGMFile() {
    if (bgmSource) {
      try { bgmSource.stop(); } catch (e) {}
      bgmSource = null;
    }
  }

  // ---- public API -----------------------------------------------------------
  return {
    // expose ctx so Music can share Sound's AudioContext
    _ctx: null,

    start: function () {
      if (running) return;
      if (muted) return;
      if (!ensure()) return;
      createMaster();
      running = true;
      paused = false;

      // try loading a real mp3 first
      tryLoadBGM().then(function () {
        if (!running) return;
        if (bgmBuffer) {
          playBGMFile();
        } else {
          // generative ambient engine
          chordIndex = 0;
          playChord();
          loopTimer = setInterval(playChord, CHORD_DUR * 1000);
        }
      });
    },

    stop: function () {
      running = false;
      paused = false;
      if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
      stopBGMFile();
      // fade out and clean up
      currentNodes.forEach(function (n) {
        try { if (n.stop) n.stop(); } catch (e) {}
        try { n.disconnect(); } catch (e) {}
      });
      currentNodes = [];
    },

    pause: function () {
      if (!running || paused) return;
      paused = true;
      if (bgmBuffer) {
        stopBGMFile();
      } else {
        if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
        // fade out current nodes
        if (master) master.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 1);
      }
    },

    resume: function () {
      if (!running || !paused) return;
      paused = false;
      if (master && ctx) master.gain.linearRampToValueAtTime(muted ? 0 : 0.15, ctx.currentTime + 1);
      if (bgmBuffer) {
        playBGMFile();
      } else {
        playChord();
        loopTimer = setInterval(playChord, CHORD_DUR * 1000);
      }
    },

    toggle: function () {
      muted = !muted;
      try { localStorage.setItem("df_music_muted", muted ? "1" : "0"); } catch (e) {}
      if (muted) {
        this.stop();
      } else {
        this.start();
      }
      refreshMusicButton();
      return muted;
    },

    isPlaying: function () { return running && !paused; },
    isMuted: function () { return muted; },

    setVolume: function (v) {
      v = Math.max(0, Math.min(1, v));
      // mute if volume is 0
      if (v === 0 && !muted) {
        muted = true;
        try { localStorage.setItem("df_music_muted", "1"); } catch (e) {}
        this.stop();
        refreshMusicButton();
        return;
      }
      // unmute if volume > 0
      if (v > 0 && muted) {
        muted = false;
        try { localStorage.setItem("df_music_muted", "0"); } catch (e) {}
        this.start();
      }
      // adjust master gain
      if (master && ctx) {
        master.gain.linearRampToValueAtTime(v * 0.15, ctx.currentTime + 0.1);
      }
      refreshMusicButton();
    },
  };
})();

// ---- music toggle button ----------------------------------------------------

function refreshMusicButton() {
  const btn = document.getElementById("music-toggle");
  if (!btn) return;
  const on = !Music.isMuted();
  btn.textContent = (on ? "🎵" : "🎶") + " Music";
  btn.classList.toggle("muted", !on);
  btn.setAttribute("aria-pressed", String(on));
}
