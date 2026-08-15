// ============================================================================
//  arenaViewer.js — the arena browser, indie Undertale style.
//
//  Opens on the "Arenas" screen: a horizontally scrollable stage where each
//  of the 7 arenas is a hand-built HTML/SVG island scene — dark, warm, and
//  a little alive. Every arena has its own sky, background silhouette,
//  island details and a centerpiece; props bob, flames flicker, eyes blink,
//  dust floats up like determination. Pure DOM + CSS: no WebGL, no model
//  files, works offline and scrolls natively on every device (swipe, wheel,
//  trackpad).
//
//  Uses the global `ARENAS` array from arenas.js (names, icons, trophy
//  thresholds and color themes).
// ============================================================================

let _track = null;   // the scrollable stage track
let _current = 0;    // the arena currently centered in the stage
let _scrollRaf = 0;

// ---- tiny pieces shared by every scene ---------------------------------------

// the floating island every arena sits on (dark void + platform + accent rim)
function _islandSVG(c1, c2) {
  return (
    '<ellipse cx="210" cy="260" rx="182" ry="48" fill="#221f28"/>' +
    '<ellipse cx="210" cy="248" rx="160" ry="34" fill="' + c2 + '"/>' +
    '<ellipse cx="210" cy="243" rx="118" ry="20" fill="' + c1 + '" opacity="0.16"/>' +
    '<ellipse cx="210" cy="248" rx="160" ry="34" fill="none" stroke="' + c1 + '" stroke-width="4" opacity="0.9"/>'
  );
}

// a moon for the sky (with a couple of craters)
function _moonSVG(cx, cy, r, color) {
  return (
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color + '"/>' +
    '<circle cx="' + (cx - r * 0.3) + '" cy="' + (cy - r * 0.25) + '" r="' + r * 0.16 + '" fill="#0b0a09" opacity="0.35"/>' +
    '<circle cx="' + (cx + r * 0.25) + '" cy="' + (cy + r * 0.3) + '" r="' + r * 0.11 + '" fill="#0b0a09" opacity="0.35"/>'
  );
}

// a slow drifting cloud
function _cloudSVG(cx, cy, s, delay) {
  return (
    '<g class="a-drift" style="animation-delay:' + delay + 's">' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + 26 * s + '" ry="' + 9 * s + '" fill="#15121c" opacity="0.9"/>' +
      '<ellipse cx="' + (cx + 14 * s) + '" cy="' + (cy - 6 * s) + '" rx="' + 15 * s + '" ry="' + 8 * s + '" fill="#15121c" opacity="0.9"/>' +
    '</g>'
  );
}

// a sign showing the arena's name — each theme gets its own look, and the
// scene is readable at a glance (pixel font is loaded with the page)
function _bannerSVG(text, bg, stroke, color, bolt) {
  return (
    '<g>' +
      '<rect x="70" y="34" width="280" height="36" rx="8" fill="' + bg + '" stroke="' + stroke + '" stroke-width="3"/>' +
      '<circle cx="80" cy="44" r="2.5" fill="' + bolt + '"/>' +
      '<circle cx="340" cy="44" r="2.5" fill="' + bolt + '"/>' +
      '<circle cx="80" cy="60" r="2.5" fill="' + bolt + '"/>' +
      '<circle cx="340" cy="60" r="2.5" fill="' + bolt + '"/>' +
      '<text x="210" y="57" text-anchor="middle" font-family="\'Press Start 2P\', monospace" font-size="13" fill="' + color + '">' + text + '</text>' +
    '</g>'
  );
}

// a few swaying grass tufts
function _grassSVG(x, y, s, delay) {
  return (
    '<g class="a-sway" style="animation-delay:' + delay + 's">' +
      '<path d="M' + x + ' ' + y + ' q' + (4 * s) + ' -' + (8 * s) + ' 0 -' + (16 * s) +
      ' M' + (x + 5 * s) + ' ' + y + ' q' + (3 * s) + ' -' + (6 * s) + ' ' + (7 * s) + ' -' + (12 * s) + '" ' +
      'stroke="#3f5a4a" stroke-width="' + (2.5 * s) + '" fill="none" stroke-linecap="round"/>' +
    '</g>'
  );
}

// a glowing flask of bubbling liquid (Science Lab)
function _flask(cx, cy, delay) {
  return (
    '<g class="a-bob" style="animation-delay:' + delay + 's">' +
      '<rect x="' + (cx - 6) + '" y="' + (cy - 26) + '" width="12" height="24" rx="4" fill="#b8e8dc" opacity="0.45"/>' +
      '<circle cx="' + cx + '" cy="' + (cy + 6) + '" r="20" fill="#b8e8dc" opacity="0.45"/>' +
      '<circle cx="' + cx + '" cy="' + (cy + 8) + '" r="15" fill="#2dd4bf" opacity="0.85"/>' +
      '<circle class="a-bub" cx="' + (cx - 5) + '" cy="' + (cy - 1) + '" r="2.4" fill="#d9fff2"/>' +
      '<circle class="a-bub" cx="' + (cx + 6) + '" cy="' + (cy + 5) + '" r="1.8" fill="#d9fff2" style="animation-delay:1.2s"/>' +
    '</g>'
  );
}

// ---- the seven arena scenes ----------------------------------------------------

