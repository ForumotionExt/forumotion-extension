'use strict';

/**
 * @file selector-picker.js
 * @description Picker de selectori CSS — FM ACP oficial + FME proprietari.
 *
 * Features:
 *  - Tab-uri pe categorii cu separator vizual FM / FME
 *  - Search full-text (selector + label) cu highlight
 *  - Props sugestii din CSS-ul original afișate ca badge-uri
 *  - Click → callback cu { selector, label, props, category }
 *
 * Usage:
 *   import { createSelectorPicker } from '../shared/selector-picker.js';
 *   const picker = createSelectorPicker({ onSelect: ({ selector, props }) => ... });
 *   mount.appendChild(picker.el);
 */

import { FM_SELECTORS, ALL_CATEGORIES, getAllSelectors, CATEGORY_GROUPS } from './fm.selectors.js';
import Utils from './utils.js';

export function createSelectorPicker({ onSelect, t = (k, d) => d } = {}) {
  let activeCategory = ALL_CATEGORIES[0];
  let searchQuery    = '';

  const el = document.createElement('div');

  const render = () => {
    const allItems = getAllSelectors();
    const isSearch = !!searchQuery;

    const filtered = isSearch
      ? allItems.filter(e =>
          e.selector.toLowerCase().includes(searchQuery) ||
          e.label.toLowerCase().includes(searchQuery)    ||
          e.category.toLowerCase().includes(searchQuery)
        )
      : (FM_SELECTORS[activeCategory] ?? []).map(e => ({ ...e, category: activeCategory }));

    const tabGroups = Object.entries(CATEGORY_GROUPS).map(([groupName, cats]) => {
      const isFME  = groupName === 'FME Extension';
      const color  = isFME ? '#9b59b6' : '#369fcf';
      const gLabel = isFME ? 'FME' : 'FM';

      const tabs = cats.map(cat => {
        const isActive = !isSearch && cat === activeCategory;
        const label    = cat.replace('FME — ', '');
        return /* html */`
          <button data-cat="${Utils.Str.escapeHTML(cat)}" title="${Utils.Str.escapeHTML(cat)}"
                  style="flex-shrink:0;padding:4px 8px;border:none;cursor:pointer;
                         font-size:0.78em;white-space:nowrap;max-width:100px;
                         overflow:hidden;text-overflow:ellipsis;
                         background:${isActive ? '#fff' : 'transparent'};
                         color:${isActive ? color : '#666'};
                         border-bottom:2px solid ${isActive ? color : 'transparent'};
                         font-weight:${isActive ? '600' : 'normal'};">
            ${Utils.Str.escapeHTML(label)}
          </button>`;
      }).join('');

      return /* html */`
        <div style="display:flex;align-items:stretch;flex-shrink:0;">
          <span style="font-size:0.7em;font-weight:700;padding:0 5px;color:${color};
                       letter-spacing:0.3px;background:#f6f8fa;display:flex;
                       align-items:center;border-right:1px solid #e1e4e8;
                       flex-shrink:0;">${gLabel}</span>
          ${tabs}
        </div>`;
    }).join('<span style="width:1px;background:#ddd;flex-shrink:0;"></span>');

    const itemsHtml = filtered.length
      ? filtered.map(entry => {
          const props = (entry.props ?? []).slice(0, 3);
          return /* html */`
            <div class="sp-item"
                 data-sel="${Utils.Str.escapeHTML(entry.selector)}"
                 data-lbl="${Utils.Str.escapeHTML(entry.label)}"
                 data-cat="${Utils.Str.escapeHTML(entry.category)}"
                 style="display:flex;align-items:flex-start;gap:6px;
                        padding:5px 10px;cursor:pointer;
                        border-bottom:1px solid #f3f3f3;">
              <div style="flex:1;min-width:0;">
                <code style="font-size:0.83em;color:#1a7fb5;display:block;
                             white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${_highlight(entry.selector, searchQuery)}
                </code>
                <div style="display:flex;align-items:center;gap:3px;margin-top:1px;flex-wrap:wrap;">
                  <small style="color:#888;font-size:0.8em;">
                    ${isSearch
                      ? `<span style="color:#bbb;">[${Utils.Str.escapeHTML(entry.category.replace('FME — ', ''))}]&nbsp;</span>`
                      : ''}
                    ${_highlight(entry.label, searchQuery)}
                  </small>
                  ${props.map(p => `
                    <span style="font-size:0.7em;background:#eef2f7;color:#6888a4;
                                 padding:0 3px;border-radius:2px;white-space:nowrap;">
                      ${Utils.Str.escapeHTML(p)}
                    </span>`).join('')}
                </div>
              </div>
              <i class="fa fa-plus-circle"
                 style="color:#27ae60;flex-shrink:0;opacity:0.4;
                        font-size:0.95em;margin-top:3px;"></i>
            </div>`;
        }).join('')
      : `<div style="padding:20px;text-align:center;color:#bbb;">
           <i class="fa fa-search"></i>&nbsp;
           ${isSearch
             ? `Niciun selector pentru "<em>${Utils.Str.escapeHTML(searchQuery)}</em>"`
             : 'Nicio categorie selectată.'}
         </div>`;

    el.innerHTML = /* html */`
      <div style="border:1px solid #d0d7de;border-radius:4px;background:#fff;font-size:0.88em;">

        <!-- Search bar -->
        <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;
                    background:#f6f8fa;border-bottom:1px solid #e1e4e8;">
          <i class="fa fa-search" style="color:#aaa;flex-shrink:0;"></i>
          <input id="sp-search" type="text" value="${Utils.Str.escapeHTML(searchQuery)}"
                 placeholder="Caută selector sau descriere…"
                 style="flex:1;border:none;outline:none;background:transparent;font-size:0.92em;" />
          ${searchQuery ? `
            <a href="javascript:void(0)" id="sp-clear" style="color:#bbb;">
              <i class="fa fa-times"></i>
            </a>` : ''}
          <small style="color:#ccc;flex-shrink:0;">
            ${isSearch ? `${filtered.length} result.` : `${FM_SELECTORS[activeCategory]?.length ?? 0} sel.`}
          </small>
        </div>

        <!-- Tabs — ascunse în search mode -->
        ${!isSearch ? `
          <div style="display:flex;overflow-x:auto;border-bottom:2px solid #e8ebee;
                      background:#f6f8fa;scrollbar-width:none;">
            ${tabGroups}
          </div>` : `
          <div style="padding:2px 8px;background:#fffdf0;border-bottom:1px solid #ffe;
                      font-size:0.78em;color:#aaa;">
            <i class="fa fa-globe" style="color:#f1c40f;"></i>&nbsp;Căutare în toate categoriile
          </div>`}

        <!-- Lista selectori -->
        <div id="sp-list" style="max-height:230px;overflow-y:auto;">
          ${itemsHtml}
        </div>

      </div>
    `;

    el.querySelector('#sp-search')?.addEventListener('input', e => {
      searchQuery = e.target.value.trim().toLowerCase();
      render();
      el.querySelector('#sp-search')?.focus();
    });

    el.querySelector('#sp-clear')?.addEventListener('click', () => {
      searchQuery = '';
      render();
      el.querySelector('#sp-search')?.focus();
    });

    el.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCategory = btn.dataset.cat;
        searchQuery    = '';
        render();
      });
      btn.addEventListener('mouseenter', () => {
        if (btn.dataset.cat !== activeCategory) btn.style.background = '#eff2f5';
      });
      btn.addEventListener('mouseleave', () => {
        if (btn.dataset.cat !== activeCategory) btn.style.background = 'transparent';
      });
    });

    el.querySelectorAll('.sp-item').forEach(item => {
      const ico = item.querySelector('.fa-plus-circle');
      item.addEventListener('mouseenter', () => {
        item.style.background = '#f0f8ff';
        if (ico) ico.style.opacity = '1';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = '';
        if (ico) ico.style.opacity = '0.4';
      });
      item.addEventListener('click', () => {
        const entry = getAllSelectors().find(e => e.selector === item.dataset.sel);
        onSelect?.({
          selector: item.dataset.sel,
          label   : item.dataset.lbl,
          category: item.dataset.cat,
          props   : entry?.props ?? [],
        });
        item.style.background = '#e8f5e9';
        setTimeout(() => { item.style.background = ''; }, 400);
      });
    });
  };

  render();

  return {
    el,
    focus() { el.querySelector('#sp-search')?.focus(); },
    reset() { searchQuery = ''; activeCategory = ALL_CATEGORIES[0]; render(); },
  };
}

function _highlight(text, q) {
  if (!q) return Utils.Str.escapeHTML(text);
  const e  = Utils.Str.escapeHTML(text);
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return e.replace(re, '<mark style="background:#fff176;padding:0;border-radius:2px;">$1</mark>');
}