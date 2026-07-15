// Buch-Editor: stellt aus den Tagesseiten ein individuelles Buch zusammen.
// Läuft komplett im Browser; Konfiguration in localStorage, eigene Fotos in
// IndexedDB (nur lokal auf diesem Gerät, nicht Teil der Website).
(function () {
  'use strict';

  const LANG = document.documentElement.lang === 'en' ? 'en' : 'de';
  const DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const IMG_BASE = LANG === 'en' ? '../images/' : 'images/';
  const dayFile = (n) => (LANG === 'en' ? `day${n}.html` : `tag${n}.html`);
  const STORAGE_KEY = `bookEditor:${LANG}`;

  const T = {
    de: {
      print: '\u{1F5A8} Buch drucken / Als PDF speichern',
      printHint: 'Tipp: Im Druckdialog „Kopf- und Fußzeilen“ aktivieren, um Seitenzahlen zu bekommen.',
      reset: 'Alles zurücksetzen',
      resetConfirm: 'Alle Einstellungen und hochgeladenen Fotos verwerfen?',
      coverSection: 'Titelseite',
      titleLabel: 'Buchtitel',
      subtitleLabel: 'Untertitel',
      defaultTitle: 'Reisetagebuch',
      defaultSubtitle: 'Best of Georgia & Armenia',
      meta: 'Route: Jerewan → Tiflis, G Adventures Tour EXGA<br>Sa 4. – Sa 11. Juli 2026, plus ein Tag auf eigene Faust (So 12. Juli)',
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
      dayLabel: 'Tag',
      includeDay: 'Tag im Buch',
      uploadLabel: '+ Eigene Fotos zu diesem Tag',
      uploadHint: 'Eigene Fotos bleiben nur lokal in diesem Browser gespeichert und erscheinen im gedruckten Buch – nicht auf der Website.',
      captionPlaceholder: 'Bildunterschrift …',
      removeUpload: 'Entfernen',
      toc: 'Inhalt',
      loading: 'Buch wird geladen …',
    },
    en: {
      print: '\u{1F5A8} Print book / Save as PDF',
      printHint: 'Tip: enable “Headers and footers” in the print dialog to get page numbers.',
      reset: 'Reset everything',
      resetConfirm: 'Discard all settings and uploaded photos?',
      coverSection: 'Cover page',
      titleLabel: 'Book title',
      subtitleLabel: 'Subtitle',
      defaultTitle: 'Travel Diary',
      defaultSubtitle: 'Best of Georgia & Armenia',
      meta: 'Route: Yerevan → Tbilisi, G Adventures tour EXGA<br>Sat July 4 – Sat July 11, 2026, plus one day on our own (Sun July 12)',
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
      dayLabel: 'Day',
      includeDay: 'Include this day',
      uploadLabel: '+ Add your own photos to this day',
      uploadHint: 'Your own photos are stored only locally in this browser and appear in the printed book – not on the website.',
      captionPlaceholder: 'Caption …',
      removeUpload: 'Remove',
      toc: 'Contents',
      loading: 'Loading book …',
    },
  }[LANG];

  const FONTS = {
    georgia: "Georgia, 'Times New Roman', serif",
    palatino: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
    sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  };
  const IMG_SIZES = { small: '8cm', medium: '12cm', large: '19cm', full: '23.5cm' };

  const defaultState = () => ({
    title: T.defaultTitle,
    subtitle: T.defaultSubtitle,
    cover: IMG_BASE + 'tag3/04.jpg',
    font: 'georgia',
    accent: '#aa3333',
    imgSize: 'large',
    textMode: 'full',
    excludedDays: [],
    excludedPhotos: [],
  });

  let state = defaultState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') state = Object.assign(defaultState(), saved);
  } catch (e) { /* defekter Speicher -> Defaults */ }

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
          if (rec.lang !== LANG) continue;
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
        resolve();
      };
      if (!db) return finish('mem-' + Math.random().toString(36).slice(2));
      const store = db.transaction('photos', 'readwrite').objectStore('photos');
      const req = store.add({ lang: LANG, day, caption: '', blob: file });
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
        for (const rec of req.result) if (rec.lang === LANG) store.delete(rec.id);
        resolve();
      };
      req.onerror = () => resolve();
    });
  }

  // ---------- Kapitel laden (gleiche Bereinigung wie tools/build-book.js) ----------
  const chapters = {}; // day -> {title, node}

  async function loadChapter(n) {
    const res = await fetch(dayFile(n));
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const body = doc.body;
    body.querySelectorAll('.navbar, .map-heading, .map, script, .more-info').forEach((el) => el.remove());
    const title = body.querySelector('h1') ? body.querySelector('h1').textContent : `${T.dayLabel} ${n}`;
    const node = document.createElement('div');
    while (body.firstChild) node.appendChild(body.firstChild);
    chapters[n] = { title, node };
  }

  // Alle Fotos eines Kapitels: [{src, alt}]
  function chapterPhotos(n) {
    return Array.from(chapters[n].node.querySelectorAll('img')).map((img) => ({
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt') || '',
    }));
  }

  // ---------- Buch rendern ----------
  const bookEl = document.getElementById('book');

  function renderBook() {
    const root = document.createElement('div');
    root.className = 'book-inner';
    root.style.setProperty('--accent', state.accent);
    root.style.setProperty('--book-font', FONTS[state.font] || FONTS.georgia);
    root.style.setProperty('--img-max', IMG_SIZES[state.imgSize] || IMG_SIZES.large);
    if (state.imgSize === 'full') root.classList.add('img-full');

    // Titelseite
    const cover = document.createElement('div');
    cover.className = 'cover';
    cover.innerHTML =
      `<h1>${escapeHtml(state.title)}</h1>` +
      `<p class="subtitle">${escapeHtml(state.subtitle)}</p>` +
      `<img src="${state.cover}" alt="">` +
      `<p class="meta">${T.meta}</p>`;
    root.appendChild(cover);

    const includedDays = DAYS.filter((n) => !state.excludedDays.includes(n));

    // Inhaltsverzeichnis
    const toc = document.createElement('div');
    toc.className = 'toc';
    toc.innerHTML = `<h2>${T.toc}</h2><ol>` +
      includedDays.map((n) => `<li>${escapeHtml(chapters[n].title)}</li>`).join('') + '</ol>';
    root.appendChild(toc);

    // Kapitel
    for (const n of includedDays) {
      const ch = chapters[n].node.cloneNode(true);

      // Abgewählte Fotos samt direkt folgender Bildunterschrift entfernen
      ch.querySelectorAll('img').forEach((img) => {
        if (!state.excludedPhotos.includes(img.getAttribute('src'))) return;
        const next = img.nextElementSibling;
        if (next && next.tagName === 'P' && !next.classList.length) next.remove();
        img.remove();
      });

      if (state.textMode === 'notips') {
        ch.querySelectorAll('.tip').forEach((el) => el.remove());
      } else if (state.textMode === 'photos') {
        // Nur h1, Fotos und deren direkt folgende Bildunterschriften behalten
        const keep = new Set();
        ch.querySelectorAll('h1').forEach((el) => keep.add(el));
        ch.querySelectorAll('img').forEach((img) => {
          keep.add(img);
          const next = img.nextElementSibling;
          if (next && next.tagName === 'P' && !next.classList.length) keep.add(next);
        });
        Array.from(ch.children).forEach((el) => { if (!keep.has(el)) el.remove(); });
      }

      // Eigene Fotos ans Kapitelende
      for (const u of uploads.filter((u) => u.day === n)) {
        const img = document.createElement('img');
        img.src = u.url;
        img.alt = u.caption;
        ch.appendChild(img);
        if (u.caption) {
          const p = document.createElement('p');
          p.textContent = u.caption;
          ch.appendChild(p);
        }
      }

      const wrap = document.createElement('div');
      wrap.className = 'chapter';
      wrap.appendChild(ch);
      root.appendChild(wrap);
    }

    bookEl.replaceChildren(root);
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
    );

    // Titelseite
    frag.append(section(T.coverSection,
      el('label', {}, T.titleLabel,
        el('input', { type: 'text', value: state.title, oninput: (e) => { state.title = e.target.value; saveState(); renderBook(); } })),
      el('label', {}, T.subtitleLabel,
        el('input', { type: 'text', value: state.subtitle, oninput: (e) => { state.subtitle = e.target.value; saveState(); renderBook(); } })),
      el('p', { class: 'ctl-hint' }, T.coverHint),
    ));

    // Stil
    const fontSel = el('select', {
      onchange: (e) => { state.font = e.target.value; saveState(); renderBook(); },
    },
      el('option', { value: 'georgia' }, T.fontGeorgia),
      el('option', { value: 'palatino' }, T.fontPalatino),
      el('option', { value: 'sans' }, T.fontSans));
    fontSel.value = state.font;

    const sizeSel = el('select', {
      onchange: (e) => { state.imgSize = e.target.value; saveState(); renderBook(); },
    },
      el('option', { value: 'small' }, T.sizeSmall),
      el('option', { value: 'medium' }, T.sizeMedium),
      el('option', { value: 'large' }, T.sizeLarge),
      el('option', { value: 'full' }, T.sizeFull));
    sizeSel.value = state.imgSize;

    frag.append(section(T.styleSection,
      el('label', {}, T.fontLabel, fontSel),
      el('label', {}, T.accentLabel,
        el('input', { type: 'color', value: state.accent, oninput: (e) => { state.accent = e.target.value; saveState(); renderBook(); } })),
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

      dayBox.append(el('summary', {}, dayToggle, ` ${chapters[n].title}`));

      const grid = el('div', { class: 'ctl-thumbs' });
      for (const photo of chapterPhotos(n)) {
        const off = state.excludedPhotos.includes(photo.src);
        const isCover = state.cover === photo.src;
        const thumb = el('div', { class: 'ctl-thumb' + (off ? ' off' : '') + (isCover ? ' is-cover' : '') },
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
            onclick: () => { state.cover = photo.src; saveState(); renderControls(); renderBook(); },
          }, '★'));
        grid.append(thumb);
      }

      // Eigene Fotos dieses Tags
      for (const u of uploads.filter((u) => u.day === n)) {
        grid.append(el('div', { class: 'ctl-thumb ctl-upload' },
          el('img', { src: u.url, alt: u.caption }),
          el('input', {
            type: 'text', placeholder: T.captionPlaceholder, value: u.caption,
            oninput: (e) => { u.caption = e.target.value; updateUpload(u); renderBook(); },
          }),
          el('button', {
            type: 'button', class: 'ctl-remove-btn',
            onclick: () => { removeUpload(u); renderControls(); renderBook(); },
          }, T.removeUpload)));
      }

      const fileInput = el('input', {
        type: 'file', accept: 'image/*', multiple: '',
        onchange: async (e) => {
          for (const file of e.target.files) await addUpload(n, file);
          e.target.value = '';
          renderControls(); renderBook();
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

  // ---------- Start ----------
  (async () => {
    bookEl.textContent = T.loading;
    db = await openDb();
    await Promise.all([loadUploads(), ...DAYS.map(loadChapter)]);
    renderControls();
    renderBook();
    document.body.classList.add('editor-ready');
  })();
})();