function _sceneTraining() {
  const wood = "#8a6b4a", woodD = "#6b4f34", tan = "#cfa974";
  return (
    // sky
    _moonSVG(372, 56, 19, "#9aa3ad") +
    _cloudSVG(58, 90, 1.1, 0) +
    _cloudSVG(250, 96, 0.8, 2.2) +
    // distant tree line
    '<path d="M18 214 q28 -64 56 0 z" fill="#15121c"/>' +
    '<path d="M56 214 q30 -54 60 0 z" fill="#131019"/>' +
    '<path d="M368 214 q30 -60 60 0 z" fill="#15121c"/>' +
    // island
    _islandSVG("#94a3b8", "#475569") +
    // worn pavers on the platform
    '<rect x="150" y="238" width="18" height="10" rx="3" fill="#3b4454" opacity="0.7"/>' +
    '<rect x="250" y="242" width="16" height="9" rx="3" fill="#3b4454" opacity="0.7"/>' +
    '<rect x="196" y="252" width="20" height="9" rx="3" fill="#3b4454" opacity="0.6"/>' +
    // fence along the back
    '<rect x="150" y="220" width="7" height="26" fill="' + woodD + '"/>' +
    '<rect x="175" y="216" width="7" height="30" fill="' + woodD + '"/>' +
    '<rect x="200" y="216" width="7" height="30" fill="' + woodD + '"/>' +
    '<rect x="225" y="216" width="7" height="30" fill="' + woodD + '"/>' +
    '<rect x="250" y="220" width="7" height="26" fill="' + woodD + '"/>' +
    '<rect x="146" y="222" width="115" height="6" rx="3" fill="' + wood + '"/>' +
    '<rect x="146" y="234" width="115" height="6" rx="3" fill="' + wood + '"/>' +
    // grass tufts
    _grassSVG(88, 248, 1, 0.4) +
    _grassSVG(318, 250, 1, 1.2) +
    _grassSVG(262, 256, 0.8, 2) +
    // two big training dummies with blinking eyes
    '<g class="a-bob" style="animation-delay:.2s">' +
      '<rect x="112" y="156" width="16" height="84" rx="7" fill="' + wood + '"/>' +
      '<circle cx="120" cy="142" r="22" fill="' + tan + '"/>' +
      '<g class="a-blink"><circle cx="113" cy="137" r="3.4" fill="#221f28"/><circle cx="127" cy="137" r="3.4" fill="#221f28"/></g>' +
      '<rect x="94" y="164" width="52" height="9" rx="4.5" fill="' + woodD + '"/>' +
    '</g>' +
    '<g class="a-bob" style="animation-delay:.9s">' +
      '<rect x="288" y="158" width="15" height="82" rx="7" fill="' + wood + '"/>' +
      '<circle cx="295.5" cy="145" r="21" fill="' + tan + '"/>' +
      '<g class="a-blink" style="animation-delay:.4s"><circle cx="289" cy="140" r="3.2" fill="#221f28"/><circle cx="302" cy="140" r="3.2" fill="#221f28"/></g>' +
      '<rect x="271" y="166" width="49" height="8" rx="4" fill="' + woodD + '"/>' +
    '</g>' +
    // a small dummy off to the side
    '<g class="a-bob" style="animation-delay:1.4s">' +
      '<rect x="160" y="182" width="11" height="58" rx="5" fill="' + wood + '"/>' +
      '<circle cx="165.5" cy="172" r="15" fill="' + tan + '"/>' +
      '<g class="a-blink" style="animation-delay:.7s"><circle cx="160" cy="168" r="2.4" fill="#221f28"/><circle cx="171" cy="168" r="2.4" fill="#221f28"/></g>' +
    '</g>' +
    // centerpiece: practice target on a post
    '<rect x="259" y="196" width="10" height="52" rx="4" fill="' + woodD + '"/>' +
    '<circle cx="264" cy="188" r="17" fill="' + tan + '"/>' +
    '<circle cx="264" cy="188" r="11" fill="' + wood + '"/>' +
    '<circle cx="264" cy="188" r="5.5" fill="#f2a254"/>' +
    // torches
    '<rect x="46" y="190" width="9" height="58" rx="4.5" fill="' + woodD + '"/>' +
    '<ellipse class="a-flame" cx="50.5" cy="180" rx="11" ry="17" fill="#f2a254"/>' +
    '<ellipse class="a-flame" cx="50.5" cy="180" rx="5.5" ry="9.5" fill="#f6c98a" style="animation-delay:.25s"/>' +
    '<rect x="356" y="192" width="9" height="56" rx="4.5" fill="' + woodD + '"/>' +
    '<ellipse class="a-flame" cx="360.5" cy="182" rx="11" ry="17" fill="#f2a254" style="animation-delay:.5s"/>' +
    '<ellipse class="a-flame" cx="360.5" cy="182" rx="5.5" ry="9.5" fill="#f6c98a" style="animation-delay:.75s"/>' +
    // hay bale + crate + barrel
    '<rect x="312" y="238" width="28" height="17" rx="6" fill="#b98a4e"/>' +
    '<path d="M317 238 v17 M325 238 v17 M333 238 v17" stroke="#8a6b4a" stroke-width="2"/>' +
    '<rect x="150" y="236" width="26" height="20" rx="2" fill="' + wood + '"/>' +
    '<path d="M150 246 h26 M163 236 v20" stroke="' + woodD + '" stroke-width="2"/>' +
    '<circle cx="100" cy="252" r="11" fill="' + wood + '"/>' +
    '<ellipse cx="100" cy="244" rx="11" ry="4" fill="' + woodD + '"/>' +
    '<path d="M89 252 h22 M89 258 h22" stroke="' + woodD + '" stroke-width="2"/>' +
    // wooden signpost
    '<rect x="183" y="226" width="5" height="24" fill="' + woodD + '"/>' +
    '<rect x="172" y="220" width="28" height="9" rx="3" fill="' + wood + '"/>' +
    // name sign
    _bannerSVG("TRAINING GROUNDS", "#6b4f34", "#8a6b4a", "#f3efe8", "#3a2f23")
  );
}

