import { RESOURCE_LIMITS } from '../../../config.js';

/**
 * ThemeRegistry
 * CRUD storage pentru teme — chrome.storage.local
 */
export class ThemeRegistry {
  static STORAGE_KEY = 'fme_themes';
  static ACTIVE_KEY  = 'fme_active_theme';

  // ── Read ───────────────────────────────────────────────────────────────────

  async getAll(filters = {}) {
    const { tag, active } = filters;
    const data  = await this._load();
    let themes  = Object.values(data);

    if (active !== undefined) themes = themes.filter(t => t.active === active);
    if (tag)                  themes = themes.filter(t => t.meta?.tags?.includes(tag));

    return themes;
  }

  async get(id) {
    const data = await this._load();
    return data[id] ?? null;
  }

  async getActive() {
    const result = await chrome.storage.local.get(ThemeRegistry.ACTIVE_KEY);
    const id     = result[ThemeRegistry.ACTIVE_KEY];
    return id ? this.get(id) : null;
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  async save(theme) {
    const data = await this._load();
    const now  = new Date().toISOString();

    if (!theme.id) {
      if (Object.keys(data).length >= RESOURCE_LIMITS.ACP_THEMES) {
        throw new Error(
          `Limita de ${RESOURCE_LIMITS.ACP_THEMES} teme a fost atinsă. Șterge o temă existentă înainte de a adăuga una nouă.`
        );
      }
      theme.id           = `theme_${Date.now()}`;
      theme.meta         = theme.meta ?? {};
      theme.meta.created_at = now;
    }

    theme.meta          = theme.meta ?? {};
    theme.meta.updated_at = now;
    data[theme.id]      = theme;

    await this._store(data);
    return theme;
  }

  async remove(id) {
    const data = await this._load();
    delete data[id];
    await this._store(data);
  }

  // ── Active state ───────────────────────────────────────────────────────────

  async setActive(id) {
    const data = await this._load();
    for (const t of Object.values(data)) t.active = (t.id === id);
    await this._store(data);
    await chrome.storage.local.set({ [ThemeRegistry.ACTIVE_KEY]: id });
  }

  async deactivateAll() {
    const data = await this._load();
    for (const t of Object.values(data)) t.active = false;
    await this._store(data);
    await chrome.storage.local.remove(ThemeRegistry.ACTIVE_KEY);
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  async _load() {
    const result = await chrome.storage.local.get(ThemeRegistry.STORAGE_KEY);
    return result[ThemeRegistry.STORAGE_KEY] ?? {};
  }

  async _store(data) {
    await chrome.storage.local.set({ [ThemeRegistry.STORAGE_KEY]: data });
  }
}