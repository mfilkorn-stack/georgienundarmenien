// Buch-Editor: stellt aus den Tagesseiten ein individuelles Buch zusammen.
// Läuft komplett im Browser; Konfiguration in localStorage, eigene Fotos in
// IndexedDB (nur lokal auf diesem Gerät, nicht Teil der Website).
//
// Inhalt jedes Tages wird als Block-Liste modelliert (Foto+Bildunterschrift =
// eine Einheit, Textblöcke, Trennlinien, Uploads). Diese Blöcke lassen sich in
// der Vorschau per Drag & Drop umsortieren; Texte sind direkt editierbar.
(function () {
  'use strict';

  // Trip-spezifische Werte kommen aus trip.js (window.TRIP_CONFIG),
  // das jede Editor-Seite vor diesem Skript lädt.
  const TRIP = window.TRIP_CONFIG;
  const LANG = document.documentElement.lang === 'en' ? 'en' : 'de';
  const DAYS = Array.from({ length: TRIP.chapters }, (_, i) => i + 1);
  const IMG_BASE = LANG === 'en' ? '../images/' : 'images/';
  const dayFile = (n) => `${TRIP.filePrefix[LANG]}${n}.html`;
  const STORAGE_KEY = `bookEditor:${TRIP.slug}:${LANG}`;

  // Migration: früher hieß der Georgien-Key schlicht bookEditor:<lang>
  if (TRIP.slug === 'georgien-armenien' && !localStorage.getItem(STORAGE_KEY)) {
    const legacy = localStorage.getItem(`bookEditor:${LANG}`);
    if (legacy) localStorage.setItem(STORAGE_KEY, legacy);
  }

  const T = {
    de: {
      print: '\u{1F5A8} Buch drucken / Als PDF speichern',
      printHint: 'Tipp: Im Druckdialog „Kopf- und Fußzeilen“ aktivieren, um Seitenzahlen zu bekommen.',
      reset: 'Alles zurücksetzen',
      resetConfirm: 'Alle Einstellungen, Textänderungen und hochgeladenen Fotos verwerfen?',
      coverSection: 'Titelseite',
      titleLabel: 'Buchtitel',
      subtitleLabel: 'Untertitel',
      coverHint: 'Coverfoto: ★ an einem Foto anklicken.',
      styleSection: 'Stil',
      fontLabel: 'Schrift',
      fontGeorgia: 'Klassisch (Georgia)',
      fontPalatino: 'Buchdruck (Palatino)',
      fontSans: 'Modern (serifenlos)',
      accentLabel: 'Akzentfarbe',
      sizeLabel: 'Fotogröße',
      sizeSmall: 'Klein', sizeMedium: 'Mittel', sizeLarge: 'Groß', sizeFull: 'Ganzseitig',
      contentSection: 'Inhalt',
      modeFull: 'Komplettes Tagebuch',
      modeNoTips: 'Ohne Tipp-Boxen',
      modePhotos: 'Nur Fotos mit Bildunterschriften',
      photosSection: 'Fotos auswählen',
      photosHint: 'Klick = Foto an/aus · ★ = als Coverfoto',
      dragHint: 'Im Buch rechts: Fotos & Texte am Griff (⠿) ziehen zum Umsortieren, Text anklicken zum Bearbeiten.',
      dayLabel: 'Tag',
      includeDay: 'Tag im Buch',
      uploadLabel: '+ Eigene Fotos zu diesem Tag',
      uploadHint: 'Eigene Fotos bleiben nur lokal in diesem Browser gespeichert und erscheinen im gedruckten Buch – nicht auf der Website.',
      captionPlaceholder: 'Bildunterschrift …',
      captionEmpty: 'Bildunterschrift hinzufügen …',
      removeUpload: 'Entfernen',
      toc: 'Inhalt',
      loading: 'Buch wird geladen …',
      helpButton: '? Anleitung',
      helpTitle: 'So funktioniert der Buch-Editor',
      helpClose: 'Los geht’s!',
      helpSteps: [
        ['\u{1F4F7}', 'Fotos auswählen', 'Links in der Leiste einen Tag aufklappen. Klick auf eine Miniatur nimmt das Foto aus dem Buch (wird grau) – erneuter Klick holt es zurück. Mit dem ★ machst du ein Foto zum Coverfoto. Das Häkchen neben dem Tagesnamen nimmt den ganzen Tag heraus.'],
        ['➕', 'Eigene Fotos hinzufügen', 'Unter jedem Tag gibt es „+ Eigene Fotos“. Sie erscheinen am Ende des Tages im Buch und bleiben nur in deinem Browser gespeichert – sie werden nicht ins Internet hochgeladen.'],
        ['\u{1F91A}', 'Verschieben per Drag & Drop', 'Rechts im Buch: Fahre mit der Maus über ein Foto oder einen Text – links erscheint ein Griff (⠷). Ziehe daran, um den Block an eine andere Stelle des Tages zu schieben. Ein Foto nimmt seine Bildunterschrift automatisch mit.'],
        ['✏️', 'Texte bearbeiten', 'Klicke rechts im Buch einfach in einen Text – Tagebuchtext, Überschriften, Tipp-Boxen und Bildunterschriften sind direkt beschreibbar. Auch unter Fotos ohne Unterschrift kannst du eine ergänzen.'],
        ['\u{1F3A8}', 'Stil & Titelseite', 'In der Leiste stellst du Schrift, Akzentfarbe und Fotogröße ein und gibst dem Buch Titel und Untertitel. Über die Auswahl „Inhalt“ machst du z. B. ein reines Fotobuch daraus.'],
        ['\u{1F5A8}', 'Als PDF speichern', 'Der rote Knopf öffnet den Druckdialog – dort „Als PDF speichern“ wählen. Alle deine Änderungen bleiben in diesem Browser erhalten, bis du sie zurücksetzt.'],
      ],
    },
    en: {
      print: '\u{1F5A8} Print book / Save as PDF',
      printHint: 'Tip: enable “Headers and footers” in the print dialog to get page numbers.',
      reset: 'Reset everything',
      resetConfirm: 'Discard all settings, text edits and uploaded photos?',
      coverSection: 'Cover page',
      titleLabel: 'Book title',
      subtitleLabel: 'Subtitle',
      coverHint: 'Cover photo: click ★ on any photo.',
      styleSection: 'Style',
      fontLabel: 'Font',
      fontGeorgia: 'Classic (Georgia)',
      fontPalatino: 'Book print (Palatino)',
      fontSans: 'Modern (sans-serif)',
      accentLabel: 'Accent colour',
      sizeLabel: 'Photo size',
      sizeSmall: 'Small', sizeMedium: 'Medium', sizeLarge: 'Large', sizeFull: 'Full page',
      contentSection: 'Content',
      modeFull: 'Complete diary',
      modeNoTips: 'Without tip boxes',
      modePhotos: 'Photos with captions only',
      photosSection: 'Choose photos',
      photosHint: 'Click = photo on/off · ★ = use as cover photo',
      dragHint: 'In the book on the right: drag photos & texts by the handle (⠿) to reorder, click text to edit.',
      dayLabel: 'Day',
      includeDay: 'Include this day',
      uploadLabel: '+ Add your own photos to this day',
      uploadHint: 'Your own photos are stored only locally in this browser and appear in the printed book – not on the website.',
      captionPlaceholder: 'Caption …',
      captionEmpty: 'Add a caption …',
      removeUpload: 'Remove',
      toc: 'Contents',
      loading: 'Loading book …',
      helpButton: '? How it works',
      helpTitle: 'How the book editor works',
      helpClose: 'Let’s go!',
      helpSteps: [
        ['\u{1F4F7}', 'Choose photos', 'Open a day in the left panel. Clicking a thumbnail removes the photo from the book (it turns grey) – click again to bring it back. The ★ makes a photo the cover photo. The checkbox next to the day name removes the whole day.'],
        ['➕', 'Add your own photos', 'Each day has “+ Add your own photos”. They appear at the end of that day in the book and are stored only in your browser – nothing is uploaded to the internet.'],
        ['\u{1F91A}', 'Reorder by drag & drop', 'In the book on the right: hover over a photo or text – a handle (⠷) appears on the left. Drag it to move the block to another position within the day. A photo automatically takes its caption along.'],
        ['✏️', 'Edit texts', 'Simply click into any text in the book – diary text, headings, tip boxes and captions are directly editable. You can also add a caption under photos that don’t have one yet.'],
        ['\u{1F3A8}', 'Style & cover page', 'In the panel you set the font, accent colour and photo size, and give the book its title and subtitle. The “Content” options turn it into a pure photo book, for example.'],
        ['\u{1F5A8}', 'Save as PDF', 'The red button opens the print dialog – choose “Save as PDF” there. All your changes stay in this browser until you reset them.'],
      ],
    },
  }[LANG];

  // Kapitel-Wort (Tag/Etappe …) aus der Trip-Konfiguration in die Labels einsetzen
  T.includeDay = LANG === 'de' ? `${TRIP.chapterWord.de} im Buch` : `Include this ${TRIP.chapterWord.en.toLowerCase()}`;
  T.uploadLabel = LANG === 'de' ? '+ Eigene Fotos hinzufügen' : '+ Add your own photos';

  const FONTS = {
    georgia: "Georgia, 'Times New Roman', serif",
    palatino: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
    sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  };
  const IMG_SIZES = { small: '8cm', medium: '12cm', large: '19cm', full: '23.5cm' };

  const defaultState = () => ({
    title: TRIP.title[LANG],
    subtitle: TRIP.subtitle[LANG],
    cover: TRIP.cover ? (LANG === 'en' ? '../' : '') + TRIP.cover : '',
    font: 'georgia',
    accent: '#aa3333',
    imgSize: 'large',
    textMode: 'full',
    excludedDays: [],
    excludedPhotos: [],
    blocks: {},      // day -> [block]
    dayTitles: {},   // day -> überschriebener Tagestitel
  });

  let state = defaultState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') state = Object.assign(defaultState(), saved);
  } catch (e) { /* defekter Speicher -> Defaults */ }
  if (!state.blocks) state.blocks = {};
  if (!state.dayTitles) state.dayTitles = {};

  const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  // ---------- IndexedDB für eigene Fotos ----------
  let db = null;
  const uploads = []; // {id, day, caption, url}

  function openDb() {
    return new Promise((resolve) => {
      const req = indexedDB.open('book-editor', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null); // ohne IDB: Uploads nur für die Sitzung
    });
  }

  function loadUploads() {
    return new Promise((resolve) => {
      if (!db) return resolve();
      const tx = db.transaction('photos', 'readonly').objectStore('photos').getAll();
      tx.onsuccess = () => {
        for (const rec of tx.result) {
          if (rec.lang !== LANG || (rec.trip || 'georgien-armenien') !== TRIP.slug) continue;
          uploads.push({ id: rec.id, day: rec.day, caption: rec.caption, url: URL.createObjectURL(rec.blob) });
        }
        resolve();
      };
      tx.onerror = () => resolve();
    });
  }

  function addUpload(day, file) {
    return new Promise((resolve) => {
      const finish = (id) => {
        uploads.push({ id, day, caption: '', url: URL.createObjectURL(file) });
        resolve(id);
      };
      if (!db) return finish('mem-' + Math.random().toString(36).slice(2));
      const store = db.transaction('photos', 'readwrite').objectStore('photos');
      const req = store.add({ trip: TRIP.slug, lang: LANG, day, caption: '', blob: file });
      req.onsuccess = () => finish(req.result);
      req.onerror = () => finish('mem-' + Math.random().toString(36).slice(2));
    });
  }

  function updateUpload(u) {
    if (!db || String(u.id).startsWith('mem-')) return;
    const store = db.transaction('photos', 'readwrite').objectStore('photos');
    const req = store.get(u.id);
    req.onsuccess = () => {
      const rec = req.result;
      if (!rec) return;
      rec.caption = u.caption;
      store.put(rec);
    };
  }

  function removeUpload(u) {
    uploads.splice(uploads.indexOf(u), 1);
    URL.revokeObjectURL(u.url);
    if (db && !String(u.id).startsWith('mem-')) {
      db.transaction('photos', 'readwrite').objectStore('photos').delete(u.id);
    }
  }

  function clearUploads() {
    return new Promise((resolve) => {
      if (!db) return resolve();
      const store = db.transaction('photos', 'readwrite').objectStore('photos');
      const req = store.getAll();
      req.onsuccess = () => {
        for (const rec of req.result) if (rec.lang === LANG && (rec.trip || 'georgien-armenien') === TRIP.slug) store.delete(rec.id);
        resolve();
      };
      req.onerror = () => resolve();
    });
  }

  // ---------- Kapitel laden + Block-Modell ----------
  const chapters = {}; // day -> {sourceTitle}

  async function loadChapter(n) {
    const res = await fetch(dayFile(n));
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const body = doc.body;
    body.querySelectorAll('.navbar, .map-heading, .map, script, .more-info').forEach((el) => el.remove());
    const h1 = body.querySelector('h1');
    const sourceTitle = h1 ? h1.textContent : `${TRIP.chapterWord[LANG]} ${n}`;
    chapters[n] = { sourceTitle };

    // Blöcke nur einmalig aus der Quelle ableiten; danach ist state.blocks maßgeblich.
    if (!state.blocks[n]) {
      state.blocks[n] = extractBlocks(body, n);
    }
    // Uploads dieses Tages, die noch nicht als Block vertreten sind, anhängen.
    const present = new Set(state.blocks[n].filter((b) => b.type === 'upload').map((b) => b.uploadId));
    for (const u of uploads.filter((u) => u.day === n)) {
      if (!present.has(u.id)) state.blocks[n].push({ id: 'u' + u.id, type: 'upload', uploadId: u.id });
    }
  }

  function extractBlocks(body, n) {
    const blocks = [];
    let k = 0;
    const children = Array.from(body.children);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const tag = child.tagName.toLowerCase();
      if (tag === 'h1') continue; // Tagestitel separat
      if (tag === 'img') {
        let caption = '';
        const next = children[i + 1];
        if (next && next.tagName === 'P' && !next.classList.length) {
          caption = next.textContent;
          i++; // Bildunterschrift verbrauchen
        }
        blocks.push({ id: `p${n}_${k++}`, type: 'photo', src: child.getAttribute('src'), alt: child.getAttribute('alt') || '', caption });
      } else if (tag === 'hr') {
        blocks.push({ id: `hr${n}_${k++}`, type: 'hr' });
      } else {
        blocks.push({ id: `t${n}_${k++}`, type: 'text', tag, className: child.getAttribute('class') || '', html: child.innerHTML });
      }
    }
    return blocks;
  }

  const dayTitle = (n) => (state.dayTitles[n] != null ? state.dayTitles[n] : chapters[n].sourceTitle);

  // Fotos (inkl. Uploads) eines Tages für die Sidebar-Miniaturen
  function chapterPhotos(n) {
    const out = [];
    for (const b of state.blocks[n] || []) {
      if (b.type === 'photo') out.push({ kind: 'photo', src: b.src, alt: b.alt });
      else if (b.type === 'upload') {
        const u = uploads.find((u) => u.id === b.uploadId);
        if (u) out.push({ kind: 'upload', upload: u });
      }
    }
    return out;
  }

  // ---------- Buch rendern ----------
  const bookEl = document.getElementById('book');
  let rootEl = null;

  function applyStyle() {
    if (!rootEl) return;
    rootEl.style.setProperty('--accent', state.accent);
    rootEl.style.setProperty('--book-font', FONTS[state.font] || FONTS.georgia);
    rootEl.style.setProperty('--img-max', IMG_SIZES[state.imgSize] || IMG_SIZES.large);
    rootEl.classList.toggle('img-full', state.imgSize === 'full');
  }

  function renderBook() {
    const root = document.createElement('div');
    root.className = 'book-inner';

    // Titelseite
    const cover = document.createElement('div');
    cover.className = 'cover';
    cover.innerHTML =
      `<h1>${escapeHtml(state.title)}</h1>` +
      `<p class="subtitle">${escapeHtml(state.subtitle)}</p>` +
      `<img src="${state.cover}" alt="">` +
      `<p class="meta">${TRIP.meta[LANG]}</p>`;
    root.appendChild(cover);

    const includedDays = DAYS.filter((n) => !state.excludedDays.includes(n));

    // Inhaltsverzeichnis
    const toc = document.createElement('div');
    toc.className = 'toc';
    const tocList = document.createElement('ol');
    for (const n of includedDays) {
      const li = document.createElement('li');
      li.dataset.tocDay = n;
      li.textContent = dayTitle(n);
      tocList.appendChild(li);
    }
    toc.innerHTML = `<h2>${escapeHtml(T.toc)}</h2>`;
    toc.appendChild(tocList);
    root.appendChild(toc);

    // Kapitel
    for (const n of includedDays) {
      root.appendChild(renderChapter(n));
    }

    bookEl.replaceChildren(root);
    rootEl = root;
    applyStyle();
  }

  function renderChapter(n) {
    const chapter = document.createElement('div');
    chapter.className = 'chapter';
    chapter.dataset.day = n;

    const h1 = document.createElement('h1');
    h1.textContent = dayTitle(n);
    makeEditable(h1, (text) => {
      state.dayTitles[n] = text;
      saveState();
      const li = bookEl.querySelector(`li[data-toc-day="${n}"]`);
      if (li) li.textContent = text;
    }, true);
    chapter.appendChild(h1);

    const container = document.createElement('div');
    container.className = 'chapter-blocks';
    container.dataset.day = n;
    for (const block of state.blocks[n]) {
      const node = renderBlock(n, block);
      if (node) container.appendChild(node);
    }
    chapter.appendChild(container);
    return chapter;
  }

  function renderBlock(n, block) {
    if (block.type === 'photo' && state.excludedPhotos.includes(block.src)) return null;
    if (state.textMode === 'photos' && block.type !== 'photo' && block.type !== 'upload') return null;
    if (state.textMode === 'notips' && block.type === 'text' && /\btip\b/.test(block.className)) return null;

    const wrap = document.createElement('div');
    wrap.className = 'block';
    wrap.dataset.blockId = block.id;
    wrap.appendChild(makeHandle(n));

    if (block.type === 'photo' || block.type === 'upload') {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      let caption;
      if (block.type === 'photo') {
        img.src = block.src;
        img.alt = block.alt;
        caption = block.caption || '';
      } else {
        const u = uploads.find((u) => u.id === block.uploadId);
        if (!u) return null;
        img.src = u.url;
        img.alt = u.caption || '';
        caption = u.caption || '';
      }
      fig.appendChild(img);
      const cap = document.createElement('figcaption');
      cap.textContent = caption;
      cap.dataset.placeholder = T.captionEmpty;
      makeEditable(cap, (text) => {
        if (block.type === 'photo') {
          block.caption = text;
        } else {
          const u = uploads.find((u) => u.id === block.uploadId);
          if (u) { u.caption = text; updateUpload(u); }
        }
        saveState();
      });
      fig.appendChild(cap);
      wrap.appendChild(fig);
    } else if (block.type === 'hr') {
      wrap.appendChild(document.createElement('hr'));
    } else {
      const el = document.createElement(block.tag);
      if (block.className) el.className = block.className;
      el.innerHTML = block.html;
      makeEditable(el, (text, htmlVal) => { block.html = htmlVal; saveState(); });
      wrap.appendChild(el);
    }

    attachDropTarget(wrap, n);
    return wrap;
  }

  // ---------- Inline-Bearbeitung ----------
  function makeEditable(el, onCommit, plainText) {
    el.contentEditable = 'true';
    el.spellcheck = false;
    el.classList.add('editable');
    let timer = null;
    const commit = () => {
      onCommit(el.textContent, el.innerHTML);
    };
    el.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(commit, 400);
    });
    el.addEventListener('blur', () => { clearTimeout(timer); commit(); });
    if (plainText) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
      });
    }
    // Drag am Editier-Element unterbinden, damit Textauswahl nicht zieht.
    el.addEventListener('dragstart', (e) => e.preventDefault());
  }

  // ---------- Drag & Drop (nur innerhalb eines Tages) ----------
  let dragState = null; // {id, day, wrap}

  function makeHandle(n) {
    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⠷'; // ⠷ Braille-Griff
    handle.title = LANG === 'en' ? 'Drag to reorder' : 'Zum Umsortieren ziehen';
    handle.draggable = true;
    handle.addEventListener('dragstart', (e) => {
      const wrap = handle.closest('.block');
      dragState = { id: wrap.dataset.blockId, day: n, wrap };
      wrap.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', wrap.dataset.blockId);
      // Ganzen Block als Drag-Bild, nicht nur den Griff.
      e.dataTransfer.setDragImage(wrap, 20, 20);
    });
    handle.addEventListener('dragend', () => {
      if (dragState) dragState.wrap.classList.remove('dragging');
      clearDropMarks();
      dragState = null;
    });
    return handle;
  }

  function attachDropTarget(wrap, n) {
    wrap.addEventListener('dragover', (e) => {
      if (!dragState || dragState.day !== n) return; // nur gleicher Tag
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = wrap.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      clearDropMarks();
      wrap.classList.add(after ? 'drop-after' : 'drop-before');
    });
    wrap.addEventListener('dragleave', () => {
      wrap.classList.remove('drop-before', 'drop-after');
    });
    wrap.addEventListener('drop', (e) => {
      if (!dragState || dragState.day !== n || wrap === dragState.wrap) { clearDropMarks(); return; }
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      const container = wrap.parentElement;
      container.insertBefore(dragState.wrap, after ? wrap.nextSibling : wrap);
      clearDropMarks();
      syncOrderFromDom(n, container);
    });
  }

  function clearDropMarks() {
    bookEl.querySelectorAll('.drop-before, .drop-after').forEach((el) => el.classList.remove('drop-before', 'drop-after'));
  }

  function syncOrderFromDom(n, container) {
    const order = Array.from(container.children).map((el) => el.dataset.blockId);
    const byId = new Map(state.blocks[n].map((b) => [b.id, b]));
    state.blocks[n] = order.map((id) => byId.get(id)).filter(Boolean);
    saveState();
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------- Bedienleiste ----------
  const controlsEl = document.getElementById('controls');
  const openDays = new Set(); // welche Tage aufgeklappt sind – bleibt über Re-Renders erhalten

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children) node.append(c);
    return node;
  }

  function section(title, ...children) {
    return el('fieldset', { class: 'ctl-section' }, el('legend', {}, title), ...children);
  }

  function renderControls() {
    const scrollTop = controlsEl.scrollTop;
    const frag = document.createDocumentFragment();

    // Aktionen
    frag.append(
      el('button', { class: 'ctl-print', type: 'button', onclick: () => window.print() }, T.print),
      el('p', { class: 'ctl-hint' }, T.printHint),
      el('button', { class: 'ctl-help', type: 'button', onclick: showHelp }, T.helpButton),
      el('p', { class: 'ctl-hint ctl-draghint' }, T.dragHint),
    );

    // Titelseite
    frag.append(section(T.coverSection,
      el('label', {}, T.titleLabel,
        el('input', { type: 'text', value: state.title, oninput: (e) => { state.title = e.target.value; saveState(); updateCover(); } })),
      el('label', {}, T.subtitleLabel,
        el('input', { type: 'text', value: state.subtitle, oninput: (e) => { state.subtitle = e.target.value; saveState(); updateCover(); } })),
      el('p', { class: 'ctl-hint' }, T.coverHint),
    ));

    // Stil
    const fontSel = el('select', {
      onchange: (e) => { state.font = e.target.value; saveState(); applyStyle(); },
    },
      el('option', { value: 'georgia' }, T.fontGeorgia),
      el('option', { value: 'palatino' }, T.fontPalatino),
      el('option', { value: 'sans' }, T.fontSans));
    fontSel.value = state.font;

    const sizeSel = el('select', {
      onchange: (e) => { state.imgSize = e.target.value; saveState(); applyStyle(); },
    },
      el('option', { value: 'small' }, T.sizeSmall),
      el('option', { value: 'medium' }, T.sizeMedium),
      el('option', { value: 'large' }, T.sizeLarge),
      el('option', { value: 'full' }, T.sizeFull));
    sizeSel.value = state.imgSize;

    frag.append(section(T.styleSection,
      el('label', {}, T.fontLabel, fontSel),
      el('label', {}, T.accentLabel,
        el('input', { type: 'color', value: state.accent, oninput: (e) => { state.accent = e.target.value; saveState(); applyStyle(); } })),
      el('label', {}, T.sizeLabel, sizeSel),
    ));

    // Inhalt (Textmodus)
    const modes = [['full', T.modeFull], ['notips', T.modeNoTips], ['photos', T.modePhotos]];
    frag.append(section(T.contentSection,
      ...modes.map(([value, label]) => {
        const radio = el('input', {
          type: 'radio', name: 'textmode', value,
          onchange: () => { state.textMode = value; saveState(); renderBook(); },
        });
        radio.checked = state.textMode === value;
        return el('label', { class: 'ctl-radio' }, radio, label);
      }),
    ));

    // Fotos pro Tag
    const photoSection = section(T.photosSection, el('p', { class: 'ctl-hint' }, T.photosHint));
    for (const n of DAYS) {
      const dayBox = el('details', { class: 'ctl-day' });
      dayBox.open = openDays.has(n);
      dayBox.addEventListener('toggle', () => {
        if (dayBox.open) openDays.add(n);
        else openDays.delete(n);
      });
      const included = !state.excludedDays.includes(n);

      const dayToggle = el('input', {
        type: 'checkbox', title: T.includeDay,
        onchange: (e) => {
          state.excludedDays = e.target.checked
            ? state.excludedDays.filter((d) => d !== n)
            : state.excludedDays.concat(n);
          saveState(); renderBook();
        },
      });
      dayToggle.checked = included;
      dayToggle.addEventListener('click', (e) => e.stopPropagation());

      dayBox.append(el('summary', {}, dayToggle, ` ${dayTitle(n)}`));

      const grid = el('div', { class: 'ctl-thumbs' });
      for (const photo of chapterPhotos(n)) {
        if (photo.kind === 'upload') {
          const u = photo.upload;
          grid.append(el('div', { class: 'ctl-thumb ctl-upload' },
            el('img', { src: u.url, alt: u.caption }),
            el('input', {
              type: 'text', placeholder: T.captionPlaceholder, value: u.caption,
              oninput: (e) => { u.caption = e.target.value; updateUpload(u); },
            }),
            el('button', {
              type: 'button', class: 'ctl-remove-btn',
              onclick: () => {
                state.blocks[n] = state.blocks[n].filter((b) => !(b.type === 'upload' && b.uploadId === u.id));
                removeUpload(u); saveState(); renderControls(); renderBook();
              },
            }, T.removeUpload)));
          continue;
        }
        const off = state.excludedPhotos.includes(photo.src);
        const isCover = state.cover === photo.src;
        grid.append(el('div', { class: 'ctl-thumb' + (off ? ' off' : '') + (isCover ? ' is-cover' : '') },
          el('img', {
            src: photo.src, alt: photo.alt, loading: 'lazy', title: photo.alt,
            onclick: () => {
              state.excludedPhotos = off
                ? state.excludedPhotos.filter((s) => s !== photo.src)
                : state.excludedPhotos.concat(photo.src);
              saveState(); renderControls(); renderBook();
            },
          }),
          el('button', {
            type: 'button', class: 'ctl-cover-btn', title: T.coverHint,
            onclick: () => { state.cover = photo.src; saveState(); renderControls(); updateCover(); },
          }, '★')));
      }

      const fileInput = el('input', {
        type: 'file', accept: 'image/*', multiple: '',
        onchange: async (e) => {
          for (const file of e.target.files) {
            const id = await addUpload(n, file);
            state.blocks[n].push({ id: 'u' + id, type: 'upload', uploadId: id });
          }
          e.target.value = '';
          saveState(); renderControls(); renderBook();
        },
      });
      dayBox.append(grid, el('label', { class: 'ctl-upload-label' }, T.uploadLabel, fileInput));
      photoSection.append(dayBox);
    }
    photoSection.append(el('p', { class: 'ctl-hint' }, T.uploadHint));
    frag.append(photoSection);

    // Zurücksetzen
    frag.append(el('button', {
      class: 'ctl-reset', type: 'button',
      onclick: async () => {
        if (!confirm(T.resetConfirm)) return;
        localStorage.removeItem(STORAGE_KEY);
        await clearUploads();
        location.reload();
      },
    }, T.reset));

    controlsEl.replaceChildren(frag);
    controlsEl.scrollTop = scrollTop;
  }

  // ---------- Anleitung (Popup) ----------
  const HELP_SEEN_KEY = 'bookEditor:helpSeen';

  function showHelp() {
    if (document.querySelector('.help-overlay')) return;
    const overlay = el('div', { class: 'help-overlay', onclick: (e) => { if (e.target === overlay) closeHelp(); } });
    const dialog = el('div', { class: 'help-dialog', role: 'dialog', 'aria-modal': 'true' },
      el('h2', {}, T.helpTitle),
      ...T.helpSteps.map(([icon, title, text]) =>
        el('div', { class: 'help-step' },
          el('span', { class: 'help-icon' }, icon),
          el('div', {}, el('strong', {}, title), el('p', {}, text)))),
      el('button', {
        class: 'ctl-print help-close', type: 'button',
        onclick: closeHelp,
      }, T.helpClose));
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', helpEscape);
  }

  function helpEscape(e) {
    if (e.key === 'Escape') closeHelp();
  }

  function closeHelp() {
    const overlay = document.querySelector('.help-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', helpEscape);
    localStorage.setItem(HELP_SEEN_KEY, '1');
  }

  // Cover/Titel in der Vorschau aktualisieren, ohne alles neu zu bauen
  function updateCover() {
    const cover = bookEl.querySelector('.book-inner .cover');
    if (!cover) return;
    cover.querySelector('h1').textContent = state.title;
    cover.querySelector('.subtitle').textContent = state.subtitle;
    cover.querySelector('img').src = state.cover;
  }

  // ---------- Start ----------
  (async () => {
    bookEl.textContent = T.loading;
    db = await openDb();
    await loadUploads();
    await Promise.all(DAYS.map(loadChapter));
    saveState(); // frisch abgeleitete Blöcke sichern
    renderControls();
    renderBook();
    document.body.classList.add('editor-ready');
    if (!localStorage.getItem(HELP_SEEN_KEY)) showHelp();
  })();
})();