function _sceneLab() {
  return (
    // sky haze
    '<ellipse class="a-breathe" cx="210" cy="70" rx="150" ry="52" fill="#2dd4bf" opacity="0.08"/>' +
    // distant lab apparatus silhouette
    '<rect x="52" y="120" width="26" height="92" rx="4" fill="#0f2c27"/>' +
    '<circle cx="65" cy="112" r="16" fill="#0f2c27"/>' +
    '<rect x="58" y="96" width="14" height="12" rx="3" fill="#0f2c27"/>' +
    '<rect x="342" y="132" width="22" height="80" rx="4" fill="#0f2c27"/>' +
    '<rect x="336" y="124" width="34" height="10" rx="3" fill="#0f2c27"/>' +
    // island
    _islandSVG("#34d399", "#0d9488") +
    // glowing puddle + mist at the base
    '<ellipse class="a-breathe" cx="210" cy="250" rx="120" ry="20" fill="#2dd4bf" opacity="0.22"/>' +
    '<ellipse cx="210" cy="258" rx="170" ry="14" fill="#7fe3c4" opacity="0.1"/>' +
    // pipe with glowing liquid rising
    '<rect x="120" y="150" width="12" height="100" rx="6" fill="#12332c"/>' +
    '<circle class="a-bub" cx="126" cy="230" r="3" fill="#4ff0c8"/>' +
    '<circle class="a-bub" cx="126" cy="220" r="2.2" fill="#4ff0c8" style="animation-delay:.8s"/>' +
    '<circle class="a-bub" cx="126" cy="210" r="1.8" fill="#4ff0c8" style="animation-delay:1.6s"/>' +
    '<rect x="288" y="156" width="12" height="94" rx="6" fill="#12332c"/>' +
    '<circle class="a-bub" cx="294" cy="228" r="2.6" fill="#4ff0c8" style="animation-delay:.5s"/>' +
    // flasks
    _flask(140, 216, 0) +
    _flask(268, 220, 0.7) +
    // centrifuge with spinning vials
    '<g transform="translate(320 214)">' +
      '<circle r="18" fill="#0f2c27"/>' +
      '<circle r="12" fill="#12332c"/>' +
      '<g class="a-spin">' +
        '<rect x="-3" y="-14" width="4" height="9" rx="2" fill="#4ff0c8"/>' +
        '<rect x="-3" y="5" width="4" height="9" rx="2" fill="#4ff0c8"/>' +
        '<rect x="-7" y="-5" width="4" height="10" rx="2" fill="#4ff0c8"/>' +
      '</g>' +
      '<circle class="a-twinkle" cx="0" cy="0" r="3" fill="#4ff0c8"/>' +
    '</g>' +
    // a little microscope
    '<rect x="82" y="240" width="34" height="6" rx="3" fill="#0f2c27"/>' +
    '<path d="M96 240 v-22 a9 9 0 0 1 18 0 v6" fill="none" stroke="#0f2c27" stroke-width="6"/>' +
    '<circle cx="118" cy="212" r="7" fill="#b8e8dc" opacity="0.5"/>' +
    // glowing crystals
    '<polygon class="a-twinkle" points="112,238 117,224 122,238" fill="#4ff0c8" opacity="0.9"/>' +
    '<polygon class="a-twinkle" style="animation-delay:1.1s" points="226,238 231,226 236,238" fill="#2dd4bf" opacity="0.9"/>' +
    '<polygon class="a-twinkle" style="animation-delay:.6s" points="306,240 310,230 314,240" fill="#4ff0c8" opacity="0.8"/>' +
    // centerpiece: glowing reactor vial
    '<g class="a-breathe">' +
      '<circle cx="210" cy="212" r="30" fill="#2dd4bf" opacity="0.3"/>' +
      '<rect x="199" y="166" width="22" height="36" rx="7" fill="#b8e8dc" opacity="0.45"/>' +
      '<circle cx="210" cy="214" r="24" fill="#b8e8dc" opacity="0.45"/>' +
      '<circle cx="210" cy="216" r="17" fill="#4ff0c8" opacity="0.9"/>' +
      '<circle cx="205" cy="208" r="3" fill="#d9fff2"/>' +
      '<circle class="a-bub" cx="216" cy="214" r="2.2" fill="#d9fff2"/>' +
      '<circle class="a-bub" cx="203" cy="220" r="1.8" fill="#d9fff2" style="animation-delay:.9s"/>' +
    '</g>' +
    // floating bubbles
    '<circle class="a-bub" cx="140" cy="150" r="4" fill="#7fe3c4" opacity="0.8"/>' +
    '<circle class="a-bub" cx="272" cy="140" r="3" fill="#7fe3c4" opacity="0.8" style="animation-delay:1.4s"/>' +
    '<circle class="a-bub" cx="196" cy="120" r="2.6" fill="#7fe3c4" opacity="0.8" style="animation-delay:.7s"/>' +
    '<circle class="a-bub" cx="230" cy="132" r="2" fill="#7fe3c4" opacity="0.8" style="animation-delay:2s"/>' +
    // name sign
    _bannerSVG("SCIENCE LAB", "#0f2c27", "#2dd4bf", "#4ff0c8", "#2dd4bf")
  );
}

