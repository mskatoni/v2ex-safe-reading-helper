// ==UserScript==
// @name         V2EX Safe Reading Helper
// @namespace    local.v2ex.safe
// @version      7.0.3
// @description  V2EX 自动阅读助手 - 菜单控制、隐藏发帖/评论入口、spam 举报附加
// @match        https://www.v2ex.com/*
// @match        https://v2ex.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';

  const ORIGIN = location.origin;
  const STORAGE_PREFIX = 'v2sr';
  const DELAY_MIN = 10_000;
  const DELAY_MAX = 15_000;
  const LOOK_BACK = 50;
  const ISSUES_URL = 'https://github.com/mskatoni/v2ex-safe-reading-helper/issues';

  const SETTINGS = {
    autoReadEnabled: 'autoRead.enabled',
    hideActionsEnabled: 'hideActions.enabled',
    spamReportEnabled: 'spamReport.enabled',
  };

  const pageId = Number(location.pathname.match(/\/t\/(\d+)/)?.[1]) || null;
  let timer = null;

  const reportUsers = [
    'Livid',
    'Kai',
    'Olivia',
    'GordianZ',
    'sparanoid',
    'drymonfidelia',
    'sillydaddy',
  ];
  const reportText = reportUsers.map((username) => `@${username}`).join(' ');

  function storageKey(key) {
    return `${STORAGE_PREFIX}:${key}`;
  }

  function getSetting(key, fallback) {
    try {
      if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
      const raw = localStorage.getItem(storageKey(key));
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function setSetting(key, value) {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(key, value);
        return;
      }
      localStorage.setItem(storageKey(key), JSON.stringify(value));
    } catch {
      // Ignore storage failures; defaults will be used on the next load.
    }
  }

  function ss(key, value) {
    const fullKey = storageKey(key);
    if (value === undefined) {
      try {
        return JSON.parse(sessionStorage.getItem(fullKey));
      } catch {
        return null;
      }
    }
    try {
      sessionStorage.setItem(fullKey, JSON.stringify(value));
    } catch {
      // Ignore sessionStorage failures for transient reading state.
    }
    return value;
  }

  function addStyle(css) {
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(css);
      return;
    }
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function registerMenu(label, callback) {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand(label, callback);
    }
  }

  function toggleLabel(label, enabled) {
    return enabled ? `✅ ${label}` : label;
  }

  function registerToggle(label, key, currentValue, onToggle) {
    registerMenu(toggleLabel(label, currentValue), () => {
      const nextValue = !currentValue;
      setSetting(key, nextValue);
      onToggle?.(nextValue);
      window.location.reload();
    });
  }

  const autoReadEnabled = getSetting(SETTINGS.autoReadEnabled, false) === true;
  const hideActionsEnabled = getSetting(SETTINGS.hideActionsEnabled, false) === true;
  const spamReportEnabled = getSetting(SETTINGS.spamReportEnabled, true) === true;

  registerToggle('自动阅读', SETTINGS.autoReadEnabled, autoReadEnabled, (enabled) => {
    if (enabled) resetStartFromCurrentPage();
    else clearTimeout(timer);
  });
  registerMenu('下一帖', () => {
    clearTimeout(timer);
    next();
  });
  registerMenu('重置阅读起点', () => {
    resetStartFromCurrentPage();
    window.location.reload();
  });
  registerToggle('屏蔽发帖/评论入口', SETTINGS.hideActionsEnabled, hideActionsEnabled);
  registerToggle('Spam 举报附加', SETTINGS.spamReportEnabled, spamReportEnabled);
  registerMenu('问题反馈', () => {
    window.open(ISSUES_URL, '_blank', 'noopener,noreferrer');
  });

  function resetStartFromCurrentPage() {
    if (pageId) ss('start', pageId);
    ss('cursor', 0);
  }

  const AutoReadModule = {
    async init() {
      if (!ss('start')) {
        if (pageId) {
          ss('start', pageId);
          ss('cursor', 0);
        } else {
          await this.ensureLatestStart();
        }
      }

      if (autoReadEnabled) this.schedule();
    },

    async ensureLatestStart() {
      const startId = await this.fetchLatestTopicId();
      if (startId) {
        ss('start', startId);
        ss('cursor', 0);
      }
    },

    async fetchLatestTopicId() {
      try {
        const response = await fetch(`${ORIGIN}/api/topics/latest.json`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return null;
        const topics = await response.json();
        return Array.isArray(topics) && topics.length
          ? Math.max(...topics.map((topic) => Number(topic.id)).filter(Number.isFinite))
          : null;
      } catch {
        return null;
      }
    },

    getNextId() {
      let startId = Number(ss('start')) || pageId || null;
      let cursor = Number(ss('cursor')) || 0;
      if (!startId) return null;

      if (cursor >= LOOK_BACK) {
        startId = pageId || startId;
        cursor = 0;
        ss('start', startId);
      }

      cursor += 1;
      ss('cursor', cursor);
      return startId - cursor;
    },

    schedule() {
      clearTimeout(timer);
      const ms = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN);
      timer = setTimeout(() => next(), ms);
    },
  };

  function next() {
    let id = AutoReadModule.getNextId();
    if (!id || id <= 0) {
      ss('cursor', 0);
      id = AutoReadModule.getNextId();
    }
    if (!id || id <= 0) return;
    location.href = `${ORIGIN}/t/${id}`;
  }

  const HideActionsModule = {
    selectors: [
      '#pro-campaign-container',
      '#Rightbar > div.box:nth-child(4) > div.cell:first-child',
      '#Rightbar a[href="/new"]',
      '#Rightbar a[href^="/new/"]',
      'a[href="/new"]',
      'a[href^="/new/"]',
      '#reply-box',
      '#reply-box input[type="submit"]',
      '#reply-box input[type="button"]',
      '#reply-box button[type="submit"]',
    ],
    observer: null,
    timer: 0,

    init() {
      this.injectStyle();
      this.hideSoon(0);
      this.observer = new MutationObserver(() => this.hideSoon(120));
      this.observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
      });
    },

    injectStyle() {
      addStyle(`
        ${this.selectors.join(',\n        ')} {
          display: none !important;
        }
      `);
    },

    hideSoon(delay) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.hideNow(), delay);
    },

    hideNow() {
      for (const selector of this.selectors) {
        document.querySelectorAll(selector).forEach((node) => {
          node.style.setProperty('display', 'none', 'important');
        });
      }
    },
  };

  const SpamReportModule = {
    init() {
      document.addEventListener('submit', (event) => this.onSubmit(event), true);
      document.addEventListener('click', (event) => this.onClick(event), true);
      document.addEventListener('keydown', (event) => this.onKeydown(event), true);
    },

    onSubmit(event) {
      this.applyToForm(event.target);
    },

    onClick(event) {
      const button = event.target.closest?.('input[type="submit"], button[type="submit"], button, input[type="button"]');
      if (!button) return;
      const form = button.form || button.closest?.('form');
      if (form) this.applyToForm(form);
    },

    onKeydown(event) {
      if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return;
      const form = event.target.closest?.('form');
      if (form) this.applyToForm(form);
    },

    applyToForm(form) {
      if (!(form instanceof HTMLFormElement)) return;
      const textarea = this.findTextarea(form);
      if (!textarea) return;
      this.applyToTextarea(textarea);
    },

    findTextarea(form) {
      return (
        form.querySelector('textarea[name="content"]') ||
        form.querySelector('#reply_content') ||
        form.querySelector('textarea')
      );
    },

    applyToTextarea(textarea) {
      const value = textarea.value || '';
      if (!/^spam$/i.test(value.trim())) return;
      textarea.value = `${value.trim()}\n\n${reportText}`;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    },
  };

  if (hideActionsEnabled) HideActionsModule.init();
  if (spamReportEnabled) SpamReportModule.init();
  AutoReadModule.init();
})();
