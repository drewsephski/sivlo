(function () {
  document.documentElement.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  // Where the visitor is in the ledger. This is state, not motion, so it
  // stays live for keyboard and reduced-motion users.
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll('.topbar__nav a')
  );
  var activeBySection = {};
  navLinks.forEach(function (link) {
    var hash = link.getAttribute('href');
    if (hash && hash.charAt(0) === '#') activeBySection[hash.slice(1)] = link;
  });

  // The specimen's signature interaction: the brand word draws weight as it
  // rises toward the top of the viewport — a live reading axis on the variable
  // face. The topbar hairline tracks the same axis: the page, measured, in
  // one ruling. Both are motion and are disabled under prefers-reduced-motion;
  // the hairline is a no-op when the face is static.
  var word = document.querySelector('.specimen__word');
  var progress = document.querySelector('.topbar__progress');
  var motion = !reduce && 'getComputedStyle' in window;

  var ticking = false;
  var draw = function () {
    ticking = false;
    var probe = window.scrollY + window.innerHeight * 0.28;
    var current = null;
    sections.forEach(function (s) {
      if (s.offsetTop <= probe) current = s.id || null;
    });
    navLinks.forEach(function (link) {
      if (link.classList.contains('is-active')) {
        link.classList.remove('is-active');
      }
      if (link.hasAttribute('aria-current')) {
        link.removeAttribute('aria-current');
      }
    });
    if (current && activeBySection[current]) {
      activeBySection[current].classList.add('is-active');
      activeBySection[current].setAttribute('aria-current', 'true');
    }

    if (motion) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (word) {
        var wp = Math.min(
          1,
          Math.max(0, window.scrollY / (window.innerHeight * 0.55))
        );
        word.style.fontWeight = String(Math.round(450 + 350 * wp));
      }
      if (progress) {
        progress.style.transform = 'scaleX(' + p + ')';
      }
    }
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
})();

// Download wiring --------------------------------------------------------
// The Download actions resolve the real DMG at runtime: read the latest
// release from GitHub, pick the binary for the visitor's architecture, and
// point every Download link at it. Without JS the links fall back to the
// release page, where both binaries are listed.
(function () {
  var RELEASE_URL = 'https://github.com/drewsephski/sivlo/releases/latest';
  var API_URL = 'https://api.github.com/repos/drewsephski/sivlo/releases/latest';
  var actions = document.querySelectorAll(
    'a.topbar__action, a.cta__primary[href*="/releases/"]'
  );

  var formatMb = function (bytes) {
    return Math.max(1, Math.round(bytes / 1048576)) + ' MB';
  };

  // Best-effort architecture detection. High-entropy values are only exposed
  // in Chromium; Safari/Firefox yield null and we fall back to the release
  // page rather than guess wrong.
  var detArm = function () {
    return new Promise(function (resolve) {
      if (
        'userAgentData' in navigator &&
        navigator.userAgentData &&
        typeof navigator.userAgentData.getHighEntropyValues === 'function'
      ) {
        navigator.userAgentData
          .getHighEntropyValues(['architecture'])
          .then(function (v) {
            resolve(v.architecture === 'arm');
          })
          .catch(function () {
            resolve(null);
          });
      } else {
        resolve(null);
      }
    });
  };

  var pickDmg = function (assets, arm) {
    var dmgs = assets.filter(function (a) {
      return /\.dmg$/i.test(a.name);
    });
    if (dmgs.length === 1) return dmgs[0];
    if (arm === null || arm === undefined) return dmgs[0];
    var want = arm ? /aarch64|arm64/ : /x86_64/i;
    var match = dmgs.filter(function (a) {
      return want.test(a.name);
    });
    return match.length ? match[0] : dmgs[0];
  };

  // Push release facts into the mono coordinate lines so the page stays
  // truthful without a rebuild. Only rewrites lines pinned to the old beta.
  var setFacts = function (version, sizeText) {
    var meta = document.querySelector('.topbar__meta');
    if (meta && /^v\d+\./.test(meta.textContent.trim())) {
      meta.textContent = 'v' + version + ' public beta · macOS 13+';
    }
    document.querySelectorAll('.cta__note').forEach(function (note) {
      var t = note.textContent.trim();
      if (!/^v\d+\./.test(t)) return;
      var base = 'v' + version + ' public beta · Apple Silicon & Intel · notarized DMG · ';
      note.textContent = sizeText ? base + 'direct download · ' + sizeText : base + 'direct download';
    });
  };

  fetch(API_URL, { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(async function (release) {
      if (!release || !release.assets || !release.assets.length) return;
      var arm = await detArm();
      var chosen = pickDmg(release.assets, arm);
      var url = (chosen && chosen.browser_download_url) || release.html_url || RELEASE_URL;

      actions.forEach(function (a) {
        a.href = url;
      });

      var version = '0.4.0';
      var m = (release.name || release.tag_name || '').match(/\d+\.\d+\.\d+/);
      if (m) version = m[0];
      setFacts(version, chosen ? formatMb(chosen.size) : null);
    })
    .catch(function () {});
})();