function _sceneStadium() {
  const green = "#3f9d5a", white = "#f3efe8";
  return (
    // floodlight glow cones
    '<polygon class="a-ray" points="60,118 12,214 108,214" fill="#eaffea" opacity="0.35"/>' +
    '<polygon class="a-ray" style="animation-delay:1.7s" points="358,122 310,214 406,214" fill="#eaffea" opacity="0.35"/>' +
    // stands silhouette with a hint of crowd
    '<path d="M10 214 h70 v-6 a35 20 0 0 1 70 0 v6 z" fill="#0f2b1a"/>' +
    '<path d="M260 214 h70 v-6 a35 20 0 0 1 70 0 v6 z" fill="#0f2b1a"/>' +
    '<circle cx="40" cy="204" r="2" fill="#2c5a3d"/>' +
    '<circle cx="56" cy="208" r="2" fill="#2c5a3d"/>' +
    '<circle cx="300" cy="206" r="2" fill="#2c5a3d"/>' +
    '<circle cx="318" cy="202" r="2" fill="#2c5a3d"/>' +
    // island
    _islandSVG("#4ade80", "#15803d") +
    // pitch
    '<ellipse cx="210" cy="248" rx="150" ry="30" fill="' + green + '" opacity="0.92"/>' +
    '<rect x="66" y="240" width="288" height="2.5" fill="' + white + '" opacity="0.4"/>' +
    '<rect x="66" y="250" width="288" height="2.5" fill="' + white + '" opacity="0.3"/>' +
    '<rect x="210" y="222" width="2.5" height="50" fill="' + white + '" opacity="0.4"/>' +
    '<ellipse cx="210" cy="247" rx="32" ry="11" fill="none" stroke="' + white + '" stroke-width="2" opacity="0.45"/>' +
    '<rect x="60" y="230" width="44" height="30" fill="none" stroke="' + white + '" stroke-width="2" opacity="0.4"/>' +
    '<rect x="316" y="230" width="44" height="30" fill="none" stroke="' + white + '" stroke-width="2" opacity="0.4"/>' +
    // goals — left with net, right simple
    '<rect x="58" y="178" width="4" height="64" fill="' + white + '"/>' +
    '<rect x="82" y="178" width="4" height="64" fill="' + white + '"/>' +
    '<rect x="55" y="176" width="34" height="4" rx="2" fill="' + white + '"/>' +
    '<path d="M62 206 h18 M62 216 h18 M62 226 h18 M66 178 v50 M76 178 v50" stroke="' + white + '" stroke-width="1.5" opacity="0.45"/>' +
    '<rect x="334" y="182" width="4" height="60" fill="' + white + '"/>' +
    '<rect x="356" y="182" width="4" height="60" fill="' + white + '"/>' +
    '<rect x="331" y="180" width="32" height="4" rx="2" fill="' + white + '"/>' +
    // corner flags
    '<g class="a-sway"><rect x="74" y="196" width="3.5" height="46" fill="' + white + '" opacity="0.8"/>' +
    '<path d="M77.5 196 l24 4 -24 8 z" fill="' + green + '" stroke="#1d4a2e" stroke-width="1.5"/></g>' +
    '<g class="a-sway" style="animation-delay:1.1s"><rect x="342" y="232" width="3.5" height="20" fill="' + white + '" opacity="0.8"/>' +
    '<path d="M345.5 232 l15 3 -15 6 z" fill="' + green + '" stroke="#1d4a2e" stroke-width="1.5"/></g>' +
    // benches
    '<rect x="128" y="238" width="26" height="7" rx="3" fill="#1d4a2e"/>' +
    '<rect x="130" y="245" width="4" height="8" fill="#1d4a2e"/>' +
    '<rect x="148" y="245" width="4" height="8" fill="#1d4a2e"/>' +
    '<rect x="266" y="240" width="26" height="7" rx="3" fill="#1d4a2e"/>' +
    // ball at the centre circle
    '<circle cx="210" cy="242" r="6.5" fill="' + white + '"/>' +
    '<path d="M210 235.5 l3.4 2.6 -1.3 4.2 h-4.2 l-1.3 -4.2 z" fill="#1d4a2e"/>' +
    // scoreboard on a pole
    '<rect x="228" y="120" width="5" height="80" fill="#2c3b31"/>' +
    '<rect x="216" y="112" width="30" height="14" rx="3" fill="#0f2b1a"/>' +
    '<circle cx="223" cy="119" r="2.6" fill="#7fcf8d"/>' +
    '<circle cx="239" cy="119" r="2.6" fill="#7fcf8d"/>' +
    // floodlight towers
    '<rect x="58" y="96" width="5" height="70" fill="#2c3b31"/>' +
    '<circle class="a-twinkle" cx="60.5" cy="92" r="8" fill="#eaffea" opacity="0.9"/>' +
    '<circle class="a-twinkle" cx="60.5" cy="92" r="4" fill="#fff" opacity="0.9" style="animation-delay:.3s"/>' +
    '<rect x="356" y="102" width="5" height="64" fill="#2c3b31"/>' +
    '<circle class="a-twinkle" cx="358.5" cy="98" r="8" fill="#eaffea" opacity="0.9" style="animation-delay:1.4s"/>' +
    '<circle class="a-twinkle" cx="358.5" cy="98" r="4" fill="#fff" opacity="0.9" style="animation-delay:1.7s"/>' +
    // name sign (scoreboard style)
    _bannerSVG("FOOTBALL STADIUM", "#0f2b1a", "#3f9d5a", "#eaffea", "#3f9d5a")
  );
}

function _sceneMuseum() {
  const marble = "#e8e2d6";
  return (
    // sky: amber moon + dust
    _moonSVG(46, 56, 17, "#e8cfa0") +
    '<ellipse class="a-breathe" cx="210" cy="60" rx="120" ry="36" fill="#fbbf24" opacity="0.06"/>' +
    // temple facade silhouette
    '<path d="M140 214 v-46 l70 -30 70 30 v46 z" fill="#1c1410"/>' +
    '<rect x="158" y="168" width="12" height="46" fill="#16100c"/>' +
    '<rect x="210" y="168" width="12" height="46" fill="#16100c"/>' +
    '<rect x="262" y="168" width="12" height="46" fill="#16100c"/>' +
    // island
    _islandSVG("#fbbf24", "#b45309") +
    // cracked mosaic in the middle
    '<circle cx="210" cy="246" r="46" fill="none" stroke="#b45309" stroke-width="2" opacity="0.35" stroke-dasharray="7 5"/>' +
    '<path d="M180 232 l14 10 M240 258 l-10 6 M196 268 l8 -14" stroke="#b45309" stroke-width="1.5" opacity="0.4"/>' +
    // marble columns with capitals, one with vines
    '<rect x="78" y="206" width="13" height="46" fill="' + marble + '"/>' +
    '<rect x="74" y="200" width="21" height="8" rx="2" fill="' + marble + '"/>' +
    '<rect x="74" y="250" width="21" height="7" rx="2" fill="#c9bfae"/>' +
    '<rect x="330" y="206" width="13" height="46" fill="' + marble + '"/>' +
    '<rect x="326" y="200" width="21" height="8" rx="2" fill="' + marble + '"/>' +
    '<rect x="326" y="250" width="21" height="7" rx="2" fill="#c9bfae"/>' +
    '<path d="M334 206 q10 12 -4 20 q-10 10 4 22" stroke="#3f5a4a" stroke-width="2.5" fill="none"/>' +
    '<circle cx="336" cy="238" r="2.5" fill="#3f5a4a"/>' +
    // leaning broken column
    '<g transform="rotate(12 116 214)">' +
      '<rect x="110" y="206" width="12" height="46" fill="#d9d0c0"/>' +
      '<rect x="107" y="200" width="18" height="7" rx="2" fill="#c9bfae"/>' +
    '</g>' +
    // statue with eyes
    '<g class="a-bob" style="animation-delay:.4s">' +
      '<rect x="148" y="222" width="28" height="30" rx="3" fill="' + marble + '"/>' +
      '<circle cx="162" cy="210" r="12" fill="' + marble + '"/>' +
      '<circle cx="162" cy="192" r="10" fill="' + marble + '"/>' +
      '<g class="a-blink" style="animation-delay:.9s"><circle cx="157.5" cy="190" r="2.2" fill="#5a5148"/><circle cx="166.5" cy="190" r="2.2" fill="#5a5148"/></g>' +
    '</g>' +
    // a small sphinx with eyes
    '<g class="a-bob" style="animation-delay:1s">' +
      '<ellipse cx="300" cy="252" rx="16" ry="8" fill="' + marble + '"/>' +
      '<rect x="306" y="232" width="18" height="18" rx="4" fill="' + marble + '"/>' +
      '<circle cx="316" cy="226" r="8" fill="' + marble + '"/>' +
      '<g class="a-blink" style="animation-delay:.3s"><circle cx="312" cy="224" r="1.8" fill="#5a5148"/><circle cx="320" cy="224" r="1.8" fill="#5a5148"/></g>' +
    '</g>' +
    // amphorae
    '<ellipse cx="258" cy="250" rx="12" ry="15" fill="#c98d4b"/>' +
    '<rect x="253" y="225" width="10" height="11" rx="3" fill="#c98d4b"/>' +
    '<rect x="250" y="221" width="16" height="5" rx="2.5" fill="#a36a2f"/>' +
    '<ellipse cx="104" cy="254" rx="10" ry="12" fill="#c98d4b" opacity="0.85"/>' +
    '<rect x="100" y="233" width="8" height="9" rx="3" fill="#c98d4b" opacity="0.85"/>' +
    // scrolls on a small pedestal
    '<rect x="186" y="242" width="22" height="5" rx="2.5" fill="#c9bfae"/>' +
    '<ellipse cx="192" cy="238" rx="6" ry="4" fill="#e8e2d6"/>' +
    '<ellipse cx="203" cy="236" rx="6" ry="4" fill="#e8e2d6"/>' +
    // small fountain
    '<ellipse cx="248" cy="252" rx="14" ry="6" fill="#c9bfae"/>' +
    '<ellipse cx="248" cy="250" rx="9" ry="4" fill="#9fd0e0" opacity="0.8"/>' +
    '<path d="M248 250 q-6 -10 0 -18 M248 250 q6 -10 0 -18" stroke="#9fd0e0" stroke-width="2" fill="none" opacity="0.8"/>' +
    // centerpiece: obelisk with a glowing tip
    '<rect x="196" y="186" width="28" height="64" fill="' + marble + '"/>' +
    '<polygon points="196,186 210,158 224,186" fill="' + marble + '"/>' +
    '<rect x="190" y="248" width="40" height="7" rx="3" fill="#c9bfae"/>' +
    '<path d="M203 200 h16 M203 208 h16 M203 216 h16 M203 224 h16" stroke="#b45309" stroke-width="2" opacity="0.5"/>' +
    '<circle class="a-twinkle" cx="210" cy="166" r="4" fill="#fbbf24" opacity="0.95"/>' +
    // name sign (stone plaque)
    _bannerSVG("HISTORY MUSEUM", "#c9bfae", "#8a6f50", "#3a2a1a", "#b45309")
  );
}

