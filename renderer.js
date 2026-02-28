const MODE = { NORMAL: 'normal', TO_ASK: 'to-ask', LEADS: 'leads-counter' };

const state = {
  notes: [],
  googleSync: { enabled: false, status: 'local-only', profile: null, provider: 'local' },
  settings: { panelTheme: 'light', launchOnStartup: false },
  activeNoteId: null,
  maxZ: 1,
  leadTargetNoteId: null
};

const defaults = {
  headerColor: '#dfe8ff',
  footerColor: '#e9eefc',
  width: 360,
  height: 430
};

const els = {
  notesList: document.getElementById('notes-list'),
  notesBoard: document.getElementById('notes-board'),
  newNoteBtn: document.getElementById('new-note-btn'),
  googleAuthBtn: document.getElementById('google-auth-btn'),
  googleStatus: document.getElementById('google-status'),
  panelThemeSelect: document.getElementById('panel-theme-select'),
  startupToggle: document.getElementById('startup-toggle'),
  leadModal: document.getElementById('lead-modal'),
  leadForm: document.getElementById('lead-form')
};

function safeText(v) {
  return (v || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function createEmptyNote(index = 0) {
  return {
    id: crypto.randomUUID(),
    title: 'Untitled Note',
    mode: MODE.NORMAL,
    noteTheme: 'light',
    headerColor: defaults.headerColor,
    footerColor: defaults.footerColor,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    richContent: '',
    toAskItems: [],
    leadsData: { monthName: new Date().toLocaleString('default', { month: 'long' }), entries: [] },
    layout: {
      x: 24 + (index % 5) * 26,
      y: 24 + (index % 5) * 26,
      width: defaults.width,
      height: defaults.height,
      z: ++state.maxZ
    }
  };
}

function migrateNote(note, index) {
  const n = { ...createEmptyNote(index), ...note };
  n.leadsData = { monthName: new Date().toLocaleString('default', { month: 'long' }), entries: [], ...(note.leadsData || {}) };
  n.layout = { ...createEmptyNote(index).layout, ...(note.layout || {}) };
  state.maxZ = Math.max(state.maxZ, Number(n.layout.z || 1));
  return n;
}

function getNoteById(id) {
  return state.notes.find((n) => n.id === id) || null;
}

function updateTimestamp(note) {
  note.updatedAt = new Date().toISOString();
}

let persistTimer;
function persistStateDebounced() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    window.stickyApi.saveNotes({ notes: state.notes, googleSync: state.googleSync, settings: state.settings });
  }, 120);
}

async function persistNow() {
  await window.stickyApi.saveNotes({ notes: state.notes, googleSync: state.googleSync, settings: state.settings });
}

async function syncAlwaysOnTop() {
  const hasToAsk = state.notes.some((n) => n.mode === MODE.TO_ASK);
  await window.stickyApi.setAlwaysOnTop(hasToAsk);
}

function renderNotesHistory() {
  els.notesList.innerHTML = '';
  if (!state.notes.length) {
    els.notesList.innerHTML = '<li class="placeholder">No notes yet</li>';
    return;
  }

  [...state.notes]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .forEach((note) => {
      const date = new Date(note.updatedAt);
      const line = `${date.toLocaleDateString()} • ${date.toLocaleDateString(undefined, { weekday: 'long' })}`;
      const li = document.createElement('li');
      li.className = `note-list-item ${note.id === state.activeNoteId ? 'active' : ''}`;
      li.innerHTML = `<button class="note-open-btn" data-id="${note.id}"><strong>${safeText(note.title)}</strong><small>${note.mode}</small><small>${line}</small></button>`;
      els.notesList.appendChild(li);
    });
}

function computeLeadCounts(entries) {
  return entries.reduce(
    (acc, item) => {
      if (item.eligibility === 'Part B') acc.partB += 1;
      if (item.eligibility === 'ELSE') acc.else += 1;
      if (item.eligibility === 'Atena') acc.atena += 1;
      return acc;
    },
    { partB: 0, else: 0, atena: 0 }
  );
}

