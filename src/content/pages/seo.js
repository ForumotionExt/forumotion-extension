'use strict';
import BasePage from './_base.js';

// ─── Constante ────────────────────────────────────────────────────────────────

const STATUS = {
  pass: { bg: '#10b981', label: '✓ OK',       color: '#fff' },
  warn: { bg: '#f39c12', label: '⚠ Atenție',  color: '#fff' },
  fail: { bg: '#e74c3c', label: '✕ Problemă', color: '#fff' },
  info: { bg: '#3498db', label: 'ℹ Info',     color: '#fff' },
};

// ─── Utilitare pure ───────────────────────────────────────────────────────────

const esc      = (str) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const truncate = (str, max) => { str = String(str ?? '').trim(); return str.length > max ? str.slice(0, max) + '…' : str; };

// ─── Engine de analiză (pur, fără side-effects) ───────────────────────────────

function analyse(html, robotsTxt, sitemapStatus) {
  const doc    = new DOMParser().parseFromString(html, 'text/html');
  const checks = [];

  // ── Meta ──────────────────────────────────────────────────────────────────
  const titleText = doc.querySelector('title')?.textContent.trim() ?? '';
  checks.push({
    category: 'Meta', item: 'Title',
    value : titleText ? truncate(titleText, 70) : '—',
    status: titleText.length > 5 ? (titleText.length <= 60 ? 'pass' : 'warn') : 'fail',
    tip   : titleText.length > 60  ? `Titlul are ${titleText.length} caractere (recomandat ≤60)` :
            titleText.length <= 5  ? 'Lipsește sau e prea scurt' : `OK (${titleText.length} caractere)`,
  });

  const descText = doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
  checks.push({
    category: 'Meta', item: 'Meta Description',
    value : descText ? truncate(descText, 80) : '—',
    status: descText.length >= 50 && descText.length <= 160 ? 'pass' : descText.length > 0 ? 'warn' : 'fail',
    tip   : !descText ? 'Lipsește meta description' :
            descText.length < 50  ? `Prea scurtă (${descText.length} car.)` :
            descText.length > 160 ? `Prea lungă (${descText.length} car.)`  : `OK (${descText.length} caractere)`,
  });

  const kwText = doc.querySelector('meta[name="keywords"]')?.getAttribute('content') ?? '';
  checks.push({
    category: 'Meta', item: 'Meta Keywords',
    value : kwText ? truncate(kwText, 80) : '—',
    status: kwText ? 'pass' : 'info',
    tip   : kwText ? 'Prezent (importanță scăzută pentru Google)' : 'Absent (opțional)',
  });

  const viewport = doc.querySelector('meta[name="viewport"]');
  checks.push({
    category: 'Meta', item: 'Viewport',
    value : viewport?.getAttribute('content') ?? '—',
    status: viewport ? 'pass' : 'fail',
    tip   : viewport ? 'OK — site responsiv' : 'Lipsește meta viewport!',
  });

  const charset = doc.querySelector('meta[charset]') || doc.querySelector('meta[http-equiv="Content-Type"]');
  checks.push({
    category: 'Meta', item: 'Charset',
    value : charset ? (charset.getAttribute('charset') || charset.getAttribute('content') || '') : '—',
    status: charset ? 'pass' : 'warn',
    tip   : charset ? 'OK' : 'Lipsește declarația charset',
  });

  const canonical = doc.querySelector('link[rel="canonical"]');
  checks.push({
    category: 'Meta', item: 'Canonical URL',
    value : canonical ? truncate(canonical.getAttribute('href') ?? '', 70) : '—',
    status: canonical ? 'pass' : 'warn',
    tip   : canonical ? 'OK' : 'Lipsește link canonical — risc duplicate content',
  });

  const robotsContent = doc.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '';
  checks.push({
    category: 'Meta', item: 'Meta Robots',
    value : robotsContent || '— (implicit: index, follow)',
    status: robotsContent.includes('noindex') ? 'fail' : robotsContent.includes('nofollow') ? 'warn' : 'pass',
    tip   : robotsContent.includes('noindex')  ? 'ATENȚIE: pagina are noindex!' :
            robotsContent.includes('nofollow') ? 'Atenție: link-urile nu sunt urmărite' :
            'OK — paginile sunt indexabile',
  });

  const favicon = doc.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
  checks.push({
    category: 'Meta', item: 'Favicon',
    value : favicon ? truncate(favicon.getAttribute('href') ?? '', 60) : '—',
    status: favicon ? 'pass' : 'warn',
    tip   : favicon ? 'OK — favicon prezent' : 'Lipsește favicon — important pentru branding',
  });

  // ── Social ────────────────────────────────────────────────────────────────
  const ogTags  = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];
  const ogFound = ogTags.filter(p => doc.querySelector(`meta[property="${p}"]`));
  checks.push({
    category: 'Social', item: 'Open Graph',
    value : `${ogFound.length}/${ogTags.length} tags (${ogFound.join(', ')})`,
    status: ogFound.length >= 4 ? 'pass' : ogFound.length >= 2 ? 'warn' : 'fail',
    tip   : ogFound.length >= 4 ? 'Bine configurat' :
            'Lipsesc: ' + ogTags.filter(p => !ogFound.includes(p)).join(', '),
  });

  const twTags  = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
  const twFound = twTags.filter(n => doc.querySelector(`meta[name="${n}"]`));
  checks.push({
    category: 'Social', item: 'Twitter Card',
    value : `${twFound.length}/${twTags.length} tags`,
    status: twFound.length >= 3 ? 'pass' : 'info',
    tip   : twFound.length >= 3 ? 'Bine configurat' :
            twFound.length > 0  ? 'Parțial — lipsesc: ' + twTags.filter(n => !twFound.includes(n)).join(', ') :
            'Absent (opțional, dar recomandat pentru share-uri)',
  });

  // ── Conținut ──────────────────────────────────────────────────────────────
  const h1s = doc.querySelectorAll('h1');
  const h2s = doc.querySelectorAll('h2');
  const h3s = doc.querySelectorAll('h3');

  checks.push({
    category: 'Conținut', item: 'Headings H1',
    value : `${h1s.length} H1${h1s.length > 0 ? `: "${truncate(h1s[0].textContent.trim(), 50)}"` : ''}`,
    status: h1s.length === 1 ? 'pass' : h1s.length === 0 ? 'fail' : 'warn',
    tip   : h1s.length === 0 ? 'Nu există H1!' :
            h1s.length > 1  ? `Multiple H1 (${h1s.length}) — recomandat 1 singur` : 'OK — un singur H1',
  });

  checks.push({
    category: 'Conținut', item: 'Headings H2–H3',
    value : `${h2s.length} H2, ${h3s.length} H3`,
    status: h2s.length > 0 ? 'pass' : 'info',
    tip   : h2s.length > 0 ? 'OK — structură de conținut bună' : 'Niciun H2 pe pagina de index',
  });

  const h1Text     = h1s[0]?.textContent.trim().toLowerCase() ?? '';
  const titleLow   = titleText.toLowerCase();
  const titleH1Dup = h1Text && titleLow && (h1Text === titleLow || titleLow.startsWith(h1Text));
  checks.push({
    category: 'Conținut', item: 'Title vs H1',
    value : titleH1Dup ? 'Identice / similare' : 'Diferite',
    status: titleH1Dup ? 'warn' : 'pass',
    tip   : titleH1Dup ? 'Title și H1 sunt prea similare — diferențiază-le' : 'OK — title și H1 sunt diferite',
  });

  const wordCount = (doc.body?.textContent ?? '').trim().split(/\s+/).filter(w => w.length > 0).length;
  checks.push({
    category: 'Conținut', item: 'Cuvinte pe pagină',
    value : `${wordCount} cuvinte`,
    status: wordCount >= 300 ? 'pass' : wordCount >= 100 ? 'warn' : 'fail',
    tip   : wordCount >= 300 ? 'OK — conținut suficient' :
            wordCount >= 100 ? `Conținut limitat (${wordCount} cuvinte)` :
            'Prea puțin conținut — Google preferă pagini cu 300+ cuvinte',
  });

  const imgs  = Array.from(doc.querySelectorAll('img'));
  const noAlt = imgs.filter(img => !img.getAttribute('alt'));
  checks.push({
    category: 'Conținut', item: 'Imagini fără alt',
    value : `${noAlt.length} / ${imgs.length} imagini`,
    status: noAlt.length === 0 ? 'pass' : noAlt.length <= 3 ? 'warn' : 'fail',
    tip   : noAlt.length === 0 ? 'Toate imaginile au atribut alt' :
            `${noAlt.length} imagini fără alt text — afectează accesibilitatea și SEO`,
  });

  const noDims = imgs.filter(img => !img.getAttribute('width') && !img.getAttribute('height') && !img.style.width);
  checks.push({
    category: 'Conținut', item: 'Imagini fără dimensiuni',
    value : `${noDims.length} / ${imgs.length}`,
    status: noDims.length === 0 ? 'pass' : noDims.length <= 5 ? 'info' : 'warn',
    tip   : noDims.length === 0 ? 'OK — dimensiunile sunt specificate' :
            `${noDims.length} imagini fără width/height — poate cauza layout shift (CLS)`,
  });

  // ── Crawling ──────────────────────────────────────────────────────────────
  checks.push({
    category: 'Crawling', item: 'robots.txt',
    value : robotsTxt ? `Prezent (${robotsTxt.split('\n').length} linii)` : 'Absent',
    status: robotsTxt ? 'pass' : 'warn',
    tip   : robotsTxt ? 'OK' : 'Lipsește robots.txt — crawlerii nu au directive',
  });

  if (robotsTxt) {
    const disallows = (robotsTxt.match(/^Disallow:\s*(.*)/gim) ?? [])
      .map(l => l.replace(/^Disallow:\s*/i, '').trim()).filter(Boolean);
    checks.push({
      category: 'Crawling', item: 'Reguli Disallow',
      value : disallows.length > 0 ? `${disallows.length} reguli` : 'Nicio regulă',
      status: disallows.some(d => d === '/') ? 'fail' : 'pass',
      tip   : disallows.some(d => d === '/') ? 'ATENȚIE: Disallow: / blochează TOT site-ul!' :
              disallows.length > 0 ? `OK — ${disallows.slice(0, 3).join(', ')}${disallows.length > 3 ? '…' : ''}` :
              'Nicio restricție — totul este accesibil crawlerelor',
    });
  }

  checks.push({
    category: 'Crawling', item: 'Sitemap XML',
    value : sitemapStatus === 'valid' ? 'Valid' : sitemapStatus === 'invalid' ? 'Găsit dar invalid' : 'Absent',
    status: sitemapStatus === 'valid' ? 'pass' : 'warn',
    tip   : sitemapStatus === 'valid' ? 'OK — sitemap găsit și valid' : 'Sitemap lipsește sau este invalid',
  });

  const sitemapInRobots = robotsTxt && /^Sitemap:/im.test(robotsTxt);
  checks.push({
    category: 'Crawling', item: 'Sitemap în robots.txt',
    value : sitemapInRobots ? 'Da' : 'Nu',
    status: sitemapInRobots ? 'pass' : 'warn',
    tip   : sitemapInRobots ? 'OK — sitemap declarat în robots.txt' :
            'Adaugă "Sitemap: URL" în robots.txt pentru indexare mai rapidă',
  });

  // ── Securitate ────────────────────────────────────────────────────────────
  const isHttps = window.location.protocol === 'https:';
  checks.push({
    category: 'Securitate', item: 'HTTPS',
    value : isHttps ? 'Da' : 'Nu',
    status: isHttps ? 'pass' : 'fail',
    tip   : isHttps ? 'OK — conexiune securizată' : 'Site-ul nu folosește HTTPS!',
  });

  const mixedElems = isHttps
    ? Array.from(doc.querySelectorAll('img[src^="http:"], script[src^="http:"], link[href^="http:"]'))
    : [];
  checks.push({
    category: 'Securitate', item: 'Mixed Content',
    value : isHttps ? (mixedElems.length === 0 ? 'Niciun element HTTP' : `${mixedElems.length} elemente HTTP`) : 'N/A (nu e HTTPS)',
    status: !isHttps ? 'info' : mixedElems.length === 0 ? 'pass' : 'warn',
    tip   : mixedElems.length > 0 ? `${mixedElems.length} resurse HTTP pe o pagină HTTPS` :
            isHttps ? 'OK — fără conținut mixt' : 'Site-ul nu folosește HTTPS',
  });

  // ── Accesibilitate ────────────────────────────────────────────────────────
  const htmlLang = doc.documentElement.getAttribute('lang');
  checks.push({
    category: 'Accesibilitate', item: 'Atribut lang',
    value : htmlLang ?? '—',
    status: htmlLang ? 'pass' : 'warn',
    tip   : htmlLang ? `OK — limba declarată: ${htmlLang}` : 'Lipsește atributul lang pe <html>',
  });

  // ── Date structurate ──────────────────────────────────────────────────────
  const ldScripts   = doc.querySelectorAll('script[type="application/ld+json"]');
  const microdata   = doc.querySelectorAll('[itemtype]');
  const schemaCount = ldScripts.length + microdata.length;
  checks.push({
    category: 'Date Structurate', item: 'Schema.org / JSON-LD',
    value : `${ldScripts.length} JSON-LD, ${microdata.length} microdata`,
    status: schemaCount > 0 ? 'pass' : 'warn',
    tip   : schemaCount > 0 ? 'Date structurate detectate — ajută la rich snippets' :
            'Nicio dată structurată — adaugă JSON-LD pentru rezultate îmbunătățite',
  });

  const ldTypes = [];
  ldScripts.forEach(s => {
    try {
      const obj = JSON.parse(s.textContent);
      if (obj['@type']) ldTypes.push(obj['@type']);
      if (Array.isArray(obj['@graph'])) obj['@graph'].forEach(g => { if (g['@type']) ldTypes.push(g['@type']); });
    } catch (_) {}
  });
  if (ldTypes.length > 0) {
    checks.push({ category: 'Date Structurate', item: 'Tipuri detectate', value: ldTypes.join(', '), status: 'info', tip: 'Tipuri Schema.org găsite pe pagină' });
  }

  // ── Performanță ───────────────────────────────────────────────────────────
  const iframes = doc.querySelectorAll('iframe');
  checks.push({
    category: 'Performanță', item: 'Iframe-uri',
    value : `${iframes.length} iframe-uri`,
    status: iframes.length === 0 ? 'pass' : iframes.length <= 2 ? 'info' : 'warn',
    tip   : iframes.length === 0 ? 'OK — fără iframe-uri externe' :
            `${iframes.length} iframe-uri — pot încetini pagina și afectează Core Web Vitals`,
  });

  const inlineStyles = doc.querySelectorAll('[style]');
  checks.push({
    category: 'Performanță', item: 'Stiluri inline',
    value : `${inlineStyles.length} elemente cu style=""`,
    status: inlineStyles.length <= 10 ? 'pass' : inlineStyles.length <= 30 ? 'info' : 'warn',
    tip   : inlineStyles.length <= 10 ? 'OK — puține stiluri inline' :
            'Multe stiluri inline — mutarea în CSS extern îmbunătățește caching-ul',
  });

  const extScripts = doc.querySelectorAll('script[src]');
  const extStyles  = doc.querySelectorAll('link[rel="stylesheet"]');
  const extCount   = extScripts.length + extStyles.length;
  checks.push({
    category: 'Performanță', item: 'Resurse externe',
    value : `${extScripts.length} JS, ${extStyles.length} CSS`,
    status: extCount <= 15 ? 'pass' : extCount <= 25 ? 'warn' : 'fail',
    tip   : extCount <= 15 ? 'OK — număr rezonabil de resurse' : 'Prea multe resurse externe — poate încetini încărcarea',
  });

  const deprecated = ['font', 'center', 'marquee', 'blink', 'big', 'strike', 'tt'];
  const foundDep   = deprecated.filter(tag => doc.querySelector(tag));
  checks.push({
    category: 'Performanță', item: 'Tag-uri HTML depreciate',
    value : foundDep.length > 0 ? foundDep.join(', ') : 'Niciunul',
    status: foundDep.length === 0 ? 'pass' : 'warn',
    tip   : foundDep.length === 0 ? 'OK — fără tag-uri depreciate' :
            `Tag-uri depreciate: ${foundDep.join(', ')} — înlocuiește cu CSS`,
  });

  // ── URL ───────────────────────────────────────────────────────────────────
  const urlClean = !/[?&].*[?&]/.test(window.location.href) && !/[\s%20]/.test(window.location.pathname);
  checks.push({
    category: 'URL', item: 'Structură URL',
    value : truncate(window.location.href, 70),
    status: urlClean ? 'pass' : 'warn',
    tip   : urlClean ? 'OK — URL curat' : 'URL-ul conține parametri multipli sau spații',
  });

  // ── Inventar meta tags ────────────────────────────────────────────────────
  const metaTags = [];
  doc.querySelectorAll('meta').forEach(m => {
    const name    = m.getAttribute('name') || m.getAttribute('property') || m.getAttribute('http-equiv') || '';
    const content = m.getAttribute('content') || m.getAttribute('charset') || '';
    if (name || content) metaTags.push({ name, content, type: m.getAttribute('property') ? 'OG/property' : m.getAttribute('name') ? 'name' : 'http-equiv' });
  });

  // ── Analiză link-uri ──────────────────────────────────────────────────────
  const origin      = window.location.origin;
  const internal    = [], external = [], nofollow = [], emptyAnchors = [];

  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') ?? '';
    const text = (a.textContent ?? '').trim();
    const rel  = (a.getAttribute('rel') ?? '').toLowerCase();

    if (!text && !a.querySelector('img')) emptyAnchors.push(href);
    if (rel.includes('nofollow')) nofollow.push(href);

    try {
      const url = new URL(href, origin);
      url.origin === origin ? internal.push(href) : external.push({ href, text: truncate(text, 40) });
    } catch (_) {
      if (href.startsWith('/') || href.startsWith('#')) internal.push(href);
    }
  });

  const links = { total: internal.length + external.length, internal, external, nofollow, emptyAnchors };

  checks.push({
    category: 'Link-uri', item: 'Total link-uri',
    value : `${links.total} (${internal.length} interne, ${external.length} externe)`,
    status: links.total > 0 ? 'pass' : 'warn',
    tip   : 'Link-urile interne ajută crawlerii să descopere paginile',
  });

  if (emptyAnchors.length > 0) {
    checks.push({ category: 'Link-uri', item: 'Ancore goale', value: `${emptyAnchors.length} link-uri fără text`, status: emptyAnchors.length <= 2 ? 'warn' : 'fail', tip: 'Adaugă text descriptiv pe link-uri' });
  }
  if (nofollow.length > 0) {
    checks.push({ category: 'Link-uri', item: 'Link-uri nofollow', value: `${nofollow.length} link-uri`, status: 'info', tip: 'Link-urile nofollow nu transmit PageRank' });
  }

  // ── Scor ──────────────────────────────────────────────────────────────────
  const weights  = { pass: 1, warn: 0.5, info: 0.5, fail: 0 };
  const scorable = checks.filter(c => c.status !== 'info');
  const score    = scorable.length > 0
    ? Math.round((scorable.reduce((s, c) => s + (weights[c.status] ?? 0), 0) / scorable.length) * 100)
    : 0;

  return { checks, score, metaTags, links };
}

