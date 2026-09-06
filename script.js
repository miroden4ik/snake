(() => {
  'use strict';

  // ---------- Safe localStorage (может быть недоступен в приватных webview) ----------
  const store = (() => {
    const denied = (() => { try { const k = '__t__'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k); return false; } catch (_) { return true; } })();
    const safeGet = (key) => { try { return window.localStorage.getItem(key); } catch (_) { return null; } };
    const safeSet = (key, val) => { try { window.localStorage.setItem(key, String(val)); } catch (_) { /* нет доступа */ } };
    const safeRemove = (key) => { try { window.localStorage.removeItem(key); } catch (_) { /* нет доступа */ } };
    const mem = {};
    return {
      get(key) {
        if (!denied) return safeGet(key);
        return key in mem ? mem[key] : null;
      },
      set(key, val) {
        mem[key] = String(val);
        safeSet(key, val);
      },
      remove(key) {
        delete mem[key];
        safeRemove(key);
      },
    };
  })();

  // ---------- DOM refs ----------
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const finalScoreEl = document.getElementById('final-score');
  const bestScoreEl = document.getElementById('best-score');
  const overTitleEl = document.getElementById('over-title');
  const lbStatusEl = document.getElementById('lb-status');
  const timerEl = document.getElementById('timer');
  const timerChipEl = document.getElementById('timer-chip');
  const subtitleEl = document.getElementById('subtitle');
  const modeBestEl = document.getElementById('mode-best');
  const durRow = document.getElementById('dur-row');
  const speedRow = document.getElementById('speed-row');
  const btnLeaders = document.getElementById('btn-leaders');
  const btnLeadersOver = document.getElementById('btn-leaders-over');
  const btnLbClose = document.getElementById('btn-lb-close');
  const lbModal = document.getElementById('lb-modal');
  const lbModalBg = document.getElementById('lb-modal-bg');
  const lbList = document.getElementById('lb-list');
  const lbTabs = document.querySelectorAll('.lb-tab');
  const userChip = document.getElementById('user-chip');
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const durChips = document.querySelectorAll('.dur-chip');
  const screens = {
    start: document.getElementById('screen-start'),
    game: document.getElementById('screen-game'),
    over: document.getElementById('screen-over'),
  };
  const btnPlay = document.getElementById('btn-play');
  const btnContinue = document.getElementById('btn-continue');
  const speedChips = document.querySelectorAll('.speed-chip');
  const btnRetry = document.getElementById('btn-retry');
  const btnHome = document.getElementById('btn-home');
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnPauseHome = document.getElementById('btn-pause-home');
  const pauseOverlay = document.getElementById('pause-overlay');
  const btnSound = document.getElementById('btn-sound');
  const soundOnIc = document.getElementById('sound-on-ic');
  const soundOffIc = document.getElementById('sound-off-ic');

  // ========== Shop DOM refs ==========
  const coinsEl = document.getElementById('coins');
  const btnShop = document.getElementById('btn-shop');
  const shopModal = document.getElementById('shop-modal');
  const shopModalBg = document.getElementById('shop-modal-bg');
  const btnShopClose = document.getElementById('btn-shop-close');
  const shopItemsEl = document.getElementById('shop-items');
  const shopTabs = document.querySelectorAll('.shop-tab');
  const shopCoinsCount = document.getElementById('shop-coins-count');

  // ---------- Constants ----------
  const GRID = 15;
  const BASE_SPEED = 140;
  const MIN_SPEED = 70;
  const MODE_ENDLESS = 'endless';
  const MODE_RACE = 'race';
  const RACE_DURATIONS = [60, 90, 120];
  const DEFAULT_RACE_DURATION = 60;
  // скорости «Бесконечной» (мс на шаг): медленная / средняя / высокая
  const ENDLESS_SPEEDS = {
    slow: 260,
    normal: 140,
    fast: 80,
  };
  const ENDLESS_SPEED_NAMES = Object.keys(ENDLESS_SPEEDS);
  const ENDLESS_SPEED_KEY = 'snake_endless_speed';
  // рекорд «Бесконечной» ведётся отдельно для каждой скорости
  const BEST_ENDLESS_KEY = (s) => 'snake_best_score_' + s;
  const LEGACY_BEST_ENDLESS_KEY = 'snake_best_score';
  const BEST_RACE_KEY = (d) => 'snake_best_race' + d;
  const MODE_KEY = 'snake_mode';
  const DUR_KEY = 'snake_duration';
  // ключи сохранённой партии
  const SAVE_KEY = 'snake_saved_game';
  const COLORS = {
    board: '#243B58',
    food: '#E84545',
    foodHighlight: '#FF6B6B',
    head: '#4AA858',
    body: '#6BCB77',
    bodyDark: '#5BB868',
    eye: '#FFFFFF',
    pupil: '#222222',
  };

  // ========== МАГАЗИН: КАТАЛОГ ТОВАРОВ ==========
  const COINS_PER_APPLE = 1;
  const COINS_KEY = 'snake_coins';
  const OWNED_KEY = 'snake_owned_items';
  const EQUIPPED_KEY = 'snake_equipped_items';

  const SHOP_CATALOG = {
    snake: [
      { id: 'snake_default', name: 'Классика', price: 0, body: '#6BCB77', bodyDark: '#5BB868', head: '#4AA858' },
      { id: 'snake_blue', name: 'Лазурная', price: 150, body: '#4FC3F7', bodyDark: '#29B6F6', head: '#0288D1' },
      { id: 'snake_rose', name: 'Розовая', price: 200, body: '#F48FB1', bodyDark: '#F06292', head: '#C2185B' },
      { id: 'snake_sun', name: 'Солнечная', price: 250, body: '#FFD54F', bodyDark: '#FFCA28', head: '#F9A825' },
      { id: 'snake_purple', name: 'Аметист', price: 300, body: '#BA68C8', bodyDark: '#AB47BC', head: '#7B1FA2' },
      { id: 'snake_fire', name: 'Огненная', price: 450, body: '#FF7043', bodyDark: '#F4511E', head: '#D84315' },
      { id: 'snake_ocean', name: 'Океан', price: 500, body: '#26C6DA', bodyDark: '#00ACC1', head: '#00695C' },
      { id: 'snake_choco', name: 'Шоколад', price: 350, body: '#A1887F', bodyDark: '#8D6E63', head: '#5D4037' },
      { id: 'snake_rainbow', name: 'Радужная', price: 800, rainbow: true },
      { id: 'snake_gold', name: 'Золотая', price: 1000, body: '#FFD700', bodyDark: '#FFB300', head: '#FF8F00', glow: true },
      { id: 'snake_neon', name: 'Неон', price: 700, body: '#B2FF59', bodyDark: '#76FF03', head: '#64DD17' },
      { id: 'snake_ice', name: 'Ледяная', price: 600, body: '#B3E5FC', bodyDark: '#81D4FA', head: '#0277BD' },
    ],
    food: [
      { id: 'food_apple', name: 'Яблоко', price: 0, type: 'apple', color: '#E84545', highlight: '#FF6B6B' },
      { id: 'food_banana', name: 'Банан', price: 150, type: 'banana', color: '#FFD93D', highlight: '#FFF176' },
      { id: 'food_grape', name: 'Виноград', price: 200, type: 'grape', color: '#9C27B0', highlight: '#BA68C8' },
      { id: 'food_strawberry', name: 'Клубника', price: 250, type: 'strawberry', color: '#E91E63', highlight: '#F06292' },
      { id: 'food_orange', name: 'Апельсин', price: 180, type: 'orange', color: '#FF9800', highlight: '#FFB74D' },
      { id: 'food_watermelon', name: 'Арбуз', price: 300, type: 'watermelon', color: '#4CAF50', highlight: '#81C784' },
      { id: 'food_cherry', name: 'Вишня', price: 220, type: 'cherry', color: '#C62828', highlight: '#EF5350' },
      { id: 'food_pineapple', name: 'Ананас', price: 400, type: 'pineapple', color: '#FDD835', highlight: '#FFF176' },
      { id: 'food_kiwi', name: 'Киви', price: 280, type: 'kiwi', color: '#689F38', highlight: '#AED581' },
      { id: 'food_peach', name: 'Персик', price: 240, type: 'peach', color: '#FF8A65', highlight: '#FFAB91' },
      { id: 'food_golden_apple', name: 'Золотое яблоко', price: 1000, type: 'golden', color: '#FFD700', highlight: '#FFECB3', sparkle: true },
      { id: 'food_diamond', name: 'Бриллиант', price: 900, type: 'diamond', color: '#4DD0E1', highlight: '#80DEEA', sparkle: true },
    ],
    accessory: [
      { id: 'acc_none', name: 'Нет', price: 0, type: 'none' },
      { id: 'acc_hat_red', name: 'Красная шапка', price: 200, type: 'hat', color: '#E53935' },
      { id: 'acc_hat_blue', name: 'Синяя шапка', price: 200, type: 'hat', color: '#1E88E5' },
      { id: 'acc_crown', name: 'Корона', price: 900, type: 'crown', color: '#FFD700' },
      { id: 'acc_glasses_sun', name: 'Солнцезащитные очки', price: 300, type: 'glasses', color: '#212121' },
      { id: 'acc_glasses_nerd', name: 'Очки для зрения', price: 250, type: 'glasses_nerd', color: '#455A64' },
      { id: 'acc_bow_pink', name: 'Розовый бант', price: 180, type: 'bow', color: '#F06292' },
      { id: 'acc_flower', name: 'Цветок', price: 220, type: 'flower', color: '#EC407A' },
      { id: 'acc_headphones', name: 'Наушники', price: 400, type: 'headphones', color: '#546E7A' },
      { id: 'acc_party_hat', name: 'Праздничная шапочка', price: 150, type: 'party_hat', color: '#AB47BC' },
      { id: 'acc_wizard_hat', name: 'Шляпа волшебника', price: 600, type: 'wizard_hat', color: '#311B92' },
      { id: 'acc_viking_helmet', name: 'Шлем викинга', price: 800, type: 'viking', color: '#9E9E9E' },
    ],
    background: [
      { id: 'bg_default', name: 'Классика', price: 0, type: 'solid', color: '#243B58', alt: '#1E334A' },
      { id: 'bg_forest', name: 'Лес', price: 200, type: 'solid', color: '#1B5E20', alt: '#2E7D32' },
      { id: 'bg_sunset', name: 'Закат', price: 350, type: 'gradient', color: '#FF6F00', alt: '#C2185B' },
      { id: 'bg_ocean', name: 'Море', price: 300, type: 'gradient', color: '#006994', alt: '#00ACC1' },
      { id: 'bg_space', name: 'Космос', price: 600, type: 'gradient', color: '#1A1A2E', alt: '#16213E' },
      { id: 'bg_candy', name: 'Карамель', price: 250, type: 'gradient', color: '#F8BBD0', alt: '#F48FB1' },
      { id: 'bg_grass', name: 'Поле', price: 180, type: 'solid', color: '#558B2F', alt: '#689F38' },
      { id: 'bg_sand', name: 'Пляж', price: 220, type: 'solid', color: '#F9A825', alt: '#FDD835' },
      { id: 'bg_ice', name: 'Снежок', price: 280, type: 'gradient', color: '#81D4FA', alt: '#B3E5FC' },
      { id: 'bg_lava', name: 'Лава', price: 500, type: 'gradient', color: '#BF360C', alt: '#E64A19' },
      { id: 'bg_aurora', name: 'Аврора', price: 800, type: 'gradient', color: '#004D40', alt: '#1B5E20', alt2: '#7B1FA2' },
      { id: 'bg_royal', name: 'Королевский', price: 1000, type: 'gradient', color: '#4A148C', alt: '#880E4F' },
    ],
  };

  const SHOP_CATEGORIES = ['snake', 'food', 'accessory', 'background'];

  // ---------- State ----------
  // Shop state
  let coins = Number(store.get(COINS_KEY) || 0);
  let ownedItems = (() => {
    try {
      const raw = store.get(OWNED_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return (parsed && Array.isArray(parsed)) ? parsed : ['snake_default', 'food_apple', 'acc_none', 'bg_default'];
    } catch (_) {
      return ['snake_default', 'food_apple', 'acc_none', 'bg_default'];
    }
  })();
  let equippedItems = (() => {
    try {
      const raw = store.get(EQUIPPED_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return (parsed && typeof parsed === 'object') ? parsed : { snake: 'snake_default', food: 'food_apple', accessory: 'acc_none', background: 'bg_default' };
    } catch (_) {
      return { snake: 'snake_default', food: 'food_apple', accessory: 'acc_none', background: 'bg_default' };
    }
  })();
  let currentShopCategory = 'snake';

  let snake = [];
  let prevSnake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = null;
  let score = 0;
  const bestRace = {};
  RACE_DURATIONS.forEach((d) => {
    bestRace[d] = Number(store.get(BEST_RACE_KEY(d)) || 0);
  });
  let running = false;
  let gameOver = false;
  let paused = false;
  let pauseStart = 0;
  let rafId = null;
  let moveDuration = BASE_SPEED;
  let moveStart = 0;
  let animTime = 0;
  let currentT = 0;
  let cellSize = 0;
  let boardSize = 0;
  let mode = store.get(MODE_KEY) === MODE_RACE ? MODE_RACE : MODE_ENDLESS;
  let raceDuration = Number(store.get(DUR_KEY) || DEFAULT_RACE_DURATION);
  let raceEndAt = 0;
  const endlessSpeedDefault = 'normal';
  let endlessSpeed = Object.prototype.hasOwnProperty.call(ENDLESS_SPEEDS, store.get(ENDLESS_SPEED_KEY))
    ? store.get(ENDLESS_SPEED_KEY)
    : endlessSpeedDefault;
  const bestEndless = {};
  ENDLESS_SPEED_NAMES.forEach((s) => {
    bestEndless[s] = Number(store.get(BEST_ENDLESS_KEY(s)) || 0);
  });
  // миграция: старый общий рекорд «Бесконечной» → в скорость «средняя»
  const legacyEndless = Number(store.get(LEGACY_BEST_ENDLESS_KEY) || 0) || 0;
  if (legacyEndless > 0 && bestEndless[endlessSpeedDefault] < legacyEndless) {
    bestEndless[endlessSpeedDefault] = legacyEndless;
    store.set(BEST_ENDLESS_KEY(endlessSpeedDefault), String(legacyEndless));
  }
  // сохранённая партия: {saved: bool, mode, score, snake, dir, nextDir, food, raceLeftMs, raceEndAt}
  let savedGame = null;
  try { const raw = store.get(SAVE_KEY); if (raw) savedGame = JSON.parse(raw) || null; } catch (_) { savedGame = null; }

  // dev/test helper: ?race=5 запускает Гонку на 5 секунд (дробные тоже можно)
  let urlRaceOverride = 0;
  try {
    urlRaceOverride = Number(new URLSearchParams(window.location.search).get('race'));
  } catch (_) { /* игнор */ }
  if (urlRaceOverride > 0) {
    raceDuration = Math.max(1, urlRaceOverride);
  } else if (!RACE_DURATIONS.includes(raceDuration)) {
    raceDuration = DEFAULT_RACE_DURATION;
  }

  // ---------- VK + лидерборд (только «Гонка») ----------
  const CONFIG_URL = (typeof SNAKE_CONFIG !== 'undefined' && SNAKE_CONFIG.WORKER_URL)
    ? String(SNAKE_CONFIG.WORKER_URL).replace(/\/+$/, '')
    : '';
  const LB_ENABLED = !!CONFIG_URL && CONFIG_URL.indexOf('REPLACE_WITH_YOUR_WORKER_URL') === -1;
  const currentUser = { vk_user_id: null, first_name: '', last_name: '', photo_100: '' };
  let vkSignParamsStr = '';

  // VK Storage — ключи рекордов (синк между устройствами, как в Fruit Blast)
  const VK_STORAGE = {
    bestEndless: (s) => 'snakeBestScore' + (s ? s[0].toUpperCase() + s.slice(1) : ''),
    legacyEndless: 'snakeBestScore',
    bestRace: (d) => 'snakeBestRace' + d,
    all: () => ENDLESS_SPEED_NAMES.map((s) => VK_STORAGE.bestEndless(s))
      .concat(RACE_DURATIONS.map((d) => VK_STORAGE.bestRace(d))),
  };

  function vkAvailable() {
    return typeof vkBridge !== 'undefined' && !!vkBridge.send;
  }

  function vkStorageGetBatch(keysArr) {
    return new Promise((resolve) => {
      const out = {};
      if (!vkAvailable() || !Array.isArray(keysArr) || keysArr.length === 0) { resolve(out); return; }
      const unique = [];
      keysArr.forEach((k) => { if (!unique.includes(k)) unique.push(k); });
      vkBridge.send('VKWebAppStorageGet', { keys: unique }).then((res) => {
        if (res && Array.isArray(res.keys)) {
          res.keys.forEach((row) => {
            if (row && row.key !== undefined) out[row.key] = (row.value === undefined || row.value === null) ? null : row.value;
          });
        }
        resolve(out);
      }).catch(() => resolve(out));
    });
  }

  function vkStorageSet(key, value) {
    if (!vkAvailable()) return Promise.resolve();
    return vkBridge.send('VKWebAppStorageSet', { key, value: String(value) }).catch(() => {});
  }

  function applyUserChip() {
    const fullName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ').trim();
    if (!fullName) return;
    userName.textContent = fullName;
    if (currentUser.photo_100) {
      userAvatar.src = currentUser.photo_100;
      userAvatar.hidden = false;
    }
    userChip.classList.remove('hidden');
  }

  // читаем рекорды из VK Storage, берём максимум с локальными и пишем обратно
  function syncBestScoresFromVk() {
    const keys = {};
    ENDLESS_SPEED_NAMES.forEach((s) => { keys['endless_' + s] = VK_STORAGE.bestEndless(s); });
    keys.legacyEndless = VK_STORAGE.legacyEndless;
    RACE_DURATIONS.forEach((d) => { keys['race' + d] = VK_STORAGE.bestRace(d); });

    vkStorageGetBatch(Object.values(keys)).then((remote) => {
      let changed = false;
      const merge = (key, val) => {
        const prev = Number(val) || 0;
        if (key.indexOf('endless_') === 0) {
          const s = key.slice('endless_'.length);
          if (prev > (bestEndless[s] || 0)) {
            bestEndless[s] = prev;
            store.set(BEST_ENDLESS_KEY(s), String(prev));
            changed = true;
          }
          return;
        }
        if (key === 'legacyEndless') {
          // старый общий рекорд → «средняя» скорость
          if (prev > (bestEndless[endlessSpeedDefault] || 0)) {
            bestEndless[endlessSpeedDefault] = prev;
            store.set(BEST_ENDLESS_KEY(endlessSpeedDefault), String(prev));
            changed = true;
          }
          return;
        }
        const d = Number(key.replace('race', ''));
        if (prev > (bestRace[d] || 0)) { bestRace[d] = prev; store.set(BEST_RACE_KEY(d), String(prev)); changed = true; }
      };
      Object.keys(keys).forEach((k) => {
        const rv = remote[keys[k]];
        if (rv != null) merge(k, rv);
      });
      // если локальный рекорд выше — подтягиваем его в облако
      ENDLESS_SPEED_NAMES.forEach((s) => vkStorageSet(VK_STORAGE.bestEndless(s), bestEndless[s] || 0));
      vkStorageSet(VK_STORAGE.legacyEndless, bestEndless[endlessSpeedDefault] || 0);
      RACE_DURATIONS.forEach((d) => vkStorageSet(VK_STORAGE.bestRace(d), bestRace[d] || 0));
      if (changed) applyModeUI();
    }).catch(() => {});
  }

  function getVKLaunchParamsStr() {
    try {
      const full = ((window.location.search || '') + '&' + (window.location.hash || '').replace(/^#/, '')).replace(/^&/, '');
      const params = new URLSearchParams(full);
      const vkKeys = [...params.keys()].filter(k => k.startsWith('vk_'));
      vkKeys.sort();
      const parts = vkKeys.map(k => `${k}=${encodeURIComponent(params.get(k) || '')}`);
      const sign = params.get('sign');
      if (sign) parts.push(`sign=${encodeURIComponent(sign)}`);
      return parts.join('&');
    } catch (_) {
      return '';
    }
  }

  function initVk() {
    vkSignParamsStr = getVKLaunchParamsStr();
    try {
      const lp = new URLSearchParams((window.location.search || '') + '&' + (window.location.hash || '').replace(/^#/, ''));
      const uid = lp.get('vk_user_id');
      if (uid) currentUser.vk_user_id = Number(uid) || uid;
    } catch (_) { /* игнор */ }
    syncBestScoresFromVk();
    if (!vkAvailable()) return;
    vkBridge.send('VKWebAppInit', {}).then(() =>
      vkBridge.send('VKWebAppGetUserInfo', {}).then((res) => {
        if (res) {
          currentUser.vk_user_id = currentUser.vk_user_id != null
            ? currentUser.vk_user_id
            : (res.id != null ? res.id : null);
          currentUser.first_name = res.first_name || '';
          currentUser.last_name = res.last_name || '';
          currentUser.photo_100 = res.photo_100 || '';
          applyUserChip();
          syncBestScoresFromVk();
        }
      }).catch(() => {
        // профиль не получен (нет авторизации/ошибка): если знаем vk_user_id
        // из launch-параметров — показываем нейтральный чип без аватарки
        if (currentUser.vk_user_id != null) {
          userName.textContent = currentUser.first_name || 'Игрок';
          userChip.classList.remove('hidden');
        }
      })
    ).catch(() => {});
  }
  initVk();

  function lbCategory() {
    return MODE_RACE + raceDuration;
  }

  function getBest() {
    return mode === MODE_RACE ? (bestRace[raceDuration] || 0) : (bestEndless[endlessSpeed] || 0);
  }

  function setBest(n) {
    if (mode === MODE_RACE) {
      bestRace[raceDuration] = n;
      store.set(BEST_RACE_KEY(raceDuration), String(n));
      vkStorageSet(VK_STORAGE.bestRace(raceDuration), n);
    } else {
      bestEndless[endlessSpeed] = n;
      store.set(BEST_ENDLESS_KEY(endlessSpeed), String(n));
      vkStorageSet(VK_STORAGE.bestEndless(endlessSpeed), n);
    }
  }

  function fmtDur(sec) {
    const s = Math.max(0, Math.floor(sec));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  // ---------- Звук и вибрация (Web Audio, без файлов) ----------
  let audioCtx = null;
  let sfxMuted = store.get('snake_sfx_muted') === '1';

  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function playTone(freq, startOffset, dur, type = 'sine', gainVal = 0.2) {
    if (!audioCtx || sfxMuted) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime + startOffset;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(gainVal, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  const sfx = {
    eat() {
      if (!ensureAudio()) return;
      playTone(660, 0, 0.09, 'square', 0.18);
      playTone(880, 0.08, 0.12, 'square', 0.16);
    },
    die() {
      if (!ensureAudio()) return;
      playTone(300, 0, 0.18, 'sawtooth', 0.18);
      playTone(200, 0.14, 0.25, 'sawtooth', 0.16);
    },
    win() {
      if (!ensureAudio()) return;
      [523, 659, 784, 1047].forEach((f, i) => playTone(f, i * 0.12, 0.16, 'triangle', 0.18));
    },
    ui() {
      if (!ensureAudio()) return;
      playTone(500, 0, 0.06, 'sine', 0.12);
    },
    toggleMute() {
      sfxMuted = !sfxMuted;
      store.set('snake_sfx_muted', sfxMuted ? '1' : '0');
      return sfxMuted;
    },
  };

  function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) { /* нет поддержки */ }
  }

  function updateSoundIcon() {
    soundOnIc.classList.toggle('hidden', sfxMuted);
    soundOffIc.classList.toggle('hidden', !sfxMuted);
    btnSound.classList.toggle('muted', sfxMuted);
  }

  // ========== SHOP: Утилиты ==========
  function saveShopState() {
    store.set(COINS_KEY, String(coins));
    try { store.set(OWNED_KEY, JSON.stringify(ownedItems)); } catch (_) {}
    try { store.set(EQUIPPED_KEY, JSON.stringify(equippedItems)); } catch (_) {}
  }

  function updateCoinsUI() {
    if (coinsEl) coinsEl.textContent = coins;
    if (shopCoinsCount) shopCoinsCount.textContent = coins;
  }

  function getItemById(id) {
    for (const cat of SHOP_CATEGORIES) {
      const found = SHOP_CATALOG[cat].find(x => x.id === id);
      if (found) return { item: found, category: cat };
    }
    return null;
  }

  function getEquipped(cat) {
    const id = equippedItems[cat];
    return SHOP_CATALOG[cat].find(x => x.id === id) || SHOP_CATALOG[cat][0];
  }

  function isOwned(id) {
    return ownedItems.includes(id);
  }

  function isEquipped(cat, id) {
    return equippedItems[cat] === id;
  }

  function buyItem(item) {
    if (isOwned(item.id)) return { success: true, message: 'Уже куплен' };
    if (coins < item.price) return { success: false, message: 'Недостаточно монет' };
    coins -= item.price;
    ownedItems.push(item.id);
    saveShopState();
    updateCoinsUI();
    return { success: true, message: 'Куплено!' };
  }

  function equipItem(cat, item) {
    if (!isOwned(item.id)) return { success: false, message: 'Сначала купите' };
    equippedItems[cat] = item.id;
    saveShopState();
    return { success: true, message: 'Экипировано!' };
  }

  function addCoins(n) {
    coins += n;
    saveShopState();
    updateCoinsUI();
  }

  // ========== SHOP: Рендер превью товаров на canvas ==========
  function drawSnakePreview(c, item, size) {
    const s = size / 8;
    // Сегменты змейки
    const segs = [
      { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 },
    ];
    const getC = (i) => {
      if (item.rainbow) {
        const hues = [0, 45, 90, 180, 240, 300];
        return `hsl(${hues[i % hues.length]}, 80%, 60%)`;
      }
      return i === segs.length - 1 ? item.head : (i % 2 === 0 ? item.body : (item.bodyDark || item.body));
    };
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i];
      const isHead = i === segs.length - 1;
      c.fillStyle = getC(i);
      if (item.glow) c.shadowColor = '#FFD700', c.shadowBlur = 8;
      const x = sg.x * s + s * 0.1, y = sg.y * s + s * 0.1, w = s * 0.8, h = s * 0.8;
      roundRect(c, x, y, w, h, s * 0.2);
      c.fill();
      c.shadowBlur = 0;
      if (isHead) {
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(sg.x * s + s * 0.65, sg.y * s + s * 0.35, s * 0.12, 0, Math.PI * 2);
        c.arc(sg.x * s + s * 0.65, sg.y * s + s * 0.65, s * 0.12, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#222';
        c.beginPath();
        c.arc(sg.x * s + s * 0.7, sg.y * s + s * 0.35, s * 0.06, 0, Math.PI * 2);
        c.arc(sg.x * s + s * 0.7, sg.y * s + s * 0.65, s * 0.06, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  function drawFoodPreview(c, item, size) {
    const cx = size / 2, cy = size / 2 + size * 0.05, r = size * 0.32;
    c.save();
    switch (item.type) {
      case 'apple':
      case 'golden': {
        const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        g.addColorStop(0, item.highlight); g.addColorStop(1, item.color);
        c.fillStyle = g;
        if (item.sparkle) c.shadowColor = '#FFD700', c.shadowBlur = 10;
        c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
        c.shadowBlur = 0;
        c.fillStyle = '#6BCB77';
        c.beginPath(); c.ellipse(cx + r * 0.3, cy - r * 1, r * 0.3, r * 0.55, -0.5, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#8A5A2B'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(cx, cy - r * 0.7); c.quadraticCurveTo(cx + r * 0.2, cy - r * 1.1, cx + r * 0.4, cy - r * 1.2); c.stroke();
        break;
      }
      case 'banana': {
        c.fillStyle = item.color;
        c.beginPath();
        c.ellipse(cx, cy, r * 1.1, r * 0.45, 0.4, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = item.highlight; c.lineWidth = 3;
        c.beginPath();
        c.ellipse(cx, cy - 2, r * 1.05, r * 0.38, 0.4, 0, Math.PI);
        c.stroke();
        break;
      }
      case 'grape': {
        const offs = [[-r * 0.35, -r * 0.2], [r * 0.35, -r * 0.2], [0, 0], [-r * 0.35, r * 0.3], [r * 0.35, r * 0.3], [0, r * 0.55]];
        offs.forEach(([dx, dy], i) => {
          c.fillStyle = i % 2 ? item.color : item.highlight;
          c.beginPath(); c.arc(cx + dx, cy + dy, r * 0.32, 0, Math.PI * 2); c.fill();
        });
        break;
      }
      case 'strawberry': {
        c.fillStyle = item.color;
        c.beginPath();
        c.moveTo(cx - r * 0.9, cy - r * 0.2);
        c.quadraticCurveTo(cx, cy + r * 1.1, cx + r * 0.9, cy - r * 0.2);
        c.quadraticCurveTo(cx, cy - r * 0.5, cx - r * 0.9, cy - r * 0.2);
        c.fill();
        c.fillStyle = item.highlight;
        for (let i = 0; i < 6; i++) {
          const sx = cx - r * 0.6 + (i % 3) * r * 0.6;
          const sy = cy + r * 0.05 + Math.floor(i / 3) * r * 0.4;
          c.beginPath(); c.arc(sx, sy, r * 0.05, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = '#4CAF50';
        c.beginPath();
        c.moveTo(cx - r * 0.6, cy - r * 0.35);
        c.lineTo(cx, cy - r * 0.9);
        c.lineTo(cx + r * 0.6, cy - r * 0.35);
        c.closePath();
        c.fill();
        break;
      }
      case 'orange': {
        const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        g.addColorStop(0, item.highlight); g.addColorStop(1, item.color);
        c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          c.beginPath();
          c.moveTo(cx, cy);
          c.lineTo(cx + Math.cos(i * Math.PI / 3) * r * 0.85, cy + Math.sin(i * Math.PI / 3) * r * 0.85);
          c.stroke();
        }
        break;
      }
      case 'watermelon': {
        c.fillStyle = item.color;
        c.beginPath(); c.arc(cx, cy, r, Math.PI, 0); c.fill();
        c.fillStyle = '#D32F2F';
        c.beginPath(); c.arc(cx, cy, r * 0.82, Math.PI, 0); c.fill();
        c.fillStyle = '#FFEBEE';
        for (let i = 0; i < 5; i++) {
          const a = Math.PI + (i + 1) * Math.PI / 6;
          c.beginPath(); c.arc(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.05, 0, Math.PI * 2); c.fill();
        }
        break;
      }
      case 'cherry': {
        [[-r * 0.4, r * 0.2], [r * 0.4, r * 0.2]].forEach(([dx, dy]) => {
          const g = c.createRadialGradient(cx + dx - r * 0.15, cy + dy - r * 0.15, r * 0.05, cx + dx, cy + dy, r * 0.55);
          g.addColorStop(0, item.highlight); g.addColorStop(1, item.color);
          c.fillStyle = g; c.beginPath(); c.arc(cx + dx, cy + dy, r * 0.55, 0, Math.PI * 2); c.fill();
        });
        c.strokeStyle = '#2E7D32'; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(cx - r * 0.4, cy - r * 0.35);
        c.quadraticCurveTo(cx, cy - r * 1.1, cx + r * 0.4, cy - r * 0.35);
        c.stroke();
        break;
      }
      case 'pineapple': {
        c.fillStyle = item.color;
        roundRect(c, cx - r * 0.7, cy - r * 0.3, r * 1.4, r * 1.1, r * 0.2);
        c.fill();
        c.strokeStyle = 'rgba(120,80,0,0.4)'; c.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          c.beginPath();
          c.moveTo(cx - r * 0.65, cy - r * 0.1 + i * r * 0.3);
          c.lineTo(cx + r * 0.65, cy - r * 0.1 + i * r * 0.3);
          c.stroke();
        }
        c.fillStyle = '#2E7D32';
        for (let i = 0; i < 5; i++) {
          const lx = cx - r * 0.5 + i * r * 0.25;
          c.beginPath();
          c.moveTo(lx, cy - r * 0.3);
          c.lineTo(lx - r * 0.1, cy - r * 0.85);
          c.lineTo(lx + r * 0.1, cy - r * 0.3);
          c.fill();
        }
        break;
      }
      case 'kiwi': {
        c.fillStyle = item.color;
        c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#F1F8E9';
        c.beginPath(); c.arc(cx, cy, r * 0.82, 0, Math.PI * 2); c.fill();
        c.fillStyle = item.color;
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI / 6;
          c.beginPath(); c.ellipse(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45, r * 0.04, r * 0.08, a, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(cx, cy, r * 0.1, 0, Math.PI * 2); c.fill();
        break;
      }
      case 'peach': {
        const g = c.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
        g.addColorStop(0, item.highlight); g.addColorStop(1, item.color);
        c.fillStyle = g;
        c.beginPath(); c.arc(cx - r * 0.25, cy, r * 0.75, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(cx + r * 0.25, cy, r * 0.75, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#C62828'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(cx, cy - r * 0.65); c.lineTo(cx, cy - r * 0.9); c.stroke();
        break;
      }
      case 'diamond': {
        c.fillStyle = item.color;
        if (item.sparkle) c.shadowColor = '#4DD0E1', c.shadowBlur = 10;
        c.beginPath();
        c.moveTo(cx, cy - r);
        c.lineTo(cx + r, cy - r * 0.1);
        c.lineTo(cx, cy + r);
        c.lineTo(cx - r, cy - r * 0.1);
        c.closePath();
        c.fill();
        c.shadowBlur = 0;
        c.strokeStyle = item.highlight; c.lineWidth = 2;
        c.beginPath(); c.moveTo(cx - r * 0.5, cy - r * 0.1); c.lineTo(cx + r * 0.5, cy - r * 0.1); c.stroke();
        c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx, cy + r); c.stroke();
        break;
      }
      default: {
        c.fillStyle = item.color; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      }
    }
    c.restore();
  }

  function drawAccessoryPreview(c, item, size) {
    const cx = size / 2, cy = size / 2 + size * 0.1;
    // Голова змейки под аксессуаром
    c.fillStyle = '#6BCB77';
    c.beginPath(); c.arc(cx, cy, size * 0.32, 0, Math.PI * 2); c.fill();
    if (item.type === 'none') return;
    c.save();
    const col = item.color || '#FFD700';
    switch (item.type) {
      case 'hat':
      case 'party_hat': {
        c.fillStyle = col;
        if (item.type === 'party_hat') {
          c.beginPath();
          c.moveTo(cx - size * 0.25, cy - size * 0.1);
          c.lineTo(cx + size * 0.05, cy - size * 0.45);
          c.lineTo(cx + size * 0.25, cy - size * 0.1);
          c.fill();
          c.fillStyle = '#FFEB3B'; c.beginPath(); c.arc(cx + size * 0.05, cy - size * 0.45, size * 0.05, 0, Math.PI * 2); c.fill();
        } else {
          roundRect(c, cx - size * 0.3, cy - size * 0.35, size * 0.6, size * 0.25, size * 0.05);
          c.fill();
          roundRect(c, cx - size * 0.36, cy - size * 0.12, size * 0.72, size * 0.08, size * 0.02);
          c.fill();
        }
        break;
      }
      case 'crown': {
        c.fillStyle = col;
        c.shadowColor = '#FFA000'; c.shadowBlur = 6;
        c.beginPath();
        c.moveTo(cx - size * 0.32, cy - size * 0.1);
        c.lineTo(cx - size * 0.32, cy - size * 0.3);
        c.lineTo(cx - size * 0.16, cy - size * 0.2);
        c.lineTo(cx, cy - size * 0.42);
        c.lineTo(cx + size * 0.16, cy - size * 0.2);
        c.lineTo(cx + size * 0.32, cy - size * 0.3);
        c.lineTo(cx + size * 0.32, cy - size * 0.1);
        c.closePath();
        c.fill();
        c.shadowBlur = 0;
        c.fillStyle = '#E53935'; c.beginPath(); c.arc(cx, cy - size * 0.32, size * 0.04, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1E88E5'; c.beginPath(); c.arc(cx - size * 0.2, cy - size * 0.2, size * 0.03, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#43A047'; c.beginPath(); c.arc(cx + size * 0.2, cy - size * 0.2, size * 0.03, 0, Math.PI * 2); c.fill();
        break;
      }
      case 'glasses':
      case 'glasses_nerd': {
        c.strokeStyle = col; c.lineWidth = item.type === 'glasses' ? 4 : 2;
        c.fillStyle = item.type === 'glasses' ? '#111' : 'rgba(255,255,255,0.6)';
        const rad = size * 0.14;
        c.beginPath(); c.arc(cx - size * 0.16, cy - size * 0.02, rad, 0, Math.PI * 2); c.fill(); c.stroke();
        c.beginPath(); c.arc(cx + size * 0.16, cy - size * 0.02, rad, 0, Math.PI * 2); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(cx - size * 0.16 + rad, cy - size * 0.02); c.lineTo(cx + size * 0.16 - rad, cy - size * 0.02); c.stroke();
        break;
      }
      case 'bow': {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(cx - size * 0.08, cy - size * 0.18);
        c.lineTo(cx - size * 0.36, cy - size * 0.3);
        c.lineTo(cx - size * 0.36, cy - size * 0.05);
        c.closePath();
        c.fill();
        c.beginPath();
        c.moveTo(cx + size * 0.08, cy - size * 0.18);
        c.lineTo(cx + size * 0.36, cy - size * 0.3);
        c.lineTo(cx + size * 0.36, cy - size * 0.05);
        c.closePath();
        c.fill();
        c.fillStyle = '#AD1457';
        roundRect(c, cx - size * 0.06, cy - size * 0.26, size * 0.12, size * 0.14, size * 0.03);
        c.fill();
        break;
      }
      case 'flower': {
        for (let i = 0; i < 6; i++) {
          c.fillStyle = i % 2 ? col : '#FCE4EC';
          const a = i * Math.PI / 3;
          c.beginPath();
          c.arc(cx + Math.cos(a) * size * 0.12, cy - size * 0.3 + Math.sin(a) * size * 0.12, size * 0.08, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = '#FFEB3B'; c.beginPath(); c.arc(cx, cy - size * 0.3, size * 0.08, 0, Math.PI * 2); c.fill();
        break;
      }
      case 'headphones': {
        c.strokeStyle = col; c.lineWidth = 5;
        c.beginPath();
        c.arc(cx, cy - size * 0.2, size * 0.32, Math.PI, 0);
        c.stroke();
        c.fillStyle = col;
        roundRect(c, cx - size * 0.36, cy - size * 0.25, size * 0.1, size * 0.24, size * 0.03);
        c.fill();
        roundRect(c, cx + size * 0.26, cy - size * 0.25, size * 0.1, size * 0.24, size * 0.03);
        c.fill();
        break;
      }
      case 'wizard_hat': {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(cx - size * 0.3, cy - size * 0.12);
        c.lineTo(cx + size * 0.3, cy - size * 0.12);
        c.lineTo(cx + size * 0.05, cy - size * 0.48);
        c.closePath();
        c.fill();
        c.fillStyle = '#FFD700';
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.arc(cx - size * 0.1 + i * size * 0.1, cy - size * 0.35, size * 0.025, 0, Math.PI * 2);
          c.fill();
        }
        break;
      }
      case 'viking': {
        c.fillStyle = col;
        roundRect(c, cx - size * 0.32, cy - size * 0.35, size * 0.64, size * 0.32, size * 0.08);
        c.fill();
        c.fillStyle = '#757575';
        [[-1, -1], [1, -1]].forEach(([sx, sy]) => {
          c.beginPath();
          c.moveTo(cx + sx * size * 0.25, cy - size * 0.35);
          c.lineTo(cx + sx * size * 0.38, cy - size * 0.55);
          c.lineTo(cx + sx * size * 0.15, cy - size * 0.35);
          c.fill();
        });
        c.fillStyle = '#FF8A65';
        roundRect(c, cx - size * 0.06, cy - size * 0.26, size * 0.12, size * 0.12, size * 0.02);
        c.fill();
        break;
      }
    }
    c.restore();
  }

  function drawBackgroundPreview(c, item, size) {
    if (item.type === 'solid') {
      c.fillStyle = item.color; c.fillRect(0, 0, size, size);
      c.fillStyle = item.alt || item.color;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        if ((x + y) % 2 === 0) c.fillRect(x * (size / 8), y * (size / 8), size / 8, size / 8);
      }
    } else {
      const g = c.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, item.color);
      g.addColorStop(0.5, item.alt || item.color);
      if (item.alt2) g.addColorStop(1, item.alt2); else g.addColorStop(1, item.color);
      c.fillStyle = g; c.fillRect(0, 0, size, size);
    }
    // Намёк на сетку
    c.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      if ((x + y) % 2 === 0) c.fillRect(x * (size / 6), y * (size / 6), size / 6, size / 6);
    }
  }

  function renderPreview(canvasEl, category, item) {
    const c = canvasEl.getContext('2d');
    const size = 120;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasEl.width = size * dpr; canvasEl.height = size * dpr;
    canvasEl.style.width = size + 'px'; canvasEl.style.height = size + 'px';
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, size, size);
    switch (category) {
      case 'snake': drawSnakePreview(c, item, size); break;
      case 'food': drawFoodPreview(c, item, size); break;
      case 'accessory': drawAccessoryPreview(c, item, size); break;
      case 'background': drawBackgroundPreview(c, item, size); break;
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  // ========== SHOP: Рендер списка товаров ==========
  function renderShopItems() {
    const cat = currentShopCategory;
    const items = SHOP_CATALOG[cat] || [];
    shopItemsEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    items.forEach((item) => {
      const owned = isOwned(item.id);
      const equipped = isEquipped(cat, item.id);
      const row = document.createElement('div');
      row.className = 'shop-item' + (owned ? ' owned' : '') + (equipped ? ' equipped' : '');

      const prev = document.createElement('div');
      prev.className = 'shop-preview';
      if (cat === 'background') {
        const bgDiv = document.createElement('div');
        bgDiv.className = 'shop-preview-bg';
        const tmpCanvas = document.createElement('canvas');
        renderPreview(tmpCanvas, 'background', item);
        // Получаем фон через canvas
        const styleItem = item;
        if (styleItem.type === 'solid') {
          bgDiv.style.background = styleItem.color;
        } else {
          let gr = `linear-gradient(180deg, ${styleItem.color} 0%, ${styleItem.alt || styleItem.color} 50%`;
          if (styleItem.alt2) gr += `, ${styleItem.alt2} 100%)`; else gr += ', ' + styleItem.color + ' 100%)';
          bgDiv.style.background = gr;
        }
        prev.appendChild(bgDiv);
        const miniC = document.createElement('canvas');
        miniC.style.position = 'relative';
        miniC.style.zIndex = '1';
        miniC.style.width = '70%'; miniC.style.height = '70%';
        renderPreview(miniC, 'snake', getEquipped('snake'));
        prev.appendChild(miniC);
      } else {
        const cvs = document.createElement('canvas');
        renderPreview(cvs, cat, item);
        prev.appendChild(cvs);
      }

      const name = document.createElement('div');
      name.className = 'shop-name';
      name.textContent = item.name;

      const btnRow = document.createElement('div');
      btnRow.style.width = '100%';
      btnRow.style.display = 'flex';
      btnRow.style.flexDirection = 'column';
      btnRow.style.gap = '4px';

      if (item.price > 0 || owned) {
        const priceRow = document.createElement('div');
        priceRow.className = 'shop-price-row';
        if (!owned) {
          const coinSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          coinSvg.setAttribute('viewBox', '0 0 24 24');
          coinSvg.setAttribute('width', '14');
          coinSvg.setAttribute('height', '14');
          coinSvg.innerHTML = '<circle cx="12" cy="12" r="9" fill="#FFD700" stroke="#D48806" stroke-width="1.5"/><text x="12" y="16" text-anchor="middle" font-size="10" font-weight="900" fill="#8B5A00">$</text>';
          const price = document.createElement('span');
          price.className = 'shop-price';
          price.textContent = item.price;
          priceRow.append(coinSvg, price);
          btnRow.appendChild(priceRow);
        }
      }

      const btn = document.createElement('button');
      btn.className = 'shop-buy-btn' + (owned ? ' owned' : '') + (equipped ? ' equipped' : '');
      if (!owned) {
        btn.textContent = 'Купить';
        btn.disabled = coins < item.price;
      } else if (equipped) {
        btn.textContent = 'Экипирован';
      } else {
        btn.textContent = 'Надеть';
      }
      btn.addEventListener('click', () => {
        if (!owned) {
          const r = buyItem(item);
          if (r.success) {
            sfx.ui();
            // После покупки сразу экипируем
            equipItem(cat, item);
            renderShopItems();
          } else {
            btn.animate(
              [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
              { duration: 260 }
            );
          }
        } else if (!equipped) {
          sfx.ui();
          equipItem(cat, item);
          renderShopItems();
        }
      });

      btnRow.appendChild(btn);
      row.append(prev, name, btnRow);
      frag.appendChild(row);
    });
    shopItemsEl.appendChild(frag);
  }

  function shopOpen() {
    shopModal.classList.add('active');
    renderShopItems();
    updateCoinsUI();
  }

  function shopClose() {
    shopModal.classList.remove('active');
  }

  // ---------- Utility ----------
  // Скорость движения. В «Бесконечной» — постоянная, задаётся чипом скорости;
  // в «Гонке» — плавное ускорение: первые яблоки почти не ускоряют, потом нарастает.
  function calcMoveDuration(score) {
    if (mode !== MODE_RACE) return ENDLESS_SPEEDS[endlessSpeed];
    const t = Math.min(1, Math.max(0, score / 25));
    return Math.round(MIN_SPEED + (BASE_SPEED - MIN_SPEED) * Math.sqrt(1 - t * t));
  }

  function spawnFood() {
    const occupied = new Set(snake.map(seg => seg.y * GRID + seg.x));
    const free = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (!occupied.has(y * GRID + x)) free.push({ x, y });
      }
    }
    if (free.length === 0) return false; // snake filled the board -> win
    // взвешенный выбор: чем дальше от края, тем выше шанс — яблоки чаще в центре
    const weights = free.map((c) => {
      const d = Math.min(c.x, c.y, GRID - 1 - c.x, GRID - 1 - c.y) + 1;
      return d * d;
    });
    let total = 0;
    weights.forEach((w) => { total += w; });
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < free.length; idx++) {
      r -= weights[idx];
      if (r <= 0) break;
    }
    food = free[idx];
    return true;
  }

  // ---------- Rendering ----------
  function draw(t) {
    ctx.clearRect(0, 0, boardSize, boardSize);
    drawBoard();
    drawFood();
    drawSnake(t);
  }

  function drawBoard() {
    const bg = getEquipped('background');
    const s = cellSize;
    if (bg.type === 'solid') {
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, boardSize, boardSize);
      ctx.fillStyle = bg.alt || bg.color;
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if ((x + y) % 2 === 0) {
            ctx.fillRect(x * s, y * s, s, s);
          }
        }
      }
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, boardSize);
      g.addColorStop(0, bg.color);
      g.addColorStop(0.5, bg.alt || bg.color);
      if (bg.alt2) g.addColorStop(1, bg.alt2); else g.addColorStop(1, bg.color);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, boardSize, boardSize);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if ((x + y) % 2 === 0) {
            ctx.fillRect(x * s, y * s, s, s);
          }
        }
      }
    }
  }

  function drawFood() {
    if (!food) return;
    const s = cellSize;
    const cx = food.x * s + s / 2;
    const cy = food.y * s + s / 2;
    const r = s * 0.36;
    const pulse = 1 + 0.08 * Math.sin(animTime / 300);
    const foodItem = getEquipped('food');

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.translate(-cx, -cy);

    const color = foodItem.color || COLORS.food;
    const hi = foodItem.highlight || COLORS.foodHighlight;
    const type = foodItem.type || 'apple';
    const sparkle = !!foodItem.sparkle;

    const drawLeaf = () => {
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.3, cy - r * 1, r * 0.35, r * 0.55, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#6BCB77';
      ctx.fill();
    };

    if (sparkle) { ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10; }

    switch (type) {
      case 'banana': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 1.1, r * 0.45, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hi; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 2, r * 1.05, r * 0.38, 0.4, 0, Math.PI);
        ctx.stroke();
        break;
      }
      case 'grape': {
        const offs = [[-r * 0.35, -r * 0.2], [r * 0.35, -r * 0.2], [0, 0], [-r * 0.35, r * 0.3], [r * 0.35, r * 0.3], [0, r * 0.55]];
        offs.forEach(([dx, dy], i) => {
          ctx.fillStyle = i % 2 ? color : hi;
          ctx.beginPath(); ctx.arc(cx + dx, cy + dy, r * 0.32, 0, Math.PI * 2); ctx.fill();
        });
        drawLeaf();
        break;
      }
      case 'strawberry': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.9, cy - r * 0.2);
        ctx.quadraticCurveTo(cx, cy + r * 1.1, cx + r * 0.9, cy - r * 0.2);
        ctx.quadraticCurveTo(cx, cy - r * 0.5, cx - r * 0.9, cy - r * 0.2);
        ctx.fill();
        ctx.fillStyle = hi;
        for (let i = 0; i < 6; i++) {
          const sx = cx - r * 0.6 + (i % 3) * r * 0.6;
          const sy = cy + r * 0.05 + Math.floor(i / 3) * r * 0.4;
          ctx.beginPath(); ctx.arc(sx, sy, r * 0.05, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.6, cy - r * 0.35);
        ctx.lineTo(cx, cy - r * 0.9);
        ctx.lineTo(cx + r * 0.6, cy - r * 0.35);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'orange': {
        const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        grad.addColorStop(0, hi); grad.addColorStop(1, color);
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(i * Math.PI / 3) * r * 0.85, cy + Math.sin(i * Math.PI / 3) * r * 0.85);
          ctx.stroke();
        }
        drawLeaf();
        break;
      }
      case 'watermelon': {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#D32F2F';
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#FFEBEE';
        for (let i = 0; i < 5; i++) {
          const a = Math.PI + (i + 1) * Math.PI / 6;
          ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.05, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'cherry': {
        [[-r * 0.4, r * 0.2], [r * 0.4, r * 0.2]].forEach(([dx, dy]) => {
          const g = ctx.createRadialGradient(cx + dx - r * 0.15, cy + dy - r * 0.15, r * 0.05, cx + dx, cy + dy, r * 0.55);
          g.addColorStop(0, hi); g.addColorStop(1, color);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx + dx, cy + dy, r * 0.55, 0, Math.PI * 2); ctx.fill();
        });
        ctx.strokeStyle = '#2E7D32'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.4, cy - r * 0.35);
        ctx.quadraticCurveTo(cx, cy - r * 1.1, cx + r * 0.4, cy - r * 0.35);
        ctx.stroke();
        break;
      }
      case 'pineapple': {
        ctx.fillStyle = color;
        roundRect(ctx, cx - r * 0.7, cy - r * 0.3, r * 1.4, r * 1.1, r * 0.2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,80,0,0.4)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.65, cy - r * 0.1 + i * r * 0.3);
          ctx.lineTo(cx + r * 0.65, cy - r * 0.1 + i * r * 0.3);
          ctx.stroke();
        }
        ctx.fillStyle = '#2E7D32';
        for (let i = 0; i < 5; i++) {
          const lx = cx - r * 0.5 + i * r * 0.25;
          ctx.beginPath();
          ctx.moveTo(lx, cy - r * 0.3);
          ctx.lineTo(lx - r * 0.1, cy - r * 0.85);
          ctx.lineTo(lx + r * 0.1, cy - r * 0.3);
          ctx.fill();
        }
        break;
      }
      case 'kiwi': {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#F1F8E9';
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color;
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI / 6;
          ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45, r * 0.04, r * 0.08, a, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'peach': {
        const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
        g.addColorStop(0, hi); g.addColorStop(1, color);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx - r * 0.25, cy, r * 0.75, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + r * 0.25, cy, r * 0.75, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#C62828'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.65); ctx.lineTo(cx, cy - r * 0.9); ctx.stroke();
        drawLeaf();
        break;
      }
      case 'diamond': {
        ctx.fillStyle = color;
        if (sparkle) { ctx.shadowColor = '#4DD0E1'; ctx.shadowBlur = 12; }
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy - r * 0.1);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy - r * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = hi; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy - r * 0.1); ctx.lineTo(cx + r * 0.5, cy - r * 0.1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
        break;
      }
      case 'golden':
      case 'apple':
      default: {
        const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        grad.addColorStop(0, hi);
        grad.addColorStop(1, color);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.shadowBlur = 0;
        drawLeaf();
        ctx.strokeStyle = '#8A5A2B'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.7); ctx.quadraticCurveTo(cx + r * 0.2, cy - r * 1.1, cx + r * 0.4, cy - r * 1.2); ctx.stroke();
        break;
      }
    }

    ctx.restore();
  }

  function segCenter(i, t) {
    const seg = snake[i];
    const prev = i < prevSnake.length ? prevSnake[i] : seg;
    const s = cellSize;
    return {
      x: (prev.x + (seg.x - prev.x) * t) * s + s / 2,
      y: (prev.y + (seg.y - prev.y) * t) * s + s / 2,
    };
  }

  function drawSnake(t) {
    const s = cellSize;
    const n = snake.length;
    const width = s * 0.86;
    const skin = getEquipped('snake');
    const acc = getEquipped('accessory');

    const bodyColor = (k) => {
      if (skin.rainbow) {
        const phase = (animTime / 2000 + k * 0.2) % 1;
        return `hsl(${Math.floor(phase * 360)}, 80%, 60%)`;
      }
      if (k === -1) return skin.head || COLORS.head;
      return k % 2 === 0 ? (skin.body || COLORS.body) : (skin.bodyDark || skin.body || COLORS.bodyDark);
    };

    const pts = [];
    for (let i = 0; i < n; i++) pts.push(segCenter(i, t));

    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    if (n > 1) {
      const mids = [];
      for (let j = 0; j < n - 1; j++) mids.push(mid(pts[j], pts[j + 1]));

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (skin.glow) { ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 8; }

      if (n === 2) {
        ctx.strokeStyle = bodyColor(0);
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[0].x, pts[0].y);
        ctx.stroke();
      } else {
        for (let k = n - 1; k >= 1; k--) {
          let start, control, end;
          if (k === 1) {
            start = pts[0];
            control = pts[1];
            end = mids[1];
          } else if (k === n - 1) {
            start = mids[n - 2];
            control = pts[n - 1];
            end = pts[n - 1];
          } else {
            start = mids[k - 1];
            control = pts[k];
            end = mids[k];
          }
          ctx.strokeStyle = bodyColor(k);
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;
    }

    const h = pts[0];
    if (skin.glow) { ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 12; }
    ctx.fillStyle = bodyColor(-1);
    ctx.beginPath();
    ctx.arc(h.x, h.y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    const ex = dir.x * s * 0.16;
    const ey = dir.y * s * 0.16;
    const eyeSpread = { x: -dir.y * s * 0.2, y: dir.x * s * 0.2 };
    const eyeR = s * 0.08;

    for (const side of [-1, 1]) {
      const exx = h.x + ex + eyeSpread.x * side;
      const eyy = h.y + ey + eyeSpread.y * side;
      ctx.beginPath();
      ctx.arc(exx, eyy, eyeR, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.eye;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(exx + dir.x * eyeR * 0.4, eyy + dir.y * eyeR * 0.4, eyeR * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.pupil;
      ctx.fill();
    }

    // ============ Аксессуар на голове ============
    if (acc && acc.type !== 'none') {
      const col = acc.color || '#FFD700';
      // Сдвиг аксессуара вверх относительно головы (в противоположную сторону движения)
      const offX = -dir.x * s * 0.35;
      const offY = -dir.y * s * 0.35;
      const ax = h.x + offX;
      const ay = h.y + offY;
      const sz = s * 0.55;
      ctx.save();
      ctx.translate(ax, ay);

      // Угол направления (для поворота аксессуара)
      let rotAng = 0;
      if (dir.x === 1) rotAng = 0;
      else if (dir.x === -1) rotAng = Math.PI;
      else if (dir.y === -1) rotAng = -Math.PI / 2;
      else if (dir.y === 1) rotAng = Math.PI / 2;
      ctx.rotate(rotAng);

      switch (acc.type) {
        case 'hat':
        case 'party_hat': {
          ctx.fillStyle = col;
          if (acc.type === 'party_hat') {
            ctx.beginPath();
            ctx.moveTo(-sz * 0.32, sz * 0.08);
            ctx.lineTo(sz * 0.08, -sz * 0.5);
            ctx.lineTo(sz * 0.32, sz * 0.08);
            ctx.fill();
            ctx.fillStyle = '#FFEB3B';
            ctx.beginPath(); ctx.arc(sz * 0.08, -sz * 0.5, sz * 0.1, 0, Math.PI * 2); ctx.fill();
          } else {
            roundRect(ctx, -sz * 0.38, -sz * 0.35, sz * 0.76, sz * 0.3, sz * 0.08);
            ctx.fill();
            roundRect(ctx, -sz * 0.46, -sz * 0.08, sz * 0.92, sz * 0.1, sz * 0.02);
            ctx.fill();
          }
          break;
        }
        case 'crown': {
          ctx.fillStyle = col;
          ctx.shadowColor = '#FFA000'; ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(-sz * 0.42, sz * 0.12);
          ctx.lineTo(-sz * 0.42, -sz * 0.15);
          ctx.lineTo(-sz * 0.22, -sz * 0.02);
          ctx.lineTo(0, -sz * 0.32);
          ctx.lineTo(sz * 0.22, -sz * 0.02);
          ctx.lineTo(sz * 0.42, -sz * 0.15);
          ctx.lineTo(sz * 0.42, sz * 0.12);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.arc(0, -sz * 0.2, sz * 0.06, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1E88E5'; ctx.beginPath(); ctx.arc(-sz * 0.26, -sz * 0.05, sz * 0.05, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#43A047'; ctx.beginPath(); ctx.arc(sz * 0.26, -sz * 0.05, sz * 0.05, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'glasses':
        case 'glasses_nerd': {
          ctx.strokeStyle = col; ctx.lineWidth = acc.type === 'glasses' ? 4 : 2;
          ctx.fillStyle = acc.type === 'glasses' ? 'rgba(10,10,10,0.85)' : 'rgba(255,255,255,0.55)';
          const rad = sz * 0.18;
          const offs = sz * 0.24;
          ctx.beginPath(); ctx.arc(-offs, sz * 0.02, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(offs, sz * 0.02, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-offs + rad, sz * 0.02); ctx.lineTo(offs - rad, sz * 0.02); ctx.stroke();
          break;
        }
        case 'bow': {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(-sz * 0.1, -sz * 0.1);
          ctx.lineTo(-sz * 0.46, -sz * 0.24);
          ctx.lineTo(-sz * 0.46, sz * 0.06);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(sz * 0.1, -sz * 0.1);
          ctx.lineTo(sz * 0.46, -sz * 0.24);
          ctx.lineTo(sz * 0.46, sz * 0.06);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#AD1457';
          roundRect(ctx, -sz * 0.08, -sz * 0.18, sz * 0.16, sz * 0.18, sz * 0.04);
          ctx.fill();
          break;
        }
        case 'flower': {
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = i % 2 ? col : '#FCE4EC';
            const a = i * Math.PI / 3;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * sz * 0.16, -sz * 0.22 + Math.sin(a) * sz * 0.16, sz * 0.11, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#FFEB3B';
          ctx.beginPath(); ctx.arc(0, -sz * 0.22, sz * 0.1, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'headphones': {
          ctx.strokeStyle = col; ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(0, -sz * 0.02, sz * 0.42, Math.PI, 0);
          ctx.stroke();
          ctx.fillStyle = col;
          roundRect(ctx, -sz * 0.48, -sz * 0.14, sz * 0.14, sz * 0.3, sz * 0.04);
          ctx.fill();
          roundRect(ctx, sz * 0.34, -sz * 0.14, sz * 0.14, sz * 0.3, sz * 0.04);
          ctx.fill();
          break;
        }
        case 'wizard_hat': {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(-sz * 0.4, sz * 0.1);
          ctx.lineTo(sz * 0.4, sz * 0.1);
          ctx.lineTo(sz * 0.05, -sz * 0.55);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#FFD700';
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(-sz * 0.14 + i * sz * 0.14, -sz * 0.4, sz * 0.04, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'viking': {
          ctx.fillStyle = col;
          roundRect(ctx, -sz * 0.42, -sz * 0.42, sz * 0.84, sz * 0.4, sz * 0.1);
          ctx.fill();
          ctx.fillStyle = '#757575';
          [[-1, -1], [1, -1]].forEach(([sx]) => {
            ctx.beginPath();
            ctx.moveTo(sx * sz * 0.3, -sz * 0.42);
            ctx.lineTo(sx * sz * 0.5, -sz * 0.7);
            ctx.lineTo(sx * sz * 0.18, -sz * 0.42);
            ctx.fill();
          });
          ctx.fillStyle = '#FF8A65';
          roundRect(ctx, -sz * 0.08, -sz * 0.32, sz * 0.16, sz * 0.16, sz * 0.03);
          ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
  }

  // ---------- Game loop ----------
  function advance() {
    prevSnake = snake.map(seg => ({ x: seg.x, y: seg.y }));

    if (!(nextDir.x === -dir.x && nextDir.y === -dir.y) && !(nextDir.x === 0 && nextDir.y === 0)) {
      dir = { ...nextDir };
    }

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
      endGame();
      return;
    }

    const willEat = head.x === food.x && head.y === food.y;
    const tailForCheck = willEat ? null : snake[snake.length - 1];
    for (let i = 0; i < snake.length; i++) {
      if (snake[i] === tailForCheck) break;
      if (snake[i].x === head.x && snake[i].y === head.y) {
        endGame();
        return;
      }
    }

    snake.unshift(head);

    if (willEat) {
      score++;
      scoreEl.textContent = score;
      addCoins(COINS_PER_APPLE);
      moveDuration = calcMoveDuration(score);
      sfx.eat();
      vibrate(20);
      if (!spawnFood()) {
        endGame(true); // board is full -> victory
        return;
      }
    } else {
      snake.pop();
    }
  }

  function frame(now) {
    if (!running || gameOver || paused) return;
    rafId = requestAnimationFrame(frame);

    animTime = now;

    if (mode === MODE_RACE) {
      if (now >= raceEndAt) {
        endGame(false, true); // время вышло
        return;
      }
      const left = Math.ceil((raceEndAt - now) / 1000);
      timerEl.textContent = fmtDur(left);
      timerEl.classList.toggle('low', left <= 10);
    }

    currentT = (now - moveStart) / moveDuration;

    if (currentT >= 1) {
      advance();
      moveStart = now;
      currentT = 0;
    }

    draw(currentT);
  }

  function startLoop() {
    cancelAnimationFrame(rafId);
    currentT = 0;
    moveStart = performance.now();
    animTime = performance.now();
    draw(0);
    rafId = requestAnimationFrame(frame);
  }

  function stopLoop() {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  function setPaused(p) {
    if (!running || gameOver || paused === p) return;
    paused = p;
    pauseOverlay.classList.toggle('hidden', !p);
    if (p) {
      stopLoop();
      pauseStart = performance.now();
    } else {
      // сдвигаем таймер Гонки на время паузы, чтобы не жульничать
      const pauseDur = performance.now() - pauseStart;
      if (mode === MODE_RACE) raceEndAt += pauseDur;
      moveStart = performance.now();
      startLoop();
    }
  }

  // ---------- Screen switching ----------
  function showScreen(name) {
    for (const key of Object.keys(screens)) {
      screens[key].classList.remove('active');
    }
    screens[name].classList.add('active');
    if (name === 'game') {
      requestAnimationFrame(() => {
        sizeCanvas();
        setTimeout(sizeCanvas, 50);
      });
    }
  }

  // ---------- Сохранение партии («Продолжить») ----------
  function clearSave() {
    savedGame = null;
    store.remove(SAVE_KEY);
  }

  function saveGame() {
    if (!running) return;
    const st = {
      saved: true,
      mode,
      score,
      snake: snake.map(seg => ({ x: seg.x, y: seg.y })),
      dir: { ...dir },
      nextDir: { ...nextDir },
      food: food ? { ...food } : null,
      raceLeftMs: mode === MODE_RACE ? Math.max(0, raceEndAt - performance.now()) : 0,
      raceDuration,
      endlessSpeed,
    };
    try {
      store.set(SAVE_KEY, JSON.stringify(st));
      savedGame = st;
    } catch (_) { /* не сохраняется */ }
  }

  function updateContinueBtn() {
    btnContinue.classList.toggle('hidden', !(savedGame && savedGame.saved));
  }

  function resumeGame() {
    if (!savedGame || !savedGame.saved || !Array.isArray(savedGame.snake) || savedGame.snake.length === 0) {
      startGame();
      return;
    }
    if (savedGame.mode === MODE_RACE) raceDuration = savedGame.raceDuration || DEFAULT_RACE_DURATION;
    mode = savedGame.mode;
    store.set(MODE_KEY, mode);
    if (mode === MODE_ENDLESS) {
      endlessSpeed = savedGame.endlessSpeed || endlessSpeedDefault;
      store.set(ENDLESS_SPEED_KEY, endlessSpeed);
    }
    snake = savedGame.snake.map(seg => ({ x: seg.x, y: seg.y }));
    prevSnake = snake.map(seg => ({ x: seg.x, y: seg.y }));
    dir = { ...savedGame.dir };
    nextDir = { ...savedGame.nextDir };
    food = savedGame.food ? { ...savedGame.food } : null;
    score = savedGame.score || 0;
    moveDuration = calcMoveDuration(score);
    gameOver = false;
    paused = false;
    pauseOverlay.classList.add('hidden');
    running = true;

    scoreEl.textContent = score;
    timerChipEl.classList.toggle('hidden', mode !== MODE_RACE);
    if (mode === MODE_RACE) {
      raceEndAt = performance.now() + (savedGame.raceLeftMs != null ? savedGame.raceLeftMs : raceDuration * 1000);
      timerEl.textContent = fmtDur(Math.ceil((raceEndAt - performance.now()) / 1000));
      timerEl.classList.remove('low');
    } else {
      raceEndAt = 0;
    }
    if (!food) spawnFood();
    clearSave();
    showScreen('game');
    requestAnimationFrame(() => {
      sizeCanvas();
      startLoop();
    });
  }

  // ---------- Start / end ----------
  function startGame() {
    clearSave();
    updateContinueBtn();
    const startX = Math.floor(GRID / 2);
    const startY = Math.floor(GRID / 2);
    snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    moveDuration = calcMoveDuration(0);
    gameOver = false;
    paused = false;
    pauseOverlay.classList.add('hidden');
    running = true;

    scoreEl.textContent = 0;
    timerChipEl.classList.toggle('hidden', mode !== MODE_RACE);
    raceEndAt = performance.now() + raceDuration * 1000;
    timerEl.textContent = fmtDur(raceDuration);
    timerEl.classList.remove('low');
    spawnFood();
    prevSnake = snake.map(seg => ({ x: seg.x, y: seg.y }));
    showScreen('game');
    requestAnimationFrame(() => {
      sizeCanvas();
      startLoop();
    });
  }

  function endGame(won = false, timedOut = false) {
    running = false;
    gameOver = true;
    paused = false;
    pauseOverlay.classList.add('hidden');
    stopLoop();
    clearSave();

    if (score > getBest()) {
      setBest(score);
    }

    const isRace = mode === MODE_RACE;
    overTitleEl.textContent = won ? 'Победа!' : (isRace ? 'Время вышло!' : 'Игра окончена');
    overTitleEl.classList.toggle('race-timeout', isRace && !won);
    if (won) { sfx.win(); vibrate([40, 60, 40]); }
    else { sfx.die(); vibrate(120); }
    finalScoreEl.textContent = score;
    bestScoreEl.textContent = getBest();
    lbStatusEl.textContent = '';
    lbStatusEl.classList.remove('fail');
    if (isRace) {
      btnLeadersOver.classList.remove('hidden');
      lbSubmit(score);
    } else {
      btnLeadersOver.classList.add('hidden');
    }
    showScreen('over');
  }

  // ---------- Leaderboard (только «Гонка») ----------
  async function lbSubmitRank() {
    if (!LB_ENABLED || !currentUser.vk_user_id) return null;
    try {
      const res = await fetch(CONFIG_URL + '/rank?category=' + encodeURIComponent(lbCategory()) + '&vk_user_id=' + encodeURIComponent(currentUser.vk_user_id), {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data && data.success && data.rank != null) ? data : null;
    } catch (_) {
      return null;
    }
  }

  async function lbSubmit(score) {
    if (!LB_ENABLED || !currentUser.vk_user_id || score <= 0) {
      lbStatusEl.textContent = '';
      return;
    }
    const payload = {
      vk_user_id: currentUser.vk_user_id,
      first_name: currentUser.first_name || 'Игрок',
      last_name: currentUser.last_name || '',
      photo_100: currentUser.photo_100 || '',
      score,
      category: lbCategory(),
      vk_sign_params: vkSignParamsStr || null,
    };
    try {
      lbStatusEl.textContent = 'Рекорд отправляется в топ…';
      const res = await fetch(CONFIG_URL + '/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      // показываем место игрока в категории
      const rankData = await lbSubmitRank();
      if (rankData) {
        const place = rankData.rank;
        const total = rankData.total || 0;
        if (data && data.updated) {
          lbStatusEl.textContent = 'Новый рекорд! Ты на ' + place + '-м месте' + (total ? ' из ' + total : '') + '.';
        } else if (place <= 10) {
          lbStatusEl.textContent = 'Ты на ' + place + '-м месте в топе!';
        } else if (total) {
          lbStatusEl.textContent = 'Ты на ' + place + '-м месте из ' + total + '.';
        } else {
          lbStatusEl.textContent = 'Попробуй побить свой рекорд!';
        }
      } else if (data && data.updated) {
        lbStatusEl.textContent = 'Новый рекорд — в топе!';
      } else {
        lbStatusEl.textContent = 'В топе ещё выше — попробуй побить!';
      }
    } catch (_) {
      lbStatusEl.classList.add('fail');
      lbStatusEl.textContent = 'Не удалось отправить рекорд';
    }
  }

  async function lbFetch(category) {
    if (!LB_ENABLED) return [];
    try {
      const res = await fetch(CONFIG_URL + '/leaderboard?category=' + encodeURIComponent(category) + '&limit=10', {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data && data.success && Array.isArray(data.leaderboard)) ? data.leaderboard : [];
    } catch (_) {
      return [];
    }
  }

  function lbRender(list) {
    lbList.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      lbList.innerHTML = '<div class="lb-empty">Пока нет рекордов.<br>Стань первым в Гонке!</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach((u, i) => {
      const row = document.createElement('div');
      const isSelf = currentUser.vk_user_id != null && String(u.vk_user_id) === String(currentUser.vk_user_id);
      row.className = 'lb-row' + (i < 3 ? ' lb-top' : '') + (isSelf ? ' lb-self' : '');
      const rank = document.createElement('span');
      rank.className = 'lb-rank' + (i === 0 ? ' lb-first' : '');
      rank.textContent = i + 1;
      const av = document.createElement('span');
      av.className = 'lb-avatar';
      if (u.photo_100) {
        const img = document.createElement('img');
        img.className = 'lb-avatar-img';
        img.alt = '';
        img.src = u.photo_100;
        img.onerror = function () { img.style.display = 'none'; };
        av.appendChild(img);
      } else {
        av.textContent = ((u.first_name || 'И').charAt(0)).toUpperCase();
      }
      const name = document.createElement('span');
      name.className = 'lb-name';
      name.textContent = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Игрок';
      const sc = document.createElement('span');
      sc.className = 'lb-score';
      sc.textContent = u.score;
      row.append(rank, av, name, sc);
      frag.appendChild(row);
    });
    lbList.appendChild(frag);
  }

  async function lbOpen(category) {
    lbModal.classList.add('active');
    lbList.innerHTML = '<div class="lb-empty">Загрузка…</div>';
    if (!LB_ENABLED) {
      lbList.innerHTML = '<div class="lb-empty">Лидерборд ещё не подключён.<br>Заполни WORKER_URL в js/config.js.</div>';
      return;
    }
    const list = await lbFetch(category);
    lbRender(list.slice(0, 10));
  }

  function lbClose() {
    lbModal.classList.remove('active');
  }

  function applyModeUI() {
    modeBtns.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    const isRace = mode === MODE_RACE;
    durRow.classList.toggle('hidden', !isRace);
    speedRow.classList.toggle('hidden', isRace);
    timerChipEl.classList.toggle('hidden', !isRace);
    if (isRace) timerEl.textContent = fmtDur(raceDuration);
    durChips.forEach((c) => c.classList.toggle('active', Number(c.dataset.sec) === raceDuration));
    speedChips.forEach((c) => c.classList.toggle('active', c.dataset.speed === endlessSpeed));
    subtitleEl.textContent = isRace
      ? 'Съешь как можно больше яблок за ' + raceDuration + ' секунд!'
      : 'Собирай яблоки и расти!';
    modeBestEl.textContent = 'Рекорд: ' + getBest();
    btnLeaders.classList.toggle('hidden', !isRace);
    lbTabs.forEach((t) => t.classList.toggle('active', t.dataset.cat === lbCategory()));
  }

  // ---------- Input ----------
  function setDirection(x, y) {
    if (!running || gameOver) return;
    if (dir.x === -x && dir.y === -y) return;
    nextDir = { x, y };
  }

  document.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'ц' || k === 'Ц') setDirection(0, -1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S' || k === 'ы' || k === 'Ы') setDirection(0, 1);
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'ф' || k === 'Ф') setDirection(-1, 0);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'в' || k === 'В') setDirection(1, 0);
    else if (k === 'Escape' || k === 'p' || k === 'P' || k === 'з' || k === 'З') {
      if (shopModal.classList.contains('active')) shopClose();
      else if (lbModal.classList.contains('active')) lbClose();
      else setPaused(true);
    }
    else if (k === 'Enter' || k === ' ') {
      if (paused) setPaused(false);
      else if (!running && !gameOver) startGame();
      else if (gameOver) startGame();
    }
  });

  let swipeStart = null;
  let swipeConsumed = false;
  const SWIPE_MIN = 14;

  function swipeStartFn(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    swipeStart = { x: t.clientX, y: t.clientY };
    swipeConsumed = false;
  }

  function swipeMoveFn(e) {
    if (!swipeStart || swipeConsumed) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    // пока жест не сработал — запрещаем прокрутку страницы пальцем
    e.preventDefault();
    const dx = t.clientX - swipeStart.x;
    const dy = t.clientY - swipeStart.y;
    if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
    if (Math.abs(dx) >= Math.abs(dy)) setDirection(dx > 0 ? 1 : -1, 0);
    else setDirection(0, dy > 0 ? 1 : -1);
    swipeConsumed = true;
  }

  function swipeEndFn(e) {
    if (!swipeStart) return;
    const start = swipeStart;
    const t = e.changedTouches && e.changedTouches[0];
    const xy = t ? { x: t.clientX, y: t.clientY } : start;
    swipeStart = null;
    if (swipeConsumed) return;
    const dx = xy.x - start.x;
    const dy = xy.y - start.y;
    if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
    if (Math.abs(dx) >= Math.abs(dy)) setDirection(dx > 0 ? 1 : -1, 0);
    else setDirection(0, dy > 0 ? 1 : -1);
  }

  window.addEventListener('touchstart', swipeStartFn, { passive: true });
  window.addEventListener('touchmove', swipeMoveFn, { passive: false });
  window.addEventListener('touchend', swipeEndFn, { passive: true });
  window.addEventListener('touchcancel', swipeEndFn, { passive: true });

  // ---------- Buttons ----------
  btnPlay.addEventListener('click', () => { sfx.ui(); startGame(); });
  btnContinue.addEventListener('click', () => { sfx.ui(); resumeGame(); });
  btnRetry.addEventListener('click', () => { sfx.ui(); startGame(); });
  btnPause.addEventListener('click', () => setPaused(true));
  btnResume.addEventListener('click', () => { sfx.ui(); setPaused(false); });
  btnPauseHome.addEventListener('click', () => {
    saveGame();
    paused = false;
    pauseOverlay.classList.add('hidden');
    running = false;
    gameOver = false;
    stopLoop();
    updateContinueBtn();
    applyModeUI();
    showScreen('start');
  });
  btnHome.addEventListener('click', () => {
    running = false;
    gameOver = false;
    stopLoop();
    updateContinueBtn();
    applyModeUI();
    showScreen('start');
  });

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!btn.classList.contains('active')) sfx.ui();
      mode = btn.dataset.mode;
      store.set(MODE_KEY, mode);
      clearSave();
      updateContinueBtn();
      applyModeUI();
    });
  });

  durChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      if (!chip.classList.contains('active')) sfx.ui();
      raceDuration = Number(chip.dataset.sec);
      store.set(DUR_KEY, String(raceDuration));
      clearSave();
      updateContinueBtn();
      applyModeUI();
    });
  });

  speedChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      if (!chip.classList.contains('active')) sfx.ui();
      endlessSpeed = chip.dataset.speed;
      store.set(ENDLESS_SPEED_KEY, endlessSpeed);
      clearSave();
      updateContinueBtn();
      applyModeUI();
    });
  });

  btnSound.addEventListener('click', () => { sfx.ui(); sfx.toggleMute(); updateSoundIcon(); });
  btnLeaders.addEventListener('click', () => { sfx.ui(); lbOpen(lbCategory()); });
  btnLeadersOver.addEventListener('click', () => { sfx.ui(); lbOpen(lbCategory()); });
  btnLbClose.addEventListener('click', () => { sfx.ui(); lbClose(); });
  lbModalBg.addEventListener('click', lbClose);

  lbTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (!tab.classList.contains('active')) sfx.ui();
      lbTabs.forEach((t) => t.classList.toggle('active', t === tab));
      lbOpen(tab.dataset.cat);
    });
  });

  // ========== Shop buttons ==========
  btnShop.addEventListener('click', () => { sfx.ui(); shopOpen(); });
  btnShopClose.addEventListener('click', () => { sfx.ui(); shopClose(); });
  shopModalBg.addEventListener('click', shopClose);

  shopTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (!tab.classList.contains('active')) sfx.ui();
      shopTabs.forEach((t) => t.classList.toggle('active', t === tab));
      currentShopCategory = tab.dataset.cat;
      renderShopItems();
    });
  });

  // ---------- Auto-pause on background ----------
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !gameOver && !paused) {
      saveGame();
      setPaused(true);
    }
  });

  // ---------- Canvas sizing ----------
  function sizeCanvas() {
    const wrap = canvas.parentElement;
    const wrapRect = wrap ? wrap.getBoundingClientRect() : null;
    const rect = canvas.getBoundingClientRect();
    const w = wrapRect && wrapRect.width > 1 ? wrapRect.width : rect.width;
    const h = wrapRect && wrapRect.height > 1 ? wrapRect.height : rect.height;
    if (w < 1 || h < 1) return;
    const side = Math.min(w, h);
    if (side < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = side + 'px';
    canvas.style.height = side + 'px';
    canvas.width = Math.round(side * dpr);
    canvas.height = Math.round(side * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    boardSize = side;
    cellSize = boardSize / GRID;
    draw(currentT);
  }

  window.addEventListener('resize', sizeCanvas);
  window.addEventListener('orientationchange', () => setTimeout(sizeCanvas, 150));
  window.addEventListener('load', sizeCanvas);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => sizeCanvas());
    const wrap = canvas.parentElement;
    if (wrap) ro.observe(wrap);
    ro.observe(document.documentElement);
  }

  // ---------- Init ----------
  timerChipEl.classList.add('hidden');
  btnLeadersOver.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  updateSoundIcon();
  updateContinueBtn();
  updateCoinsUI();
  applyModeUI();
})();