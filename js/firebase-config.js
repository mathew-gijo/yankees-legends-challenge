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
  apiKey: "AIzaSyB-EYpR5ZOE541JtsiRMVNyn_yWdA42U-o",
  authDomain: "yankeechallenge.firebaseapp.com",
  projectId: "yankeechallenge",
  storageBucket: "yankeechallenge.firebasestorage.app",
  messagingSenderId: "633191965321",
  appId: "1:633191965321:web:95a27acfc8dec6fdd1dc58",
  measurementId: "G-FES62JD1RH",
};

export const hasFirebase = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);
