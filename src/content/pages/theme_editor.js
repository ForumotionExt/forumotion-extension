'use strict';
import BasePage from './_base.js';
import Utils from '../shared/utils.js';
import { FM_SELECTORS, ALL_CATEGORIES, getAllSelectors } from '../shared/fm.selectors.js';
import { createSelectorPicker } from '../shared/selector-picker.js';
import { buildTab } from '../shared/adapter.js';

export default BasePage('theme_editor', async ({ Utils, FM, t, bus, params }) => {
  const D = FM.ACP_DOM.CONTENT, I = FM.ACP_DOM.ICONS;
  if(!params?.id)
    params.id = parseInt(Utils.UrlUtils.param('id'), 10) || null;
  let existingTheme = null;
  
  if (params?.id) {
    try {
      existingTheme = await bus.request('themes:get', { id: params.id });
    } catch { /* tema nu există — tratăm ca temă nouă */ }
  }

  const isEdit  = !!existingTheme;
  const pageTitle = isEdit
    ? `${t('themes.editor.edit', 'Edit Theme')}: ${existingTheme.name}`
    : t('themes.editor.new', 'New Theme');

  const buildVarRows = (variables = {}) =>
    Object.entries(variables).map(([k, v]) => _varRow(k, v)).join('');

  const buildOverrideRows = (overrides = {}) =>
    Object.entries(overrides).flatMap(([sel, props]) =>
      Object.entries(props).map(([prop, val]) => _overrideRow(sel, prop, val))
    ).join('');
  
  return {
    breadcrumbs: [
      { label: t('nav.acp_themes', 'ACP Themes'), url: 'acp_themes' },
      { label: pageTitle },
    ],

    description: t('themes.editor.description', 'Create or edit custom themes for your forum.'),

    html: /* html */`
      <table class="${D.TABLE}" cellspacing="0" cellpadding="0" width="90%">
        <tbody>
          <tr valign="top">
            <!-- Coloana stângă: form -->
            <td width="35%" valign="top" style="padding:0 0 10px;">
              ${Utils.DOM.fieldset(t('themes.editor.meta', 'General Info'), {}, /* html */`
                <table cellpadding="4" name="f-meta" cellspacing="0" width="100%">
                  <tr>
                    <td width="25%"><label for="f-name">${t('common.name', 'Name')} *</label></td>
                    <td>
                      <input type="text" id="f-name" name="f-name" class="inputtext" value="${Utils.Str.escapeHTML(existingTheme?.name ?? '')}" placeholder="${t('themes.editor.name_placeholder', 'My Theme')}" />
                    </td>
                  </tr>
                  <tr>
                    <td><label for="f-desc">${t('common.description', 'Description')}</label></td>
                    <td>
                      <textarea id="f-desc" class="inputtext" rows="5" cols="5" style="max-width:97%;resize:vertical;">${Utils.Str.escapeHTML(existingTheme?.description ?? '')}</textarea>
                    </td>
                  </tr>
                  <tr>
                    <td><label for="f-version">${t('common.version', 'Version')}</label></td>
                    <td>
                      <input type="text" id="f-version" class="inputtext" value="${Utils.Str.escapeHTML(existingTheme?.version ?? '1.0.0')}" />
                    </td>
                  </tr>
                  <tr>
                    <td><label for="f-author">${t('common.author', 'Author')}</label></td>
                    <td>
                      <input type="text" id="f-author" class="inputtext" value="${Utils.Str.escapeHTML(existingTheme?.author ?? '')}" />
                    </td>
                  </tr>
                  <tr>
                    <td><label for="f-tags">${t('themes.editor.tags', 'Tags')}</label></td>
                    <td>
                      <input type="text" id ="f-tags" class="inputtext" value="${Utils.Str.escapeHTML((existingTheme?.meta?.tags ?? []).join(', '))}" placeholder="${t('themes.editor.tags_hint', 'dark, minimal, phpBB3')}" />
                      <br />
                      <small class="${D.HELP_TEXT}">
                        ${t('themes.editor.tags_sep', 'Separate with commas')}
                      </small>
                    </td>
                  </tr>
                </table>
              `)}

              <!-- Secțiunea 2: CSS Variables -->
              ${Utils.DOM.fieldset(/* html */`
                <i class="fa fa-code"></i>&nbsp;${t('themes.editor.variables', 'CSS Variables')}
                <small class="${D.HELP_TEXT}" style="font-weight:normal;margin-left:8px;">
                  → injected in <code>:root {}</code>
                </small>`,
                {},
                /* html */`
                  <div data-section="variables" style="margin-bottom:8px;">
                    ${Utils.DOM.skeleton(`${t('themes.editor.variables', 'CSS Variables')}`, { height: '120px', style: 'margin-bottom:8px;' })}
                  </div>
                  <div style="text-align: right;margin-top: 30px;">
                    <input type="button" class="btn" id="btn-add-var" value="+ ${t('themes.editor.add_variable', 'Add Variable')}" />
                  </div>
              `)}

              <!-- Secțiunea 3: Overrides -->
              ${Utils.DOM.fieldset(/* html */`
                <i class="fa fa-paint-brush"></i>&nbsp;${t('themes.editor.overrides', 'CSS Overrides')}
                <small class="${D.HELP_TEXT}" style="font-weight:normal;margin-left:8px;">
                  selector → property → value
                </small>`,
                {},
                /* html */`
                  <div id="overrides-list" style="margin-bottom:8px;">
                    <div data-section="overrides" style="margin-bottom:8px;">
                      ${Utils.DOM.skeleton(`${t('themes.editor.overrides', 'CSS Overrides')}`, { height: '120px', style: 'margin-bottom:8px;' })}
                      ${buildOverrideRows(existingTheme?.overrides ?? {})}
                    </div>
                  </div>
                  <div style="text-align: right;margin-top: 30px;">
                    <input type="button" class="btn" id="btn-add-override" value="+ ${t('themes.editor.add_override', 'Add Override')}" />
                  </div>
              `)}
            </td>
            <td width="55%" valign="top" style="padding:0 0 10px;">
              <!-- Preview & Save -->
              <table cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td align="left" style="padding:0;">
                    <!-- Secțiunea 3: Live Preview -->
                    ${Utils.DOM.fieldset(/* html */`
                      <i class="fa fa-eye"></i>&nbsp;${t('themes.editor.preview', 'Live Preview')}`,
                      {},
                      /* html */`
                        <div id="preview-status" style="margin-bottom:8px;margin-left:4px;">
                          <i class="fa fa-info-circle"></i>&nbsp;
                          ${t('themes.editor.preview_hint', 'Changes are applied live to the current page.')}
                        </div>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;text-align:right;">
                          <input type="button" class="btn icon_ok" id="btn-preview-apply" value="${t('themes.editor.preview_apply', 'Apply Preview')}" />
                          <input type="button" class="btn icon_search" id="btn-preview-clear" value="${t('themes.editor.preview_clear', 'Clear Preview')}" />
                        </div>
                        <div id="preview-css-output" style="margin-top:10px;background:#f5f7f9;border:1px solid #dde;padding:8px;font-size:0.8em;font-family:monospace;max-height:200px;overflow-y:auto;white-space:pre-wrap;color:#555;display:none;"></div>
                        <div style="margin-top:6px;">
                          <a href="javascript:void(0)" id="toggle-css-output" style="margin-left:4px; color:#369fcf;">
                            ${t('themes.editor.show_compiled', 'Show compiled CSS')}
                          </a>
                        </div>
                      `)}
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding:0;">
                    <!-- Secțiunea 4: Import / Export -->
                    ${Utils.DOM.fieldset(/* html */`
                      <i class="fa fa-upload"></i>&nbsp;${t('themes.editor.import', 'Import / Export')}`,
                      {},
                      /* html */`
                        <p style="margin-bottom:8px;margin-left:4px;">
                          ${t('themes.editor.import_hint', 'Import a theme JSON file to populate the form.')}
                        </p>
                        <input type="button" class="btn icon_ok" id="btn-import-json" value="${t('themes.editor.import_btn', 'Choose file')}" />
                        <input type="file" id="import-file-input" accept=".json" style="display:none;" />
                        <small style="display:block;margin-top:6px; margin-left:4px; color:#888;">
                          ${t('themes.editor.import_json_hint', 'The JSON should follow the same structure as the export output.')}
                        </small>
                        <hr style="margin:12px 0; border-top: 1px solid #e7e7e7" />
                        <p style="margin-bottom:8px;margin-left:4px;">
                          ${t('themes.editor.export_hint', 'Export the current theme as a JSON file.')}
                        </p>
                        <input type="button" class="btn icon_upload" id="btn-export-json" value="${t('themes.editor.export_btn', 'Export current theme')}" />
                      `)}
                  </td>
                </tr>
                <tr>
                  <td align="top" style="padding:0;">
                    <!-- Secțiunea 5: CSS Raw -->
                    ${Utils.DOM.fieldset(/* html */`
                      <i class="fa fa-file-code-o"></i>&nbsp;${t('themes.editor.css_raw', 'Custom CSS')}
                      <small class="${D.HELP_TEXT}" style="font-weight:normal;margin-left:8px;">
                        ${t('themes.editor.css_raw_hint', 'Highest priority — applied last')}
                      </small>`,
                      {},
                      /* html */`
                        <textarea id="f-css" style="width:100%;height:200px;font-family:monospace;font-size:0.9em;resize:vertical;box-sizing:border-box;" placeholder="/* Custom CSS here */">${Utils.Str.escapeHTML(existingTheme?.css ?? '')}</textarea>
                    `)}
                  </td>
                </tr>
                <tr align="center" valign="bottom">
                  <td colspan="2" style="padding:0 0 16px 0;">
                    <!-- Acțiuni save -->
                    <div class="div_btns" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content: flex-end;margin-top:10px;margin-right:20px;">
                      <input type="button" class="icon_ok" id="btn-save" value="${t('common.save', 'Save Theme')}" />
                      ${isEdit ? /* html */` <input type="button" class="icon_ok" id="btn-save-apply" value="${t('themes.editor.save_apply', 'Save & Apply')}" />` : ''}
                      <input type="button" class="btn" id="btn-cancel" value="${t('common.cancel', 'Cancel')}" />
                      <div id="save-status" style="margin-top:8px;font-size:0.85em;"></div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr align="center" valign="bottom">
            <td colspan="2" width="65%" style="padding:0 0 16px 0;">
              <!-- Selector Picker -->
              ${Utils.DOM.fieldset(t('themes.editor.selectors_hint', 'Common Selectors'), {}, /* html */`
                <div data-section="selector-picker" style="margin-bottom:8px;">
                  ${Utils.DOM.skeleton(t('themes.editor.loading_selectors', 'Loading selectors...'), { height: '150px', width: '100%' })}
                </div>
              `)}
            </td>
          </tr>
        </tbody>
      </table>
    `,

    async onMount(container, { signal, bus }) {
      const $ = (id) => container.querySelector(`#${id}`);
      let previewActive = false;
      let activeModal = null;
      let debounceTimer = null;

      // Colectează datele din form
      const collectForm = () => ({
        name       : $('f-name').value.trim(),
        description: $('f-desc').value.trim(),
        version    : $('f-version').value.trim() || '1.0.0',
        author     : $('f-author').value.trim(),
        css        : $('f-css').value,
        variables  : _collectVars(container),
        overrides  : _collectOverrides(container),
        meta       : {
          ...(existingTheme?.meta ?? {}),
          tags: $('f-tags').value
            .split(',').map(s => s.trim()).filter(Boolean),
        },
      });

      // Construiește CSS compilat pentru preview
      const buildPreviewCSS = () => {
        const data = collectForm();
        const parts = [];

        if (Object.keys(data.variables).length) {
          const vars = Object.entries(data.variables)
            .map(([k, v]) => `  ${k.startsWith('--') ? k : `--${k}`}: ${v};`)
            .join('\n');
          parts.push(`:root {\n${vars}\n}`);
        }

        for (const [sel, props] of Object.entries(data.overrides)) {
          const body = Object.entries(props)
            .map(([p, v]) => `  ${p}: ${v};`).join('\n');
          parts.push(`${sel} {\n${body}\n}`);
        }

        if (data.css?.trim()) parts.push(data.css.trim());
        return parts.join('\n\n');
      };

      // ── Live preview ───────────────────────────────────────────────────────
      const applyPreview = async () => {
        const css = buildPreviewCSS();

        // Actualizează output vizual
        const outputEl = $('preview-css-output');
        if (outputEl) outputEl.textContent = css || '/* (empty) */';

        try {
          await bus.request('themes:preview', {
            css      : collectForm().css,
            variables: collectForm().variables,
            overrides: collectForm().overrides,
          });
          previewActive = true;
          const statusEl = $('preview-status');
          if (statusEl) {
            statusEl.innerHTML = `
              <i class="fa fa-check" style="color:#27ae60;"></i>&nbsp;
              <span style="color:#27ae60;">
                ${t('themes.editor.preview_active', 'Preview active')}
              </span>`;
          }
        } catch (err) {
          Utils.Toast?.error(`Preview: ${err.message}`);
        }
      };

      const clearPreview = async () => {
        if (!previewActive) return;
        try {
          await bus.request('themes:preview-clear', {});
          previewActive = false;
          const statusEl = $('preview-status');
          if (statusEl) {
            statusEl.innerHTML = `
              <i class="fa fa-info-circle"></i>&nbsp;
              ${t('themes.editor.preview_hint', 'Changes are applied live to the current page.')}`;
          }
        } catch { /* silent */ }
      };

      const popupModal = (title, content) => {
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.background = '#fff';
        modal.style.border = '1px solid #ccc';
        modal.style.padding = '20px';
        modal.style.zIndex = 10000;
        modal.style.maxWidth = '80%';
        modal.style.maxHeight = '80%';
        modal.style.overflow = 'auto';
        modal.innerHTML = `
          <h2 style="margin-top:0;">${title}</h2>
          <div>${content}</div>
          <button id="close-modal" style="margin-top:20px;">Close</button>
        `;

        return new Promise(resolve => {
          modal.querySelector('#close-modal').addEventListener('click', () => { 
            modal.remove();
            resolve();
          });
          document.body.appendChild(modal);
        });
      };

      // Debounced auto-preview la editare CSS
      const debouncedPreview = Utils.Misc.debounce(() => {
        if (previewActive) applyPreview();
      }, 500);

      const debouncedModalPreview = Utils.Misc.debounce(() => {
        if(activeModal) activeModal.remove();
      }, 500);

      $('btn-preview-apply')?.addEventListener('click', applyPreview, { signal });
      $('btn-preview-clear')?.addEventListener('click', clearPreview, { signal });


      const pickerMount = $('selector-picker-mount');
      if (pickerMount) {
        const picker = createSelectorPicker({
          t,
          onSelect: ({ selector, props }) => {
            const firstProp = props?.[0] ?? '';
            const row       = document.createElement('div');
            row.innerHTML   = _overrideRow(selector, firstProp, '');

            const list   = container.querySelector('#overrides-list');
            const newRow = row.firstElementChild;
            list?.appendChild(newRow);

            // Focus pe value dacă prop e pre-completat, altfel pe prop
            const focusTarget = firstProp
              ? newRow?.querySelector('.or-val')
              : newRow?.querySelector('.or-prop');
            focusTarget?.focus();

            newRow?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            if (newRow) {
              newRow.style.background = '#e8f5e9';
              setTimeout(() => { newRow.style.background = ''; }, 600);
            }

            if (previewActive) debouncedPreview();
          }
        });

        pickerMount.appendChild(picker.el);
        signal.addEventListener('abort', () => picker.reset());
      }

      // Curăță preview la navigate away
      signal.addEventListener('abort', clearPreview);

      $('toggle-css-output')?.addEventListener('click', e => {
        e.preventDefault();
        const el     = $('preview-css-output');
        const link   = $('toggle-css-output');
        const isHidden = el.style.display === 'none';

        if (isHidden) {
          el.textContent    = buildPreviewCSS() || '/* (empty) */';
          el.style.display  = 'block';
          link.textContent  = t('themes.editor.hide_compiled', 'Hide compiled CSS');
        } else {
          el.style.display  = 'none';
          link.textContent  = t('themes.editor.show_compiled', 'Show compiled CSS');
        }
      }, { signal });

      // ── CSS textarea — auto-preview la editare ─────────────────────────────

      $('f-css')?.addEventListener('input', debouncedPreview, { signal });

      // ── Variables ─────────────────────────────────────────────────────────

      $('btn-add-var')?.addEventListener('click', () => {
        const row = document.createElement('div');
        row.innerHTML = _varRow('', '');
        container.querySelector('#vars-list')?.appendChild(row.firstElementChild);
      }, { signal });

      container.querySelector('#vars-list')
        ?.addEventListener('input', debouncedPreview, { signal });

      // ── Overrides ─────────────────────────────────────────────────────────

      $('btn-add-override')?.addEventListener('click', () => {
        const row = document.createElement('div');
        row.innerHTML = _overrideRow('', '', '');
        container.querySelector('#overrides-list')?.appendChild(row.firstElementChild);
      }, { signal });

      container.querySelector('#overrides-list')
        ?.addEventListener('input', debouncedPreview, { signal });

      // ── Remove row buttons — delegat ──────────────────────────────────────

      container.addEventListener('click', e => {
        const rm = e.target.closest('.btn-remove-row');
        if (!rm) return;
        rm.closest('.fme-editor-row')?.remove();
        if (previewActive) debouncedPreview();
      }, { signal });

      // ── Color picker sync ──────────────────────────────────────────────────

      container.addEventListener('input', e => {
        if (!e.target.matches('.var-color-picker')) return;
        const row   = e.target.closest('.fme-editor-row');
        const valEl = row?.querySelector('.var-val');
        if (valEl) { valEl.value = e.target.value; debouncedPreview(); }
      }, { signal });

      container.addEventListener('input', e => {
        if (!e.target.matches('.var-val')) return;
        const row     = e.target.closest('.fme-editor-row');
        const picker  = row?.querySelector('.var-color-picker');
        if (picker && /^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
          picker.value = e.target.value;
        }
      }, { signal });

      // ── Import JSON ────────────────────────────────────────────────────────

      $('btn-import-json')?.addEventListener('click', () => {
        $('import-file-input')?.click();
      }, { signal });

      $('import-file-input')?.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text  = await file.text();
          const theme = JSON.parse(text);
          _populateForm(container, theme);
          Utils.Toast?.success(t('themes.editor.imported', 'Theme loaded into form.'));
          if (previewActive) await applyPreview();
        } catch (err) {
          Utils.Toast?.error(`Import: ${err.message}`);
        }
        e.target.value = '';
      }, { signal });

      // ── Cancel ────────────────────────────────────────────────────────────

      $('btn-cancel')?.addEventListener('click', async () => {
        await clearPreview();
        bus.emit('fme:navigate', { section: 'acp_themes' });
      }, { signal });

      // ── Save ──────────────────────────────────────────────────────────────

      const doSave = async (andApply = false) => {
        const statusEl = $('save-status');
        const name     = $('f-name').value.trim();

        if (!name) {
          Utils.Toast?.error(t('themes.editor.name_required', 'Name is required.'));
          $('f-name').focus();
          return;
        }

        if (statusEl) {
          statusEl.style.color = '#888';
          statusEl.textContent = t('common.saving', 'Saving…');
        }

        try {
          const data = {
            ...collectForm(),
            ...(isEdit ? { id: params.id } : {}),
            active: existingTheme?.active ?? false,
          };

          const saved = await bus.request('themes:save', { theme: data });

          if (andApply) {
            await bus.request('themes:apply', { id: saved.id });
          }

          if (statusEl) {
            statusEl.style.color = '#27ae60';
            statusEl.textContent = '✓ ' + t('common.saved', 'Saved!');
          }

          await clearPreview();
          setTimeout(() => bus.emit('fme:navigate', { section: 'acp_themes' }), 700);

        } catch (err) {
          if (statusEl) {
            statusEl.style.color = '#e74c3c';
            statusEl.textContent = `✗ ${err.message}`;
          }
          Utils.Toast?.error(err.message);
        }
      };

      $('btn-save')      ?.addEventListener('click', () => doSave(false), { signal });
      $('btn-save-apply')?.addEventListener('click', () => doSave(true),  { signal });
    },

    sections: {
      'variables': async (el, { bus, signal }) => {
        if (signal.aborted) return;

        try {
          const varRows = buildVarRows(existingTheme?.variables ?? {});
          el.innerHTML = varRows;
          console.log('Built variable rows:', varRows);
        } catch (err) {
          el.innerHTML = `<span style="color:#e74c3c;">${t('themes.editor.variables_load_error', 'Error loading variables')}: ${err.message}</span>`;
          return;
        }
        // el.innerHTML = Utils.DOM.skeleton(`Define CSS variables to be injected into <code>:root {}</code>.<br/>Example: <code>--color-primary: #3a7bd5;</code>`, { height: '30px', width: '100%' });
      },

      'overrides': async (el, { bus, signal }) => {
        if (signal.aborted) return;

        try {
          const overrideRows = buildOverrideRows(existingTheme?.overrides ?? {});
          el.innerHTML = overrideRows;
          console.log('Built override rows:', overrideRows);
        } catch (err) {
          el.innerHTML = `<span style="color:#e74c3c;">${t('themes.editor.overrides_load_error', 'Error loading overrides')}: ${err.message}</span>`;
          return;
        }
      },

      'selector-picker': async (el, { bus, signal }) => {
        if (signal.aborted) return;

        try {
          const selectors = await getAllSelectors(bus, signal);

          const content = /* html */`
            <div style="margin-bottom:8px;text-align:left;color:#888;">
              <i class="fa fa-info-circle"></i>&nbsp;
              ${t('themes.editor.selectors_hint', 'Click a selector to add an override with it pre-filled.')}
              ${t('themes.editor.selectors_total', 'Total selectors')}: ${getAllSelectors().length} (${ALL_CATEGORIES.length} ${t('themes.editor.categories', 'categories')})
            </div>

            <div class="fme-build_selectors">
              <div class="tabs_menu fme-tabs">
                ${ALL_CATEGORIES.map((c) => `<span data-tab="${c}">${c}</span>`).join(' ')}
              </div>
              <div class="fme-selectors" data-selector-show></div>
            </div>
          `;
          el.innerHTML = content;
          el.querySelector('.tabs_menu')?.addEventListener('click', async (e) => {
            const cat = e.target.dataset?.tab;
            if (!cat) return;

            // ✅ marchează tab-ul activ
            el.querySelectorAll('.tabs_menu span').forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');

            const sel = getAllSelectors();
            const res = sel
              .filter((s) => s.category === cat)
              .map((s) => `
                <span data-selector="${s.selector}" data-props="${(s.props ?? []).join(',')}">
                  ${s.selector}
                  <code>${(s.props ?? []).join(', ')}</code>
                </span>`);

            el.querySelector('.fme-selectors').innerHTML = res.join('');
          }, { signal });

          const firstTab = el.querySelector('.tabs_menu span');
          if (firstTab) {
            firstTab.classList.add('active');
            firstTab.click();
          };

          el.querySelector('.fme-selectors')?.addEventListener('click', (e) => {
            const card = e.target.closest('span[data-selector]');
            if (!card) return;

            const selector = card.dataset.selector;
            const props    = card.dataset.props?.split(',').filter(Boolean) ?? [];
            const textarea = document.querySelector('#f-css');
            if (!textarea) return;

            // Construiește blocul CSS
            const block = [
              `${selector} {`,
              ...props.map(prop => `  ${prop.trim()}: ;`),
              `}`,
            ].join('\n');

            // Adaugă la sfârșitul textareai cu un rând liber între blocuri
            const current = textarea.value.trimEnd();
            textarea.value = current
              ? `${current}\n\n${block}`
              : block;

            // Scroll la sfârșitul textareai + focus
            textarea.scrollTop = textarea.scrollHeight;
            textarea.focus();

            // Poziționează cursorul după primul `:` pentru a edita rapid
            const firstVal = textarea.value.lastIndexOf(': ;');
            if (firstVal !== -1) {
              textarea.setSelectionRange(firstVal + 2, firstVal + 2);
            }

            // Trigger debounced preview dacă e activ
            if (previewActive) debouncedPreview();

          }, { signal });
        } catch (err) {
          el.innerHTML = `<span style="color:#e74c3c;">${t('themes.editor.selector_picker_load_error', 'Error loading selector picker')}: ${err.message}</span>`;
        }
      },

      'selectors': async (el, { bus, signal }) => {
        if (signal.aborted) return;
        el.innerHTML = Utils.DOM.skeleton(`Available Selectors: ${getAllSelectors().length} selectors in ${ALL_CATEGORIES.length} categories<br/>Type to search for selectors...`, { height: '30px', width: '100%' });
        
        try {
          const selectors = await getAllSelectors(bus, signal);
          el.innerHTML = selectors.length
            ? selectors.map(s => `<div style="padding:4px 0;cursor:pointer;color:#27ae60;" onclick="setOnverrideSelector('${s}')">${s}</div>`).join('')
            : t('themes.editor.selectors_none', 'No selectors available.');
        } catch (err) {
          el.innerHTML = `<span style="color:#e74c3c;">${t('themes.editor.selectors_load_error', 'Error loading selectors')}: ${err.message}</span>`;
        }
      }
    }
  };
});