function _sceneMath(c1, c2) {
  return (
    // background geometry — big faint shapes
    '<circle cx="210" cy="120" r="86" fill="none" stroke="' + c1 + '" stroke-width="1.5" opacity="0.14"/>' +
    '<path d="M60 60 h60 M60 60 v50 M120 60 l-30 50 h-30 z" fill="none" stroke="' + c1 + '" stroke-width="1.5" opacity="0.12"/>' +
    '<circle class="a-twinkle" cx="150" cy="90" r="2.4" fill="' + c1 + '"/>' +
    '<circle class="a-twinkle" cx="272" cy="76" r="2" fill="' + c1 + '" style="animation-delay:1s"/>' +
    '<circle class="a-twinkle" cx="220" cy="52" r="2.2" fill="' + c1 + '" style="animation-delay:.5s"/>' +
    // island
    _islandSVG(c1, c2) +
    // faint grid on the platform
    '<path d="M120 240 h180 M120 252 h180 M150 228 v46 M210 228 v46 M270 228 v46" stroke="' + c1 + '" stroke-width="1.5" opacity="0.2"/>' +
    // four pedestals with floating solids
    '<rect x="92" y="232" width="10" height="18" rx="2" fill="' + c2 + '"/>' +
    '<g class="a-bob a-spin" style="animation-delay:.2s">' +
      '<rect x="86" y="186" width="22" height="22" rx="3" fill="' + c1 + '" opacity="0.85"/>' +
      '<path d="M86 186 l11 -8 11 8 -11 8 z" fill="' + c2 + '"/>' +
    '</g>' +
    '<rect x="162" y="232" width="10" height="18" rx="2" fill="' + c2 + '"/>' +
    '<g class="a-bob a-spin" style="animation-delay:.7s">' +
      '<path d="M167 206 l24 0 -12 22 z" fill="' + c2 + '" opacity="0.9" stroke="' + c1 + '" stroke-width="2"/>' +
    '</g>' +
    '<rect x="272" y="232" width="10" height="18" rx="2" fill="' + c2 + '"/>' +
    '<g class="a-bob a-spin" style="animation-delay:1.1s">' +
      '<circle cx="277" cy="199" r="13" fill="' + c1 + '" opacity="0.4" stroke="' + c1 + '" stroke-width="3"/>' +
    '</g>' +
    '<rect x="318" y="232" width="10" height="18" rx="2" fill="' + c2 + '"/>' +
    '<g class="a-bob a-spin" style="animation-delay:1.5s">' +
      '<ellipse cx="323" cy="199" rx="17" ry="10" fill="none" stroke="' + c1 + '" stroke-width="6"/>' +
    '</g>' +
    // two more shapes floating high
    '<g class="a-bob a-spin" style="animation-delay:2s">' +
      '<polygon points="140,150 152,132 164,150 152,168" fill="' + c1 + '" opacity="0.5" stroke="' + c1 + '" stroke-width="2"/>' +
    '</g>' +
    '<g class="a-bob a-spin" style="animation-delay:2.5s">' +
      '<rect x="274" y="150" width="18" height="18" rx="3" fill="' + c2 + '" opacity="0.7" stroke="' + c1 + '" stroke-width="2"/>' +
    '</g>' +
    // centerpiece: octahedron on a pedestal with an orbit ring
    '<rect x="202" y="226" width="16" height="22" rx="2" fill="' + c2 + '"/>' +
    '<g class="a-bob a-spin">' +
      '<polygon points="210,162 234,196 186,196" fill="' + c1 + '" opacity="0.55" stroke="' + c1 + '" stroke-width="2.5"/>' +
      '<polygon points="210,214 234,180 186,180" fill="' + c2 + '" opacity="0.6" stroke="' + c1 + '" stroke-width="2.5"/>' +
    '</g>' +
    '<ellipse class="a-bob" cx="210" cy="164" rx="38" ry="11" fill="none" stroke="' + c1 + '" stroke-width="2" opacity="0.6" style="animation-delay:.5s"/>' +
    '<ellipse class="a-bob" cx="210" cy="164" rx="24" ry="7" fill="none" stroke="' + c1 + '" stroke-width="1.5" opacity="0.4" style="animation-delay:.9s"/>' +
    // edge sparks
    '<circle class="a-twinkle" cx="96" cy="176" r="2" fill="' + c1 + '"/>' +
    '<circle class="a-twinkle" cx="326" cy="184" r="2" fill="' + c1 + '" style="animation-delay:.8s"/>' +
    '<circle class="a-twinkle" cx="150" cy="120" r="2" fill="' + c1 + '" style="animation-delay:1.6s"/>' +
    // name sign (hologram)
    _bannerSVG("MATH ARENA", "#161024", "#a78bfa", "#a78bfa", "#6d28d9")
  );
}

