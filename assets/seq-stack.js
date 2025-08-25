{% comment %} snippets/seq-stack.liquid {% endcomment %}
<script>
(() => {
  const MAX_VISIBLE = 2;        
  const WHEEL_SPEED = 0.0001;
  const TOUCH_SPEED = 0.0002;
  const CURSOR_SPEED = 0.0005;
  const CURSOR_THRESHOLD = 3;
  const PIN_TO = '.main-wrapper';

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

    const all = Array.from(document.querySelectorAll('.section_seq_image, .section_seq_text'));
    const imgSecs  = all.filter(n => n.classList.contains('section_seq_image'));
    const textSecs = all.filter(n => n.classList.contains('section_seq_text'));
    if (!imgSecs.length) return;

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

    const backups = all.map(node => ({ node, parent: node.parentNode, next: node.nextSibling }));
    all.forEach(node => stage.appendChild(node));

    const imgs = imgSecs.map(s => s.querySelector('img, .seq-image, picture img')).filter(Boolean);

    gsap.set(imgs, { opacity: 0 });
    if (imgs[0]) gsap.set(imgs[0], { opacity: 1 });
    gsap.set(textSecs, { opacity: 0 });

    const tl = gsap.timeline({ paused: true });
    imgs.forEach((img, i) => {
      if (i > 0) tl.to(img, { opacity: 1, duration: 1 }, i);
      if (i >= MAX_VISIBLE && imgs[i - MAX_VISIBLE]) {
        tl.to(imgs[i - MAX_VISIBLE], { opacity: 0, duration: 1 }, i);
      }
    });

    let seen = 0;
    const startIndex = new Map();
    all.forEach(node => {
      if (node.classList.contains('section_seq_image')) seen++;
      if (node.classList.contains('section_seq_text')) startIndex.set(node, seen);
    });
    textSecs.forEach(txt => {
      const sIdx = Math.min(startIndex.get(txt) || 0, imgs.length - 1);
      tl.to(txt, { opacity: 1, duration: 0.5 }, sIdx + 0.001);
      tl.to(txt, { opacity: 0, duration: 0.5 }, sIdx + 2);
    });

    let pos = 0;
    const dur = tl.duration();
    const setProgress = (p) => { pos = (p % dur + dur) % dur; tl.time(pos, false); };

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
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist >= CURSOR_THRESHOLD) {
          setProgress(pos + dist * CURSOR_SPEED * dur);
        }
      }
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const opts = { passive: false };
    stage.addEventListener('wheel', onWheel, opts);
    stage.addEventListener('touchstart', onTouchStart, opts);
    stage.addEventListener('touchmove', onTouchMove, opts);
    window.addEventListener('mousemove', onMouseMove);

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
</script>