function buildNormalContent(note) {
  return `<div class="rich-editor" contenteditable="true" data-role="rich">${note.richContent || ''}</div>`;
}

function buildToAskContent(note) {
  const checklist = note.toAskItems.length
    ? note.toAskItems
        .map(
          (item) =>
            `<li class="check-item ${item.completed ? 'completed' : 'pending'}" data-item-id="${item.id}"><span>${safeText(item.text)}</span><button class="icon-btn" data-action="del-check">✕</button></li>`
        )
        .join('')
    : '<li class="placeholder">No checklist items yet.</li>';

  return `<div class="mode-head"><strong>To-Ask Checklist</strong><button class="btn btn-secondary" data-action="add-check">+ Add</button></div>
    <ul class="checklist" data-role="checklist">${checklist}</ul>
    <div class="rich-editor" contenteditable="true" data-role="rich">${note.richContent || ''}</div>`;
}

function buildLeadsContent(note) {
  const counts = computeLeadCounts(note.leadsData.entries || []);
  const leads = (note.leadsData.entries || []).length
    ? note.leadsData.entries.map((e) => `<li><span>${safeText(e.name)}</span><span class="pill">${safeText(e.eligibility)}</span></li>`).join('')
    : '<li class="placeholder">No leads added.</li>';

  return `<div class="mode-block">
      <div class="mode-head"><strong>Section 1: Month</strong></div>
      <input data-role="month-name" maxlength="40" value="${safeText(note.leadsData.monthName || '')}" />
    </div>
    <div class="mode-block">
      <div class="mode-head"><strong>Section 2: Add Lead</strong><button class="btn btn-primary" data-action="open-lead">+ Add Lead</button></div>
    </div>
    <div class="mode-block">
      <div class="mode-head"><strong>Section 3: Scoreboard</strong></div>
      <div class="scoreboard">
        <div class="scorebox"><span>Part B</span><strong>${counts.partB}</strong></div>
        <div class="scorebox"><span>ELSE</span><strong>${counts.else}</strong></div>
        <div class="scorebox"><span>Atena</span><strong>${counts.atena}</strong></div>
      </div>
      <ul class="leads-list">${leads}</ul>
    </div>
    <div class="rich-editor" contenteditable="true" data-role="rich">${note.richContent || ''}</div>`;
}

function getModeContent(note) {
  if (note.mode === MODE.TO_ASK) return buildToAskContent(note);
  if (note.mode === MODE.LEADS) return buildLeadsContent(note);
  return buildNormalContent(note);
}

