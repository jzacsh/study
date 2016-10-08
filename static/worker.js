'use strict';

// See original base source for this file (and it's apache2 license) in
// https://googlechrome.github.io/samples/service-worker/custom-offline-page/

// TODO explain this
const CACHE_VERSION = 1;
let CURRENT_CACHES = {
  offline: 'offline-v' + CACHE_VERSION
};

let POST_CMDS = {
  install: 'INSTALL_URL',
  primer: 'PRIMER_STATUS', // TODO emit different stages in `install` handler
};
const FLASHCARD_INDEXES = 'cards.index';
const OFFLINE_URL = 'study.html'
let OFFLINE_URL_DEPS = [
  'study.js',
  FLASHCARD_INDEXES
];

const CARDSET_URL_PREFIX = 'cards';

function objectVals(obj) {
  return Object.keys(obj).map(function(key) {
    return obj[key];
  });
}

function createCacheBustedRequest(url) {
  let request = new Request(url, {cache: 'reload'});
  // See https://fetch.spec.whatwg.org/#concept-request-mode
  if ('cache' in request) {
    return request;
  }

  // if {cache: 'reload'} didn't have any effect, append a cache-busting URL
  // parameter instead
  let bustedUrl = new URL(url, self.location.href);
  bustedUrl.search += (bustedUrl.search ? '&' : '') + 'cachebust=' + Date.now();
  return new Request(bustedUrl);
}

function refreshDepsCache(cache) {
  return Promise.all(OFFLINE_URL_DEPS.map(depUrl => {
    return fetch(depUrl).then(function(depResp) {
      return cache.put(depUrl, depResp.clone());
    });
  }));
}

let installKeyVal = function(cmd, payload) {
  return self.clients.matchAll({includeUncontrolled: true}).then(allClients => {
    return Promise.all(allClients.map(client => {
      client.postMessage(JSON.stringify({cmd: cmd, payload: payload}));
    }));
  });
};

let parseCardIndex = function(lines) {
  lines.sort((a, b) => {
    const ignoreSideRegexp = /\b(front|back)\b/;
    let aSideless = a.replace(ignoreSideRegexp, '');
    let bSideless = b.replace(ignoreSideRegexp, '');
    if (aSideless  == bSideless) {
      return 0;
    }
    return aSideless < bSideless ? -1 : 1;
  });

  return lines.reduce(function(accum, curVal, curIdx, lns) {
    if (!(curIdx % 2)) {
      return accum; // we're on the front of a card
    }

    let a = lns[curIdx - 1];
    let b = curVal;

    let pair = {};
    if (a.match(/\bfront\b/)) {
      pair.front = a;
      pair.back = b;
    } else {
      pair.front = b;
      pair.back = a;
    }

    accum.push(pair);
    return accum;
  }, [/*initialValue*/]);
};

function refreshFlashcards(fileCache) {
  let parseIndexTxt = function(rawIndexTxt) {
    return rawIndexTxt.split("\n").filter(e => {
      return Boolean(
          e &&
          e.length &&
          e.match(/[^\s]/)) // nonempty lines
    });
  };
  return fileCache.match(FLASHCARD_INDEXES).then(function(resp) {
    return resp.clone().text()
        .then(parseIndexTxt)
        .then(cardSets => {
          return installKeyVal(POST_CMDS.install, {url: FLASHCARD_INDEXES, resp: cardSets})
              .then(_ => { return cardSets;});
        })
        .then(cardSets => {
          return Promise.all(cardSets
              .map(cardSet => {
                return CARDSET_URL_PREFIX + '/' + cardSet;
              })
              .map(cardSetUrl => {
                let cardIndex;
                let metadataFetch = function(metadata) {
                  let metadataUrl = cardSetUrl + '/' + metadata;
                  return fetch(metadataUrl).then(resp => {
                    return resp.text().then(body => {
                      let content;
                      if (metadata == 'index') {
                        content = cardIndex = parseCardIndex(parseIndexTxt(body));
                      } else {
                        content = body.trim();
                      }
                      return installKeyVal(POST_CMDS.install, {url: metadataUrl, resp: content});
                    });
                  });
                };
                return Promise
                  .all([
                    metadataFetch('index'),
                    metadataFetch('title'),
                    metadataFetch('description'),
                  ]).
                  then(_ => {
                    return Promise.all(cardIndex.map(card => {
                      let cardUrl = cardSetUrl + '/' + card;
                      return fetch(cardUrl).then(imgResp => {
                        return fileCache.put(cardUrl, imgResp.clone());
                      });
                    }));
                  });
              }));
        });
  });
}

self.addEventListener('install', event => {
  // We can't use cache.add() here, since we want OFFLINE_URL to be the cache
  // key, but the actual URL we end up requesting might include a cache-busting
  // parameter.
  event.waitUntil(
      fetch(createCacheBustedRequest(OFFLINE_URL))
          .then(function(freshResponse) {
            return caches
                .open(CURRENT_CACHES.offline)
                .then(openCache => {
                  return openCache
                      .put(OFFLINE_URL, freshResponse)
                      .then(_ => refreshDepsCache(openCache))
                      .then(_ => refreshFlashcards(openCache));
                });
          }));
});

// Delete all caches that aren't named in CURRENT_CACHES. While there is only
// one cache in this example, the same logic will handle the case where there
// exists multiple versioned caches
self.addEventListener('activate', event => {
  let expectedCacheNames = objectVals(CURRENT_CACHES);

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (expectedCacheNames.indexOf(cacheName) === -1) {
            console.log('Deleting out of data cache: "%s"', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // TODO fetch "accept...image" requests, and respondWith() corresponding
  // webp's we already have in cache.

  // We only want to call event.respondWith() if this is a navigation request
  // for an HTML page.
  // request.mode of 'navigate' is unfortunately not supported in Chrome
  // versions older than 49, so we need to include a less precise fallback,
  // which checks for a GET request with an Accept: text/html header.
  if (event.request.mode === 'navigate' || (
        event.request.method === 'GET' &&
        event.request.headers.get('accept').includes('text/html'))) {
    console.log('Handling navigation-looking fetch event for URL: "%s"', event.request.url);
    event.respondWith(fetch(event.request).catch(error => {
      // The catch is only triggered if fetch() throws an exception which will
      // most likely happen due to the server being unreachable. If fetch()
      // returns a valid HTTP response with a response code in 4xx or 5xx range,
      // the catch() will NOT be called. If you need custom handling for said
      // ranges, see
      // https://github.com/GoogleChrome/samples/tree/gh-pages/service-worker/fallback-response
      console.log('Fetch failed; returning offline page instead.', error);
      return caches.match(OFFLINE_URL);
    }));
  }

  // If the above if() is false, then this fetch handler won't intercept the
  // request. If there are any other fetch handlers registered, they will get a
  // chance to call event.respondWith(). If no fetch handlers call
  // event.respondWith(), the request will be handled by the browser as if there
  // were no service worker involvement.
});
