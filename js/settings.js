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
      "home.arena_hint": "All arenas ›",
      "home.find_match": "Find a match",
      "home.practice": "Practice vs. QuizBot",
      "home.practice_note": "Practice matches don't change your trophies.",
      "home.trophies": "Trophies",
      "home.wins": "Wins",
      "home.losses": "Losses",
      "home.friends": "Friends",
      "home.leaderboard": "Leaderboard",
      "home.trophies_to": "{n} trophies to {name}",
      "home.max_arena": "Max arena reached — you're a legend!",
      // match screen
      "match.finding": "Finding opponent…",
      "match.queue_desc": "Someone, somewhere, is tapping the same button.",
      "match.waiting": "Waiting…",
      "match.scanning": "Scanning the arena for a worthy opponent…",
      "match.cancel": "Cancel",
      "match.vs": "VS",
      "match.searching_human": "Searching for a human opponent… ({n}s)",
      "match.opponent_starting": "Opponent found — starting…",
      "match.question_of": "Question {cur} of {total} · {secs} seconds each",
      "match.streak": "{n} streak",
      "match.streak_zero": "streak: {n}",
      "match.waiting_for": "Waiting for {name}…",
      "match.wrong_waiting": "Wrong — waiting for {name}…",
      // result screen
      "result.win": "You win!",
      "result.tie": "It's a tie!",
      "result.lost": "You lost!",
      "result.trophies": "{n} trophies",
      "result.trophy": "{n} trophy",
      "result.no_change": "No trophy change",
      "result.friendly_duel": "Friendly duel — no rank change",
      "result.network_error": "Couldn't reach the network — no rank change",
      "result.quizbot_fallback": "No humans found — played QuizBot (no rank change)",
      "result.practice": "Practice game — no rank change",
      "result.arena_unlocked": "Arena unlocked: {name}!",
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
      "friends.loading": "Loading…",
      "friends.searching": "Searching…",
      "friends.type_chars": "Type at least 2 characters.",
      "friends.no_players": "No players found.",
      "friends.add_btn": "Add",
      "friends.sent": "Sent",
      "friends.friends_label": "Friends",
      "friends.trophies_label": "trophies",
      "friends.requests_heading": "Requests {n}",
      "friends.wants_battle": "wants to battle",
      "friends.accept": "Accept",
      "friends.decline": "Decline",
      "friends.your_friends": "Your friends {n}",
      "friends.no_friends": "No friends yet — search for someone above.",
      "friends.cancel_challenge": "Cancel",
      "friends.remove_title": "Remove friend",
      "friends.challenges_heading": "Challenges",
      "friends.challenged_you": "challenged you to a duel!",
      // friends toasts
      "toast.request_sent": "Friend request sent!",
      "toast.already_friends": "You're already friends",
      "toast.request_exists": "A request already exists",
      "toast.thats_you": "That's you!",
      "toast.cant_friend_bot": "QuizBot can't be friended",
      "toast.user_not_found": "No player with that username",
      "toast.something_wrong": "Something went wrong",
      "toast.couldnt_send": "Couldn't send the request.",
      "toast.now_friends": "You're now friends!",
      "toast.couldnt_accept": "Couldn't accept.",
      "toast.request_declined": "Request declined",
      "toast.couldnt_decline": "Couldn't decline.",
      "toast.friend_removed": "Friend removed",
      "toast.couldnt_remove": "Couldn't remove.",
      "toast.remove_friend_confirm": "Remove this friend?",
      "toast.challenge_pending": "A challenge to that friend is already pending.",
      "toast.challenge_sent": "Challenge sent — waiting for your friend",
      "toast.challenge_declined": "Your friend declined the challenge",
      "toast.challenge_expired": "Your friend didn't answer — the challenge expired.",
      "toast.challenge_accepted": "Challenge accepted — good luck!",
      "toast.challenge_couldnt_accept": "Couldn't accept the challenge.",
      "toast.challenge_declined_ok": "Challenge declined",
      "toast.challenge_couldnt_decline": "Couldn't decline.",
      "toast.challenge_cancelled": "Challenge cancelled",
      "toast.challenge_couldnt_cancel": "Couldn't cancel the challenge.",
      "toast.opponent_found": "Opponent found — good luck!",
      "toast.been_challenged": "You've been challenged — check Friends!",
      // settings screen
      "settings.title": "Settings",
      "settings.language": "Language",
      "settings.music_volume": "Music Volume",
      "settings.sfx_volume": "Sound Effects",
      "settings.back": "Back",
      // profile screen
      "profile.title": "Profile",
      // arena modal
      "arena.unlocked": "Arena unlocked",
      "arena.unlocked_req": "Reached {n} trophies",
      "arena.continue": "Continue",
      "arena.your_arena": "★ Your arena",
      "arena.unlocked_badge": "Unlocked",
      "arena.locked_badge": "Locked",
      "arena.climbing_here": "You're climbing here",
      "arena.everyone_starts": "Everyone starts here",
      "arena.unlocked_at": "Unlocked at {n} trophies",
      "arena.reach_unlock": "Reach {n} trophies to unlock",
      "arena.swipe_hint": "Swipe, scroll, or use ← → to explore the arenas",
      // leaderboard
      "leaderboard.loading": "Loading…",
      "leaderboard.cant_load": "Couldn't load the leaderboard.",
      "leaderboard.no_players": "No players yet. Be the first!",
      "leaderboard.you": "(you)",
      // stats
      "stats.loading": "Loading…",
      "stats.cant_load": "Couldn't load your stats.",
      "stats.cant_load_history": "Couldn't load match history.",
      "stats.overall_accuracy": "Overall accuracy",
      "stats.answers_of": "{correct} of {total} answers",
      "stats.by_category": "Accuracy by category",
      "stats.no_data": "Answer a few questions and your per-category accuracy will appear here.",
      "stats.match_history": "Match history",
      "stats.no_history": "No finished matches yet — your ranked & friend duels will show up here once they end (practice matches aren't listed).",
      // share
      "share.text": "I scored {score} in Trivia1v1! Can you beat me?",
      "share.copied": "Score copied! Paste it to your friends.",
      // errors
      "error.username_invalid": "Username: 3–20 letters, numbers or underscores.",
      "error.password_short": "Password must be at least 6 characters.",
      "error.enter_credentials": "Enter your username and password.",
      "error.email_confirm": "Account created! Confirm your email first, then log in. (Or turn off \"Confirm email\" in Supabase — see README.)",
      "error.couldnt_join": "Could not join matchmaking: {msg}",
      "error.couldnt_load_match": "Could not load the match: {msg}",
      "error.couldnt_load_questions": "Could not load questions: {msg}",
      "error.friend_no_accept": "Your friend didn't accept the challenge. Try again!",
      "error.no_opponent": "No opponent found yet. Try again in a moment!",
      "error.check_email_login": "Please check your email or log in.",
      "error.friends_not_setup": "Friends isn't set up yet — run database/friends-bots.sql (see README).",
      // other
      "other.stats_history": "Stats & history",
      "other.sign_out": "Sign out",
      "other.back": "← Back",
      // category names
      "cat.Science": "Science",
      "cat.Math": "Math",
      "cat.Football": "Football",
      "cat.History": "History",
      // arena names
      "arena.1": "Training Grounds",
      "arena.2": "The Beaker Realm",
      "arena.3": "The Last Whistle",
      "arena.4": "The Marble Archive",
      "arena.5": "Axiom Chamber",
      "arena.6": "Sandsworn Arena",
      "arena.7": "Hall of Legends",
      // misc
      "auth.subtitle": "Answer fast. Beat strangers. Climb the ladder.",
      "match.vs": "VS",
      "match.cancel": "Cancel",
      "match.practice_easy": "Easy",
      "match.practice_medium": "Medium",
      "match.practice_hard": "Hard",
      "result.my_name": "You",
      "result.opp_name": "Opponent",
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
      "home.arena_hint": "Toutes les arènes ›",
      "home.find_match": "Trouver un match",
      "home.practice": "Entraînement vs. QuizBot",
      "home.practice_note": "Les matchs d'entraînement ne changent pas vos trophées.",
      "home.trophies": "Trophées",
      "home.wins": "Victoires",
      "home.losses": "Défaites",
      "home.friends": "Amis",
      "home.leaderboard": "Classement",
      "home.trophies_to": "{n} trophées pour {name}",
      "home.max_arena": "Arène maximale atteinte — vous êtes une légende !",
      "match.finding": "Recherche d'un adversaire…",
      "match.queue_desc": "Quelqu'un, quelque part, appuie sur le même bouton.",
      "match.waiting": "En attente…",
      "match.scanning": "Scan de l'arène pour un adversaire digne…",
      "match.cancel": "Annuler",
      "match.vs": "VS",
      "match.searching_human": "Recherche d'un adversaire humain… ({n}s)",
      "match.opponent_starting": "Adversaire trouvé — démarrage…",
      "match.question_of": "Question {cur} sur {total} · {secs} secondes chacune",
      "match.streak": "{n} série",
      "match.streak_zero": "série : {n}",
      "match.waiting_for": "En attente de {name}…",
      "match.wrong_waiting": "Faux — en attente de {name}…",
      "result.win": "Vous gagnez !",
      "result.tie": "Égalité !",
      "result.lost": "Vous perdez !",
      "result.trophies": "{n} trophées",
      "result.trophy": "{n} trophée",
      "result.no_change": "Pas de changement de trophées",
      "result.friendly_duel": "Duel amical — pas de changement de classement",
      "result.network_error": "Impossible d'atteindre le réseau — pas de changement de classement",
      "result.quizbot_fallback": "Aucun humain trouvé — partie contre QuizBot (pas de changement de classement)",
      "result.practice": "Partie d'entraînement — pas de changement de classement",
      "result.arena_unlocked": "Arène débloquée : {name} !",
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
      "friends.loading": "Chargement…",
      "friends.searching": "Recherche…",
      "friends.type_chars": "Tapez au moins 2 caractères.",
      "friends.no_players": "Aucun joueur trouvé.",
      "friends.add_btn": "Ajouter",
      "friends.sent": "Envoyé",
      "friends.friends_label": "Amis",
      "friends.trophies_label": "trophées",
      "friends.requests_heading": "Demandes {n}",
      "friends.wants_battle": "veut se battre",
      "friends.accept": "Accepter",
      "friends.decline": "Refuser",
      "friends.your_friends": "Vos amis {n}",
      "friends.no_friends": "Pas encore d'amis — cherchez quelqu'un ci-dessus.",
      "friends.cancel_challenge": "Annuler",
      "friends.remove_title": "Retirer l'ami",
      "friends.challenges_heading": "Défis",
      "friends.challenged_you": "vous a défié en duel !",
      "toast.request_sent": "Demande d'ami envoyée !",
      "toast.already_friends": "Vous êtes déjà amis",
      "toast.request_exists": "Une demande existe déjà",
      "toast.thats_you": "C'est vous !",
      "toast.cant_friend_bot": "QuizBot ne peut pas être ajouté en ami",
      "toast.user_not_found": "Aucun joueur avec ce nom",
      "toast.something_wrong": "Quelque chose s'est mal passé",
      "toast.couldnt_send": "Impossible d'envoyer la demande.",
      "toast.now_friends": "Vous êtes maintenant amis !",
      "toast.couldnt_accept": "Impossible d'accepter.",
      "toast.request_declined": "Demande refusée",
      "toast.couldnt_decline": "Impossible de refuser.",
      "toast.friend_removed": "Ami retiré",
      "toast.couldnt_remove": "Impossible de retirer.",
      "toast.remove_friend_confirm": "Retirer cet ami ?",
      "toast.challenge_pending": "Un défi avec cet ami est déjà en cours.",
      "toast.challenge_sent": "Défi envoyé — en attente de votre ami",
      "toast.challenge_declined": "Votre ami a refusé le défi",
      "toast.challenge_expired": "Votre ami n'a pas répondu — le défi a expiré.",
      "toast.challenge_accepted": "Défi accepté — bonne chance !",
      "toast.challenge_couldnt_accept": "Impossible d'accepter le défi.",
      "toast.challenge_declined_ok": "Défi refusé",
      "toast.challenge_couldnt_decline": "Impossible de refuser le défi.",
      "toast.challenge_cancelled": "Défi annulé",
      "toast.challenge_couldnt_cancel": "Impossible d'annuler le défi.",
      "toast.opponent_found": "Adversaire trouvé — bonne chance !",
      "toast.been_challenged": "Vous avez été défié — vérifiez Amis !",
      "settings.title": "Paramètres",
      "settings.language": "Langue",
      "settings.music_volume": "Volume de la musique",
      "settings.sfx_volume": "Effets sonores",
      "settings.back": "Retour",
      "profile.title": "Profil",
      "arena.unlocked": "Arène débloquée",
      "arena.unlocked_req": "Atteint {n} trophées",
      "arena.continue": "Continuer",
      "arena.your_arena": "★ Votre arène",
      "arena.unlocked_badge": "Débloquée",
      "arena.locked_badge": "Verrouillée",
      "arena.climbing_here": "Vous grimpez ici",
      "arena.everyone_starts": "Tout le monde commence ici",
      "arena.unlocked_at": "Débloquée à {n} trophées",
      "arena.reach_unlock": "Atteignez {n} trophées pour débloquer",
      "arena.swipe_hint": "Glissez, faites défiler ou utilisez ← → pour explorer les arènes",
      "leaderboard.loading": "Chargement…",
      "leaderboard.cant_load": "Impossible de charger le classement.",
      "leaderboard.no_players": "Pas encore de joueurs. Soyez le premier !",
      "leaderboard.you": "(vous)",
      "stats.loading": "Chargement…",
      "stats.cant_load": "Impossible de charger vos statistiques.",
      "stats.cant_load_history": "Impossible de charger l'historique des matchs.",
      "stats.overall_accuracy": "Précision globale",
      "stats.answers_of": "{correct} sur {total} réponses",
      "stats.by_category": "Précision par catégorie",
      "stats.no_data": "Répondez à quelques questions et votre précision par catégorie apparaîtra ici.",
      "stats.match_history": "Historique des matchs",
      "stats.no_history": "Pas encore de matchs terminés — vos matchs classés et amicaux apparaîtront ici une fois terminés (les matchs d'entraînement ne sont pas listés).",
      "share.text": "J'ai marqué {score} dans Trivia1v1 ! Can you beat me?",
      "share.copied": "Score copié ! Collez-le à vos amis.",
      "error.username_invalid": "Nom d'utilisateur : 3-20 lettres, chiffres ou underscores.",
      "error.password_short": "Le mot de passe doit faire au moins 6 caractères.",
      "error.enter_credentials": "Entrez votre nom d'utilisateur et mot de passe.",
      "error.email_confirm": "Compte créé ! Confirmez d'abord votre email, puis connectez-vous. (Ou désactivez \"Confirmer l'email\" dans Supabase — voir README.)",
      "error.couldnt_join": "Impossible de rejoindre le matchmaking : {msg}",
      "error.couldnt_load_match": "Impossible de charger le match : {msg}",
      "error.couldnt_load_questions": "Impossible de charger les questions : {msg}",
      "error.friend_no_accept": "Votre ami n'a pas accepté le défi. Réessayez !",
      "error.no_opponent": "Aucun adversaire trouvé. Réessayez dans un instant !",
      "error.check_email_login": "Veuillez vérifier votre email ou vous connecter.",
      "error.friends_not_setup": "Les amis ne sont pas encore configurés — exécutez database/friends-bots.sql (voir README).",
      "other.stats_history": "Statistiques & historique",
      "other.sign_out": "Se déconnecter",
      "other.back": "← Retour",
      "cat.Science": "Science",
      "cat.Math": "Maths",
      "cat.Football": "Football",
      "cat.History": "Histoire",
      "arena.1": "Terrain d'entra\u00eetement",
      "arena.2": "Le Royaume des Eprouvettes",
      "arena.3": "Le Dernier Sifflet",
      "arena.4": "L'Archive de Marbre",
      "arena.5": "Chambre des Axiomes",
      "arena.6": "Ar\u00e8ne du Sable",
      "arena.7": "Hall des L\u00e9gendes",
      "auth.subtitle": "R\u00e9pondez vite. Battez des inconnus. Gravissez l'\u00e9chelle.",
      "match.vs": "VS",
      "match.cancel": "Annuler",
      "match.practice_easy": "Facile",
      "match.practice_medium": "Moyen",
      "match.practice_hard": "Difficile",
      "result.my_name": "Vous",
      "result.opp_name": "Adversaire",
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

  // ---- translate a key and replace {placeholders} -------------------------
  // e.g. Settings.tf("result.trophies", {n: 20})
  function tf(key, vars) {
    var s = t(key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace(new RegExp("\\{" + k + "\\}", "g"), String(vars[k]));
      });
    }
    return s;
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

    // Home screen — translate the Profile chip (preserve the avatar span)
    translateChip("screen-trivia-home", t("home.profile"));
    setHTML("screen-trivia-home .screen-title", t("home.arena_title"));
    setTextById("home-subtitle", t("home.arena_subtitle"));
    setTextById("arena-label", t("home.current_arena"));
    setBtnInner("screen-trivia-home .btn.big", t("home.find_match"), "assets/icon.svg");
    setBtnInner("screen-trivia-home .btn.ghost.bot-launch", t("home.practice"), "assets/icon.svg");
    setTextById("home-note", t("home.practice_note"));
    setTextById("arena-hint-home", t("home.arena_hint"));
    setTextById("arena-hint-profile", t("home.arena_hint"));

    // Stats row labels on home
    setStatLabel("trivia-trophies", t("home.trophies"));
    setStatLabel("trivia-wins", t("home.wins"));
    setStatLabel("trivia-losses", t("home.losses"));

    // Stats row labels on profile
    setStatLabel("profile-trophies", t("home.trophies"));
    setStatLabel("profile-wins", t("home.wins"));
    setStatLabel("profile-losses", t("home.losses"));

    // Chip row — translate the text inside each chip (preserve the icon)
    translateChip("screen-friends", t("home.friends"));
    translateChip("screen-leaderboard", t("home.leaderboard"));
    // Home chip-row buttons (Friends / Leaderboard on home screen)
    translateChipBtn("chip-friends", t("home.friends"));
    translateChipBtn("chip-leaderboard", t("home.leaderboard"));

    // Friends
    setInner("screen-friends .friends-title", t("friends.title"));
    setInner("tab-add", t("friends.add_tab"));
    setInner("tab-requests", t("friends.requests_tab"));
    setH3("friends-pane-add .card h3", t("friends.add_heading"));
    setFriendDesc(t("friends.add_desc"));
    setPH("friends-search", t("friends.search_placeholder"));
    setMiniBtn("friends-pane-add .mini-btn.primary", t("friends.search"));

    // Profile
    setInner("screen-profile .friends-title", t("profile.title"));
    setBtnInner("#screen-profile .btn.ghost", t("other.stats_history"), "assets/icon.svg");
    setBtnInner(".profile-signout", t("other.sign_out"), "assets/icon.svg");

    // Leaderboard
    setHTML("screen-leaderboard .screen-title", "<img class=\"title-icon\" src=\"assets/icon.svg\" alt=\"\"> " + t("home.leaderboard"));

    // Arena modal
    setModalText(".arena-modal-kicker", "⭐ " + t("arena.unlocked") + " ⭐");
    setModalBtn(".arena-modal-btn", t("arena.continue"));

    // Back buttons
    setBackButtons(t("other.back"));

    // Settings
    setInner("settings-title", t("settings.title"));
    setLabel("settings-lang-label", t("settings.language"));
    setLabelHTML("settings-music-label", '<i class="fa-solid fa-music"></i> ' + t("settings.music_volume"));
    setLabelHTML("settings-sfx-label", '<i class="fa-solid fa-droplet"></i> ' + t("settings.sfx_volume"));

    // Arena viewer
    setTextById("arena-swipe-hint", t("arena.swipe_hint"));

    // Auth subtitle
    setTextById("auth-subtitle", t("auth.subtitle"));

    // Bot difficulty buttons
    translateBtnText(".btn.bot-diff.easy", t("match.practice_easy"));
    translateBtnText(".btn.bot-diff.medium", t("match.practice_medium"));
    translateBtnText(".btn.bot-diff.hard", t("match.practice_hard"));

    // Arena names (all elements with data-arena-name)
    document.querySelectorAll("[data-arena-name]").forEach(function (el) {
      var arenaId = el.getAttribute("data-arena-name");
      var key = "arena." + arenaId;
      var translated = t(key);
      if (translated !== key) el.textContent = translated;
    });

    // Category names (all elements with data-category)
    document.querySelectorAll("[data-category]").forEach(function (el) {
      var cat = el.getAttribute("data-category");
      var key = "cat." + cat;
      var translated = t(key);
      if (translated !== key) el.textContent = translated;
    });

    // VS badge
    setTextById("match-vs", t("match.vs"));
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
  function setTextById(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function setStatLabel(id, label) {
    const el = document.getElementById(id);
    if (el && el.nextElementSibling) el.nextElementSibling.textContent = label;
  }
  function translateChip(screenId, text) {
    // Find the first <button class="chip"> inside the given screen's topbar and replace its text
    // while preserving the icon (<img> or <span class="chip-avatar">)
    const screen = document.getElementById(screenId);
    if (!screen) return;
    const chip = screen.querySelector(".topbar .chip");
    if (!chip) return;
    chip.childNodes.forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE) node.textContent = "";
    });
    chip.appendChild(document.createTextNode(" " + text));
  }
  function translateChipBtn(btnId, text) {
    // Translate a standalone chip button by its ID, preserving icons and badges
    const chip = document.getElementById(btnId);
    if (!chip) return;
    chip.childNodes.forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE) node.textContent = "";
    });
    chip.appendChild(document.createTextNode(" " + text));
  }
  function setModalText(sel, text) {
    const el = document.querySelector(sel);
    if (el) {
      el.textContent = "";
      // parse the stars as text nodes, keep as-is
      el.textContent = text;
    }
  }
  function setModalBtn(sel, text) {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
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
  function translateBtnText(sel, text) {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  }
  function setLabelHTML(id, html) {
    const el = document.getElementById(id) || document.querySelector(id);
    if (el) el.innerHTML = html;
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
      document.documentElement.dir = "ltr";
      applyTranslations();
    },

    getLang: function () { return lang; },
    setLang: function (l) {
      if (!translations[l]) return;
      lang = l;
      document.documentElement.lang = l;
      document.documentElement.dir = "ltr";
      save();
      applyTranslations();
      renderSettings();
      // Re-render all screens that may have dynamic translated content
      if (typeof loadTriviaHome === "function") loadTriviaHome();
      if (typeof loadLeaderboard === "function") loadLeaderboard();
      if (typeof loadFriends === "function") loadFriends();
      if (typeof loadProfile === "function") loadProfile();
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
    tf: tf,
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
