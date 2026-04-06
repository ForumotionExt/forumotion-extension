/**
 * FME SEO Tools Tab
 * Analyses the forum's public pages for basic SEO health:
 * meta tags, title, OG tags, headings, robots, sitemap, performance.
 */

var FMESeoTab = (() => {
  'use strict';

  let _container  = null;
  let _results    = null;

  // ─── Public API ──────────────────────────────────────────────────────────────

  function render(container) {
    _container = container;
    _results   = null;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'main-content';
    wrapper.id        = 'main-content';
    wrapper.style.fontSize = '12px';

    wrapper.innerHTML = `
      <div class="fme-section-header">
        <h2 class="fme-section-title">FME</h2>
        <ul class="h2-breadcrumb clearfix"><li class="first">SEO Tools</li></ul>
        <blockquote class="block_left">
          <p class="explain">
            Analizează paginile publice ale forumului: meta tags, Open Graph, structură headings,
            robots.txt, sitemap, performanță, link-uri, date structurate și accesibilitate.
          </p>
        </blockquote>
      </div>

      <fieldset style="margin:0 12px 12px 12px;">
        <legend><i class="fa fa-search"></i> Analiză SEO completă</legend>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
          <input type="url" id="fme-seo-url" value="${window.location.origin}/" placeholder="https://forumul-tău.ro/" style="min-width:260px;flex:1 1 340px;padding:6px 8px;border:1px solid var(--fme-border, #d9dce3);border-radius:4px;background:var(--fme-surface, #fff);color:var(--fme-text, #333);" />
          <input type="button" id="fme-seo-scan" value="&#128269; Scanează URL" class="icon_ok" />
          <input type="button" id="fme-seo-copy" value="&#128203; Copiază rezumat" class="button2" disabled />
          <input type="button" id="fme-seo-export" value="&#128190; Export JSON" class="button2" disabled />
          <span id="fme-seo-status" style="font-size:11px;color:var(--fme-muted, #888);"></span>
        </div>
        <div style="margin:-2px 0 10px 0;font-size:11px;color:var(--fme-muted, #888);">
          Poți scana pagina principală sau orice URL public din forumul tău.
        </div>
        <div id="fme-seo-results"></div>
      </fieldset>

      <fieldset id="fme-seo-metatags-section" style="margin:0 12px 12px 12px;display:none;">
        <legend><i class="fa fa-tags"></i> Inventar Meta Tags</legend>
        <div id="fme-seo-metatags"></div>
      </fieldset>

      <fieldset id="fme-seo-links-section" style="margin:0 12px 12px 12px;display:none;">
        <legend><i class="fa fa-link"></i> Analiză Link-uri</legend>
        <div id="fme-seo-links"></div>
      </fieldset>

      <fieldset id="fme-seo-preview-section" style="margin:0 12px 12px 12px;display:none;">
        <legend><i class="fa fa-share-alt"></i> Preview social &amp; insight-uri</legend>
        <div id="fme-seo-preview"></div>
      </fieldset>

      <fieldset id="fme-seo-recommendations-section" style="margin:0 12px 12px 12px;display:none;">
        <legend><i class="fa fa-lightbulb-o"></i> Recomandări &amp; Ghid SEO</legend>
        <div id="fme-seo-recommendations"></div>
      </fieldset>
    `;

    container.appendChild(wrapper);

    const urlInput  = wrapper.querySelector('#fme-seo-url');
    const scanBtn   = wrapper.querySelector('#fme-seo-scan');
    const copyBtn   = wrapper.querySelector('#fme-seo-copy');
    const exportBtn = wrapper.querySelector('#fme-seo-export');

    scanBtn.addEventListener('click', () => runScan(wrapper));
    copyBtn.addEventListener('click', () => copySummary(wrapper));
    exportBtn.addEventListener('click', () => exportReport());
    urlInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runScan(wrapper);
      }
    });
  }

  // ─── Scanner ──────────────────────────────────────────────────────────────────

  async function runScan(wrapper) {
    const btn       = wrapper.querySelector('#fme-seo-scan');
    const copyBtn   = wrapper.querySelector('#fme-seo-copy');
    const exportBtn = wrapper.querySelector('#fme-seo-export');
    const urlInput  = wrapper.querySelector('#fme-seo-url');
    const status    = wrapper.querySelector('#fme-seo-status');
    const area      = wrapper.querySelector('#fme-seo-results');

    let scanUrl = '';
    try {
      scanUrl = normalizeScanUrl((urlInput && urlInput.value) || '');
    } catch (err) {
      area.innerHTML = '<p style="color:var(--fme-error, #e74c3c);">' + esc(err.message) + '</p>';
      status.textContent = 'URL invalid.';
      status.style.color = 'var(--fme-error, #e74c3c)';
      return;
    }

    btn.disabled       = true;
    copyBtn.disabled   = true;
    exportBtn.disabled = true;
    btn.value          = 'Se scanează...';
    status.textContent = '';
    status.style.color = 'var(--fme-muted, #888)';
    area.innerHTML     = '<p style="color:var(--fme-muted, #888);"><i class="fa fa-spinner fa-spin"></i> Se încarcă: ' + esc(truncate(scanUrl, 90)) + '</p>';

    if (urlInput) urlInput.value = scanUrl;

    const { origin } = new URL(scanUrl);

    try {
      status.textContent = 'Se descarcă pagina selectată...';
      const pageHtml = await fetchPage(scanUrl);

      status.textContent = 'Se verifică robots.txt...';
      const robotsTxt = await fetchText(origin + '/robots.txt');

      status.textContent = 'Se verifică sitemap...';
      let sitemapStatus = 'absent';
      const sitemapUrl = extractSitemapUrl(robotsTxt) || (origin + '/sitemap.xml');
      try {
        const sRes = await fetch(sitemapUrl, { credentials: 'include', redirect: 'follow' });
        if (sRes.ok) {
          const sText = await sRes.text();
          sitemapStatus = sText.includes('<urlset') || sText.includes('<sitemapindex') ? 'valid' : 'invalid';
        }
      } catch (_) {}

      status.textContent = 'Se analizează...';
      const results = analyse(pageHtml, robotsTxt, sitemapStatus, scanUrl);
      _results = results;

      renderResults(area, results);

      const metaSection = wrapper.querySelector('#fme-seo-metatags-section');
      const metaArea    = wrapper.querySelector('#fme-seo-metatags');
      if (metaSection && metaArea) {
        metaSection.style.display = '';
        renderMetaTagsInventory(metaArea, results.metaTags || []);
      }

      const linksSection = wrapper.querySelector('#fme-seo-links-section');
      const linksArea    = wrapper.querySelector('#fme-seo-links');
      if (linksSection && linksArea) {
        linksSection.style.display = '';
        renderLinksAnalysis(linksArea, results.links || {});
      }

      const previewSection = wrapper.querySelector('#fme-seo-preview-section');
      const previewArea    = wrapper.querySelector('#fme-seo-preview');
      if (previewSection && previewArea) {
        previewSection.style.display = '';
        renderPreview(previewArea, results);
      }

      const recsSection = wrapper.querySelector('#fme-seo-recommendations-section');
      const recsArea    = wrapper.querySelector('#fme-seo-recommendations');
      if (recsSection && recsArea) {
        recsSection.style.display = '';
        renderRecommendations(recsArea, results);
      }

      copyBtn.disabled   = false;
      exportBtn.disabled = false;
      status.textContent = 'Scanare completă — ' + results.checks.length + ' verificări pentru ' + truncate(results.scannedUrl, 60) + '.';
      status.style.color = 'var(--fme-success, #10b981)';
    } catch (e) {
      console.warn('[FME SEO] Scan failed:', e);
      area.innerHTML = '<p style="color:var(--fme-error, #e74c3c);">Scanarea a eșuat: ' + esc(e.message) + '</p>';
      status.textContent = 'Eroare.';
      status.style.color = 'var(--fme-error, #e74c3c)';
    }

    btn.disabled = false;
    btn.value    = '🔍 Scanează URL';
  }

  // ─── Analysis engine ──────────────────────────────────────────────────────────

  function analyse(html, robotsTxt, sitemapStatus, scannedUrl) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const pageUrl = new URL(scannedUrl || (window.location.origin + '/'), window.location.origin);
    const checks = [];

    // 1. Title
    const title = doc.querySelector('title');
    const titleText = title ? title.textContent.trim() : '';
    checks.push({
      category: 'Meta',
      item:     'Title',
      value:    titleText ? truncate(titleText, 70) : '—',
      status:   titleText.length > 5 ? (titleText.length <= 60 ? 'pass' : 'warn') : 'fail',
      tip:      titleText.length > 60 ? 'Titlul are ' + titleText.length + ' caractere (recomandat ≤60)' :
                titleText.length <= 5 ? 'Lipsește sau e prea scurt' : 'OK (' + titleText.length + ' caractere)',
    });

    // 2. Meta description
    const metaDesc = doc.querySelector('meta[name="description"]');
    const descText = metaDesc ? metaDesc.getAttribute('content') || '' : '';
    checks.push({
      category: 'Meta',
      item:     'Meta Description',
      value:    descText ? truncate(descText, 80) : '—',
      status:   descText.length >= 50 && descText.length <= 160 ? 'pass' :
                descText.length > 0 ? 'warn' : 'fail',
      tip:      !descText ? 'Lipsește meta description' :
                descText.length < 50 ? 'Prea scurtă (' + descText.length + ' car.)' :
                descText.length > 160 ? 'Prea lungă (' + descText.length + ' car.)' :
                'OK (' + descText.length + ' caractere)',
    });

    // 3. Meta keywords
    const metaKw = doc.querySelector('meta[name="keywords"]');
    const kwText = metaKw ? metaKw.getAttribute('content') || '' : '';
    checks.push({
      category: 'Meta',
      item:     'Meta Keywords',
      value:    kwText ? truncate(kwText, 80) : '—',
      status:   kwText ? 'pass' : 'info',
      tip:      kwText ? 'Prezent (importanță scăzută pentru Google)' : 'Absent (opțional)',
    });

    // 4. Viewport
    const viewport = doc.querySelector('meta[name="viewport"]');
    checks.push({
      category: 'Meta',
      item:     'Viewport',
      value:    viewport ? viewport.getAttribute('content') || '' : '—',
      status:   viewport ? 'pass' : 'fail',
      tip:      viewport ? 'OK — site responsiv' : 'Lipsește meta viewport!',
    });

    // 5. Charset
    const charset = doc.querySelector('meta[charset]') || doc.querySelector('meta[http-equiv="Content-Type"]');
    checks.push({
      category: 'Meta',
      item:     'Charset',
      value:    charset ? (charset.getAttribute('charset') || charset.getAttribute('content') || '') : '—',
      status:   charset ? 'pass' : 'warn',
      tip:      charset ? 'OK' : 'Lipsește declarația charset',
    });

    // 6. Canonical
    const canonical = doc.querySelector('link[rel="canonical"]');
    checks.push({
      category: 'Meta',
      item:     'Canonical URL',
      value:    canonical ? truncate(canonical.getAttribute('href') || '', 70) : '—',
      status:   canonical ? 'pass' : 'warn',
      tip:      canonical ? 'OK' : 'Lipsește link canonical — risc duplicate content',
    });

    // 7. Meta robots
    const metaRobots = doc.querySelector('meta[name="robots"]');
    const robotsContent = metaRobots ? metaRobots.getAttribute('content') || '' : '';
    checks.push({
      category: 'Meta',
      item:     'Meta Robots',
      value:    robotsContent || '— (implicit: index, follow)',
      status:   robotsContent.includes('noindex') ? 'fail' :
                robotsContent.includes('nofollow') ? 'warn' : 'pass',
      tip:      robotsContent.includes('noindex') ? 'ATENȚIE: pagina are noindex!' :
                robotsContent.includes('nofollow') ? 'Atenție: link-urile nu sunt urmărite' :
                'OK — paginile sunt indexabile',
    });

    // 8. Favicon
    const favicon = doc.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
    checks.push({
      category: 'Meta',
      item:     'Favicon',
      value:    favicon ? truncate(favicon.getAttribute('href') || '', 60) : '—',
      status:   favicon ? 'pass' : 'warn',
      tip:      favicon ? 'OK — favicon prezent' : 'Lipsește favicon — important pentru branding',
    });

    // 9. Open Graph
    const ogTags = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];
    const ogFound = ogTags.filter(t => doc.querySelector('meta[property="' + t + '"]'));
    checks.push({
      category: 'Social',
      item:     'Open Graph',
      value:    ogFound.length + '/' + ogTags.length + ' tags (' + ogFound.join(', ') + ')',
      status:   ogFound.length >= 4 ? 'pass' : ogFound.length >= 2 ? 'warn' : 'fail',
      tip:      ogFound.length >= 4 ? 'Bine configurat' :
                'Lipsesc: ' + ogTags.filter(t => !ogFound.includes(t)).join(', '),
    });

    // 10. Twitter Card
    const twTags = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
    const twFound = twTags.filter(t => doc.querySelector('meta[name="' + t + '"]'));
    checks.push({
      category: 'Social',
      item:     'Twitter Card',
      value:    twFound.length + '/' + twTags.length + ' tags',
      status:   twFound.length >= 3 ? 'pass' : twFound.length >= 1 ? 'info' : 'info',
      tip:      twFound.length >= 3 ? 'Bine configurat' :
                twFound.length > 0 ? 'Parțial — lipsesc: ' + twTags.filter(t => !twFound.includes(t)).join(', ') :
                'Absent (opțional, dar recomandat pentru share-uri Twitter)',
    });

    const socialPreview = extractSocialPreview(
      doc,
      titleText,
      descText,
      canonical ? (canonical.getAttribute('href') || pageUrl.href) : pageUrl.href,
      pageUrl.href
    );

    // 11. Heading structure
    const h1s = doc.querySelectorAll('h1');
    const h2s = doc.querySelectorAll('h2');
    const h3s = doc.querySelectorAll('h3');
    checks.push({
      category: 'Conținut',
      item:     'Headings H1',
      value:    h1s.length + ' H1' + (h1s.length > 0 ? ': "' + truncate(h1s[0].textContent.trim(), 50) + '"' : ''),
      status:   h1s.length === 1 ? 'pass' : h1s.length === 0 ? 'fail' : 'warn',
      tip:      h1s.length === 0 ? 'Nu există H1!' :
                h1s.length > 1 ? 'Multiple H1 (' + h1s.length + ') — recomandat 1 singur' : 'OK — un singur H1',
    });
    checks.push({
      category: 'Conținut',
      item:     'Headings H2–H3',
      value:    h2s.length + ' H2, ' + h3s.length + ' H3',
      status:   h2s.length > 0 ? 'pass' : 'info',
      tip:      h2s.length > 0 ? 'OK — structură de conținut bună' : 'Niciun H2 pe pagina de index',
    });

    // 12. Title vs H1 duplicate
    const h1Text = h1s.length > 0 ? h1s[0].textContent.trim().toLowerCase() : '';
    const titleLower = titleText.toLowerCase();
    const titleH1Dup = h1Text && titleLower && (h1Text === titleLower || titleLower.startsWith(h1Text));
    checks.push({
      category: 'Conținut',
      item:     'Title vs H1',
      value:    titleH1Dup ? 'Identice / similare' : 'Diferite',
      status:   titleH1Dup ? 'warn' : 'pass',
      tip:      titleH1Dup ? 'Title și H1 sunt prea similare — diferențiază-le' : 'OK — title și H1 sunt diferite',
    });

    // 13. Content length (word count)
    const bodyText = doc.body ? doc.body.textContent || '' : '';
    const wordCount = bodyText.trim().split(/\s+/).filter(w => w.length > 0).length;
    const keywords  = extractTopKeywords(bodyText);
    checks.push({
      category: 'Conținut',
      item:     'Cuvinte pe pagină',
      value:    wordCount + ' cuvinte',
      status:   wordCount >= 300 ? 'pass' : wordCount >= 100 ? 'warn' : 'fail',
      tip:      wordCount >= 300 ? 'OK — conținut suficient' :
                wordCount >= 100 ? 'Conținut limitat (' + wordCount + ' cuvinte)' :
                'Prea puțin conținut — Google preferă pagini cu 300+ cuvinte',
    });

    // 14. Images without alt
    const imgs = doc.querySelectorAll('img');
    const noAlt = Array.from(imgs).filter(img => !img.getAttribute('alt'));
    checks.push({
      category: 'Conținut',
      item:     'Imagini fără alt',
      value:    noAlt.length + ' / ' + imgs.length + ' imagini',
      status:   noAlt.length === 0 ? 'pass' : noAlt.length <= 3 ? 'warn' : 'fail',
      tip:      noAlt.length === 0 ? 'Toate imaginile au atribut alt' :
                noAlt.length + ' imagini fără alt text — afectează accesibilitatea și SEO',
    });

    // 15. Images without dimensions
    const noDims = Array.from(imgs).filter(img => !img.getAttribute('width') && !img.getAttribute('height') && !img.style.width);
    checks.push({
      category: 'Conținut',
      item:     'Imagini fără dimensiuni',
      value:    noDims.length + ' / ' + imgs.length,
      status:   noDims.length === 0 ? 'pass' : noDims.length <= 5 ? 'info' : 'warn',
      tip:      noDims.length === 0 ? 'OK — dimensiunile sunt specificate' :
                noDims.length + ' imagini fără width/height — poate cauza layout shift (CLS)',
    });

    // 16. robots.txt
    checks.push({
      category: 'Crawling',
      item:     'robots.txt',
      value:    robotsTxt ? 'Prezent (' + robotsTxt.split('\n').length + ' linii)' : 'Absent',
      status:   robotsTxt ? 'pass' : 'warn',
      tip:      robotsTxt ? 'OK' : 'Lipsește robots.txt — crawlerii nu au directive',
    });

    // 17. Disallow patterns in robots.txt
    if (robotsTxt) {
      const disallows = (robotsTxt.match(/^Disallow:\s*(.*)/gim) || []).map(l => l.replace(/^Disallow:\s*/i, '').trim()).filter(Boolean);
      checks.push({
        category: 'Crawling',
        item:     'Reguli Disallow',
        value:    disallows.length > 0 ? disallows.length + ' reguli' : 'Nicio regulă',
        status:   disallows.some(d => d === '/') ? 'fail' : 'pass',
        tip:      disallows.some(d => d === '/') ? 'ATENȚIE: Disallow: / blochează TOT site-ul!' :
                  disallows.length > 0 ? 'OK — ' + disallows.slice(0, 3).join(', ') + (disallows.length > 3 ? '…' : '') :
                  'Nicio restricție — totul este accesibil crawlerelor',
      });
    }

    // 18. Sitemap
    checks.push({
      category: 'Crawling',
      item:     'Sitemap XML',
      value:    sitemapStatus === 'valid' ? 'Valid' : sitemapStatus === 'invalid' ? 'Fișier găsit dar invalid' : 'Absent',
      status:   sitemapStatus === 'valid' ? 'pass' : 'warn',
      tip:      sitemapStatus === 'valid' ? 'OK — sitemap găsit și valid' :
                'Sitemap lipsește sau este invalid',
    });

    // 19. Sitemap in robots.txt
    const sitemapInRobots = robotsTxt && /^Sitemap:/im.test(robotsTxt);
    checks.push({
      category: 'Crawling',
      item:     'Sitemap în robots.txt',
      value:    sitemapInRobots ? 'Da' : 'Nu',
      status:   sitemapInRobots ? 'pass' : 'warn',
      tip:      sitemapInRobots ? 'OK — sitemap-ul este declarat în robots.txt' :
                'Adaugă "Sitemap: URL" în robots.txt pentru indexare mai rapidă',
    });

    // 20. HTTPS
    const isHttps = pageUrl.protocol === 'https:';
    checks.push({
      category: 'Securitate',
      item:     'HTTPS',
      value:    isHttps ? 'Da' : 'Nu',
      status:   isHttps ? 'pass' : 'fail',
      tip:      isHttps ? 'OK — conexiune securizată' : 'Site-ul nu folosește HTTPS!',
    });

    // 21. Mixed content check
    const mixedContent = isHttps && Array.from(doc.querySelectorAll('img[src^="http:"], script[src^="http:"], link[href^="http:"]'));
    const mixedCount = mixedContent ? mixedContent.length : 0;
    checks.push({
      category: 'Securitate',
      item:     'Mixed Content',
      value:    isHttps ? (mixedCount === 0 ? 'Niciun element HTTP' : mixedCount + ' elemente HTTP') : 'N/A (nu e HTTPS)',
      status:   !isHttps ? 'info' : mixedCount === 0 ? 'pass' : 'warn',
      tip:      mixedCount > 0 ? mixedCount + ' resurse încărcate prin HTTP pe o pagină HTTPS' :
                isHttps ? 'OK — fără conținut mixt' : 'Site-ul nu folosește HTTPS',
    });

    // 22. lang attribute
    const htmlLang = doc.documentElement.getAttribute('lang');
    checks.push({
      category: 'Accesibilitate',
      item:     'Atribut lang',
      value:    htmlLang || '—',
      status:   htmlLang ? 'pass' : 'warn',
      tip:      htmlLang ? 'OK — limba declarată: ' + htmlLang : 'Lipsește atributul lang pe <html>',
    });

    // 23. Structured Data / Schema.org
    const ldJsonScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    const microdata     = doc.querySelectorAll('[itemtype]');
    const schemaCount   = ldJsonScripts.length + microdata.length;
    checks.push({
      category: 'Date Structurate',
      item:     'Schema.org / JSON-LD',
      value:    ldJsonScripts.length + ' JSON-LD, ' + microdata.length + ' microdata',
      status:   schemaCount > 0 ? 'pass' : 'warn',
      tip:      schemaCount > 0 ? 'Date structurate detectate — ajută la rich snippets' :
                'Nicio dată structurată — adaugă JSON-LD pentru rezultate îmbunătățite în Google',
    });

    // Parse JSON-LD types
    const ldTypes = [];
    ldJsonScripts.forEach(script => {
      try {
        const obj = JSON.parse(script.textContent);
        if (obj['@type']) ldTypes.push(obj['@type']);
        if (Array.isArray(obj['@graph'])) obj['@graph'].forEach(g => { if (g['@type']) ldTypes.push(g['@type']); });
      } catch (_) {}
    });
    if (ldTypes.length > 0) {
      checks.push({
        category: 'Date Structurate',
        item:     'Tipuri detectate',
        value:    ldTypes.join(', '),
        status:   'info',
        tip:      'Tipuri Schema.org găsite pe pagină',
      });
    }

    // 24. iframe count (can affect SEO)
    const iframes = doc.querySelectorAll('iframe');
    checks.push({
      category: 'Performanță',
      item:     'Iframe-uri',
      value:    iframes.length + ' iframe-uri',
      status:   iframes.length === 0 ? 'pass' : iframes.length <= 2 ? 'info' : 'warn',
      tip:      iframes.length === 0 ? 'OK — fără iframe-uri externe' :
                iframes.length + ' iframe-uri — pot încetini pagina și afectează Core Web Vitals',
    });

    // 25. Inline styles count
    const inlineStyles = doc.querySelectorAll('[style]');
    checks.push({
      category: 'Performanță',
      item:     'Stiluri inline',
      value:    inlineStyles.length + ' elemente cu style=""',
      status:   inlineStyles.length <= 10 ? 'pass' : inlineStyles.length <= 30 ? 'info' : 'warn',
      tip:      inlineStyles.length <= 10 ? 'OK — puține stiluri inline' :
                'Multe stiluri inline — mutarea în CSS extern îmbunătățește caching-ul',
    });

    // 26. External scripts count
    const extScripts = doc.querySelectorAll('script[src]');
    const extStyles  = doc.querySelectorAll('link[rel="stylesheet"]');
    checks.push({
      category: 'Performanță',
      item:     'Resurse externe',
      value:    extScripts.length + ' JS, ' + extStyles.length + ' CSS',
      status:   (extScripts.length + extStyles.length) <= 15 ? 'pass' :
                (extScripts.length + extStyles.length) <= 25 ? 'warn' : 'fail',
      tip:      (extScripts.length + extStyles.length) <= 15 ? 'OK — număr rezonabil de resurse' :
                'Prea multe resurse externe — poate încetini încărcarea paginii',
    });

    // 27. Deprecated HTML tags
    const deprecatedTags = ['font', 'center', 'marquee', 'blink', 'big', 'strike', 'tt'];
    const foundDeprecated = deprecatedTags.filter(t => doc.querySelector(t));
    checks.push({
      category: 'Performanță',
      item:     'Tag-uri HTML depreciate',
      value:    foundDeprecated.length > 0 ? foundDeprecated.join(', ') : 'Niciunul',
      status:   foundDeprecated.length === 0 ? 'pass' : 'warn',
      tip:      foundDeprecated.length === 0 ? 'OK — fără tag-uri depreciate' :
                'Tag-uri depreciate: ' + foundDeprecated.join(', ') + ' — înlocuiește cu CSS',
    });

    // 28. URL structure
    const urlClean = !/[?&].*[?&]/.test(pageUrl.href) && !/[\s%20]/.test(pageUrl.pathname);
    checks.push({
      category: 'URL',
      item:     'Structură URL',
      value:    truncate(pageUrl.href, 70),
      status:   urlClean ? 'pass' : 'warn',
      tip:      urlClean ? 'OK — URL curat' : 'URL-ul conține parametri multipli sau spații',
    });

    // ─── Collect all meta tags for inventory ───────────────────────────────

    const metaTags = [];
    doc.querySelectorAll('meta').forEach(m => {
      const name     = m.getAttribute('name') || m.getAttribute('property') || m.getAttribute('http-equiv') || '';
      const content  = m.getAttribute('content') || m.getAttribute('charset') || '';
      if (name || content) {
        metaTags.push({ name: name || '(charset)', content: content, type: m.getAttribute('property') ? 'OG/property' : m.getAttribute('name') ? 'name' : 'http-equiv' });
      }
    });

    // ─── Collect link analysis data ────────────────────────────────────────

    const allLinks   = doc.querySelectorAll('a[href]');
    const origin     = pageUrl.origin;
    const internal   = [];
    const external   = [];
    const nofollow   = [];
    const emptyAnchors = [];

    allLinks.forEach(a => {
      const href = a.getAttribute('href') || '';
      const text = (a.textContent || '').trim();
      const rel  = (a.getAttribute('rel') || '').toLowerCase();

      if (!text && !a.querySelector('img')) emptyAnchors.push(href);
      if (rel.includes('nofollow')) nofollow.push(href);

      try {
        const url = new URL(href, origin);
        if (url.origin === origin) {
          internal.push(href);
        } else if (href.startsWith('http')) {
          external.push({ href, text: truncate(text, 40) });
        }
      } catch (_) {
        if (href.startsWith('/') || href.startsWith('#')) internal.push(href);
      }
    });

    const links = { total: allLinks.length, internal, external, nofollow, emptyAnchors };

    // Links checks
    checks.push({
      category: 'Link-uri',
      item:     'Total link-uri',
      value:    allLinks.length + ' (' + internal.length + ' interne, ' + external.length + ' externe)',
      status:   allLinks.length > 0 ? 'pass' : 'warn',
      tip:      'Link-urile interne ajută crawlerii să descopere paginile site-ului',
    });

    if (emptyAnchors.length > 0) {
      checks.push({
        category: 'Link-uri',
        item:     'Ancore goale',
        value:    emptyAnchors.length + ' link-uri fără text',
        status:   emptyAnchors.length <= 2 ? 'warn' : 'fail',
        tip:      'Adaugă text descriptiv pe link-uri — ajută crawlerii și accesibilitatea',
      });
    }

    if (nofollow.length > 0) {
      checks.push({
        category: 'Link-uri',
        item:     'Link-uri nofollow',
        value:    nofollow.length + ' link-uri',
        status:   'info',
        tip:      'Link-urile nofollow nu transmit PageRank',
      });
    }

    // Calculate score
    const weights = { pass: 1, warn: 0.5, info: 0.5, fail: 0 };
    const scorable = checks.filter(c => c.status !== 'info');
    const score = scorable.length > 0
      ? Math.round((scorable.reduce((sum, c) => sum + (weights[c.status] || 0), 0) / scorable.length) * 100)
      : 0;

    return {
      checks,
      score,
      metaTags,
      links,
      scannedUrl: pageUrl.href,
      keywords,
      socialPreview,
      schemaTypes: Array.from(new Set(ldTypes)),
    };
  }

  // ─── Render results ──────────────────────────────────────────────────────────

  function renderResults(area, results) {
    const STATUS_STYLE = {
      pass: { bg: 'var(--fme-success, #10b981)', text: '✓ OK',       color: '#fff' },
      warn: { bg: 'var(--fme-warn, #f39c12)',    text: '⚠ Atenție', color: '#fff' },
      fail: { bg: 'var(--fme-error, #e74c3c)',   text: '✕ Problema', color: '#fff' },
      info: { bg: 'var(--fme-accent, #3498db)',  text: 'ℹ Info',    color: '#fff' },
    };

    // Score badge
    const scoreColor = results.score >= 80
      ? 'var(--fme-success, #10b981)'
      : results.score >= 50
        ? 'var(--fme-warn, #f39c12)'
        : 'var(--fme-error, #e74c3c)';
    let html = '<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;padding:10px;' +
      'background:var(--fme-card, #f9f9fb);border:1px solid var(--fme-border, #e0e0e0);border-radius:6px;color:var(--fme-text, #333);">' +
      '<div style="text-align:center;">' +
        '<div style="font-size:32px;font-weight:bold;color:' + scoreColor + ';">' + results.score + '</div>' +
        '<div style="font-size:10px;color:var(--fme-muted, #888);text-transform:uppercase;letter-spacing:0.05em;">Scor SEO</div>' +
      '</div>' +
      '<div style="flex:1;">' +
        '<div style="font-size:11px;color:var(--fme-muted, #555);">' +
          '<strong style="color:' + scoreColor + ';">' +
            (results.score >= 80 ? 'Bine!' : results.score >= 50 ? 'Acceptabil' : 'Necesită îmbunătățiri') +
          '</strong> — ' + results.checks.filter(c => c.status === 'pass').length + ' OK, ' +
          results.checks.filter(c => c.status === 'warn').length + ' atenționări, ' +
          results.checks.filter(c => c.status === 'fail').length + ' probleme din ' +
          results.checks.length + ' verificări.' +
        '</div>' +
        '<div style="margin-top:6px;font-size:11px;color:var(--fme-muted, #666);">URL scanat: <code style="color:var(--fme-text, #333);">' + esc(results.scannedUrl || '') + '</code></div>' +
      '</div>' +
    '</div>';

    // Group by category
    const groups = [];
    let current = null;
    results.checks.forEach(c => {
      if (!current || current.name !== c.category) {
        current = { name: c.category, items: [] };
        groups.push(current);
      }
      current.items.push(c);
    });

    for (const g of groups) {
      html += '<table class="table1 forumline" cellspacing="1" style="margin-bottom:8px;">' +
        '<thead><tr>' +
          '<th class="thbg" colspan="4" style="text-align:left;"><i class="fa fa-folder-o"></i> ' + esc(g.name) + '</th>' +
        '</tr><tr>' +
          '<th class="thbg" style="width:160px;">Verificare</th>' +
          '<th class="thbg">Valoare</th>' +
          '<th class="thbg" style="width:90px;">Status</th>' +
          '<th class="thbg">Recomandare</th>' +
        '</tr></thead><tbody>';

      g.items.forEach((c, i) => {
        const s = STATUS_STYLE[c.status] || STATUS_STYLE.info;
        const rowClass = i % 2 === 0 ? 'row1' : 'row2';
        html += '<tr>' +
          '<td class="' + rowClass + '" style="font-weight:600;">' + esc(c.item) + '</td>' +
          '<td class="' + rowClass + '" style="font-size:11px;word-break:break-all;">' + esc(c.value) + '</td>' +
          '<td class="' + rowClass + '" style="text-align:center;">' +
            '<span style="background:' + s.bg + ';color:' + s.color +
              ';padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600;white-space:nowrap;">' +
              s.text + '</span>' +
          '</td>' +
          '<td class="' + rowClass + '" style="font-size:11px;color:var(--fme-muted, #555);">' + esc(c.tip) + '</td>' +
        '</tr>';
      });

      html += '</tbody></table>';
    }

    area.innerHTML = html;
  }

  // ─── Meta tags inventory ──────────────────────────────────────────────────────

  function renderMetaTagsInventory(area, metaTags) {
    if (metaTags.length === 0) {
      area.innerHTML = '<p style="color:var(--fme-muted, #888);">Nu s-au găsit meta tags pe pagina de index.</p>';
      return;
    }

    // Group by type
    const byType = {};
    metaTags.forEach(m => {
      const t = m.type || 'other';
      if (!byType[t]) byType[t] = [];
      byType[t].push(m);
    });

    const TYPE_LABELS = {
      'name':        '🏷️ Meta name',
      'OG/property': '📱 Open Graph / property',
      'http-equiv':  '⚙ HTTP-equiv',
      'other':       'Altele',
    };

    let html = '<div style="margin-bottom:8px;font-size:11px;color:var(--fme-muted, #888);">' +
      'Total: <strong>' + metaTags.length + '</strong> meta tags detectate pe pagina de index.' +
    '</div>';

    for (const [type, tags] of Object.entries(byType)) {
      html += '<table class="table1 forumline" cellspacing="1" style="margin-bottom:8px;">' +
        '<thead><tr><th class="thbg" colspan="3" style="text-align:left;">' +
          (TYPE_LABELS[type] || type) + ' (' + tags.length + ')</th></tr>' +
        '<tr><th class="thbg" style="width:200px;">Nume / Property</th>' +
          '<th class="thbg">Conținut</th>' +
          '<th class="thbg" style="width:80px;">Status</th></tr></thead><tbody>';

      const important = ['description', 'keywords', 'viewport', 'robots', 'og:title', 'og:description', 'og:image', 'twitter:card'];

      tags.forEach((m, i) => {
        const rowClass = i % 2 === 0 ? 'row1' : 'row2';
        const isImportant = important.some(k => m.name.toLowerCase().includes(k));
        const statusBg = isImportant ? 'var(--fme-success, #10b981)' : 'var(--fme-accent, #3498db)';
        const statusLabel = isImportant ? 'Important' : 'Info';
        html += '<tr>' +
          '<td class="' + rowClass + '" style="font-weight:600;font-family:monospace;font-size:11px;">' + esc(m.name) + '</td>' +
          '<td class="' + rowClass + '" style="font-size:11px;word-break:break-all;">' + esc(truncate(m.content, 120)) + '</td>' +
          '<td class="' + rowClass + '" style="text-align:center;">' +
            '<span style="background:' + statusBg + ';color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:600;">' +
              statusLabel + '</span></td></tr>';
      });

      html += '</tbody></table>';
    }

    // Essential meta tags checklist
    const essential = [
      { tag: 'description',      label: 'Meta Description',    rec: 'Descrie pagina în 50–160 caractere' },
      { tag: 'viewport',         label: 'Viewport',            rec: 'width=device-width, initial-scale=1' },
      { tag: 'robots',           label: 'Meta Robots',         rec: 'Controlează indexarea (index/noindex, follow/nofollow)' },
      { tag: 'og:title',         label: 'OG Title',            rec: 'Titlul afișat la share pe Facebook/LinkedIn' },
      { tag: 'og:description',   label: 'OG Description',      rec: 'Descrierea pentru share-uri sociale' },
      { tag: 'og:image',         label: 'OG Image',            rec: 'Imagine pentru share-uri (1200×630px recomandat)' },
      { tag: 'og:url',           label: 'OG URL',              rec: 'URL-ul canonic al paginii' },
      { tag: 'twitter:card',     label: 'Twitter Card',        rec: 'Tip card: summary, summary_large_image' },
      { tag: 'twitter:title',    label: 'Twitter Title',       rec: 'Titlul afișat pe Twitter/X' },
      { tag: 'twitter:description', label: 'Twitter Description', rec: 'Descrierea pe Twitter/X' },
      { tag: 'author',           label: 'Author',              rec: 'Autorul sau organizația paginii' },
      { tag: 'theme-color',      label: 'Theme Color',         rec: 'Culoarea barei de adresă pe mobile' },
    ];

    html += '<h4 style="margin:12px 0 6px;font-size:12px;color:var(--fme-text, #333);">📋 Checklist meta tags esențiale</h4>';
    html += '<table class="table1 forumline" cellspacing="1">' +
      '<thead><tr><th class="thbg" style="width:40px;">✓</th>' +
        '<th class="thbg" style="width:180px;">Meta Tag</th>' +
        '<th class="thbg">Recomandare</th></tr></thead><tbody>';

    essential.forEach((e, i) => {
      const found = metaTags.some(m => m.name.toLowerCase().includes(e.tag.toLowerCase()));
      const rowClass = i % 2 === 0 ? 'row1' : 'row2';
      html += '<tr>' +
        '<td class="' + rowClass + '" style="text-align:center;font-size:16px;">' +
          (found ? '<span style="color:var(--fme-success, #10b981);">✓</span>' : '<span style="color:var(--fme-error, #e74c3c);">✗</span>') + '</td>' +
        '<td class="' + rowClass + '" style="font-weight:600;">' + esc(e.label) + '</td>' +
        '<td class="' + rowClass + '" style="font-size:11px;color:var(--fme-muted, #555);">' + esc(e.rec) + '</td></tr>';
    });

    html += '</tbody></table>';

    area.innerHTML = html;
  }

  // ─── Links analysis ───────────────────────────────────────────────────────────

  function renderLinksAnalysis(area, links) {
    let html = '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;padding:10px;' +
      'background:var(--fme-card, #f9f9fb);border:1px solid var(--fme-border, #e0e0e0);border-radius:6px;color:var(--fme-text, #333);">' +
      '<div style="text-align:center;min-width:80px;">' +
        '<div style="font-size:24px;font-weight:bold;color:var(--fme-accent, #3498db);">' + links.total + '</div>' +
        '<div style="font-size:10px;color:var(--fme-muted, #888);">Total</div></div>' +
      '<div style="text-align:center;min-width:80px;">' +
        '<div style="font-size:24px;font-weight:bold;color:var(--fme-success, #10b981);">' + links.internal.length + '</div>' +
        '<div style="font-size:10px;color:var(--fme-muted, #888);">Interne</div></div>' +
      '<div style="text-align:center;min-width:80px;">' +
        '<div style="font-size:24px;font-weight:bold;color:var(--fme-warn, #e8703a);">' + links.external.length + '</div>' +
        '<div style="font-size:10px;color:var(--fme-muted, #888);">Externe</div></div>' +
      '<div style="text-align:center;min-width:80px;">' +
        '<div style="font-size:24px;font-weight:bold;color:var(--fme-error, #e74c3c);">' + links.emptyAnchors.length + '</div>' +
        '<div style="font-size:10px;color:var(--fme-muted, #888);">Fără text</div></div>' +
      '<div style="text-align:center;min-width:80px;">' +
        '<div style="font-size:24px;font-weight:bold;color:var(--fme-muted, #999);">' + links.nofollow.length + '</div>' +
        '<div style="font-size:10px;color:var(--fme-muted, #888);">Nofollow</div></div>' +
    '</div>';

    // External links table
    if (links.external.length > 0) {
      html += '<h4 style="margin:8px 0 4px;font-size:12px;">🔗 Link-uri externe (' + links.external.length + ')</h4>';
      html += '<table class="table1 forumline" cellspacing="1" style="margin-bottom:8px;">' +
        '<thead><tr><th class="thbg">URL</th><th class="thbg" style="width:200px;">Text ancoră</th></tr></thead><tbody>';

      links.external.slice(0, 30).forEach((l, i) => {
        const rowClass = i % 2 === 0 ? 'row1' : 'row2';
        html += '<tr>' +
          '<td class="' + rowClass + '" style="font-size:11px;word-break:break-all;">' + esc(l.href) + '</td>' +
          '<td class="' + rowClass + '" style="font-size:11px;">' + (l.text ? esc(l.text) : '<em style="color:var(--fme-muted, #ccc);">gol</em>') + '</td></tr>';
      });
      if (links.external.length > 30) {
        html += '<tr><td class="row1" colspan="2" style="color:var(--fme-muted, #888);text-align:center;">…și încă ' +
          (links.external.length - 30) + ' link-uri</td></tr>';
      }
      html += '</tbody></table>';
    }

    if (links.emptyAnchors.length > 0) {
      html += '<div class="fme-alert fme-alert-warning" style="margin-top:8px;">' +
        '<strong>⚠ ' + links.emptyAnchors.length + ' link-uri fără text ancoră</strong><br>' +
        '<span style="font-size:11px;">Link-urile fără text sunt greu de indexat. Adaugă text descriptiv sau aria-label.</span></div>';
    }

    area.innerHTML = html;
  }

  function renderPreview(area, results) {
    const preview = results.socialPreview || {};
    const keywords = Array.isArray(results.keywords) ? results.keywords : [];
    const schemaTypes = Array.isArray(results.schemaTypes) ? results.schemaTypes : [];
    const missing = [];

    if (!preview.title) missing.push('og:title');
    if (!preview.description) missing.push('og:description');
    if (!preview.image) missing.push('og:image');
    if (!preview.twitterCard) missing.push('twitter:card');

    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px;align-items:start;">';

    html += '<div style="background:var(--fme-card, #fff);border:1px solid var(--fme-border, #e0e0e0);border-radius:8px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">';
    if (preview.image) {
      html += '<div style="aspect-ratio:1.91/1;background:#eef3f8;overflow:hidden;">' +
        '<img src="' + escAttr(preview.image) + '" alt="OG preview" style="display:block;width:100%;height:100%;object-fit:cover;" />' +
      '</div>';
    } else {
      html += '<div style="aspect-ratio:1.91/1;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, var(--fme-card, #f7f9fc), var(--fme-surface, #fff));color:var(--fme-muted, #888);font-size:12px;">Fără imagine Open Graph</div>';
    }
    html += '<div style="padding:12px;">' +
      '<div style="font-size:11px;color:var(--fme-muted, #888);margin-bottom:4px;">Preview social</div>' +
      '<div style="font-size:16px;font-weight:700;line-height:1.35;color:var(--fme-text, #222);">' + esc(preview.title || 'Titlul va apărea aici') + '</div>' +
      '<div style="margin-top:6px;font-size:12px;line-height:1.55;color:var(--fme-muted, #555);">' + esc(preview.description || 'Descrierea OG / meta description lipsește sau este goală.') + '</div>' +
      '<div style="margin-top:8px;font-size:11px;color:var(--fme-accent, #3498db);word-break:break-all;">' + esc(preview.url || results.scannedUrl || '') + '</div>' +
    '</div></div>';

    html += '<div style="display:grid;gap:10px;">';
    html += '<div style="padding:10px 12px;background:var(--fme-card, #fff);border:1px solid var(--fme-border, #e0e0e0);border-radius:6px;">' +
      '<div style="font-size:12px;font-weight:700;color:var(--fme-text, #333);margin-bottom:8px;">🔎 Top cuvinte cheie</div>' +
      (keywords.length
        ? keywords.map(k => '<span style="display:inline-flex;align-items:center;gap:6px;margin:0 6px 6px 0;padding:4px 8px;border-radius:999px;background:var(--fme-surface, #f3f6fb);border:1px solid var(--fme-border, #dce3ef);font-size:11px;color:var(--fme-text, #333);">' + esc(k.word) + ' <strong style="color:var(--fme-accent, #3498db);">' + k.count + '</strong></span>').join('')
        : '<span style="font-size:11px;color:var(--fme-muted, #888);">Nu s-au extras suficiente cuvinte relevante.</span>') +
    '</div>';

    html += '<div style="padding:10px 12px;background:var(--fme-card, #fff);border:1px solid var(--fme-border, #e0e0e0);border-radius:6px;">' +
      '<div style="font-size:12px;font-weight:700;color:var(--fme-text, #333);margin-bottom:8px;">📌 Semnale rapide</div>' +
      '<ul style="margin:0;padding-left:18px;font-size:11px;line-height:1.75;color:var(--fme-text, #444);">' +
        '<li><strong>Canonical / URL:</strong> ' + esc(preview.url || results.scannedUrl || '—') + '</li>' +
        '<li><strong>Twitter card:</strong> ' + esc(preview.twitterCard || 'Lipsește') + '</li>' +
        '<li><strong>Schema detectată:</strong> ' + esc(schemaTypes.length ? schemaTypes.join(', ') : 'Niciun tip detectat') + '</li>' +
        '<li><strong>Tag-uri lipsă:</strong> ' + esc(missing.length ? missing.join(', ') : 'Nimic critic pentru share preview') + '</li>' +
      '</ul>' +
    '</div>';

    html += '</div></div>';
    area.innerHTML = html;
  }

  // ─── Recommendations ─────────────────────────────────────────────────────────

  function renderRecommendations(area, results) {
    const fails = results.checks.filter(c => c.status === 'fail');
    const warns = results.checks.filter(c => c.status === 'warn');

    // SEO guide sections
    const guides = [
      {
        icon: '📝', title: 'Optimizare On-Page',
        items: [
          'Scrie un <strong>Title</strong> unic de 50–60 caractere pentru fiecare pagină',
          'Adaugă <strong>Meta Description</strong> de 120–160 caractere — fii descriptiv și convingător',
          'Folosește un singur <strong>H1</strong> pe pagină, clar și relevant',
          'Structurează conținutul cu <strong>H2–H3</strong> ierarhic',
          'Adaugă <strong>alt text</strong> descriptiv pe toate imaginile',
          'Menține URL-uri scurte, curate și descriptive',
        ]
      },
      {
        icon: '📱', title: 'Open Graph & Social Media',
        items: [
          'Setează <strong>og:title</strong>, <strong>og:description</strong>, <strong>og:image</strong> pentru share-uri frumoase pe Facebook',
          'Imagine OG recomandată: <strong>1200×630 px</strong> (raport 1.91:1)',
          'Adaugă <strong>twitter:card</strong> = "summary_large_image" pentru Twitter/X',
          'Verifică cum arată share-urile cu <a href="https://developers.facebook.com/tools/debug/" target="_blank" style="color:var(--fme-accent, #3498db);">Facebook Debugger</a>',
        ]
      },
      {
        icon: '🕷️', title: 'Crawling & Indexare',
        items: [
          'Menține un <strong>robots.txt</strong> valid — nu bloca pagini importante cu Disallow',
          'Generează un <strong>sitemap.xml</strong> și menționează-l în robots.txt',
          'Adaugă <strong>link canonical</strong> pe fiecare pagină pentru a evita duplicate content',
          'Verifică regulat dacă paginile sunt indexate cu <code>site:domeniul-tau.com</code> în Google',
          'Trimite sitemap-ul în <a href="https://search.google.com/search-console" target="_blank" style="color:var(--fme-accent, #3498db);">Google Search Console</a>',
        ]
      },
      {
        icon: '⚡', title: 'Performanță & Core Web Vitals',
        items: [
          'Minimizează numărul de <strong>resurse externe</strong> (JS/CSS)',
          'Specifică <strong>width/height</strong> pe imagini pentru a evita Cumulative Layout Shift (CLS)',
          'Evită iframe-urile inutile — încetinesc încărcarea',
          'Mută stilurile inline în fișiere CSS externe pentru caching mai bun',
          'Testează performanța cu <a href="https://pagespeed.web.dev/" target="_blank" style="color:var(--fme-accent, #3498db);">PageSpeed Insights</a>',
        ]
      },
      {
        icon: '🔒', title: 'Securitate',
        items: [
          'Folosește <strong>HTTPS</strong> obligatoriu — Google penalizează site-urile HTTP',
          'Evită <strong>mixed content</strong> (resurse HTTP pe pagini HTTPS)',
          'Adaugă header-ul <strong>X-Content-Type-Options: nosniff</strong>',
        ]
      },
      {
        icon: '📊', title: 'Date Structurate (Schema.org)',
        items: [
          'Adaugă <strong>JSON-LD</strong> cu tipul WebSite / Organization pe pagina de index',
          'Folosește <strong>BreadcrumbList</strong> pentru navigare (ajută la sitelinks în Google)',
          'Pentru forumuri: adaugă <strong>DiscussionForumPosting</strong> pe topic-uri',
          'Testează cu <a href="https://search.google.com/test/rich-results" target="_blank" style="color:var(--fme-accent, #3498db);">Rich Results Test</a>',
        ]
      },
      {
        icon: '📋', title: 'Meta Tags Recomandate (copiere rapidă)',
        items: [
          '<code>&lt;meta name="description" content="Descrierea forumului tau..."&gt;</code>',
          '<code>&lt;meta name="robots" content="index, follow"&gt;</code>',
          '<code>&lt;meta property="og:type" content="website"&gt;</code>',
          '<code>&lt;meta property="og:title" content="Titlul forumului"&gt;</code>',
          '<code>&lt;meta property="og:description" content="Descrierea forumului"&gt;</code>',
          '<code>&lt;meta property="og:image" content="https://domeniu/imagine.jpg"&gt;</code>',
          '<code>&lt;meta name="twitter:card" content="summary_large_image"&gt;</code>',
          '<code>&lt;meta name="theme-color" content="#hex-culoare"&gt;</code>',
        ]
      }
    ];

    let html = '';

    // Priority fixes
    if (fails.length > 0) {
      html += '<div class="fme-alert fme-alert-error" style="margin-bottom:10px;">' +
        '<strong>🔴 Probleme critice (' + fails.length + '):</strong><ul style="margin:4px 0 0 16px;padding:0;">';
      fails.forEach(f => {
        html += '<li style="margin:2px 0;"><strong>' + esc(f.item) + '</strong> — ' + esc(f.tip) + '</li>';
      });
      html += '</ul></div>';
    }

    if (warns.length > 0) {
      html += '<div class="fme-alert fme-alert-warning" style="margin-bottom:10px;">' +
        '<strong>🟡 Atenționări (' + warns.length + '):</strong><ul style="margin:4px 0 0 16px;padding:0;">';
      warns.forEach(w => {
        html += '<li style="margin:2px 0;"><strong>' + esc(w.item) + '</strong> — ' + esc(w.tip) + '</li>';
      });
      html += '</ul></div>';
    }

    // Guide sections
    guides.forEach(g => {
      html += '<fieldset style="margin:0 0 10px;padding:8px 12px;border:1px solid var(--fme-border, #e0e0e0);border-radius:4px;background:var(--fme-card, #fff);color:var(--fme-text, #333);">' +
        '<legend style="font-weight:600;font-size:12px;color:var(--fme-accent, #3498db);">' + g.icon + ' ' + g.title + '</legend>' +
        '<ul style="margin:4px 0;padding:0 0 0 18px;font-size:11px;line-height:1.8;color:var(--fme-text, #444);">';
      g.items.forEach(item => { html += '<li>' + item + '</li>'; });
      html += '</ul></fieldset>';
    });

    // Useful tools
    html += '<fieldset style="margin:0 0 10px;padding:8px 12px;border:1px solid var(--fme-border, #e0e0e0);border-radius:4px;background:var(--fme-card, #fff);color:var(--fme-text, #333);">' +
      '<legend style="font-weight:600;font-size:12px;color:var(--fme-accent, #3498db);">🔧 Instrumente utile</legend>' +
      '<table style="width:100%;font-size:11px;border-collapse:collapse;">' +
      [
        ['Google Search Console', 'https://search.google.com/search-console', 'Monitorizare indexare, erori, query-uri'],
        ['PageSpeed Insights', 'https://pagespeed.web.dev/', 'Testare performanță și Core Web Vitals'],
        ['Rich Results Test', 'https://search.google.com/test/rich-results', 'Validare date structurate'],
        ['Facebook Sharing Debugger', 'https://developers.facebook.com/tools/debug/', 'Verificare Open Graph tags'],
        ['Mobile-Friendly Test', 'https://search.google.com/test/mobile-friendly', 'Testare compatibilitate mobil'],
        ['Bing Webmaster Tools', 'https://www.bing.com/webmasters/', 'Monitorizare Bing + importă date din GSC'],
      ].map((r, i) =>
        '<tr style="border-bottom:1px solid var(--fme-border, #eee);">' +
          '<td style="padding:4px 8px 4px 0;font-weight:600;">' +
            '<a href="' + r[1] + '" target="_blank" style="color:var(--fme-accent, #3498db);">' + r[0] + '</a></td>' +
          '<td style="padding:4px 0;color:var(--fme-muted, #666);">' + r[2] + '</td></tr>'
      ).join('') +
      '</table></fieldset>';

    area.innerHTML = html;
  }

  // ─── Fetch helpers ────────────────────────────────────────────────────────────

  async function fetchPage(url) {
    const res = await fetch(url, { credentials: 'include', redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' pentru ' + url);
    return await res.text();
  }

  async function fetchText(url) {
    try {
      const res = await fetch(url, { credentials: 'include', redirect: 'follow' });
      if (!res.ok) return '';
      return await res.text();
    } catch (_) { return ''; }
  }

  function extractSitemapUrl(robotsTxt) {
    if (!robotsTxt) return null;
    const m = robotsTxt.match(/^Sitemap:\s*(.+)/im);
    return m ? m[1].trim() : null;
  }

  function normalizeScanUrl(rawUrl) {
    const fallback = window.location.origin + '/';

    try {
      const url = new URL(String(rawUrl || '').trim() || fallback, fallback);
      if (url.origin !== window.location.origin) {
        throw new Error('Poți scana doar URL-uri din același forum/domeniu.');
      }
      return url.href;
    } catch (_) {
      throw new Error('Introdu un URL valid din forumul tău.');
    }
  }

  async function copySummary(wrapper) {
    if (!_results) return;

    const btn = wrapper.querySelector('#fme-seo-copy');
    const status = wrapper.querySelector('#fme-seo-status');
    const initial = btn.value;

    try {
      await navigator.clipboard.writeText(buildPlainSummary(_results));
      btn.value = '✅ Copiat';
      status.textContent = 'Rezumatul SEO a fost copiat în clipboard.';
      status.style.color = 'var(--fme-success, #10b981)';
    } catch (err) {
      status.textContent = 'Copiere eșuată: ' + err.message;
      status.style.color = 'var(--fme-error, #e74c3c)';
    }

    window.setTimeout(() => { btn.value = initial; }, 1400);
  }

  function exportReport() {
    if (!_results) return;

    const host = (() => {
      try { return new URL(_results.scannedUrl).hostname.replace(/[^a-z0-9.-]+/gi, '-'); }
      catch (_) { return 'forum'; }
    })();

    const report = {
      scannedAt: new Date().toISOString(),
      scannedUrl: _results.scannedUrl,
      score: _results.score,
      summary: {
        pass: _results.checks.filter(c => c.status === 'pass').length,
        warn: _results.checks.filter(c => c.status === 'warn').length,
        fail: _results.checks.filter(c => c.status === 'fail').length,
        info: _results.checks.filter(c => c.status === 'info').length,
      },
      keywords: _results.keywords,
      socialPreview: _results.socialPreview,
      schemaTypes: _results.schemaTypes,
      checks: _results.checks,
      metaTags: _results.metaTags,
      links: {
        total: _results.links.total,
        internalCount: _results.links.internal.length,
        externalCount: _results.links.external.length,
        nofollowCount: _results.links.nofollow.length,
        emptyAnchorCount: _results.links.emptyAnchors.length,
        sampleExternal: _results.links.external.slice(0, 20),
      },
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fme-seo-report-${host}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function buildPlainSummary(results) {
    const pass = results.checks.filter(c => c.status === 'pass').length;
    const warn = results.checks.filter(c => c.status === 'warn').length;
    const fail = results.checks.filter(c => c.status === 'fail').length;
    const critical = results.checks.filter(c => c.status === 'fail').slice(0, 6);
    const warnings = results.checks.filter(c => c.status === 'warn').slice(0, 6);

    return [
      'FME SEO Report',
      'URL: ' + (results.scannedUrl || '—'),
      'Scor SEO: ' + results.score + '/100',
      'OK: ' + pass + ' | Atenționări: ' + warn + ' | Probleme: ' + fail,
      '',
      critical.length ? 'Probleme critice:' : 'Atenționări principale:',
      ...(critical.length ? critical : warnings).map(item => '- ' + item.item + ': ' + item.tip),
    ].join('\n');
  }

  function extractTopKeywords(text) {
    const stopwords = new Set([
      'si', 'sau', 'sunt', 'este', 'pentru', 'care', 'din', 'ale', 'iar', 'fara', 'foarte', 'mai', 'prin', 'aceasta', 'acest',
      'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'forum', 'page', 'http', 'https', 'www', 'com'
    ]);

    const counts = Object.create(null);
    String(text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 4 && !stopwords.has(word) && !/^\d+$/.test(word))
      .forEach(word => { counts[word] = (counts[word] || 0) + 1; });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));
  }

  function extractSocialPreview(doc, fallbackTitle, fallbackDescription, canonicalUrl, scannedUrl) {
    const pickMeta = (selector) => {
      const node = doc.querySelector(selector);
      return node ? (node.getAttribute('content') || '').trim() : '';
    };

    return {
      title: pickMeta('meta[property="og:title"]') || pickMeta('meta[name="twitter:title"]') || fallbackTitle || '',
      description: pickMeta('meta[property="og:description"]') || pickMeta('meta[name="twitter:description"]') || fallbackDescription || '',
      image: pickMeta('meta[property="og:image"]') || pickMeta('meta[name="twitter:image"]') || '',
      url: pickMeta('meta[property="og:url"]') || canonicalUrl || scannedUrl || '',
      twitterCard: pickMeta('meta[name="twitter:card"]') || '',
    };
  }

  function truncate(str, max) {
    str = String(str || '').trim();
    return str.length > max ? str.substring(0, max) + '…' : str;
  }

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(str) {
    return esc(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { render };
})();
