// ==UserScript==
// @name         V2EX Safe Reading Helper
// @namespace    local.v2ex.safe
// @version      5.3.0
// @description  V2EX 自动阅读助手 - 持久化队列/运行状态 + 多来源轮询 + 白屏/卡死自动刷新保护
// @match        https://www.v2ex.com/*
// @match        https://v2ex.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-idle
// ==/UserScript==
(() => {
  'use strict';

  const ORIGIN = location.origin;

  // ── 存储 key ─────────────────────────────────────────────────
  const STORE_PREFIX = 'v2ex_safe_reader_';
  const Q_KEY = STORE_PREFIX + 'queue';
  const SEEN_KEY = STORE_PREFIX + 'seen_session';
  const CURSOR_KEY = STORE_PREFIX + 'cursor';
  const RUN_KEY = STORE_PREFIX + 'run';
  const MIGRATION_KEY = STORE_PREFIX + 'migrated_530';
  const RECOVERY_KEY = STORE_PREFIX + 'last_recovery_reload';

  const LEGACY_Q_KEY = 'v2ex_q';
  const LEGACY_SEEN_KEY = 'v2ex_s';
  const LEGACY_CURSOR_KEY = 'v2ex_cur';

  const SEEN_MAX = 300;
  const QUEUE_MAX = 100;
  const REFILL_THRESH = 5;
  const MIN_DELAY = 10_000;
  const MAX_DELAY = 15_000;
  const RESUME_GRACE_DELAY = 5_000;
  const FETCH_TIMEOUT = 8_000;
  const RETRY_BASE = 60_000;
  const RETRY_CAP = 300_000;
  const NET_ERR_WAIT = 15_000;
  const ID_SCAN_BATCH = 5;
  const ID_SCAN_DEPTH = 500;
  const WATCHDOG_LIMIT = 60_000;
  const WATCHDOG_TICK = 5_000;

  const NODES = [
    'tech', 'programmer', 'share', 'qna', 'deals', 'offtopic',
    'apple', 'android', 'linux', 'python', 'javascript', 'go',
    'rust', 'career', 'jobs', 'finance', 'gaming', 'creative',
    'cn', 'design', 'hardware', 'docker', 'git', 'isp',
    'beijing', 'shanghai', 'guangzhou', 'shenzhen',
  ];

  const DEFAULT_CURSOR = {
    recentPage: 1,
    nodeIdx: 0,
    nodePage: 1,
    idScanNext: null,
    idFloor: null,
    latestMaxId: null,
  };

  let _qCache = null;
  let _seenCache = null;
  let _cursorCache = null;
  let _runCache = null;

  let countdownTimer = null;
  let retryTimer = null;
  let watchdogTimer = null;
  let nextAt = null;
  let retryCount = 0;
  let isRefilling = false;
  let refillPromise = null;
  let sourceIdx = 0;
  let lastHeartbeat = Date.now();
  let blankSince = null;
  let ui = null;

  function hasGMStorage() {
    return typeof GM_getValue === 'function' &&
      typeof GM_setValue === 'function' &&
      typeof GM_deleteValue === 'function';
  }

  function cloneFallback(value) {
    if (value === null || value === undefined) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch { return value; }
  }

  function storeGet(key, fallback) {
    try {
      if (hasGMStorage()) return GM_getValue(key, cloneFallback(fallback));
      const raw = localStorage.getItem(key);
      return raw === null ? cloneFallback(fallback) : JSON.parse(raw);
    } catch {
      return cloneFallback(fallback);
    }
  }

  function storeSet(key, value) {
    try {
      if (hasGMStorage()) GM_setValue(key, value);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch { }
  }

  function storeDelete(key) {
    try {
      if (hasGMStorage()) GM_deleteValue(key);
      else localStorage.removeItem(key);
    } catch { }
  }

  function legacyJSON(storage, key, fallback) {
    try {
      const raw = storage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function migrateLegacyStore() {
    if (storeGet(MIGRATION_KEY, false)) return;

    const currentQueue = storeGet(Q_KEY, []);
    const legacyQueue = legacyJSON(sessionStorage, LEGACY_Q_KEY, []);
    if ((!Array.isArray(currentQueue) || !currentQueue.length) && Array.isArray(legacyQueue) && legacyQueue.length) {
      storeSet(Q_KEY, normalizeQueue(legacyQueue));
    }

    const currentCursor = storeGet(CURSOR_KEY, null);
    const legacyCursor = legacyJSON(sessionStorage, LEGACY_CURSOR_KEY, null);
    if (!currentCursor && legacyCursor && typeof legacyCursor === 'object') {
      storeSet(CURSOR_KEY, normalizeCursor(legacyCursor));
    }

    const legacySeen = legacyJSON(localStorage, LEGACY_SEEN_KEY, []);
    if (Array.isArray(legacySeen) && legacySeen.length && !sessionStorage.getItem(SEEN_KEY)) {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify(legacySeen.slice(-SEEN_MAX)));
    }

    storeSet(MIGRATION_KEY, true);
  }

  function normalizeTopic(t) {
    const id = Number(t?.id);
    if (!Number.isFinite(id) || id <= 0) return null;
    return {
      id,
      title: String(t?.title || '').trim() || `Topic ${id}`,
      node: String(t?.node || '').trim(),
      url: String(t?.url || `${ORIGIN}/t/${id}`),
    };
  }

  function normalizeQueue(items) {
    const out = [];
    const seen = new Set();
    for (const raw of Array.isArray(items) ? items : []) {
      const topic = normalizeTopic(raw);
      if (!topic || seen.has(topic.id)) continue;
      seen.add(topic.id);
      out.push(topic);
      if (out.length >= QUEUE_MAX) break;
    }
    return out;
  }

  function normalizeCursor(cursor) {
    const c = { ...DEFAULT_CURSOR, ...(cursor && typeof cursor === 'object' ? cursor : {}) };
    c.recentPage = Math.max(1, Number(c.recentPage) || 1);
    c.nodeIdx = Math.max(0, Number(c.nodeIdx) || 0);
    c.nodePage = Math.max(1, Number(c.nodePage) || 1);
    c.idScanNext = Number.isFinite(Number(c.idScanNext)) ? Number(c.idScanNext) : null;
    c.idFloor = Number.isFinite(Number(c.idFloor)) ? Number(c.idFloor) : null;
    c.latestMaxId = Number.isFinite(Number(c.latestMaxId)) ? Number(c.latestMaxId) : null;
    return c;
  }

  function qGet() {
    if (_qCache !== null) return _qCache;
    _qCache = normalizeQueue(storeGet(Q_KEY, []));
    return _qCache;
  }

  function qSave(items) {
    _qCache = normalizeQueue(items);
    storeSet(Q_KEY, _qCache);
  }

  function qLen() { return qGet().length; }

  function qShift() {
    const q = qGet();
    const t = q.shift();
    qSave(q);
    return t;
  }

  function seenGet() {
    if (_seenCache !== null) return _seenCache;
    try { _seenCache = new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]').map(Number)); }
    catch { _seenCache = new Set(); }
    return _seenCache;
  }

  function seenMark(id) {
    const s = seenGet();
    s.add(Number(id));
    const compact = [...s].filter(Number.isFinite).slice(-SEEN_MAX);
    _seenCache = new Set(compact);
    try { sessionStorage.setItem(SEEN_KEY, JSON.stringify(compact)); } catch { }
  }

  function seenClear() {
    _seenCache = new Set();
    try {
      sessionStorage.removeItem(SEEN_KEY);
      localStorage.removeItem(LEGACY_SEEN_KEY);
    } catch { }
  }

  function cursorGet() {
    if (_cursorCache !== null) return _cursorCache;
    _cursorCache = normalizeCursor(storeGet(CURSOR_KEY, DEFAULT_CURSOR));
    return _cursorCache;
  }

  function cursorSave(cursor) {
    _cursorCache = normalizeCursor(cursor);
    storeSet(CURSOR_KEY, _cursorCache);
  }

  function cursorClear() {
    _cursorCache = { ...DEFAULT_CURSOR };
    storeDelete(CURSOR_KEY);
  }

  function runGet() {
    if (_runCache !== null) return _runCache;
    const run = storeGet(RUN_KEY, { mode: 'idle', nextAt: null, retryCount: 0 });
    _runCache = run && typeof run === 'object' ? run : { mode: 'idle', nextAt: null, retryCount: 0 };
    retryCount = Number(_runCache.retryCount) || 0;
    return _runCache;
  }

  function runSave(run) {
    _runCache = {
      mode: run.mode || 'idle',
      nextAt: Number.isFinite(Number(run.nextAt)) ? Number(run.nextAt) : null,
      retryCount: Number(run.retryCount) || 0,
      retryKind: run.retryKind || null,
    };
    storeSet(RUN_KEY, _runCache);
  }

  function runClear() {
    _runCache = { mode: 'idle', nextAt: null, retryCount: 0 };
    storeDelete(RUN_KEY);
  }

  async function fetchJSON(url) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    try {
      const r = await fetch(url, { signal: ctrl.signal, credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (r.status === 429) return { data: null, rateLimited: true, networkError: false };
      const data = r.ok ? await r.json() : null;
      return { data, rateLimited: false, networkError: false };
    } catch {
      return { data: null, rateLimited: false, networkError: true };
    } finally {
      clearTimeout(tid);
    }
  }

  async function fetchHTML(url) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    try {
      const r = await fetch(url, { signal: ctrl.signal, credentials: 'same-origin', headers: { Accept: 'text/html' } });
      if (r.status === 429) return { html: null, rateLimited: true, networkError: false };
      const html = r.ok ? await r.text() : null;
      return { html, rateLimited: false, networkError: false };
    } catch {
      return { html: null, rateLimited: false, networkError: true };
    } finally {
      clearTimeout(tid);
    }
  }

  function parseTopicsFromHTML(html) {
    if (!html) return [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const seenIds = new Set();
    const topics = [];

    for (const link of doc.querySelectorAll('a.topic-link[href^="/t/"]')) {
      const m = link.getAttribute('href')?.match(/\/t\/(\d+)/);
      if (!m) continue;
      const id = Number(m[1]);
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const row = link.closest('.cell, .item, .topic') || link.parentElement;
      const nodeLink = row?.querySelector('a.node[href^="/go/"]');
      const node = nodeLink?.getAttribute('href')?.replace(/^\/go\//, '') || '';
      topics.push({
        id,
        title: link.textContent.trim(),
        node,
        url: `${ORIGIN}/t/${id}`,
      });
    }

    return topics;
  }

  async function sourceAPI() {
    const [latest, hot] = await Promise.all([
      fetchJSON(`${ORIGIN}/api/topics/latest.json`),
      fetchJSON(`${ORIGIN}/api/topics/hot.json`),
    ]);
    const rateLimited = latest.rateLimited || hot.rateLimited;
    const networkError = latest.networkError && hot.networkError;
    const byId = new Map();

    for (const t of [...(latest.data ?? []), ...(hot.data ?? [])]) {
      if (t?.id) byId.set(Number(t.id), t);
    }

    const topics = [...byId.values()].map(t => ({
      id: Number(t.id),
      title: t.title,
      node: t.node?.name ?? '',
      url: t.url || `${ORIGIN}/t/${t.id}`,
    }));

    if (topics.length) {
      const maxId = Math.max(...topics.map(t => t.id));
      const c = cursorGet();
      if (!c.latestMaxId || maxId > c.latestMaxId) {
        c.latestMaxId = maxId;
        if (!c.idScanNext || c.idScanNext <= (c.idFloor ?? 0)) {
          c.idScanNext = maxId - 1;
          c.idFloor = maxId - ID_SCAN_DEPTH;
        }
        cursorSave(c);
      }
    }

    return { topics, rateLimited, networkError };
  }

  async function sourceRecent() {
    const c = cursorGet();
    const page = c.recentPage;
    const { html, rateLimited, networkError } = await fetchHTML(`${ORIGIN}/recent?p=${page}`);
    if (rateLimited || networkError) return { topics: [], rateLimited, networkError };

    const topics = parseTopicsFromHTML(html);
    c.recentPage = topics.length > 0 ? page + 1 : 1;
    cursorSave(c);
    return { topics, rateLimited, networkError };
  }

  async function sourceNode() {
    const c = cursorGet();
    const node = NODES[c.nodeIdx % NODES.length];
    const page = c.nodePage;
    const { html, rateLimited, networkError } = await fetchHTML(`${ORIGIN}/go/${node}?p=${page}`);
    if (rateLimited || networkError) return { topics: [], rateLimited, networkError, node, page };

    const topics = parseTopicsFromHTML(html);
    if (topics.length > 0) {
      c.nodePage = page + 1;
    } else {
      c.nodeIdx = (c.nodeIdx + 1) % NODES.length;
      c.nodePage = 1;
    }
    cursorSave(c);
    return { topics, rateLimited, networkError, node, page };
  }

  async function sourceIDScan() {
    const c = cursorGet();
    if (c.idScanNext === null) return { topics: [], rateLimited: false, networkError: false };

    const ids = [];
    let scanNext = c.idScanNext;
    for (let i = 0; i < ID_SCAN_BATCH && scanNext > (c.idFloor ?? 0); i++, scanNext--) {
      if (!seenGet().has(scanNext)) ids.push(scanNext);
    }

    if (!ids.length) {
      c.idScanNext = scanNext;
      cursorSave(c);
      return { topics: [], rateLimited: false, networkError: false };
    }

    const results = await Promise.all(
      ids.map(id => fetchJSON(`${ORIGIN}/api/topics/show.json?id=${id}`))
    );
    const networkError = results.every(r => r.networkError);
    const rateLimited = results.some(r => r.rateLimited);

    if (!networkError && !rateLimited) {
      c.idScanNext = scanNext;
      cursorSave(c);
    }

    const topics = results
      .flatMap(r => Array.isArray(r.data) ? r.data : [])
      .filter(t => t?.id && t?.title && !t.deleted)
      .map(t => ({
        id: Number(t.id),
        title: t.title,
        node: t.node?.name ?? '',
        url: t.url || `${ORIGIN}/t/${t.id}`,
      }));

    return { topics, rateLimited, networkError };
  }

  const SOURCE_PIPELINE = ['api', 'recent', 'node', 'idScan'];

  async function runNextSource() {
    const name = SOURCE_PIPELINE[sourceIdx % SOURCE_PIPELINE.length];
    sourceIdx++;
    switch (name) {
      case 'api':
        return { ...(await sourceAPI()), source: 'API' };
      case 'recent': {
        const before = cursorGet().recentPage;
        return { ...(await sourceRecent()), source: `/recent p${before}` };
      }
      case 'node': {
        const before = cursorGet();
        const node = NODES[before.nodeIdx % NODES.length];
        return { ...(await sourceNode()), source: `/go/${node} p${before.nodePage}` };
      }
      case 'idScan':
        return { ...(await sourceIDScan()), source: 'ID扫描' };
      default:
        return { topics: [], rateLimited: false, networkError: false, source: 'unknown' };
    }
  }

  async function refill(silent = false) {
    if (refillPromise) return refillPromise;

    refillPromise = (async () => {
      if (isRefilling) return { added: 0, rateLimited: false, networkError: false };
      isRefilling = true;
      if (!silent) setStatus('补充队列…');

      try {
        let added = 0;
        let rateLimited = false;
        let attempts = 0;
        let networkFailures = 0;

        for (let attempt = 0; attempt < SOURCE_PIPELINE.length; attempt++) {
          const result = await runNextSource();
          attempts++;
          if (result.networkError) networkFailures++;
          rateLimited = rateLimited || result.rateLimited;

          if (result.rateLimited) {
            if (!silent) setStatus(`[${result.source}] 触发限流，暂停补队列`);
            break;
          }

          const seenIds = seenGet();
          const inQIds = new Set(qGet().map(t => Number(t.id)));
          const fresh = [];
          for (const raw of result.topics) {
            const topic = normalizeTopic(raw);
            if (!topic || seenIds.has(topic.id) || inQIds.has(topic.id)) continue;
            fresh.push(topic);
            inQIds.add(topic.id);
          }

          if (fresh.length) {
            qSave([...qGet(), ...fresh]);
            added += fresh.length;
            if (!silent) setStatus(`[${result.source}] +${fresh.length} 新帖，共 ${qLen()}`);
            break;
          }

          if (!silent) setStatus(`[${result.source}] 无新帖，切换来源…`);
        }

        return {
          added,
          rateLimited,
          networkError: attempts > 0 && networkFailures === attempts,
        };
      } finally {
        isRefilling = false;
        refillPromise = null;
        updateStats();
      }
    })();

    return refillPromise;
  }

  function refillIfLow() {
    if (qLen() >= REFILL_THRESH) return;
    refill(true).then(({ networkError }) => {
      if (networkError) setStatus('网络异常，预补失败');
    });
  }

  function createPanel() {
    if (!document.body) {
      document.documentElement.appendChild(document.createElement('body'));
    }

    const box = document.createElement('div');
    box.id = 'vr-panel';
    box.style.cssText = `
      position:fixed;right:16px;bottom:16px;z-index:999999;
      background:#111;color:#fff;padding:10px 14px;
      border-radius:10px;font-size:13px;
      box-shadow:0 4px 16px rgba(0,0,0,.35);
      max-width:300px;line-height:1.6;
      font-family:system-ui,sans-serif;
    `;
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:700;font-size:14px;">V2EX 阅读助手</span>
        <span data-role="stats" style="font-size:11px;color:#aaa;"></span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button data-action="start"  style="${bs('#1a73e8')}">▶ 开始</button>
        <button data-action="pause"  style="${bs('#555')}" disabled>⏸ 暂停</button>
        <button data-action="next"   style="${bs('#2d7a2d')}">⏭ 下一帖</button>
        <button data-action="reload" style="${bs('#7a4a00')}">🔄 刷新</button>
        <button data-action="clear"  style="${bs('#6b21a8')}" title="清除队列、已读、游标和运行状态">🗑 重置</button>
      </div>
      <div data-role="cd" style="margin-top:8px;font-size:22px;font-weight:700;display:none;"></div>
      <div data-role="status" style="margin-top:5px;color:#aaa;font-size:11px;min-height:14px;word-break:break-all;"></div>
    `;
    document.body.appendChild(box);
    return {
      panel: box,
      start: box.querySelector('[data-action="start"]'),
      pause: box.querySelector('[data-action="pause"]'),
      next: box.querySelector('[data-action="next"]'),
      reload: box.querySelector('[data-action="reload"]'),
      clear: box.querySelector('[data-action="clear"]'),
      stats: box.querySelector('[data-role="stats"]'),
      cd: box.querySelector('[data-role="cd"]'),
      status: box.querySelector('[data-role="status"]'),
    };
  }

  function bs(bg) {
    return `background:${bg};color:#fff;border:none;padding:4px 10px;
            border-radius:6px;cursor:pointer;font-size:12px;line-height:1.4;`;
  }

  function setStatus(text) {
    if (ui?.status) ui.status.textContent = text;
  }

  function updateStats() {
    if (ui?.stats) ui.stats.textContent = `队列 ${qLen()} | 已读 ${seenGet().size}`;
  }

  function setCD(sec, color = '#fff') {
    if (!ui?.cd) return;
    if (sec === null) {
      ui.cd.style.display = 'none';
      ui.cd.textContent = '';
      return;
    }
    ui.cd.style.display = 'block';
    ui.cd.style.color = color;
    ui.cd.textContent = `⏱ ${sec}s`;
  }

  function setRunning(active) {
    if (ui?.start) ui.start.disabled = active;
    if (ui?.pause) ui.pause.disabled = !active;
  }

  function randomDelay() {
    return MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
  }

  function clearTimers({ clearRun = false } = {}) {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (clearRun) runClear();
    setCD(null);
    nextAt = null;
  }

  function scheduleNext(delay = randomDelay()) {
    clearTimers();
    retryCount = 0;
    nextAt = Date.now() + Math.max(RESUME_GRACE_DELAY, Number(delay) || RESUME_GRACE_DELAY);
    runSave({ mode: 'running', nextAt, retryCount });

    countdownTimer = setInterval(() => {
      updateStats();
      const rem = Math.ceil((nextAt - Date.now()) / 1000);
      if (rem > 0) {
        setCD(rem);
      } else {
        clearTimers();
        openNext();
      }
    }, 1_000);

    setCD(Math.ceil((nextAt - Date.now()) / 1000));
    setRunning(true);
  }

  async function startReading() {
    clearTimers();
    setRunning(true);

    if (!qLen()) {
      setStatus('队列为空，先补充…');
      const r = await refill(true);
      if (!qLen()) {
        waitAndRetry({ rateLimited: r.rateLimited, networkError: r.networkError });
        return;
      }
    }

    scheduleNext();
  }

  async function openNext() {
    if (!qLen()) {
      setStatus('队列为空，尝试补充…');
      const r = await refill(true);
      if (!qLen()) {
        waitAndRetry({ rateLimited: r.rateLimited, networkError: r.networkError });
        return;
      }
    }

    const next = qShift();
    if (!next) {
      waitAndRetry();
      return;
    }

    seenMark(next.id);
    refillIfLow();
    updateStats();
    setStatus(`[${next.node}] ${next.title}`);
    runSave({ mode: 'running', nextAt: null, retryCount: 0 });
    location.href = next.url;
  }

  function retryDelayFor(kind) {
    if (kind === 'network') return NET_ERR_WAIT;
    if (kind === 'rate') return RETRY_CAP;
    return Math.min(RETRY_BASE * 2 ** retryCount, RETRY_CAP);
  }

  function retryLabel(kind) {
    if (kind === 'network') return '网络异常';
    if (kind === 'rate') return '触发限流';
    return '暂无未读新帖';
  }

  function waitAndRetry({ rateLimited = false, networkError = false, targetAt = null, retryKind = null } = {}) {
    clearTimers();
    setRunning(true);

    const kind = retryKind || (networkError ? 'network' : rateLimited ? 'rate' : 'empty');
    const waitMs = retryDelayFor(kind);
    if (kind === 'empty' && !targetAt) retryCount++;

    let target = Number(targetAt) || Date.now() + waitMs;
    if (target <= Date.now()) target = Date.now() + RESUME_GRACE_DELAY;
    nextAt = target;
    runSave({ mode: 'retry', nextAt: target, retryCount, retryKind: kind });

    setStatus(`${retryLabel(kind)}，${Math.round((target - Date.now()) / 1000)}s 后重试…`);

    countdownTimer = setInterval(() => {
      updateStats();
      const rem = Math.ceil((target - Date.now()) / 1000);
      setCD(rem > 0 ? rem : 0, kind === 'network' ? '#ef4444' : '#f59e0b');
      if (rem <= 0 && !hasReadableContent()) reloadForRecovery('异常空页重试超时');
    }, 1_000);

    retryTimer = setTimeout(async () => {
      clearTimers();
      setStatus('检查新帖…');
      const r = await refill(true);
      if (r.networkError) waitAndRetry({ networkError: true });
      else if (r.rateLimited) waitAndRetry({ rateLimited: true });
      else if (r.added > 0 || qLen() > 0) {
        retryCount = 0;
        setStatus(`+${r.added} 新帖，继续…`);
        scheduleNext();
      } else {
        waitAndRetry();
      }
    }, Math.max(0, target - Date.now()));
  }

  function markCurrentPageSeen() {
    const m = location.pathname.match(/\/t\/(\d+)/);
    if (!m) return;
    const id = Number(m[1]);
    seenMark(id);
    qSave(qGet().filter(t => Number(t.id) !== id));
  }

  function hasReadableContent() {
    if (!document.body) return false;
    const main = document.querySelector('#Wrapper, #Main, #Content, .box, .cell');
    if (!main) return false;
    const text = (main.textContent || '').replace(/\s+/g, '');
    return text.length >= 20;
  }

  function reloadForRecovery(reason) {
    const now = Date.now();
    const lastReload = Number(storeGet(RECOVERY_KEY, 0)) || 0;
    if (now - lastReload < WATCHDOG_LIMIT) return;
    storeSet(RECOVERY_KEY, now);
    if (_runCache?.mode && _runCache.mode !== 'idle') runSave(_runCache);
    setStatus(`${reason}，自动刷新…`);
    location.reload();
  }

  function startWatchdog() {
    lastHeartbeat = Date.now();
    watchdogTimer = setInterval(() => {
      const now = Date.now();
      const gap = now - lastHeartbeat;
      lastHeartbeat = now;

      if (gap > WATCHDOG_LIMIT) {
        reloadForRecovery(`页面无响应超过 ${Math.round(gap / 1000)}s`);
        return;
      }

      const panelMissing = !ui?.panel?.isConnected;
      const blank = !hasReadableContent() || panelMissing;
      if (blank) {
        blankSince ||= now;
        if (now - blankSince >= WATCHDOG_LIMIT) reloadForRecovery('白屏超过 60s');
      } else {
        blankSince = null;
      }
    }, WATCHDOG_TICK);
  }

  function resumeRunState() {
    const run = runGet();
    if (run.mode === 'running') {
      const remaining = Number(run.nextAt) ? Number(run.nextAt) - Date.now() : randomDelay();
      scheduleNext(Math.max(RESUME_GRACE_DELAY, remaining));
      setStatus('已恢复自动阅读');
      return true;
    }

    if (run.mode === 'retry') {
      waitAndRetry({
        targetAt: run.nextAt,
        retryKind: run.retryKind || 'empty',
      });
      setStatus('已恢复重试等待');
      return true;
    }

    return false;
  }

  async function autoStart() {
    migrateLegacyStore();
    markCurrentPageSeen();
    updateStats();

    if (qLen() < REFILL_THRESH) {
      setStatus('初始化，多来源加载…');
      const { networkError } = await refill(true);
      if (networkError) setStatus('初始化失败，网络异常');
    }

    updateStats();

    if (!resumeRunState()) {
      setRunning(false);
      setStatus('就绪，点击▶开始。');
    }
  }

  ui = createPanel();
  ui.start.onclick = startReading;
  ui.pause.onclick = () => {
    clearTimers({ clearRun: true });
    setRunning(false);
    setStatus('已暂停。');
  };
  ui.next.onclick = () => {
    clearTimers();
    openNext();
  };
  ui.reload.onclick = () => refill();
  ui.clear.onclick = () => {
    seenClear();
    qSave([]);
    cursorClear();
    runClear();
    retryCount = 0;
    sourceIdx = 0;
    updateStats();
    setRunning(false);
    setStatus('已重置（队列 + 已读 + 游标 + 运行状态）。');
  };

  startWatchdog();
  autoStart();
})();
