'use strict';

const CSS_KEY = 'fme_active_css';
const PREFIX  = 'fme-theme-';

function _inject(id, css) {
  let el = document.getElementById(PREFIX + id);
  if (!el) {
    el = document.createElement('style');
    el.id = PREFIX + id;
    el.setAttribute('data-fme', 'theme');
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function _remove(id) {
  document.getElementById(PREFIX + id)?.remove();
}

export function initThemeApply() {
  chrome.storage.local.get(CSS_KEY, (result) => {
    const entry = result[CSS_KEY];
    if (entry?.id && entry?.css) _inject(entry.id, entry.css);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(CSS_KEY in changes)) return;
    const { oldValue, newValue } = changes[CSS_KEY];
    if (oldValue?.id) _remove(oldValue.id);
    if (newValue?.id && newValue?.css) _inject(newValue.id, newValue.css);
  });
}
