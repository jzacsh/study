'use strict';

let parseFromSwBlob = function(eventData) {
  if (!(eventData && eventData.length && eventData[0] == '{')) {
    return false;
  }

  let mesg = JSON.parse(eventData);
  return Boolean(mesg && mesg.cmd && mesg.cmd.length) ? mesg : false;
}

let serviceWorkerMessagHandler = function(event) {
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

let storageGetBlob = function(key) {
  let val = localStorage.getItem(key);
  return Boolean(val && val.length) ? JSON.parse(val) : null;
};

let lastCardSetCount = -1;
let refreshUi = function() {
  let urls = storageGetBlob('URLS');
  if (!urls) {
    return;
  }
  if (urls['cards.index'].length == lastCardSetCount) {
    return;
  }

  lastCardSetCount = urls['cards.index'].length;
  document.querySelector('#status').textContent =
      lastCardSetCount + ' Flashcard sets loaded. '
      + 'Status: ' + (localStorage.getItem('STATUS') || 'Loading');
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
          location.href = location.toString();
        });
    }.bind(null /*this*/, navigator.serviceWorker));
  });

  let uiTick = function(stamp /*DOMHighResTimeStamp*/) {
    refreshUi();
    window.requestAnimationFrame(uiTick);
  };
  uiTick(performance.now());
};