function renderBoard() {
  els.notesBoard.innerHTML = '';

  state.notes
    .slice()
    .sort((a, b) => a.layout.z - b.layout.z)
    .forEach((note) => {
      const node = document.createElement('article');
      node.className = `note-window ${note.noteTheme === 'dark' ? 'note-theme-dark' : ''} ${note.mode === MODE.TO_ASK ? 'to-ask-note' : ''}`;
      node.dataset.noteId = note.id;
      node.style.left = `${note.layout.x}px`;
      node.style.top = `${note.layout.y}px`;
      node.style.width = `${note.layout.width}px`;
      node.style.height = `${note.layout.height}px`;
      node.style.zIndex = String(note.layout.z);

      node.innerHTML = `
        <header class="note-header" style="background:${note.headerColor}">
          <input class="note-title" data-role="title" value="${safeText(note.title)}" maxlength="120" />
          <div class="note-controls">
            <select data-role="mode"><option value="normal">Normal</option><option value="to-ask">To-Ask</option><option value="leads-counter">Leads Counter</option></select>
            <select data-role="theme"><option value="light">Note Light</option><option value="dark">Note Dark</option></select>
            <button class="icon-btn" data-action="plus">＋</button>
            <button class="icon-btn" data-action="bold"><b>B</b></button>
            <button class="icon-btn" data-action="italic"><i>I</i></button>
            <button class="icon-btn" data-action="underline"><u>U</u></button>
            <button class="icon-btn" data-action="menu">⋯</button>
            <div class="menu hidden" data-role="menu">
              <label>Header color <input type="color" data-role="header-color" value="${note.headerColor}" /></label>
              <label>Footer color <input type="color" data-role="footer-color" value="${note.footerColor}" /></label>
              <button class="btn btn-secondary" data-action="show-history">Open Note List</button>
            </div>
            <button class="btn btn-danger" data-action="delete">Delete</button>
          </div>
        </header>
        <section class="toolbar"><small>Move by dragging header • Resize from corner</small></section>
        <section class="note-body">${getModeContent(note)}</section>
        <footer class="note-footer" style="background:${note.footerColor}">Developed by Abdullah khan</footer>
        <span class="resize-handle" data-action="resize"></span>
      `;

      node.querySelector('[data-role="mode"]').value = note.mode;
      node.querySelector('[data-role="theme"]').value = note.noteTheme;

      attachNoteEvents(node, note);
      els.notesBoard.appendChild(node);
    });

  renderNotesHistory();
}

function activateNote(note) {
  state.activeNoteId = note.id;
  note.layout.z = ++state.maxZ;
  renderBoard();
  persistStateDebounced();
}

