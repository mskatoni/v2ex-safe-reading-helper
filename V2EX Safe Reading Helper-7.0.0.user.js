// ==UserScript==
// @name         V2EX Safe Reading Helper
// @namespace    local.v2ex.safe
// @version      7.0.0
// @description  V2EX 自动阅读助手 - 从当前帖往前遍历
// @match        https://www.v2ex.com/*
// @match        https://v2ex.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const ORIGIN    = location.origin;
  const DELAY_MIN = 10_000;
  const DELAY_MAX = 15_000;
  const LOOK_BACK = 50;

  // 当前页 ID（非帖子页则为 null）
  const pageId = Number(location.pathname.match(/\/t\/(\d+)/)?.[1]) || null;

  function ss(key, val) {
    if (val === undefined) { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } }
    try { sessionStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  // 起点：当前页 ID，或上次记录的起点
  let startId = pageId || ss('v2sr_start');
  let cursor  = ss('v2sr_cursor') || 0;  // 已走步数

  function nextId() {
    if (!startId) return null;
    // 走完 LOOK_BACK 步后重置，以新页面 ID 为起点
    if (cursor >= LOOK_BACK) {
      startId = pageId || startId;
      cursor  = 0;
      ss('v2sr_start', startId);
    }
    cursor++;
    ss('v2sr_cursor', cursor);
    return startId - cursor;
  }

  let timer = null;

  function next() {
    const id = nextId();
    if (!id || id <= 0) { setStatus('已到底，重置'); cursor = 0; ss('v2sr_cursor', 0); next(); return; }
    ss('v2sr_start', startId);
    location.href = `${ORIGIN}/t/${id}`;
  }

  function schedule() {
    const ms = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN);
    const target = Date.now() + ms;
    const tick = () => {
      const rem = Math.ceil((target - Date.now()) / 1000);
      setCD(rem);
      timer = rem > 0 ? setTimeout(tick, 500) : setTimeout(next, 0);
    };
    tick();
  }

  function start() { ss('v2sr_run', 1); setRunning(true); schedule(); setStatus('自动阅读中…'); }
  function pause() { ss('v2sr_run', 0); clearTimeout(timer); setRunning(false); setCD(0); setStatus('已暂停。'); }

  // ── UI ────────────────────────────────────────────────────────
  function el(tag, css, text) {
    const e = document.createElement(tag);
    if (css)  e.style.cssText = css;
    if (text) e.textContent = text;
    return e;
  }
  function btn(label, bg) {
    return el('button',
      `background:${bg};color:#fff;border:none;padding:4px 10px;` +
      `border-radius:6px;cursor:pointer;font-size:12px;line-height:1.4;`, label);
  }

  const panel    = el('div',
    'position:fixed;right:16px;bottom:16px;z-index:999999;background:#111;color:#fff;' +
    'padding:10px 14px;border-radius:10px;font-size:13px;max-width:260px;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.35);font-family:system-ui,sans-serif;');
  const statsEl  = el('span', 'font-size:11px;color:#aaa;');
  const cdEl     = el('div',  'font-size:22px;font-weight:700;margin-top:8px;display:none;');
  const statusEl = el('div',  'margin-top:5px;color:#aaa;font-size:11px;min-height:14px;');

  const startBtn = btn('▶ 开始',   '#1a73e8');
  const pauseBtn = btn('⏸ 暂停',   '#555');
  const nextBtn  = btn('⏭ 下一帖', '#2d7a2d');

  const header = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;');
  header.append(el('span', 'font-weight:700;font-size:14px;', 'V2EX 阅读助手'), statsEl);

  const controls = el('div', 'display:flex;gap:6px;');
  controls.append(startBtn, pauseBtn, nextBtn);
  panel.append(header, controls, cdEl, statusEl);
  document.body.appendChild(panel);

  function setStatus(t)  { statusEl.textContent = t; }
  function setCD(sec)    { cdEl.style.display = sec > 0 ? 'block' : 'none'; cdEl.textContent = sec > 0 ? `⏱ ${sec}s` : ''; }
  function updateStats() { statsEl.textContent = `${cursor}/${LOOK_BACK} | ID ${startId ? startId - cursor : '?'}`; }
  function setRunning(v) { startBtn.disabled = v; pauseBtn.disabled = !v; }

  startBtn.onclick = start;
  pauseBtn.onclick = pause;
  nextBtn.onclick  = () => { clearTimeout(timer); next(); };

  // 初始化：没有起点 ID 时拉一次 API 取最新 ID
  async function init() {
    if (!startId) {
      setStatus('获取最新帖子 ID…');
      const topics = await fetch(`${ORIGIN}/api/topics/latest.json`, { credentials: 'same-origin' })
        .then(r => r.ok ? r.json() : []).catch(() => []);
      startId = topics.length ? Math.max(...topics.map(t => Number(t.id))) : null;
      ss('v2sr_start', startId);
    }
    updateStats();
    if (ss('v2sr_run')) {
      setRunning(true);
      setStatus('自动阅读中…');
      schedule();
    } else {
      setRunning(false);
      setStatus(startId ? `起点 ID ${startId}，点击 ▶ 开始。` : '获取失败，请刷新。');
    }
  }

  init();
})();