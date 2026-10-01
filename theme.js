/**
 * Backward-compatible shim — loads Theme Studio apply layer.
 * Prefer: <script src="./theme-studio/aq-theme-apply.js"></script>
 */
(function () {
  'use strict';
  if (window.AQTheme) return;
  var s = document.createElement('script');
  s.src = (document.currentScript && document.currentScript.getAttribute('data-studio-src'))
    || './theme-studio/aq-theme-apply.js';
  s.async = false;
  document.head.appendChild(s);
})();
