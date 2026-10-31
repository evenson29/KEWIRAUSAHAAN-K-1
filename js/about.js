/* SticTech - Halaman Tentang (tentang.html) */
// Dependensi: js/config.js, js/app.js

(function () {
  'use strict';

  const animateCounter = (el) => {
    if (el.dataset.counted) return;
    const target = parseInt(el.dataset.target || '0', 10) || 0;
    const duration = 2000;
    const start = performance.now();
    const run = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(target * eased) + '+';
      el.dataset.counted = 'true';
      if (progress < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('revealed');
          const counter = entry.target.querySelector('.counter-value');
          if (counter) animateCounter(counter);
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );
    $$('.reveal').forEach((el) => observer.observe(el));
  });
})();