function _sceneColosseum(c1) {
  const stone = "#9c6b4f", sand = "#c8a061";
  return (
    // horizon glow
    '<ellipse class="a-breathe" cx="210" cy="90" rx="150" ry="46" fill="#f87171" opacity="0.07"/>' +
    // big colosseum wall silhouette
    '<path d="M40 214 v-40 a34 34 0 0 1 68 0 v40" fill="none" stroke="#241512" stroke-width="12"/>' +
    '<path d="M176 214 v-52 a34 34 0 0 1 68 0 v52" fill="none" stroke="#241512" stroke-width="12"/>' +
    '<path d="M312 214 v-40 a34 34 0 0 1 68 0 v40" fill="none" stroke="#241512" stroke-width="12"/>' +
    // island
    _islandSVG(c1, "#b91c1c") +
    // sand floor with swirls
    '<ellipse cx="210" cy="248" rx="150" ry="30" fill="' + sand + '" opacity="0.92"/>' +
    '<path d="M140 244 q16 8 32 0 M258 254 q16 6 30 -2 M100 256 q14 6 26 0" stroke="#a3753f" stroke-width="2" fill="none" opacity="0.7"/>' +
    // ring of arches with torches
    '<path d="M52 252 v-52 a24 24 0 0 1 48 0 v52" fill="none" stroke="' + stone + '" stroke-width="9"/>' +
    '<path d="M142 252 v-62 a26 26 0 0 1 52 0 v62" fill="none" stroke="' + stone + '" stroke-width="9"/>' +
    '<path d="M226 252 v-66 a28 28 0 0 1 56 0 v66" fill="none" stroke="' + stone + '" stroke-width="9"/>' +
    '<path d="M324 252 v-52 a24 24 0 0 1 48 0 v52" fill="none" stroke="' + stone + '" stroke-width="9"/>' +
    '<ellipse class="a-flame" cx="76" cy="182" rx="8" ry="13" fill="#f2a254"/>' +
    '<ellipse class="a-flame" cx="76" cy="182" rx="4" ry="7" fill="#f6c98a" style="animation-delay:.3s"/>' +
    '<ellipse class="a-flame" cx="168" cy="174" rx="8" ry="13" fill="#f2a254" style="animation-delay:.7s"/>' +
    '<ellipse class="a-flame" cx="254" cy="170" rx="8" ry="13" fill="#f2a254" style="animation-delay:1.1s"/>' +
    '<ellipse class="a-flame" cx="348" cy="182" rx="8" ry="13" fill="#f2a254" style="animation-delay:1.5s"/>' +
    // battlements + banners
    '<rect x="104" y="240" width="9" height="13" fill="' + stone + '"/>' +
    '<rect x="196" y="242" width="9" height="12" fill="' + stone + '"/>' +
    '<rect x="274" y="242" width="9" height="12" fill="' + stone + '"/>' +
    '<g class="a-sway" style="animation-delay:.4s"><rect x="126" y="150" width="3.5" height="30" fill="#5a4030"/>' +
    '<path d="M129.5 152 l20 5 -20 8 z" fill="' + c1 + '"/></g>' +
    '<g class="a-sway" style="animation-delay:1.2s"><rect x="288" y="156" width="3.5" height="30" fill="#5a4030"/>' +
    '<path d="M291.5 158 l20 5 -20 8 z" fill="' + c1 + '"/></g>' +
    // leaning spears + round shield
    '<g transform="rotate(16 136 236)"><rect x="133" y="200" width="3.5" height="38" fill="#7a5436"/>' +
    '<path d="M130 200 l5 -12 5 12 z" fill="#b8c4cc"/></g>' +
    '<g transform="rotate(-14 290 240)"><rect x="288" y="206" width="3.5" height="34" fill="#7a5436"/>' +
    '<path d="M285 206 l5 -12 5 12 z" fill="#b8c4cc"/></g>' +
    '<circle cx="180" cy="244" r="13" fill="#8a5a36"/>' +
    '<circle cx="180" cy="244" r="9" fill="#9c6b4f"/>' +
    '<circle cx="180" cy="244" r="3.5" fill="#7a5436"/>' +
    // chariot wheel leaning
    '<g transform="rotate(10 316 244)">' +
      '<circle cx="316" cy="244" r="15" fill="none" stroke="#7a5436" stroke-width="3.5"/>' +
      '<path d="M316 229 v30 M301 244 h30 M308 236 l16 16 M324 236 l-16 16" stroke="#7a5436" stroke-width="2"/>' +
    '</g>' +
    // scattered stones
    '<ellipse cx="110" cy="252" rx="6" ry="3.5" fill="#a3753f"/>' +
    '<ellipse cx="238" cy="256" rx="5" ry="3" fill="#a3753f"/>' +
    // centerpiece: brazier on a dais
    '<rect x="192" y="222" width="36" height="12" rx="4" fill="' + stone + '"/>' +
    '<ellipse class="a-flame" cx="210" cy="204" rx="13" ry="19" fill="#f2a254"/>' +
    '<ellipse class="a-flame" cx="210" cy="204" rx="6.5" ry="10" fill="#f6c98a" style="animation-delay:.3s"/>' +
    '<circle cx="210" cy="232" r="14" fill="#f2a254" opacity="0.25"/>' +
    // name sign (stone banner)
    _bannerSVG("GRAND COLOSSEUM", "#8a5a36", "#5a4030", "#f3e2c9", "#5a4030")
  );
}

