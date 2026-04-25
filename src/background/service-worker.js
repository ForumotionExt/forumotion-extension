'use strict';

import { initRouter, prefetchOnStartup } from './sw.router.js';

initRouter();

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    const { version } = chrome.runtime.getManifest();
    await chrome.storage.local.set({ fme_install_version: version });
    console.log(`[FME SW] Instalat v${version}`);
  }

  await prefetchOnStartup();
});

chrome.runtime.onStartup.addListener(async () => {
  await prefetchOnStartup();
});
