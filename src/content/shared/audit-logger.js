'use strict';
import Storage from './storage.js';
import bus     from '../core/bus.js';

const AuditLogger = {
  async log(page, action, details = '', type = 'action') {
    try {
      const entry = { ts: new Date().toISOString(), page, action, details, type };
      await Storage.AuditLog.append(entry);
      bus.emit('fme:audit:new', entry);
    } catch { /* noop */ }
  },
};

export default AuditLogger;
