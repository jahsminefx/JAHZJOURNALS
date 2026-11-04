const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * VPN & Proxy Detection Service for JAHZJOURNALS
 * 
 * Provides privacy-preserving, resilient VPN/proxy detection using:
 * 1. Edge proxy / CDN signals (Cloudflare Tor T1, threat scores, proxy headers).
 * 2. Pluggable remote detection providers (e.g. vpnapi.io, ipqualityscore, ipinfo).
 * 3. Short-lived in-memory LRU/TTL caching (hashed IPs, 10 min TTL) to avoid redundant lookups.
 * 4. Strict timeout guards (default 1500ms) with non-blocking graceful fallbacks.
 * 
 * In production (NODE_ENV === 'production'), client-supplied simulation parameters/headers
 * are strictly ignored.
 */

class VpnDetectionService {
  constructor(options = {}) {
    this.provider = options.provider || process.env.VPN_DETECTION_PROVIDER || 'none';
    this.apiKey = options.apiKey || process.env.VPN_DETECTION_API_KEY || null;
    this.timeoutMs = Number(options.timeoutMs || process.env.VPN_DETECTION_TIMEOUT_MS) || 1500;
    this.cacheTtlMs = Number(options.cacheTtlMs || process.env.VPN_DETECTION_CACHE_TTL_MS) || 600000; // 10 minutes
    this.maxCacheSize = Number(options.maxCacheSize) || 5000;

    // In-memory cache: ipHash -> { isVpn, isKnown, source, expiresAt }
    this.cache = new Map();

    // Periodic cleanup of expired cache entries
    this.cleanupInterval = setInterval(() => {
      this.evictExpired();
    }, 300000); // Clean every 5 minutes

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Hashes an IP address using SHA-256 for privacy-preserving cache keys.
   */
  hashIp(ip) {
    if (!ip) return 'unknown_ip';
    return crypto.createHash('sha256').update(String(ip).trim()).digest('hex').slice(0, 16);
  }

  /**
   * Evicts expired cache records and bounds cache size.
   */
  evictExpired() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (!value || value.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
    if (this.cache.size > this.maxCacheSize) {
      // Evict oldest 20% if cache exceeds bound
      const entriesToRemove = Math.floor(this.maxCacheSize * 0.2);
      let count = 0;
      for (const key of this.cache.keys()) {
        this.cache.delete(key);
        count++;
        if (count >= entriesToRemove) break;
      }
    }
  }

  /**
   * Extracts client IP address respecting trusted reverse proxy configuration.
   */
  getClientIp(req) {
    if (!req) return '127.0.0.1';
    if (req.ip) return req.ip;

    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      const list = String(forwarded).split(',');
      if (list[0]) return list[0].trim();
    }

    return req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1';
  }

  /**
   * Checks fast, zero-latency edge signals available on HTTP request headers.
   */
  checkEdgeSignals(req) {
    if (!req || !req.headers) {
      return { isVpn: false, isKnown: false, source: 'EDGE_NONE' };
    }

    const headers = req.headers;

    // 1. Cloudflare Tor Exit Node
    const cfCountry = headers['cf-ipcountry'];
    if (cfCountry && cfCountry.toUpperCase() === 'T1') {
      return { isVpn: true, isKnown: true, source: 'EDGE_CLOUDFLARE_TOR' };
    }

    // 2. Cloudflare High Threat Score (indicates proxy/anonymizer/scraper)
    const threatScore = parseInt(headers['cf-threat-score'], 10);
    if (!Number.isNaN(threatScore) && threatScore >= 40) {
      return { isVpn: true, isKnown: true, source: 'EDGE_CLOUDFLARE_THREAT_SCORE' };
    }

    // 3. Known Proxy / Anonymizer specific headers
    if (headers['x-proxy-id'] || headers['x-anonymous-proxy'] || headers['x-bluecoat-via']) {
      return { isVpn: true, isKnown: true, source: 'EDGE_PROXY_HEADER' };
    }

    return { isVpn: false, isKnown: false, source: 'EDGE_CLEAN' };
  }

