'use strict';

let setSelectMode = function (shouldSet) {
  let mode = shouldSet ? 'selection' : 'studying';
  document.body.setAttribute('data-study-mode', mode);
};

let PREFS = {
  flip_card: {Key: 'prefs.FLIP_CARD', Default: true},
  shuffle: {Key: 'prefs.SHUFFLE', Default: false},
};

// TODO write runtime assertion that these map back correctly
let REVERSE_PREFS = {
  'prefs.FLIP_CARD': 'flip_card',
  'prefs.SHUFFLE': 'shuffle',
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
    this.available = [];
    for (let i = 0; i < this.setIndex.length; ++i) {
      this.available.push(i);
    }

    if (getPreference(PREFS.shuffle.Key)) {
      this.activeIdx = getRandomIntMoz(0, this.setIndex.length - 1);
    } else {
      this.activeIdx = 0;
    }

    this.render();
  }

  render() {
    this.progressEl.setAttribute(
        'max', this.setIndex.length);
    this.progressEl.setAttribute(
        'value', this.setIndex.length - this.available.length);

    let frontCardUrl = this.setIndex[this.activeIdx].front;
    let backCardUrl = this.setIndex[this.activeIdx].back;

    studySectEl
        .querySelector('figure.front img')
        .setAttribute('src', frontCardUrl);
    studySectEl
        .querySelector('figure.back img')
        .setAttribute('src', backCardUrl);

    if (this._isMidSet() && getPreference(PREFS.shuffle.Key)) {
      PREFS.shuffle.ButtonEl.setAttribute('data-warning', '');
    } else {
      PREFS.shuffle.ButtonEl.removeAttribute('data-warning');
    }
  }

  _isAtStart() {
    return this.available.length === this.setIndex.length;
  }

  _isMidSet() {
    return this.available.length !== 1;
  }

  shuffleToggled() {
    let wasShuffleOn = !getPreference(PREFS.shuffle.Key); // we run *post* toggle
    if (this._isAtStart() || (this._isMidSet() && wasShuffleOn)) {
      this.restart();
      return;
    }

    this.render();
  }

  nextCard() {
    if (this.available.length <= 1) {
      this.restart();
      return;
    }

    this.available = this.available.filter((idx, _) => idx != this.activeIdx);

    if (getPreference(PREFS.shuffle.Key)) {
      this.activeIdx = this.available[
          getRandomIntMoz(0, this.available.length - 1)];
    } else {
      ++this.activeIdx;
    }

    this.render();
  }
}

/**
 * Taken from mozilla wiki, nicely explained here:
 * http://stackoverflow.com/a/1527820
 *
 * @param {number} min Lower-limit of return, inclusive
 * @param {number} max Upper-limit of return, inclusive
 * @return {number}
 */
let getRandomIntMoz = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

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
  if (location.pathname == '/') {
    // Force viewing of this app via a URL our service worker is easily
    // comfortable with
    location.pathname = '/index.html';
  }

  if (!('serviceWorker' in navigator)) {
    let fatal = 'WTF is this browser? no service worker API found';
    alert(fatal);
    throw new Error(fatal); // stop this file's execution
  }

  navigator.serviceWorker.addEventListener('message', serviceWorkerMessagHandler);

  let refreshButtonEl = document.querySelector('#refresh');
  refreshButtonEl.setAttribute('disabled', '');
  navigator.serviceWorker
      .register('worker.js')
      .then(registrations => {
        refreshButtonEl.removeAttribute('disabled');
        refreshButtonEl.addEventListener('click', function(unregister, e) {
          e.target.textContent = 'refreshing...';
          e.target.setAttribute('disabled', '');

          // TODO: before unregistering, first postMessage and have REFRESH
          // logic take place ServiceWorker's side; currently failing to get a
          // non null "controller" property on:
          //     navigator.serviceWorker.controller.postMessage('REFRESH');
          return unregister()
              .then(_ => { return caches.keys(); })
              .then(cacheKeys => {
                return Promise.all(cacheKeys.map(key => {
                  return caches.delete(key);
                }));
              })
              .then(_ => localStorage.removeItem('URLS'))
              .then(_ => location.reload(true /*forceReload*/));
        }.bind(null /*this*/, _ => { return registrations.unregister(); }));
      });

  uiTick(performance.now());

  studySectEl = document.querySelector('section#cards');

  Object.keys(PREFS).forEach(cssSuffix => {
    let pref = PREFS[cssSuffix];

    let prefVal = getBoolBitFromStorage(pref.Key);
    if (prefVal === undefined) {
      prefVal = pref.Default;
    }

    PREFS[cssSuffix].ButtonEl = studySectEl.querySelector(
        'nav button.pref-' + cssSuffix);
    PREFS[cssSuffix].ButtonEl.addEventListener(
        'click',
        handleTogglePref.bind(null /*this*/, pref.Key));
    updatePrefTo(pref.Key, prefVal, PREFS[cssSuffix].ButtonEl);
  });

  studySectEl
      .querySelector('nav button.to-selection')
      .addEventListener('click', setSelectMode.bind(null /*this*/, true /*shouldSet*/));

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

  PREFS[REVERSE_PREFS[prefKey]].ButtonEl
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

  studySectEl.querySelector('h1').textContent = currentSet.title;

  studySectEl.setAttribute('data-study-state', STUDY_STATE.front);
  currentSet.ctl.render();
}

let handleNextCardFront = function(event) {
  currentSet.ctl.nextCard();
  studySectEl.setAttribute('data-study-state', STUDY_STATE.front);
};

let handleTogglePref = function(prefKey, event) {
  updatePrefTo(prefKey, !getPreference(prefKey));

  if (prefKey == PREFS.shuffle.Key) {
    currentSet.ctl.shuffleToggled();
  }
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

let lastUrlsEntry = '';
let refreshDashboardUi = function() {
  let urls = localStorage.getItem('URLS');
  if (!(urls && urls.length)) {
    return;
  }
  if (urls == lastUrlsEntry) {
    return;
  }
  lastUrlsEntry = urls;
  urls = JSON.parse(urls);

  if (urls['cards.index'] && urls['cards.index'].length) {
    document.querySelectorAll('[data-qty-sets]').forEach(el => {
      el.textContent = urls['cards.index'].length;
    });
  }

  let tblEl = document.querySelector('#sets table.selection tbody');
  Array.from(tblEl.querySelectorAll('tr')).forEach(el => {
    el.parentNode.removeChild(el);
  });
  urls['cards.index'].forEach(cardSet => {
    let set = {id: cardSet, url: 'cards/' + cardSet};
    for (let key of ['title', 'description', 'index']) {
      set[key] = urls[set.url + '/' + key];
      if (!set[key]) {
        return;
      }
    }

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

    // TODO share code with worker.js and share "offline-v1" string
    caches.open('offline-v1').then(function(s, c) {
      return c.match(s.index[0].front).then(r => {
        s.contentType = r.headers.get('content-type');
      });
    }.bind(null /*this*/, set));
    studySets[set.url] = set;
  });
};

let uiTick = function(stamp /*DOMHighResTimeStamp*/) {
  refreshDashboardUi();
  window.requestAnimationFrame(uiTick);
};
