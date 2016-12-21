'use strict';

let PREFS = {
  flip_card: {Key: 'prefs.FLIP_CARD', Default: true},
  shuffle: {Key: 'prefs.SHUFFLE', Default: false},
};

let UI_MODE = {
  SELECTION: 'selection',
  // Dashbaord; default UI showing all sets

  STUDYING: 'studying',
  // Given a set, study its cards

  LISTING: 'listing', /* TODO(issue#3) - update any CSS looking for the aboves */
  // Given a set, list its cards
};

/** @param {UI_MODE} uiMode */
let setSelectMode = function (uiMode) { document.body.setAttribute('data-study-mode', uiMode); };

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
//                  studyCtl: !StudySetCtl,
//                  listCtl: !ListSetCtl,
//                }
//               >
//       }
let studySets = {};
let currentSet; // one of {@link studySets}'s values

/**
 * Manages study-progress; ie: progress & front/back toggling of cards in a given set.
 */
class StudySetCtl {
  /**
   * @param {!Array} cards
   *     A single {@link studySets} value's "index" field.
   * @param {!Element} progressEl
   *     <progress> element representing state of this set
   */
  constructor (cards, progressEl) {
    this.cards = cards;
    this.contentType_ = null;
    this.progressEl = progressEl;
    this.restart();
  }

  get ready() {
    return Promise.all([
      this.getContentType(),
    ]).then(_ => { return this; });
  }

  restart() {
    this.available = [];
    for (let i = 0; i < this.cards.length; ++i) {
      this.available.push(i);
    }

    if (getPreference(PREFS.shuffle.Key)) {
      this.activeIdx = StudySetCtl.getRandomIntMoz_(0, this.cards.length - 1);
    } else {
      this.activeIdx = 0;
    }

    this.getContentType();
    this.render();
  }

  getContentType() {
    if (this.contentType_) {
      return Promise.resolve(this.contentType_);
    }

    // TODO share code with worker.js and share "offline-v1" string
    return caches
        .open('offline-v1')
        .then(c => c.match(this.cards[0].front))
        .then(match => {
          let header = match.headers.get('content-type');
          // TODO: someway to message a problem
          this.contentType_ = StudySetCtl.conentTypeToKnownType_(header) || header;
          return Promise.resolve(this.contentType_);
        });
  }

  static conentTypeToKnownType_(rawContentType) {
    let matches = rawContentType.match(/^\b(\w*)\/\w*\b/);
    return matches && matches.length ? matches[1] : null;
  };

  render() {
    this.progressEl.setAttribute(
        'max', this.cards.length);
    this.progressEl.setAttribute(
        'value', this.cards.length - this.available.length);

    let frontCardUrl = this.cards[this.activeIdx].front;
    let backCardUrl = this.cards[this.activeIdx].back;

    if (this.contentType_ == 'image') {
      studySectEl
          .querySelector('figure.front img.card')
          .setAttribute('src', frontCardUrl);
      studySectEl
          .querySelector('figure.back img.card')
          .setAttribute('src', backCardUrl);
    } else if (this.contentType_ == 'text') {
      fetch(frontCardUrl).then(r => r.text()).then(txt => {
        studySectEl
            .querySelector('figure.front p.card')
            .textContent = txt.trim();
      });
      fetch(backCardUrl).then(r => r.text()).then(txt => {
        studySectEl
            .querySelector('figure.back p.card')
            .textContent = txt.trim();
      });
    }

    if (this.isMidSet_() && getPreference(PREFS.shuffle.Key)) {
      PREFS.shuffle.Buttons.forEach(e => e.setAttribute('data-warning', ''));
    } else {
      PREFS.shuffle.Buttons.forEach(e => e.removeAttribute('data-warning'));
    }
  }

  isAtStart_() { return this.available.length === this.cards.length; }

  isMidSet_() { return this.available.length !== 1; }

  shuffleToggled() {
    let wasShuffleOn = !getPreference(PREFS.shuffle.Key); // we run *post* toggle
    if (this.isAtStart_() || (this.isMidSet_() && wasShuffleOn)) {
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
          StudySetCtl.getRandomIntMoz_(0, this.available.length - 1)];
    } else {
      ++this.activeIdx;
    }

