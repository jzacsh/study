'use strict';

let studySets = {};

console.warn('study logic running... (TODO) NOT YET WRITTEN');

let storageGetBlob = function(key) {
  let val = localStorage.getItem(key);
  return Boolean(val && val.length) ? JSON.parse(val) : null;
};

let lastUrlsLen = -1;
let refreshUi = function() {
  let urls = storageGetBlob('URLS');
  if (!urls) {
    return;
  }
  if (urls['cards.index'].length == lastUrlsLen) {
    return;
  }
  lastUrlsLen = urls['cards.index'].length;

  document.querySelectorAll('[data-qty-sets]').forEach(el => {
    el.textContent = lastUrlsLen;
  });

  let ulEl = document.querySelector('ul#sets');
  urls['cards.index'].forEach(cardSet => {
    let set = {id: cardSet, url: 'cards/' + cardSet};
    ['title', 'description', 'index'].forEach(key => {
      set[key] = urls[set.url + '/' + key];
    });

    let li = document.createElement('li');
    li.setAttribute('data-set-slug', set.id);
    li.textContent = '"' + set.title + '" (' + set.index.length + ' cards)';
    ulEl.appendChild(set.entryLiEl = li);

    studySets[set.url] = set;
  });
};

let uiTick = function(stamp /*DOMHighResTimeStamp*/) {
  refreshUi();
  window.requestAnimationFrame(uiTick);
};
uiTick(performance.now());
