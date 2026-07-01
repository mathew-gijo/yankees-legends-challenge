// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE CONFIG  (optional — leave blank to run in local/testing mode)
//
// To enable real "everyone on their own phone" multiplayer:
//   1. Create a free Firebase project at https://console.firebase.google.com
//   2. Add a Web App, enable Firestore (test mode is fine to start) and
//      Anonymous Authentication (Build → Authentication → Sign-in method).
//   3. Copy the config object here.
//
// While this stays empty, the app runs in LOCAL mode: fully playable, and you can
// open multiple browser tabs on one machine to simulate multiple players.
// ─────────────────────────────────────────────────────────────────────────────

export const firebaseConfig = {
  // apiKey: "…",
  // authDomain: "yankees-legends.firebaseapp.com",
  // projectId: "yankees-legends",
  // storageBucket: "yankees-legends.appspot.com",
  // messagingSenderId: "…",
  // appId: "…",
};

export const hasFirebase = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);
