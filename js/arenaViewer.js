// ============================================================================
//  arenaViewer.js — the arena browser, indie Undertale style.
//
//  Opens on the "Arenas" screen: a horizontally scrollable stage where each
//  of the 7 arenas is a hand-built HTML/SVG island scene — dark, warm, and a
//  little alive. Props bob, flames flicker, eyes blink, dust floats up like
//  determination. Pure DOM + CSS: no WebGL, no model files, works offline
//  and scrolls natively on every device (swipe, wheel, trackpad).
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

// the golden trophy every arena keeps at its heart (with blinking eyes)
function _trophySVG() {
  return (
    '<g class="a-bob" style="animation-delay:.6s">' +
      '<path d="M192 166 h36 v5 l-6 17 q-12 7 -24 0 z" fill="#e9b64f"/>' +
      '<path d="M188 170 q-5 4 0 9 M232 170 q5 4 0 9" stroke="#e9b64f" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<rect x="208" y="188" width="4" height="13" fill="#b8862f"/>' +
      '<rect x="198" y="201" width="24" height="8" rx="4" fill="#e9b64f"/>' +
      '<g class="a-blink"><circle cx="202" cy="174" r="2.6" fill="#221f28"/><circle cx="218" cy="174" r="2.6" fill="#221f28"/></g>' +
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
    // two training dummies with blinking eyes
    '<g class="a-bob" style="animation-delay:.2s">' +
      '<rect x="118" y="156" width="16" height="84" rx="7" fill="' + wood + '"/>' +
      '<circle cx="126" cy="142" r="22" fill="' + tan + '"/>' +
      '<g class="a-blink"><circle cx="119" cy="137" r="3.4" fill="#221f28"/><circle cx="133" cy="137" r="3.4" fill="#221f28"/></g>' +
      '<rect x="100" y="164" width="52" height="9" rx="4.5" fill="' + woodD + '"/>' +
    '</g>' +
    '<g class="a-bob" style="animation-delay:.9s">' +
      '<rect x="286" y="156" width="16" height="84" rx="7" fill="' + wood + '"/>' +
      '<circle cx="294" cy="142" r="22" fill="' + tan + '"/>' +
      '<g class="a-blink" style="animation-delay:.4s"><circle cx="287" cy="137" r="3.4" fill="#221f28"/><circle cx="301" cy="137" r="3.4" fill="#221f28"/></g>' +
      '<rect x="268" y="164" width="52" height="9" rx="4.5" fill="' + woodD + '"/>' +
    '</g>' +
    // torches
    '<rect x="56" y="190" width="9" height="58" rx="4.5" fill="' + woodD + '"/>' +
    '<ellipse class="a-flame" cx="60.5" cy="180" rx="11" ry="17" fill="#f2a254"/>' +
    '<ellipse class="a-flame" cx="60.5" cy="180" rx="5.5" ry="9.5" fill="#f6c98a" style="animation-delay:.25s"/>' +
    '<rect x="355" y="190" width="9" height="58" rx="4.5" fill="' + woodD + '"/>' +
    '<ellipse class="a-flame" cx="359.5" cy="180" rx="11" ry="17" fill="#f2a254" style="animation-delay:.5s"/>' +
    '<ellipse class="a-flame" cx="359.5" cy="180" rx="5.5" ry="9.5" fill="#f6c98a" style="animation-delay:.75s"/>' +
    // little fence
    '<rect x="196" y="218" width="7" height="24" fill="' + wood + '"/>' +
    '<rect x="217" y="218" width="7" height="24" fill="' + wood + '"/>' +
    '<rect x="238" y="218" width="7" height="24" fill="' + wood + '"/>' +
    '<rect x="190" y="222" width="62" height="6" rx="3" fill="' + woodD + '"/>' +
    '<rect x="190" y="232" width="62" height="6" rx="3" fill="' + woodD + '"/>'
  );
}

