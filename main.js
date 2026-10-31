// Effendi Kebab · Scroll-Film, Glut-Partikel, weiches Scrollen
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => innerWidth < 900;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

gsap.registerPlugin(ScrollTrigger);

let lenis = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); lenis.scrollTo(target); }
  }));
}

/* ---------- Scroll-Film ----------
   Echte Bilder: Frames als f_0001.webp … in assets/seq-desktop (16:9) und assets/seq-mobile (9:16)
   ablegen und count eintragen. Bei count 0 läuft die gezeichnete Platzhalter-Animation. */
const SEQ = {
  desktop: { path: 'assets/seq-desktop/', count: 153 },
  // Handy: nur jedes 2. Bild laden (halbe Datenmenge, ~3 MB), die Lücken füllt die Suche nach dem nächsten Bild
  mobile: { path: 'assets/seq-mobile/', count: 153, step: 2 },
};

// Zwischenlösung bis zu den Videos: drei Keyframes (Spieß, Explosion, fertiger Döner) mit Überblendung
const KEYS = {
  desktop: ['assets/keys/k1.webp', 'assets/keys/k2.webp', 'assets/keys/k3.webp'],
  mobile: ['assets/keys/k1-m.webp', 'assets/keys/k2-m.webp', 'assets/keys/k3-m.webp'],
};

const canvas = document.querySelector('.story__canvas');
const ctx = canvas.getContext('2d');
const phases = [...document.querySelectorAll('.phase')];
const bar = document.querySelector('.story__progress span');
let frames = [];
let keys = [];
let progress = 0;
let W = 0, H = 0;

