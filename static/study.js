'use strict';

let setSelectMode = function (shouldSet) {
  let mode = shouldSet ? 'selection' : 'studying';
  document.body.setAttribute('data-study-mode', mode);
};

let PREF_DEFAULTS = {
  'flip_card': '1'
}

// important global state needed by handlers
let studySectEl;
// @type {!Object<string,
//                {
//                  id: string,
//                  url: string,
//                  title: string,
//                  description: string,
//                  index: !Array.<{front: string, back: string}>,
//                  entryTrEl: !Element,
//                  ctl: !StudySetCtl,
//                }
//               >
//       }
let studySets = {};
let currentSet; // one of {@link studySets}'s values

class StudySetCtl {
  /**
   * @param {!Array} a single {@link studySets} value's "index" field.
   */
  constructor (setIndex) {
    this.setIndex = setIndex;
  }

  nextCard() {
    console.warn('TODO next-card logic not done!');
  }

  renderCurrentCard() {
    let frontCardUrl = ''; /* TODO */
    let backCardUrl = ''; /* TODO */

    studySectEl.querySelector('figure.front img').setAttribute('src', frontCardUrl);
    studySectEl.querySelector('figure.back img').setAttribute('src', backCardUrl);
  }
}

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


/**
 * @param {!Object} studySet
 *     Single value described by {@link studySets}.
 */
let handleLaunchStudyOf = function(studySet) {
  setSelectMode(false /*shouldSet*/);

  currentSet = studySet;
  currentSet.ctl = new StudySetCtl(currentSet.index);

  studySectEl.querySelector('h1').textContent = currentSet.title;

  studySectEl.setAttribute('data-study-state', STUDY_STATE.front);
  currentSet.ctl.renderCurrentCard();
}

let handleNextCardFront = function(event) {
  currentSet.ctl.nextCard();
  currentSet.ctl.renderCurrentCard();
  studySectEl.setAttribute('data-study-state', STUDY_STATE.front);
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
