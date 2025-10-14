(() => {
  // ====== YOUR TUNED VALUES ======
  const MAX_VISIBLE      = 2;
  const WHEEL_SPEED      = 0.00008;  // responsive wheel scrub
  const TOUCH_SPEED      = 0.00025;  // touch scrub factor
  const CURSOR_SPEED     = 0.00002;  // mouse move scrub (very small)
  const CURSOR_THRESHOLD = 3;
  const PIN_TO           = '.main-wrapper';

  // ====== MOMENTUM TUNABLES (calmed & capped) ======
  // velocity units: "timeline seconds per real second"
  const DAMPING_PER_SEC  = 0.35;   // higher = settles quicker
  const WHEEL_VEL_GAIN   = 0.06;   // wheel → momentum
  const TOUCH_VEL_GAIN   = 0.10;   // touch → momentum
  const CURSOR_VEL_GAIN  = 0.04;   // mouse move → momentum
  const TAP_IMPULSE      = 1.5;   // << stronger tap nudge
  const MAX_ABS_VEL      = 0.8;    // hard cap on velocity

  // per-event momentum caps (prevents micro inputs from huge fling)
  const MAX_DV_WHEEL   = 0.25;
  const MAX_DV_TOUCH   = 0.30;
  const MAX_DV_CURSOR  = 0.20;

  // End behavior
  const CROSSFADE_OFFSET    = 0.999;  // show last real image before clone
  const HOLD_AT_END_STEPS   = 0.75;   // linger time (in "step" units) for last real image

  // ====== SAFETY: don't run in customizer ======
  if (window.Shopify && Shopify.designMode) {
    console.log("[seqStack] Skipped: Shopify Customizer");
    return;
  }

  // clean prior run if hot-reloading
  if (window.seqStackDestroy) window.seqStackDestroy();

  const loadScriptOnce = (src) =>
    new Promise((res, rej) => {
      if ([...document.scripts].some(s => s.src.includes(src))) return res();
      const el = document.createElement('script');
      el.src = src; el.async = true; el.onload = res; el.onerror = rej;
      document.head.appendChild(el);
    });

  (async function run(){
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js');
    gsap.registerPlugin();

    // collect original nodes in DOM order
    const all = Array.from(document.querySelectorAll('.section_seq_image, .section_seq_text'));
    let imgSecs  = all.filter(n => n.classList.contains('section_seq_image'));
    const textSecs = all.filter(n => n.classList.contains('section_seq_text'));
    if (!imgSecs.length) return;

    const IS_MOBILE = window.innerWidth <= 767;

    // Stage + minimal CSS
    const stage = document.createElement('div'); stage.id = 'seqStageStack';
    const style = document.createElement('style'); style.id = 'seqStageStack-style';
    style.textContent = `
      #seqStageStack{position:relative;width:100%;height:100vh;overflow:hidden;touch-action:none;}
      #seqStageStack > .section_seq_image,
      #seqStageStack > .section_seq_text{position:absolute;inset:0;pointer-events:auto;}
      #seqStageStack .section_seq_image img,
      #seqStageStack .section_seq_image .seq-image{mix-blend-mode:darken;opacity:0;transition:none;}
      #seqStageStack > .section_seq_text{opacity:0;z-index:999999;}
    `;
    document.head.appendChild(style);
    const pinContainer = document.querySelector(PIN_TO) || document.body;
    pinContainer.insertBefore(stage, pinContainer.firstChild);

    // move nodes into stage (backup for cleanup)
    const backups = all.map(node => ({ node, parent: node.parentNode, next: node.nextSibling }));
    all.forEach(node => stage.appendChild(node));

    // === Auto loop clone handling ===
    const firstImgInFirstSec = imgSecs[0]?.querySelector('img, .seq-image, picture img');
    const lastImgInLastSec  = imgSecs[imgSecs.length - 1]?.querySelector('img, .seq-image, picture img');
    const sameEnds = !!(firstImgInFirstSec && lastImgInLastSec &&
                        (firstImgInFirstSec.currentSrc || firstImgInFirstSec.src) === (lastImgInLastSec.currentSrc || lastImgInLastSec.src));

    let hasLoopClone = false;
    if (!sameEnds && imgSecs.length > 1) {
      const firstSectionClone = imgSecs[0].cloneNode(true);
      firstSectionClone.setAttribute('aria-hidden', 'true');
      firstSectionClone.setAttribute('data-seq-clone', 'true');
      firstSectionClone.querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
      stage.appendChild(firstSectionClone);
      hasLoopClone = true;
      imgSecs = Array.from(stage.querySelectorAll('.section_seq_image'));
    }

    // inner images list
    const imgs = imgSecs.map(sec => sec.querySelector('img, .seq-image, picture img')).filter(Boolean);

    // init states
    gsap.set(imgs, { opacity: 0 });
    if (imgs[0]) gsap.set(imgs[0], { opacity: 1 });
    gsap.set(textSecs, { opacity: 0 });

    // map text -> image index right after it
    let seen = 0;
    const startIndex = new Map();
    Array.from(stage.querySelectorAll('.section_seq_image, .section_seq_text')).forEach(node => {
      if (node.classList.contains('section_seq_image')) seen++;
      if (node.classList.contains('section_seq_text')) startIndex.set(node, seen);
    });

    // which image indices linger on mobile
    const lingerIndices = new Set();
    if (IS_MOBILE) {
      textSecs.forEach(txt => {
        const afterIdx = Math.min(startIndex.get(txt) || 0, imgs.length - 1);
        if (afterIdx >= 0) lingerIndices.add(afterIdx);
      });
    }

    // ====== Build scrub timeline ======
    const tl = gsap.timeline({ paused: true });

    // fluid fades (linear for precise scrubbing)
    const FADE_DUR = 1.2;

    imgs.forEach((img, i) => {
      if (i > 0) tl.to(img, { opacity: 1, duration: FADE_DUR, ease: 'none' }, i);

      if (i >= MAX_VISIBLE && imgs[i - MAX_VISIBLE]) {
        const outIndex = i - MAX_VISIBLE;
        if (!(IS_MOBILE && lingerIndices.has(outIndex))) {
          tl.to(imgs[outIndex], { opacity: 0, duration: FADE_DUR, ease: 'none' }, i);
        }
      }
    });

    // mobile linger: schedule delayed fade-outs
    if (IS_MOBILE && lingerIndices.size) {
      const durTemp = tl.duration();
      const wrap = (t) => ((t % durTemp) + durTemp) % durTemp;
      lingerIndices.forEach(idx => {
        const delayedOutTime = idx + MAX_VISIBLE + 3;
        tl.to(imgs[idx], { opacity: 0, duration: FADE_DUR, ease: 'none' }, wrap(delayedOutTime));
      });
    }

    // Text visibility: INSTANT show/hide (no fades)
    textSecs.forEach(txt => {
      const sIdx = Math.min(startIndex.get(txt) || 0, imgs.length - 1);
      tl.set(txt, { opacity: 1 }, sIdx + 0.001);
      tl.set(txt, { opacity: 0 }, sIdx + 2);
    });

    // End-cap crossfade that preserves the LAST real image on screen (with added hold)
    if (imgs.length > 1) {
      const cloneIdx  = imgs.length - 1;      // auto-cloned first
      const lastReal  = cloneIdx - 1;
      const loopPoint = lastReal + CROSSFADE_OFFSET + HOLD_AT_END_STEPS;

      tl.to(imgs[cloneIdx], { opacity: 1, duration: FADE_DUR, ease: 'none' }, loopPoint);
      imgs.forEach((img, idx) => {
        if (idx !== cloneIdx) tl.to(img, { opacity: 0, duration: FADE_DUR, ease: 'none' }, loopPoint);
      });
    }

    // Logo reversible scrub-fade: fades at cycle start, reappears on replay
    const logoEl = document.querySelector('.shopify-section.logo-wrapper');
    const LOGO_FADE_STEPS = 2; // how many image-steps long the logo fade lasts

    // Progress bar (exclude loop clone)
    const bar = document.querySelector('.section_progress-bar .progress-bar');
    const mainSteps = Math.max(1, imgs.length - (hasLoopClone ? 1 : 0)); // exclude clone for bar

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
      if (dir === 'forward') {
        bar.style.width = '100%';
        gsap.to(bar, { width: '0%', duration: 0.35, ease: 'none', onComplete: () => { barWrapping = false; setBar(pos); } });
      } else {
        bar.style.width = '0%';
        gsap.to(bar, { width: '100%', duration: 0.35, ease: 'none', onComplete: () => { barWrapping = false; setBar(pos); } });
      }
    };

    // ====== Scrub driver with inertia (working version) ======
    let pos = 0;
    const dur = tl.duration();
    let vel = 0; // timeline sec / real sec
    let rafId = null;
    let lastTs = 0;

    const clampVel = (v) => Math.max(-MAX_ABS_VEL, Math.min(MAX_ABS_VEL, v));

    const setProgress = (p) => {
      const prevPos = pos;
      const proposed = p;
      const newPos = (proposed % dur + dur) % dur;

      if (proposed > prevPos && newPos < prevPos) animateBarWrap('forward');
      if (proposed < prevPos && newPos > prevPos) animateBarWrap('backward');

      pos = newPos;
      tl.time(pos, false);

      // logo opacity is tied to the current cycle time
      if (logoEl) {
        const fadeEnd = Math.min(LOGO_FADE_STEPS, dur || 1);
        const op = 1 - Math.max(0, Math.min(1, pos / fadeEnd));
        gsap.set(logoEl, { opacity: op });
      }

      setBar(pos);
    };

    const tick = (ts) => {
      rafId = requestAnimationFrame(tick);
      if (!lastTs) { lastTs = ts; return; }
      const dt = (ts - lastTs) / 1000; // seconds
      lastTs = ts;

      if (Math.abs(vel) > 1e-4) {
        setProgress(pos + vel * dt);
        // exponential damping per second
        const damp = Math.max(0, 1 - DAMPING_PER_SEC * dt);
        vel *= damp;
        if (Math.abs(vel) < 1e-4) vel = 0;
      }
    };

    rafId = requestAnimationFrame(tick);

    // ====== Inputs (wheel/touch/mouse move/tap) ======
    const opts = { passive: false };

    // Wheel (bi-directional, responsive but not ballistic)
    const onWheel = (e) => {
      e.preventDefault();
      // normalize delta across browsers (deltaMode 0=pixels, 1=lines, 2=pages)
      const lineHeight = 16; // px heuristic
      const unit = e.deltaMode === 1 ? lineHeight : (e.deltaMode === 2 ? window.innerHeight : 1);
      const dy = e.deltaY * unit;

      // immediate scrub (so it feels responsive)
      const deltaTime = dy * WHEEL_SPEED * dur;
      setProgress(pos + deltaTime);

      // add momentum (capped)
      let dv = (dy * WHEEL_SPEED * dur) * WHEEL_VEL_GAIN;
      dv = Math.max(-MAX_DV_WHEEL, Math.min(MAX_DV_WHEEL, dv));
      vel = clampVel(vel + dv);
    };

    // Touch (bi-directional, inertial)
    const activeTouches = { id: null, y: 0, vy: 0, lastY: 0, lastTs: 0 };
    const onTouchStart = (e) => {
      if (!e.touches.length) return;
      const t = e.touches[0];
      activeTouches.id = t.identifier;
      activeTouches.y = t.clientY;
      activeTouches.lastY = t.clientY;
      activeTouches.vy = 0;
      activeTouches.lastTs = performance.now();
    };
    const onTouchMove = (e) => {
      const t = [...e.touches].find(t => t.identifier === activeTouches.id) || e.touches[0];
      if (!t) return;
      e.preventDefault();

      const now = performance.now();
      const dy = activeTouches.y - t.clientY; // up = forward
      // immediate scrub
      setProgress(pos + dy * TOUCH_SPEED * dur);
      activeTouches.y = t.clientY;

      // velocity estimate
      const dy2 = activeTouches.lastY - t.clientY;
      const dt  = Math.max(1, now - activeTouches.lastTs) / 1000;
      const instVy = (dy2 * TOUCH_SPEED * dur) / dt;
      activeTouches.vy = activeTouches.vy * 0.5 + instVy * 0.5;
      activeTouches.lastY = t.clientY;
      activeTouches.lastTs = now;
    };
    const onTouchEnd = () => {
      // momentum push in last direction (capped)
      let dv = activeTouches.vy * TOUCH_VEL_GAIN;
      dv = Math.max(-MAX_DV_TOUCH, Math.min(MAX_DV_TOUCH, dv));
      vel = clampVel(vel + dv);
      activeTouches.id = null;
    };

    // Mouse move (forward only → adds small momentum; immediate scrub very small)
    let lastX = null, lastY = null, lastMoveTs = 0;
    const onMouseMove = (e) => {
      const now = performance.now();
      if (lastX != null && lastY != null) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist >= CURSOR_THRESHOLD) {
          // tiny immediate push forward (so cursor still progresses a bit)
          const deltaTime = dist * CURSOR_SPEED * dur;
          setProgress(pos + deltaTime);

          // add small forward momentum (no backward), capped
          const dt = Math.max(1, now - (lastMoveTs || now)) / 1000;
          let instV = (dist * CURSOR_SPEED * dur) / dt;
          let dv = instV * CURSOR_VEL_GAIN;
          dv = Math.max(0, Math.min(MAX_DV_CURSOR, dv)); // forward-only & capped
          vel = clampVel(vel + dv);
        }
      }
      lastX = e.clientX; lastY = e.clientY; lastMoveTs = now;
    };

    // Tap → stronger forward impulse, more mobile-safe
    let pdTime = 0, pdX = 0, pdY = 0;
    const onPointerDown = (e) => {
      pdTime = performance.now();
      pdX = e.clientX;
      pdY = e.clientY;
    };
    const onTapLike = (x, y) => {
      // immediate visible nudge + momentum
      setProgress(pos + TAP_IMPULSE * 0.5);
      vel = clampVel(vel + TAP_IMPULSE);
    };
    const onPointerUp = (e) => {
      const dt = performance.now() - pdTime;
      const moved = Math.hypot(e.clientX - pdX, e.clientY - pdY);
      if (dt < 350 && moved < 20) onTapLike(e.clientX, e.clientY);
    };

    stage.addEventListener('wheel', onWheel, opts);
    stage.addEventListener('touchstart', onTouchStart, opts);
    stage.addEventListener('touchmove', onTouchMove, opts);
    stage.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    stage.addEventListener('pointerdown', onPointerDown, { passive: true });
    stage.addEventListener('pointerup', onPointerUp, { passive: true });
    // also bind touchend to catch browsers that don’t emit pointer events
    stage.addEventListener('touchend', (e) => {
      // treat a quick, low-move touchend as a tap
      if (e.changedTouches && e.changedTouches[0]) {
        onTapLike(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    }, { passive: true });

    // init bar at 0
    setBar(0);

    // cleanup
    window.seqStackDestroy = () => {
      cancelAnimationFrame(rafId);
      tl.kill();
      backups.forEach(({node, parent, next}) => {
        node.style.opacity = ''; node.style.zIndex = '';
        if (next && next.parentNode === parent) parent.insertBefore(node, next);
        else parent.appendChild(node);
      });
      stage.remove(); style.remove();
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove', onTouchMove);
      stage.removeEventListener('touchend', onTouchEnd);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('mousemove', onMouseMove);
      delete window.seqStackDestroy;
      console.log('[seqStack] destroyed');
    };
  })();
})();
