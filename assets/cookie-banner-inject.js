/* assets/cookie-banner-injector.js */
(function () {
  var DELAY_MS = 1000; // 1s delayed reveal
  var CSS_ID = 'cookie-banner-css';
  var HIDE_ID = 'cookie-hide-inline';
  if (document.getElementById(CSS_ID)) return;

  if (!document.getElementById(HIDE_ID)) {
    var hide = document.createElement('style');
    hide.id = HIDE_ID;
    hide.textContent = '.shopify-pc__banner__dialog{display:none!important}';
    document.head.appendChild(hide);
  }

  var css = `
/* =======================
   MAIN BANNER
   ======================= */
.shopify-pc__banner__dialog{
  left:0;width:100%;padding:0 !important;
  background:var(--_adult---adult-off-white) !important;
  border-top-left-radius:0;border-top-right-radius:0;
  border-top:1px solid var(--_adult---adult-red) !important;
}
@media (min-width:1550px){ .shopify-pc__banner__dialog{ box-shadow:none !important; } }

/* Title */
.shopify-pc__banner__dialog h2{
  font-size:100%;margin:0;color:var(--_adult---adult-red) !important;
  padding:0 .5rem !important;height:var(--_adult---default-height);
  display:flex;align-items:center;width:auto;white-space:nowrap;border-right:0;border-bottom:0;
}

/* Body */
.shopify-pc__banner__dialog p{ color:var(--_adult---adult-red) !important; padding:.5rem !important; }

/* Wrapper/body */
.shopify-pc__banner__wrapper{ align-items:flex-end; flex-direction:row; }
@media (min-width:1550px){
  .shopify-pc__banner__wrapper{ max-height:var(--_adult---default-height); }
  .shopify-pc__banner__body{ margin-bottom:-4px !important; }
  .shopify-pc__banner__dialog h2{ border-right:1px solid var(--_adult---adult-red) !important; }
}
.shopify-pc__banner__body{ margin-bottom:0;min-height:var(--_adult---default-height);display:flex;align-items:center;flex-direction:row; }

/* Buttons row */
.shopify-pc__banner__btns{
  gap:0;flex-direction:row-reverse; /* desktop keeps row-reverse */
  width:auto;white-space:nowrap;border-top:0;
}
.shopify-pc__banner__dialog button{
  border:none;border-top:none!important;text-decoration:none;font:inherit;
  padding:0 .5rem !important;margin:0;flex:1 1 0;border-radius:0;line-height:100%;
  text-align:center;height:var(--_adult---default-height);color:var(--_adult---adult-red) !important;
}
.shopify-pc__banner__dialog button:hover{ text-decoration:underline; }
.shopify-pc__banner__dialog button:focus,
.shopify-pc__banner__dialog button:focus-visible{ box-shadow:unset !important; outline:none !important; }

/* Base borders: use only LEFT separators to avoid doubles */
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-manage-prefs,
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-decline,
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-accept{
  border:1px solid var(--_adult---adult-red) !important;
  border-top:none !important;
  border-bottom:none !important;
  border-right:0 !important;
  border-left:1px solid var(--_adult---adult-red) !important; /* separator */
  background:var(--_adult---adult-off-white) !important;
  color:var(--_adult---adult-red) !important;
  text-transform:uppercase;
}

/* First visually: ACCEPT → no left separator */
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-accept{
  border-left:0 !important;
}

/* Remove any legacy rule that added a right border on Decline */
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-decline{
  border-right:0 !important; /* ensure no extra right border */
}

/* Manage Prefs spacing + hover underline */
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-manage-prefs{
  padding-left:.5rem !important;padding-right:.5rem !important;text-decoration:none;
}
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-manage-prefs:hover{ text-decoration:underline; }
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-manage-prefs:focus span{ outline:none!important; }

/* Links */
.shopify-pc__banner__dialog a{ color:var(--_adult---adult-red) !important; text-decoration:none; }
.shopify-pc__banner__dialog a:hover{ text-decoration:underline; }

/* ===== VISUAL ORDER =====
   Goal: Accept → Decline → Preferences
*/

/* Desktop (≥1550px) uses row-reverse, so give ACCEPT the HIGHEST order */
@media (min-width:1550px){
  .shopify-pc__banner__dialog button.shopify-pc__banner__btn-manage-prefs{ order:1; }
  .shopify-pc__banner__dialog button.shopify-pc__banner__btn-decline{ order:2; }
  .shopify-pc__banner__dialog button.shopify-pc__banner__btn-accept{  order:3; }
}

/* Mobile/tablet (<1550px) switches to row and stacks other elements as before */
@media (max-width:1549px){
  .shopify-pc__banner__wrapper{ flex-direction:column; max-height:none; }
  .shopify-pc__banner__body{ flex-direction:column; }
  .shopify-pc__banner__dialog h2{ width:100%; white-space:normal; border-bottom:1px solid var(--_adult---adult-red) !important; }
  .shopify-pc__banner__dialog p{ width:100% !important; }
  .shopify-pc__banner__btns{ flex-direction:row; width:100%; border-top:1px solid var(--_adult---adult-red) !important; }

  /* Left-to-right because flex-direction: row */
  .shopify-pc__banner__dialog button.shopify-pc__banner__btn-accept{  order:1; }
  .shopify-pc__banner__dialog button.shopify-pc__banner__btn-decline{ order:2; }
  .shopify-pc__banner__dialog button.shopify-pc__banner__btn-manage-prefs{ order:3; }
}

/* =======================
   PREFS DIALOG (BRANDED) ... (unchanged below)
   ======================= */

/* (Keep your existing prefs styles + responsive additions here unchanged) */
`;

  function inject() {
    if (document.getElementById(CSS_ID)) return;
    var style = document.createElement('style');
    style.id = CSS_ID;
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
    var h = document.getElementById(HIDE_ID);
    if (h) h.remove();
  }

  function ready(fn){ if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',fn);} else { fn(); } }
  ready(function(){ setTimeout(inject, DELAY_MS); });

  window.reinjectCookieCSS = function (newCss) {
    var s = document.getElementById(CSS_ID);
    if (s) s.remove();
    if (typeof newCss === 'string') css = newCss;
    inject();
  };
})();
