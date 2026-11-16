/**
 * Aukro User Watchdog
 * Copyright (c) 2026 djfinch (https://github.com/djfinch/aukro-hlidac/djfinch/aukro-hlidac)
 * Licensed under the MIT License. See LICENSE file in the project root for full license information.
 */

const usernameInput = document.getElementById('usernameInput');
const noteInput = document.getElementById('noteInput');
const typeSelect = document.getElementById('typeSelect');
const addBtn = document.getElementById('addBtn');
const userList = document.getElementById('userList');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

let editingIndex = -1;

// SVG templates for preview in popup list
const BADGE_SVGS = {
  red: `<svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://w3.org"><path d="M12 2L1 21h22L12 2z" fill="#e60000"/><path d="M13 17h-2v-2h2v2zm0-4h-2V9h2v4z" fill="#ffffff"/></svg>`,
  yellow: `<svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://w3.org"><path d="M12 2L1 21h22L12 2z" fill="#f59e0b"/><path d="M13 17h-2v-2h2v2zm0-4h-2V9h2v4z" fill="#111111"/></svg>`,
  green: `<svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://w3.org"><circle cx="12" cy="12" r="10" fill="#16a34a"/><path d="M9.5 16.2L5.8 12.5l1.4-1.4 2.3 2.3 6.3-6.3 1.4 1.4-7.7 7.7z" fill="#ffffff"/></svg>`
};

function normalizeUsers(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList.map(item => {
    if (typeof item === 'string') return { name: item, note: '', type: 'red' };
    if (item && item.name) {
      const validType = ['red', 'yellow', 'green'].includes(item.type) ? item.type : 'red';
      return { name: item.name, note: item.note || '', type: validType };
    }
    return null;
  }).filter(Boolean);
}

function resetForm() {
  usernameInput.value = '';
  noteInput.value = '';
  typeSelect.value = 'red';
  editingIndex = -1;
  addBtn.textContent = 'Přidat uživatele';
  addBtn.style.background = '#007bff';
}

function renderUsers(rawUsers) {
  const users = normalizeUsers(rawUsers);
  userList.innerHTML = '';
  users.forEach((item, index) => {
    const li = document.createElement('li');
    
    const leftDiv = document.createElement('div');
    leftDiv.className = 'user-left';

    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'user-badge-preview';
    badgeSpan.innerHTML = BADGE_SVGS[item.type] || BADGE_SVGS.red;
    leftDiv.appendChild(badgeSpan);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'user-info';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'user-name';
    nameSpan.textContent = item.name;
    infoDiv.appendChild(nameSpan);

    if (item.note) {
      const noteSpan = document.createElement('span');
      noteSpan.className = 'user-note';
      noteSpan.textContent = item.note;
      infoDiv.appendChild(noteSpan);
    }

    leftDiv.appendChild(infoDiv);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = '✎';
    editBtn.className = 'icon-btn edit';
    editBtn.title = 'Upravit';
    editBtn.onclick = () => {
      usernameInput.value = item.name;
      noteInput.value = item.note;
      typeSelect.value = item.type;
      editingIndex = index;
      addBtn.textContent = 'Uložit změny';
      addBtn.style.background = '#16a34a';
      usernameInput.focus();
    };
    
    const delBtn = document.createElement('button');
    delBtn.textContent = '✕';
    delBtn.className = 'icon-btn del';
    delBtn.title = 'Smazat';
    delBtn.onclick = () => {
      if (editingIndex === index) resetForm();
      users.splice(index, 1);
      chrome.storage.sync.set({ blockedUsers: users }, () => renderUsers(users));
    };

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(delBtn);
    
    li.appendChild(leftDiv);
    li.appendChild(actionsDiv);
    userList.appendChild(li);
  });
}

// Load saved users when popup opens
chrome.storage.sync.get(['blockedUsers'], (result) => {
  const cleanUsers = normalizeUsers(result.blockedUsers);
  chrome.storage.sync.set({ blockedUsers: cleanUsers }, () => renderUsers(cleanUsers));
});

// Add or update a user
addBtn.onclick = () => {
  const name = usernameInput.value.trim();
  const note = noteInput.value.trim();
  const type = typeSelect.value;
  if (!name) return;
  
  chrome.storage.sync.get(['blockedUsers'], (result) => {
    const users = normalizeUsers(result.blockedUsers);
    
    if (editingIndex > -1 && editingIndex < users.length) {
      users[editingIndex] = { name, note, type };
    } else {
      const existingIndex = users.findIndex(u => u.name.toLowerCase() === name.toLowerCase());
      if (existingIndex > -1) {
        users[existingIndex] = { name, note, type };
      } else {
        users.push({ name, note, type });
      }
    }

    chrome.storage.sync.set({ blockedUsers: users }, () => {
      resetForm();
      renderUsers(users);
    });
  });
};

// Export watchlist to JSON file
exportBtn.onclick = () => {
  chrome.storage.sync.get(['blockedUsers'], (result) => {
    const users = normalizeUsers(result.blockedUsers);
    const blob = new Blob([JSON.stringify(users, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aukro-hlidac-zaloha.json';
    a.click();
    URL.revokeObjectURL(url);
  });
};

// Import watchlist from JSON file
importBtn.onclick = () => importFile.click();

importFile.onchange = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedUsers = normalizeUsers(JSON.parse(e.target.result));
      chrome.storage.sync.get(['blockedUsers'], (result) => {
        const currentUsers = normalizeUsers(result.blockedUsers);
        importedUsers.forEach(imp => {
          if (!currentUsers.some(curr => curr.name.toLowerCase() === imp.name.toLowerCase())) {
            currentUsers.push({ name: imp.name, note: imp.note || '', type: imp.type || 'red' });
          }
        });
        chrome.storage.sync.set({ blockedUsers: currentUsers }, () => {
          renderUsers(currentUsers);
          alert('Seznam byl úspěšně importován!');
        });
      });
    } catch (err) {
      alert('Chyba při čtení souboru. Ujistěte se, že nahráváte správný JSON soubor.');
    }
    importFile.value = '';
  };
  reader.readAsText(file);
};
