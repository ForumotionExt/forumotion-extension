'use strict';

import pageBuilder   from '../shared/adapter.js';
import Utils         from '../shared/utils.js';
import FM            from '../shared/forumotion.structure.js';
import { t }         from '../../i18n/index.js';
import bus           from '../core/bus.js';
import PluginManager from '../shared/plugin-manager/plugin-manager.js';
import Registry      from '../shared/plugin-manager/registry.js';


function _renderField(key, schema, current) {
  const value = current ?? schema.default ?? '';
  const id    = `fme-ps-${key}`;
  const label = schema.label ?? key;
  const desc  = schema.description
    ? `<br><small style="color:#999;font-size:11px">${schema.description}</small>`
    : '';

  let control = '';

  switch (schema.type) {
    case 'boolean':
      control = `
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="${id}" data-fme-field="${key}" ${value ? 'checked' : ''}>
          <span style="font-size:13px">${value
            ? t('pluginSettings.enabled', {}, 'Activat')
            : t('pluginSettings.disabled', {}, 'Dezactivat')
          }</span>
        </label>`;
      break;

    case 'number':
      control = `
        <input type="number" id="${id}" data-fme-field="${key}" value="${value}"
          ${schema.min !== undefined ? `min="${schema.min}"` : ''}
          ${schema.max !== undefined ? `max="${schema.max}"` : ''}
          class="inputtext" style="width:100px">
        ${schema.min !== undefined || schema.max !== undefined
          ? `<small style="color:#999;margin-left:6px">[${schema.min ?? '–'} – ${schema.max ?? '–'}]</small>`
          : ''}`;
      break;

    case 'select': {
      const options = (schema.options ?? [])
        .map(o => `<option value="${o.value}" ${String(value) === String(o.value) ? 'selected' : ''}>${o.label ?? o.value}</option>`)
        .join('');
      control = `<select id="${id}" data-fme-field="${key}">${options}</select>`;
      break;
    }

    case 'textarea':
      control = `
        <textarea id="${id}" data-fme-field="${key}" rows="${schema.rows ?? 4}"
          class="inputtext" style="width:95%;resize:vertical">${value}</textarea>`;
      break;

    case 'color':
      control = `
        <input type="color" id="${id}" data-fme-field="${key}"
          value="${value || '#000000'}" style="height:28px;cursor:pointer">`;
      break;

    default: // text
      control = `
        <input type="text" id="${id}" data-fme-field="${key}"
          value="${String(value).replace(/"/g, '&quot;')}"
          class="inputtext" style="width:95%"
          ${schema.placeholder ? `placeholder="${schema.placeholder}"` : ''}>`;
  }

  return `
    <tr class="${FM.ACP_DOM.CONTENT.ROW_ODD}">
      <td class="left" style="width:38%;vertical-align:top;padding-top:8px">
        <label for="${id}">${label}</label>${desc}
      </td>
      <td style="padding:6px 8px">${control}</td>
    </tr>`;
}

function _buildHeader(plugin) {
  const manifest = plugin.manifest ?? {};
  const hooks    = Array.isArray(manifest.hooks) ? manifest.hooks : (plugin.hooks ?? []);
  const active   = plugin.active === true;

  const hookBadges = hooks.map(h => {
    const color = h === 'acp' ? '#369fcf' : '#5cb85c';
    return `<span style="
      display:inline-block;padding:1px 7px;border-radius:2px;
      font-size:11px;background:${color};color:#fff;margin-right:4px">${h}</span>`;
  }).join('');

  const badgeStyle = active
    ? 'background:#5cb85c;color:#fff'
    : 'background:#d9534f;color:#fff';

  const toggleLabel = active
    ? t('pluginSettings.deactivate', {}, 'Dezactivează')
    : t('pluginSettings.activate',   {}, 'Activează');

  const tags = (manifest.tags ?? []).map(tag =>
    `<span style="font-size:11px;color:#888;margin-right:4px">#${tag}</span>`
  ).join('');

  return `
    <div style="background:#f7f7f7;border:1px solid #dae3e9;
                padding:14px 16px;margin-bottom:12px;border-radius:3px">
      <div style="display:flex;align-items:flex-start;
                  justify-content:space-between;flex-wrap:wrap;gap:10px">

        <div style="flex:1;min-width:200px">
          <div style="font-size:15px;font-weight:bold">
            <i class="fa ${FM.ACP_DOM.ICONS.PLUGIN}"></i>&nbsp;${plugin.name ?? plugin.id}
          </div>
          <div style="color:#777;font-size:12px;margin-top:3px">
            v${plugin.version ?? '?'}
            ${plugin.author   ? `&nbsp;·&nbsp;${plugin.author}` : ''}
            ${manifest.category ? `&nbsp;·&nbsp;${manifest.category}` : ''}
          </div>
          ${manifest.description
            ? `<p style="margin:6px 0 0;color:#555;font-size:13px">${manifest.description}</p>`
            : ''}
          <div style="margin-top:8px">${hookBadges}${tags}</div>
        </div>

        <div style="text-align:right;flex-shrink:0">
          <div style="margin-bottom:8px">
            <span id="fme-ps-active-badge"
              style="${badgeStyle};padding:3px 12px;border-radius:3px;font-size:12px">
              ${active
                ? t('pluginSettings.active',   {}, 'Activ')
                : t('pluginSettings.inactive', {}, 'Inactiv')}
            </span>
          </div>
          <input type="button"
            data-fme-action="toggle"
            value="${toggleLabel}"
            class="mainoption">
        </div>

      </div>
    </div>`;
}

