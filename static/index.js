'use strict';

let setSelectMode = function (shouldSet) {
  let mode = shouldSet ? 'selection' : 'studying';
  document.body.setAttribute('data-study-mode', mode);
};

let PREFS = {
  flip_card: {Key: 'prefs.FLIP_CARD', Default: true},
};

// TODO write runtime assertion that these map back correctly
let REVERSE_PREFS = {
  'prefs.FLIP_CARD': 'flip_card',
};

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
   * @param {!Element} <progress> element representing state of this set
   */
  constructor (setIndex, progressEl) {
    this.setIndex = setIndex;
    this.progressEl = progressEl;
    this.restart();
  }

  restart() {
    this.activeIdx = 0;
    this.updateProgressUi();
  }

  updateProgressUi() {
    this.progressEl.setAttribute('max', this.setIndex.length);
    this.progressEl.setAttribute('value', this.activeIdx + 1);
  }

  nextCard() {
    if (this.activeIdx >= 0 && this.activeIdx < (this.setIndex.length - 1)) {
      ++this.activeIdx;
    } else {
      this.restart();
    }
    this.progressEl.setAttribute('value', this.activeIdx + 1);
  }

  renderCurrentCard() {
    let frontCardUrl = this.setIndex[this.activeIdx].front;
    let backCardUrl = this.setIndex[this.activeIdx].back;

    studySectEl
        .querySelector('figure.front img')
        .setAttribute('src', frontCardUrl);
    studySectEl
        .querySelector('figure.back img')
        .setAttribute('src', backCardUrl);
  }
}

let serviceWorkerMessagHandler = function(event) {
  let parseFromSwBlob = function(eventData) {
    if (!(eventData && eventData.length && eventData[0] == '{')) {
      return false;
    }

    let mesg = JSON.parse(eventData);
    return Boolean(mesg && mesg.cmd && mesg.cmd.length) ? mesg : false;
  };

  let msg = parseFromSwBlob(event.data);
  if (!msg) {
    console.warn(
        'got message from service worker with no preparation for. event.data:\n%s\n\n',
        event.data);
    return;
  }
  switch (msg.cmd) {
    case 'INSTALL_URL':
      let urls;
      let urlBlob = localStorage.getItem('URLS');
      if (!urlBlob || !urlBlob.length || !(urls = JSON.parse(urlBlob))) {
        urls = {};
      }
      urls[msg.payload.url] = msg.payload.resp;
      localStorage.setItem('URLS', JSON.stringify(urls));
      break;
    case 'PRIMER_STATUS':
      localStorage.setItem('STATUS', msg.payload);
    default:
      console.error('Unknown service worker command, "%s"', msg.cmd);
      break;
  }
};

window.onload = function () {
  if (!('serviceWorker' in navigator)) {
    let fatal = 'WTF is this browser? no service worker API found';
    alert(fatal);
    throw new Error(fatal); // stop this file's execution
  }

  navigator.serviceWorker.addEventListener('message', serviceWorkerMessagHandler);

  navigator.serviceWorker.register('worker.js');

  navigator.serviceWorker.ready.then(function(reg) {
    document.querySelector('#refresh').addEventListener('click', function(sw, e) {
      sw.getRegistrations()
        .then(function(registrations) {
          for (let registration of registrations) {
            registration.unregister(); // from http://stackoverflow.com/a/33705250
          }
        })
        .then(function() {
          location.reload(true /*forceReload*/);
        });
    }.bind(null /*this*/, navigator.serviceWorker));
  });

  uiTick(performance.now());

  studySectEl = document.querySelector('section#cards');

  let prefFlip = getBoolBitFromStorage(PREFS.flip_card.Key);
  if (prefFlip === undefined) {
    prefFlip = PREFS.flip_card.Default;
  }

  studySectEl
      .querySelector('nav button.to-selection')
      .addEventListener('click', setSelectMode.bind(null /*this*/, true /*shouldSet*/));

  let prefFlipButtonEl = studySectEl.querySelector('nav button.pref-flip');
  prefFlipButtonEl.addEventListener(
      'click',
      handleTogglePref.bind(null /*this*/, PREFS.flip_card.Key));

  updatePrefTo(PREFS.flip_card.Key, prefFlip, prefFlipButtonEl);

  Array.from(studySectEl.querySelectorAll('button.reveal')).concat([
    studySectEl.querySelector('section#cards figure.front img'),
    studySectEl.querySelector('section#cards figure.back img'),
  ]).forEach(el => el.addEventListener('click', handleFlipCard));

  Array
      .from(studySectEl.querySelectorAll('button.next'))
      .forEach(el => el.addEventListener('click', handleNextCardFront));
};

/**
 * @param {string} prefKey
 * @param {boolean} setTo
 * @param {!Element} statusParentEl
 */
let updatePrefTo = function(prefKey, setTo, statusParentEl) {
  localStorage.setItem(prefKey, Number(setTo).toString());

  statusParentEl
      .querySelector('[data-status]')
      .textContent = setTo ? 'on' : 'off';
};

let STUDY_STATE = {
  front: 'front', // ONLY show the front of the card
  back: 'back', // ONLY show the back of the card
  both: 'both', // show BOTH sides of the card simultaneously
};

let getBoolBitFromStorage = function(localStorageKey) {
  let rawVal = localStorage.getItem(localStorageKey);
  return rawVal ? Boolean(parseInt(rawVal, 10)) : undefined;
};


/**
 * @param {string} prefKey
 * @return {boolean} Stored preference, or its corresponding default
 */
let getPreference = function(prefKey) {
  let storedVal = getBoolBitFromStorage(prefKey);
  return storedVal === undefined ?
      REVERSE_PREFS[PREFS[prefKey]].Default :
      storedVal;
};

/**
 * @param {!Object} studySet
 *     Single value described by {@link studySets}.
 */
let handleLaunchStudyOf = function(studySet) {
  setSelectMode(false /*shouldSet*/);

  currentSet = studySet;

  currentSet.ctl = currentSet.ctl ||
      new StudySetCtl(currentSet.index, studySectEl.querySelector('progress'));

  currentSet.ctl.updateProgressUi();

  studySectEl.querySelector('h1').textContent = currentSet.title;

  studySectEl.setAttribute('data-study-state', STUDY_STATE.front);
  currentSet.ctl.renderCurrentCard();
}

let handleNextCardFront = function(event) {
  currentSet.ctl.nextCard();
  currentSet.ctl.renderCurrentCard();
  studySectEl.setAttribute('data-study-state', STUDY_STATE.front);
};

let handleTogglePref = function(prefKey, event) {
  updatePrefTo(prefKey, !getPreference(prefKey), event.target);
}

let handleFlipCard = function(event) {
  let isFront = studySectEl.getAttribute('data-study-state') == STUDY_STATE.front;
  if (isFront) {
    let shouldFlip = getPreference(PREFS.flip_card.Key);
    studySectEl.setAttribute(
        'data-study-state',
        shouldFlip ? STUDY_STATE.back : STUDY_STATE.both);
  } else {
    studySectEl.setAttribute(
        'data-study-state',
        STUDY_STATE.front);
  }
};

let storageGetBlob = function(key) {
  let val = localStorage.getItem(key);
  return Boolean(val && val.length) ? JSON.parse(val) : null;
};

let lastUrlsLen = -1;
let refreshDashboardUi = function() {
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
  refreshDashboardUi();
  window.requestAnimationFrame(uiTick);
};
