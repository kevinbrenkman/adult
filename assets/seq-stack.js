(() => {
  // ========= TUNABLES =========
  const MAX_VISIBLE       = 2;
  const WHEEL_SPEED       = 0.000035;  // scroll sensitivity (position)
  const TOUCH_SPEED       = 0.00025;
  const CURSOR_SPEED      = 0.00002;
  const CURSOR_THRESHOLD  = 3;         // px before cursor contributes
  const PIN_TO            = '.main-wrapper';

  // Shared momentum (cursor/touch)
  // More pronounced kinetic easing on mobile
  const DAMPING_PER_SEC   = 0.45;   // slower decay → longer ease-out (~1s)
  const TOUCH_VEL_GAIN    = 0.11;   // stronger flick momentum
  const CURSOR_VEL_GAIN   = 0.03;
  const MAX_ABS_VEL       = 0.5;    // clamp to prevent overshoot
  const MAX_DV_TOUCH      = 0.22;
  const MAX_DV_CURSOR     = 0.15;

  // NEW: Wheel kinetic tail (guaranteed ~1s ease-out after scroll stops)
  const WHEEL_TAIL_GAIN   = 2.50;      // how much of the last wheel delta contributes to tail
  const WHEEL_TAIL_TAU    = 2.50;      // seconds — larger = longer coast
  const MAX_WHEEL_TAIL    = 0.45;      // clamp safety for huge flicks

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

  // ===== Guard: don’t run in Shopify customizer
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

    // Stage + minimal CSS
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

    // Move nodes into stage for control (track backups for restore)
    const backups = all.map(node => ({ node, parent: node.parentNode, next: node.nextSibling }));
    all.forEach(node => stage.appendChild(node));

    // Auto-clone first image section to end for loop
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

    // Mobile linger (+3 after each text)
    const lingerIndices = new Set();
    if (IS_MOBILE) {
      textSecs.forEach(txt => {
        const idx = Math.min(startIndex.get(txt) || 0, imgs.length - 1);
        if (idx >= 0) lingerIndices.add(idx);
      });
    }

    // Timeline = 1 unit per image step, linear for precise scrubbing
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

    // Text instant show/hide
    textSecs.forEach(txt => {
      const sIdx = Math.min(startIndex.get(txt) || 0, imgs.length - 1);
      tl.set(txt, { opacity: 1 }, sIdx + 0.001);
      tl.set(txt, { opacity: 0 }, sIdx + 2);
    });

    // Logo bidirectional fade (event-driven; no half-stall)
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

    // End-cap: crossfade to clone after holding last real image
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

    // ===== Driver state
    let pos = 0, vel = 0, lastTs = 0;
    const dur = tl.duration();
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const clampVel = (v) => clamp(v, -MAX_ABS_VEL, MAX_ABS_VEL);

    // NEW: dedicated wheel tail velocity (decays over ~1s after wheel stop)
    let wheelTailVel = 0;

    const setProgress = (p) => {
      const prev = pos;
      const newPos = ((p % dur) + dur) % dur;

      if (p > prev && newPos < prev) animateBarWrap('forward');
      if (p < prev && newPos > prev) animateBarWrap('backward');

      pos = newPos;
      tl.time(pos, false);
      setBar(pos);

      // Logo: visible only at beginning (before LOGO_OUT_START)
      if (logoEl) fadeLogoTo(pos < LOGO_OUT_START);
    };

    const tick = (ts) => {
      requestAnimationFrame(tick);
      if (!lastTs) { lastTs = ts; return; }
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;

      // Shared vel (cursor/touch impulses)
      if (Math.abs(vel) > 1e-4) {
        setProgress(pos + vel * dt);
        vel *= Math.max(0, 1 - DAMPING_PER_SEC * dt);
        if (Math.abs(vel) < 1e-4) vel = 0;
      }

      // Wheel kinetic tail (decays exponentially — ~1s glide)
      if (Math.abs(wheelTailVel) > 1e-4) {
        setProgress(pos + wheelTailVel * dt);
        const decay = Math.exp(-dt / WHEEL_TAIL_TAU);
        wheelTailVel *= decay;
        if (Math.abs(wheelTailVel) < 1e-4) wheelTailVel = 0;
      }
    };
    requestAnimationFrame(tick);

    // ===== Inputs
    const opts = { passive: false };

    // Wheel → immediate move + start/refresh tail velocity
    const onWheel = (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? window.innerHeight : 1);
      const dy = e.deltaY * unit;

      // Immediate scrub
      const deltaPos = dy * WHEEL_SPEED * dur;
      setProgress(pos + deltaPos);

      // Kick tail: portion of this delta becomes starting tail velocity (px/s in timeline units)
      // Convert "instant delta" into a per-second velocity by assuming a ~60Hz wheel update → frame ~16ms
      const estimatedDt = 1 / 60;
      let newTail = (deltaPos / estimatedDt) * WHEEL_TAIL_GAIN;
      wheelTailVel = clamp(wheelTailVel * 0.4 + newTail * 0.6, -MAX_WHEEL_TAIL, MAX_WHEEL_TAIL);
    };

    // Touch with kinetic
    const activeTouches = { id:null, y:0, vy:0, lastY:0, lastTs:0, movedTotal:0 };
    const onTouchStart = (e) => {
      const t = e.touches[0]; if (!t) return;
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
      activeTouches.vy = activeTouches.vy * 0.5 + instVy * 0.5;
      activeTouches.lastY = t.clientY;
      activeTouches.lastTs = now;
    };
    const onTouchEnd = () => {
      if (activeTouches.movedTotal > 6) {
        let dv = activeTouches.vy * TOUCH_VEL_GAIN * 1.25; // emphasize inertia tail
        dv = clamp(dv, -MAX_DV_TOUCH, MAX_DV_TOUCH);
        vel = clampVel(vel + dv);
      }
      activeTouches.id = null;
    };

    // Cursor move (forward-only momentum)
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
          dv = clamp(dv, 0, MAX_DV_CURSOR); // forward-only
          vel = clampVel(vel + dv);
        }
      }
      lastX = e.clientX; lastY = e.clientY; lastMoveTs = now;
    };

    // Tap → smooth tween to next step
    let pdTime = 0, pdX = 0, pdY = 0;
    const tweenTo = (targetTime, durSec, easeStr = TAP_TWEEN_EASE) => {
      vel = 0; // pause shared momentum during tween
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
        tweenTo(next, IS_MOBILE ? TAP_TWEEN_DUR_MOBILE : TAP_TWEEN_DUR_DESKTOP);
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

    // Cleanup hook for hot-reload or re-init
    window.seqStackDestroy = () => {
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
