'use strict';

let studySets = {};

let setSelectMode = function (shouldSet) {
  let mode = shouldSet ? 'selection' : 'studying';
  document.body.setAttribute('data-study-mode', mode);
};

let PREF_DEFAULTS = {
  'flip_card': '1'
}

let studySectEl;
window.onload = function () {
  studySectEl = document.querySelector('section#cards');

  studySectEl
      .querySelector('nav button.to-selection')
      .addEventListener('click', setSelectMode.bind(null /*this*/, true /*shouldSet*/));

  studySectEl
      .querySelector('nav button.pref-flip')
      .addEventListener('click', handleTogglePref);

  studySectEl
      .querySelector('button.reveal')
      .addEventListener('click', handleRevealBack);

  studySectEl
      .querySelector('button.next')
      .addEventListener('click', handleNextCardFront);

  let pref = localStorage.getItem('prefs.FLIP_CARD');
  if (!(pref && pref.length)) {
    localStorage.setItem('prefs.FLIP_CARD',  PREF_DEFAULTS.flip_card);
  }
};

let STUDY_STATE = {
  front: 'front', // ONLY show the front of the card
  back: 'back', // ONLY show the back of the card
  both: 'both', // show BOTH sides of the card simultaneously
};

let handleLaunchStudyOf = function(studySet) {
  setSelectMode(false /*shouldSet*/);

  studySectEl.querySelector('h1').textContent = studySet.title;
  studySectEl.setAttribute('data-study-state', STUDY_STATE.front);

  console.log(
      'TODO: figure out flashcard UI for "%s" set',
      studySet.id, studySet);
  let frontCardUrl = ''; /* TODO */
  let backCardUrl = ''; /* TODO */

  studySectEl.querySelector('figure.front img').setAttribute('src', frontCardUrl);
  studySectEl.querySelector('figure.back img').setAttribute('src', backCardUrl);
}

let handleNextCardFront = function(event) {
  // TODO: similar logic to above initial loading of set
  console.log('noext-card logic not done!');
};

let handleTogglePref = function(event) {
  let setTo = localStorage.getItem('prefs.FLIP_CARD');
  if (!(setTo && setTo.length)) {
    setTo = PREF_DEFAULTS.flip_card;
  }

  localStorage.setItem(
      'prefs.FLIP_CARD',
      Number(!parseInt(setTo, 10)));
}

let handleRevealBack = function(event) {
  let shouldFlip = Boolean(parseInt(localStorage.getItem('prefs.FLIP_CARD'), 10));
  studySectEl.setAttribute(
      'data-study-state',
      shouldFlip ? STUDY_STATE.back : STUDY_STATE.both);
};

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

  let tblEl = document.querySelector('#sets table.selection tbody');
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
        handleLaunchStudyOf.bind(null /*this*/, set));
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
