// Which copy of the site is running. The stage branch is published under /stage/ and is
// also what you get on localhost, so tests never touch the real (prod) database.
export const ENV = /\/stage(\/|$)/.test(location.pathname) || ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'stage' : 'prod';

// Firebase web app config for each environment (Firebase console → Project settings → Your apps).
// These values identify the project; they are not secrets. Access is enforced by firestore.rules.
// All society data (name, flats, amounts, expenses…) lives in Firestore, never in this code.
const firebaseConfigs = {
  prod: null,
  stage: null,
};

export const firebaseConfig = firebaseConfigs[ENV];
