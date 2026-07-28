// ── Firebase cloud-sync configuration ──
//
// This is the SAME project every homeschool app uses, on purpose: a child
// signs in once and their progress in Wonder Lab, the reading app, and
// anything built later all follow the one account.
//
// This config is safe to publish — it identifies the project, it is not a
// secret. Security comes from the Firestore rules, which are in SYNC.md.

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDoEce6LGJwE8HqqMxL9Oz-Xy8u_wvS43c",
  authDomain: "homeschool-apps.firebaseapp.com",
  projectId: "homeschool-apps",
  storageBucket: "homeschool-apps.firebasestorage.app",
  messagingSenderId: "125075518550",
  appId: "1:125075518550:web:2159ebad5fef3d142537f7"
};

// How a child's name + four pictures become a Firebase login.
//
// These MUST be byte-identical in every homeschool app, or the shared account
// silently stops being shared — the same child, typing the same name and
// tapping the same four pictures, gets a DIFFERENT Firebase user in each app,
// with no error anywhere to show for it. That was the state before this file:
// the reading app derived '@unicorn-academy.family' + '-URA1' while Wonder Lab
// derived '@wonder-lab.family' + '-WL1'.
//
// Change these only in lockstep, across every app, and never after real
// accounts exist — a changed salt locks every child out of their own data.
const HOMESCHOOL_AUTH = {
  emailDomain: 'homeschool.family',
  passwordSalt: '-homeschool-v1',

  // name -> the email Firebase Auth actually sees
  email(name) {
    const slug = String(name || '').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'explorer';
    return slug + '@' + this.emailDomain;
  },

  // four emoji -> a password long enough for Firebase's rules, from something
  // a six-year-old can remember
  password(emojis) {
    return (Array.isArray(emojis) ? emojis.join('') : String(emojis || ''))
      + this.passwordSalt;
  },
};
