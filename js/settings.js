// ============================================================================
//  settings.js — Trivia1v1 settings: language, music volume, SFX volume
//
//  Persists preferences to localStorage.
//  Language switches all UI text via a translation map.
//  Volume sliders control Music and Sound gain in real-time.
// ============================================================================

const Settings = (function () {
  // ---- defaults -----------------------------------------------------------
  let lang = "en";
  let musicVol = 75;   // 0–100
  let sfxVol = 80;     // 0–100

  // ---- i18n translation map -----------------------------------------------
  // Keys use a simple dot-path like "home.find_match" for nested selectors.
  // Each language object mirrors the EN keys.
  const translations = {
    en: {
      // auth screen
      "auth.username_placeholder": "username",
      "auth.password_placeholder": "password (at least 6 characters)",
      "auth.create_account": "Create account",
      "auth.log_in": "Log in",
      "auth.or": "or",
      "auth.guest": "Continue as guest",
      // home screen
      "home.profile": "Profile",
      "home.arena_title": "Your <span class=\"accent\">Arena</span>",
      "home.arena_subtitle": "Win matches to climb the Knowledge Ladder.",
      "home.current_arena": "Current arena",
      "home.find_match": "Find a match",
      "home.practice": "Practice vs. QuizBot",
      "home.practice_note": "Practice matches don't change your trophies.",
      "home.trophies": "Trophies",
      "home.wins": "Wins",
      "home.losses": "Losses",
      "home.friends": "Friends",
      "home.leaderboard": "Leaderboard",
      // match screen
      "match.finding": "Finding opponent…",
      "match.queue_desc": "Someone, somewhere, is tapping the same button.",
      "match.waiting": "Waiting…",
      "match.scanning": "Scanning the arena for a worthy opponent…",
      "match.cancel": "Cancel",
      "match.vs": "VS",
      // result screen
      "result.challenge_friend": "Challenge a friend",
      "result.rematch": "Rematch",
      "result.home": "Home",
      // friends screen
      "friends.title": "Friends",
      "friends.add_tab": "Add Friend",
      "friends.requests_tab": "Requests",
      "friends.add_heading": "Add a friend",
      "friends.add_desc": "Find them by username and send a request.",
      "friends.search_placeholder": "username…",
      "friends.search": "Search",
      // settings screen
      "settings.title": "Settings",
      "settings.language": "Language",
      "settings.music_volume": "Music Volume",
      "settings.sfx_volume": "Sound Effects",
      "settings.back": "Back",
      // other
      "other.stats_history": "Stats & history",
      "other.sign_out": "Sign out",
      "other.back": "← Back",
    },

    ar: {
      "auth.username_placeholder": "اسم المستخدم",
      "auth.password_placeholder": "كلمة المرور (٦ أحرف على الأقل)",
      "auth.create_account": "إنشاء حساب",
      "auth.log_in": "تسجيل الدخول",
      "auth.or": "أو",
      "auth.guest": "المتابعة كضيف",
      "home.profile": "الملف الشخصي",
      "home.arena_title": "<span class=\"accent\">ساحتك</span>",
      "home.arena_subtitle": "اربح المباريات لتسلّم سلّم المعرفة.",
      "home.current_arena": "الساحة الحالية",
      "home.find_match": "ابحث عن مباراة",
      "home.practice": "تمارين ضد بوت المسابقة",
      "home.practice_note": "مباريات التمارين لا تغيّر كؤوسك.",
      "home.trophies": "الكؤوس",
      "home.wins": "الفوز",
      "home.losses": "الخسارة",
      "home.friends": "الأصدقاء",
      "home.leaderboard": "لوحة الصدارة",
      "match.finding": "جارٍ البحث عن خصم…",
      "match.queue_desc": "شخص ما، في مكان ما، يضغط الزر نفسه.",
      "match.waiting": "انتظار…",
      "match.scanning": "جارٍ مسح الساحة بحثًا عن خصم جدير…",
      "match.cancel": "إلغاء",
      "match.vs": "ضد",
      "result.challenge_friend": "تحدي صديق",
      "result.rematch": "إعادة المباراة",
      "result.home": "الرئيسية",
      "friends.title": "الأصدقاء",
      "friends.add_tab": "إضافة صديق",
      "friends.requests_tab": "الطلبات",
      "friends.add_heading": "أضف صديقًا",
      "friends.add_desc": "ابحث عنه بالاسم وأرسل طلبًا.",
      "friends.search_placeholder": "اسم المستخدم…",
      "friends.search": "بحث",
      "settings.title": "الإعدادات",
      "settings.language": "اللغة",
      "settings.music_volume": "صوت الموسيقى",
      "settings.sfx_volume": "المؤثرات الصوتية",
      "settings.back": "رجوع",
      "other.stats_history": "الإحصائيات والتاريخ",
      "other.sign_out": "تسجيل الخروج",
      "other.back": "← رجوع",
    },

    fr: {
      "auth.username_placeholder": "nom d'utilisateur",
      "auth.password_placeholder": "mot de passe (6 caractères minimum)",
      "auth.create_account": "Créer un compte",
      "auth.log_in": "Se connecter",
      "auth.or": "ou",
      "auth.guest": "Continuer en tant qu'invité",
      "home.profile": "Profil",
      "home.arena_title": "Votre <span class=\"accent\">Arène</span>",
      "home.arena_subtitle": "Gagnez des matchs pour gravir l'Échelle du Savoir.",
      "home.current_arena": "Arène actuelle",
      "home.find_match": "Trouver un match",
      "home.practice": "Entraînement vs. QuizBot",
      "home.practice_note": "Les matchs d'entraînement ne changent pas vos trophées.",
      "home.trophies": "Trophées",
      "home.wins": "Victoires",
      "home.losses": "Défaites",
      "home.friends": "Amis",
      "home.leaderboard": "Classement",
      "match.finding": "Recherche d'un adversaire…",
      "match.queue_desc": "Quelqu'un, quelque part, appuie sur le même bouton.",
      "match.waiting": "En attente…",
      "match.scanning": "Scan de l'arène pour un adversaire digne…",
      "match.cancel": "Annuler",
      "match.vs": "VS",
      "result.challenge_friend": "Défier un ami",
      "result.rematch": "Revanche",
      "result.home": "Accueil",
      "friends.title": "Amis",
      "friends.add_tab": "Ajouter un ami",
      "friends.requests_tab": "Demandes",
      "friends.add_heading": "Ajouter un ami",
      "friends.add_desc": "Trouvez-les par nom et envoyez une demande.",
      "friends.search_placeholder": "nom d'utilisateur…",
      "friends.search": "Chercher",
      "settings.title": "Paramètres",
      "settings.language": "Langue",
      "settings.music_volume": "Volume de la musique",
      "settings.sfx_volume": "Effets sonores",
      "settings.back": "Retour",
      "other.stats_history": "Statistiques & historique",
      "other.sign_out": "Se déconnecter",
      "other.back": "← Retour",
    },
  };

  // ---- load persisted prefs -----------------------------------------------
  function load() {
    try {
      lang = localStorage.getItem("df_lang") || "en";
      musicVol = parseInt(localStorage.getItem("df_music_vol"), 10);
      sfxVol = parseInt(localStorage.getItem("df_sfx_vol"), 10);
      if (isNaN(musicVol)) musicVol = 75;
      if (isNaN(sfxVol)) sfxVol = 80;
      if (!translations[lang]) lang = "en";
    } catch (e) { /* private mode */ }
  }

  // ---- save prefs ---------------------------------------------------------
  function save() {
    try {
      localStorage.setItem("df_lang", lang);
      localStorage.setItem("df_music_vol", String(musicVol));
      localStorage.setItem("df_sfx_vol", String(sfxVol));
    } catch (e) { /* private mode */ }
  }

  // ---- translate a single key ---------------------------------------------
  function t(key) {
    const dict = translations[lang] || translations.en;
    return dict[key] || translations.en[key] || key;
  }

  // ---- apply all i18n text to the DOM -------------------------------------
  function applyTranslations() {
    // Auth screen
    setPH("auth-username", t("auth.username_placeholder"));
    setPH("auth-password", t("auth.password_placeholder"));
    setBtnText("#screen-auth .btn", t("auth.create_account"));
    setBtnText("#screen-auth .btn.ghost", t("auth.log_in"));
    setDivText("#screen-auth .divider", t("auth.or"));
    setBtnText("#screen-auth .btn.subtle.guest", t("auth.guest"));

    // Home screen
    setInner(".topbar .chip:first-child", t("home.profile"));
    setHTML("screen-trivia-home .screen-title", t("home.arena_title"));
    setNextText("arena-name", t("home.current_arena"));
    setBtnInner("screen-trivia-home .btn.big", t("home.find_match"), "assets/icons/bolt.svg");
    setBtnInner("screen-trivia-home .btn.ghost.bot-launch", t("home.practice"), "assets/icons/robot.svg");
    setSpanText("arena-next", t("home.practice_note"), true);

    // Stats row labels on home
    setStatLabel("trivia-trophies", t("home.trophies"));
    setStatLabel("trivia-wins", t("home.wins"));
    setStatLabel("trivia-losses", t("home.losses"));

    // Chip row
    setChipText("screen-friends", t("home.friends"), "assets/icons/gamepad.svg");
    setChipText("screen-leaderboard", t("home.leaderboard"), "assets/icons/trophy.svg");

    // Friends
    setInner("screen-friends .friends-title", t("friends.title"));
    setInner("tab-add", t("friends.add_tab"));
    setInner("tab-requests", t("friends.requests_tab"));
    setH3("friends-pane-add .card h3", t("friends.add_heading"));
    setFriendDesc(t("friends.add_desc"));
    setPH("friends-search", t("friends.search_placeholder"));
    setMiniBtn("friends-pane-add .mini-btn.primary", t("friends.search"));

    // Stats & signout
    setBtnInner("#screen-profile .btn.ghost", t("other.stats_history"), "assets/icons/trophy.svg");
    setBtnInner(".profile-signout", t("other.sign_out"), "assets/icons/gamepad.svg");

    // Back buttons
    setBackButtons(t("other.back"));

    // Settings
    setInner("settings-title", t("settings.title"));
    setLabel("settings-lang-label", t("settings.language"));
    setLabel("settings-music-label", t("settings.music_volume"));
    setLabel("settings-sfx-label", t("settings.sfx_volume"));
  }

  // ---- small DOM helpers ---------------------------------------------------
  function setPH(id, text) {
    const el = document.getElementById(id) || document.querySelector(id);
    if (el) el.placeholder = text;
  }
  function setBtnText(sel, text) {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  }
  function setDivText(sel, text) {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  }
  function setInner(sel, text) {
    const el = document.getElementById(sel) || document.querySelector(sel);
    if (el) el.textContent = text;
  }
  function setHTML(sel, text) {
    const el = document.getElementById(sel) || document.querySelector(sel);
    if (el) el.innerHTML = text;
  }
  function setBtnInner(sel, text, iconSrc) {
    const el = document.querySelector(sel);
    if (!el) return;
    const img = el.querySelector(".btn-icon");
    el.textContent = "";
    if (img) el.appendChild(img.cloneNode(true));
    el.appendChild(document.createTextNode(text));
  }
  function setNextText(id, text) {
    const el = document.getElementById(id);
    if (el && el.nextElementSibling) el.nextElementSibling.textContent = text;
  }
  function setSpanText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function setStatLabel(id, label) {
    const el = document.getElementById(id);
    if (el && el.nextElementSibling) el.nextElementSibling.textContent = label;
  }
  function setChipText(screenId, text, icon) {
    const screen = document.getElementById(screenId);
    if (!screen) return;
    const chip = screen.closest ? screen : null;
  }
  function setH3(sel, text) {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  }
  function setFriendDesc(text) {
    const el = document.querySelector("#friends-pane-add .card p.muted");
    if (el) el.textContent = text;
  }
  function setMiniBtn(sel, text) {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  }
  function setLabel(id, text) {
    const el = document.getElementById(id) || document.querySelector(id);
    if (el) el.textContent = text;
  }
  function setBackButtons(text) {
    document.querySelectorAll(".topbar .chip:first-child").forEach(function (btn) {
      if (btn.textContent.includes("←") || btn.textContent.match(/←|Back|رجوع|Retour/i)) {
        btn.textContent = text;
      }
    });
  }

  // ---- apply volume to Music and Sound ------------------------------------
  function applyVolumes() {
    if (typeof Music !== "undefined" && Music.setVolume) {
      Music.setVolume(musicVol / 100);
    }
    if (typeof Sound !== "undefined" && Sound.setVolume) {
      Sound.setVolume(sfxVol / 100);
    }
  }

  // ---- settings screen rendering ------------------------------------------
  function renderSettings() {
    // Language buttons
    const langBtns = document.querySelectorAll("#settings-lang-btns .lang-btn");
    langBtns.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });

    // Volume sliders
    const musicSlider = document.getElementById("settings-music-slider");
    const sfxSlider = document.getElementById("settings-sfx-slider");
    const musicVal = document.getElementById("settings-music-val");
    const sfxVal = document.getElementById("settings-sfx-val");
    if (musicSlider) musicSlider.value = musicVol;
    if (sfxSlider) sfxSlider.value = sfxVol;
    if (musicVal) musicVal.textContent = musicVol + "%";
    if (sfxVal) sfxVal.textContent = sfxVol + "%";

    applyTranslations();
  }

  // ---- public API ---------------------------------------------------------
  return {
    init: function () {
      load();
      applyVolumes();
      // Set initial RTL and lang
      document.documentElement.lang = lang;
      document.documentElement.dir = (lang === "ar") ? "rtl" : "ltr";
    },

    getLang: function () { return lang; },
    setLang: function (l) {
      if (!translations[l]) return;
      lang = l;
      document.documentElement.lang = l;
      // RTL support for Arabic
      document.documentElement.dir = (l === "ar") ? "rtl" : "ltr";
      save();
      applyTranslations();
      renderSettings();
      // Re-render leaderboard if visible
      if (typeof loadLeaderboard === "function") loadLeaderboard();
    },

    getMusicVol: function () { return musicVol; },
    setMusicVol: function (v) {
      musicVol = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
      save();
      applyVolumes();
      // If volume > 0 and music is muted, unmute and start
      if (musicVol > 0 && typeof Music !== "undefined" && Music.isMuted() && musicVol > 0) {
        Music.toggle();
      }
    },

    getSfxVol: function () { return sfxVol; },
    setSfxVol: function (v) {
      sfxVol = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
      save();
      applyVolumes();
      // If volume > 0 and SFX is muted, unmute
      if (sfxVol > 0 && typeof Sound !== "undefined" && Sound.isMuted() && sfxVol > 0) {
        Sound.toggle();
      }
    },

    t: t,
    renderSettings: renderSettings,
    applyTranslations: applyTranslations,
  };
})();

// ---- settings screen event handlers (called from HTML onclick) ------------

function settingsSetLang(lang) {
  Settings.setLang(lang);
}

function settingsMusicSlider(val) {
  Settings.setMusicVol(val);
}

function settingsSfxSlider(val) {
  Settings.setSfxVol(val);
}

function openSettings() {
  Settings.renderSettings();
  go("screen-settings");
}
