/**
 * @file bus.js
 * @description A simple event bus implementation for inter-component communication.
 * @author Staark
 * @version 1.0.0
 * @license MIT
 */


/**
 * EventBus class for managing custom events and listeners.
 * Provides methods to subscribe, emit, and unsubscribe from events.
 * Also includes a method to clear all listeners for specific or all events.
 */
const SW_EVENTS = new Set([
  'kernel:ready',
  'kernel:error',

  'fetch:version',
  'fetch:changelog',
  'fetch:announcements',
  'fetch:latest',
  'update:check',
  'update:available',

  'backup:export',
  'backup:import',

  'settings:update',
  'settings:reset',
  'settings:export',
  'settings:import',

  'theme:change',
  'theme:install',
  'theme:uninstall',
  'theme:activate',
  'theme:deactivate',

  'acp:setting:update',
  'acp:setting:reset',

  'fme:navigate',
  'fme:render',
  'fme:error',
  'fme:ready',
  'fme:section:change',
  'fme:section:render',
  'fme:section:error',
  'fme:api:request',
  'fme:api:response',
  'fme:api:error',

  'plugin:installing',
  'plugin:installed',
  'plugin:uninstalling',
  'plugin:uninstalled',
  'plugin:toggled',
  'plugin:updating',
  'plugin:updated',
  'plugin:up-to-date',
  'plugin:executed',
  'plugin:ejected',
  'plugin:error',
  'plugin:acp:ready',

  'fme:plugins:changed',
  'fme:plugins:reset',

]);

class EventBus {
  #events  = new Map();
  #context = null;

  constructor(context = null) {
    this.#context = context;
    this.events = {};

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message?.__fme_bus) {
          this.#handleIncoming(message, sendResponse);
          return true; // async response
        }

        if (message && message.type && SW_EVENTS.has(message.type)) {
          this.emit(message.type, message.payload, sender);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Unknown event type' });
        }
      });
    }
  }

  on(event, callback) {
    if (!this.#events.has(event)) {
      this.#events.set(event, new Set());
    }

    this.#events.get(event).add(callback);
    return () => this.off(event, callback);
  }

  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  emit(event, payload) {
    this.#dispatch(event, payload);
  }

  subscribe(event, payload) {
    if (!SW_EVENTS.has(event)) {
      console.warn(`[FME Bus] "${event}" nu este în SW_EVENTS. Folosește emit() sau adaugă-l în SW_EVENTS.`);
    }
    this.#sendToSW(event, payload);
  }

  off(event, callback) {
    this.#events.get(event)?.delete(callback);
  }

  clear(event) {
    if (event) this.#events.delete(event);
    else       this.#events.clear();
  }

  count(event) {
    return this.#events.get(event)?.size ?? 0;
  }

  request(event, payload = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'bus:request', event, payload },
        response => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          if (response?.error) return reject(new Error(response.error));
          resolve(response?.data ?? response);
        }
      );
    });
  }

  #dispatch(event, payload) {
    this.#events.get(event)?.forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[FME Bus] Error in "${event}":`, err);
      }
    });
  }

  #sendToSW(event, payload) {
    chrome.runtime.sendMessage({
      __fme_bus: true,
      event,
      payload,
      from     : this.#context,
      timestamp: Date.now(),
    }).catch(err => {
      console.error(`[FME Bus] SW send error for "${event}":`, err);
    });
  }

  async #broadcastToTabs(event, payload) {
    if (this.#context !== 'service-worker') return;

    const tabs = await chrome.tabs.query({
      url: [
        '*://*.forumgratuit.ro/admin*',
        '*://*.forumotion.com/admin*',
        '*://*.forumotion.net/admin*',
        '*://*.forumotion.eu/admin*',
      ]
    });

    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        __fme_bus: true,
        event,
        payload,
        from     : 'service-worker',
        timestamp: Date.now(),
      }).catch(() => {}); // tab poate fi închis
    }
  }

  async #handleIncoming(message, sendResponse) {
    const { event, payload, from } = message;

    if (this.#context === 'service-worker') {
      // SW primește de la content → procesează și broadcast înapoi
      this.#dispatch(event, payload);
      await this.#broadcastToTabs(event, payload);
      sendResponse({ ok: true });
    } else {
      // Content script primește de la SW → dispatch local
      this.#dispatch(event, payload);
      sendResponse({ ok: true });
    }
  }
}

const isServiceWorker = typeof window === 'undefined';

export const bus = new EventBus(isServiceWorker ? 'service-worker' : 'content');
export default bus;