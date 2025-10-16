(() => {
  // ===== CONFIG =====
  const MAX_VISIBLE = 2;
  const WHEEL_SPEED = 0.000035;
  const TOUCH_SPEED = 0.00025;
  const CURSOR_SPEED = 0.00002;
  const CURSOR_THRESHOLD = 3;
  const PIN_TO = '.main-wrapper';

  // Momentum / damping
  const DAMPING_PER_SEC = 0.75;
  const WHEEL_VEL_GAIN = 0.025;  // kept for consistency; used via tail injection
  const TOUCH_VEL_GAIN = 0.08;
  const CURSOR_VEL_GAIN = 0.03;
  const MAX_ABS_VEL = 0.6;
  const MAX_DV_WHEEL = 0.12;
  const MAX_DV_TOUCH = 0.22;
  const MAX_DV_CURSOR = 0.15;

  // Tap tween
  const TAP_TWEEN_DUR_DESKTOP = 0.55;
  const TAP_TWEEN_DUR_MOBILE  = 0.40;
  const TAP_TWEEN_EASE        = 'power2.out';
  const TAP_IMPULSE           = 0.35;

  // Loop behavior
  const CROSSFADE_OFFSET  = 0.999;
  const HOLD_AT_END_STEPS = 1.5;

  // Logo fade
  const LOGO_FADEIN_ON_LOAD = 0.6;
  const LOGO_FADE_DUR       = 0.35;
  const LOGO_OUT_START      = 1.0;

  // Don’t run in Shopify customizer
  if (window.Shopify && Shopify.designMode) return;

  // Cleanup previous instance if any
  if (window.seqStackDestroy) window.seqStackDestroy();

  const loadScriptOnce = (src) => new Promise((res, rej) => {
    if ([...document.scripts].some(s => s.src.includes(src))) return res();
    const el = document.createElement('script');
    el.src = src; el.async = true; el.onload = res; el.onerror = rej;
    document.head.appendChild(el);
  });

  (async function run() {
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js');
    gsap.registerPlugin();

    // Collect nodes
    const all = Array.from(document.querySelectorAll('.section_seq_image, .section_seq_text'));
    let imgSecs   = all.filter(n => n.classList.contains('section_seq_image'));
    const textSecs = all.filter(n => n.classList.contains('section_seq_text'));
    if (!imgSecs.length) return;

    const IS_MOBILE = window.innerWidth <= 767;

    // Stage wrapper + minimal CSS
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

    // Move nodes into stage (so we can cleanly restore later)
    const backups = all.map(node => ({ node, parent: node.parentNode, next: node.nextSibling }));
    all.forEach(node => stage.appendChild(node));

    // Auto-clone first image section at end for smooth loop
    const firstImgEl = imgSecs[0]?.querySelector('img, .seq-image, picture img');
    const lastImgEl  = imgSecs.at(-1)?.querySelector('img, .seq-image, picture img');
    const sameEnds = !!(firstImgEl && lastImgEl && (firstImgEl.currentSrc || firstImgEl.src) === (lastImgEl.currentSrc || lastImgEl.src));
    let hasLoopClone = false;
    if (!sameEnds && imgSecs.length > 1) {
      const clone = imgSecs[0].cloneNode(true);
      clone.dataset.seqClone = 'true';
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
      stage.appendChild(clone);
      imgSecs = Array.from(stage.querySelectorAll('.section_seq_image'));
      hasLoopClone = true;
    }

    const imgs = imgSecs.map(sec => sec.querySelector('img, .seq-image, picture img')).filter(Boolean);

    // Initial state
    gsap.set(imgs, { opacity: 0 });
    if (imgs[0]) gsap.set(imgs[0], { opacity: 1 });
    gsap.set(textSecs, { opacity: 0 });

    // Map text → image index after it
    let seen = 0;
    const startIndex = new Map();
    Array.from(stage.querySelectorAll('.section_seq_image, .section_seq_text')).forEach(node => {
      if (node.classList.contains('section_seq_image')) seen++;
      if (node.classList.contains('section_seq_text')) startIndex.set(node, seen);
    });

    // Mobile linger indices (+3 after text)
    const lingerIndices = new Set();
    if (IS_MOBILE) {
      textSecs.forEach(txt => {
        const idx = Math.min(startIndex.get(txt) || 0, imgs.length - 1);
        if (idx >= 0) lingerIndices.add(idx);
      });
    }

    // Timeline (linear for precise scrubbing)
    const tl = gsap.timeline({ paused: true });
    const FADE_DUR = 1.2;

    imgs.forEach((img, i) => {
      if (i > 0) tl.to(img, { opacity: 1, duration: FADE_DUR, ease: 'none' }, i);

      if (i >= MAX_VISIBLE && imgs[i - MAX_VISIBLE]) {
        const outIdx = i - MAX_VISIBLE;
        if (!(IS_MOBILE && lingerIndices.has(outIdx))) {
          tl.to(imgs[outIdx], { opacity: 0, duration: FADE_DUR, ease: 'none' }, i);
        }
      }
    });

    // Mobile delayed fade-outs after linger
    if (IS_MOBILE && lingerIndices.size) {
      const durTemp = tl.duration();
      const wrap = (t) => ((t % durTemp) + durTemp) % durTemp;
      lingerIndices.forEach(idx => {
        const delayedOutTime = idx + MAX_VISIBLE + 3;
        tl.to(imgs[idx], { opacity: 0, duration: FADE_DUR, ease: 'none' }, wrap(delayedOutTime));
      });
    }

    // Text: instant in/out
    textSecs.forEach(txt => {
      const sIdx = Math.min(startIndex.get(txt) || 0, imgs.length - 1);
      tl.set(txt, { opacity: 1 }, sIdx + 0.001);
      tl.set(txt, { opacity: 0 }, sIdx + 2);
    });

    // Logo: event-driven fade (never stalls mid-scrub)
    const logoEl = document.querySelector('.shopify-section.logo-wrapper');
    let logoVisible = false;
    const fadeLogoTo = (visible) => {
      if (!logoEl) return;
      if (logoVisible === visible) return;
      logoVisible = visible;
      gsap.killTweensOf(logoEl);
      gsap.to(logoEl, { opacity: visible ? 1 : 0, duration: LOGO_FADE_DUR, ease: 'power1.out' });
    };
    if (logoEl) {
      gsap.set(logoEl, { opacity: 0 });
      gsap.to(logoEl, { opacity: 1, duration: LOGO_FADEIN_ON_LOAD, ease: 'power1.out', onComplete: () => (logoVisible = true) });
    }

    // End-cap crossfade to clone & hide others at loop point
    if (imgs.length > 1) {
      const cloneIdx  = imgs.length - 1;
      const lastReal  = cloneIdx - 1;
      const loopPoint = lastReal + CROSSFADE_OFFSET + HOLD_AT_END_STEPS;
      tl.to(imgs[cloneIdx], { opacity: 1, duration: FADE_DUR, ease: 'none' }, loopPoint);
      imgs.forEach((img, idx) => {
        if (idx !== cloneIdx) tl.to(img, { opacity: 0, duration: FADE_DUR, ease: 'none' }, loopPoint);
      });
    }

    // Progress bar (exclude loop clone)
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

    // Driver with shared momentum
    let pos = 0, vel = 0, lastTs = 0;
    const dur = tl.duration();
    const clampVel = (v) => Math.max(-MAX_ABS_VEL, Math.min(MAX_ABS_VEL, v));

    const setProgress = (p) => {
      const prevPos = pos;
      const proposed = p;
      const newPos = (proposed % dur + dur) % dur;

      const wrappedForward  = (proposed > prevPos && newPos < prevPos);
      const wrappedBackward = (proposed < prevPos && newPos > prevPos);
      if (wrappedForward)  animateBarWrap('forward');
      if (wrappedBackward) animateBarWrap('backward');

      pos = newPos;
      tl.time(pos, false);
      setBar(pos);

      // Logo visibility toggle
      if (logoEl) fadeLogoTo(pos < LOGO_OUT_START);
    };

    const tick = (ts) => {
      requestAnimationFrame(tick);
      if (!lastTs) { lastTs = ts; return; }
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;

      if (Math.abs(vel) > 1e-4) {
        setProgress(pos + vel * dt);
        vel *= Math.max(0, 1 - DAMPING_PER_SEC * dt);
        if (Math.abs(vel) < 1e-4) vel = 0;
      }
    };
    requestAnimationFrame(tick);

    // ===== INPUTS =====
    const opts = { passive: false };

    // --- Wheel kinetic with synthetic inertia tail (Magic Mouse / trackpad) ---
    let wheelVelY = 0;
    let wheelLastTs = 0;
    let wheelDecayRAF = null;

    const onWheel = (e) => {
      e.preventDefault();

      const now = performance.now();
      const deltaUnit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? window.innerHeight : 1);
      const dy = e.deltaY * deltaUnit;
      const dt = Math.max(1, now - wheelLastTs) / 1000 || 1/60;
      wheelLastTs = now;

      // Immediate scrub by wheel delta
      const dtl = dy * WHEEL_SPEED * dur;
      setProgress(pos + dtl);

      // Track a smoothed instantaneous velocity estimate
      const instVel = (dy * WHEEL_SPEED * dur) / dt;
      wheelVelY = wheelVelY * 0.6 + instVel * 0.4; // EMA smoothing

      // Cancel any ongoing tail decay, start a new one
      if (wheelDecayRAF) cancelAnimationFrame(wheelDecayRAF);

      const decay = () => {
        // Apply tail motion
        wheelVelY *= 0.90; // tail damping (adjust to taste)
        if (Math.abs(wheelVelY) > 0.01) {
          const dtTail = 1 / 60;
          const step = wheelVelY * dtTail;

          setProgress(pos + step);

          // Couple tail to global velocity a bit so it shares the main damping curve too
          let dv = step * WHEEL_VEL_GAIN;
          dv = Math.max(-MAX_DV_WHEEL, Math.min(MAX_DV_WHEEL, dv));
          vel = clampVel(vel + dv);

          wheelDecayRAF = requestAnimationFrame(decay);
        }
      };

      wheelDecayRAF = requestAnimationFrame(decay);
    };

    // --- Touch with kinetic easing ---
    const activeTouches = { id: null, y: 0, vy: 0, lastY: 0, lastTs: 0, movedTotal: 0 };
    const onTouchStart = (e) => {
      const t = e.touches[0];
      if (!t) return;
      Object.assign(activeTouches, {
        id: t.identifier, y: t.clientY, lastY: t.clientY, vy: 0, movedTotal: 0, lastTs: performance.now()
      });
    };
    const onTouchMove = (e) => {
      const t = [...e.touches].find(t => t.identifier === activeTouches.id) || e.touches[0];
      if (!t) return;
      e.preventDefault();

      const now = performance.now();
      const dy = activeTouches.y - t.clientY; // up = forward
      setProgress(pos + dy * TOUCH_SPEED * dur);
      activeTouches.y = t.clientY;
      activeTouches.movedTotal += Math.abs(dy);

      const dy2 = activeTouches.lastY - t.clientY;
      const dt  = Math.max(1, now - activeTouches.lastTs) / 1000;
      const instVy = (dy2 * TOUCH_SPEED * dur) / dt;
      activeTouches.vy = (activeTouches.vy * 0.5) + (instVy * 0.5);
      activeTouches.lastY = t.clientY;
      activeTouches.lastTs = now;
    };
    const onTouchEnd = () => {
      if (activeTouches.movedTotal > 6) {
        let dv = activeTouches.vy * TOUCH_VEL_GAIN;
        dv = Math.max(-MAX_DV_TOUCH, Math.min(MAX_DV_TOUCH, dv));
        vel = clampVel(vel + dv);
      }
      activeTouches.id = null;
    };

    // --- Cursor move kinetic (forward-only) ---
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
          dv = Math.max(0, Math.min(MAX_DV_CURSOR, dv)); // forward-only
          vel = clampVel(vel + dv);
        }
      }
      lastX = e.clientX; lastY = e.clientY; lastMoveTs = now;
    };

    // --- Tap → smooth tween to next step ---
    let pdTime = 0, pdX = 0, pdY = 0;
    const tweenTo = (target, durSec, easeStr = TAP_TWEEN_EASE) => {
      vel = 0;
      const proxy = { t: pos };
      gsap.to(proxy, {
        t: target,
        duration: durSec,
        ease: easeStr,
        onUpdate: () => setProgress(proxy.t),
        onComplete: () => { vel = Math.min(MAX_ABS_VEL, vel + TAP_IMPULSE); }
      });
    };
    const onPointerDown = (e) => { pdTime = performance.now(); pdX = e.clientX; pdY = e.clientY; };
    const onPointerUp = (e) => {
      const dt = performance.now() - pdTime;
      const moved = Math.hypot(e.clientX - pdX, e.clientY - pdY);
      if (dt < 300 && moved < 12) {
        const next = Math.floor(pos) + 1;
        tweenTo(next, IS_MOBILE ? TAP_TWEEN_DUR_MOBILE : TAP_TWEEN_DUR_DESKTOP);
      }
    };

    // Attach listeners
    stage.addEventListener('wheel', onWheel, opts);
    stage.addEventListener('touchstart', onTouchStart, opts);
    stage.addEventListener('touchmove', onTouchMove, opts);
    stage.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    stage.addEventListener('pointerdown', onPointerDown, { passive: true });
    stage.addEventListener('pointerup', onPointerUp, { passive: true });

    // Cleanup hook
    window.seqStackDestroy = () => {
      if (wheelDecayRAF) cancelAnimationFrame(wheelDecayRAF);
      tl.kill();
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove', onTouchMove);
      stage.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMove);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointerup', onPointerUp);
      backups.forEach(({node, parent, next}) => {
        node.style.opacity = ''; node.style.zIndex = '';
        if (next && next.parentNode === parent) parent.insertBefore(node, next);
        else parent.appendChild(node);
      });
      style.remove(); stage.remove();
      delete window.seqStackDestroy;
    };
  })();
})();
