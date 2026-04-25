'use strict';
import BasePage from './_base.js';
import { buildBtns } from '../shared/adapter.js';
import Storage from '../shared/storage.js';

const DEBUG_KEY = 'fme_debug_mode';

/**
 * Renders nested objects as expandable tree
 */
const renderTreeValue = (value, depth = 0) => {
  if (value === null || value === undefined) {
    return `<code class="fme-null">${value}</code>`;
  }

  const type = typeof value;
  const str = String(value);

  if (type === 'boolean' || type === 'number') {
    return `<code class="fme-primitive">${str}</code>`;
  }

  if (type === 'string') {
    return `<code class="fme-string">&quot;${str.slice(0, 100)}&quot;</code>`;
  }

  if (Array.isArray(value)) {
    if (depth > 0) {
      return `<span class="fme-tree-toggle" data-expanded="false">▶ Array[${value.length}]</span>`;
    }
    return `<code>[${value.length} items]</code>`;
  }

  if (type === 'object') {
    if (depth > 0) {
      const keys = Object.keys(value).length;
      return `<span class="fme-tree-toggle" data-expanded="false">▶ Object{${keys} keys}</span>`;
    }
    return `<code>{${Object.keys(value).length} keys}</code>`;
  }

  return `<code>${str.slice(0, 100)}</code>`;
};

/**
 * Recursively render nested object/array as tree
 */
const renderTreeNode = (obj, keyPath = '', depth = 0) => {
  if (!obj || typeof obj !== 'object') return '';

  const entries = Array.isArray(obj) 
    ? obj.map((item, i) => [i, item])
    : Object.entries(obj);

  return entries.map(([k, v]) => {
    const path = keyPath ? `${keyPath}.${k}` : String(k);
    const margin = depth * 20;

    if (v && typeof v === 'object') {
      return `
        <div class="fme-tree-node" style="margin-left:${margin}px" data-path="${String(path)}">
          <span class="fme-tree-toggle" data-expanded="false">▶ ${String(k)}</span>
          <div class="fme-tree-children" style="display:none;">
            ${renderTreeNode(v, path, depth + 1)}
          </div>
        </div>
      `;
    }

    return `
      <div class="fme-tree-leaf" style="margin-left:${margin}px" data-path="${String(path)}">
        <code>${String(k)}</code>: ${renderTreeValue(v, depth)}
      </div>
    `;
  }).join('');
};

