// Controller: boots the app, owns the live state, and routes each phase to a screen.

import { loadContent, prefetchPhotos, rounds as allRounds } from './content.js';
import { getNet } from './net.js';
import { el, toast } from './ui.js';
import * as G from './game.js';
import * as S from './screens.js';

const app = {
  net: null,
  uid: null,
  code: null,
  state: null,
  unsub: null,
  tick: null,
};

// ── Boot ────────────────────────────────────────────────────────────────────
async function boot() {
  registerSW();
  try {
    await loadContent();
  } catch (err) {
    document.getElementById('app').innerHTML = '<p style="margin:auto;color:#93a2c9">Could not load game content. Check your connection and reload.</p>';
    return;
  }
  app.net = await getNet();
  app.uid = await app.net.ready();
  showModeTag(app.net.mode);
  // If we were mid-game (refresh), rejoin
  const saved = sessionStorage.getItem('ylc_code');
  if (saved && (await app.net.join(saved))) enterGame(saved);
  else home();
}

function home() {
  teardown();
  S.renderHome({
    mode: app.net.mode,
    onCreate: createGame,
    onJoin: joinGame,
  });
}

// ── Create / join ─────────────────────────────────────────────────────────
async function createGame(name) {
  const state = G.initialState(app.uid, name);
  const { code } = await app.net.create(state);
  enterGame(code);
}

async function joinGame(code, name) {
  const exists = await app.net.join(code);
  if (!exists) return toast('No game with that code');
  await app.net.update(code, (s) => G.addPlayer(s, app.uid, name));
  enterGame(code);
}

function enterGame(code) {
  app.code = code;
  sessionStorage.setItem('ylc_code', code);
  teardown();
  app.unsub = app.net.subscribe(code, (state) => {
    app.state = state;
    render();
  });
}

function leave() {
  sessionStorage.removeItem('ylc_code');
  app.code = null;
  app.state = null;
  home();
}

// ── Host / player actions ───────────────────────────────────────────────────
const hostMutate = (fn) => app.net.update(app.code, fn);

const act = {
  start: () => hostMutate(G.startGame),
  reveal: () => hostMutate(G.reveal),
  next: () => hostMutate(G.advance),
  answer: (choice) => hostMutate((s) => G.recordAnswer(s, app.uid, choice)),
  whatIfVote: (i) => hostMutate((s) => G.recordWhatIf(s, app.uid, i)),
  setDraft: (pos, id) => hostMutate((s) => G.recordDraft(s, app.uid, pos, id)),
  teamVote: (uid) => hostMutate((s) => G.recordTeamVote(s, app.uid, uid)),
  playAgain: () => hostMutate(G.backToLobby),
  leave,
};

// ── Render dispatch ─────────────────────────────────────────────────────────
function render() {
  const s = app.state;
  if (!s) return;
  stopTick();
  const ctx = {
    state: s,
    uid: app.uid,
    code: app.code,
    mode: app.net.mode,
    isHost: s.hostId === app.uid,
    act,
    rerender: render,
  };

  switch (s.phase) {
    case G.PHASE.LOBBY: S.renderLobby(ctx); break;
    case G.PHASE.QUESTION: S.renderQuestion(ctx); startTick(ctx); prefetchNext(s); break;
    case G.PHASE.REVEAL: S.renderQuestion(ctx); break;
    case G.PHASE.ROUND_END: S.renderRoundEnd(ctx); break;
    case G.PHASE.WHATIF: S.renderWhatIf(ctx); break;
    case G.PHASE.DRAFT: S.renderDraft(ctx); break;
    case G.PHASE.DRAFT_REVEAL: S.renderDraftReveal(ctx); break;
    case G.PHASE.RESULTS: S.renderResults(ctx); break;
    default: S.renderLobby(ctx);
  }
}

// ── Question timer (host auto-reveals when time is up) ───────────────────────
function startTick(ctx) {
  const s = app.state;
  const round = G.currentRound(s);
  const limit = (round.secondsPerQ || 20) * 1000;
  const bar = document.getElementById('timerbar');
  const txt = document.getElementById('timertext');
  let firedReveal = false;
  const update = () => {
    const left = Math.max(0, s.qStartedAt + limit - Date.now());
    const pct = Math.max(0, Math.min(100, (left / limit) * 100));
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = Math.ceil(left / 1000) + 's';
    if (left <= 0 && ctx.isHost && !firedReveal && app.state.phase === G.PHASE.QUESTION) {
      firedReveal = true;
      act.reveal();
    }
  };
  update();
  app.tick = setInterval(update, 250);
}
function stopTick() { if (app.tick) { clearInterval(app.tick); app.tick = null; } }

// Warm the next photo so it appears instantly.
function prefetchNext(s) {
  const round = G.currentRound(s);
  if (round?.type === 'photo') {
    const next = round.questions[s.qIndex + 1];
    if (next?.wiki) prefetchPhotos([next.wiki]);
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────
function teardown() { stopTick(); if (app.unsub) { app.unsub(); app.unsub = null; } }

function showModeTag(mode) {
  const t = el('div.mode-tag', { text: mode === 'local' ? 'local test mode' : 'live' });
  document.body.appendChild(t);
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
