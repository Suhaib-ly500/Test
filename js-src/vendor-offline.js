(function () {
  if (window.__mxOfflineReady) return;
  window.__mxOfflineReady = true;

  var DB_NAME = 'mx-vendor-db';
  var DB_VER = 1;
  var dbReady = new Promise(function (resolve, reject) {
    try {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains('cache')) d.createObjectStore('cache');
        if (!d.objectStoreNames.contains('queue')) d.createObjectStore('queue', { keyPath: 'ts' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    } catch (e) { reject(e); }
  });

  function idbGet(store, key) {
    return dbReady.then(function (d) {
      return new Promise(function (res, rej) {
        var r = d.transaction(store).objectStore(store).get(key);
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
    });
  }
  function idbSet(store, key, val) {
    return dbReady.then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, 'readwrite');
        t.objectStore(store).put(val, key);
        t.oncomplete = function () { res(); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function idbDel(store, key) {
    return dbReady.then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, 'readwrite');
        t.objectStore(store).delete(key);
        t.oncomplete = function () { res(); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function idbAll(store) {
    return dbReady.then(function (d) {
      return new Promise(function (res, rej) {
        var r = d.transaction(store).objectStore(store).getAll();
        r.onsuccess = function () { res(r.result || []); };
        r.onerror = function () { rej(r.error); };
      });
    });
  }
  function idbCount(store) {
    return dbReady.then(function (d) {
      return new Promise(function (res, rej) {
        var r = d.transaction(store).objectStore(store).count();
        r.onsuccess = function () { res(r.result || 0); };
        r.onerror = function () { rej(r.error); };
      });
    });
  }

  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (!origFetch) return;

  var pending = 0;

  function toast(msg, type) {
    try {
      var area = document.getElementById('toast-area');
      if (!area) {
        area = document.createElement('div');
        area.id = 'toast-area';
        area.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none';
        document.body.appendChild(area);
      }
      var t = document.createElement('div');
      var styles = {
        info: 'bg-slate-800/95 text-white',
        success: 'bg-emerald-600/95 text-white',
        warn: 'bg-amber-500/95 text-white'
      };
      t.className = 'toast-item ' + (styles[type] || styles.info);
      t.textContent = msg;
      area.appendChild(t);
      setTimeout(function () {
        t.classList.add('toast-out');
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 350);
      }, 3000);
    } catch (e) {}
  }
  window.mxToast = toast;

  function setPendingUI() {
    var el = document.getElementById('netstatus-badge');
    if (!el) return;
    var txt = el.querySelector('.ns-txt');
    if (txt && pending > 0) txt.textContent = 'مزامنة ' + pending + '...';
    else if (txt) txt.textContent = navigator.onLine ? 'متصل' : 'غير متصل';
    var dot = el.querySelector('.ns-dot');
    if (dot) {
      if (pending > 0) dot.className = 'ns-dot w-1.5 h-1.5 rounded-full bg-amber-400 spin';
      else if (navigator.onLine) dot.className = 'ns-dot w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-glow';
      else dot.className = 'ns-dot w-1.5 h-1.5 rounded-full bg-red-500';
    }
  }

  function setNetStatus() {
    var el = document.getElementById('netstatus-badge');
    if (!el) return;
    el.className = 'status-badge ' + (navigator.onLine ? 'active' : 'offline') + ' hidden sm:flex';
    setPendingUI();
  }

  function flushQueue() {
    return idbAll('queue').then(function (ops) {
      if (!ops || !ops.length) return 0;
      var seq = Promise.resolve();
      var sent = 0;
      ops.forEach(function (op) {
        seq = seq.then(function () {
          return origFetch(op.url, { method: op.method, headers: op.headers ? new Headers(op.headers) : undefined, body: op.body })
            .then(function (r) {
              if (r.ok) {
                return idbDel('queue', op.ts).then(function () { sent++; });
              }
              var e = new Error('http-' + r.status);
              e.httpStatus = r.status;
              return Promise.reject(e);
            })
            .catch(function (e) {
              if (e && e.httpStatus) { return idbDel('queue', op.ts); }
              return null;
            });
        });
      });
      return seq.then(function () {
        return idbCount('queue').then(function (left) {
          pending = left;
          setPendingUI();
          if (sent > 0) {
            toast('تمت المزامنة: ' + sent + ' عملية', 'success');
            if (typeof window.loadAllData === 'function') { try { window.loadAllData(); } catch (e2) {} }
          }
          return sent;
        });
      });
    }).catch(function () { return 0; });
  }

  if (window.fetch) {
    window.fetch = function (input, init) {
      var inputStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      var method = ((init && init.method) || (input && typeof input !== 'string' && input.method) || 'GET').toUpperCase();
      var abs;
      try { abs = new URL(inputStr, location.href).href; } catch (e) { return origFetch(input, init); }
      var path;
      try { path = new URL(abs).pathname; } catch (e) { return origFetch(input, init); }
      if (path.indexOf('/api/') !== 0) return origFetch(input, init);

      if (method === 'GET') {
        return origFetch(input, init)
          .then(function (r) {
            if (r && r.ok) {
              var copy = r.clone();
              copy.text().then(function (t) {
                return idbSet('cache', abs, { body: t, ts: Date.now() }).catch(function () {});
              });
            }
            return r;
          })
          .catch(function (err) {
            return idbGet('cache', abs).then(function (c) {
              if (c && c.body) return new Response(c.body, { status: 200, headers: { 'Content-Type': 'application/json' } });
              throw err;
            });
          });
      }

      if (/\/login\b|\/logout\b|\/register\b|\/verify-token\b/.test(abs)) return origFetch(input, init);

      return origFetch(input, init)
        .then(function (r) {
          if (!r.ok) {
            var e = new Error('http-' + r.status);
            e.httpStatus = r.status;
            throw e;
          }
          return r;
        })
        .catch(function (err) {
          var offlineCause = (err instanceof TypeError) || navigator.onLine === false;
          if (!offlineCause) throw err;
          var b = init && (init.body !== undefined ? init.body : null);
          var canStore = b == null || typeof b === 'string' || (typeof Blob !== 'undefined' && b instanceof Blob && b.size < 256 * 1024);
          if (!canStore) throw err;
          var headersArr = undefined;
          if (init && init.headers) {
            headersArr = (typeof Headers !== 'undefined' && init.headers instanceof Headers) ? Array.from(init.headers.entries()) : init.headers;
          }
          var entry = { ts: Date.now(), method: method, url: abs, headers: headersArr, body: typeof b === 'string' ? b : b };
          return idbSet('queue', entry.ts, entry).then(function () {
            pending += 1;
            setPendingUI();
            toast('تم الحفظ على جهازك — سيُرسل تلقائياً عند الاتصال', 'info');
            return new Response(JSON.stringify({ success: true, message: 'تم الحفظ محلياً وسيتم المزامنة تلقائياً', queued: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          });
        });
    };
  }

  window.addEventListener('online', function () { setNetStatus(); flushQueue(); });
  window.addEventListener('offline', function () { setNetStatus(); });

  if (navigator.onLine === false) {
    setTimeout(function () { setNetStatus(); toast('أنت غير متصل بالإنترنت — سيتم الحفظ محلياً', 'warn'); }, 1200);
  }

  setInterval(function () {
    if (navigator.onLine) {
      idbCount('queue').then(function (n) { if (n > 0 && pending !== n) { pending = n; setPendingUI(); } });
      if (pending > 0) flushQueue();
    }
  }, 25000);

  document.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== document) {
      if (t.id === 'netstatus-badge') { flushQueue(); return; }
      t = t.parentNode;
    }
  });

  window.mxOffline = { flushQueue: flushQueue, pendingCount: function () { return idbCount('queue'); } };
})();