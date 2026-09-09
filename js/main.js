/* Deadly Foods — page wiring: animation loop, resize, logo fallback,
 * reduced-motion handling and the fade between pages. */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* --------------------------------------------- optional real artwork --- */
  // If assets/logo.png is dropped in, it replaces the generated stand-in.
  var logoImg = document.getElementById("logo-img");
  var logoSvg = document.querySelector(".logo__svg");
  if (logoImg) {
    var probe = new Image();
    probe.onload = function () {
      logoImg.src = probe.src;
      logoImg.hidden = false;
      if (logoSvg) logoSvg.remove();
    };
    probe.src = logoImg.getAttribute("src");
  }

  /* ----------------------------------------------------- headline fit --- */
  // Both lines in the window are set to the same measured width, 75% of the
  // card, so the type keeps the artwork's proportions whichever face loads.
  var win = document.querySelector(".window");
  var fitted = win ? [
    [win.querySelector(".title"), 0.75],
    [win.querySelector(".enter"), 0.75]
  ].filter(function (pair) { return pair[0]; }) : [];

  function fitText() {
    if (!win || !fitted.length) return;
    var box = win.getBoundingClientRect().width;
    if (!box) return;
    for (var i = 0; i < fitted.length; i++) {
      var el = fitted[i][0];
      el.style.fontSize = "100px";
      var natural = el.getBoundingClientRect().width;
      if (!natural) { el.style.fontSize = ""; continue; }
      el.style.fontSize = (100 * (box * fitted[i][1]) / natural).toFixed(2) + "px";
    }
  }

  fitText();
  window.addEventListener("resize", fitText);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitText);

  /* ------------------------------------------------------- animated band --- */
  var fireCanvas = document.getElementById("fire");
  var driftCanvas = document.getElementById("drift");
  var fire = null;
  var drift = null;

  if (fireCanvas && window.DeadlyFire) fire = new window.DeadlyFire(fireCanvas);
  if (driftCanvas && window.DeadlyDrift) drift = new window.DeadlyDrift(driftCanvas);

  if (fire || drift) {
    var resizeTimer;
    var onResize = function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (fire) fire.resize();
        if (drift) drift.resize();
        if (reduced.matches) { if (fire) fire.still(); if (drift) drift.still(); }
      }, 120);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    var last = 0;
    var running = false;

    var frame = function (now) {
      if (!running) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (fire) fire.tick(dt);
      if (drift) drift.tick(dt);
      requestAnimationFrame(frame);
    };

    var start = function () {
      if (running || reduced.matches) return;
      running = true;
      last = 0;
      requestAnimationFrame(frame);
    };
    var stop = function () { running = false; };

    var apply = function () {
      if (reduced.matches) {
        stop();
        if (fire) fire.still();
        if (drift) drift.still();
      } else {
        start();
      }
    };

    // pause while the tab is hidden so the bands do not burn cycles offscreen
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else apply();
    });

    if (reduced.addEventListener) reduced.addEventListener("change", apply);
    apply();
  }

  /* -------------------------------------------------- page transitions --- */
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("a[href]");
    if (!link) return;
    if (reduced.matches) return;
    if (link.target || link.hasAttribute("download")) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    var href = link.getAttribute("href");
    if (!href || href.charAt(0) === "#" || /^[a-z]+:/i.test(href)) return;

    e.preventDefault();
    document.body.classList.add("is-leaving");
    setTimeout(function () { window.location.href = href; }, 260);
  });

  // restore opacity when the page is served from the back/forward cache
  window.addEventListener("pageshow", function () {
    document.body.classList.remove("is-leaving");
  });
})();