function _sceneLegends(c1) {
  const gold = "#e9b64f";
  return (
    // radiant sky
    '<ellipse class="a-breathe" cx="210" cy="70" rx="170" ry="60" fill="#facc15" opacity="0.1"/>' +
    '<ellipse class="a-breathe" cx="210" cy="70" rx="90" ry="34" fill="#ffe9a8" opacity="0.12" style="animation-delay:1s"/>' +
    // grand doorway silhouette
    '<path d="M120 214 v-70 a90 90 0 0 1 180 0 v70" fill="none" stroke="#241b0e" stroke-width="14"/>' +
    '<path d="M150 214 v-52 a60 60 0 0 1 120 0 v52" fill="none" stroke="#1c150a" stroke-width="10"/>' +
    // island
    _islandSVG(c1, "#a16207") +
    // golden tiles
    '<path d="M140 240 h140 M140 250 h140 M170 232 v46 M250 232 v46" stroke="#d9a43c" stroke-width="1.5" opacity="0.3"/>' +
    // pillars — two big in front, two smaller behind
    '<rect x="60" y="120" width="20" height="130" fill="' + gold + '"/>' +
    '<rect x="54" y="112" width="32" height="10" rx="2" fill="#d9a43c"/>' +
    '<rect x="340" y="120" width="20" height="130" fill="' + gold + '"/>' +
    '<rect x="334" y="112" width="32" height="10" rx="2" fill="#d9a43c"/>' +
    '<rect x="116" y="150" width="14" height="100" fill="#d9a43c" opacity="0.85"/>' +
    '<rect x="290" y="150" width="14" height="100" fill="#d9a43c" opacity="0.85"/>' +
    // light beams
    '<polygon class="a-ray" points="210,0 248,160 172,160" fill="#ffe9a8"/>' +
    '<polygon class="a-ray" style="animation-delay:1.6s" points="112,0 146,160 78,160" fill="#ffe9a8" opacity="0.6"/>' +
    '<polygon class="a-ray" style="animation-delay:3s" points="308,0 342,160 274,160" fill="#ffe9a8" opacity="0.6"/>' +
    // floating rings
    '<ellipse class="a-bob" cx="130" cy="140" rx="26" ry="8" fill="none" stroke="' + gold + '" stroke-width="4" opacity="0.85"/>' +
    '<ellipse class="a-bob" cx="292" cy="128" rx="22" ry="7" fill="none" stroke="' + gold + '" stroke-width="4" opacity="0.85" style="animation-delay:1.2s"/>' +
    '<ellipse class="a-bob" cx="210" cy="100" rx="30" ry="9" fill="none" stroke="' + gold + '" stroke-width="3" opacity="0.6" style="animation-delay:2s"/>' +
    // scattered coins
    '<circle cx="150" cy="250" r="5" fill="' + gold + '"/>' +
    '<circle cx="150" cy="250" r="2.6" fill="#a16207"/>' +
    '<circle cx="272" cy="252" r="4.5" fill="' + gold + '"/>' +
    '<circle cx="272" cy="252" r="2.3" fill="#a16207"/>' +
    '<circle cx="234" cy="256" r="4" fill="' + gold + '" opacity="0.9"/>' +
    // sparkles
    '<circle class="a-twinkle" cx="150" cy="110" r="2.6" fill="#fff3c4"/>' +
    '<circle class="a-twinkle" cx="270" cy="100" r="2.2" fill="#fff3c4" style="animation-delay:.8s"/>' +
    '<circle class="a-twinkle" cx="200" cy="88" r="2.8" fill="#fff3c4" style="animation-delay:1.6s"/>' +
    '<circle class="a-twinkle" cx="120" cy="94" r="2" fill="#fff3c4" style="animation-delay:2.2s"/>' +
    '<circle class="a-twinkle" cx="304" cy="106" r="2" fill="#fff3c4" style="animation-delay:2.8s"/>' +
    '<circle class="a-twinkle" cx="238" cy="120" r="2.2" fill="#fff3c4" style="animation-delay:.4s"/>' +
    // steps up to the pedestal
    '<rect x="186" y="240" width="48" height="6" rx="3" fill="#d9a43c"/>' +
    '<rect x="192" y="246" width="36" height="6" rx="3" fill="#c99834"/>' +
    // centerpiece: glowing orb on a tall pedestal, crowned with a laurel
    '<rect x="196" y="176" width="28" height="64" fill="' + gold + '"/>' +
    '<rect x="188" y="238" width="44" height="8" rx="4" fill="#d9a43c"/>' +
    '<circle class="a-breathe" cx="210" cy="156" r="18" fill="#fff3c4" opacity="0.95"/>' +
    '<circle class="a-breathe" cx="210" cy="156" r="28" fill="#ffe9a8" opacity="0.35" style="animation-delay:.8s"/>' +
    '<path d="M188 136 q22 -12 44 0 M188 136 q-8 6 0 12 M232 136 q8 6 0 12" stroke="#d9a43c" stroke-width="2.5" fill="none"/>' +
    '<path d="M196 130 q14 -8 28 0" stroke="#d9a43c" stroke-width="2.5" fill="none"/>' +
    '<polygon class="a-ray" points="210,104 220,132 200,132" fill="#ffe9a8"/>' +
    // name sign (golden plaque)
    _bannerSVG("HALL OF LEGENDS", "#d9a43c", "#e9b64f", "#241b0e", "#a16207")
  );
}

// assemble one arena's SVG (sky + silhouette + island + props + centerpiece)
function _sceneSVG(i, a) {
  const c1 = a.theme.c1, c2 = a.theme.c2;
  let extra = "";
  if (i === 0) extra = _sceneTraining();
  else if (i === 1) extra = _sceneLab();
  else if (i === 2) extra = _sceneStadium();
  else if (i === 3) extra = _sceneMuseum();
  else if (i === 4) extra = _sceneMath(c1, c2);
  else if (i === 5) extra = _sceneColosseum(c1);
  else extra = _sceneLegends(c1);
  return (
    '<svg class="a-svg" viewBox="0 0 420 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
      extra +
    '</svg>'
  );
}

// ---- panel assembly ------------------------------------------------------------