function _varRow(key = '', value = '') {
  const isColor = /^#[0-9a-fA-F]{3,6}$/.test(value);
  return /* html */`
    <div class="fme-editor-row" style="display:flex;align-items:center;gap:6px;
         margin-bottom:5px;flex-wrap:wrap;">
      <input type="text" class="var-key inputtext"
             style="width:180px;" placeholder="--color-primary"
             value="${Utils.Str.escapeHTML(key)}" />
      <span style="color:#888;">:</span>
      <input type="text" class="var-val inputtext"
             style="width:140px;" placeholder="#3a7bd5"
             value="${Utils.Str.escapeHTML(value)}" />
      <input type="color" class="var-color-picker"
             style="width:32px;height:28px;padding:1px;cursor:pointer;border:1px solid #ccc;"
             value="${isColor ? Utils.Str.escapeHTML(value) : '#000000'}"
             title="Color picker" />
      <a href="javascript:void(0)" class="btn-remove-row"
         style="color:#e74c3c;font-size:1.1em;" title="Remove">
        <i class="fa fa-times"></i>
      </a>
    </div>
  `;
}

function _overrideRow(selector = '', prop = '', value = '') {
  return /* html */`
    <div class="fme-editor-row" style="display:flex;align-items:center;gap:6px;
         margin-bottom:5px;flex-wrap:wrap;">
      <input type="text" class="or-sel inputtext"
             style="width:140px;" placeholder=".header"
             value="${Utils.Str.escapeHTML(selector)}" />
      <input type="text" class="or-prop inputtext"
             style="width:140px;" placeholder="background-color"
             value="${Utils.Str.escapeHTML(prop)}" />
      <input type="text" class="or-val inputtext"
             style="width:110px;" placeholder="#fff"
             value="${Utils.Str.escapeHTML(value)}" />
      <a href="javascript:void(0)" class="btn-remove-row"
         style="color:#e74c3c;font-size:1.1em;" title="Remove">
        <i class="fa fa-times"></i>
      </a>
    </div>
  `;
}

