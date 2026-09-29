// Shared site polish: scroll progress, sticky-header state, reveal-on-scroll,
// TOC scrollspy, back-to-top and touch-friendly nav dropdown.
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  // ---- Reveal on scroll ----
  var targets = document.querySelectorAll('.hero-text, .hero-image, .card, .game-card, main section, .content section, .toc, .Flag_Text_box, .Flag_paragraph_box, .flag_hero_side_container, h1, .global-leaderboard');
  if ('IntersectionObserver' in window && !reduce && targets.length) {
    root.classList.add('js-reveal');
    var seen = new Map(); // parent -> count, for staggering siblings
    targets.forEach(function (el) {
      if (el.closest('header')) return;
      el.classList.add('reveal');
      if (el.classList.contains('hero-image')) el.classList.add('reveal-right');
      if (el.classList.contains('toc')) el.classList.add('reveal-left');
      var n = seen.get(el.parentNode) || 0;
      seen.set(el.parentNode, n + 1);
      if (el.classList.contains('card') || el.classList.contains('game-card')) {
        el.style.setProperty('--reveal-delay', Math.min(n, 6) * 0.1 + 's');
      }
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  }

  // ---- Progress bar, header state, back-to-top ----
  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  var toTop = document.createElement('button');
  toTop.className = 'to-top';
  toTop.type = 'button';
  toTop.setAttribute('aria-label', 'Back to top');
  toTop.textContent = '↑';
  toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
  document.body.appendChild(toTop);

  var header = document.querySelector('header');
  var ticking = false;
  function onScroll() {
    var y = window.scrollY || root.scrollTop;
    var max = root.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
    if (header) header.classList.toggle('scrolled', y > 40);
    toTop.classList.toggle('show', y > 500);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  // ---- TOC scrollspy ----
  var links = document.querySelectorAll('.toc a[href^="#"]');
  if (links.length && 'IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && byId[e.target.id]) {
          links.forEach(function (a) { a.classList.remove('active'); });
          byId[e.target.id].classList.add('active');
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    Object.keys(byId).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) spy.observe(sec);
    });
  }

  // ---- Dropdown: tap to open on touch devices (hover/focus handled in CSS) ----
  document.querySelectorAll('.navdropdown').forEach(function (dd) {
    var trigger = dd.querySelector('.navbutton');
    if (!trigger) return;
    trigger.addEventListener('click', function (ev) {
      if (window.matchMedia('(hover: none)').matches && !dd.classList.contains('open')) {
        ev.preventDefault();
        dd.classList.add('open');
      }
    });
    document.addEventListener('click', function (ev) {
      if (!dd.contains(ev.target)) dd.classList.remove('open');
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { dd.classList.remove('open'); if (dd.contains(document.activeElement)) document.activeElement.blur(); }
    });
  });
})();
