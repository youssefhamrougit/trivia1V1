// ============================================================================
//  arenaViewer.js — the Clash-Royale-style 3D arena browser.
//
//  Opens on the "Arenas" screen: a Three.js stage with all 7 arenas built
//  procedurally (no model files needed) and laid out in a row. Drag the
//  stage (the arena follows your finger), use the mouse wheel / trackpad,
//  the ‹ › arrows, the arrow keys, or tap a thumbnail to glide between
//  arenas — just like Clash Royale's arena selection.
//
//  If WebGL isn't available the stage falls back to a simple scrollable
//  list of arena cards, so the screen always works.
//
//  Uses the global `ARENAS` array from arenas.js (names, icons, trophy
//  thresholds and color themes).
// ============================================================================

let _viewer = null; // { renderer, scene, cam, spacing, cur, target, anims, running, raf, last }
let _anims = [];    // animated props: { o, spinY?, spinX?, flicker?, orbit?, ... }

// ---- tiny helpers -----------------------------------------------------------

function _mat(color, opts) {
  opts = opts || {};
  return new THREE.MeshStandardMaterial({
    color: color,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.15,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.6,
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.emissiveIntensity || 0,
    side: opts.side || THREE.FrontSide,
  });
}

function _mesh(geo, material, x, y, z, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function _spin(mesh, ry, phase) { _anims.push({ o: mesh, spinY: ry, phase: phase || 0 }); }
function _flicker(mesh, baseY, speed, phase) {
  _anims.push({ o: mesh, flicker: true, baseY: baseY, speed: speed, phase: phase || 0 });
}
function _orbit(mesh, r, y0, speed, phase) {
  _anims.push({ o: mesh, orbit: r, y0: y0, speed: speed, phase: phase });
}

// a little golden trophy (bowl + stem + base + handles)
function _trophy(c1) {
  const gold = _mat(0xe9b64f, { metalness: 0.7, roughness: 0.3, emissive: 0xe9b64f, emissiveIntensity: 0.25 });
  const g = new THREE.Group();
  _mesh(new THREE.ConeGeometry(0.3, 0.36, 16), gold, 0, 0.52, 0, g);
  _mesh(new THREE.CylinderGeometry(0.055, 0.09, 0.32, 12), gold, 0, 0.2, 0, g);
  _mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.1, 16), gold, 0, 0.02, 0, g);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 16), gold);
    h.position.set(s * 0.19, 0.38, 0);
    g.add(h);
  }
  return g;
}

// ---- build one arena's 3D scene ---------------------------------------------

