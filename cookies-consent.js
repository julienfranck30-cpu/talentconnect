// cookies-consent.js
// Bandeau de consentement cookies avant chargement GA4 (art. 82 loi Informatique & Libertés)

(function() {
  const CONSENT_KEY = 'lmj_cookie_consent';
  const GA_ID = 'G-BMKHRFJ914';

  function hasConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY) === '1';
    } catch {
      return false;
    }
  }

  function setConsent() {
    try {
      localStorage.setItem(CONSENT_KEY, '1');
    } catch {}
  }

  function loadGA() {
    if (window.gtag) return; // déjà chargé
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
  }

  function showBanner() {
    if (hasConsent()) {
      loadGA();
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.innerHTML = `
      <div style="position:fixed;bottom:0;left:0;right:0;background:#13101f;border-top:1px solid rgba(168,85,247,0.3);padding:16px 24px;z-index:9999;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-family:'Manrope',sans-serif">
        <div style="flex:1;min-width:280px">
          <div style="font-size:14px;font-weight:700;color:#e8e8e0;margin-bottom:4px">🍪 Nous utilisons des cookies</div>
          <div style="font-size:12px;color:#888;line-height:1.5">Nous utilisons Google Analytics pour mesurer l'audience de notre site. Vous pouvez accepter ou refuser le dépôt de cookies.</div>
        </div>
        <div style="display:flex;gap:8px">
          <button id="cookie-accept" style="padding:10px 20px;border-radius:8px;background:linear-gradient(135deg,#A855F7,#22D3EE);border:none;color:#080612;font-size:13px;font-weight:700;cursor:pointer">Accepter</button>
          <button id="cookie-refuse" style="padding:10px 20px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,0.2);color:#888;font-size:13px;font-weight:700;cursor:pointer">Refuser</button>
        </div>
      </div>`;
    document.body.appendChild(banner);

    document.getElementById('cookie-accept').addEventListener('click', function() {
      setConsent();
      banner.remove();
      loadGA();
    });
    document.getElementById('cookie-refuse').addEventListener('click', function() {
      banner.remove();
      // GA n'est pas chargé
    });
  }

  // Exécuter au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }
})();