function attachDrag(node, note) {
  const head = node.querySelector('.note-header');
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button,select,input,label,.menu')) return;
    activateNote(note);

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = note.layout.x;
    const startTop = note.layout.y;

    const move = (ev) => {
      const boardRect = els.notesBoard.getBoundingClientRect();
      const maxX = Math.max(0, boardRect.width - note.layout.width);
      const maxY = Math.max(0, boardRect.height - note.layout.height);
      note.layout.x = Math.min(maxX, Math.max(0, startLeft + (ev.clientX - startX)));
      note.layout.y = Math.min(maxY, Math.max(0, startTop + (ev.clientY - startY)));
      node.style.left = `${note.layout.x}px`;
      node.style.top = `${note.layout.y}px`;
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      updateTimestamp(note);
      persistStateDebounced();
      renderNotesHistory();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
}

function attachResize(node, note) {
  const handle = node.querySelector('[data-action="resize"]');
  handle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    activateNote(note);

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = note.layout.width;
    const startH = note.layout.height;

    const move = (ev) => {
      const boardRect = els.notesBoard.getBoundingClientRect();
      const maxW = boardRect.width - note.layout.x;
      const maxH = boardRect.height - note.layout.y;
      note.layout.width = Math.min(maxW, Math.max(280, startW + (ev.clientX - startX)));
      note.layout.height = Math.min(maxH, Math.max(250, startH + (ev.clientY - startY)));
      node.style.width = `${note.layout.width}px`;
      node.style.height = `${note.layout.height}px`;
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      updateTimestamp(note);
      persistStateDebounced();
      renderNotesHistory();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
}

function withFocusedEditor(node, cb) {
  const rich = node.querySelector('[data-role="rich"]');
  if (rich) {
    rich.focus();
    cb();
  }
}

function attachNoteEvents(node, note) {
  node.addEventListener('pointerdown', () => activateNote(note));
  attachDrag(node, note);
  attachResize(node, note);

  node.querySelector('[data-role="title"]').addEventListener('input', (e) => {
    note.title = e.target.value || 'Untitled Note';
    updateTimestamp(note);
    persistStateDebounced();
    renderNotesHistory();
  });

  node.querySelector('[data-role="mode"]').addEventListener('change', async (e) => {
    note.mode = e.target.value;
    updateTimestamp(note);
    renderBoard();
    persistStateDebounced();
    await syncAlwaysOnTop();
  });

  node.querySelector('[data-role="theme"]').addEventListener('change', (e) => {
    note.noteTheme = e.target.value;
    updateTimestamp(note);
    renderBoard();
    persistStateDebounced();
  });

  const menu = node.querySelector('[data-role="menu"]');
  node.querySelector('[data-action="menu"]').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });

  node.querySelector('[data-role="header-color"]').addEventListener('input', (e) => {
    note.headerColor = e.target.value;
    updateTimestamp(note);
    node.querySelector('.note-header').style.background = note.headerColor;
    persistStateDebounced();
  });

  node.querySelector('[data-role="footer-color"]').addEventListener('input', (e) => {
    note.footerColor = e.target.value;
    updateTimestamp(note);
    node.querySelector('.note-footer').style.background = note.footerColor;
    persistStateDebounced();
  });

  node.querySelector('[data-action="show-history"]').addEventListener('click', () => {
    document.getElementById('notes-history').scrollIntoView({ behavior: 'smooth' });
    menu.classList.add('hidden');
  });

  node.querySelector('[data-action="plus"]').addEventListener('click', async () => {
    await createNote();
  });

  node.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    state.notes = state.notes.filter((n) => n.id !== note.id);
    if (state.activeNoteId === note.id) state.activeNoteId = state.notes[0]?.id || null;
    renderBoard();
    await persistNow();
    await syncAlwaysOnTop();
  });

  node.querySelector('[data-action="bold"]').addEventListener('click', () => withFocusedEditor(node, () => document.execCommand('bold')));
  node.querySelector('[data-action="italic"]').addEventListener('click', () => withFocusedEditor(node, () => document.execCommand('italic')));
  node.querySelector('[data-action="underline"]').addEventListener('click', () => withFocusedEditor(node, () => document.execCommand('underline')));

  const rich = node.querySelector('[data-role="rich"]');
  if (rich) {
    rich.addEventListener('input', () => {
      note.richContent = rich.innerHTML;
      updateTimestamp(note);
      persistStateDebounced();
      renderNotesHistory();
    });
  }

  if (note.mode === MODE.TO_ASK) {
    node.querySelector('[data-action="add-check"]').addEventListener('click', () => {
      const text = prompt('Checklist item');
      if (!text?.trim()) return;
      note.toAskItems.push({ id: crypto.randomUUID(), text: text.trim(), completed: false });
      updateTimestamp(note);
      renderBoard();
      persistStateDebounced();
    });

    const checklist = node.querySelector('[data-role="checklist"]');
    checklist.addEventListener('dblclick', (e) => {
      const itemEl = e.target.closest('.check-item');
      if (!itemEl) return;
      const item = note.toAskItems.find((x) => x.id === itemEl.dataset.itemId);
      if (!item) return;
      item.completed = !item.completed;
      updateTimestamp(note);
      renderBoard();
      persistStateDebounced();
    });

    checklist.addEventListener('click', (e) => {
      if (!e.target.closest('[data-action="del-check"]')) return;
      const itemEl = e.target.closest('.check-item');
      note.toAskItems = note.toAskItems.filter((x) => x.id !== itemEl.dataset.itemId);
      updateTimestamp(note);
      renderBoard();
      persistStateDebounced();
    });
  }

  if (note.mode === MODE.LEADS) {
    node.querySelector('[data-role="month-name"]').addEventListener('input', (e) => {
      note.leadsData.monthName = e.target.value;
      updateTimestamp(note);
      persistStateDebounced();
      renderNotesHistory();
    });

    node.querySelector('[data-action="open-lead"]').addEventListener('click', () => {
      state.leadTargetNoteId = note.id;
      els.leadModal.classList.remove('hidden');
    });
  }
}

async function createNote() {
  const note = createEmptyNote(state.notes.length);
  state.notes.push(note);
  state.activeNoteId = note.id;
  renderBoard();
  await persistNow();
  await syncAlwaysOnTop();
}