function _sceneLab() {
  return (
    _flask(105, 214, 0) +
    _flask(185, 220, 0.7) +
    _flask(300, 214, 1.3) +
    // floating bubbles
    '<circle class="a-bub" cx="150" cy="150" r="4" fill="#7fe3c4" opacity="0.8"/>' +
    '<circle class="a-bub" cx="270" cy="160" r="3" fill="#7fe3c4" opacity="0.8" style="animation-delay:1.4s"/>' +
    '<circle class="a-bub" cx="120" cy="140" r="2.4" fill="#7fe3c4" opacity="0.8" style="animation-delay:.7s"/>' +
    // test-tube rack
    '<rect x="238" y="226" width="42" height="6" rx="3" fill="#3a5f55"/>' +
    '<rect x="242" y="232" width="5" height="18" rx="2" fill="#b8e8dc" opacity="0.5"/>' +
    '<rect x="254" y="232" width="5" height="18" rx="2" fill="#2dd4bf" opacity="0.8"/>' +
    '<rect x="266" y="232" width="5" height="18" rx="2" fill="#b8e8dc" opacity="0.5"/>'
  );
}

function _sceneStadium() {
  const green = "#3f9d5a", white = "#f3efe8";
  return (
    // grass + field lines
    '<ellipse cx="210" cy="248" rx="150" ry="30" fill="' + green + '" opacity="0.9"/>' +
    '<rect x="66" y="240" width="288" height="3" fill="' + white + '" opacity="0.45"/>' +
    '<rect x="66" y="250" width="288" height="3" fill="' + white + '" opacity="0.35"/>' +
    // goal on the right
    '<rect x="330" y="176" width="5" height="64" fill="' + white + '"/>' +
    '<rect x="352" y="176" width="5" height="64" fill="' + white + '"/>' +
    '<rect x="327" y="174" width="33" height="5" rx="2" fill="' + white + '"/>' +
    '<path d="M333 210 h19 M333 222 h19 M333 234 h19" stroke="' + white + '" stroke-width="2" opacity="0.5"/>' +
    // corner flags waving
    '<g class="a-sway"><rect x="78" y="196" width="4" height="46" fill="' + white + '" opacity="0.8"/>' +
    '<path d="M82 196 l26 4 -26 8 z" fill="' + green + '" stroke="#1d4a2e" stroke-width="1.5"/></g>' +
    '<g class="a-sway" style="animation-delay:1.1s"><rect x="330" y="236" width="4" height="20" fill="' + white + '" opacity="0.8"/>' +
    '<path d="M334 236 l16 3 -16 6 z" fill="' + green + '" stroke="#1d4a2e" stroke-width="1.5"/></g>' +
    // floodlights
    '<rect x="60" y="120" width="5" height="76" fill="#2c3b31"/>' +
    '<circle class="a-twinkle" cx="62.5" cy="116" r="9" fill="#eaffea" opacity="0.85"/>' +
    '<rect x="355" y="128" width="5" height="68" fill="#2c3b31"/>' +
    '<circle class="a-twinkle" cx="357.5" cy="124" r="9" fill="#eaffea" opacity="0.85" style="animation-delay:1.4s"/>'
  );
}

