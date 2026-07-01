// Pure game logic: state shape, scoring, and host-driven phase transitions.
// Transition functions take the shared state object and mutate it in place;
// they are always run inside net.update() so writes stay transactional.

import { rounds } from './content.js';

export const PHASE = {
  LOBBY: 'lobby',
  QUESTION: 'question',
  REVEAL: 'reveal',
  ROUND_END: 'roundEnd',
  WHATIF: 'whatif',
  DRAFT: 'draft',
  DRAFT_REVEAL: 'draftReveal',
  RESULTS: 'results',
};

export function initialState(hostId, hostName) {
  return {
    code: null,
    hostId,
    createdAt: Date.now(),
    phase: PHASE.LOBBY,
    roundIndex: 0,
    qIndex: 0,
    qStartedAt: 0,
    players: { [hostId]: player(hostName) },
    answers: {},      // 'r{ri}q{qi}': { uid: { choice, ms } }
    scored: {},       // 'r{ri}q{qi}': true
    whatIfVotes: {},  // 'w{i}': { uid: optionIndex }
    whatIfIndex: 0,
    drafts: {},       // uid: { POS: playerId }
    teamVotes: {},    // uid: votedForUid
  };
}

export const player = (name) => ({ name: name.slice(0, 16), score: 0, joined: Date.now() });

export const qKey = (s) => `r${s.roundIndex}q${s.qIndex}`;
export const currentRound = (s) => rounds()[s.roundIndex];
export const currentQuestion = (s) => currentRound(s)?.questions?.[s.qIndex];

export function leaderboard(s) {
  return Object.entries(s.players || {})
    .map(([uid, p]) => ({ uid, ...p }))
    .sort((a, b) => b.score - a.score || a.joined - b.joined);
}

// ── Player actions ───────────────────────────────────────────────────────
export function addPlayer(s, uid, name) {
  if (!s.players) s.players = {};
  if (!s.players[uid]) s.players[uid] = player(name);
  else s.players[uid].name = name.slice(0, 16);
}

export function recordAnswer(s, uid, choice) {
  const key = qKey(s);
  if (s.phase !== PHASE.QUESTION) return;
  s.answers[key] = s.answers[key] || {};
  if (s.answers[key][uid]) return; // lock first answer
  const ms = Date.now() - (s.qStartedAt || Date.now());
  s.answers[key][uid] = { choice, ms };
}

export function recordWhatIf(s, uid, optionIndex) {
  const key = `w${s.whatIfIndex}`;
  s.whatIfVotes[key] = s.whatIfVotes[key] || {};
  s.whatIfVotes[key][uid] = optionIndex;
}

export function recordDraft(s, uid, pos, playerId) {
  s.drafts[uid] = s.drafts[uid] || {};
  // a legend can only occupy one slot per roster
  for (const p of Object.keys(s.drafts[uid])) if (s.drafts[uid][p] === playerId) delete s.drafts[uid][p];
  s.drafts[uid][pos] = playerId;
}

export function recordTeamVote(s, uid, votedForUid) {
  s.teamVotes[uid] = votedForUid;
}

// ── Host transitions ───────────────────────────────────────────────────────
export function startGame(s) {
  s.phase = PHASE.QUESTION;
  s.roundIndex = 0;
  s.qIndex = 0;
  s.qStartedAt = Date.now();
}

export function reveal(s) {
  if (s.phase !== PHASE.QUESTION) return;
  scoreCurrentQuestion(s);
  s.phase = PHASE.REVEAL;
}

function scoreCurrentQuestion(s) {
  const key = qKey(s);
  if (s.scored[key]) return;
  const round = currentRound(s);
  const q = currentQuestion(s);
  if (!q) return;
  const limitMs = (round.secondsPerQ || 20) * 1000;
  const ans = s.answers[key] || {};
  for (const [uid, a] of Object.entries(ans)) {
    if (a.choice === q.answer && s.players[uid]) {
      const speed = Math.max(0, Math.round(100 * (1 - a.ms / limitMs)));
      s.players[uid].score += 100 + speed;
    }
  }
  s.scored[key] = true;
}

export function advance(s) {
  const round = currentRound(s);
  // Within a trivia/photo/audio round
  if ([PHASE.QUESTION, PHASE.REVEAL].includes(s.phase)) {
    if (s.phase === PHASE.QUESTION) scoreCurrentQuestion(s); // safety
    const last = s.qIndex >= (round.questions?.length || 0) - 1;
    if (!last) { s.qIndex += 1; s.phase = PHASE.QUESTION; s.qStartedAt = Date.now(); }
    else { s.phase = PHASE.ROUND_END; }
    return;
  }
  // Between rounds
  if (s.phase === PHASE.ROUND_END) {
    const next = rounds()[s.roundIndex + 1];
    if (!next) { s.phase = PHASE.RESULTS; return; }
    s.roundIndex += 1;
    s.qIndex = 0;
    if (next.type === 'special') { s.phase = PHASE.WHATIF; s.whatIfIndex = 0; }
    else { s.phase = PHASE.QUESTION; s.qStartedAt = Date.now(); }
    return;
  }
  // Round 4 — what-if scenarios
  if (s.phase === PHASE.WHATIF) {
    const list = round.whatIfs || [];
    if (s.whatIfIndex < list.length - 1) s.whatIfIndex += 1;
    else s.phase = PHASE.DRAFT;
    return;
  }
  // Round 4 — drafting → reveal/vote
  if (s.phase === PHASE.DRAFT) { s.phase = PHASE.DRAFT_REVEAL; return; }
  // Round 4 — after team vote, tally and show results
  if (s.phase === PHASE.DRAFT_REVEAL) { tallyTeamVotes(s); s.phase = PHASE.RESULTS; return; }
}

function tallyTeamVotes(s) {
  if (s._teamTallied) return;
  for (const votedFor of Object.values(s.teamVotes || {})) {
    if (s.players[votedFor]) s.players[votedFor].score += 150;
  }
  s._teamTallied = true;
}

export function backToLobby(s) {
  const host = s.hostId;
  const names = Object.fromEntries(Object.entries(s.players).map(([u, p]) => [u, p.name]));
  Object.assign(s, initialState(host, names[host] || 'Host'));
  for (const [u, n] of Object.entries(names)) addPlayer(s, u, n);
}