function _buildArena3D(i) {
  const a = ARENAS[i];
  const g = new THREE.Group();
  const c1 = new THREE.Color(a.theme.c1);
  const c2 = new THREE.Color(a.theme.c2);
  const dark = c2.clone().multiplyScalar(0.5);
  const mid = c2.clone().multiplyScalar(0.85);

  // ground disc + platform (shared by every arena)
  _mesh(new THREE.CylinderGeometry(4.3, 4.5, 0.3, 40), _mat(0x141210), 0, -0.95, 0, g);
  _mesh(new THREE.CylinderGeometry(2.15, 2.4, 0.7, 40), _mat(dark), 0, 0.08, 0, g);
  _mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.14, 40), _mat(mid), 0, 0.5, 0, g);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.1, 10, 48),
    _mat(c1, { emissive: c1, emissiveIntensity: 0.2 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.6;
  g.add(rim);

  // center pedestal with trophy
  _mesh(new THREE.CylinderGeometry(0.5, 0.64, 1.0, 24), _mat(mid), 0, 1.05, 0, g);
  _mesh(new THREE.CylinderGeometry(0.32, 0.5, 0.16, 24), _mat(c1, { emissive: c1, emissiveIntensity: 0.25 }), 0, 1.63, 0, g);
  const trophy = _trophy(c1);
  trophy.position.y = 1.8;
  g.add(trophy);

  // two towers + flags (skipped on the Hall of Legends, which has its own pillars)
  if (i < ARENAS.length - 1) {
    for (const s of [-1, 1]) {
      _mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.6, 20), _mat(mid), s * 1.55, 1.25, 1.5, g);
      _mesh(new THREE.ConeGeometry(0.34, 0.55, 20), _mat(c1, { emissive: c1, emissiveIntensity: 0.25 }), s * 1.55, 2.2, 1.5, g);
      _mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 10), _mat(0x6b6255), s * 1.6, 1.7, -1.7, g);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.55), _mat(c1, { side: THREE.DoubleSide }));
      flag.position.set(s * 1.6 + s * 0.5, 2.6, -1.7);
      flag.rotation.y = s * -0.35;
      g.add(flag);
    }
  }

  // ---- themed decorations -------------------------------------------------
  if (i === 0) {
    // Training Grounds: wooden dummies + flickering torches
    const wood = _mat(0x8a6b4a);
    const head = _mat(0xcfa974);
    for (const s of [-1, 1]) {
      _mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 10), wood, s * 1.3, 1.1, -0.4, g);
      _mesh(new THREE.SphereGeometry(0.2, 12, 10), head, s * 1.3, 1.85, -0.4, g);
      _mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 10), wood, s * 1.5, 1.15, 0.7, g);
      const flame = _mesh(new THREE.ConeGeometry(0.14, 0.35, 10),
        _mat(0xf2a254, { emissive: 0xf2a254, emissiveIntensity: 1.2 }), s * 1.5, 2.0, 0.7, g);
      _flicker(flame, 2.0, 3 + s, s);
    }
  } else if (i === 1) {
    // Science Lab: glowing flasks + floating orbs
    const glass = _mat(0x7fe3c4, { emissive: 0x2dd4bf, emissiveIntensity: 0.45 });
    const orbMat = _mat(c1, { emissive: c1, emissiveIntensity: 1.4 });
    const spots = [[-1.35, -1.3], [1.35, -1.3], [0, 1.7]];
    for (let k = 0; k < spots.length; k++) {
      const b = new THREE.Group();
      _mesh(new THREE.SphereGeometry(0.2, 14, 10), glass, 0, 0.22, 0, b);
      _mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 10), glass, 0, 0.48, 0, b);
      b.position.set(spots[k][0], 0.5, spots[k][1]);
      g.add(b);
      _flicker(b, 0.5, 1.4, k);
    }
    for (let k = 0; k < 3; k++) {
      const orb = _mesh(new THREE.SphereGeometry(0.09, 10, 8), orbMat, 0, 0, 0, g);
      _orbit(orb, 1.5, 2.3, 0.5 + k * 0.2, k * 2.1);
    }
  } else if (i === 2) {
    // Football Stadium: grass pitch + white goal posts
    _mesh(new THREE.CylinderGeometry(2.03, 2.03, 0.06, 40), _mat(0x3f9d5a), 0, 0.62, 0, g);
    for (const dz of [-1.2, 0, 1.2]) {
      _mesh(new THREE.BoxGeometry(3.4, 0.05, 0.05), _mat(0xe9f2e6), 0, 0.66, dz, g);
    }
    const white = _mat(0xf3efe8);
    for (const s of [-1, 1]) {
      _mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8), white, s * 0.55, 1.7, -2.05, g);
    }
    _mesh(new THREE.BoxGeometry(1.16, 0.08, 0.08), white, 0, 2.75, -2.05, g);
    _mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), white, 0, 1.35, -2.6, g);
  } else if (i === 3) {
    // History Museum: marble columns + a statue
    const marble = _mat(0xe8e2d6, { roughness: 0.4 });
    const cols = [[-1.5, -1.2], [1.5, -1.2], [-1.5, 0.6], [1.5, 0.6]];
    for (const [x, z] of cols) {
      _mesh(new THREE.CylinderGeometry(0.18, 0.2, 1.4, 14), marble, x, 1.2, z, g);
      _mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46), marble, x, 1.98, z, g);
    }
    const statue = new THREE.Group();
    _mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 12), marble, 0, 0.25, 0, statue);
    _mesh(new THREE.SphereGeometry(0.2, 12, 10), marble, 0, 0.62, 0, statue);
    statue.position.set(0, 0.5, -1.3);
    g.add(statue);
    _flicker(statue, 1.12, 0.6, 1.3);
  } else if (i === 4) {
    // Math Arena: floating solids on small pedestals
    const solids = [
      new THREE.IcosahedronGeometry(0.28, 0),
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.TorusKnotGeometry(0.2, 0.07, 60, 10),
      new THREE.DodecahedronGeometry(0.26, 0),
    ];
    const spots = [[-1.45, -1.1], [1.45, -1.1], [-1.45, 0.9], [1.45, 0.9]];
    for (let k = 0; k < solids.length; k++) {
      const [x, z] = spots[k];
      _mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.9, 10), _mat(c2), x, 0.95, z, g);
      const solid = new THREE.Mesh(solids[k], _mat(c1, { emissive: c1, emissiveIntensity: 0.5, roughness: 0.35 }));
      solid.position.set(x, 1.7, z);
      g.add(solid);
      _spin(solid, 0.8 + (k % 2) * 0.4, k);
    }
  } else if (i === 5) {
    // Grand Colosseum: ring of stone columns + torches on a sand floor
    const stone = _mat(0x9c6b4f);
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      _mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.0, 12), stone,
        Math.cos(ang) * 2.7, 1.0, Math.sin(ang) * 2.7, g);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.16, 10, 40), stone);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 2.05;
    g.add(ring);
    _mesh(new THREE.CylinderGeometry(2.03, 2.03, 0.06, 40), _mat(0xc8a061), 0, 0.62, 0, g);
    for (const [x, z] of [[2.7, 0], [-2.7, 0], [0, 2.7], [0, -2.7]]) {
      const flame = _mesh(new THREE.ConeGeometry(0.16, 0.4, 10),
        _mat(0xf2a254, { emissive: 0xf2a254, emissiveIntensity: 1.3 }), x, 2.5, z, g);
      _flicker(flame, 2.5, 2.2, x + z);
    }
  } else {
    // Hall of Legends: golden pillars, light beam, floating rings + sparkles
    const gold = _mat(0xe9b64f, { metalness: 0.8, roughness: 0.25, emissive: 0xe9b64f, emissiveIntensity: 0.25 });
    for (const [x, z] of [[-1.75, -1.5], [1.75, -1.5], [-1.75, 1.5], [1.75, 1.5]]) {
      _mesh(new THREE.CylinderGeometry(0.2, 0.26, 2.6, 14), gold, x, 1.3, z, g);
    }
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7 + k * 0.25, 0.05, 10, 30), gold);
      ring.rotation.x = Math.PI / 2.6;
      ring.position.y = 2.7 + k * 0.45;
      g.add(ring);
      _spin(ring, 0.6, k * 2);
    }
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.0, 3.4, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 3.2;
    g.add(beam);
    const spark = _mat(0xfff3c4, { emissive: 0xfff3c4, emissiveIntensity: 1.6 });
    for (let k = 0; k < 8; k++) {
      const s = _mesh(new THREE.SphereGeometry(0.05, 8, 6), spark, 0, 0, 0, g);
      _orbit(s, 1.1 + (k % 3) * 0.35, 1.9 + (k % 4) * 0.5, 0.4 + (k % 3) * 0.25, k * 0.8);
    }
  }

  return g;
}