function _sceneMuseum() {
  const marble = "#e8e2d6";
  return (
    // marble columns
    '<rect x="84" y="206" width="14" height="46" fill="' + marble + '"/>' +
    '<rect x="80" y="200" width="22" height="8" rx="2" fill="' + marble + '"/>' +
    '<rect x="80" y="250" width="22" height="7" rx="2" fill="#c9bfae"/>' +
    '<rect x="322" y="206" width="14" height="46" fill="' + marble + '"/>' +
    '<rect x="318" y="200" width="22" height="8" rx="2" fill="' + marble + '"/>' +
    '<rect x="318" y="250" width="22" height="7" rx="2" fill="#c9bfae"/>' +
    // a statue with eyes
    '<g class="a-bob" style="animation-delay:.4s">' +
      '<rect x="150" y="224" width="30" height="28" rx="3" fill="' + marble + '"/>' +
      '<circle cx="165" cy="212" r="13" fill="' + marble + '"/>' +
      '<circle cx="165" cy="192" r="11" fill="' + marble + '"/>' +
      '<g class="a-blink" style="animation-delay:.9s"><circle cx="160" cy="190" r="2.4" fill="#5a5148"/><circle cx="170" cy="190" r="2.4" fill="#5a5148"/></g>' +
    '</g>' +
    // amphorae
    '<ellipse cx="258" cy="246" rx="13" ry="16" fill="#c98d4b"/>' +
    '<rect x="253" y="220" width="10" height="12" rx="3" fill="#c98d4b"/>' +
    '<rect x="250" y="216" width="16" height="5" rx="2.5" fill="#a36a2f"/>' +
    '<ellipse cx="120" cy="250" rx="11" ry="13" fill="#c98d4b" opacity="0.85"/>' +
    '<rect x="116" y="228" width="8" height="10" rx="3" fill="#c98d4b" opacity="0.85"/>'
  );
}

function _sceneMath(c1, c2) {
  return (
    // four pedestals with floating solids
    '<rect x="94" y="232" width="10" height="18" rx="2" fill="' + c2 + '"/>' +
    '<g class="a-bob a-spin" style="animation-delay:.2s">' +
      '<rect x="88" y="186" width="22" height="22" rx="3" fill="' + c1 + '" opacity="0.85"/>' +
      '<path d="M88 186 l11 -8 11 8 -11 8 z" fill="' + c2 + '"/>' +
    '</g>' +
    '<rect x="164" y="232" width="10" height="18" rx="2" fill="' + c2 + '"/>' +
    '<g class="a-bob a-spin" style="animation-delay:.7s">' +
      '<path d="M169 206 l24 0 -12 22 z" fill="' + c2 + '" opacity="0.9" stroke="' + c1 + '" stroke-width="2"/>' +
    '</g>' +
    '<rect x="234" y="232" width="10" height="18" rx="2" fill="' + c2 + '"/>' +
    '<g class="a-bob a-spin" style="animation-delay:1.1s">' +
      '<circle cx="239" cy="199" r="13" fill="' + c1 + '" opacity="0.4" stroke="' + c1 + '" stroke-width="3"/>' +
    '</g>' +
    '<rect x="304" y="232" width="10" height="18" rx="2" fill="' + c2 + '"/>' +
    '<g class="a-bob a-spin" style="animation-delay:1.5s">' +
      '<ellipse cx="309" cy="199" rx="17" ry="10" fill="none" stroke="' + c1 + '" stroke-width="6"/>' +
    '</g>' +
    // glowing edge sparks
    '<circle class="a-twinkle" cx="180" cy="150" r="2" fill="' + c1 + '"/>' +
    '<circle class="a-twinkle" cx="252" cy="160" r="2" fill="' + c1 + '" style="animation-delay:1.2s"/>' +
    '<circle class="a-twinkle" cx="130" cy="170" r="2" fill="' + c1 + '" style="animation-delay:.6s"/>'
  );
}

