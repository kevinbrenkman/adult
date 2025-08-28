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

    // 🔁 Deep-clone the FIRST .section_seq_image (entire section)
    if (imgSecs.length > 1) {
      const firstSectionClone = imgSecs[0].cloneNode(true);
      firstSectionClone.setAttribute('aria-hidden', 'true');
      firstSectionClone.setAttribute('data-seq-clone', 'true');
      // ensure any image inside the clone loads
      firstSectionClone.querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
      stage.appendChild(firstSectionClone);
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

    // build scrub timeline: keep MAX_VISIBLE on stack
    const tl = gsap.timeline({ paused: true });
    imgs.forEach((img, i) => {
      if (i > 0) tl.to(img, { opacity: 1, duration: 1 }, i);
      if (i >= MAX_VISIBLE && imgs[i - MAX_VISIBLE]) {
        tl.to(imgs[i - MAX_VISIBLE], { opacity: 0, duration: 1 }, i);
      }
    });

    // text visibility (for 2 image steps)
    let seen = 0;
    const startIndex = new Map();
    Array.from(stage.querySelectorAll('.section_seq_image, .section_seq_text')).forEach(node => {
      if (node.classList.contains('section_seq_image')) seen++;
      if (node.classList.contains('section_seq_text')) startIndex.set(node, seen);
    });
    textSecs.forEach(txt => {
      const sIdx = Math.min(startIndex.get(txt) || 0, imgs.length - 1);
      tl.to(txt, { opacity: 1, duration: 0.5 }, sIdx + 0.001);
      tl.to(txt, { opacity: 0, duration: 0.5 }, sIdx + 2);
    });

    // logo scrub-fade (one-way)
    const logoEl = document.querySelector('.shopify-section.logo-wrapper');
    const LOGO_FADE_STEPS = 2;
    let logoMinOpacity = 1;

    // scrub driver
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
