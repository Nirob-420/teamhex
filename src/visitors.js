const SESSION_KEY = 'hex-visit-v2';
const DEVICE_KEY = 'hex-device-visits-v2';
const session = {
  get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, value); } catch { /* Count still displays. */ } },
};
const local = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* Count still displays. */ } },
};

export function initVisitorCounter() {
  const panel = document.querySelector('#visitor-counter');
  if (!panel) return;
  const digits = panel.querySelector('#visitor-digits');
  const label = panel.querySelector('#visitor-label');
  const note = panel.querySelector('#visitor-note');
  const status = panel.querySelector('#visitor-status');
  const retry = panel.querySelector('#visitor-retry');
  let displayed = 0, busy = false, animationFrame = 0;

  function draw(count, mode) {
    const value = Math.max(0, Math.floor(count));
    const text = String(value).padStart(6, '0');
    if (digits.children.length !== text.length) {
      digits.replaceChildren(...[...text].map(() => {
        const window = document.createElement('span'); window.className = 'odometer-window';
        const reel = document.createElement('span'); reel.className = 'odometer-reel';
        for (let i = 0; i < 10; i++) { const digit = document.createElement('span'); digit.textContent = i; reel.append(digit); }
        window.append(reel); return window;
      }));
    }
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(() => {
      [...digits.children].forEach((window, index) => {
        const reel = window.firstElementChild;
        reel.style.transitionDelay = `${index * 65}ms`;
        reel.style.transform = `translateY(-${Number(text[index])}em)`;
      });
    });
    digits.dataset.count = String(value);
    digits.setAttribute('aria-label', `${value.toLocaleString()} ${mode === 'device' ? 'visits on this device' : mode === 'preview' ? 'local preview visits' : 'site visits'}`);
    displayed = value;
    panel.dataset.mode = mode;
    label.textContent = mode === 'preview' ? 'PREVIEW VISITS' : mode === 'device' ? 'VISITS ON THIS DEVICE' : 'TOTAL SITE VISITS';
    note.textContent = mode === 'preview' ? 'Local preview count. Your live site starts its own shared count.' : mode === 'device' ? 'Shared counter unavailable. This count is saved only on your device.' : 'One visit per browser session. Shared across devices, saved across deploys.';
    status.textContent = mode === 'preview' ? 'LOCAL PREVIEW' : mode === 'device' ? 'DEVICE ONLY' : 'CONNECTED';
    retry.hidden = true;
  }

  function deviceFallback() {
    let count = Number(local.get(DEVICE_KEY) || displayed) || 0;
    if (session.get(SESSION_KEY) !== 'device') {
      count += 1; local.set(DEVICE_KEY, String(count)); session.set(SESSION_KEY, 'device');
    }
    draw(count, 'device');
  }

  async function load() {
    if (busy) return;
    busy = true; retry.hidden = true; status.textContent = 'CONNECTING';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const alreadyCounted = session.get(SESSION_KEY) === 'live' || session.get(SESSION_KEY) === 'preview';
      const response = await fetch(`/api/visits${alreadyCounted ? '?read=1' : ''}`, {
        method: alreadyCounted ? 'GET' : 'POST',
        headers: { Accept: 'application/json' },
        cache: 'no-store', signal: controller.signal,
      });
      if (response.status === 404 || response.headers.get('X-Visitor-API') !== 'hex-v2') {
        deviceFallback(); return;
      }
      if (!response.ok) throw new Error('Counter unavailable');
      const data = await response.json();
      if (!Number.isSafeInteger(data.count) || data.count < 0 || !['live', 'preview'].includes(data.mode)) throw new Error('Invalid counter');
      if (!alreadyCounted) session.set(SESSION_KEY, data.mode);
      draw(data.count, data.mode);
    } catch {
      if (displayed > 0) {
        status.textContent = 'RECONNECTING'; retry.hidden = false;
      } else deviceFallback();
    } finally {
      clearTimeout(timeout); busy = false;
    }
  }
  retry.addEventListener('click', load);
  load();
}
