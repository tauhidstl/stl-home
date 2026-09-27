/* Adobe-style scroll-linked transitions: element tagging + no-support fallback.
   CSS in the page owns the animation values; this file only (a) tags elements
   with the .p-* utility classes and (b) replays the same values with rAF when
   animation-timeline: view() is unavailable. */
(function () {
  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SUPPORTS = (function () {
    try { return CSS.supports("animation-timeline", "view()"); } catch (e) { return false; }
  })();

  function tag(el, cls) { cls.split(" ").forEach(function (c) { el.classList.add(c); }); }

  function tagAll(root) {
    var sections = root.querySelectorAll("section, footer");
    Array.prototype.forEach.call(sections, function (sec) {
      if (sec.id === "top" || sec.classList.contains("chat-panel")) return;

      // section intros: eyebrow + headline sibling copy
      Array.prototype.forEach.call(sec.querySelectorAll(":scope > .eyebrow, :scope > * > .eyebrow"), function (e) {
        if (!e.dataset.pTagged) { e.dataset.pTagged = "1"; tag(e, "p-anim p-fade p-move-up"); }
      });
      Array.prototype.forEach.call(sec.querySelectorAll("h2"), function (h) {
        if (!h.dataset.pTagged) { h.dataset.pTagged = "1"; tag(h, "p-lh"); }
      });

      // media: anything big enough to read as a photo
      Array.prototype.forEach.call(sec.querySelectorAll("img, video"), function (img) {
        if (img.dataset.pTagged) return;
        var w = img.clientWidth, h = img.clientHeight;
        if (w < 200 || h < 140) return;
        var p = img.parentElement;
        if (p && getComputedStyle(p).overflow === "visible") p.style.overflow = "hidden";
        img.dataset.pTagged = "1";
        tag(img, "p-anim p-scale-down");
      });

      // card rows / carousels
      Array.prototype.forEach.call(sec.querySelectorAll("[data-carousel], [data-arc], [data-rail], [data-ss-c-grid]"), function (c) {
        if (!c.dataset.pTagged) { c.dataset.pTagged = "1"; tag(c, "p-anim p-move-up"); }
      });
    });
  }

  /* ---------- fallback engine ---------- */
  var items = [];
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var EASE = function (t) { // cubic-bezier(.42,0,0,1) approximation
    return 1 - Math.pow(1 - t, 2.6);
  };

  function num(v, fb) { var n = parseFloat(v); return isNaN(n) ? fb : n; }
  function vh(v) { return v * window.innerHeight / 100; }

  function collect(root) {
    items = [];
    Array.prototype.forEach.call(root.querySelectorAll(".p-anim"), function (el) {
      var cs = getComputedStyle(el);
      items.push({
        el: el, kind: "enter",
        y: num(cs.getPropertyValue("--p-y"), 0),
        s: num(cs.getPropertyValue("--p-scale"), 1),
        b: num(cs.getPropertyValue("--p-blur"), 0),
        o: num(cs.getPropertyValue("--p-opacity"), 1)
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll(".p-lh"), function (el) {
      items.push({ el: el, kind: "lh", lh: getComputedStyle(el).lineHeight });
    });
    var W = window.innerWidth, gdFrom = W >= 1920 ? -20 : W >= 1280 ? -22 : -18, gdCover = 0.82;
    var gdSeen = [];
    Array.prototype.forEach.call(root.querySelectorAll('[data-garage-door],[data-tone="light"] + [data-tone="dark"]'), function (el) {
      if (gdSeen.indexOf(el) !== -1) return; gdSeen.push(el);
      items.push({ el: el, kind: "gd", from: gdFrom, cover: gdCover });
      Array.prototype.forEach.call(el.querySelectorAll(":scope > .glow"), function (g) {
        items.push({ el: g, kind: "gdbg", from: window.innerWidth >= 1280 ? 30 : 20 });
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-pin]"), function (el) {
      var next = el.nextElementSibling;
      if (!next || next.getAttribute("data-tone") !== "light") return;
      items.push({ el: el, kind: "pin", sheet: next });
    });
    if (window.innerWidth > 768) {
      var CI = [1.5, 3.25, 5.5, 7.75], step = window.innerWidth >= 1280 ? 48 : 32;
      Array.prototype.forEach.call(root.querySelectorAll("[data-domain-grid],.acards,#clients-wall,[data-partner-grid],[data-em-grid],[data-stagger]"), function (grid) {
        var kids = grid.children, multi = kids.length > 4, rows = grid.getAttribute("data-stagger") === "rows";
        for (var k = 0; k < kids.length; k++) {
          if (kids[k].getAttribute("aria-hidden") === "true") continue;
          items.push({ el: kids[k], kind: "stagger", grid: grid, multi: multi, from: (rows ? Math.min(k + 1, 6) : CI[k % 4] + Math.floor(k / 4)) * step });
        }
      });
    }
  }

  function frame(scrollY) {
    var vhpx = window.innerHeight;
    for (var i = 0; i < items.length; i++) {
      var it = items[i], el = it.el, r = el.getBoundingClientRect();
      if (it.kind === "hero") {
        var up = window.innerWidth >= 1280 && window.innerWidth <= 1440 && window.innerHeight < 900 ? -50 : -35;
        var t = EASE(clamp(scrollY / (vhpx * 0.8), 0, 1));
        el.style.transform = "translateY(" + (up * t) + "vh)";
        if (it.after) it.after.style.opacity = String(0.75 * clamp(scrollY / (vhpx * 0.8), 0, 1));
        continue;
      }
      // entry progress: 0 when top edge at the (inset) bottom of viewport, 1 when fully in
      var top = vhpx * 0.9, bottom = vhpx * 0.4;
      var p = clamp((top - r.top) / Math.max(1, (top - bottom) * 0.5 + r.height * 0.35), 0, 1);
      var e = EASE(p);
      if (it.kind === "enter") {
        el.style.opacity = String(it.o + (1 - it.o) * e);
        el.style.transform = "translate3d(0," + (it.y * (1 - e)) + "px,0) scale(" + (it.s + (1 - it.s) * e) + ")";
        if (it.b) el.style.filter = "blur(" + (it.b * (1 - e)) + "px)";
      } else if (it.kind === "lh") {
        el.style.lineHeight = "";
      } else if (it.kind === "gd") {
        // entry 0% -> cover N%: top at vh -> top at vh - N% of (vh + height); bidirectional by construction
        var gp = clamp((vhpx - r.top) / Math.max(1, vhpx * it.cover), 0, 1);
        el.style.transform = "translateY(" + (it.from * (1 - EASE(gp))) + "vh)";
      } else if (it.kind === "pin") {
        // cover 0 -> cover 80vh of the following light sheet: sheet top from vh down to 0.2vh
        var sr = it.sheet.getBoundingClientRect();
        var pp = clamp((vhpx - sr.top) / (vhpx * 0.8), 0, 1), pe = EASE(pp);
        el.style.translate = "0 " + (-35 * pp) + "vh"; // linear: drift never outruns the covering sheet
        el.style.setProperty("--pin-dim", String(0.75 * pe));
        var sp2 = EASE(clamp((vhpx - sr.top) / Math.max(1, sr.height * 0.4), 0, 1));
        it.sheet.style.translate = "0 " + (30 * (1 - sp2)) + "px";
      } else if (it.kind === "stagger") {
        var gr = it.grid.getBoundingClientRect();
        var st = it.multi ? vhpx : vhpx * 0.9, en = it.multi ? Math.max(1, gr.height + vhpx * 0.1) : Math.max(1, Math.min(gr.height, vhpx * 0.5));
        var sp = EASE(clamp((st - gr.top) / en, 0, 1));
        el.style.transform = "translate3d(0," + (it.from * (1 - sp)) + "px,0)";
      } else if (it.kind === "gdbg") {
        // cover -10% -> cover 70%: parent top from vh+10% to (vh - 70% of (vh+height))
        var pr = el.parentElement.getBoundingClientRect(), span = vhpx + pr.height;
        var c = clamp((vhpx * 1.1 - pr.top) / (span * 0.8), 0, 1);
        var z = clamp((vhpx - pr.top) / (span * 0.7), 0, 1);
        el.style.translate = "0 " + (it.from * (1 - EASE(c))) + "vh";
        el.style.scale = String(1 + 0.1 * z);
      }
    }
  }

  /* bottom-pin dark sections taller than the viewport so all of their content is readable before they get covered */
  function pinTops(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-pin]"), function (el) {
      var over = el.offsetHeight - window.innerHeight;
      el.style.setProperty("--stick-top", (over > 0 ? -over : 0) + "px");
    });
  }
  function scrollParent(el) {
    var n = el.parentElement;
    while (n && n !== document.documentElement) {
      var o = getComputedStyle(n).overflowY;
      if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) return n;
      n = n.parentElement;
    }
    return window;
  }

  function start(root) {
    tagAll(root);
    pinTops(root);
    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(function () { pinTops(root); });
      Array.prototype.forEach.call(root.querySelectorAll("[data-pin]"), function (el) { ro.observe(el); });
    }
    window.addEventListener("resize", function () { pinTops(root); });
    if (REDUCED) return;
    if (SUPPORTS) return;
    collect(root);
    var y = window.scrollY, raf = null;
    var tick = function () { raf = null; frame(y); };
    var sched = function (v) { y = v; if (!raf) raf = requestAnimationFrame(tick); };
    if (window.lenis && window.lenis.on) window.lenis.on("scroll", function (e) { sched(e.scroll != null ? e.scroll : window.scrollY); });
    var sp = scrollParent(root);
    sp.addEventListener("scroll", function () { sched(sp === window ? window.scrollY : sp.scrollTop); }, { passive: true });
    if (sp !== window) window.addEventListener("scroll", function () { sched(window.scrollY); }, { passive: true });
    window.addEventListener("resize", function () { collect(root); sched(window.scrollY); });
    frame(y);
  }

  function boot() {
    var root = document.querySelector("x-dc") || document.body;
    if (!root.querySelector("#top")) return setTimeout(boot, 250);
    setTimeout(function () { start(root); }, 120);
  }
  if (document.readyState === "complete" || document.readyState === "interactive") setTimeout(boot, 200);
  else window.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 200); });
})();