// ---- init -------------------------------------------------------------------

function _initViewer() {
  const canvas = document.getElementById("arena3d");
  if (!canvas || typeof THREE === "undefined") return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    return null; // WebGL unavailable — the caller shows the 2D fallback
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0d0b);
  // fog starts past the neighbours so you can see the next arena sliding in
  scene.fog = new THREE.Fog(0x0e0d0b, 12, 30);

  // low, close camera so the current arena fills the stage
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  cam.position.set(0, 2.35, 5.6);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a2f24, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(4, 7, 5);
  scene.add(dir);

  const SPACING = 7;
  _anims = [];
  for (let i = 0; i < ARENAS.length; i++) {
    const g = _buildArena3D(i);
    g.position.x = i * SPACING;
    scene.add(g);
  }

  _viewer = {
    renderer: renderer, scene: scene, cam: cam,
    spacing: SPACING, cur: 0, target: 0,
    anims: _anims, running: false, raf: 0, last: 0,
  };
  _resize();
  return _viewer;
}

// ---- render loop --------------------------------------------------------------

function _animStep(now) {
  const tt = now * 0.001;
  for (const a of _viewer.anims) {
    if (a.orbit) {
      a.o.position.x = Math.cos(tt * a.speed + a.phase) * a.orbit;
      a.o.position.z = Math.sin(tt * a.speed + a.phase) * a.orbit;
      a.o.position.y = a.y0 + Math.sin(tt * 1.3 + a.phase) * 0.15;
      a.o.rotation.y = tt * 0.6;
    } else {
      if (a.flicker) a.o.position.y = a.baseY + Math.sin(tt * a.speed + a.phase) * 0.06;
      if (a.spinY) a.o.rotation.y += a.spinY * 0.016;
      if (a.spinX) a.o.rotation.x += a.spinX * 0.016;
    }
  }
}

