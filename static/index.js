'use strict';

if (! ('serviceWorker' in navigator)) {
  let fatal = 'WTF is this browser? no service worker API found';
  alert(fatal);
  throw new Error(fatal); // stop this file's execution
}

let parseFromSwBlob = function(eventData) {
  if (!(eventData && eventData.length && eventData[0] == '{')) {
    return false;
  }

  let mesg = JSON.parse(eventData);
  return Boolean(mesg && mesg.cmd && mesg.cmd.length) ? mesg : false;
}

navigator.serviceWorker.addEventListener('message', event => {
  let msg = parseFromSwBlob(event.data);
  if (!msg) {
    console.warn(
        'got message from service worker with no preparation for. event.data:\n%s\n\n',
        event.data);
    return;
  }
  switch (msg.cmd) {
    case 'INSTALL_URL':
      localStorage.setItem(
          msg.payload.url,
          JSON.stringify(msg.payload.resp));
      break;
    default:
      console.error('Unknown service worker command, "%s"', msg.cmd);
      break;
  }
});

navigator.serviceWorker.register('worker.js');

// TODO bootstrap application. What? Angular app? What's the easiest thing I can
// run?
