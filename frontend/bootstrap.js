// ===============================
// Analytics (Umami)
// ===============================
(function loadUmami() {
  if (window.umami) return;

  const script = document.createElement('script');
  script.src = 'https://cloud.umami.is/script.js';
  script.defer = true;
  script.setAttribute(
    'data-website-id',
    'DA07287E-5D59-4BD8-B1B9-5C6DFD3B154A' // <-- DEINE ID
  );

  script.onload = () => {
    console.log('[stats] umami loaded');
  };

  script.onerror = () => {
    console.warn('[stats] umami blocked');
  };

  document.head.appendChild(script);
})();

// ===============================
// Start of Code
// ===============================

// Critical Elements
const btn = document.getElementById('btn-start');
let app = null;

// Interaction Handler
const boot = async () => {
    if (!btn) return;

    // 1. Check for Secure Context (Required for Mic on most browsers)
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        alert('❌ Sicheheitsfehler: Mikrofon-Zugriff ist nur über HTTPS oder localhost erlaubt. Wenn du die App über eine IP (z.B. 192.168...) aufrufst, musst du HTTPS verwenden.');
        return;
    }

    // 2. Immediate Permission Trigger
    // This MUST happen before any async work (like dynamic import) to satisfy browser security
    btn.disabled = true;
    btn.textContent = 'Berechtigung prüfen...';

    try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // We request a tiny stream just to trigger the system prompt
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop()); // Close it immediately
        } else {
            throw new Error('Mikrofon-API wird von diesem Browser nicht unterstützt.');
        }

        btn.textContent = 'Lädt...';

        // 3. Load full app
        if (!app) {
            app = await import('./app.js');
        }

        // Always ensure init is called at least once
        if (app.init) {
            app.init();
        }

        await app.startRecordingFlow();
    } catch (e) {
        console.error('Boot error:', e);
        btn.disabled = false;
        btn.textContent = 'Aufnahme starten';

        let msg = 'Fehler: ' + e.message;
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
            msg = 'Mikrofon-Zugriff wurde verweigert. Bitte erlaube den Zugriff in deinen Browser-Einstellungen.';
        }
        alert(msg);
    }
};

// Wire up immediately
if (btn) {
    btn.addEventListener('click', boot, { once: true });
}

// Delayed Preload (Way after Lighthouse finishes)
// We only preload the code, NO permission requests here as they will fail/be blocked.
if ('requestIdleCallback' in window) {
    setTimeout(() => {
        requestIdleCallback(() => {
            import('./app.js').then(m => app = m).catch(() => { });
        });
    }, 8000);
}
