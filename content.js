/**
 * Aukro User Watchdog
 * Copyright (c) 2026 djfinch (https://github.com/djfinch/aukro-hlidac)
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

let targetUsers = [];

function injectStyles() {
  if (document.getElementById('aukro-hlidac-styles')) return;
  const style = document.createElement('style');
  style.id = 'aukro-hlidac-styles';
  style.textContent = `
    @keyframes aukroBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.2; }
    }
    .aukro-warning-badge {
      display: inline-block !important;
      width: 0.95em !important;
      height: 0.95em !important;
      margin-left: 0.25em !important;
      vertical-align: -0.12em !important;
      cursor: help !important;
      line-height: 0 !important;
      flex-shrink: 0 !important;
    }
    .aukro-badge-blink {
      animation: aukroBlink 1s infinite ease-in-out !important;
    }
    .aukro-warning-badge svg {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
    }
  `;
  document.head.appendChild(style);
}

function createWarningBadge(user) {
  const type = user.type || 'red';
  const span = document.createElement('span');
  span.className = 'aukro-warning-badge';
  span.dataset.badgeType = type;

  // Blink only for red and yellow warning badges
  if (type === 'red' || type === 'yellow') {
    span.classList.add('aukro-badge-blink');
  }

  if (type === 'green') {
    span.title = user.note ? `✅ OVĚŘENO: ${user.note}` : '✅ Ověřený uživatel';
    span.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://w3.org">
      <circle cx="12" cy="12" r="10" fill="#16a34a"/>
      <path d="M9.5 16.2L5.8 12.5l1.4-1.4 2.3 2.3 6.3-6.3 1.4 1.4-7.7 7.7z" fill="#ffffff"/>
    </svg>`;
  } else if (type === 'yellow') {
    span.title = user.note ? `⚠️ UPOZORNĚNÍ: ${user.note}` : '⚠️ Sledovaný uživatel';
    span.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://w3.org">
      <path d="M12 2L1 21h22L12 2z" fill="#f59e0b"/>
      <path d="M13 17h-2v-2h2v2zm0-4h-2V9h2v4z" fill="#111111"/>
    </svg>`;
  } else {
    span.title = user.note ? `⚠️ POZOR: ${user.note}` : '⚠️ Problémový uživatel';
    span.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://w3.org">
      <path d="M12 2L1 21h22L12 2z" fill="#e60000"/>
      <path d="M13 17h-2v-2h2v2zm0-4h-2V9h2v4z" fill="#ffffff"/>
    </svg>`;
  }

  return span;
}

// Safely normalize legacy string entries and object entries
function normalizeUsers(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList.map(item => {
    if (typeof item === 'string') return { name: item.trim(), note: '', type: 'red' };
    if (item && item.name) {
      const validType = ['red', 'yellow', 'green'].includes(item.type) ? item.type : 'red';
      return { name: item.name.trim(), note: item.note || '', type: validType };
    }
    return null;
  }).filter(Boolean);
}

// Strip standard and non-breaking spaces and convert to lowercase
function cleanText(str) {
  return (str || '').replace(/[\s\u00A0\u200B-\u200D\uFEFF]+/g, ' ').trim().toLowerCase();
}

function reportMatchCount() {
  // Count only red and yellow warning badges for the toolbar alert icon
  const count = document.querySelectorAll('.aukro-warning-badge[data-badge-type="red"], .aukro-warning-badge[data-badge-type="yellow"]').length;
  try {
    chrome.runtime.sendMessage({ type: 'AUKRO_MATCH_COUNT', count });
  } catch (e) {
    // Ignore connection errors during extension reload
  }
}

function scanAndMark() {
  if (!document.body) return;
  if (!targetUsers.length) {
    reportMatchCount();
    return;
  }

  const candidates = document.querySelectorAll('a, span, div, p, strong, b, td, th, h1, h2, h3, h4');

  candidates.forEach(el => {
    if (el.dataset.aukroMarked) return;
    if (el.children.length > 3) return;
    if (el.classList.contains('aukro-warning-badge') || el.closest('.aukro-warning-badge')) return;

    const text = cleanText(el.textContent);
    if (!text) return;

    const matchedUser = targetUsers.find(u => cleanText(u.name) === text);
    
    if (matchedUser) {
      el.dataset.aukroMarked = 'true';
      el.appendChild(createWarningBadge(matchedUser));
    }
  });

  reportMatchCount();
}

injectStyles();

chrome.storage.sync.get(['blockedUsers'], (result) => {
  targetUsers = normalizeUsers(result.blockedUsers);
  scanAndMark();
});

// Observe DOM mutations for dynamically loaded content
let scanTimeout;
const observer = new MutationObserver(() => {
  clearTimeout(scanTimeout);
  scanTimeout = setTimeout(scanAndMark, 300);
});

observer.observe(document.body, { 
  childList: true, 
  subtree: true, 
  characterData: true 
});

// React immediately to storage updates from popup or other tabs
chrome.storage.onChanged.addListener((changes) => {
  if (changes.blockedUsers) {
    targetUsers = normalizeUsers(changes.blockedUsers.newValue);
    document.querySelectorAll('.aukro-warning-badge').forEach(el => el.remove());
    document.querySelectorAll('[data-aukro-marked]').forEach(el => delete el.dataset.aukroMarked);
    scanAndMark();
  }
});

// Handle right-click context menu action
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'AUKRO_CONTEXT_ADD') {
    const prefill = message.username || '';
    const name = prompt('Zadejte nebo potvrďte přezdívku uživatele z Aukra:', prefill);
    if (!name || !name.trim()) return;

    const cleanName = name.trim();
    const note = prompt(`Poznámka k uživateli "${cleanName}" (nepovinné):`, '');
    if (note === null) return;

    const colorChoice = prompt('Typ ikony: 1 = Červená (pozor), 2 = Žlutá (upozornění), 3 = Zelená (ověřený)', '1');
    if (colorChoice === null) return;

    let type = 'red';
    if (colorChoice.trim() === '2') type = 'yellow';
    if (colorChoice.trim() === '3') type = 'green';

    chrome.storage.sync.get(['blockedUsers'], (result) => {
      const users = normalizeUsers(result.blockedUsers);
      const existingIndex = users.findIndex(u => u.name.toLowerCase() === cleanName.toLowerCase());

      if (existingIndex > -1) {
        users[existingIndex] = { name: cleanName, note: note.trim(), type };
      } else {
        users.push({ name: cleanName, note: note.trim(), type });
      }

      chrome.storage.sync.set({ blockedUsers: users });
    });
  }
});