function _frame(now) {
  if (!_viewer || !_viewer.running) return;
  _viewer.raf = requestAnimationFrame(_frame);
  const dt = Math.min(0.05, (now - (_viewer.last || now)) / 1000);
  _viewer.last = now;
  _animStep(now);

  // ease the camera toward the selected arena (Clash-Royale glide).
  // while the user drags, pointermove sets the position directly and
  // keeps target in sync, so the tween never fights the drag.
  const tx = _viewer.target * _viewer.spacing;
  _viewer.cam.position.x += (tx - _viewer.cam.position.x) * Math.min(1, dt * 7);
  _viewer.cam.lookAt(_viewer.cam.position.x, 1.15, 0);
  _viewer.renderer.render(_viewer.scene, _viewer.cam);
}

function _resize() {
  if (!_viewer) return;
  const stage = document.getElementById("arena-stage");
  if (!stage) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  _viewer.renderer.setSize(w, h, false);
  _viewer.cam.aspect = w / h;
  _viewer.cam.updateProjectionMatrix();
}
window.addEventListener("resize", _resize);

// ---- public API (called from app.js + index.html) -----------------------------

function openArenaViewer() {
  const trophies = (currentProfile && currentProfile.trophies) || 0;
  if (!_viewer) {
    _viewer = _initViewer();
    if (!_viewer) {
      // no WebGL — show the 2D arena list instead
      _buildTiles(trophies);
      _showFallback(trophies);
      return;
    }
  }
  const cur = ARENAS.findIndex(function (a) { return a.id === arenaForTrophies(trophies).id; });
  _viewer.cur = cur < 0 ? 0 : cur;
  _viewer.target = _viewer.cur;
  _viewer.cam.position.x = _viewer.cur * _viewer.spacing;
  _resize();
  _buildTiles(trophies);
  _updateHUD(trophies);
  if (!_viewer.running) {
    _viewer.running = true;
    _viewer.last = 0;
    _viewer.raf = requestAnimationFrame(_frame);
  }
}

function closeArenaViewer() {
  if (_viewer) _viewer.running = false;
}

function arenaGo3D(i) {
  if (!_viewer) return;
  i = Math.max(0, Math.min(ARENAS.length - 1, i));
  _viewer.target = i;
  _viewer.cur = i;
  _updateHUD((currentProfile && currentProfile.trophies) || 0);
}

function arenaPrev() { if (_viewer) arenaGo3D(_viewer.cur - 1); }
function arenaNext() { if (_viewer) arenaGo3D(_viewer.cur + 1); }

// ---- HUD + thumbnails ----------------------------------------------------------