// Ladereihenfolge grob → fein (jedes 8., dann 4., 2., alle): der Film ist früh komplett scrollbar und wird dann dichter
function loadOrder(n, minStep = 1) {
  const order = [], seen = new Set();
  if (!n) return order;
  for (const step of [8, 4, 2, 1].filter((s) => s >= minStep)) {
    for (let i = 0; i < n; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
  }
  if (!seen.has(n - 1)) order.push(n - 1);
  return order;
}

/* ---------- Vorzeichnen ----------
   Ein Bild beim ersten drawImage auszupacken kostet auf schwachen Geräten bis zu 100 ms und ruckelt. Darum jedes Bild
   einmal unsichtbar vorzeichnen, aber nur in Leerlaufzeiten und eins nach dem anderen, Bilder nahe der Scrollposition
   zuerst. Die ersten 4 sofort (für den Start), alle anderen ab der ersten Bedienung oder nach 10 s, damit das
   Laden der Seite selbst nicht blockiert wird. */
const warm = document.createElement('canvas').getContext('2d');
const toWarm = new Set();
let warmAllowed = false, warmQueued = false;
const idle = window.requestIdleCallback || ((cb) => setTimeout(() => cb({ timeRemaining: () => 8 }), 50));

function scheduleWarm() {
  if (warmQueued || !toWarm.size) return;
  warmQueued = true;
  idle(warmStep, { timeout: 1000 });
}

function warmStep(deadline) {
  warmQueued = false;
  const target = Math.round(clamp(progress / 0.9) * (frames.length - 1));
  do {
    let best = -1, bestDist = Infinity;
    for (const i of toWarm) {
      if (!warmAllowed && i >= 4) continue;
      // vorwärts (Scrollrichtung) leicht bevorzugen
      const dist = i >= target ? i - target : (target - i) * 1.5;
      if (dist < bestDist) { best = i; bestDist = dist; }
    }
    if (best < 0) return;
    warm.drawImage(frames[best], 0, 0, 1, 1);
    toWarm.delete(best);
  } while (deadline.timeRemaining() > 12);
  scheduleWarm();
}

function allowWarm() {
  if (warmAllowed) return;
  warmAllowed = true;
  scheduleWarm();
}
['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll'].forEach((ev) =>
  addEventListener(ev, allowWarm, { once: true, passive: true }));
setTimeout(allowWarm, 10000);

/* ---------- Ladeanzeige ----------
   Bleibt stehen, bis die grobe Stufe (jedes 8. Bild) geladen ist: dann ist der ganze Film ohne Lücken scrollbar.
   Spätestens nach 5 s geht sie trotzdem weg, damit niemand auf ein langsames Netz warten muss. */
const loader = document.querySelector('.loader');
const loaderBar = document.querySelector('.loader__bar i');
let loaderGoal = 0, loaderCount = 0, loaderDone = false;

function finishLoader() {
  if (loaderDone) return;
  loaderDone = true;
  loader.classList.add('is-done');
  document.documentElement.classList.remove('is-loading');
  if (lenis) lenis.start();
  render();
  dispatchEvent(new Event('effendi:ready'));
}

function tickLoader() {
  loaderCount++;
  loaderBar.style.transform = `scaleX(${clamp(loaderCount / loaderGoal)})`;
  if (loaderCount >= loaderGoal) setTimeout(finishLoader, 250);
}

if (lenis) lenis.stop();
setTimeout(finishLoader, 5000);

function loadFrames() {
  const seq = isMobile() ? SEQ.mobile : SEQ.desktop;
  frames = Array.from({ length: seq.count }, () => new Image());
  let next = 0;
  const order = loadOrder(seq.count, seq.step);
  loaderGoal = Math.ceil(seq.count / 8);
  if (!loaderGoal) finishLoader();
  const loadNext = () => {
    if (next >= order.length) return;
    const i = order[next++];
    const img = frames[i];
    img.decoding = 'async';
    img.onload = img.onerror = () => {
      (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => {
        if (ready(img)) { toWarm.add(i); scheduleWarm(); }
        if (i === 0) render();
        if (!loaderDone && i % 8 === 0) tickLoader();
        loadNext();
      });
    };
    img.src = `${seq.path}f_${String(i + 1).padStart(4, '0')}.webp`;
  };
  for (let k = 0; k < 6; k++) loadNext(); // 6 parallele Downloads
  // Standbilder nur laden, wenn es keine Sequenz gibt: ihr erstes Bild ist ohnehin K1
  if (seq.count) return;
  keys = (isMobile() ? KEYS.mobile : KEYS.desktop).map((src) => {
    const img = new Image();
    img.src = src;
    img.onload = render;
    return img;
  });
}

const ready = (img) => img && img.complete && img.naturalWidth > 0;

function resize() {
  // 1,5 reicht für Fotomaterial und spart ein Drittel Zeichenarbeit gegenüber 2
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

function drawCover(img) {
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function render() {
  if (frames.length) {
    // Film endet bei 90 % Scroll, danach steht der fertige Döner; falls das genaue Bild noch lädt, das letzte geladene nehmen
    const target = Math.round(clamp(progress / 0.9) * (frames.length - 1));
    // nächstes geladenes Bild in beide Richtungen suchen
    let i = target;
    for (let d = 1; !ready(frames[i]) && d < frames.length; d++) {
      if (ready(frames[target - d])) i = target - d;
      else if (ready(frames[target + d])) i = target + d;
    }
    if (ready(frames[i])) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      drawKey(frames[i], 1, 1);
      fadeMobile();
      return;
    }
  }
  if (keys.length && keys.every(ready)) { drawKeys(progress); return; }
  drawPlaceholder(progress);
}

/* Keyframes: K1 → K2 → K3, jeweils mit leichtem Zoom; die Explosion schwebt sanft */
function drawKey(img, alpha, zoom, dy = 0) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (isMobile()) {
    // quadratischer Ausschnitt oben, Text darunter
    const size = Math.min(W, H * 0.6) * zoom;
    ctx.drawImage(img, (W - size) / 2, H * 0.31 - size / 2 + dy, size, size);
  } else {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom;
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    // vom rechten Bildrand aus zoomen, damit das Motiv nicht aus dem Bild wandert
    ctx.drawImage(img, W - w + (w - W) * 0.3, (H - h) / 2 + dy, w, h);
  }
  ctx.restore();
}

function drawKeys(p) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const toK2 = ease(0.33, 0.5, p);
  const toK3 = ease(0.72, 0.86, p);
  const float = Math.sin(p * 18) * 6;
  if (toK3 < 1) {
    // untere Ebene voll, die nächste blendet darüber: kein Abdunkeln in der Mitte
    if (toK2 < 1) drawKey(keys[0], 1, 1 + p * 0.12);
    if (toK2 > 0) drawKey(keys[1], toK2, 1.04 - ease(0.33, 0.72, p) * 0.04, float);
  }
  if (toK3 > 0) drawKey(keys[2], toK3, 1 + ease(0.72, 1, p) * 0.05);
  fadeMobile();
}