function _sceneColosseum(c1) {
  const stone = "#9c6b4f", sand = "#c8a061";
  return (
    // sand floor
    '<ellipse cx="210" cy="248" rx="150" ry="30" fill="' + sand + '" opacity="0.9"/>' +
    // ring of arches
    '<path d="M70 252 v-58 a26 26 0 0 1 52 0 v58" fill="none" stroke="' + stone + '" stroke-width="10"/>' +
    '<path d="M184 252 v-66 a28 28 0 0 1 56 0 v66" fill="none" stroke="' + stone + '" stroke-width="10"/>' +
    '<path d="M298 252 v-58 a26 26 0 0 1 52 0 v58" fill="none" stroke="' + stone + '" stroke-width="10"/>' +
    // torches on the arches
    '<ellipse class="a-flame" cx="96" cy="176" rx="9" ry="14" fill="#f2a254"/>' +
    '<ellipse class="a-flame" cx="96" cy="176" rx="4.5" ry="8" fill="#f6c98a" style="animation-delay:.3s"/>' +
    '<ellipse class="a-flame" cx="212" cy="170" rx="9" ry="14" fill="#f2a254" style="animation-delay:.7s"/>' +
    '<ellipse class="a-flame" cx="212" cy="170" rx="4.5" ry="8" fill="#f6c98a" style="animation-delay:1s"/>' +
    '<ellipse class="a-flame" cx="324" cy="176" rx="9" ry="14" fill="#f2a254" style="animation-delay:1.3s"/>' +
    // small battlements
    '<rect x="118" y="238" width="10" height="14" fill="' + stone + '"/>' +
    '<rect x="292" y="238" width="10" height="14" fill="' + stone + '"/>' +
    '<rect x="156" y="240" width="8" height="12" fill="' + stone + '"/>' +
    '<rect x="256" y="240" width="8" height="12" fill="' + stone + '"/>' +
    // red banner
    '<g class="a-sway" style="animation-delay:.5s"><rect x="205" y="130" width="4" height="34" fill="#5a4030"/>' +
    '<path d="M209 132 l26 6 -26 8 z" fill="' + c1 + '"/></g>'
  );
}

function _sceneLegends(c1) {
  const gold = "#e9b64f";
  return (
    // golden pillars
    '<rect x="64" y="128" width="20" height="122" fill="' + gold + '"/>' +
    '<rect x="58" y="120" width="32" height="10" rx="2" fill="#d9a43c"/>' +
    '<rect x="336" y="128" width="20" height="122" fill="' + gold + '"/>' +
    '<rect x="330" y="120" width="32" height="10" rx="2" fill="#d9a43c"/>' +
    // light beams
    '<polygon class="a-ray" points="210,0 246,150 174,150" fill="#ffe9a8"/>' +
    '<polygon class="a-ray" style="animation-delay:1.6s" points="120,0 152,150 88,150" fill="#ffe9a8" opacity="0.6"/>' +
    '<polygon class="a-ray" style="animation-delay:3s" points="300,0 332,150 268,150" fill="#ffe9a8" opacity="0.6"/>' +
    // floating rings
    '<ellipse class="a-bob" cx="140" cy="150" rx="26" ry="8" fill="none" stroke="' + gold + '" stroke-width="4" opacity="0.8"/>' +
    '<ellipse class="a-bob" cx="282" cy="138" rx="22" ry="7" fill="none" stroke="' + gold + '" stroke-width="4" opacity="0.8" style="animation-delay:1.2s"/>' +
    // sparkles
    '<circle class="a-twinkle" cx="150" cy="120" r="2.6" fill="#fff3c4"/>' +
    '<circle class="a-twinkle" cx="270" cy="112" r="2.2" fill="#fff3c4" style="animation-delay:.8s"/>' +
    '<circle class="a-twinkle" cx="210" cy="100" r="2.8" fill="#fff3c4" style="animation-delay:1.6s"/>' +
    '<circle class="a-twinkle" cx="120" cy="100" r="2" fill="#fff3c4" style="animation-delay:2.2s"/>' +
    '<circle class="a-twinkle" cx="300" cy="104" r="2" fill="#fff3c4" style="animation-delay:2.8s"/>'
  );
}

// assemble one arena's SVG (island + theme props + the heart trophy)
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
  const trophy = i === 6
    ? '<g transform="translate(210 210) scale(1.45) translate(-210 -210)">' + _trophySVG() + '</g>'
    : _trophySVG();
  return (
    '<svg class="a-svg" viewBox="0 0 420 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
      _islandSVG(c1, c2) +
      extra +
      trophy +
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