    this.render();
  }
  /**
   * Taken from mozilla wiki, nicely explained here:
   * http://stackoverflow.com/a/1527820
   *
   * @param {number} min Lower-limit of return, inclusive
   * @param {number} max Upper-limit of return, inclusive
   * @return {number}
   */
  static getRandomIntMoz_(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

class ListSetCtl {
  /**
   * @param {!Array} cards
   *     A single {@link studySets} value's "index" field.
   */
  constructor (cards) {
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

  let finishInstallEls = Array.from(document.querySelectorAll('.finish-install'));
  document.body.setAttribute(
      'data-install-state',
      navigator.serviceWorker.controller ? 'full' : 'partial');
  finishInstallEls.forEach(el => el.addEventListener('click', e => location.reload()));

  navigator.serviceWorker.addEventListener('message', serviceWorkerMessagHandler);

  let refreshButtonEl = document.querySelector('#refresh');
  refreshButtonEl.setAttribute('disabled', '');
  navigator.serviceWorker
      .register('worker.js')
      .then(registrations => navigator.serviceWorker.ready.then(_ => registrations))
      .then(registrations => {
        refreshButtonEl.removeAttribute('disabled');
        refreshButtonEl.addEventListener('click', function(unregister, e) {
          if (!navigator.onLine &&
              !window.confirm("Are you sure? NO network to reload with, you'll break the app for now!")) {
            return;
          }

          e.target.textContent = 'refreshing...';
          e.target.setAttribute('disabled', '');

          // TODO: consider adding better cache busting logic in worker.js, and
          // triggering it with something from here, like:
          //   if (navigator.serviceWorker.controller) {
          //     navigator.serviceWorker.controller.postMessage('REFRESH');
          //   }
          return unregister()
              .then(_ => caches.keys())
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

    PREFS[cssSuffix].Buttons = Array.from(document.querySelectorAll(
        'button.pref-' + cssSuffix));
    PREFS[cssSuffix].Buttons.forEach(e => e.addEventListener(
        'click',
        handleTogglePref.bind(null /*this*/, pref.Key)));
    updatePrefTo(pref.Key, prefVal);
  });

  studySectEl
      .querySelector('nav button.to-selection')
      .addEventListener('click', setSelectMode.bind(null /*this*/, UI_MODE.SELECTION));

  Array.from(studySectEl.querySelectorAll('button.reveal')).concat([
    studySectEl.querySelector('section#cards figure.front .card'),
    studySectEl.querySelector('section#cards figure.back .card'),
  ]).forEach(el => el.addEventListener('click', handleFlipCard));

  Array
      .from(studySectEl.querySelectorAll('button.next'))
      .forEach(el => el.addEventListener('click', handleNextCardFront));

  let uiShowIsOnline = function(targetEls) {
    targetEls.forEach(
        e => e.setAttribute('data-network', navigator.onLine ? 'on' : 'off'));
  }.bind(null /*this*/, [document.body]);
  uiShowIsOnline(); // run at least once
  window.addEventListener('online', uiShowIsOnline);
  window.addEventListener('offline', uiShowIsOnline);
};

/**
 * @param {string} prefKey
 * @param {boolean} setTo
 */
let updatePrefTo = function(prefKey, setTo) {
  localStorage.setItem(prefKey, Number(setTo).toString());

  PREFS[REVERSE_PREFS[prefKey]].Buttons.forEach(e => {
    e.querySelector('[data-status]').textContent = setTo ? 'on' : 'off';
  });
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
 * @param {!Event} event
 */
let handleLaunchStudyOf = function(studySet, event) {
  setSelectMode(UI_MODE.STUDYING);

  currentSet = studySet;
  currentSet.studyCtl = currentSet.studyCtl || new StudySetCtl(
      currentSet.index,
      studySectEl.querySelector('progress'));
  currentSet.studyCtl.ready.then(_ => {
    studySectEl.querySelector('h1').textContent = currentSet.title;

    currentSet.studyCtl.getContentType()
        .then(type => studySectEl.setAttribute('data-content-type', type));
    studySectEl.setAttribute('data-study-state', STUDY_STATE.front);
    currentSet.studyCtl.render();
  });
};

/**
 * @param {!Object} studySet
 *     Single value described by {@link studySets}.
 * @param {!Event} event
 */
let handleListingOf = function(studySet, event) {
  setSelectMode(UI_MODE.LISTING);
  currentSet = studySet;
  currentSet.listCtl = currentSet.listCtl || new ListSetCtl(studySet);
  console.log('not doing anything yet', currentSet.listCtl);
};

let handleNextCardFront = function(event) {
  currentSet.studyCtl.nextCard();
  studySectEl.setAttribute('data-study-state', STUDY_STATE.front);
};

let handleTogglePref = function(prefKey, event) {
  updatePrefTo(prefKey, !getPreference(prefKey));

  if (prefKey == PREFS.shuffle.Key) {
    currentSet.studyCtl.shuffleToggled();
  }
};

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
    let listingLink = document.createElement('a');
    listingLink.textContent = set.index.length.toString();
    listingLink.addEventListener(
        'click',
        handleListingOf.bind(null /*this*/, set));
    tdSize.appendChild(listingLink);
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
