import pageBuilder from '../shared/adapter.js';
import Utils       from '../shared/utils.js';
import FM          from '../shared/forumotion.structure.js';
import { t }       from '../../i18n/index.js';
import bus         from '../core/bus.js';

const BasePage = (pageName, renderFn) => {
  const _renderCleanups = [];
  const _setupCleanups  = [];

  let _setupFn         = null;
  let _sections        = null;
  let _entry           = {};
  let _params          = {};
  let _abortController = null;

  const _makeBus = (cleanupArray) => ({
    on(event, cb) {
      const off = bus.on(event, cb);
      cleanupArray.push(off);
      return off;
    },

    once(event, cb) {
      const off = bus.once(event, cb);
      cleanupArray.push(off);
      return off;
    },

    subscribe(event, cb) {
      const off = bus.subscribe(event, cb);
      if (typeof off === 'function') cleanupArray.push(off);
      return off;
    },

    emit:    (event, payload) => bus.emit(event, payload),
    request: (event, payload) => bus.request(event, payload),
  });

  const _runSections = async (container, signal, setupBus) => {
    if (!_sections) return;

    const tasks = Object.entries(_sections).map(async ([name, loader]) => {
      const el = container.querySelector(`[data-section="${name}"]`);
      if (!el) return;

      try {
        await loader(el, { signal, bus: setupBus, params: _params });
      } catch (err) {
        el.innerHTML = `<p class="fme-section-error">${err.message}</p>`;
        bus.emit('fme:section:error', { page: pageName, section: name, error: err.message });
      }
    });

    await Promise.allSettled(tasks);
  };

  return {
    async render(entry = {}, params = {}) {
      _renderCleanups.forEach(fn => fn());
      _renderCleanups.length = 0;
      _setupFn   = null;
      _sections  = null;
      _entry     = entry;
      _params = Object.keys(params).length
      ? params
      : (entry.params ?? {});

      const renderBus = _makeBus(_renderCleanups);

      try {
        const result  = await renderFn({ Utils, FM, t, bus: renderBus, params: _params });
        const content = result?.html ?? result;

        _setupFn  = result?.onMount ?? result?.setup ?? null;
        _sections = result?.sections ?? null;

        bus.emit('fme:section:render', {
          page: pageName,
          ts  : new Date().toISOString(),
        });

        return pageName === 'home'
          ? content
          : pageBuilder(content, {
              url        : entry.page,
              category   : entry.category?.(),
              pageName   : entry.label?.(),
              breadcrumbs: result?.breadcrumbs ?? null,
            });

      } catch (err) {
        bus.emit('fme:section:error', { page: pageName, error: err.message });

        const fallback = pageBuilder(`
          <div class="fme-error-boundary messagebox">
            <h3>${t('error.page_load', 'Eroare la încărcarea paginii')}</h3>
            <code>${err.message}</code>
          </div>`, {
          url     : entry.page,
          pageName: entry.label?.(),
          category: "FME"
        });

        return fallback;
      }
    },

    async setup(container) {
      _abortController?.abort();
      _setupCleanups.forEach(fn => fn());
      _setupCleanups.length = 0;

      _abortController = new AbortController();
      const { signal } = _abortController;

      const setupBus = _makeBus(_setupCleanups);

      if (_setupFn) {
        await _setupFn(container, { signal, bus: setupBus, params: _params });
      }

      await _runSections(container, signal, setupBus);
    },

    async refresh() {
      return this.render(_entry, _params);
    },

    destroy() {
      _abortController?.abort();
      _abortController = null;
      _renderCleanups.forEach(fn => fn());
      _renderCleanups.length = 0;
      _setupCleanups.forEach(fn => fn());
      _setupCleanups.length = 0;
      _setupFn  = null;
      _sections = null;
    },
  };
};

export default BasePage;