export default BasePage('devtools', async ({ Utils, FM, t, bus, params }) => {
  const stored    = await Utils.Storage.get([DEBUG_KEY]),
        debugOn   = stored[DEBUG_KEY] ?? false,
        manifest  = chrome.runtime.getManifest();
  const D = FM.ACP_DOM.CONTENT, I = FM.ACP_DOM.ICONS, B = FM.ACP_DOM.BADGE;

  const debugGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.AUDIT}"></i>&nbsp;${t('devtools.groups.debug')}`,
    { class: D.GROUP },
    `<table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tr class="${D.ROW_ODD}">
        <td width="35%"><strong>${t('devtools.debugMode')}</strong><br /><br />
          <span id="fme-debug-status" class="${debugOn ? B.OK : ''}">
            ${debugOn ? t('devtools.debugEnabled') : t('devtools.debugDisabled')}
          </span>
        </td>
        <td valign="middle">
          &nbsp;
          ${buildBtns([
            {
              type : 'button',
              name : 'toggle-debug',
              value: debugOn ? t('devtools.disableDebug') : t('devtools.enableDebug'),
              cls  : debugOn ? 'icon_add' : 'icon_ok',
              id   : 'fme-debug-toggle',
            },
          ])}
        </td>
      </tr>
      <tr class="${D.ROW_EVEN}">
        <td><strong>${t('devtools.reload')}</strong><br /><br /><p>${t('devtools.reloadDesc')}</p></td>
        <td>
          ${buildBtns([
            { type: 'button', name: 'reload', value: t('devtools.reload'), cls: 'icon_search', id: 'fme-devtools-reload' },
          ])}
        </td>
      </tr>
    </table>`
  );

  const allKeys = await Storage.getAll();
  const storageRows = Object.entries(allKeys).length
    ? Object.entries(allKeys).map(([k, v], i) => `
        <tr class="${i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN}" data-key="${String(k)}">
          <td width="25%"><code>${String(k)}</code></td>
          <td class="fme-storage-preview" style="word-break:break-all;max-width:400px;">
            <small>${renderTreeValue(v, 0)}</small>
          </td>
          <td align="center" width="12%" class="fme-storage-actions">
            <a href="#" class="fme-storage-expand" title="Expand tree" style="margin-right:4px;">
              <i class="fa ${I.INFO}"></i>
            </a>
            <a href="#" class="fme-storage-copy" title="Copy value" style="margin-right:4px;">
              <i class="fa icon_link"></i>
            </a>
            <a href="#" class="fme-storage-edit" title="Edit value" style="margin-right:4px;">
              <i class="fa icon_edit"></i>
            </a>
            <a href="#" class="fme-storage-delete" data-key="${String(k)}" title="Delete">
              <i class="fa ${I.TRASH}"></i>
            </a>
          </td>
        </tr>
      `).join('')
    : `<tr class="${D.ROW_ODD}"><td colspan="4"><em>${t('devtools.noKeys')}</em></td></tr>`;

  const storageGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.LOCK}"></i>&nbsp;${t('devtools.groups.storage')} <span class="fme-storage-count">(${Object.keys(allKeys).length})</span>`,
    { class: D.GROUP },
    `<div style="margin-bottom:8px;">
      <input type="text" id="fme-storage-search" placeholder="Search keys..." style="width:200px;margin-right:8px;" />
      ${buildBtns([
        { name: 'refresh-storage', value: 'Refresh', cls: 'icon_search', id: 'fme-storage-refresh', style: 'margin-right:4px;' },
        { name: 'export-storage', value: 'Export JSON', cls: 'icon_add', id: 'fme-storage-export', style: 'margin-right:4px;' },
        { name: 'import-storage', value: 'Import JSON', cls: 'icon_ok', id: 'fme-storage-import', style: 'margin-right:4px;' },
        { name: 'clear-storage', value: 'Clear All', cls: 'icon_delete', id: 'fme-storage-clear' },
      ])}
    </div>
    <div id="fme-storage-tree" style="display:none;margin:10px 0;padding:10px;background:#f5f5f5;border:1px solid #ddd;border-radius:3px;max-height:300px;overflow-y:auto;">
    </div>
    <table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <thead>
        <tr class="${D.ROW_ODD}">
          <th align="left" width="25%">${t('devtools.storageKey')}</th>
          <th align="left">${t('devtools.storageValue')}</th>
          <th align="center" width="12%">${t('common.actions')}</th>
        </tr>
      </thead>
      <tbody id="fme-storage-body">
        ${storageRows}
      </tbody>
    </table>`
  );

  // ── Plugin Debugging ────────────────────────────────────────────────────────
  const pluginsStorage = allKeys.fme_plugins?.installed ?? [];
  const pluginRows = pluginsStorage.length
    ? pluginsStorage.map((p, i) => `
        <tr class="${i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN}" data-plugin-id="${String(p.id ?? '')}">
          <td width="20%"><code>${String(p.id ?? 'unknown')}</code></td>
          <td width="15%">
            <span style="padding:2px 6px;border-radius:3px;font-size:0.85em;${p.active ? 'background:#c8e6c9;color:#2e7d32;' : 'background:#ffccbc;color:#e64a19;'}">
              ${p.active ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td width="15%"><code>${String(p.version ?? '?')}</code></td>
          <td width="35%"><code>${(p.hooks ?? []).join(', ') || '—'}</code></td>
          <td align="center" width="15%">
            <a href="#" class="fme-plugin-inspect" title="Inspect" style="margin-right:4px;">
              <i class="fa ${I.INFO}"></i>
            </a>
            <a href="#" class="fme-plugin-toggle" title="${p.active ? 'Disable' : 'Enable'}" style="margin-right:4px;">
              <i class="fa ${p.active ? 'icon_delete' : 'icon_ok'}"></i>
            </a>
          </td>
        </tr>
      `).join('')
    : `<tr class="${D.ROW_ODD}"><td colspan="5"><em>No plugins installed</em></td></tr>`;

  const pluginsGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.INFO}"></i>&nbsp;Plugin Debugging <span class="fme-plugins-count">(${pluginsStorage.length})</span>`,
    { class: D.GROUP },
    `<div style="margin-bottom:8px;">
      ${buildBtns([
        { name: 'refresh-plugins', value: 'Refresh', cls: 'icon_search', id: 'fme-plugins-refresh', style: 'margin-right:4px;' },
        { name: 'clear-plugins', value: 'Clear All', cls: 'icon_delete', id: 'fme-plugins-clear' }
      ])}
    </div>
    <table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <thead>
        <tr class="${D.ROW_ODD}">
          <th align="left" width="20%">ID</th>
          <th align="left" width="15%">Status</th>
          <th align="left" width="15%">Version</th>
          <th align="left" width="35%">Hooks</th>
          <th align="center" width="15%">Actions</th>
        </tr>
      </thead>
      <tbody id="fme-plugins-body">
        ${pluginRows}
      </tbody>
    </table>`
  );

  // ── Theme Debugging ────────────────────────────────────────────────────────
  const themesStorage = Object.values(allKeys.fme_themes ?? {});
  const themeRows = themesStorage.length
    ? themesStorage.map((t, i) => `
        <tr class="${i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN}" data-theme-id="${String(t.id ?? '')}">
          <td width="20%"><code>${String(t.id ?? 'unknown')}</code></td>
          <td width="30%"><code>${String(t.meta?.name ?? 'Unnamed')}</code></td>
          <td width="15%"><code>${String(t.meta?.version ?? '?')}</code></td>
          <td align="center" width="15%">
            <code style="font-size:0.85em;">${String(t.css?.length ?? 0)} bytes</code>
          </td>
          <td align="center" width="20%">
            <a href="#" class="fme-theme-inspect" title="Inspect" style="margin-right:4px;">
              <i class="fa ${I.INFO}"></i>
            </a>
            <a href="#" class="fme-theme-reload" title="Reload" style="margin-right:4px;">
              <i class="fa icon_search"></i>
            </a>
          </td>
        </tr>
      `).join('')
    : `<tr class="${D.ROW_ODD}"><td colspan="5"><em>No themes installed</em></td></tr>`;

  const themesGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.LOCK}"></i>&nbsp;Theme Debugging <span class="fme-themes-count">(${themesStorage.length})</span>`,
    { class: D.GROUP },
    `<table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <thead>
        <tr class="${D.ROW_ODD}">
          <th align="left" width="20%">ID</th>
          <th align="left" width="30%">Name</th>
          <th align="left" width="15%">Version</th>
          <th align="center" width="15%">CSS Size</th>
          <th align="center" width="20%">Actions</th>
        </tr>
      </thead>
      <tbody id="fme-themes-body">
        ${themeRows}
      </tbody>
    </table>`
  );

  const buildGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.INFO}"></i>&nbsp;${t('devtools.groups.build')}`,
    { class: D.GROUP },
    `<table class="${D.TABLE}" cellspacing="1" cellpadding="5" width="100%">
      <tr class="${D.ROW_ODD}">
        <td width="35%"><strong>${t('devtools.buildVersion', 'Version')}&nbsp;:</strong></td>
        <td><code>${manifest.build?.display ?? manifest.version ?? '—'}</code></td>
      </tr>
      <tr class="${D.ROW_EVEN}">
        <td><strong>${t('devtools.buildManifest', 'Manifest')}&nbsp;:</strong></td>
        <td><code>MV${manifest.manifest_version ?? '?'}</code></td>
      </tr>
      <tr class="${D.ROW_ODD}">
        <td><strong>${t('devtools.buildID', 'Extension ID')}&nbsp;:</strong></td>
        <td><code>${chrome.runtime.id}</code></td>
      </tr>
      <tr class="${D.ROW_EVEN}">
        <td><strong>${t('devtools.buildEnv', 'Environment')}&nbsp;:</strong></td>
        <td><code>${manifest.build?.env ?? (__DEV__ ? 'development' : 'production')}</code></td>
      </tr>
      <tr class="${D.ROW_ODD}">
        <td><strong>${t('devtools.buildDate', 'Build date')}&nbsp;:</strong></td>
        <td><code>${manifest.build?.date ?? __BUILD_DATE__}</code></td>
      </tr>
      <tr class="${D.ROW_EVEN}">
        <td><strong>${t('devtools.buildHash', 'Build hash')}&nbsp;:</strong></td>
        <td><code>${manifest.build?.hash ?? __BUILD_HASH__}</code></td>
      </tr>
      <tr class="${D.ROW_ODD}">
        <td><strong>${t('devtools.buildNumber', 'Build number')}&nbsp;:</strong></td>
        <td><code>#${manifest.build?.number ?? __BUILD_NUMBER__}</code></td>
      </tr>
      <tr class="${D.ROW_EVEN}">
        <td><strong>${t('devtools.buildBrowser', 'Browser')}&nbsp;:</strong></td>
        <td><code>${__BROWSER__}</code></td>
      </tr>
    </table>`
  );

  // ── JavaScript Sandbox Executor ────────────────────────────────────────────
  const sandboxGroup = Utils.DOM.fieldset(
    `<i class="fa icon_edit"></i>&nbsp;JavaScript Sandbox Executor`,
    { class: D.GROUP },
    `<div style="margin-bottom:8px;">
      <label><strong>Command:</strong></label>
      <textarea id="fme-sandbox-code" placeholder="// Type command (e.g., help, storage:getAll, plugins:list)\\nstorage:getAll" style="width:100%;height:80px;font-family:monospace;padding:8px;border:1px solid #ccc;border-radius:3px;background:#f9f9f9;"></textarea>
      <div style="margin-top:4px;font-size:0.85em;color:#666;\">
        <code>help</code> to see available commands
      </div>
    </div>
    <div style="margin-bottom:8px;">
      ${buildBtns([{ name: 'sandbox-execute', value: 'Execute', cls: 'icon_ok', id: 'fme-sandbox-execute', style: 'margin-right:4px;' }, { name: 'sandbox-clear', value: 'Clear', cls: 'icon_delete', id: 'fme-sandbox-clear' }])}
    </div>
    <div id="fme-sandbox-output" style="background:#f5f5f5;color:#1a1a1a;padding:10px;border-radius:3px;font-family:monospace;font-size:0.9em;height:200px;overflow-y:auto;display:none;border:1px solid #ddd;line-height:1.5;word-wrap:break-word;">
    </div>`
  );

  // ── Event Bus Monitor ──────────────────────────────────────────────────────
  const eventBusGroup = Utils.DOM.fieldset(
    `<i class="fa icon_search"></i>&nbsp;Event Bus Monitor`,
    { class: D.GROUP },
    `<div style="margin-bottom:8px;">
      <input type="text" id="fme-eventbus-filter" placeholder="Filter by event name..." style="width:200px;margin-right:8px;" />
      ${buildBtns([
        { name: 'eventbus-clear-log', value: 'Clear Log', cls: 'icon_delete', id: 'fme-eventbus-clear-log', style: 'margin-right:4px;' },
        { name: 'eventbus-export', value: 'Export', cls: 'icon_add', id: 'fme-eventbus-export', style: 'margin-right:4px;' },
        { name: 'eventbus-test', value: 'Test Event', cls: 'icon_ok', id: 'fme-eventbus-test' }
      ])}
      <div style="margin-top:4px;font-size:0.9em;color:#666;">
        <code id="fme-eventbus-count">Events: 0</code> | <code id="fme-eventbus-status">Monitoring: ON</code>
      </div>
    </div>
    <div id="fme-eventbus-log" style="background:#f5f5f5;border:1px solid #ddd;border-radius:3px;height:200px;overflow-y:auto;padding:8px;font-family:monospace;font-size:0.85em;">
      <em style="color:#999;">Waiting for events...</em>
    </div>`
  );

  // ── Storage Quota Inspector ────────────────────────────────────────────────
  const storageQuotaGroup = Utils.DOM.fieldset(
    `<i class="fa ${I.LOCK}"></i>&nbsp;Storage Quota Inspector`,
    { class: D.GROUP },
    `<div id="fme-quota-overview" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:15px;">
      <div style="background:#e3f2fd;padding:10px;border-radius:3px;border-left:4px solid #1976d2;">
        <div style="font-size:0.9em;color:#666;">Total Used</div>
        <div style="font-size:1.4em;font-weight:bold;" id="fme-quota-total">—</div>
      </div>
      <div style="background:#f3e5f5;padding:10px;border-radius:3px;border-left:4px solid #7b1fa2;">
        <div style="font-size:0.9em;color:#666;">Quota Limit</div>
        <div style="font-size:1.4em;font-weight:bold;" id="fme-quota-limit">10 MB</div>
      </div>
      <div style="background:#e8f5e9;padding:10px;border-radius:3px;border-left:4px solid #388e3c;">
        <div style="font-size:0.9em;color:#666;">Usage %</div>
        <div style="font-size:1.4em;font-weight:bold;" id="fme-quota-percent">—</div>
      </div>
    </div>
    <div style="background:#fafafa;border:1px solid #e0e0e0;border-radius:3px;padding:8px;">
      <div style="font-weight:bold;margin-bottom:8px;">Storage Breakdown:</div>
      <div id="fme-quota-breakdown" style="font-size:0.9em;">
        <em style="color:#999;">Loading...</em>
      </div>
    </div>
    <div style="margin-top:8px;">
      ${buildBtns([{ name: 'quota-refresh', value: 'Refresh', cls: 'icon_search', id: 'fme-quota-refresh' }])}
    </div>`
  );

  const html = `
    <div id="fme-devtools-page">
      ${debugGroup}
      ${storageGroup}
      ${sandboxGroup}
      ${eventBusGroup}
      ${storageQuotaGroup}
      ${pluginsGroup}
      ${themesGroup}
      ${buildGroup}
      <div id="fme-modal-backdrop" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;" />
      <div id="fme-edit-modal" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border-radius:5px;z-index:10000;min-width:400px;max-width:600px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <h3 style="margin-top:0;">Edit Storage Value</h3>
        <div>
          <label>Key: <code id="fme-edit-key" style="display:inline-block;background:#f0f0f0;padding:4px 6px;border-radius:2px;"></code></label>
        </div>
        <div style="margin:10px 0;">
          <label>Value (JSON):</label>
          <textarea id="fme-edit-value" style="width:100%;height:200px;font-family:monospace;padding:8px;border:1px solid #ccc;border-radius:3px;"></textarea>
        </div>
        <div>
          <input type="button" class="btn icon_ok" value="Save" id="fme-edit-save" />
          <input type="button" class="btn icon_delete" value="Cancel" id="fme-edit-cancel" style="margin-left:8px;" />
        </div>
      </div>
    </div>
  `;

  return {
    html,
    onMount: async (container, { signal }) => {
      const refreshStorage = async () => {
        const all  = await Storage.getAll();
        const body = container.querySelector('#fme-storage-body');
        if (!body) return;

        const rows = Object.entries(all).length
          ? Object.entries(all).map(([k, v], i) => `
              <tr class="${i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN}" data-key="${String(k)}">
                <td width="25%"><code>${String(k)}</code></td>
                <td class="fme-storage-preview" style="word-break:break-all;max-width:400px;">
                  <small>${renderTreeValue(v, 0)}</small>
                </td>
                <td align="center" width="12%" class="fme-storage-actions">
                  <a href="#" class="fme-storage-expand" title="Expand tree" style="margin-right:4px;">
                    <i class="fa ${I.INFO}"></i>
                  </a>
                  <a href="#" class="fme-storage-copy" title="Copy value" style="margin-right:4px;">
                    <i class="fa icon_link"></i>
                  </a>
                  <a href="#" class="fme-storage-edit" title="Edit value" style="margin-right:4px;">
                    <i class="fa icon_edit"></i>
                  </a>
                  <a href="#" class="fme-storage-delete" data-key="${String(k)}" title="Delete">
                    <i class="fa ${I.TRASH}"></i>
                  </a>
                </td>
              </tr>
            `).join('')
          : `<tr class="${D.ROW_ODD}"><td colspan="4"><em>${t('devtools.noKeys')}</em></td></tr>`;

        body.innerHTML = rows;
        container.querySelector('.fme-storage-count').textContent = `(${Object.keys(all).length})`;
        bindStorageActions();
      };

      container.querySelector('#fme-plugins-refresh')?.addEventListener('click', async () => {
        const all = await Storage.getAll();
        const plugins = all.fme_plugins?.installed ?? [];
        
        const rows = plugins.length
          ? plugins.map((p, i) => `
              <tr class="${i % 2 === 0 ? D.ROW_ODD : D.ROW_EVEN}" data-plugin-id="${String(p.id ?? '')}">
                <td width="20%"><code>${String(p.id ?? 'unknown')}</code></td>
                <td width="15%">
                  <span style="padding:2px 6px;border-radius:3px;font-size:0.85em;${p.active ? 'background:#c8e6c9;color:#2e7d32;' : 'background:#ffccbc;color:#e64a19;'}">
                    ${p.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td width="15%"><code>${String(p.version ?? '?')}</code></td>
                <td width="35%"><code>${(p.hooks ?? []).join(', ') || '—'}</code></td>
                <td align="center" width="15%">
                  <a href="#" class="fme-plugin-inspect" title="Inspect" style="margin-right:4px;">
                    <i class="fa ${I.INFO}"></i>
                  </a>
                  <a href="#" class="fme-plugin-toggle" title="${p.active ? 'Disable' : 'Enable'}" style="margin-right:4px;">
                    <i class="fa ${p.active ? 'icon_delete' : 'icon_ok'}"></i>
                  </a>
                </td>
              </tr>
            `).join('')
          : `<tr class="${D.ROW_ODD}"><td colspan="5"><em>No plugins installed</em></td></tr>`;

        container.querySelector('#fme-plugins-body').innerHTML = rows;
        container.querySelector('.fme-plugins-count').textContent = `(${plugins.length})`;
        
        // Re-bind event handlers
        container.querySelectorAll('.fme-plugin-inspect').forEach(el => {
          el.addEventListener('click', async (e) => {
            e.preventDefault();
            const row = el.closest('tr');
            const pluginId = row.dataset.pluginId;
            const all = await Storage.getAll();
            const plugins = all.fme_plugins?.installed ?? [];
            const plugin = plugins.find(p => p.id === pluginId);

            if (!plugin) {
              alert('Plugin not found');
              return;
            }

            const json = JSON.stringify(plugin, null, 2);
            container.querySelector('#fme-modal-backdrop').style.display = 'block';
            container.querySelector('#fme-edit-modal').style.display = 'block';
            container.querySelector('#fme-edit-key').textContent = `Plugin: ${pluginId}`;
            container.querySelector('#fme-edit-value').value = json;
            container.querySelector('#fme-edit-save').style.display = 'none';
            container.querySelector('#fme-edit-cancel').textContent = 'Close';

            const closeModal = () => {
              container.querySelector('#fme-modal-backdrop').style.display = 'none';
              container.querySelector('#fme-edit-modal').style.display = 'none';
              container.querySelector('#fme-edit-save').style.display = 'inline';
              container.querySelector('#fme-edit-cancel').textContent = 'Cancel';
            };

            container.querySelector('#fme-edit-cancel').addEventListener('click', closeModal, { once: true });
            container.querySelector('#fme-modal-backdrop').addEventListener('click', closeModal, { once: true });
          }, { signal });
        });

        container.querySelectorAll('.fme-plugin-toggle').forEach(el => {
          el.addEventListener('click', async (e) => {
            e.preventDefault();
            const row = el.closest('tr');
            const pluginId = row.dataset.pluginId;
            const all = await Storage.getAll();
            const plugins = all.fme_plugins?.installed ?? [];
            const plugin = plugins.find(p => p.id === pluginId);

            if (!plugin) return;

            plugin.active = !plugin.active;
            await Utils.Storage.set({ fme_plugins: { ...all.fme_plugins, installed: plugins } });
            location.reload();
          }, { signal });
        });
      }, { signal });

      container.querySelector('#fme-plugins-clear')?.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear all plugins? This cannot be undone.')) return;
        
        const all = await Storage.getAll();
        await Utils.Storage.set({ fme_plugins: { ...all.fme_plugins, installed: [] } });
        location.reload();
      }, { signal });

      container.querySelectorAll('.fme-theme-inspect').forEach(el => {
        el.addEventListener('click', async (e) => {
          e.preventDefault();
          const row = el.closest('tr');
          const themeId = row.dataset.themeId;
          const all = await Storage.getAll();
          const themes = all.fme_themes ?? {};
          const theme = themes[themeId];

          if (!theme) {
            alert('Theme not found');
            return;
          }

          const display = { ...theme };
          display.css = `${display.css?.slice(0, 200)}...`;
          const json = JSON.stringify(display, null, 2);

          container.querySelector('#fme-modal-backdrop').style.display = 'block';
          container.querySelector('#fme-edit-modal').style.display = 'block';
          container.querySelector('#fme-edit-key').textContent = `Theme: ${themeId}`;
          container.querySelector('#fme-edit-value').value = json;
          container.querySelector('#fme-edit-save').style.display = 'none';
          container.querySelector('#fme-edit-cancel').textContent = 'Close';

          const closeModal = () => {
            container.querySelector('#fme-modal-backdrop').style.display = 'none';
            container.querySelector('#fme-edit-modal').style.display = 'none';
            container.querySelector('#fme-edit-save').style.display = 'inline';
            container.querySelector('#fme-edit-cancel').textContent = 'Cancel';
          };

          container.querySelector('#fme-edit-cancel').addEventListener('click', closeModal, { once: true });
          container.querySelector('#fme-modal-backdrop').addEventListener('click', closeModal, { once: true });
        }, { signal });
      });

      container.querySelectorAll('.fme-theme-reload').forEach(el => {
        el.addEventListener('click', async (e) => {
          e.preventDefault();
          bus.emit('theme:reload');
          el.style.color = '#28a745';
          setTimeout(() => el.style.color = '', 1000);
        }, { signal });
      });

      const bindStorageActions = () => {
        // ── Delete entry ─────────────────────────────────────────────────
        container.querySelectorAll('.fme-storage-delete').forEach(el => {
          el.addEventListener('click', async (e) => {
            e.preventDefault();
            const key = el.dataset.key;
            if (!confirm(`Delete "${key}"?`)) return;
            await Utils.Storage.remove(key);
            refreshStorage();
          }, { signal });
        });

        // ── Copy value ───────────────────────────────────────────────────
        container.querySelectorAll('.fme-storage-copy').forEach(el => {
          el.addEventListener('click', async (e) => {
            e.preventDefault();
            const row = el.closest('tr');
            const key = row.dataset.key;
            const all = await Storage.getAll();
            const value = all[key];
            const json = JSON.stringify(value, null, 2);
            
            try {
              await navigator.clipboard.writeText(json);
              el.style.color = '#28a745';
              setTimeout(() => el.style.color = '', 1000);
            } catch (err) {
              alert('Failed to copy: ' + err.message);
            }
          }, { signal });
        });

        // ── Edit value ───────────────────────────────────────────────────
        container.querySelectorAll('.fme-storage-edit').forEach(el => {
          el.addEventListener('click', async (e) => {
            e.preventDefault();
            const row = el.closest('tr');
            const key = row.dataset.key;
            const all = await Storage.getAll();
            const value = all[key];

            container.querySelector('#fme-modal-backdrop').style.display = 'block';
            container.querySelector('#fme-edit-modal').style.display = 'block';
            container.querySelector('#fme-edit-key').textContent = key;
            container.querySelector('#fme-edit-value').value = JSON.stringify(value, null, 2);

            const save = async () => {
              try {
                const newValue = JSON.parse(container.querySelector('#fme-edit-value').value);
                await Utils.Storage.set({ [key]: newValue });
                closeModal();
                refreshStorage();
              } catch (err) {
                alert('Invalid JSON: ' + err.message);
              }
            };

            const closeModal = () => {
              container.querySelector('#fme-modal-backdrop').style.display = 'none';
              container.querySelector('#fme-edit-modal').style.display = 'none';
            };

            container.querySelector('#fme-edit-save').addEventListener('click', save, { once: true });
            container.querySelector('#fme-edit-cancel').addEventListener('click', closeModal, { once: true });
            container.querySelector('#fme-modal-backdrop').addEventListener('click', closeModal, { once: true });
          }, { signal });
        });

        // ── Expand tree ──────────────────────────────────────────────────
        container.querySelectorAll('.fme-storage-expand').forEach(el => {
          el.addEventListener('click', async (e) => {
            e.preventDefault();
            const row = el.closest('tr');
            const key = row.dataset.key;
            const all = await Storage.getAll();
            const value = all[key];

            const tree = container.querySelector('#fme-storage-tree');
            tree.innerHTML = renderTreeNode(value, key);
            tree.style.display = 'block';

            tree.querySelectorAll('.fme-tree-toggle').forEach(toggle => {
              toggle.addEventListener('click', (e) => {
                const parent = toggle.closest('.fme-tree-node') || toggle.closest('.fme-tree-leaf');
                const children = parent?.querySelector('.fme-tree-children');
                if (children) {
                  const expanded = toggle.dataset.expanded === 'true';
                  toggle.dataset.expanded = !expanded;
                  toggle.textContent = toggle.textContent.replace(/^[▶▼]/, expanded ? '▶' : '▼');
                  children.style.display = expanded ? 'none' : 'block';
                }
              });
            });
          }, { signal });
        });
      };

      container.querySelector('#fme-storage-search')?.addEventListener('keyup', async (e) => {
        const query = e.target.value.toLowerCase();
        container.querySelectorAll('#fme-storage-body tr').forEach(row => {
          const key = row.dataset.key || '';
          row.style.display = key.toLowerCase().includes(query) ? '' : 'none';
        });
      }, { signal });

      container.querySelector('#fme-storage-export')?.addEventListener('click', async () => {
        const all = await Storage.getAll();
        const json = JSON.stringify(all, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fme-storage-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }, { signal });

      container.querySelector('#fme-storage-import')?.addEventListener('click', async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!confirm(`Import ${Object.keys(data).length} entries?`)) return;
            await Utils.Storage.set(data);
            refreshStorage();
          } catch (err) {
            alert('Invalid file: ' + err.message);
          }
        };
        input.click();
      }, { signal });

      container.querySelector('#fme-storage-clear')?.addEventListener('click', async () => {
        const all = await Storage.getAll();
        if (!confirm(`Delete all ${Object.keys(all).length} entries? This cannot be undone.`)) return;
        
        for (const key of Object.keys(all)) {
          await Utils.Storage.remove(key);
        }
        refreshStorage();
      }, { signal });

      container.querySelector('#fme-debug-toggle')?.addEventListener('click', async () => {
        const s    = await Utils.Storage.get([DEBUG_KEY]);
        const next = !(s[DEBUG_KEY] ?? false);
        await Utils.Storage.set({ [DEBUG_KEY]: next });
        location.reload();
      }, { signal });

      container.querySelector('#fme-devtools-reload')?.addEventListener('click', () => {
        location.reload();
      }, { signal });

      container.querySelector('input[name="toggle-debug"]')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const toggle  = e.target;
        const mode    = await Utils.Storage.get([DEBUG_KEY]);
        const next    = !(mode[DEBUG_KEY] ?? false);
        
        if(next) {
          await Utils.Storage.set({ [DEBUG_KEY]: next });
          e.target.value = next ? t('devtools.disableDebug') : t('devtools.enableDebug');
          console.log('Status: ', e.target.value);
          location.reload();
        } else {
          await Utils.Storage.set({ [DEBUG_KEY]: false });
          e.target.value = next ? t('devtools.disableDebug') : t('devtools.enableDebug');
          console.log('Status: ', e.target.value);
          location.reload();
        }
      }, { signal });

      container.querySelector('#fme-storage-refresh')?.addEventListener('click', refreshStorage, { signal });

      bindStorageActions();

      // ── JavaScript Sandbox Executor ────────────────────────────────────────
      const logToSandbox = (msg, type = 'log') => {
        const output = container.querySelector('#fme-sandbox-output');
        if (!output) return;
        output.style.display = 'block';
        const time = new Date().toLocaleTimeString();
        const color = type === 'error' ? '#d32f2f' : type === 'warn' ? '#f57c00' : type === 'success' ? '#388e3c' : '#1976d2';
        const bgColor = type === 'error' ? '#ffebee' : type === 'warn' ? '#fff3e0' : type === 'success' ? '#e8f5e9' : 'transparent';
        
        // Convert newlines to <br> and preserve formatting
        const lines = String(msg).split('\n');
        const msgHtml = lines.map(line => {
          return line.trim() ? `<div style="background:${bgColor};padding:2px 6px;margin:2px 0;">${line}</div>` : '';
        }).join('');
        
        output.innerHTML += `<div style="color:${color};border-left:3px solid ${color};padding-left:8px;margin:4px 0;"><span style="color:#666;">[${time}]</span> <strong>${type.toUpperCase()}:</strong><br />${msgHtml}</div>`;
        output.scrollTop = output.scrollHeight;
      };

      const sandboxCommands = {
        'storage:getAll': async (args) => {
          const result = await bus.request('devtools:sandbox:getStorage', {});
          return JSON.stringify(result, null, 2);
        },
        'storage:get': async (args) => {
          const keys = args?.trim() ? args.split(',').map(k => k.trim()) : null;
          const result = await bus.request('devtools:sandbox:getStorage', { keys });
          return JSON.stringify(result, null, 2);
        },
        'storage:set': async (args) => {
          const [key, ...valParts] = args.split('=');
          const value = JSON.parse(valParts.join('='));
          const result = await bus.request('devtools:sandbox:setStorage', { key: key.trim(), value });
          return JSON.stringify(result);
        },
        'storage:query': async (args) => {
          const result = await bus.request('devtools:sandbox:queryStorage', { pattern: args });
          return JSON.stringify(result, null, 2);
        },
        'plugins:list': async () => {
          const result = await bus.request('devtools:sandbox:getPlugins', {});
          return JSON.stringify(result, null, 2);
        },
        'themes:list': async () => {
          const result = await bus.request('devtools:sandbox:getThemes', {});
          return JSON.stringify(result, null, 2);
        },
        'audit:recent': async (args) => {
          const limit = parseInt(args || '50');
          const result = await bus.request('devtools:sandbox:getAuditLog', { limit });
          return JSON.stringify(result, null, 2);
        },
        'stats:all': async () => {
          const result = await bus.request('devtools:sandbox:getStats', {});
          return JSON.stringify(result, null, 2);
        },
        'debug:fme': async () => {
          const result = await bus.request('debug:fme', {});
          return result;
        },
        'help': async () => {
          return `Available Commands:\n\n
            storage:getAll             - Get all storage\n
            storage:get <key1,key2>    - Get specific keys\n
            storage:set <key=value>    - Set value (JSON)\n
            storage:query <pattern>    - Query by regex pattern\n
            plugins:list               - List all plugins\n
            themes:list                - List all themes\n
            audit:recent [limit]       - Get recent audit entries (default: 50)\n
            stats:all                  - Get statistics\n
            debug:fme                  - Get FME global object\n
            help                       - Show this help\n`;
        }
      };

      container.querySelector('#fme-sandbox-execute')?.addEventListener('click', async () => {
        const code = container.querySelector('#fme-sandbox-code').value;
        const output = container.querySelector('#fme-sandbox-output');
        
        if (!code.trim()) {
          alert('Please enter a command');
          return;
        }

        output.innerHTML = '';
        output.style.display = 'block';
        
        const [cmd, ...args] = code.trim().split(/\s+/);
        const command = cmd.toLowerCase();
        const argsStr = args.join(' ');

        logToSandbox(`Executing: ${command}`, 'log');
        const start = performance.now();
        
        try {
          const handler = sandboxCommands[command];
          if (!handler) {
            logToSandbox(`Unknown command: ${command}. Type "help" for available commands.`, 'error');
            return;
          }

          const result = await handler(argsStr);
          const duration = (performance.now() - start).toFixed(2);
          
          logToSandbox(`Completed in ${duration}ms`, 'success');
          logToSandbox(result, 'log');
        } catch (err) {
          logToSandbox(`${err.name}: ${err.message}`, 'error');
        }
      }, { signal });

      container.querySelector('#fme-sandbox-clear')?.addEventListener('click', () => {
        container.querySelector('#fme-sandbox-code').value = '';
        container.querySelector('#fme-sandbox-output').innerHTML = '';
        container.querySelector('#fme-sandbox-output').style.display = 'none';
      }, { signal });

      // ── Event Bus Monitor ──────────────────────────────────────────────────────
      const EVENT_LOG_KEY = 'fme_devtools_event_log';
      const maxEvents = 100;
      let eventLog = [];

      // Load persisted event logs
      const loadEventLogs = async () => {
        try {
          const stored = await Utils.Storage.get([EVENT_LOG_KEY]);
          eventLog = stored[EVENT_LOG_KEY] ?? [];
        } catch (err) {
          console.error('[Devtools] Error loading event logs:', err);
          eventLog = [];
        }
      };

      // Save event logs to storage
      const saveEventLogs = async () => {
        try {
          await Utils.Storage.set({ [EVENT_LOG_KEY]: eventLog });
        } catch (err) {
          console.error('[Devtools] Error saving event logs:', err);
        }
      };

      const addEventLog = (eventName, data) => {
        const time = new Date().toLocaleTimeString();
        eventLog.unshift({ time, eventName, data });
        if (eventLog.length > maxEvents) eventLog.pop();
        
        const count = container.querySelector('#fme-eventbus-count');
        if (count) count.textContent = `Events: ${eventLog.length}`;
        
        // Save to storage (debounced)
        clearTimeout(addEventLog._saveTimeout);
        addEventLog._saveTimeout = setTimeout(saveEventLogs, 500);
      };

      const refreshEventLog = () => {
        const logEl = container.querySelector('#fme-eventbus-log');
        const filter = (container.querySelector('#fme-eventbus-filter')?.value ?? '').toLowerCase();
        
        if (!logEl) return;
        if (!eventLog.length) {
          logEl.innerHTML = '<em style="color:#999;">No events yet...</em>';
          return;
        }

        const filtered = filter ? eventLog.filter(e => e.eventName.toLowerCase().includes(filter)) : eventLog;
        logEl.innerHTML = filtered.map((e, i) => `
          <div style="padding:4px;border-bottom:1px solid #e0e0e0;${i % 2 === 0 ? 'background:#f9f9f9;' : ''}">
            <code style="color:#1976d2;font-weight:bold;">${e.time}</code> → <code style="color:#388e3c;">${e.eventName}</code>
            ${e.data ? `<br /><code style="color:#666;font-size:0.85em;">${JSON.stringify(e.data).slice(0, 150)}</code>` : ''}
          </div>
        `).join('');
        logEl.scrollTop = logEl.scrollHeight;
      };

      // Hook into bus internal _dispatch method
      if (bus && typeof bus.emit === 'function') {
        const originalEmit = bus.emit.bind(bus);
        bus.emit = function(eventName, data) {
          try {
            addEventLog(eventName, data);
            refreshEventLog();
          } catch (err) {
            console.error('[Devtools Monitor] Error logging event:', err);
          }
          return originalEmit(eventName, data);
        };
      }

      // Initialize event monitoring
      await loadEventLogs();
      refreshEventLog();

      container.querySelector('#fme-eventbus-filter')?.addEventListener('keyup', refreshEventLog, { signal });

      container.querySelector('#fme-eventbus-clear-log')?.addEventListener('click', async () => {
        eventLog.length = 0;
        container.querySelector('#fme-eventbus-count').textContent = 'Events: 0';
        refreshEventLog();
        await Utils.Storage.remove([EVENT_LOG_KEY]);
      }, { signal });

      container.querySelector('#fme-eventbus-export')?.addEventListener('click', () => {
        const csv = 'Time,Event,Data\n' + eventLog.map(e => `"${e.time}","${e.eventName}","${JSON.stringify(e.data).replace(/"/g, '\\"')}"`).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fme-events-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }, { signal });

      // Test event button
      container.querySelector('#fme-eventbus-test')?.addEventListener('click', () => {
        bus.emit('fme:devtools:test-event', { 
          timestamp: new Date().toISOString(),
          message: 'This is a test event from devtools'
        });
      }, { signal });

      // ── Storage Quota Inspector ────────────────────────────────────────────────
      const updateQuotaInfo = async () => {
        const all = await Storage.getAll();
        const entries = Object.entries(all);
        
        // Estimate storage size (rough calculation)
        let totalBytes = 0;
        const breakdown = {};

        entries.forEach(([key, value]) => {
          const json = JSON.stringify(value);
          const bytes = new Blob([json]).size;
          totalBytes += bytes;
          breakdown[key] = bytes;
        });

        const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
        const quotaMB = 10;
        const percent = Math.round((totalBytes / (quotaMB * 1024 * 1024)) * 100);
        const isWarning = percent > 80;

        const totalEl = container.querySelector('#fme-quota-total');
        const percentEl = container.querySelector('#fme-quota-percent');
        const breakdownEl = container.querySelector('#fme-quota-breakdown');

        if (totalEl) totalEl.textContent = `${totalMB} MB`;
        if (percentEl) {
          percentEl.textContent = `${percent}%`;
          percentEl.parentElement.style.background = isWarning ? '#ffebee' : '#e8f5e9';
          percentEl.parentElement.style.borderLeftColor = isWarning ? '#c62828' : '#388e3c';
        }

        if (breakdownEl) {
          const sorted = Object.entries(breakdown)
            .sort(([,a], [,b]) => b - a)
            .map(([key, bytes]) => {
              const mb = (bytes / 1024 / 1024).toFixed(3);
              const pct = ((bytes / totalBytes) * 100).toFixed(1);
              return `<div style="margin:4px 0;padding:6px;background:white;border-radius:2px;display:flex;justify-content:space-between;"><code style="flex:1;">${key}</code> <code>${mb}MB (${pct}%)</code></div>`;
            });
          breakdownEl.innerHTML = sorted.join('');
        }
      };

      updateQuotaInfo();

      container.querySelector('#fme-quota-refresh')?.addEventListener('click', updateQuotaInfo, { signal });
    },

    sections: {
      'default': async (el, { bus, signal }) => {
        // Periodic refresh pentru Storage Quota (every 5 seconds)
        const quotaRefreshInterval = setInterval(async () => {
          const updateQuotaInfo = async () => {
            const all = await Storage.getAll();
            const entries = Object.entries(all);
            
            let totalBytes = 0;
            const breakdown = {};

            entries.forEach(([key, value]) => {
              const json = JSON.stringify(value);
              const bytes = new Blob([json]).size;
              totalBytes += bytes;
              breakdown[key] = bytes;
            });

            const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
            const quotaMB = 10;
            const percent = Math.round((totalBytes / (quotaMB * 1024 * 1024)) * 100);
            const isWarning = percent > 80;

            const totalEl = el.querySelector('#fme-quota-total');
            const percentEl = el.querySelector('#fme-quota-percent');
            const breakdownEl = el.querySelector('#fme-quota-breakdown');

            if (totalEl) totalEl.textContent = `${totalMB} MB`;
            if (percentEl) {
              percentEl.textContent = `${percent}%`;
              percentEl.parentElement.style.background = isWarning ? '#ffebee' : '#e8f5e9';
              percentEl.parentElement.style.borderLeftColor = isWarning ? '#c62828' : '#388e3c';
            }

            if (breakdownEl) {
              const sorted = Object.entries(breakdown)
                .sort(([,a], [,b]) => b - a)
                .map(([key, bytes]) => {
                  const mb = (bytes / 1024 / 1024).toFixed(3);
                  const pct = ((bytes / totalBytes) * 100).toFixed(1);
                  return `<div style="margin:4px 0;padding:6px;background:white;border-radius:2px;display:flex;justify-content:space-between;"><code style="flex:1;">${key}</code> <code>${mb}MB (${pct}%)</code></div>`;
                });
              breakdownEl.innerHTML = sorted.join('');
            }
          };
          
          await updateQuotaInfo();
        }, 5000);

        // Cleanup on section unload
        abort.addEventListener('abort', () => {
          clearInterval(quotaRefreshInterval);
        });

        // Listen to storage changes from other tabs/pages
        bus.on('storage:updated', async () => {
          // Refresh quota when storage changes
          const updateQuotaInfo = async () => {
            const all = await Storage.getAll();
            const entries = Object.entries(all);
            
            let totalBytes = 0;
            entries.forEach(([key, value]) => {
              const json = JSON.stringify(value);
              const bytes = new Blob([json]).size;
              totalBytes += bytes;
            });

            const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
            const quotaMB = 10;
            const percent = Math.round((totalBytes / (quotaMB * 1024 * 1024)) * 100);

            const totalEl = el.querySelector('#fme-quota-total');
            const percentEl = el.querySelector('#fme-quota-percent');
            if (totalEl) totalEl.textContent = `${totalMB} MB`;
            if (percentEl) percentEl.textContent = `${percent}%`;
          };
          await updateQuotaInfo();
        });
      }
    }
  };
});
