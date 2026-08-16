(function () {
  document.documentElement.classList.add('js');
  // Scroll reveal — quiet opacity only, settled before any capture.
  var sections = document.querySelectorAll('.section');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('inline');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );
    sections.forEach(function (s) {
      io.observe(s);
    });
  } else {
    sections.forEach(function (s) {
      s.classList.add('inline');
    });
  }
  // The specimen's signature interaction: the brand word draws weight as it
  // rises toward the top of the viewport — a live reading axis on the variable
  // face. Disabled under prefers-reduced-motion; no-op when the face is static.
  var hero = document.querySelector('.hero');
  var word = document.querySelector('.specimen__word');
  if (hero && word) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce && 'getComputedStyle' in window) {
      var ticking = false;
      var draw = function () {
        ticking = false;
        var vh = window.innerHeight;
        var p = Math.min(1, Math.max(0, window.scrollY / (vh * 0.55)));
        var weight = Math.round(450 + 350 * p);
        word.style.fontWeight = String(weight);
      };
      var onScroll = function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(draw);
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      draw();
    }
  }
})();