function _buildSettings(manifest, currentSettings) {
  const schema = manifest?.settings ?? {};
  const keys   = Object.keys(schema);

  if (!keys.length) return '';

  const rows = keys.map(k => _renderField(k, schema[k], currentSettings?.[k])).join('');

  return `
    <fieldset>
      <legend>
        <i class="fa fa-sliders"></i>&nbsp;
        ${t('pluginSettings.settingsTitle', {}, 'Configurații')}
      </legend>
      <table class="${FM.ACP_DOM.CONTENT.TABLE}" style="width:100%">
        <tbody>${rows}</tbody>
      </table>
      <div style="text-align:right;padding:8px 4px 4px">
        <input type="button"
          data-fme-action="save-settings"
          value="${t('pluginSettings.save', {}, 'Salvează')}"
          class="mainoption">
      </div>
    </fieldset>
    <br>`;
}

function _buildStatus(plugin) {
  if (!plugin.lastError) {
    return `
      <fieldset>
        <legend>
          <i class="fa fa-info-circle"></i>&nbsp;Status
        </legend>
        <div style="padding:8px 12px">
          <i class="fa fa-check"></i>&nbsp;
          ${t('pluginSettings.noErrors', {}, 'Nicio eroare înregistrată.')}
        </div>
      </fieldset>
      <br>`;
  }

  const date = plugin.lastErrorAt
    ? new Date(plugin.lastErrorAt).toLocaleString()
    : '';

  return `
    <fieldset>
      <legend>
        <i class="fa fa-exclamation-triangle"></i>&nbsp;Status
      </legend>
      <div class="${FM.ACP_DOM.MESSAGES.ERROR}" style="padding:8px 12px">
        <strong>
          <i class="fa fa-times"></i>&nbsp;
          ${t('pluginSettings.lastError', {}, 'Ultima eroare')}
          ${date ? `<small style="font-weight:normal;color:#999"> — ${date}</small>` : ''}
        </strong><br>
        <code style="font-size:12px;color:#666;display:block;margin-top:4px; white-space:pre-wrap;word-break:break-all">${plugin.lastError}</code>
      </div>
    </fieldset>
    <br>`;
}

function _buildChangelog(manifest) {
  const log      = manifest?.changelog ?? {};
  const versions = Object.keys(log).sort((a, b) => b.localeCompare(a)); // ← descrescător

  if (!versions.length) return '';

  const rows = versions.map((v, i) => {
    const entry   = log[v];
    const date    = entry?.date    ?? '';
    const changes = entry?.changes ?? (typeof entry === 'string' ? [entry] : []);

    return `
      <tr class="${i % 2 === 0 ? FM.ACP_DOM.CONTENT.ROW_ODD : FM.ACP_DOM.CONTENT.ROW_EVEN}">
        <td style="width:15%;font-weight:bold;white-space:nowrap;vertical-align:top">
          v${v}
          ${date ? `<br><small style="color:#999;font-weight:normal">${date}</small>` : ''}
        </td>
        <td>
          <ul style="margin:0;padding-left:16px">
            ${changes.map(c => `<li>${c}</li>`).join('')}
          </ul>
        </td>
      </tr>`;
  }).join('');

  return `
    <fieldset>
      <legend>
        <i class="fa ${FM.ACP_DOM.ICONS.CHANGELOG}"></i>&nbsp;Changelog
      </legend>
      <table class="${FM.ACP_DOM.CONTENT.TABLE}" style="width:100%">
        <tbody>${rows}</tbody>
      </table>
    </fieldset>
    <br>`;
}