function _collectVars(container) {
  const vars = {};
  container.querySelectorAll('#vars-list .fme-editor-row').forEach(row => {
    const k = row.querySelector('.var-key')?.value.trim();
    const v = row.querySelector('.var-val')?.value.trim();
    if (k) vars[k] = v ?? '';
  });
  return vars;
}

function _collectOverrides(container) {
  const overrides = {};
  container.querySelectorAll('#overrides-list .fme-editor-row').forEach(row => {
    const sel  = row.querySelector('.or-sel')?.value.trim();
    const prop = row.querySelector('.or-prop')?.value.trim();
    const val  = row.querySelector('.or-val')?.value.trim();
    if (sel && prop) {
      overrides[sel]       = overrides[sel] ?? {};
      overrides[sel][prop] = val ?? '';
    }
  });
  return overrides;
}

function _populateForm(container, theme) {
  const $ = (id) => container.querySelector(`#${id}`);

  if ($('f-name'))    $('f-name').value    = theme.name        ?? '';
  if ($('f-desc'))    $('f-desc').value    = theme.description ?? '';
  if ($('f-version')) $('f-version').value = theme.version     ?? '1.0.0';
  if ($('f-author'))  $('f-author').value  = theme.author      ?? '';
  if ($('f-css'))     $('f-css').value     = theme.css         ?? '';
  if ($('f-tags'))    $('f-tags').value    = (theme.meta?.tags ?? []).join(', ');

  const varsList = container.querySelector('#vars-list');
  if (varsList) {
    varsList.innerHTML = Object.entries(theme.variables ?? {})
      .map(([k, v]) => _varRow(k, v)).join('');
  }

  const overridesList = container.querySelector('#overrides-list');
  if (overridesList) {
    overridesList.innerHTML = Object.entries(theme.overrides ?? {})
      .flatMap(([sel, props]) =>
        Object.entries(props).map(([prop, val]) => _overrideRow(sel, prop, val))
      ).join('');
  }
}