(() => {
  // ===== TUNABLES (your latest) =====
  const MAX_VISIBLE       = 2;
  const WHEEL_SPEED       = 0.000035; // scroll sensitivity → change if too fast/slow
  const TOUCH_SPEED       = 0.00022;  // touch drag sensitivity
  const CURSOR_SPEED      = 0.00002;  // cursor “scrub” distance sensitivity
  const CURSOR_THRESHOLD  = 3;        // px before cursor contributes
  const PIN_TO            = '.main-wrapper';

  // Cursor momentum (kept – you liked this feel)
  const DAMPING_PER_SEC   = 0.75;
  const CURSOR_VEL_GAIN   = 0.03;
  const MAX_ABS_VEL       = 0.6;
  const MAX_DV_CURSOR     = 0.15;

  // Tap / scroll / touch tween feel
  const TWEEN_EASE             = 'power2.out';
  const WHEEL_TWEEN_DUR        = 0.35;  // feel free to try 0.4–0.5 for more float
  const TOUCH_TWEEN_DUR        = 0.28;  // quick but smooth on drags
  const TAP_TWEEN_DUR_DESKTOP  = 0.55;
  const TAP_TWEEN_DUR_MOBILE   = 0.40;
  const TAP_IMPULSE            = 0.35;  // tiny kick after tap tween completes

  // Loop / end behavior
  const CROSSFADE_OFFSET  = 0.999;  // shows real last before clone crossfade
  const HOLD_AT_END_STEPS = 1.5;

  // Logo timing (fade in at page load, then fade out early in sequence)
  const LOGO_FADEIN_ON_LOAD = 0.6;
  const LOGO_FADE_DUR       = 0.35;
  const LOGO_OUT_START      = 1.0; // step at which logo should be hidden

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

  (async function run(){
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js');
    gsap.registerPlugin();

    // Collect sections
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

    // Move nodes into stage (backup for cleanup)
    const backups = all.map(node => ({ node, parent: node.parentNode, next: node.nextSibling }));
    all.forEach(node => stage.appendChild(node));

    // Clone first image section to end for loop if needed
    const firstImgEl = imgSecs[0]?.querySelector('img, .seq-image, picture img');
    const lastImgEl  = imgSecs.at(-1)?.querySelector('img, .seq-image, picture img');
    const sameEnds = !!(firstImgEl && lastImgEl &&
                        (firstImgEl.currentSrc || firstImgEl.src) ===
                        (lastImgEl.currentSrc  || lastImgEl.src));
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

    // Initial state
    gsap.set(imgs, { opacity: 0 });
    if (imgs[0]) gsap.set(imgs[0], { opacity: 1 });
    gsap.set(textSecs, { opacity: 0 });

    // Map text → image index right after it
    let seen = 0;
    const startIndex = new Map();
    Array.from(stage.querySelectorAll('.section_seq_image, .section_seq_text')).forEach(node => {
      if (node.classList.contains('section_seq_image')) seen++;
      if (node.classList.contains('section_seq_text')) startIndex.set(node, seen);
    });

    // Mobile linger after text (keep following image 3 extra steps)
    const lingerIndices = new Set();
    if (IS_MOBILE) {
      textSecs.forEach(txt => {
        const idx = Math.min(startIndex.get(txt) || 0, imgs.length - 1);
        if (idx >= 0) lingerIndices.add(idx);
      });
    }

    // Timeline (linear for precise scrubbing; 1 unit per image)
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

    // Mobile delayed fades for linger indices
    if (IS_MOBILE && lingerIndices.size) {
      const durTemp = tl.duration();
      const wrap = (t) => ((t % durTemp) + durTemp) % durTemp;
      lingerIndices.forEach(idx => {
        const delayedOutTime = idx + MAX_VISIBLE + 3;
        tl.to(imgs[idx], { opacity: 0, duration: FADE_DUR, ease: 'none' }, wrap(delayedOutTime));
      });
    }

    // Text instant show/hide (no fade)
    textSecs.forEach(txt => {
      const sIdx = Math.min(startIndex.get(txt) || 0, imgs.length - 1);
      tl.set(txt, { opacity: 1 }, sIdx + 0.001);
      tl.set(txt, { opacity: 0 }, sIdx + 2);
    });

    // Logo — fade in on load, then fade in/out around the start of the loop
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

    // End-cap: keep LAST real image, then crossfade to clone
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

    // ===== Scrub driver =====
    let pos = 0;
    const dur = tl.duration();

    // Shared cursor momentum (unchanged)
    let vel = 0, rafId = null, lastTs = 0;
    const clampVel = (v) => Math.max(-MAX_ABS_VEL, Math.min(MAX_ABS_VEL, v));

    // Single tween controller for wheel/touch/tap
    let progressTween = null;
    const killProgressTween = () => { if (progressTween) { progressTween.kill(); progressTween = null; } };

    const setProgress = (p) => {
      const prev = pos;
      const newPos = ((p % dur) + dur) % dur;

      if (p > prev && newPos < prev) animateBarWrap('forward');
      if (p < prev && newPos > prev) animateBarWrap('backward');

      pos = newPos;
      tl.time(pos, false);
      setBar(pos);

      // Logo visibility around the start
      if (logoEl) fadeLogoTo(pos < LOGO_OUT_START);
    };

    const tweenTo = (targetTime, durSec, easeStr = TWEEN_EASE, afterImpulse = 0) => {
      killProgressTween();
      vel = 0; // pause cursor momentum during tween
      const proxy = { t: pos };
      progressTween = gsap.to(proxy, {
        t: targetTime,
        duration: durSec,
        ease: easeStr,
        onUpdate: () => setProgress(proxy.t),
        onComplete: () => {
          progressTween = null;
          if (afterImpulse) vel = Math.min(MAX_ABS_VEL, vel + afterImpulse);
        }
      });
    };

    // RAF for cursor momentum only
    const tick = (ts) => {
      rafId = requestAnimationFrame(tick);
      if (!lastTs) { lastTs = ts; return; }
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;

      if (Math.abs(vel) > 1e-4 && !progressTween) {
        setProgress(pos + vel * dt);
        vel *= Math.max(0, 1 - DAMPING_PER_SEC * dt);
        if (Math.abs(vel) < 1e-4) vel = 0;
      }
    };
    rafId = requestAnimationFrame(tick);

    // ===== Inputs =====
    const opts = { passive: false };

    // --- Wheel → ease to new target (like tap)
    const onWheel = (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? window.innerHeight : 1);
      const dy = e.deltaY * unit;

      const delta = dy * WHEEL_SPEED * dur;         // convert to timeline units
      const target = pos + delta;
      tweenTo(target, WHEEL_TWEEN_DUR, TWEEN_EASE, 0); // no extra impulse
    };

    // --- Touch → ease to new target while moving (no tap if we actually moved)
    const activeTouches = { id:null, y:0, movedTotal:0 };
    const onTouchStart = (e) => {
      const t = e.touches[0]; if (!t) return;
      activeTouches.id = t.identifier;
      activeTouches.y = t.clientY;
      activeTouches.movedTotal = 0;
      killProgressTween(); // allow fresh tween from current pos
    };
    const onTouchMove = (e) => {
      const t = [...e.touches].find(t => t.identifier === activeTouches.id) || e.touches[0];
      if (!t) return;
      e.preventDefault();

      const dy = activeTouches.y - t.clientY; // up = forward
      activeTouches.y = t.clientY;
      activeTouches.movedTotal += Math.abs(dy);

      const delta = dy * TOUCH_SPEED * dur;
      const target = pos + delta;
      tweenTo(target, TOUCH_TWEEN_DUR);
    };
    const onTouchEnd = () => {
      // if it was a real scroll gesture, don’t treat it as tap; no extra impulse
      activeTouches.id = null;
    };

    // --- Cursor move kinetic (unchanged)
    let lastX = null, lastY = null, lastMoveTs = 0;
    const onMouseMove = (e) => {
      const now = performance.now();
      if (lastX != null && lastY != null) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist >= CURSOR_THRESHOLD && !progressTween) {
          const dtl = dist * CURSOR_SPEED * dur;
          setProgress(pos + dtl);

          const dt = Math.max(1, now - (lastMoveTs || now)) / 1000;
          let instV = (dist * CURSOR_SPEED * dur) / dt;
          let dv = Math.max(0, Math.min(MAX_DV_CURSOR, instV * CURSOR_VEL_GAIN));
          vel = clampVel(vel + dv);
        }
      }
      lastX = e.clientX; lastY = e.clientY; lastMoveTs = now;
    };

    // --- Tap → smooth tween to next step (still works)
    let pdTime = 0, pdX = 0, pdY = 0;
    const onPointerDown = (e) => { pdTime = performance.now(); pdX = e.clientX; pdY = e.clientY; };
    const onPointerUp   = (e) => {
      const dt = performance.now() - pdTime;
      const moved = Math.hypot(e.clientX - pdX, e.clientY - pdY);
      // avoid tap if we really moved (touch scroll)
      if (dt < 300 && moved < 12) {
        const next = Math.floor(pos) + 1;
        tweenTo(next, (IS_MOBILE ? TAP_TWEEN_DUR_MOBILE : TAP_TWEEN_DUR_DESKTOP), TWEEN_EASE, TAP_IMPULSE);
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

    // Init bar + logo state
    setBar(0);
    if (logoEl) fadeLogoTo(true);

    // Cleanup hook
    window.seqStackDestroy = () => {
      cancelAnimationFrame(rafId);
      killProgressTween();
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
