/**
 * Aukro User Watchdog
 * Copyright (c) 2026 djfinch (https://github.com/djfinch/aukro-hlidac)
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

function drawIcon(isAlert) {
  const canvas = new OffscreenCanvas(32, 32);
  const ctx = canvas.getContext('2d');

  if (isAlert) {
    // Red warning triangle
    ctx.beginPath();
    ctx.moveTo(16, 2);
    ctx.lineTo(30, 28);
    ctx.lineTo(2, 28);
    ctx.closePath();
    ctx.fillStyle = '#e60000';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // White exclamation mark
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(14.5, 10, 3, 9);
    ctx.beginPath();
    ctx.arc(16, 23, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Default idle icon (blue shield)
    ctx.beginPath();
    ctx.moveTo(16, 2);
    ctx.lineTo(28, 7);
    ctx.lineTo(28, 16);
    ctx.quadraticCurveTo(28, 25, 16, 30);
    ctx.quadraticCurveTo(4, 25, 4, 16);
    ctx.lineTo(4, 7);
    ctx.closePath();
    ctx.fillStyle = '#1d3557';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#a8dadc';
    ctx.stroke();

    // Eye / target inside the shield
    ctx.beginPath();
    ctx.arc(16, 15, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(16, 15, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = '#1d3557';
    ctx.fill();
  }

  return ctx.getImageData(0, 0, 32, 32);
}

// Create context menu item and set default icon on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setIcon({ imageData: drawIcon(false) });

  chrome.contextMenus.create({
    id: 'add-to-aukro-watchdog',
    title: '⚠️ Přidat do Aukro Hlídače',
    contexts: ['selection', 'link'],
    documentUrlPatterns: ['*://*.aukro.cz/*']
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.action.setIcon({ imageData: drawIcon(false) });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'add-to-aukro-watchdog' && tab && tab.id) {
    let rawName = info.selectionText || '';

    // Extract username from profile link URL if no text is selected
    if (!rawName && info.linkUrl) {
      const match = info.linkUrl.match(/aukro\.cz\/uzivatel\/([^/?#]+)/i);
      if (match && match[1]) {
        rawName = decodeURIComponent(match[1]);
      }
    }

    chrome.tabs.sendMessage(tab.id, {
      type: 'AUKRO_CONTEXT_ADD',
      username: rawName.trim()
    });
  }
});

// Receive match count from content script and update toolbar icon
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'AUKRO_MATCH_COUNT' && sender.tab) {
    const count = message.count;
    const isAlert = count > 0;
    
    chrome.action.setIcon({ 
      imageData: drawIcon(isAlert), 
      tabId: sender.tab.id 
    });

    chrome.action.setBadgeText({ 
      text: isAlert ? String(count) : '', 
      tabId: sender.tab.id 
    });

    if (isAlert) {
      chrome.action.setBadgeBackgroundColor({ 
        color: '#b00000', 
        tabId: sender.tab.id 
      });
    }
  }
});