function updateGoogleUi() {
  if (state.googleSync.enabled) {
    els.googleAuthBtn.textContent = 'Logout Google';
    els.googleStatus.textContent = `Synced: ${state.googleSync.profile.email}`;
    els.googleStatus.classList.add('active');
  } else {
    els.googleAuthBtn.textContent = 'Google Login';
    els.googleStatus.textContent = 'Local storage only';
    els.googleStatus.classList.remove('active');
  }
}

function applyPanelTheme() {
  document.body.dataset.panelTheme = state.settings.panelTheme;
}

function wireGlobalEvents() {
  els.newNoteBtn.addEventListener('click', createNote);

  els.notesList.addEventListener('click', (e) => {
    const btn = e.target.closest('.note-open-btn');
    if (!btn) return;
    const note = getNoteById(btn.dataset.id);
    if (!note) return;
    activateNote(note);
  });

  els.panelThemeSelect.addEventListener('change', () => {
    state.settings.panelTheme = els.panelThemeSelect.value;
    applyPanelTheme();
    persistStateDebounced();
  });

  els.startupToggle.addEventListener('change', async () => {
    state.settings.launchOnStartup = els.startupToggle.checked;
    await window.stickyApi.setOpenAtLogin(state.settings.launchOnStartup);
    persistStateDebounced();
  });

  els.googleAuthBtn.addEventListener('click', async () => {
    if (state.googleSync.enabled) {
      await window.stickyApi.logoutGoogle();
      state.googleSync = { enabled: false, status: 'local-only', profile: null, provider: 'local' };
    } else {
      const result = await window.stickyApi.loginGoogle();
      if (!result.success) return;
      state.googleSync = { enabled: true, status: 'connected', profile: result.profile, provider: 'google' };
    }

    await persistNow();
    updateGoogleUi();
  });

  document.getElementById('close-lead-modal').addEventListener('click', () => {
    els.leadModal.classList.add('hidden');
    els.leadForm.reset();
  });

  els.leadModal.addEventListener('click', (e) => {
    if (e.target.id === 'lead-modal') {
      els.leadModal.classList.add('hidden');
      els.leadForm.reset();
    }
  });

  els.leadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = getNoteById(state.leadTargetNoteId);
    if (!note || note.mode !== MODE.LEADS) return;

    const name = document.getElementById('lead-name').value.trim();
    const eligibility = document.getElementById('lead-eligibility').value;
    if (!name) return;

    note.leadsData.entries.push({ id: crypto.randomUUID(), name, eligibility, createdAt: new Date().toISOString() });
    updateTimestamp(note);

    els.leadModal.classList.add('hidden');
    els.leadForm.reset();
    renderBoard();
    await persistNow();
  });

  document.addEventListener('click', (e) => {
    document.querySelectorAll('[data-role="menu"]').forEach((menu) => {
      if (!menu.parentElement.contains(e.target)) menu.classList.add('hidden');
    });
  });
}

async function initialize() {
  const stored = await window.stickyApi.loadNotes();
  const startup = await window.stickyApi.getOpenAtLogin();

  state.notes = Array.isArray(stored.notes) ? stored.notes.map((n, i) => migrateNote(n, i)) : [];
  state.googleSync = stored.googleSync || state.googleSync;
  state.settings = { ...state.settings, ...(stored.settings || {}), launchOnStartup: startup.enabled };

 codex/create-smart-sticky-pro-app-using-electron-hewshb
  if (!state.notes.length) {
    state.notes.push(createEmptyNote(0));
  }

  els.leadModal.classList.add('hidden');

=======
  main
  wireGlobalEvents();
  renderBoard();
  updateGoogleUi();

  els.panelThemeSelect.value = state.settings.panelTheme;
  els.startupToggle.checked = state.settings.launchOnStartup;
  applyPanelTheme();

  await syncAlwaysOnTop();
}

initialize();