// harte Unterkante des quadratischen Handy-Bildes ausblenden
function fadeMobile() {
  if (isMobile()) {
    const size = Math.min(W, H * 0.6), bottom = H * 0.31 + size / 2;
    const g = ctx.createLinearGradient(0, bottom - size * 0.3, 0, bottom + 20);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fillRect(0, bottom - size * 0.3, W, H);
  }
}

/* Platzhalter: zeigt die Choreografie, bis die Higgsfield-Frames da sind */
function drawPlaceholder(p) {
  const mobile = isMobile();
  const cx = mobile ? W * 0.5 : W * 0.64;
  const cy = mobile ? H * 0.36 : H * 0.52;
  const s = Math.min(W, H) / 900;

  ctx.fillStyle = '#0b0a09';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(cx, cy + 260 * s, 10, cx, cy + 260 * s, 620 * s);
  g.addColorStop(0, `rgba(228,87,46,${0.45 - ease(0.5, 0.9, p) * 0.25})`);
  g.addColorStop(1, 'rgba(11,10,9,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 1 · Spieß (schrumpft, während die Spirale abfällt)
  const spit = 1 - ease(0.18, 0.5, p);
  if (spit > 0) {
    ctx.save();
    ctx.globalAlpha = spit;
    ctx.translate(cx, cy - 40 * s);
    ctx.fillStyle = '#9b9690';
    ctx.fillRect(-3 * s, -300 * s, 6 * s, 600 * s);
    const top = 120 * s, bot = 70 * s, h = 420 * s * (0.4 + 0.6 * spit);
    ctx.beginPath();
    ctx.moveTo(-top, -h / 2); ctx.lineTo(top, -h / 2); ctx.lineTo(bot, h / 2); ctx.lineTo(-bot, h / 2); ctx.closePath();
    const mg = ctx.createLinearGradient(-top, 0, top, 0);
    mg.addColorStop(0, '#4a2410'); mg.addColorStop(0.5, '#a3592a'); mg.addColorStop(1, '#3d1d0c');
    ctx.fillStyle = mg; ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(30,12,4,.45)'; ctx.lineWidth = 3 * s;
    for (let y = -h / 2 + ((p * 900) % 22) * s; y < h / 2; y += 22 * s) {
      ctx.beginPath(); ctx.moveTo(-top, y); ctx.lineTo(top, y + 6 * s); ctx.stroke();
    }
    ctx.restore();
  }

  // 2 · Fleischspirale
  const ribbon = ease(0.15, 0.3, p) * (1 - ease(0.48, 0.58, p));
  if (ribbon > 0) {
    ctx.save();
    ctx.globalAlpha = ribbon;
    ctx.lineCap = 'round';
    const len = ease(0.15, 0.45, p);
    const y0 = cy - 120 * s, y1 = y0 + 560 * s * len;
    for (const [w, c] of [[34, '#4a2410'], [24, '#a3592a'], [6, '#d9894a']]) {
      ctx.beginPath();
      for (let y = y0; y <= y1; y += 4) {
        const t = (y - y0) / (560 * s);
        const x = cx + Math.sin(t * 11 + p * 14) * (40 + t * 70) * s;
        y === y0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = c; ctx.lineWidth = w * s; ctx.stroke();
    }
    ctx.restore();
  }

  // 3 · Explosionszeichnung → 4 · fertiger Döner
  const layers = ease(0.45, 0.56, p);
  if (layers > 0) {
    const stack = [
      ['#e2b97a', 150, 34], ['#6fae3c', 140, 14], ['#f3e3ef', 120, 8], ['#8c4a22', 135, 22],
      ['#d8382b', 115, 12], ['#8c4a22', 130, 22], ['#6fae3c', 140, 14], ['#e2b97a', 150, 30],
    ];
    const gap = lerp(70, 16, ease(0.68, 0.88, p)) * s;
    const total = gap * (stack.length - 1);
    ctx.save();
    ctx.globalAlpha = layers;
    stack.forEach(([color, rx, ry], i) => {
      const y = cy - total / 2 + i * gap;
      const wobble = Math.sin(i * 1.7 + p * 20) * (1 - ease(0.7, 0.88, p)) * 18 * s;
      ctx.beginPath();
      ctx.ellipse(cx + wobble, y, rx * s, ry * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2 * s; ctx.stroke();
    });
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(243,233,220,.35)';
  ctx.font = `500 ${mobile ? 10 : 12}px Inter, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('Platzhalter · echte Bilder folgen', W - 20, mobile ? 80 : H - 24);
}

function updatePhases() {
  let active = 0;
  phases.forEach((el, i) => { if (progress >= +el.dataset.at) active = i; });
  phases.forEach((el, i) => el.classList.toggle('is-active', i === active));
  bar.style.height = `${progress * 100}%`;
}

ScrollTrigger.create({
  trigger: '#story',
  start: 'top top',
  end: 'bottom bottom',
  onUpdate: (self) => { progress = self.progress; requestRender(); },
});

ScrollTrigger.create({
  trigger: '#lavagrill',
  start: 'top 80px',
  // bewusst ohne Ende: toggleClass würde ganz unten wieder abschalten
  onEnter: () => document.querySelector('.nav').classList.add('is-solid'),
  onLeaveBack: () => document.querySelector('.nav').classList.remove('is-solid'),
});

// höchstens ein Zeichenvorgang pro Bildschirm-Frame
let queued = false;
function requestRender() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; render(); updatePhases(); });
}

let lastMobile = isMobile();
addEventListener('resize', () => {
  if (isMobile() !== lastMobile) { lastMobile = isMobile(); loadFrames(); }
  resize();
});
loadFrames();
resize();

/* ---------- Glut-Partikel ---------- */
document.querySelectorAll('.embers').forEach((cv) => {
  if (reduce) return;
  const c = cv.getContext('2d');
  const density = +cv.dataset.density || 1;
  let parts = [], w = 0, h = 0, visible = false, raf = 0;

  const spawn = (anywhere) => ({
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : h + 10,
    r: Math.random() * 1.8 + 0.4,
    vy: Math.random() * 0.9 + 0.35,
    vx: (Math.random() - 0.5) * 0.4,
    life: Math.random() * 0.6 + 0.4,
    hue: 20 + Math.random() * 25,
  });

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((w * h) / 14000 * density);
    parts = Array.from({ length: Math.min(n, 160) }, () => spawn(true));
  }

  function tick() {
    c.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.y -= p.vy; p.x += p.vx + Math.sin(p.y / 40) * 0.25; p.life -= 0.0025;
      if (p.y < -10 || p.life <= 0) Object.assign(p, spawn(false));
      const a = clamp(p.life) * clamp(p.y / h + 0.2);
      c.fillStyle = `hsla(${p.hue},100%,60%,${a})`;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
    }
    if (visible) raf = requestAnimationFrame(tick);
  }

  // erst nach der Ladeanzeige starten: während des Ladens soll der Hauptthread frei bleiben
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible && loaderDone) raf = requestAnimationFrame(tick);
  }).observe(cv);
  addEventListener('effendi:ready', () => {
    cancelAnimationFrame(raf);
    if (visible) raf = requestAnimationFrame(tick);
  });

  addEventListener('resize', size);
  size();
});

// Lavagrill-Video erst laden, wenn die Sektion näher kommt; außerhalb des Bildschirms pausieren
const lavaVideo = document.querySelector('.lava__video');
new IntersectionObserver(([e]) => {
  if (e.isIntersecting) {
    if (!lavaVideo.src) lavaVideo.src = lavaVideo.dataset.src;
    if (!reduce) lavaVideo.play().catch(() => {});
  } else if (lavaVideo.src) {
    lavaVideo.pause();
  }
}, { rootMargin: '600px 0px' }).observe(lavaVideo);

// Lavagrill-Text sanft einblenden
gsap.from('.lava__text > *', {
  y: 30, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out',
  scrollTrigger: { trigger: '.lava', start: 'top 70%' },
});
