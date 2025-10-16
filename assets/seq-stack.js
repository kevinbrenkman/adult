(() => {

  // Debug note for cache verification
const VERSION_NOTE = "seq-stack v3.1.3 (true inertia build)";
{
  const el = document.createElement("div");
  el.textContent = VERSION_NOTE;
  Object.assign(el.style, {
    position: "fixed",
    bottom: "6px",
    right: "8px",
    zIndex: 999999,
    fontSize: "11px",
    fontFamily: "monospace",
    color: "#999",
    background: "rgba(255,255,255,0.4)",
    padding: "2px 4px",
    borderRadius: "3px",
    pointerEvents: "none"
  });
  document.body.appendChild(el);
  console.log(VERSION_NOTE);
}


  // ========= TUNABLES =========
  const MAX_VISIBLE       = 2;
  const WHEEL_SPEED       = 0.000035;
  const CURSOR_SPEED      = 0.00002;
  const CURSOR_THRESHOLD  = 3;
  const PIN_TO            = '.main-wrapper';

  // Shared momentum
  const DAMPING_PER_SEC   = 0.35;
  const CURSOR_VEL_GAIN   = 0.03;
  const MAX_ABS_VEL       = 0.5;
  const MAX_DV_CURSOR     = 0.15;

  // Wheel kinetic tail
  const WHEEL_TAIL_GAIN   = 2.5;
  const WHEEL_TAIL_TAU    = 2.5;
  const MAX_WHEEL_TAIL    = 0.45;

  // Tap tween
  const TAP_TWEEN_DUR_DESKTOP = 0.55;
  const TAP_TWEEN_DUR_MOBILE  = 0.40;
  const TAP_TWEEN_EASE        = 'power2.out';
  const TAP_IMPULSE           = 0.35;

  // Loop/ends
  const CROSSFADE_OFFSET  = 0.999;
  const HOLD_AT_END_STEPS = 1.5;

  // Logo
  const LOGO_FADEIN_ON_LOAD = 0.6;
  const LOGO_FADE_DUR       = 0.35;
  const LOGO_OUT_START      = 1.0;

  // ===== Guard
  if (window.Shopify && Shopify.designMode) return;
  if (window.seqStackDestroy) window.seqStackDestroy();

  const loadScriptOnce = (src) => new Promise((res, rej) => {
    if ([...document.scripts].some(s => s.src.includes(src))) return res();
    const el = document.createElement('script');
    el.src = src; el.async = true; el.onload = res; el.onerror = rej;
    document.head.appendChild(el);
  });

  (async function run(){
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js');
    gsap.registerPlugin();

    const all = Array.from(document.querySelectorAll('.section_seq_image, .section_seq_text'));
    let imgSecs   = all.filter(n => n.classList.contains('section_seq_image'));
    const textSecs = all.filter(n => n.classList.contains('section_seq_text'));
    if (!imgSecs.length) return;

    const stage = document.createElement('div'); stage.id = 'seqStageStack';
    const style = document.createElement('style'); style.id = 'seqStageStack-style';
    style.textContent = `
      #seqStageStack{position:relative;width:100%;height:100vh;overflow:hidden;touch-action:none;}
      #seqStageStack>.section_seq_image,#seqStageStack>.section_seq_text{position:absolute;inset:0;pointer-events:auto;}
      #seqStageStack .section_seq_image img,#seqStageStack .section_seq_image .seq-image{mix-blend-mode:darken;opacity:0;transition:none;}
      #seqStageStack>.section_seq_text{opacity:0;z-index:999999;}
    `;
    document.head.appendChild(style);
    const pinContainer = document.querySelector(PIN_TO) || document.body;
    pinContainer.insertBefore(stage, pinContainer.firstChild);

    const backups = all.map(node => ({ node, parent: node.parentNode, next: node.nextSibling }));
    all.forEach(node => stage.appendChild(node));

    // Clone first image for loop
    const firstImgEl = imgSecs[0]?.querySelector('img, .seq-image, picture img');
    const lastImgEl  = imgSecs.at(-1)?.querySelector('img, .seq-image, picture img');
    const sameEnds = !!(firstImgEl && lastImgEl &&
      (firstImgEl.currentSrc || firstImgEl.src) === (lastImgEl.currentSrc || lastImgEl.src));
    let hasLoopClone = false;
    if (!sameEnds && imgSecs.length > 1) {
      const clone = imgSecs[0].cloneNode(true);
      clone.dataset.seqClone = 'true';
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('img').forEach(img => img.loading = 'eager');
      stage.appendChild(clone);
      imgSecs = Array.from(stage.querySelectorAll('.section_seq_image'));
      hasLoopClone = true;
    }

    const imgs = imgSecs.map(sec => sec.querySelector('img, .seq-image, picture img')).filter(Boolean);
    gsap.set(imgs, { opacity: 0 });
    if (imgs[0]) gsap.set(imgs[0], { opacity: 1 });
    gsap.set(textSecs, { opacity: 0 });

    // Map text → image
    let seen = 0;
    const startIndex = new Map();
    Array.from(stage.querySelectorAll('.section_seq_image, .section_seq_text')).forEach(node => {
      if (node.classList.contains('section_seq_image')) seen++;
      if (node.classList.contains('section_seq_text')) startIndex.set(node, seen);
    });

    // Timeline
    const tl = gsap.timeline({ paused: true });
    const FADE_DUR = 1.2;
    imgs.forEach((img, i) => {
      if (i > 0) tl.to(img, { opacity: 1, duration: FADE_DUR, ease: 'none' }, i);
      if (i >= MAX_VISIBLE && imgs[i - MAX_VISIBLE]) {
        const outIdx = i - MAX_VISIBLE;
        tl.to(imgs[outIdx], { opacity: 0, duration: FADE_DUR, ease: 'none' }, i);
      }
    });

    textSecs.forEach(txt => {
      const sIdx = Math.min(startIndex.get(txt) || 0, imgs.length - 1);
      tl.set(txt, { opacity: 1 }, sIdx + 0.001);
      tl.set(txt, { opacity: 0 }, sIdx + 2);
    });

    // Logo fade
    const logoEl = document.querySelector('.shopify-section.logo-wrapper');
    let logoVisible = false;
    const fadeLogoTo = (visible) => {
      if (!logoEl || logoVisible === visible) return;
      logoVisible = visible;
      gsap.killTweensOf(logoEl);
      gsap.to(logoEl, { opacity: visible ? 1 : 0, duration: LOGO_FADE_DUR, ease: 'power1.out' });
    };
    if (logoEl) {
      gsap.set(logoEl, { opacity: 0 });
      gsap.to(logoEl, { opacity: 1, duration: LOGO_FADEIN_ON_LOAD, ease: 'power1.out', onComplete: () => (logoVisible = true) });
    }

    // Crossfade loop
    if (imgs.length > 1) {
      const cloneIdx  = imgs.length - 1;
      const lastReal  = cloneIdx - 1;
      const loopPoint = lastReal + CROSSFADE_OFFSET + HOLD_AT_END_STEPS;
      tl.to(imgs[cloneIdx], { opacity: 1, duration: FADE_DUR, ease: 'none' }, loopPoint);
      imgs.forEach((img, idx) => {
        if (idx !== cloneIdx) tl.to(img, { opacity: 0, duration: FADE_DUR, ease: 'none' }, loopPoint);
      });
    }

    // Progress bar
    const bar = document.querySelector('.section_progress-bar .progress-bar');
    const mainSteps = Math.max(1, imgs.length - (hasLoopClone ? 1 : 0));
    let barWrapping = false;
    const setBar = (t) => {
      if (!bar || barWrapping) return;
      const p = Math.min(t / mainSteps, 1);
      bar.style.width = (p * 100).toFixed(3) + '%';
    };
    const animateBarWrap = (dir) => {
      if (!bar) return;
      barWrapping = true;
      gsap.killTweensOf(bar);
      const toWidth = dir === 'forward' ? '0%' : '100%';
      const fromWidth = dir === 'forward' ? '100%' : '0%';
      bar.style.width = fromWidth;
      gsap.to(bar, {
        width: toWidth,
        duration: 0.35,
        ease: 'none',
        onComplete: () => { barWrapping = false; setBar(pos); }
      });
    };

    // ===== Driver state
    let pos = 0, vel = 0, lastTs = 0;
    const dur = tl.duration();
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const clampVel = (v) => clamp(v, -MAX_ABS_VEL, MAX_ABS_VEL);
    let wheelTailVel = 0;

    const setProgress = (p) => {
      const prev = pos;
      const newPos = ((p % dur) + dur) % dur;
      if (p > prev && newPos < prev) animateBarWrap('forward');
      if (p < prev && newPos > prev) animateBarWrap('backward');
      pos = newPos;
      tl.time(pos, false);
      setBar(pos);
      if (logoEl) fadeLogoTo(pos < LOGO_OUT_START);
    };

    // ===== TRUE TOUCH INERTIA
    let isTouching = false;
    let lastTouchY = 0;
    let touchVel = 0;
    let touchMomentumActive = false;
    const TOUCH_ACC = 0.00075;
    const TOUCH_DECAY = 0.94;
    const TOUCH_MAX_VEL = 0.07;

    const onTouchStart = (e) => {
      const t = e.touches[0];
      if (!t) return;
      isTouching = true;
      touchMomentumActive = false;
      touchVel = 0;
      lastTouchY = t.clientY;
    };

    const onTouchMove = (e) => {
      const t = e.touches[0];
      if (!t) return;
      e.preventDefault();
      const dy = lastTouchY - t.clientY;
      lastTouchY = t.clientY;
      touchVel += dy * TOUCH_ACC;
      touchVel = clamp(touchVel, -TOUCH_MAX_VEL, TOUCH_MAX_VEL);
    };

    const onTouchEnd = () => {
      isTouching = false;
      touchMomentumActive = true;
    };

    // ===== Main tick
    const tick = (ts) => {
      requestAnimationFrame(tick);
      if (!lastTs) { lastTs = ts; return; }
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;

      // desktop kinetic velocity
      if (Math.abs(vel) > 1e-4) {
        setProgress(pos + vel * dt);
        vel *= Math.exp(-dt * DAMPING_PER_SEC * 2.2);
        if (Math.abs(vel) < 1e-4) vel = 0;
      }

      // wheel kinetic tail
      if (Math.abs(wheelTailVel) > 1e-4) {
        setProgress(pos + wheelTailVel * dt);
        const decay = Math.exp(-dt / WHEEL_TAIL_TAU);
        wheelTailVel *= decay;
        if (Math.abs(wheelTailVel) < 1e-4) wheelTailVel = 0;
      }

      // touch inertial integration
      if (isTouching || touchMomentumActive) {
        setProgress(pos + touchVel);
        if (!isTouching) {
          touchVel *= TOUCH_DECAY;
          if (Math.abs(touchVel) < 1e-5) {
            touchVel = 0;
            touchMomentumActive = false;
          }
        } else {
          touchVel *= 0.9; // friction while dragging
        }
      }
    };
    requestAnimationFrame(tick);

    // ===== Inputs
    const opts = { passive: false };

    // Wheel
    const onWheel = (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? window.innerHeight : 1);
      const dy = e.deltaY * unit;
      const deltaPos = dy * WHEEL_SPEED * dur;
      setProgress(pos + deltaPos);
      const estimatedDt = 1 / 60;
      let newTail = (deltaPos / estimatedDt) * WHEEL_TAIL_GAIN;
      wheelTailVel = clamp(wheelTailVel * 0.4 + newTail * 0.6, -MAX_WHEEL_TAIL, MAX_WHEEL_TAIL);
    };

    // Cursor move
    let lastX = null, lastY = null, lastMoveTs = 0;
    const onMouseMove = (e) => {
      const now = performance.now();
      if (lastX != null && lastY != null) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist >= CURSOR_THRESHOLD) {
          const dtl = dist * CURSOR_SPEED * dur;
          setProgress(pos + dtl);
          const dt = Math.max(1, now - (lastMoveTs || now)) / 1000;
          let instV = (dist * CURSOR_SPEED * dur) / dt;
          let dv = instV * CURSOR_VEL_GAIN;
          dv = clamp(dv, 0, MAX_DV_CURSOR);
          vel = clampVel(vel + dv);
        }
      }
      lastX = e.clientX; lastY = e.clientY; lastMoveTs = now;
    };

    // Tap
    let pdTime = 0, pdX = 0, pdY = 0;
    const tweenTo = (targetTime, durSec, easeStr = TAP_TWEEN_EASE) => {
      vel = 0;
      const proxy = { t: pos };
      gsap.to(proxy, {
        t: targetTime,
        duration: durSec,
        ease: easeStr,
        onUpdate: () => setProgress(proxy.t),
        onComplete: () => { vel = Math.min(MAX_ABS_VEL, vel + TAP_IMPULSE); }
      });
    };
    const onPointerDown = (e) => { pdTime = performance.now(); pdX = e.clientX; pdY = e.clientY; };
    const onPointerUp   = (e) => {
      const dt = performance.now() - pdTime;
      const moved = Math.hypot(e.clientX - pdX, e.clientY - pdY);
      if (dt < 300 && moved < 12) {
        const next = Math.floor(pos) + 1;
        tweenTo(next, window.innerWidth <= 767 ? TAP_TWEEN_DUR_MOBILE : TAP_TWEEN_DUR_DESKTOP);
      }
    };

    // Listeners
    stage.addEventListener('wheel', onWheel, opts);
    stage.addEventListener('touchstart', onTouchStart, opts);
    stage.addEventListener('touchmove', onTouchMove, opts);
    stage.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    stage.addEventListener('pointerdown', onPointerDown, { passive: true });
    stage.addEventListener('pointerup', onPointerUp, { passive: true });

    // Cleanup
    window.seqStackDestroy = () => {
      tl.kill();
      stage.remove();
      style.remove();
      backups.forEach(({node, parent, next}) => {
        node.style.opacity = ''; node.style.zIndex = '';
        if (next && next.parentNode === parent) parent.insertBefore(node, next);
        else parent.appendChild(node);
      });
      delete window.seqStackDestroy;
    };
  })();
})();
