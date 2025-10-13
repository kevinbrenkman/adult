(() => {
  // === Core tuning ===
  const MAX_VISIBLE = 2;
  const WHEEL_SPEED = 0.00008;
  const TOUCH_SPEED = 0.00025;
  const CURSOR_SPEED = 0.00002;
  const CURSOR_THRESHOLD = 3;
  const PIN_TO = '.main-wrapper';

  // === Kinetic physics ===
  const FRICTION = 0.92;       // smaller → stronger drag (try 0.90–0.96)
  const MOMENTUM_SCALE = 0.25; // scales how strong impulses feel
  const MAX_VELOCITY = 1.2;    // cap
  const CROSSFADE_OFFSET = 0.999;
  const LINGER_EXTRA = 1.5;    // seconds of timeline linger for last image

  if (window.Shopify && Shopify.designMode) return;

  if (window.seqStackDestroy) window.seqStackDestroy();

  const loadScriptOnce = (src) =>
    new Promise((res, rej) => {
      if ([...document.scripts].some(s => s.src.includes(src))) return res();
      const el = document.createElement('script');
      el.src = src; el.async = true; el.onload = res; el.onerror = rej;
      document.head.appendChild(el);
    });

  (async function run() {
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js');
    gsap.registerPlugin();

    const all = Array.from(document.querySelectorAll('.section_seq_image, .section_seq_text'));
    let imgSecs = all.filter(n => n.classList.contains('section_seq_image'));
    const textSecs = all.filter(n => n.classList.contains('section_seq_text'));
    if (!imgSecs.length) return;

    const stage = document.createElement('div'); stage.id = 'seqStageStack';
    stage.style.cssText = 'position:relative;width:100%;height:100vh;overflow:hidden;touch-action:none;';
    const pinContainer = document.querySelector(PIN_TO) || document.body;
    pinContainer.insertBefore(stage, pinContainer.firstChild);
    all.forEach(node => stage.appendChild(node));

    const first = imgSecs[0], last = imgSecs[imgSecs.length - 1];
    const sameSrc =
      first && last &&
      first.querySelector('img')?.src === last.querySelector('img')?.src;
    if (!sameSrc) {
      const clone = first.cloneNode(true);
      clone.dataset.seqClone = 'true';
      stage.appendChild(clone);
      imgSecs.push(clone);
    }

    const imgs = imgSecs.map(s => s.querySelector('img')).filter(Boolean);
    gsap.set(imgs, { opacity: 0 });
    gsap.set(imgs[0], { opacity: 1 });
    gsap.set(textSecs, { opacity: 0 });

    const tl = gsap.timeline({ paused: true });
    const FADE_DUR = 1.2;

    imgs.forEach((img, i) => {
      if (i > 0) tl.to(img, { opacity: 1, duration: FADE_DUR, ease: 'none' }, i);
      if (i >= MAX_VISIBLE && imgs[i - MAX_VISIBLE]) {
        tl.to(imgs[i - MAX_VISIBLE], { opacity: 0, duration: FADE_DUR, ease: 'none' }, i);
      }
    });

    // === linger extension ===
    const durNow = tl.duration();
    tl.to(imgs[imgs.length - 2], { opacity: 1, duration: LINGER_EXTRA, ease: 'none' }, durNow - 1);
    tl.to(imgs[imgs.length - 1], { opacity: 1, duration: FADE_DUR, ease: 'none' }, durNow + CROSSFADE_OFFSET);
    tl.to(imgs[imgs.length - 2], { opacity: 0, duration: FADE_DUR, ease: 'none' }, durNow + CROSSFADE_OFFSET);

    // instant text show/hide
    textSecs.forEach((txt, i) => {
      const idx = Math.min(i * 2, imgs.length - 1);
      tl.set(txt, { opacity: 1 }, idx + 0.001);
      tl.set(txt, { opacity: 0 }, idx + 2);
    });

    const logoEl = document.querySelector('.shopify-section.logo-wrapper');
    const dur = tl.duration();
    let pos = 0;
    let vel = 0;
    let animating = false;

    const setProgress = (p) => {
      const newPos = (p % dur + dur) % dur;
      pos = newPos;
      tl.time(pos, false);
      if (logoEl) {
        const op = 1 - Math.min(1, pos / 2);
        gsap.set(logoEl, { opacity: op });
      }
    };

    // ===== kinetic loop =====
    const tick = () => {
      if (!animating) return;
      vel *= FRICTION;
      if (Math.abs(vel) < 0.0001) vel = 0;
      setProgress(pos + vel);
      requestAnimationFrame(tick);
    };
    const kick = (impulse) => {
      vel += impulse * MOMENTUM_SCALE;
      vel = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, vel));
      if (!animating) { animating = true; requestAnimationFrame(tick); }
    };

    // === Input bindings ===
    const wheel = (e) => {
      e.preventDefault();
      const dy = e.deltaY || e.wheelDeltaY * -1;
      setProgress(pos + dy * WHEEL_SPEED * dur);
      kick(-dy * WHEEL_SPEED * dur);
    };
    stage.addEventListener('wheel', wheel, { passive: false });

    let startY = 0;
    const touchStart = (e) => { startY = e.touches[0].clientY; };
    const touchMove = (e) => {
      e.preventDefault();
      const dy = startY - e.touches[0].clientY;
      setProgress(pos + dy * TOUCH_SPEED * dur);
      startY = e.touches[0].clientY;
    };
    const touchEnd = () => kick(0.8);
    stage.addEventListener('touchstart', touchStart, { passive: true });
    stage.addEventListener('touchmove', touchMove, { passive: false });
    stage.addEventListener('touchend', touchEnd, { passive: true });

    let lastX = null, lastY = null;
    const move = (e) => {
      if (lastX !== null) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= CURSOR_THRESHOLD) {
          setProgress(pos + dist * CURSOR_SPEED * dur);
          kick(dist * CURSOR_SPEED * dur);
        }
      }
      lastX = e.clientX; lastY = e.clientY;
    };
    window.addEventListener('mousemove', move, { passive: true });

    // tap impulse
    let tapTime = 0, tapX = 0, tapY = 0;
    stage.addEventListener('pointerdown', (e) => { tapTime = performance.now(); tapX = e.clientX; tapY = e.clientY; });
    stage.addEventListener('pointerup', (e) => {
      const dt = performance.now() - tapTime;
      const dist = Math.hypot(e.clientX - tapX, e.clientY - tapY);
      if (dt < 250 && dist < 15) kick(0.8);
    });

    // cleanup
    window.seqStackDestroy = () => {
      animating = false;
      tl.kill();
      stage.remove();
      window.removeEventListener('mousemove', move);
    };
  })();
})();
