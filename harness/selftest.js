// Headless self-test harness. Not part of the shipped widget.
// Active only with ?selfTest=1: stubs fetch so nothing leaves the page, then runs
// the page's window.SELFTEST_CASES on load and prints a PASS/FAIL summary into
// #selftest-result, where `chrome --dump-dom` (harness/run-selftest.sh) reads it.
// Must load before the widget bundle so the widget sees the stubbed fetch.
(function () {
  if (!new URLSearchParams(location.search).has('selfTest')) return;

  var fetches = [];
  var heldSubmit = null;
  function json(status, body) {
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input.url;
    fetches.push({ url: url, init: init || {} });
    if (url.indexOf('/auth/token') !== -1) {
      return json(200, { success: true, data: { access_token: 'selftest' } });
    }
    if (url.indexOf('/customerInterest') !== -1) {
      // ST.holdSubmits() parks the request until ST.releaseSubmit(), to exercise
      // a submit that is still in flight while the shopper moves on.
      if (window.ST && window.ST._hold) {
        return new Promise(function (resolve) {
          heldSubmit = function () { resolve(json(200, {})); };
        });
      }
      return json(200, {});
    }
    return json(404, {});
  };

  function $(sel) {
    return typeof sel === 'string' ? document.querySelector(sel) : sel;
  }

  window.eq = function (actual, expected, label) {
    var a = JSON.stringify(actual);
    var b = JSON.stringify(expected);
    if (a !== b) throw new Error(label + ': expected ' + b + ', got ' + a);
  };

  window.ST = {
    click: function (sel) {
      $(sel).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    },
    title: function () {
      return $('#popup-title').textContent;
    },
    sizeValue: function () {
      return $('#twc-nm-size').value;
    },
    sizeOptions: function () {
      return Array.prototype.slice
        .call(document.querySelectorAll('#twc-nm-size option'))
        .filter(function (o) { return o.value; })
        .map(function (o) { return o.value; });
    },
    formHidden: function () {
      return $('#popup-form').hidden;
    },
    notice: function () {
      var n = $('#popup-notice');
      return n && !n.hidden ? n.textContent : '';
    },
    // Replace the query string, keeping selfTest so a reload still self-tests.
    setQuery: function (q) {
      history.replaceState(null, '', location.pathname + '?selfTest=1' + (q ? '&' + q : ''));
    },
    lastFetch: function (part) {
      for (var i = fetches.length - 1; i >= 0; i--) {
        if (fetches[i].url.indexOf(part) !== -1) return fetches[i];
      }
      return null;
    },
    isOpen: function () {
      return $('#twc-nm-overlay').classList.contains('is-open');
    },
    status: function () {
      var n = $('#popup-status');
      return n && !n.hidden ? n.textContent : '';
    },
    pressEscape: function () {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    },
    fetchCount: function (part) {
      return fetches.filter(function (f) { return f.url.indexOf(part) !== -1; }).length;
    },
    holdSubmits: function () {
      this._hold = true;
    },
    releaseSubmit: function () {
      this._hold = false;
      var release = heldSubmit;
      heldSubmit = null;
      if (release) release();
    },
    sleep: function (ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms); });
    },
    waitFor: function (pred, ms) {
      var start = Date.now();
      return new Promise(function (resolve, reject) {
        (function poll() {
          var v = pred();
          if (v) return resolve(v);
          if (Date.now() - start > ms) return reject(new Error('timed out'));
          setTimeout(poll, 20);
        })();
      });
    },
  };

  window.addEventListener('load', async function () {
    var cases = window.SELFTEST_CASES || [];
    var out = [];
    var failed = 0;
    for (var i = 0; i < cases.length; i++) {
      try {
        await cases[i].run();
        out.push('ok   ' + cases[i].name);
      } catch (e) {
        failed++;
        out.push('FAIL ' + cases[i].name + ' — ' + (e && e.message));
      }
    }
    out.push(
      failed
        ? 'SELFTEST FAIL ' + failed + '/' + cases.length
        : 'SELFTEST PASS ' + cases.length + '/' + cases.length,
    );
    var el = document.getElementById('selftest-result');
    if (el) el.textContent = out.join('\n');
  });
})();
