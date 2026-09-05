(() => {
  'use strict';

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
  const btnRetry = document.getElementById('btn-retry');
  const btnHome = document.getElementById('btn-home');
  const dpadBtns = document.querySelectorAll('.dpad-btn');

  // ---------- Constants ----------
  const GRID = 15;
  const BASE_SPEED = 140;
  const MIN_SPEED = 70;
  const SPEED_STEP = 6;
  const MODE_ENDLESS = 'endless';
  const MODE_RACE = 'race';
  const RACE_DURATIONS = [60, 90, 120];
  const DEFAULT_RACE_DURATION = 60;
  const BEST_ENDLESS_KEY = 'snake_best_score';
  const BEST_RACE_KEY = (d) => 'snake_best_race' + d;
  const MODE_KEY = 'snake_mode';
  const DUR_KEY = 'snake_duration';
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

  // ---------- State ----------
  let snake = [];
  let prevSnake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = null;
  let score = 0;
  let bestEndless = Number(localStorage.getItem(BEST_ENDLESS_KEY) || 0);
  const bestRace = {};
  RACE_DURATIONS.forEach((d) => {
    bestRace[d] = Number(localStorage.getItem(BEST_RACE_KEY(d)) || 0);
  });
  let running = false;
  let gameOver = false;
  let gameWon = false;
  let rafId = null;
  let moveDuration = BASE_SPEED;
  let moveStart = 0;
  let animTime = 0;
  let currentT = 0;
  let cellSize = 0;
  let boardSize = 0;
  let mode = localStorage.getItem(MODE_KEY) === MODE_RACE ? MODE_RACE : MODE_ENDLESS;
  let raceDuration = Number(localStorage.getItem(DUR_KEY) || DEFAULT_RACE_DURATION);
  let raceEndAt = 0;

  // dev/test helper: ?race=5 запускает Гонку на 5 секунд (дробные тоже можно)
  let urlRaceOverride = 0;
  try {
    urlRaceOverride = Number(new URLSearchParams(window.location.search).get('race'));
  } catch (_) { /* игнор */ }
  if (urlRaceOverride > 0) {
    raceDuration = urlRaceOverride;
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
    bestEndless: 'snakeBestScore',
    bestRace: (d) => 'snakeBestRace' + d,
    all: () => [VK_STORAGE.bestEndless].concat(RACE_DURATIONS.map((d) => VK_STORAGE.bestRace(d))),
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
    const keys = { endless: VK_STORAGE.bestEndless };
    RACE_DURATIONS.forEach((d) => { keys['race' + d] = VK_STORAGE.bestRace(d); });

    vkStorageGetBatch(Object.values(keys)).then((remote) => {
      let changed = false;
      const merge = (key, val) => {
        const prev = Number(val) || 0;
        if (key === 'endless') {
          if (prev > bestEndless) { bestEndless = prev; localStorage.setItem(BEST_ENDLESS_KEY, String(bestEndless)); changed = true; }
        } else {
          const d = Number(key.replace('race', ''));
          if (prev > (bestRace[d] || 0)) { bestRace[d] = prev; localStorage.setItem(BEST_RACE_KEY(d), String(prev)); changed = true; }
        }
      };
      Object.keys(keys).forEach((k) => {
        const rv = remote[keys[k]];
        if (rv != null) merge(k, rv);
      });
      // если локальный рекорд выше — подтягиваем его в облако
      vkStorageSet(VK_STORAGE.bestEndless, bestEndless);
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
      }).catch(() => {})
    ).catch(() => {});
  }
  initVk();

  function lbCategory() {
    return MODE_RACE + raceDuration;
  }

  function getBest() {
    return mode === MODE_RACE ? (bestRace[raceDuration] || 0) : bestEndless;
  }

  function setBest(n) {
    if (mode === MODE_RACE) {
      bestRace[raceDuration] = n;
      localStorage.setItem(BEST_RACE_KEY(raceDuration), String(n));
      vkStorageSet(VK_STORAGE.bestRace(raceDuration), n);
    } else {
      bestEndless = n;
      localStorage.setItem(BEST_ENDLESS_KEY, String(n));
      vkStorageSet(VK_STORAGE.bestEndless, n);
    }
  }

  function fmtDur(sec) {
    const s = Math.max(0, Math.floor(sec));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  // ---------- Utility ----------
  function spawnFood() {
    const occupied = new Set(snake.map(seg => seg.y * GRID + seg.x));
    const free = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (!occupied.has(y * GRID + x)) free.push({ x, y });
      }
    }
    if (free.length === 0) return false; // snake filled the board -> win
    food = free[Math.floor(Math.random() * free.length)];
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
    ctx.fillStyle = COLORS.board;
    ctx.fillRect(0, 0, boardSize, boardSize);
    const s = cellSize;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillRect(x * s, y * s, s, s);
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

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.translate(-cx, -cy);

    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    grad.addColorStop(0, COLORS.foodHighlight);
    grad.addColorStop(1, COLORS.food);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx + r * 0.3, cy - r * 0.95, r * 0.35, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.body;
    ctx.fill();

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

    const pts = [];
    for (let i = 0; i < n; i++) pts.push(segCenter(i, t));

    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    if (n > 1) {
      const mids = [];
      for (let j = 0; j < n - 1; j++) mids.push(mid(pts[j], pts[j + 1]));

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (n === 2) {
        ctx.strokeStyle = COLORS.body;
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
          ctx.strokeStyle = k % 2 === 0 ? COLORS.body : COLORS.bodyDark;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
          ctx.stroke();
        }
      }
    }

    const h = pts[0];
    ctx.fillStyle = COLORS.head;
    ctx.beginPath();
    ctx.arc(h.x, h.y, width / 2, 0, Math.PI * 2);
    ctx.fill();

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
      moveDuration = Math.max(MIN_SPEED, BASE_SPEED - score * SPEED_STEP);
      if (!spawnFood()) {
        endGame(true); // board is full -> victory
        return;
      }
    } else {
      snake.pop();
    }
  }

  function frame(now) {
    if (!running || gameOver) return;
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

  // ---------- Screen switching ----------
  function showScreen(name) {
    for (const key of Object.keys(screens)) {
      screens[key].classList.remove('active');
    }
    screens[name].classList.add('active');
  }

  // ---------- Start / end ----------
  function startGame() {
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
    gameOver = false;
    gameWon = false;
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
    gameWon = won;
    stopLoop();

    if (score > getBest()) {
      setBest(score);
    }

    const isRace = mode === MODE_RACE;
    overTitleEl.textContent = won ? 'Победа!' : (isRace ? 'Время вышло!' : 'Игра окончена');
    overTitleEl.classList.toggle('race-timeout', isRace && !won);
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
      if (data && data.updated) {
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
    timerChipEl.classList.toggle('hidden', !isRace);
    if (isRace) timerEl.textContent = fmtDur(raceDuration);
    durChips.forEach((c) => c.classList.toggle('active', Number(c.dataset.sec) === raceDuration));
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
    else if (k === 'Escape') lbClose();
    else if (k === 'Enter' || k === ' ') {
      if (!running && !gameOver) startGame();
      else if (gameOver) startGame();
    }
  });

  dpadBtns.forEach((btn) => {
    const onPress = () => {
      const dirStr = btn.dataset.dir;
      const map = {
        up: () => setDirection(0, -1),
        down: () => setDirection(0, 1),
        left: () => setDirection(-1, 0),
        right: () => setDirection(1, 0),
      };
      map[dirStr]();
    };
    btn.addEventListener('click', onPress);
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      onPress();
    }, { passive: false });
  });

  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      setDirection(dx > 0 ? 1 : -1, 0);
    } else {
      setDirection(0, dy > 0 ? 1 : -1);
    }
  }, { passive: true });

  // ---------- Buttons ----------
  btnPlay.addEventListener('click', startGame);
  btnRetry.addEventListener('click', startGame);
  btnHome.addEventListener('click', () => {
    running = false;
    gameOver = false;
    stopLoop();
    applyModeUI();
    showScreen('start');
  });

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      localStorage.setItem(MODE_KEY, mode);
      applyModeUI();
    });
  });

  durChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      raceDuration = Number(chip.dataset.sec);
      localStorage.setItem(DUR_KEY, String(raceDuration));
      applyModeUI();
    });
  });

  btnLeaders.addEventListener('click', () => lbOpen(lbCategory()));
  btnLeadersOver.addEventListener('click', () => lbOpen(lbCategory()));
  btnLbClose.addEventListener('click', lbClose);
  lbModalBg.addEventListener('click', lbClose);

  lbTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      lbTabs.forEach((t) => t.classList.toggle('active', t === tab));
      lbOpen(tab.dataset.cat);
    });
  });

  // ---------- Canvas sizing ----------
  function sizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    boardSize = rect.width;
    cellSize = boardSize / GRID;
    draw(currentT);
  }

  window.addEventListener('resize', sizeCanvas);
  window.addEventListener('load', sizeCanvas);

  // ---------- Init ----------
  timerChipEl.classList.add('hidden');
  btnLeadersOver.classList.add('hidden');
  applyModeUI();
})();