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
  var live = document.getElementById('liveWeight');
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
        var w = Math.round(450 + 350 * wp);
        word.style.fontWeight = String(w);
        if (live) live.textContent = String(w);
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
// The Download actions resolve the real installer at runtime: read the
// latest release from GitHub, detect the visitor's OS and architecture, and
// point every Download link at the right binary. A quiet mono link beside
// the action reveals the other platform's installer. Without JS the links
// fall back to the release page, where every binary is listed.
(function () {
  var RELEASE_URL = 'https://github.com/drewsephski/sivlo/releases/latest';
  var API_URL = 'https://api.github.com/repos/drewsephski/sivlo/releases/latest';
  var primaries = document.querySelectorAll('[data-download="primary"]');
  var alts = document.querySelectorAll('[data-download="alt"]');
  var facts = document.querySelectorAll('[data-download-facts]');

  var formatMb = function (bytes) {
    return Math.max(1, Math.round(bytes / 1048576)) + ' MB';
  };

  // OS detection. This is best-effort; Windows and macOS are reliable from
  // the UA string. Anything else (Linux, unknown) leaves the primary link on
  // the release page rather than guessing wrong.
  var detectOs = function () {
    var ua = navigator.userAgent || '';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Macintosh|Mac OS X|MacIntel/i.test(ua)) return 'macos';
    return null;
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
    if (arm === null || arm === undefined) return null;
    var want = arm
      ? /aarch64|arm64|apple[-_ ]?silicon/i
      : /x86_64|x64|intel/i;
    var match = dmgs.filter(function (a) {
      return want.test(a.name);
    });
    return match.length ? match[0] : null;
  };

  // Windows installers: prefer the NSIS setup .exe, fall back to the MSI.
  var pickWindows = function (assets) {
    var exes = assets.filter(function (a) {
      return /\.exe$/i.test(a.name);
    });
    var setup = exes.filter(function (a) {
      return /setup/i.test(a.name);
    });
    return (
      (setup.length ? setup : exes)[0] ||
      assets.filter(function (a) {
        return /\.msi$/i.test(a.name);
      })[0] ||
      null
    );
  };

  var setHref = function (els, url) {
    els.forEach(function (a) {
      a.href = url || RELEASE_URL;
    });
  };

  // Push platform-correct release facts into the mono coordinate lines and
  // the download links. Version is read live so the page stays truthful
  // without a rebuild.
  var apply = function (release, os, arm) {
    var version = '0.1.0';
    var m = (release.name || release.tag_name || '').match(/\d+\.\d+\.\d+/);
    if (m) version = m[0];

    var primaryAsset, altAsset, primaryLabel, altLabel, sizeText;
    if (os === 'windows') {
      primaryAsset = pickWindows(release.assets);
      altAsset = pickDmg(release.assets, arm);
      primaryLabel = 'Download for Windows';
      altLabel = 'Also for macOS';
      sizeText = primaryAsset ? formatMb(primaryAsset.size) : null;
    } else if (os === 'macos') {
      primaryAsset = pickDmg(release.assets, arm);
      altAsset = pickWindows(release.assets);
      primaryLabel = 'Download for macOS';
      altLabel = 'Also for Windows';
      sizeText = primaryAsset ? formatMb(primaryAsset.size) : null;
    } else {
      primaryLabel = 'Download';
      altLabel = null;
    }

    var primaryUrl = primaryAsset
      ? primaryAsset.browser_download_url
      : release.html_url || RELEASE_URL;

    primaries.forEach(function (a) {
      a.href = primaryUrl;
      // The topbar button keeps its short "Download" label; only the big
      // CTAs carry the platform name.
      if (primaryLabel && a.classList.contains('cta__primary')) {
        a.textContent = primaryLabel;
      }
    });
    alts.forEach(function (a) {
      if (altAsset && altLabel) {
        a.href = altAsset.browser_download_url;
        a.textContent = altLabel;
        a.hidden = false;
      } else {
        a.hidden = true;
      }
    });

    var meta = document.querySelector('.topbar__meta');
    if (meta) {
      var platform = os === 'windows' ? 'Windows 10+' : 'macOS 13+';
      meta.textContent =
        'v' + version + ' public beta · ' + platform;
    }

    var factLine = null;
    if (os === 'windows') {
      factLine =
        'v' +
        version +
        ' public beta · Windows 10+ · signed installer · direct download';
    } else if (os === 'macos') {
      factLine =
        'v' +
        version +
        ' public beta · Apple Silicon · notarized DMG · macOS 13+';
    } else {
      factLine =
        'v' + version + ' public beta · macOS 13+ & Windows 10+';
    }
    if (sizeText) factLine += ' · ' + sizeText;
    facts.forEach(function (n) {
      n.textContent = factLine;
    });
  };

  fetch(API_URL, { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(async function (release) {
      if (!release || !release.assets || !release.assets.length) return;
      var os = detectOs();
      var arm = await detArm();
      apply(release, os, arm);
    })
    .catch(function () {});
})();

// Pipeline figure (fig. 00) interactivity -------------------------------
// Hover / tap a stage to inspect it: the node is named, its lane in the
// readout is lit, everything else dims, and a tooltip explains the step.
(function () {
  var svg = document.getElementById('sivlo-pipeline');
  if (!svg || !svg.getBoundingClientRect) return;
  var wrap = document.getElementById('fig-local');
  var scroll = wrap.querySelector('.fig-scroll');
  var tooltip = wrap.querySelector('.fig-tooltip');
  var ttTitle = tooltip.querySelector('.tt-title');
  var ttSub = tooltip.querySelector('.tt-sub');
  var nodes = Array.prototype.slice.call(svg.querySelectorAll('.node'));
  var words = Array.prototype.slice.call(svg.querySelectorAll('.flow-word'));
  var activeEl = null;

  // The travelling flow light is SMIL, which CSS cannot pause. Cut it
  // under prefers-reduced-motion so the figure settles to its static form.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    Array.prototype.slice
      .call(svg.querySelectorAll('animateMotion'))
      .forEach(function (m) {
        m.remove();
      });
  }

  function positionTip(el) {
    var scrollRect = scroll.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    tooltip.style.transform = 'none';
    var tw = tooltip.offsetWidth;
    var th = tooltip.offsetHeight;
    var x = r.left - scrollRect.left + r.width / 2 - tw / 2;
    x = Math.max(12, Math.min(x, scrollRect.width - tw - 12));
    var y;
    if (r.top - scrollRect.top - th - 14 < 0) {
      y = r.bottom - scrollRect.top + 14;
    } else {
      y = r.top - scrollRect.top - th - 14;
    }
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  function showTip(el) {
    activeEl = el;
    ttTitle.textContent = el.getAttribute('data-title');
    ttSub.innerHTML = el.getAttribute('data-sub');
    tooltip.classList.add('show');
    tooltip.setAttribute('aria-hidden', 'false');
    positionTip(el);
  }

  function hideTip() {
    activeEl = null;
    tooltip.classList.remove('show');
    tooltip.setAttribute('aria-hidden', 'true');
  }

  function setDim(el) {
    svg.classList.add('has-hover');
    nodes.forEach(function (n) {
      n.classList.toggle('is-hovered', n === el);
    });
    words.forEach(function (w) {
      w.classList.toggle(
        'is-active',
        w.getAttribute('data-flow') === el.getAttribute('data-flow')
      );
    });
  }

  function clearDim() {
    svg.classList.remove('has-hover');
    nodes.forEach(function (n) {
      n.classList.remove('is-hovered');
    });
    words.forEach(function (w) {
      w.classList.remove('is-active');
    });
  }

  nodes.forEach(function (n) {
    n.addEventListener('pointerenter', function () {
      showTip(n);
      setDim(n);
    });
    n.addEventListener('pointerleave', function () {
      hideTip();
      clearDim();
    });
    n.addEventListener('focus', function () {
      showTip(n);
      setDim(n);
    });
    n.addEventListener('blur', function () {
      hideTip();
      clearDim();
    });
    n.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        hideTip();
        clearDim();
        n.blur();
      }
    });
  });

  svg.addEventListener('pointerleave', function () {
    hideTip();
    clearDim();
  });
  scroll.addEventListener('scroll', function () {
    if (activeEl) positionTip(activeEl);
  });
  window.addEventListener('resize', function () {
    if (activeEl) positionTip(activeEl);
  });
})();