// ─── Render: tabel rezultate ──────────────────────────────────────────────────

function renderResults(results, D) {
  const scoreColor = results.score >= 80 ? '#10b981' : results.score >= 50 ? '#f39c12' : '#e74c3c';
  const scoreLabel = results.score >= 80 ? 'Bine!' : results.score >= 50 ? 'Acceptabil' : 'Necesită îmbunătățiri';

  let html = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;padding:10px;background:#f9f9fb;border:1px solid #e0e0e0;border-radius:4px;">
      <div style="text-align:center;">
        <div style="font-size:32px;font-weight:bold;color:${scoreColor};">${results.score}</div>
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Scor SEO</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:11px;color:#555;">
          <strong style="color:${scoreColor};">${scoreLabel}</strong>
          — ${results.checks.filter(c => c.status === 'pass').length} OK,
          ${results.checks.filter(c => c.status === 'warn').length} atenționări,
          ${results.checks.filter(c => c.status === 'fail').length} probleme
          din ${results.checks.length} verificări.
        </div>
        <div style="background:#e0e0e0;border-radius:3px;height:6px;overflow:hidden;margin-top:6px;max-width:300px;">
          <div style="height:100%;background:${scoreColor};width:${results.score}%;border-radius:3px;"></div>
        </div>
      </div>
    </div>
  `;

  // Grupare după categorie
  const groups = results.checks.reduce((acc, c) => {
    let g = acc.find(x => x.name === c.category);
    if (!g) { g = { name: c.category, items: [] }; acc.push(g); }
    g.items.push(c);
    return acc;
  }, []);

  for (const g of groups) {
    html += `
      <table class="${D.TABLE}" cellspacing="1" style="margin-bottom:8px;">
        <thead>
          <tr><th colspan="4" class="thbg" style="text-align:left;"><i class="fa fa-folder-o"></i> ${esc(g.name)}</th></tr>
          <tr>
            <th class="thbg" style="width:160px;">Verificare</th>
            <th class="thbg">Valoare</th>
            <th class="thbg" style="width:95px;">Status</th>
            <th class="thbg">Recomandare</th>
          </tr>
        </thead>
        <tbody>
          ${g.items.map((c, i) => {
            const s = STATUS[c.status] ?? STATUS.info;
            const r = i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN;
            return `
              <tr>
                <td class="${r}" style="font-weight:600;">${esc(c.item)}</td>
                <td class="${r}" style="font-size:11px;word-break:break-all;">${esc(c.value)}</td>
                <td class="${r}" style="text-align:center;">
                  <span style="background:${s.bg};color:${s.color};padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600;white-space:nowrap;">${s.label}</span>
                </td>
                <td class="${r}" style="font-size:11px;color:#555;">${esc(c.tip)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  return html;
}

// ─── Render: inventar meta tags ───────────────────────────────────────────────

function renderMetaTags(metaTags, D) {
  if (!metaTags.length) return '<p style="color:#888;">Nu s-au găsit meta tags.</p>';

  const TYPE_LABELS = { 'name': '🏷️ Meta name', 'OG/property': '📱 Open Graph', 'http-equiv': '⚙ HTTP-equiv', 'other': 'Altele' };
  const important   = ['description','keywords','viewport','robots','og:title','og:description','og:image','twitter:card'];

  const byType = metaTags.reduce((acc, m) => {
    const t = m.type || 'other';
    (acc[t] = acc[t] ?? []).push(m);
    return acc;
  }, {});

  let html = `<div style="margin-bottom:8px;font-size:11px;color:#888;">Total: <strong>${metaTags.length}</strong> meta tags detectate.</div>`;

  for (const [type, tags] of Object.entries(byType)) {
    html += `
      <table class="${D.TABLE}" cellspacing="1" style="margin-bottom:8px;">
        <thead>
          <tr><th colspan="3" class="thbg" style="text-align:left;">${TYPE_LABELS[type] ?? type} (${tags.length})</th></tr>
          <tr>
            <th class="thbg" style="width:200px;">Nume / Property</th>
            <th class="thbg">Conținut</th>
            <th class="thbg" style="width:80px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${tags.map((m, i) => {
            const r      = i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN;
            const isImp  = important.some(k => m.name.toLowerCase().includes(k));
            const bg     = isImp ? '#10b981' : '#3498db';
            const label  = isImp ? 'Important' : 'Info';
            return `
              <tr>
                <td class="${r}" style="font-weight:600;font-family:monospace;font-size:11px;">${esc(m.name)}</td>
                <td class="${r}" style="font-size:11px;word-break:break-all;">${esc(truncate(m.content, 120))}</td>
                <td class="${r}" style="text-align:center;">
                  <span style="background:${bg};color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:600;">${label}</span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // Checklist esențiale
  const essential = [
    { tag: 'description',         label: 'Meta Description',     rec: 'Descrie pagina în 50–160 caractere'                    },
    { tag: 'viewport',            label: 'Viewport',             rec: 'width=device-width, initial-scale=1'                   },
    { tag: 'robots',              label: 'Meta Robots',          rec: 'Controlează indexarea (index/noindex, follow/nofollow)' },
    { tag: 'og:title',            label: 'OG Title',             rec: 'Titlul afișat la share pe Facebook/LinkedIn'           },
    { tag: 'og:description',      label: 'OG Description',       rec: 'Descrierea pentru share-uri sociale'                   },
    { tag: 'og:image',            label: 'OG Image',             rec: 'Imagine pentru share-uri (1200×630px recomandat)'      },
    { tag: 'og:url',              label: 'OG URL',               rec: 'URL-ul canonic al paginii'                             },
    { tag: 'twitter:card',        label: 'Twitter Card',         rec: 'summary sau summary_large_image'                       },
    { tag: 'twitter:title',       label: 'Twitter Title',        rec: 'Titlul afișat pe Twitter/X'                            },
    { tag: 'twitter:description', label: 'Twitter Description',  rec: 'Descrierea pe Twitter/X'                               },
    { tag: 'author',              label: 'Author',               rec: 'Autorul sau organizația paginii'                       },
    { tag: 'theme-color',         label: 'Theme Color',          rec: 'Culoarea barei de adresă pe mobile'                    },
  ];

  html += `
    <h4 style="margin:12px 0 6px;font-size:12px;">📋 Checklist meta tags esențiale</h4>
    <table class="${D.TABLE}" cellspacing="1">
      <thead>
        <tr>
          <th class="thbg" style="width:40px;">✓</th>
          <th class="thbg" style="width:180px;">Meta Tag</th>
          <th class="thbg">Recomandare</th>
        </tr>
      </thead>
      <tbody>
        ${essential.map((e, i) => {
          const found = metaTags.some(m => m.name.toLowerCase().includes(e.tag.toLowerCase()));
          const r = i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN;
          return `
            <tr>
              <td class="${r}" style="text-align:center;font-size:15px;">
                <span style="color:${found ? '#10b981' : '#e74c3c'};">${found ? '✓' : '✗'}</span>
              </td>
              <td class="${r}" style="font-weight:600;">${esc(e.label)}</td>
              <td class="${r}" style="font-size:11px;color:#555;">${esc(e.rec)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  return html;
}

// ─── Render: analiză link-uri ─────────────────────────────────────────────────

function renderLinks(links, D) {
  const stat = (label, value, color) => `
    <div style="text-align:center;min-width:72px;">
      <div style="font-size:24px;font-weight:bold;color:${color};">${value}</div>
      <div style="font-size:10px;color:#888;">${label}</div>
    </div>
  `;

  let html = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;padding:10px;background:#f9f9fb;border:1px solid #e0e0e0;border-radius:4px;">
      ${stat('Total', links.total, '#3498db')}
      ${stat('Interne', links.internal.length, '#10b981')}
      ${stat('Externe', links.external.length, '#e8703a')}
      ${stat('Fără text', links.emptyAnchors.length, '#e74c3c')}
      ${stat('Nofollow', links.nofollow.length, '#999')}
    </div>
  `;

  if (links.external.length > 0) {
    html += `
      <h4 style="margin:8px 0 4px;font-size:12px;">🔗 Link-uri externe (${links.external.length})</h4>
      <table class="${D.TABLE}" cellspacing="1" style="margin-bottom:8px;">
        <thead>
          <tr>
            <th class="thbg">URL</th>
            <th class="thbg" style="width:200px;">Text ancoră</th>
          </tr>
        </thead>
        <tbody>
          ${links.external.slice(0, 30).map((l, i) => {
            const r = i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN;
            return `
              <tr>
                <td class="${r}" style="font-size:11px;word-break:break-all;">${esc(l.href)}</td>
                <td class="${r}" style="font-size:11px;">${l.text ? esc(l.text) : '<em style="color:#ccc;">gol</em>'}</td>
              </tr>
            `;
          }).join('')}
          ${links.external.length > 30 ? `<tr><td class="${D.ROW_ODD}" colspan="2" style="color:#888;text-align:center;">…și încă ${links.external.length - 30} link-uri</td></tr>` : ''}
        </tbody>
      </table>
    `;
  }

  if (links.emptyAnchors.length > 0) {
    html += `<div style="margin-top:8px;padding:8px;background:#fff8e1;border:1px solid #f39c12;border-radius:3px;">
      <strong>⚠ ${links.emptyAnchors.length} link-uri fără text ancoră</strong><br>
      <span style="font-size:11px;">Adaugă text descriptiv sau aria-label pe fiecare link.</span>
    </div>`;
  }

  return html;
}

// ─── Render: recomandări ──────────────────────────────────────────────────────

function renderRecommendations(results, D) {
  const fails = results.checks.filter(c => c.status === 'fail');
  const warns = results.checks.filter(c => c.status === 'warn');

  const GUIDES = [
    { icon: '📝', title: 'Optimizare On-Page', items: [
      'Scrie un <strong>Title</strong> unic de 50–60 caractere pentru fiecare pagină',
      'Adaugă <strong>Meta Description</strong> de 120–160 caractere — fii descriptiv și convingător',
      'Folosește un singur <strong>H1</strong> pe pagină, clar și relevant',
      'Structurează conținutul cu <strong>H2–H3</strong> ierarhic',
      'Adaugă <strong>alt text</strong> descriptiv pe toate imaginile',
      'Menține URL-uri scurte, curate și descriptive',
    ]},
    { icon: '📱', title: 'Open Graph & Social Media', items: [
      'Setează <strong>og:title</strong>, <strong>og:description</strong>, <strong>og:image</strong> pentru share-uri frumoase pe Facebook',
      'Imagine OG recomandată: <strong>1200×630 px</strong> (raport 1.91:1)',
      'Adaugă <strong>twitter:card</strong> = "summary_large_image" pentru Twitter/X',
      'Verifică share-urile cu <a href="https://developers.facebook.com/tools/debug/" target="_blank" style="color:#3498db;">Facebook Debugger</a>',
    ]},
    { icon: '🕷️', title: 'Crawling & Indexare', items: [
      'Menține un <strong>robots.txt</strong> valid — nu bloca pagini importante cu Disallow',
      'Generează un <strong>sitemap.xml</strong> și menționează-l în robots.txt',
      'Adaugă <strong>link canonical</strong> pe fiecare pagină pentru a evita duplicate content',
      'Trimite sitemap-ul în <a href="https://search.google.com/search-console" target="_blank" style="color:#3498db;">Google Search Console</a>',
    ]},
    { icon: '⚡', title: 'Performanță & Core Web Vitals', items: [
      'Minimizează numărul de <strong>resurse externe</strong> (JS/CSS)',
      'Specifică <strong>width/height</strong> pe imagini pentru a evita Cumulative Layout Shift (CLS)',
      'Evită iframe-urile inutile — încetinesc încărcarea',
      'Testează cu <a href="https://pagespeed.web.dev/" target="_blank" style="color:#3498db;">PageSpeed Insights</a>',
    ]},
    { icon: '🔒', title: 'Securitate', items: [
      'Folosește <strong>HTTPS</strong> obligatoriu — Google penalizează site-urile HTTP',
      'Evită <strong>mixed content</strong> (resurse HTTP pe pagini HTTPS)',
    ]},
    { icon: '📊', title: 'Date Structurate (Schema.org)', items: [
      'Adaugă <strong>JSON-LD</strong> cu tipul WebSite / Organization pe pagina de index',
      'Folosește <strong>BreadcrumbList</strong> pentru navigare',
      'Testează cu <a href="https://search.google.com/test/rich-results" target="_blank" style="color:#3498db;">Rich Results Test</a>',
    ]},
  ];

  const TOOLS = [
    ['Google Search Console', 'https://search.google.com/search-console',      'Monitorizare indexare, erori, query-uri'],
    ['PageSpeed Insights',    'https://pagespeed.web.dev/',                     'Testare performanță și Core Web Vitals'],
    ['Rich Results Test',     'https://search.google.com/test/rich-results',    'Validare date structurate'],
    ['Facebook Debugger',     'https://developers.facebook.com/tools/debug/',   'Verificare Open Graph tags'],
    ['Mobile-Friendly Test',  'https://search.google.com/test/mobile-friendly', 'Testare compatibilitate mobil'],
    ['Bing Webmaster Tools',  'https://www.bing.com/webmasters/',               'Monitorizare Bing'],
  ];

  let html = '';

  if (fails.length > 0) {
    html += `<div style="margin-bottom:10px;padding:8px 12px;background:#fdf0ef;border:1px solid #e74c3c;border-radius:3px;">
      <strong>🔴 Probleme critice (${fails.length}):</strong>
      <ul style="margin:4px 0 0 16px;padding:0;">
        ${fails.map(f => `<li style="margin:2px 0;"><strong>${esc(f.item)}</strong> — ${esc(f.tip)}</li>`).join('')}
      </ul>
    </div>`;
  }

  if (warns.length > 0) {
    html += `<div style="margin-bottom:10px;padding:8px 12px;background:#fff8e1;border:1px solid #f39c12;border-radius:3px;">
      <strong>🟡 Atenționări (${warns.length}):</strong>
      <ul style="margin:4px 0 0 16px;padding:0;">
        ${warns.map(w => `<li style="margin:2px 0;"><strong>${esc(w.item)}</strong> — ${esc(w.tip)}</li>`).join('')}
      </ul>
    </div>`;
  }

  for (const g of GUIDES) {
    html += `<fieldset style="margin:0 0 10px;padding:8px 12px;border:1px solid #e0e0e0;">
      <legend style="font-weight:600;font-size:12px;">${g.icon} ${esc(g.title)}</legend>
      <ul style="margin:4px 0;padding:0 0 0 18px;font-size:11px;line-height:1.8;color:#444;">
        ${g.items.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </fieldset>`;
  }

  html += `<fieldset style="margin:0 0 10px;padding:8px 12px;border:1px solid #e0e0e0;">
    <legend style="font-weight:600;font-size:12px;">🔧 Instrumente utile</legend>
    <table style="width:100%;font-size:11px;border-collapse:collapse;">
      ${TOOLS.map(r => `
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:4px 8px 4px 0;font-weight:600;">
            <a href="${r[1]}" target="_blank" style="color:#3498db;">${esc(r[0])}</a>
          </td>
          <td style="padding:4px 0;color:#666;">${esc(r[2])}</td>
        </tr>
      `).join('')}
    </table>
  </fieldset>`;

  return html;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchPage(url) {
  const res = await fetch(url, { credentials: 'include', redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} pentru ${url}`);
  return res.text();
}

async function fetchText(url) {
  try {
    const res = await fetch(url, { credentials: 'include', redirect: 'follow' });
    return res.ok ? res.text() : '';
  } catch (_) { return ''; }
}

function extractSitemapUrl(robotsTxt) {
  const m = robotsTxt?.match(/^Sitemap:\s*(.+)/im);
  return m ? m[1].trim() : null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default BasePage('seo', async ({ Utils, FM, t, bus, params }) => {
  const D = FM.ACP_DOM.CONTENT;
  const I = FM.ACP_DOM.ICONS;

  // Skeleton — afișat imediat, fără niciun request
  const scanPanel = Utils.DOM.fieldset(
    `<i class="fa ${I.SEO}"></i>&nbsp;Analiză SEO completă`,
    { class: D.GROUP },
    `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
      <input type="button" name="fme-seo-scan" value="🔍 Scanează forumul" class="icon_ok" />
      <span id="fme-seo-status" style="font-size:11px;color:#888;"></span>
    </div>
    <div id="fme-seo-results"></div>`
  );

  const metaPanel = Utils.DOM.fieldset(
    `<i class="fa fa-tags"></i>&nbsp;Inventar Meta Tags`,
    { class: D.GROUP },
    `<div id="fme-seo-metatags"><p style="color:#aaa;font-size:11px;">Rulează scanarea pentru a vedea inventarul.</p></div>`
  );

  const linksPanel = Utils.DOM.fieldset(
    `<i class="fa fa-link"></i>&nbsp;Analiză Link-uri`,
    { class: D.GROUP },
    `<div id="fme-seo-links"><p style="color:#aaa;font-size:11px;">Rulează scanarea pentru a vedea link-urile.</p></div>`
  );

  const recsPanel = Utils.DOM.fieldset(
    `<i class="fa fa-lightbulb-o"></i>&nbsp;Recomandări &amp; Ghid SEO`,
    { class: D.GROUP },
    `<div id="fme-seo-recommendations"><p style="color:#aaa;font-size:11px;">Rulează scanarea pentru a vedea recomandările.</p></div>`
  );

  const html = `
    <div id="fme-seo-audit-page" style="font-size:12px;">
      ${scanPanel}
      ${metaPanel}
      ${linksPanel}
      ${recsPanel}
    </div>
  `;

  return {
    html,
    onMount: (container, { signal }) => {
      container.querySelector('[name="fme-seo-scan"]')?.addEventListener('click', async (e) => {
        const btn    = e.target;
        const status = container.querySelector('#fme-seo-status');
        const area   = container.querySelector('#fme-seo-results');

        btn.disabled       = true;
        btn.value          = 'Se scanează...';
        status.textContent = '';
        area.innerHTML     = `<p style="color:#888;"><i class="fa fa-spinner fa-spin"></i> Se încarcă pagina de index...</p>`;

        const baseUrl = window.location.origin;

        try {
          status.textContent = 'Se descarcă pagina principală...';
          const [indexHtml, robotsTxt] = await Promise.all([
            fetchPage(baseUrl + '/'),
            fetchText(baseUrl + '/robots.txt'),
          ]);

          status.textContent = 'Se verifică sitemap...';
          let sitemapStatus  = 'absent';
          const sitemapUrl   = extractSitemapUrl(robotsTxt) || (baseUrl + '/sitemap.xml');
          try {
            const sRes = await fetch(sitemapUrl, { credentials: 'include', redirect: 'follow' });
            if (sRes.ok) {
              const sText = await sRes.text();
              sitemapStatus = sText.includes('<urlset') || sText.includes('<sitemapindex') ? 'valid' : 'invalid';
            }
          } catch (_) {}

          status.textContent = 'Se analizează...';
          const results = analyse(indexHtml, robotsTxt, sitemapStatus);

          area.innerHTML = renderResults(results, D);

          const metaEl = container.querySelector('#fme-seo-metatags');
          if (metaEl) metaEl.innerHTML = renderMetaTags(results.metaTags, D);

          const linksEl = container.querySelector('#fme-seo-links');
          if (linksEl) linksEl.innerHTML = renderLinks(results.links, D);

          const recsEl = container.querySelector('#fme-seo-recommendations');
          if (recsEl) recsEl.innerHTML = renderRecommendations(results, D);

          status.textContent = `Scanare completă — ${results.checks.length} verificări, scor: ${results.score}/100`;
          status.style.color = '#10b981';

          bus.emit('fme:section:render', { page: 'seo_audit', score: results.score });

        } catch (err) {
          console.warn('[FME SEO] Scan failed:', err);
          area.innerHTML     = `<p style="color:#e74c3c;">Scanarea a eșuat: ${esc(err.message)}</p>`;
          status.textContent = 'Eroare.';
          status.style.color = '#e74c3c';
        }

        btn.disabled = false;
        btn.value    = '🔍 Scanează forumul';
      }, { signal });
    }
  };
});