function _updateHUD(trophies) {
  if (!_viewer) return;
  const a = ARENAS[_viewer.cur];
  const mine = arenaForTrophies(trophies);

  const name = document.getElementById("arena3d-name");
  const req = document.getElementById("arena3d-req");
  const badge = document.getElementById("arena3d-current");
  if (name) name.textContent = a.name;
  if (req) {
    req.textContent = mine.id === a.id
      ? "You're climbing here"
      : a.min === 0
        ? "Everyone starts here"
        : trophies >= a.min
          ? "Unlocked at " + a.min + " trophies"
          : "Reach " + a.min + " trophies to unlock";
  }
  if (badge) {
    const locked = mine.id !== a.id && trophies < a.min;
    badge.classList.toggle("locked", locked);
    if (locked) badge.style.removeProperty("background"); // let the .locked style dim it
    else badge.style.background = a.theme.c1;
    badge.textContent = mine.id === a.id ? "★ Your arena" : trophies >= a.min ? "Unlocked" : "Locked";
  }

  const prev = document.getElementById("arena3d-prev");
  const next = document.getElementById("arena3d-next");
  if (prev) prev.classList.toggle("off", _viewer.cur === 0);
  if (next) next.classList.toggle("off", _viewer.cur === ARENAS.length - 1);

  const tiles = document.querySelectorAll(".a3d-tile");
  tiles.forEach(function (t, i) { t.classList.toggle("current", i === _viewer.cur); });
  const curTile = tiles[_viewer.cur];
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

// ---- 2D fallback (shown when WebGL isn't available) -----------------------------

function _showFallback(trophies) {
  const stage = document.getElementById("arena-stage");
  if (!stage) return;
  stage.classList.add("fallback");
  stage.innerHTML = "";
  const mine = arenaForTrophies(trophies);
  ARENAS.forEach(function (a) {
    const card = document.createElement("div");
    const isCur = mine.id === a.id;
    const locked = trophies < a.min;
    card.className = "a3d-fb" + (isCur ? " current" : "") + (locked ? " locked" : "");
    card.innerHTML =
      '<img src="' + a.icon + '" alt="' + esc(a.name) + '">' +
      "<b>" + esc(a.name) + "</b>" +
      "<span>" + (isCur
        ? "★ Your arena"
        : locked
          ? "Locked — reach " + a.min + " trophies"
          : "Unlocked at " + a.min + " trophies") + "</span>";
    stage.appendChild(card);
  });
}

// ---- input: drag the stage, mouse wheel, arrow keys ------------------------------

(function bindArenaInput() {
  const canvas = document.getElementById("arena3d");
  if (canvas) {
    let downX = null, startCamX = 0, dragActive = false;

    canvas.addEventListener("pointerdown", function (e) {
      if (!_viewer) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      downX = e.clientX;
      startCamX = _viewer.cam.position.x;
      dragActive = false;
    });

    canvas.addEventListener("pointermove", function (e) {
      if (downX === null || !_viewer) return;
      const dx = e.clientX - downX;
      if (!dragActive && Math.abs(dx) > 8) dragActive = true;
      if (dragActive) {
        const stage = document.getElementById("arena-stage");
        const scale = stage && stage.clientWidth ? (_viewer.spacing * 1.15) / stage.clientWidth : 0.02;
        let nx = startCamX - dx * scale;
        nx = Math.max(0, Math.min((ARENAS.length - 1) * _viewer.spacing, nx));
        _viewer.cam.position.x = nx;
        _viewer.target = nx / _viewer.spacing; // fractional index — keeps the tween from fighting the drag
      }
    });

    function endDrag() {
      if (downX === null || !_viewer) return;
      if (dragActive) {
        // release → glide to the nearest arena
        const i = Math.round(_viewer.cam.position.x / _viewer.spacing);
        _viewer.cur = i;
        _viewer.target = i;
        _updateHUD((currentProfile && currentProfile.trophies) || 0);
      }
      downX = null;
      dragActive = false;
    }

    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
  }

  // mouse wheel / trackpad: scroll through the arenas
  const stage = document.getElementById("arena-stage");
  if (stage) {
    let wheelCooldown = 0;
    stage.addEventListener("wheel", function (e) {
      if (!_viewer) return;
      const now = Date.now();
      if (now < wheelCooldown) return;
      const dx = e.deltaX || e.deltaY;
      if (Math.abs(dx) < 8) return;
      if (dx > 0) arenaNext(); else arenaPrev();
      wheelCooldown = now + 260;
      e.preventDefault();
    }, { passive: false });
  }

  document.addEventListener("keydown", function (e) {
    const sc = document.getElementById("screen-arenas");
    if (!sc || !sc.classList.contains("active")) return;
    if (e.key === "ArrowLeft") { arenaPrev(); e.preventDefault(); }
    else if (e.key === "ArrowRight") { arenaNext(); e.preventDefault(); }
  });
})();
