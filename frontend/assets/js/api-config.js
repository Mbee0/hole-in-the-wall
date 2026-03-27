// API base URL for fetch() calls. Local dev: Flask on :5000. Production: HTTPS only (no mixed content).
// Optional: set window.APP_API_BASE_OVERRIDE before this script (see inline snippet in HTML <head>).
(function () {
  const host = window.location.hostname || '';
  const isLocalDev = host === 'localhost' || host === '127.0.0.1';
  const PROD_API_BASE = 'https://hole-in-the-wall.onrender.com/api';

  function resolveApiBase() {
    if (window.APP_API_BASE_OVERRIDE) return window.APP_API_BASE_OVERRIDE;
    // Never use http:// on a real HTTPS page (avoids mixed-content if an old bundle was cached).
    if (window.location.protocol === 'https:' && !isLocalDev) {
      return PROD_API_BASE;
    }
    if (isLocalDev) return 'http://' + host + ':5000/api';
    return PROD_API_BASE;
  }

  window.getApiBase = resolveApiBase;
})();
