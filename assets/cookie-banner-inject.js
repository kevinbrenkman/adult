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

  // Styles: banner (≥1550 row, <1550 stacked) + branded prefs dialog + new media queries
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
.shopify-pc__banner__dialog button:focus,
.shopify-pc__banner__dialog button:focus-visible{
  box-shadow:unset !important; outline:none !important;
}

/* Variant borders/colors for all three */
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-manage-prefs,
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-decline,
.shopify-pc__banner__dialog button.shopify-pc__banner__btn-accept{
  border:1px solid var(--_adult---adult-red) !important;
  border-top:none !important;
  background:var(--_adult---adult-off-white) !important
