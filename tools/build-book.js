#!/usr/bin/env node
// Baut aus den Tagesseiten pro Sprache ein druckfertiges PDF-Buch
// (Titelseite, Inhaltsverzeichnis, 9 Kapitel, Seitenzahlen, alle Fotos).
// Aufruf: node tools/build-book.js  (aus dem Repo-Root oder tools/)

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function requirePlaywright() {
  try {
    return require('playwright');
  } catch {
    return require('/opt/node22/lib/node_modules/playwright');
  }
}

const LANGS = {
  de: {
    files: (n) => path.join(ROOT, `tag${n}.html`),
    output: 'reisetagebuch-de.pdf',
    lang: 'de',
    title: 'Reisetagebuch',
    subtitle: 'Best of Georgia &amp; Armenia',
    meta: 'Route: Jerewan &rarr; Tiflis, G Adventures Tour EXGA<br>Sa 4. &ndash; Sa 11. Juli 2026, plus ein Tag auf eigene Faust (So 12. Juli)',
    toc: 'Inhalt',
    imgPrefix: null, // Pfade stimmen bereits (images/…)
  },
  en: {
    files: (n) => path.join(ROOT, 'en', `day${n}.html`),
    output: 'travel-diary-en.pdf',
    lang: 'en',
    title: 'Travel Diary',
    subtitle: 'Best of Georgia &amp; Armenia',
    meta: 'Route: Yerevan &rarr; Tbilisi, G Adventures tour EXGA<br>Sat July 4 &ndash; Sat July 11, 2026, plus one day on our own (Sun July 12)',
    toc: 'Contents',
    imgPrefix: /\.\.\/images\//g, // ../images/ -> images/
  },
};

const COVER_IMAGE = 'images/tag3/04.jpg'; // Blick auf Chor Virap und Ararat

const BOOK_CSS = `
  body { font-family: Georgia, 'Times New Roman', serif; color: #2b2b2b; line-height: 1.55; margin: 0; }
  .cover { page-break-after: always; text-align: center; padding-top: 2.5cm; }
  .cover h1 { font-size: 2.4em; border: none; margin: 0 0 0.2em 0; }
  .cover .subtitle { font-size: 1.5em; color: #a33; margin: 0 0 1.2em 0; }
  .cover img { max-width: 100%; max-height: 14cm; margin: 0 0 1.2em 0; }
  .cover .meta { color: #666; font-style: italic; font-size: 1.05em; }
  .toc { page-break-after: always; }
  .toc h2 { font-size: 1.5em; border-bottom: 3px solid #a33; padding-bottom: 8px; color: #2b2b2b; }
  .toc ol { list-style: none; padding: 0; margin: 1.5em 0; }
  .toc li { margin: 0.9em 0; padding: 0 0 0.9em 0; border-bottom: 1px solid #ddd; }
  .chapter { page-break-before: always; }
  .chapter h1 { font-size: 1.6em; border-bottom: 3px solid #a33; padding-bottom: 8px; }
  h2 { font-size: 1.25em; margin-top: 1.8em; color: #a33; border-bottom: 1px solid #ddd; padding-bottom: 4px; page-break-after: avoid; }
  h3 { font-size: 1.05em; margin-top: 1.5em; color: #333; page-break-after: avoid; }
  img { max-width: 100%; max-height: 19cm; display: block; margin: 12px auto; page-break-inside: avoid; }
  .tip { background: #fff6e8; border: 1px solid #d99b2b; border-left: 4px solid #d99b2b; padding: 8px 14px; margin: 12px 0; page-break-inside: avoid; }
  .pending { color: #999; font-style: italic; }
  hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
  strong { color: #333; }
`;

function extractChapter(file, imgPrefix) {
  let html = fs.readFileSync(file, 'utf-8');
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  let c = body;
  // Interaktives entfernen: Navigation, Karte samt Überschrift, Skripte, Weblinks
  c = c.replace(/<div class="navbar">[\s\S]*?<\/div>\n?/g, '');
  c = c.replace(/<h2 class="map-heading">[^<]*<\/h2>\n?/g, '');
  c = c.replace(/<div id="map\d" class="map"><\/div>\n?/g, '');
  c = c.replace(/<script>[\s\S]*?<\/script>\n?/g, '');
  c = c.replace(/<p class="more-info">[\s\S]*?<\/p>\n?/g, '');
  if (imgPrefix) c = c.replace(imgPrefix, 'images/');
  return c.trim();
}

function buildBookHtml(cfg) {
  const chapters = [];
  const tocEntries = [];
  for (let n = 1; n <= 9; n++) {
    const chapter = extractChapter(cfg.files(n), cfg.imgPrefix);
    const title = chapter.match(/<h1>([\s\S]*?)<\/h1>/)[1];
    tocEntries.push(`<li>${title}</li>`);
    chapters.push(`<div class="chapter">${chapter}</div>`);
  }
  return `<!DOCTYPE html>
<html lang="${cfg.lang}">
<head>
<meta charset="UTF-8">
<title>${cfg.title}: ${cfg.subtitle}</title>
<style>${BOOK_CSS}</style>
</head>
<body>
<div class="cover">
  <h1>${cfg.title}</h1>
  <p class="subtitle">${cfg.subtitle}</p>
  <img src="${COVER_IMAGE}" alt="">
  <p class="meta">${cfg.meta}</p>
</div>
<div class="toc">
  <h2>${cfg.toc}</h2>
  <ol>${tocEntries.join('\n')}</ol>
</div>
${chapters.join('\n')}
</body>
</html>`;
}

(async () => {
  const { chromium } = requirePlaywright();
  const launchOpts = {};
  const localChrome = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  if (process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(localChrome)) {
    launchOpts.executablePath = localChrome;
  }
  const browser = await chromium.launch(launchOpts);

  for (const cfg of Object.values(LANGS)) {
    const bookHtml = buildBookHtml(cfg);
    const tmpFile = path.join(ROOT, `.book-${cfg.lang}.html`);
    fs.writeFileSync(tmpFile, bookHtml);

    const page = await browser.newPage();
    await page.goto(`file://${tmpFile}`, { waitUntil: 'networkidle', timeout: 120000 });
    const imgs = await page.$$eval('img', (els) => ({
      total: els.length,
      broken: els.filter((i) => !i.complete || i.naturalWidth === 0).length,
    }));
    if (imgs.broken > 0) {
      throw new Error(`${cfg.lang}: ${imgs.broken}/${imgs.total} Bilder nicht geladen`);
    }
    const rawPdf = path.join(ROOT, `.book-${cfg.lang}-raw.pdf`);
    await page.pdf({
      path: rawPdf,
      format: 'A4',
      margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="width:100%; text-align:center; font-size:9px; font-family:Georgia,serif; color:#666;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      printBackground: true,
    });
    await page.close();
    fs.unlinkSync(tmpFile);

    // Chromium bettet die Fotos unkomprimiert ein (~90 MB); Ghostscript
    // rekomprimiert auf Druckqualität (300 dpi) bei ~1/4 der Größe.
    const finalPdf = path.join(ROOT, cfg.output);
    execFileSync('gs', [
      '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5', '-dPDFSETTINGS=/printer',
      '-dNOPAUSE', '-dQUIET', '-dBATCH', `-sOutputFile=${finalPdf}`, rawPdf,
    ]);
    fs.unlinkSync(rawPdf);
    const size = (fs.statSync(finalPdf).size / 1024 / 1024).toFixed(1);
    console.log(`${cfg.output}: ${size} MB, ${imgs.total} Bilder`);
  }

  await browser.close();
})();