function _buildActions() {
  return `
    <fieldset>
      <legend>
        <i class="fa ${FM.ACP_DOM.ICONS.SETTINGS}"></i>&nbsp;
        ${t('pluginSettings.actions', {}, 'Acțiuni')}
      </legend>
      <div style="display:flex;gap:8px;padding:8px 4px">
        <input type="button"
          data-fme-action="update"
          value="${t('pluginSettings.update', {}, '⬆ Actualizează')}"
          class="mainoption">
        <input type="button"
          data-fme-action="uninstall"
          value="${t('pluginSettings.uninstall', {}, '🗑 Dezinstalează')}"
          style="background:#d9534f;color:#fff;border:none;padding:4px 12px;
                 border-radius:3px;cursor:pointer">
      </div>
    </fieldset>
    <br>`;
}

const PluginSettingsPage = {
  _pluginId: null,
  _cleanups: [],
  async render(entry = {}) {
    const id = entry.params?.id;

    if (!id) {
      return pageBuilder(
        `<div class="${FM.ACP_DOM.MESSAGES.ERROR}" style="padding:12px">
          <i class="fa ${FM.ACP_DOM.ICONS.WARNING}"></i>&nbsp;
          ${t('pluginSettings.missingId', {}, 'ID plugin lipsă. Navighează din lista de plugin-uri.')}
        </div>`,
        { url: 'plugin_settings', category: entry.category?.(), pageName: 'Plugin Settings' }
      );
    }

    this._pluginId = id;

    const plugin = await PluginManager.getById(id);

    entry.pageName    = plugin?.name ?? id;
    entry.description = plugin?.manifest?.description ?? '';
    
    if (!plugin) {
      return pageBuilder(
        `<div class="${FM.ACP_DOM.MESSAGES.ERROR}" style="padding:12px">
          <i class="fa ${FM.ACP_DOM.ICONS.WARNING}"></i>&nbsp;
          ${t('pluginSettings.notFound', {}, `Plugin-ul <strong>${id}</strong> nu a fost găsit.`)}
          <br><br>
          <a href="#" data-fme-action="back-to-plugins" style="color:#369fcf">
            ← ${t('pluginSettings.backToPlugins', {}, 'Înapoi la Plugins')}
          </a>
        </div>`,
        { url: 'plugin_settings', category: entry.category?.(), pageName: id }
      );
    }

    const manifest = plugin.manifest ?? {};
    const settings = plugin.settings ?? {};

    const content = [
      _buildHeader(plugin),
      _buildSettings(manifest, settings),
      _buildStatus(plugin),
      _buildChangelog(manifest),
      _buildActions(),
    ].join('');

    return pageBuilder(content, {
      url     : 'plugin_settings',
      category: entry.category?.(),
      pageName   : plugin.name ?? id,
      description: plugin.manifest?.description ?? '',
      breadcrumbs: [
        { label: t('nav.plugins', {}, 'ACP Plugins'), url: 'acp_plugins' },
        { label: plugin.name ?? id },
      ],
    });
  },

  setup(container) {
    // Curăță listeners anteriori (dacă pagina e re-randată)
    this._cleanups.forEach(fn => fn());
    this._cleanups = [];

    const onClick = async (e) => {
      const action = e.target.closest('[data-fme-action]')?.dataset?.fmeAction;
      if (!action) return;

      const id = this._pluginId;

      switch (action) {
        case 'toggle':
          await this._onToggle(id, e.target, container);
          break;

        case 'save-settings':
          await this._onSave(id, container);
          break;

        case 'update':
          await this._onUpdate(id, e.target.closest('[data-fme-action]'), container);
          break;

        case 'uninstall':
          await this._onUninstall(id, container);
          break;

        case 'back-to-plugins':
          e.preventDefault();
          bus.emit('fme:navigate', { section: 'plugins' });
          break;
      }
    };

    container.addEventListener('click', onClick);
    this._cleanups.push(() => container.removeEventListener('click', onClick));

    // Actualizare badge + buton după toggle (fără re-render complet)
    const offToggled = bus.on('plugin:toggled', ({ id, active }) => {
      if (id !== this._pluginId) return;

      const badge = container.querySelector('#fme-ps-active-badge');
      const btn   = container.querySelector('[data-fme-action="toggle"]');

      if (badge) {
        badge.textContent = active
          ? t('pluginSettings.active',   {}, 'Activ')
          : t('pluginSettings.inactive', {}, 'Inactiv');
        badge.style.background = active ? '#5cb85c' : '#d9534f';
      }

      if (btn) {
        btn.value = active
          ? t('pluginSettings.deactivate', {}, 'Dezactivează')
          : t('pluginSettings.activate',   {}, 'Activează');
        btn.disabled = false;
      }
    });
    this._cleanups.push(offToggled);

    // Navigare înapoi după dezinstalare
    const offUninstalled = bus.on('plugin:uninstalled', ({ id }) => {
      if (id !== this._pluginId) return;
      bus.emit('fme:navigate', { section: 'plugins' });
    });
    this._cleanups.push(offUninstalled);

    // Re-render după update reușit
    const offUpdated = bus.on('plugin:updated', ({ id }) => {
      if (id !== this._pluginId) return;
      bus.emit('fme:navigate', { section: `plugin_settings&id=${id}` });
    });
    this._cleanups.push(offUpdated);
  },

  async _onToggle(id, btn, container) {
    btn.disabled = true;
    try {
      await PluginManager.toggle(id);
      // badge + btn sunt actualizate de listener-ul 'plugin:toggled' din setup()
    } catch (err) {
      btn.disabled = false;
      this._showError(container, err.message);
    }
  },

  async _onSave(id, container) {
    // Colectează valorile tuturor câmpurilor cu data-fme-field
    const fields      = container.querySelectorAll('[data-fme-field]');
    const newSettings = {};

    fields.forEach(el => {
      const key = el.dataset.fmeField;
      newSettings[key] = el.type === 'checkbox' ? el.checked : el.value;
    });

    try {
      // Salvăm direct în record-ul plugin-ului, câmpul 'settings'
      await Registry.update(id, { settings: newSettings });
      this._showSuccess(container, t('pluginSettings.saved', {}, 'Setările au fost salvate.'));
    } catch (err) {
      this._showError(container, err.message);
    }
  },

  async _onUpdate(id, btn, container) {
    const originalValue = btn.value;
    btn.disabled        = true;
    btn.value           = t('pluginSettings.updating', {}, 'Se actualizează...');

    try {
      const { plugin, updated } = await PluginManager.update(id);

      if (!updated) {
        // Deja la zi
        this._showSuccess(container, t('pluginSettings.upToDate', {}, 'Plugin-ul este deja la ultima versiune.'));
        btn.disabled = false;
        btn.value    = originalValue;
        return;
      }

      // Actualizat cu succes
      this._showSuccess(container, `${t('pluginSettings.updateSuccess', {}, 'Actualizat la')} v${plugin.version} ✅`);

      setTimeout(() => {
        bus.emit('fme:navigate', { section: `plugin_settings&id=${id}` });
      }, 2000);

    } catch (err) {
      console.error(`[PluginSettings] Update failed for "${id}":`, err);
      this._showError(container, `${t('pluginSettings.updateFailed', {}, 'Actualizarea a eșuat:')} ${err.message}`);
      btn.disabled = false;
      btn.value    = originalValue;
    }
  },

  async _onUninstall(id, container) {
    const plugin      = await PluginManager.getById(id);
    const pluginName  = plugin?.name ?? id;
    const confirmed   = window.confirm(
      t('pluginSettings.confirmUninstall', {},
        `Ești sigur că vrei să dezinstalezi "${pluginName}"?\nAceastă acțiune nu poate fi anulată.`)
    );

    if (!confirmed) return;

    try {
      await PluginManager.uninstall(id);
      // 'plugin:uninstalled' → listener din setup() navighează la 'plugins'
    } catch (err) {
      this._showError(container, err.message);
      console.error(`[PluginSettings] Uninstall failed for "${id}":`, err);
    }
  },
  
  _showSuccess(container, msg) {
    this._showToast(container, msg, FM.ACP_DOM.MESSAGES.SUCCESS, FM.ACP_DOM.ICONS.CHECK);
  },

  _showError(container, msg) {
    this._showToast(container, msg, FM.ACP_DOM.MESSAGES.ERROR, FM.ACP_DOM.ICONS.WARNING);
  },

  _showToast(container, msg, cls, icon) {
    container.querySelector('.fme-ps-toast')?.remove();

    const toast = document.createElement('div');
    toast.className = `${cls} fme-ps-toast`;
    toast.innerHTML = `<i class="fa ${icon}"></i>&nbsp;${msg}`;

    // Inserăm toast-ul după header (primul div din container)
    const header = container.querySelector('.fme-page');
    if (header) header.insertAdjacentElement('beforebegin', toast);
    else        container.prepend(toast);

    setTimeout(() => toast.remove(), 4000);
  },

  async refresh() {
    return this.render({ params: { id: this._pluginId } });
  },

  destroy() {
    this._cleanups.forEach(fn => fn());
    this._cleanups = [];
    this._pluginId = null;
  },
};

export default PluginSettingsPage;