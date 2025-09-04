(() => {
  // === your tuned values ===
  const MAX_VISIBLE = 2;
  const WHEEL_SPEED = 0.00005;
  const TOUCH_SPEED = 0.00025;
  const CURSOR_SPEED = 0.000065;
  const CURSOR_THRESHOLD = 3;
  const PIN_TO = '.main-wrapper';

  // Skip inside Shopify customizer
  if (window.Shopify && Shopify.designMode) {
    console.log("[seqStack] Skipped: in Shopify Customizer/Preview");
    return;
  }

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
      #seqStageStack > .section_seq_text{position:absolute;inset:0;pointer-events:none;}
      #seqStageStack .section_seq_image img,
      #seqStageStack .section_seq_image .seq-image{mix-blend-mode:darken;opacity:0;transition:none;}
      #seqStageStack > .section_seq_text{opacity:0;z-index:999999;}
    `;
    document.head.appendChild(style);
    const pinContainer = document.querySelector(PIN_TO) || document.body;
    pinContainer.insertBefore(stage, pinContainer.firstChild);

    // Move nodes into stage (backup for cleanup)
    const backups = all.map(node => ({ node, parent: node.parentNode, next: node.nextSibling }));
    all.forEach(node => stage.appendChild(node));

    // === Auto loop clone handling ===
    // If the last image section is already a duplicate of the first (manual),
    // we won't add another. Otherwise we clone the *entire* first section.
    const firstImgInFirstSec = imgSecs[0].querySelector('img, .seq-image, picture img');
    const lastImgInLastSec  = imgSecs[imgSecs.length - 1].querySelector('img, .seq-image, picture img');
    const sameEnds = !!(firstImgInFirstSec && lastImgInLastSec &&
                        firstImgInFirstSec.currentSrc === lastImgInLastSec.currentSrc ||
                        firstImgInFirstSec?.src === lastImgInLastSec?.src);

    let hasLoopClone = false;
    if (!sameEnds && imgSecs.length > 1) {
      const firstSectionClone = imgSecs[0].cloneNode(true);
      firstSectionClone.setAttribute('aria-hidden', 'true');
      firstSectionClone.setAttribute('data-seq-clone', 'true');
      firstSectionClone.querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
      stage.appendChild(firstSectionClone);
      hasLoopClone = true;
      // refresh image sections to include the clone at the end
      imgSecs = Array.from(stage.querySelectorAll('.section_seq_image'));
    }

    // images we animate are the inner <img> (or .seq-image) of each section
    const imgs = imgSecs
      .map(sec => sec.querySelector('img, .seq-image, picture img'))
      .filter(Boolean);

    // init states
    gsap.set(imgs, { opacity: 0 });
    if (imgs[0]) gsap.set(imgs[0], { opacity: 1 });
    gsap.set(textSecs, { opacity: 0 });

    // ---- Figure out which images should linger on mobile ----
    let seen = 0;
    const startIndex = new Map();     // text section -> image index after it
    Array.from(stage.querySelectorAll('.section_seq_image, .section_seq_text')).forEach(node => {
      if (node.classList.contains('section_seq_image')) seen++;
      if (node.classList.contains('section_seq_text')) startIndex.set(node, seen);
    });

    const lingerIndices = new Set();
    if (IS_MOBILE) {
      textSecs.forEach(txt => {
        const afterIdx = Math.min(startIndex.get(txt) || 0, imgs.length - 1);
        if (afterIdx >= 0) lingerIndices.add(afterIdx);
      });
    }

    // ---- Build the scrub timeline: keep MAX_VISIBLE on stack ----
    const tl = gsap.timeline({ paused: true });

    imgs.forEach((img, i) => {
      // fade current in at its step
      if (i > 0) tl.to(img, { opacity: 1, duration: 1 }, i);

      // determine the image that would normally fade out at this step
      if (i >= MAX_VISIBLE && imgs[i - MAX_VISIBLE]) {
        const outIndex = i - MAX_VISIBLE;

        // If this image should linger on mobile, skip its normal fade-out here
        if (!(IS_MOBILE && lingerIndices.has(outIndex))) {
          tl.to(imgs[outIndex], { opacity: 0, duration: 1 }, i);
        }
      }
    });

    // ---- Schedule delayed fade-outs for linger images (mobile only) ----
    if (IS_MOBILE && lingerIndices.size) {
      const durTemp = tl.duration();
      const wrap = (t) => ((t % durTemp) + durTemp) % durTemp; // normalize time within duration

      lingerIndices.forEach(idx => {
        const originalOutTime = idx + MAX_VISIBLE;     // when it would normally fade out
        const delayedOutTime  = idx + MAX_VISIBLE + 3; // keep 3 extra steps visible
        tl.to(imgs[idx], { opacity: 0, duration: 1 }, wrap(delayedOutTime));
      });
    }

    // ---- Text visibility (visible for 2 image steps) ----
    textSecs.forEach(txt => {
      const sIdx = Math.min(startIndex.get(txt) || 0, imgs.length - 1);
      tl.to(txt, { opacity: 1, duration: 0.5 }, sIdx + 0.001);
      tl.to(txt, { opacity: 0, duration: 0.5 }, sIdx + 2);
    });

    // ---- Logo scrub-fade (one-way: won’t reappear if scrubbing back) ----
    const logoEl = document.querySelector('.shopify-section.logo-wrapper');
    const LOGO_FADE_STEPS = 2;
    let logoMinOpacity = 1;

    // ---- Progress bar (exclude loop clone from progress) ----
    const bar = document.querySelector('.section_progress-bar .progress-bar');
    const mainSteps = Math.max(1, imgs.length - (hasLoopClone ? 1 : 0)); // exclude clone if we added one

    const setBar = (t) => {
      if (!bar) return;
      // t is timeline time; progress should be 0..1 over the "main" portion only
      const p = Math.min(t / mainSteps, 1);
      bar.style.width = (p * 100).toFixed(3) + '%';
    };

    // ---- Scrub driver ----
    let pos = 0;
    const dur = tl.duration();

    const applyLogoOpacityFromTime = (t) => {
      if (!logoEl) return;
      const fadeEnd = Math.min(LOGO_FADE_STEPS, dur || 1);
      const calc = 1 - Math.max(0, Math.min(1, t / fadeEnd));
      if (calc < logoMinOpacity) {
        logoMinOpacity = calc;
        gsap.set(logoEl, { opacity: logoMinOpacity });
      }
    };

    const setProgress = (p) => {
      pos = (p % dur + dur) % dur; // wrap
      tl.time(pos, false);
      applyLogoOpacityFromTime(pos);
      setBar(pos);                 // update progress bar
    };

    // inputs
    const onWheel = (e) => { e.preventDefault(); setProgress(pos + e.deltaY * WHEEL_SPEED * dur); };
    const activeTouches = { id: null, y: 0 };
    const onTouchStart = (e) => { if (e.touches.length){ activeTouches.id = e.touches[0].identifier; activeTouches.y = e.touches[0].clientY; } };
    const onTouchMove = (e) => {
      const t = [...e.touches].find(t => t.identifier === activeTouches.id) || e.touches[0];
      if (!t) return; e.preventDefault();
      const dy = activeTouches.y - t.clientY;
      setProgress(pos + dy * TOUCH_SPEED * dur);
      activeTouches.y = t.clientY;
    };
    let lastX = null, lastY = null;
    const onMouseMove = (e) => {
      if (lastX != null && lastY != null) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist >= CURSOR_THRESHOLD) setProgress(pos + dist * CURSOR_SPEED * dur);
      }
      lastX = e.clientX; lastY = e.clientY;
    };

    const opts = { passive: false };
    stage.addEventListener('wheel', onWheel, opts);
    stage.addEventListener('touchstart', onTouchStart, opts);
    stage.addEventListener('touchmove', onTouchMove, opts);
    window.addEventListener('mousemove', onMouseMove);

    // initialize bar at 0
    setBar(0);

    // cleanup
    window.seqStackDestroy = () => {
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
      window.removeEventListener('mousemove', onMouseMove);
      delete window.seqStackDestroy;
      console.log('[seqStack] destroyed');
    };
  })();
})();