function _starsHTML() {
  const spots = [[8, 12], [18, 30], [30, 8], [44, 22], [58, 12], [72, 26], [84, 9], [93, 18], [26, 42], [66, 38], [50, 32], [12, 46]];
  let s = "";
  for (let k = 0; k < spots.length; k++) {
    s += '<i class="a-star" style="left:' + spots[k][0] + '%;top:' + spots[k][1] + '%;animation-delay:' + (Math.random() * 3).toFixed(2) + 's"></i>';
  }
  return s;
}

function _dustHTML(c1) {
  let s = "";
  for (let k = 0; k < 10; k++) {
    s += '<i class="a-dust" style="' +
      'left:' + (6 + Math.random() * 88).toFixed(1) + '%;' +
      'bottom:' + (6 + Math.random() * 46).toFixed(1) + '%;' +
      'animation-delay:' + (Math.random() * 9).toFixed(2) + 's;' +
      'animation-duration:' + (6 + Math.random() * 6).toFixed(2) + 's;' +
      'background:' + (k % 3 === 0 ? "#fff" : c1) + '"></i>';
  }
  return s;
}

function _panelHTML(i) {
  const a = ARENAS[i];
  const c1 = a.theme.c1;
  const bg = 'radial-gradient(140% 90% at 50% 80%, ' + c1 + '2e 0%, transparent 55%), linear-gradient(to bottom, #0b0a09, #151210 70%, #0b0a09)';
  return (
    '<div class="a-panel">' +
      '<div class="a-bg" style="background:' + bg + '"></div>' +
      _starsHTML() +
      '<div class="a-scene">' + _sceneSVG(i, a) + '</div>' +
      _dustHTML(c1) +
    '</div>'
  );
}

// ---- public API (called from app.js + index.html) -------------------------------

function openArenaViewer() {
  const track = document.getElementById("arena-track");
  if (!track) return;
  _track = track;
  if (!track.children.length) {
    let html = "";
    for (let i = 0; i < ARENAS.length; i++) html += _panelHTML(i);
    track.innerHTML = html;
  }
  const trophies = (currentProfile && currentProfile.trophies) || 0;
  const cur = ARENAS.findIndex(function (a) { return a.id === arenaForTrophies(trophies).id; });
  const start = cur < 0 ? 0 : cur;
  _buildTiles(trophies);
  // jump straight to the player's arena (no animation on open)
  track.scrollLeft = start * track.clientWidth;
  _setCurrent(start, trophies);
}

function closeArenaViewer() {
  // nothing to stop — the DOM scenes keep breathing on their own
}

function arenaGo3D(i) {
  if (!_track) return;
  i = Math.max(0, Math.min(ARENAS.length - 1, i));
  _track.scrollTo({ left: i * _track.clientWidth, behavior: "smooth" });
  _setCurrent(i);
}

function arenaPrev() { if (_track) arenaGo3D(_current - 1); }
function arenaNext() { if (_track) arenaGo3D(_current + 1); }

// ---- HUD + thumbnails ------------------------------------------------------------

function _setCurrent(i, trophies) {
  _current = i;
  const t = trophies !== undefined ? trophies : ((currentProfile && currentProfile.trophies) || 0);
  const a = ARENAS[i];
  const mine = arenaForTrophies(t);

  const name = document.getElementById("arena3d-name");
  const req = document.getElementById("arena3d-req");
  const badge = document.getElementById("arena3d-current");
  if (name) name.textContent = a.name;
  if (req) {
    req.textContent = mine.id === a.id
      ? "You're climbing here"
      : a.min === 0
        ? "Everyone starts here"
        : t >= a.min
          ? "Unlocked at " + a.min + " trophies"
          : "Reach " + a.min + " trophies to unlock";
  }
  if (badge) {
    const locked = mine.id !== a.id && t < a.min;
    badge.classList.toggle("locked", locked);
    if (locked) badge.style.removeProperty("background");
    else badge.style.background = a.theme.c1;
    badge.textContent = mine.id === a.id ? "★ Your arena" : t >= a.min ? "Unlocked" : "Locked";
  }

  const prev = document.getElementById("arena3d-prev");
  const next = document.getElementById("arena3d-next");
  if (prev) prev.classList.toggle("off", i === 0);
  if (next) next.classList.toggle("off", i === ARENAS.length - 1);

  const tiles = document.querySelectorAll(".a3d-tile");
  tiles.forEach(function (tile, k) { tile.classList.toggle("current", k === i); });
  const curTile = tiles[i];
  if (curTile && curTile.scrollIntoView) {
    curTile.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }
}

function _buildTiles(trophies) {
  const wrap = document.getElementById("arena3d-tiles");
  if (!wrap) return;
  wrap.innerHTML = "";
  ARENAS.forEach(function (a, i) {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "a3d-tile" + (trophies >= a.min ? "" : " locked");
    t.onclick = function () { arenaGo3D(i); };
    t.innerHTML =
      '<img src="' + a.icon + '" alt="' + esc(a.name) + '">' +
      "<b>" + esc(a.name) + "</b>" +
      '<span><img src="assets/icons/trophy.svg" alt="">' +
      (a.min === 0 ? "Start" : a.min) + "</span>";
    wrap.appendChild(t);
  });
}

// ---- input: native scroll + wheel + arrow keys ------------------------------------

(function bindArenaInput() {
  const stage = document.getElementById("arena-stage");
  if (stage) {
    // mouse wheel / trackpad scrolls the arena track horizontally on PC
    stage.addEventListener("wheel", function (e) {
      if (!_track || _track.scrollWidth <= _track.clientWidth) return;
      _track.scrollLeft += (e.deltaY || e.deltaX);
      e.preventDefault();
    }, { passive: false });
  }

  const track = document.getElementById("arena-track");
  if (track) {
    track.addEventListener("scroll", function () {
      if (_scrollRaf) return;
      _scrollRaf = requestAnimationFrame(function () {
        _scrollRaf = 0;
        const i = Math.round(track.scrollLeft / (track.clientWidth || 1));
        _setCurrent(Math.max(0, Math.min(ARENAS.length - 1, i)));
      });
    });
  }

  document.addEventListener("keydown", function (e) {
    const sc = document.getElementById("screen-arenas");
    if (!sc || !sc.classList.contains("active")) return;
    if (e.key === "ArrowLeft") { arenaPrev(); e.preventDefault(); }
    else if (e.key === "ArrowRight") { arenaNext(); e.preventDefault(); }
  });
})();
