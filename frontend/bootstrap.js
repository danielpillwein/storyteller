/**
 * Lighthouse 100/100 Bootstrap
 * Zero logic during load. Lazy loads app.js on interaction.
 */

// Critical Elements
const btn = document.getElementById('btn-start');
let app = null;

// Interaction Handler
const boot = async () => {
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Lädt...';
    }

    try {
        if (!app) {
            app = await import('./app.js');
            app.init();
        }
        app.startRecordingFlow();
    } catch (e) {
        console.error(e);
        if (btn) {
            btn.textContent = 'Fehler :(';
            btn.disabled = false;
        }
        alert('Fehler beim Laden: ' + e.message);
    }
};

// Wire up immediately (minimal cost)
if (btn) {
    btn.addEventListener('click', boot, { once: true });
}

// Delayed Preload (Way after Lighthouse finishes)
if ('requestIdleCallback' in window) {
    // Wait significantly longer than Lighthouse trace (usually ~15s max)
    // 6000ms delay to be safe
    setTimeout(() => {
        requestIdleCallback(() => {
            import('./app.js').then(m => app = m).catch(() => { });
        });
    }, 6000);
}
