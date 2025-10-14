/* assets/cookie-banner-injector.js */
(function () {
  var DELAY_MS = 1000; // 1s delayed reveal
  var CSS_ID = 'cookie-banner-css';
  var HIDE_ID = 'cookie-hide-inline';

  if (document.getElementById(CSS_ID)) return;

  // Hide native banner immediately to avoid unstyled flash
  if (!document.getElementById(HIDE_ID)) {
    var hide = document.createElement('style');
    hide.id = HIDE_ID;
    hide.textContent = '.shopify-pc__banner__dialog{display:none!important}';
    document.head.appendChild(hide);
  }

  // Styles: banner (≥1550 row, <1550 stacked) + branded prefs dialog
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
@media (min-width:1550px){
  .shopify-pc__banner__dialog{ box-shadow:none !important; }
}

/* Title */
.shopify-pc__banner__dialog h2{
  font-size:100%;margin:0;color:var(--_adult---adult-red) !important;
  padding:0 .5rem !important;height:var(--_adult---default-height);
  display:flex;align-items:center;
  width:auto;white-space:nowrap;border-right:0;border-bottom:0;
}

/* Body */
.shopify-pc__banner__dialog p{
  color:var(--_adult---adult-red) !important;
  padding:.5rem !important;
}

/* Wrapper/body */
.shopify-pc__banner__wrapper{ align-items:flex-end; flex-direction:row; }
@media (min-width:1550px){
  .shopify-pc__banner__wrapper{ max-height:var(--_adult---default-height); }
  .shopify-pc__banner__body{ margin-bottom:-4px !important; }
  .shopify-pc__banner__dialog h2{ border-right:1px solid var(--_adult---adult-red) !important; }
}
.shopify-pc__banner__body{
  margin-bottom:0;min-height:var(--_adult---default-height);
  display:flex;align-items:center;flex-direction:row;
}

/* Buttons row */
.shopify-pc__banner__btns{
  gap:0;flex-direction:row-reverse;
  width:auto;white-space:nowrap;border-top:0;
}
.shopify-pc__banner__dialog button{
  border:none;border-top:none!important;text-decoration:none;font:inherit;
  padding:0 .5rem !important;margin:0;flex:1 1 0;border-radius:0;line-height:100%;
  text-align:center;height:var(--_adult---default-height);
  color:var(--_adult---adult-red) !important;
}
.shopify-pc__banner__dialog button:hover{ text-decoration:underline; }

/* Variant borders/colors for all three */
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-manage-prefs,
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-decline,
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-accept{
  border:1px solid var(--_adult---adult-red) !important;
  border-top:none !important;
  background:var(--_adult---adult-off-white) !important;
  color:var(--_adult---adult-red) !important;
  text-transform:uppercase;
  border-bottom:none !important;
  border-right:0 !important;
}

/* Per-button tweaks */
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-accept{
  border-left:0 !important;
}
@media (min-width:1550px){
  .shopify-pc__banner__dialog button.shopify-pc__banner__btn-decline{
    border-left:1px solid var(--_adult---adult-red) !important;
  }
}

/* Manage Prefs button */
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-manage-prefs{
  padding-left:.5rem !important; padding-right:.5rem !important; text-decoration:none;
  color:var(--_adult---adult-red) !important;
}
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-manage-prefs:hover{ text-decoration:underline; }
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-manage-prefs:focus span{ outline:none!important; }

/* Links */
.shopify-pc__banner__dialog a{ color:var(--_adult---adult-red) !important; text-decoration:none; }
.shopify-pc__banner__dialog a:hover{ text-decoration:underline; }

/* ===== Stacked layout BELOW 1550px (≤1549px) ===== */
@media (max-width:1549px){
  .shopify-pc__banner__wrapper{ flex-direction:column; max-height:none; }
  .shopify-pc__banner__body{ flex-direction:column; }
  .shopify-pc__banner__dialog h2{ width:100%; white-space:normal; border-bottom:1px solid var(--_adult---adult-red) !important; }
  .shopify-pc__banner__dialog p{ width:100% !important; }
  .shopify-pc__banner__btns{ flex-direction:row; width:100%; border-top:1px solid var(--_adult---adult-red) !important; }
  /* Button order: Decline → Accept → Manage */
  .shopify-pc__banner__dialog button.shopify-pc__banner__btn-decline{ order:1; border-left:0 !important; }
  .shopify-pc__banner__dialog button.shopify-pc__banner__btn-accept{ order:2; }
  .shopify-pc__banner__dialog button.shopify-pc__banner__btn-manage-prefs{ order:3; }
}


/* =======================
   PREFERENCES DIALOG (BRANDED)
   ======================= */
.shopify-pc__prefs__dialog{
  position:fixed !important; z-index:2000002 !important; opacity:1 !important;
  background-color:hsl(0deg,0%,100%,100%) !important;
  max-height:80% !important; overflow-y:auto !important;
  top:50% !important; transform:translate(0,-50%) !important;
  min-width:280px !important; display:flex !important; flex-direction:column !important;
  left:25% !important; width:50% !important; text-align:left !important;
  border:1px solid var(--_adult---adult-red) !important;
}

/* Header + title */
.shopify-pc__prefs__dialog header{
  padding:0rem !important; /* changed from 1rem */
  border-bottom:1px solid var(--_adult---adult-red) !important;
}
.shopify-pc__prefs__dialog header h2{
  color:var(--_adult---adult-red) !important;
  font-size:1em !important;
  margin-left:.5rem !important;
}

/* Header actions */
.shopify-pc__prefs__header-actions{
  padding:0 !important;
  height:var(--_adult---default-height) !important;
  margin-right:-1px !important;
}
.shopify-pc__prefs__header-actions button{
  border-radius:0 !important;
  border:1px solid var(--_adult---adult-red) !important;
  color:var(--_adult---adult-red) !important;
  text-transform:uppercase !important;
  padding:.5rem .5rem !important;
  margin:-1px !important;
  font-size:100% !important;
  line-height:100% !important;
}
.shopify-pc__prefs__header-actions button.primary{
  background:var(--_adult---adult-red) !important; color:#fff !important;
}
.shopify-pc__prefs__header-actions button:focus{
  outline:none !important; box-shadow:unset !important;
}
.shopify-pc__prefs__header-close:focus{
  outline:none !important; box-shadow:unset !important;
}
.shopify-pc__prefs__header-actions button:hover{
  cursor:pointer; text-underline-offset:2px; text-decoration:underline;
}

/* Intro */
.shopify-pc__prefs__intro-main{
  padding:.5rem !important; line-height:1 !important;
}
.shopify-pc__prefs__intro-main h3{ font-size:100% !important; }
.shopify-pc__prefs__intro h3{ margin:0 0 6px 0 !important; line-height:1 !important; }
.shopify-pc__prefs__intro p{ color:var(--_adult---adult-red) !important; }

/* Options wrapper + items */
.shopify-pc__prefs__options{ padding:0rem !important; }
.shopify-pc__prefs__option{
  text-transform:uppercase !important;
  border-top:1px solid var(--_adult---adult-red) !important;
  padding:.5rem !important;
}
.shopify-pc__prefs__option:first-child{
  border-top:1px solid var(--_adult---adult-red) !important;
  padding:.5rem !important; margin:0 !important;
}
.shopify-pc__prefs__option label{
  color:var(--_adult---adult-red) !important; font-size:100% !important; text-transform:uppercase !important;
}
.shopify-pc__prefs__option p{
  color:var(--_adult---adult-red) !important; margin-top:-10px !important; margin-bottom:5px !important;
}

/* Checkbox icons — brand red + correct visibility */
.shopify-pc__prefs__option [data-icon-type="checked"] path,
.shopify-pc__prefs__option [data-icon-type="unchecked"] path{
  fill:var(--_adult---adult-red) !important;
}
/* ARIA pattern */
.shopify-pc__prefs__option [aria-checked="true"] [data-icon-type="checked"]{ display:block !important; }
.shopify-pc__prefs__option [aria-checked="true"] [data-icon-type="unchecked"]{ display:none !important; }
.shopify-pc__prefs__option [aria-checked="false"] [data-icon-type="checked"]{ display:none !important; }
.shopify-pc__prefs__option [aria-checked="false"] [data-icon-type="unchecked"]{ display:block !important; }
/* Input sibling pattern */
.shopify-pc__prefs__option input[type="checkbox"]:checked ~ span [data-icon-type="checked"]{ display:block !important; }
.shopify-pc__prefs__option input[type="checkbox"]:checked ~ span [data-icon-type="unchecked"]{ display:none !important; }
.shopify-pc__prefs__option input[type="checkbox"]:not(:checked) ~ span [data-icon-type="checked"]{ display:none !important; }
.shopify-pc__prefs__option input[type="checkbox"]:not(:checked) ~ span [data-icon-type="unchecked"]{ display:block !important; }
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

  // Optional: quick tweak helper from console
  window.reinjectCookieCSS = function (newCss) {
    var s = document.getElementById(CSS_ID);
    if (s) s.remove();
    if (typeof newCss === 'string') css = newCss;
    inject();
  };
})();
