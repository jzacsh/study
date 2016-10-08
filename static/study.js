'use strict';

let studySets = {};

let setSelectMode = function (shouldSet) {
  let mode = shouldSet ? 'selection' : 'studying';
  document.body.setAttribute('data-study-mode', mode);
};

window.onload = function () {
  document
      .querySelectorAll('#cards button.to-selection')[0]
      .addEventListener('click', setSelectMode.bind(null /*this*/, true /*shouldSet*/));
};

let launchStudyOf = function(studySet) {
  setSelectMode(false /*shouldSet*/);

  console.log(
      'TODO: figure out flashcard UI for "%s" set',
      studySet.id, studySet);
}

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

  let tblEl = document.querySelector('#sets table.selection');
  urls['cards.index'].forEach(cardSet => {
    let set = {id: cardSet, url: 'cards/' + cardSet};
    ['title', 'description', 'index'].forEach(key => {
      set[key] = urls[set.url + '/' + key];
    });

    let trEl = document.createElement('tr');
    trEl.setAttribute('data-set-slug', set.id);

    let tdTitle = document.createElement('td');
    let launchStudyButton = document.createElement('button');
    launchStudyButton.textContent = set.title;
    launchStudyButton.addEventListener(
        'click',
        launchStudyOf.bind(null /*this*/, set));
    tdTitle.appendChild(launchStudyButton);
    trEl.appendChild(tdTitle);

    let tdSize = document.createElement('td');
    tdSize.textContent = set.index.length;
    trEl.appendChild(tdSize);

    let tdDescription = document.createElement('td');
    tdDescription.textContent = set.description;
    trEl.appendChild(tdDescription);

    tblEl.appendChild(set.entryTrEl = trEl);
    studySets[set.url] = set;
  });
};

let uiTick = function(stamp /*DOMHighResTimeStamp*/) {
  refreshUi();
  window.requestAnimationFrame(uiTick);
};
uiTick(performance.now());
