'use strict';

/**
 * @file github.api.js
 * @description GitHub API client cu cache TTL — evită rate limiting (60 req/h unauthenticated).
 */
import { GITHUB, CACHE_TTL } from '../config.js';

class GithubService {
  #apiBase  = GITHUB.API_BASE;
  #rawBase  = GITHUB.RAW_BASE;
  #cache    = new Map();

  constructor({
    repoOwner = GITHUB.OWNER,
    repoName  = GITHUB.REPO,
    branch    = GITHUB.BRANCH,
  } = {}) {
    this.repoOwner = repoOwner;
    this.repoName  = repoName;
    this.branch    = branch;
  }

  // ─── Cache intern ─────────────────────────────────────────────────────────

  async #cached(key, ttlMs, fetcher) {
    const hit = this.#cache.get(key);
    if (hit && Date.now() < hit.expiresAt) return hit.data;

    const data = await fetcher();
    this.#cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  }

  invalidate(key) {
    if (key) this.#cache.delete(key);
    else     this.#cache.clear();
  }

  // ─── API ──────────────────────────────────────────────────────────────────

  /**
   * Fetch-uiește ultimul release de pe GitHub.
   * Cache: 5 minute.
   * @returns {{ version: string, changelog: string, url: string }}
   */
  async fetchLatestRelease() {
    return this.#cached('latest-release', CACHE_TTL.GITHUB_RELEASE, async () => {
      const url      = `${this.#apiBase}/repos/${this.repoOwner}/${this.repoName}/releases/latest`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        version  : data.tag_name?.replace(/^v/, '') ?? null,
        changelog: data.body    ?? null,
        url      : data.html_url ?? null,
      };
    });
  }

  /**
   * Fetch-uiește conținutul unui fișier din repo (raw).
   * Cache: 10 minute.
   * @param {string} path  - calea fișierului în repo, ex: 'version.json'
   * @returns {string}     - conținut text
   */
  async fetchFile(path) {
    return this.#cached(`file:${path}`, CACHE_TTL.GITHUB_FILE, async () => {
      const url      = `${this.#rawBase}/${this.repoOwner}/${this.repoName}/${this.branch}/${path}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`GitHub raw error: ${response.status} for "${path}"`);
      }

      return response.text();
    });
  }

  async fetchJsonFile(path) {
    return this.#cached(`file:${path}`, CACHE_TTL.GITHUB_FILE, async () => {
      const url      = `${this.#rawBase}/${this.repoOwner}/${this.repoName}/${this.branch}/${path}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`GitHub raw error: ${response.status} for "${path}"`);
      }

      return response.json();
    });
  }

  async fetchFileFrom(...args) {
    const last = args.at(-1);
    const hasOptions = typeof last === 'object' && !Array.isArray(last);

    const options = hasOptions ? args.pop() : {};
    const { repo = '', type = 'json', cacheTtlMs = 10 * 60 * 1000 } = options;

    const path = args.join('/');

    return this.#cached(`file:${repo}:${path}`, cacheTtlMs, async () => {
      const url = `${this.#rawBase}/${this.repoOwner}/${repo || this.repoName}/${this.branch}/${path}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`GitHub raw error: ${response.status} for "${path}"`);
      }

      return type === 'text'
        ? response.text()
        : response.json();
    });
  }
}

// Singleton pre-configurat pentru extensie
const Github = new GithubService();

export default Github;
export { GithubService };