  /**
   * Evaluates VPN / Proxy status for an incoming request.
   * 
   * Conceptual priority:
   * 1. Development/test simulation overrides (strictly non-production).
   * 2. Edge CDN / reverse-proxy signals.
   * 3. In-memory TTL cache lookup.
   * 4. External detection provider (if configured) with strict timeout.
   * 5. Safe fallback (no VPN detected).
   */
  async checkVpnStatus(req) {
    const isDev = process.env.NODE_ENV !== 'production';

    // 1. Development/Test Simulation (Strictly disabled in production)
    if (isDev) {
      if (req?.query?.simulateVpn === 'true' || req?.headers?.['x-simulate-vpn'] === 'true') {
        return { isVpn: true, isKnown: true, source: 'DEV_SIMULATION' };
      }
      if (req?.query?.simulateVpn === 'false' || req?.headers?.['x-simulate-vpn'] === 'false') {
        return { isVpn: false, isKnown: true, source: 'DEV_SIMULATION' };
      }
      if (req?.query?.simulateVpnTimeout === 'true') {
        return { isVpn: false, isKnown: false, source: 'DEV_SIMULATED_TIMEOUT', error: 'TIMEOUT' };
      }
      if (req?.query?.simulateVpnFailure === 'true') {
        return { isVpn: false, isKnown: false, source: 'DEV_SIMULATED_FAILURE', error: 'PROVIDER_HTTP_500' };
      }
      if (req?.query?.simulateVpnMalformed === 'true') {
        return { isVpn: false, isKnown: false, source: 'DEV_SIMULATED_MALFORMED', error: 'MALFORMED_JSON' };
      }
    }

    // 2. Edge CDN & Proxy Signals
    const edgeResult = this.checkEdgeSignals(req);
    if (edgeResult.isVpn) {
      return edgeResult;
    }

    // 3. Extract IP & check in-memory cache
    const ip = this.getClientIp(req);
    const ipHash = this.hashIp(ip);
    const cached = this.cache.get(ipHash);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return {
        isVpn: cached.isVpn,
        isKnown: cached.isKnown,
        source: `${cached.source}_CACHED`,
      };
    }

    // 4. If no external provider configured, return edge baseline safely
    if (this.provider === 'none' || !this.apiKey) {
      return {
        isVpn: false,
        isKnown: false,
        source: 'EDGE_ONLY_NO_EXTERNAL_PROVIDER',
      };
    }

    // 5. Remote Detection Provider with Strict Timeout Guard
    try {
      const providerResult = await this.queryProviderWithTimeout(ip);
      
      // Cache valid result
      this.cache.set(ipHash, {
        isVpn: providerResult.isVpn,
        isKnown: providerResult.isKnown,
        source: providerResult.source,
        expiresAt: now + this.cacheTtlMs,
      });

      return providerResult;
    } catch (err) {
      logger.warn('VPN detection provider error (falling back to edge baseline):', {
        provider: this.provider,
        error: err.message,
      });

      return {
        isVpn: false,
        isKnown: false,
        source: 'PROVIDER_ERROR_FALLBACK',
        error: err.name === 'AbortError' ? 'TIMEOUT' : err.message,
      };
    }
  }

  /**
   * Queries remote provider with strict timeout protection.
   */
  async queryProviderWithTimeout(ip) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let url = '';
      let headers = { Accept: 'application/json' };

      if (this.provider === 'vpnapi') {
        url = `https://vpnapi.io/api/${encodeURIComponent(ip)}?key=${encodeURIComponent(this.apiKey)}`;
      } else if (this.provider === 'ipqualityscore') {
        url = `https://ipqualityscore.com/api/json/ip/${encodeURIComponent(this.apiKey)}/${encodeURIComponent(ip)}?strictness=1`;
      } else if (this.provider === 'ipinfo') {
        url = `https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(this.apiKey)}`;
      } else {
        throw new Error(`Unsupported VPN detection provider: ${this.provider}`);
      }

      const res = await fetch(url, {
        signal: controller.signal,
        headers,
      });

      if (!res.ok) {
        throw new Error(`PROVIDER_HTTP_${res.status}`);
      }

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('MALFORMED_JSON');
      }

      let isVpn = false;

      if (this.provider === 'vpnapi') {
        const sec = data?.security;
        if (sec && (sec.vpn === true || sec.proxy === true || sec.tor === true || sec.relay === true)) {
          isVpn = true;
        }
      } else if (this.provider === 'ipqualityscore') {
        if (data?.vpn === true || data?.proxy === true || data?.tor === true || (typeof data?.fraud_score === 'number' && data.fraud_score >= 80)) {
          isVpn = true;
        }
      } else if (this.provider === 'ipinfo') {
        const privacy = data?.privacy;
        if (privacy && (privacy.vpn === true || privacy.proxy === true || privacy.tor === true || privacy.hosting === true)) {
          isVpn = true;
        }
      }

      return {
        isVpn,
        isKnown: true,
        source: `PROVIDER_${this.provider.toUpperCase()}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Helper for testing: clears cache.
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance along with the class for custom mocking
const defaultVpnService = new VpnDetectionService();

module.exports = defaultVpnService;
module.exports.VpnDetectionService = VpnDetectionService;
