// Screen renderers. Each returns DOM built with ui.el and reads from `ctx`.
// ctx = { state, uid, code, mode, isHost, act:{...}, round, question }

import { el, crest, mount, toast, LETTERS } from './ui.js';
import { fetchPhoto, legends } from './content.js';
import { PHASE, qKey, leaderboard, currentRound, currentQuestion } from './game.js';

// ── Home / create / join ─────────────────────────────────────────────────
export function renderHome({ onCreate, onJoin, mode }) {
  let name = localStorage.getItem('ylc_name') || '';
  const nameIn = el('input.input', { placeholder: 'Your name', value: name, maxlength: 16,
    oninput: (e) => { name = e.target.value; } });
  const codeIn = el('input.input.code', { placeholder: 'CODE', maxlength: 4, autocapitalize: 'characters',
    oninput: (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); } });

  const save = () => { localStorage.setItem('ylc_name', name.trim()); };

  mount(
    el('div.brand', {}, [
      crest(),
      el('h1', { text: 'Yankees Legends' }),
      el('div.tag', { text: 'CHALLENGE' }),
      el('p.muted.center', { text: 'Four rounds. Rising difficulty. Settle it over dinner.' }),
    ]),
    el('div.card.stack', {}, [
      el('div.pin', { text: 'Host a game' }),
      nameIn,
      el('button.btn', { text: 'Create game', onclick: () => {
        if (!name.trim()) return toast('Enter your name first');
        save(); onCreate(name.trim());
      } }),
    ]),
    el('div.card.stack', {}, [
      el('div.pin', { text: 'Join a game' }),
      codeIn,
      el('button.btn.secondary', { text: 'Join', onclick: () => {
        if (!name.trim()) return toast('Enter your name first');
        const code = codeIn.value.trim().toUpperCase();
        if (code.length !== 4) return toast('Enter the 4-letter code');
        save(); onJoin(code, name.trim());
      } }),
    ]),
    el('p.footer', { html: mode === 'local'
      ? 'Running in <b>local test mode</b> — open a second browser tab to add a player. Add Firebase config for real cross-phone play.'
      : 'Connected · everyone can join from their own phone.' }),
  );
}

// ── Lobby ─────────────────────────────────────────────────────────────────
export function renderLobby(ctx) {
  const { state, isHost, code, act, uid } = ctx;
  const players = leaderboard(state);
  mount(
    header('Lobby', `Room code`),
    el('div.card.center.stack', {}, [
      el('div.muted', { text: 'Share this code' }),
      el('div', { style: { fontSize: '44px', fontWeight: '900', letterSpacing: '10px', color: 'var(--gold-2)' }, text: code }),
      el('button.btn.ghost.small', { text: 'Copy code', onclick: () => {
        navigator.clipboard?.writeText(code); toast('Code copied');
      } }),
    ]),
    el('div.card.stack', {}, [
      el('div.row.between', {}, [ el('div.pin', { text: `Players (${players.length})` }), el('span.badge', { text: ctx.mode === 'local' ? 'LOCAL' : 'LIVE' }) ]),
      el('div.chips', {}, players.map((p) => el('span.chip', { text: p.name + (p.uid === state.hostId ? ' 👑' : '') }))),
    ]),
    isHost
      ? el('button.btn', { text: 'Start the challenge', onclick: act.start })
      : el('p.center.muted', { text: 'Waiting for the host to start…' }),
    el('button.btn.ghost.small', { text: 'Leave', onclick: act.leave }),
  );
}

// ── Question (trivia / photo / audio) ─────────────────────────────────────
export function renderQuestion(ctx) {
  const { state, isHost, act } = ctx;
  const round = currentRound(state);
  const q = currentQuestion(state);
  const key = qKey(state);
  const myAnswer = state.answers?.[key]?.[ctx.uid];
  const numAnswered = Object.keys(state.answers?.[key] || {}).length;
  const numPlayers = Object.keys(state.players || {}).length;
  const revealing = state.phase === PHASE.REVEAL;

  const choiceBtns = q.choices.map((c, i) => {
    const cls = ['choice'];
    if (myAnswer?.choice === i) cls.push('selected');
    if (revealing && i === q.answer) cls.push('correct');
    if (revealing && myAnswer?.choice === i && i !== q.answer) cls.push('wrong');
    return el('button.' + cls.join('.'), {
      disabled: Boolean(myAnswer) || revealing,
      onclick: () => act.answer(i),
    }, [ el('span.k', { text: LETTERS[i] }), c ]);
  });

  const media = round.type === 'photo' ? photoBlock(q)
    : round.type === 'audio' ? audioBlock(q)
    : null;

  mount(
    roundHeader(state, round),
    el('div.progress', {}, [ el('span', { id: 'timerbar', style: { width: '100%' } }) ]),
    el('div.row.between', {}, [
      el('span.muted', { text: `Question ${state.qIndex + 1} of ${round.questions.length}` }),
      el('span.timer', { id: 'timertext', text: '' }),
    ]),
    media,
    el('div.card.stack', {}, [
      el('h2', { text: q.prompt || q.q }),
      el('div.choices', {}, choiceBtns),
    ]),
    revealing ? el('div.fact', { text: q.fact || '' }) : null,
    el('p.center.muted', { text: revealing ? '' : (myAnswer ? 'Locked in ✓  Waiting…' : 'Tap your answer') }),
    el('p.center.muted', { text: `${numAnswered}/${numPlayers} answered` }),
    hostControls(ctx, revealing
      ? { label: state.qIndex >= round.questions.length - 1 ? 'End round' : 'Next question', onClick: act.next }
      : { label: 'Reveal answer', onClick: act.reveal }),
  );

  if (media && round.type === 'photo') fillPhoto(q);
}

function photoBlock(q) {
  return el('div.photo', { id: 'photo' }, [ el('div.ph', { text: 'Loading rare photo…' }) ]);
}
async function fillPhoto(q) {
  const box = document.getElementById('photo');
  if (!box) return;
  const p = await fetchPhoto(q.wiki);
  if (!box.isConnected) return;
  box.innerHTML = '';
  if (p?.url) {
    box.appendChild(el('img', { src: p.url, alt: 'Guess the Yankee', referrerpolicy: 'no-referrer' }));
  } else {
    box.appendChild(el('div.ph', { text: 'Photo unavailable offline — read the choices!' }));
  }
}
function audioBlock(q) {
  const kids = [ el('div.pin', { text: '🎙  The Call' }), el('h3', { text: q.transcript }) ];
  if (q.audioUrl) kids.push(el('audio', { src: q.audioUrl, controls: true, style: { width: '100%' } }));
  else kids.push(el('p.muted', { text: 'Read the call aloud in your best broadcaster voice, then everyone answers.' }));
  return el('div.card.stack', {}, kids);
}

// ── Round end ──────────────────────────────────────────────────────────────
export function renderRoundEnd(ctx) {
  const { state, act } = ctx;
  const round = currentRound(state);
  mount(
    header(`${round.title} — done`, round.subtitle),
    el('div.card.stack', {}, [ el('div.pin', { text: 'Standings' }), leaderList(state, ctx.uid) ]),
    hostControls(ctx, { label: 'Next round', onClick: act.next }),
  );
}

// ── Round 4a: What-if ───────────────────────────────────────────────────────
export function renderWhatIf(ctx) {
  const { state, act } = ctx;
  const round = currentRound(state);
  const item = round.whatIfs[state.whatIfIndex];
  const key = `w${state.whatIfIndex}`;
  const votes = state.whatIfVotes?.[key] || {};
  const myVote = votes[ctx.uid];
  const counts = item.options.map((_, i) => Object.values(votes).filter((v) => v === i).length);
  const total = Object.values(votes).length || 1;

  mount(
    roundHeader(state, round),
    el('div.card.stack', {}, [
      el('div.pin', { text: `What-If ${state.whatIfIndex + 1} of ${round.whatIfs.length}` }),
      el('h2', { text: item.scenario }),
      el('p.muted', { text: item.prompt }),
    ]),
    el('div.choices', {}, item.options.map((opt, i) => {
      const pct = Math.round((counts[i] / total) * 100);
      return el('button.choice' + (myVote === i ? '.selected' : ''), {
        onclick: () => act.whatIfVote(i),
        style: myVote != null ? { background: `linear-gradient(90deg, var(--navy-3) ${pct}%, var(--navy-2) ${pct}%)` } : {},
      }, [ el('span.k', { text: LETTERS[i] }), opt, myVote != null ? el('span', { style: { marginLeft: 'auto', color: 'var(--gold-2)', fontWeight: '800' }, text: ` ${pct}%` }) : null ]);
    })),
    el('p.center.muted', { text: 'No points here — just argue it out. 🍽️' }),
    hostControls(ctx, { label: state.whatIfIndex >= round.whatIfs.length - 1 ? 'Build the dream team →' : 'Next what-if', onClick: act.next }),
  );
}

// ── Round 4b: Draft your team ───────────────────────────────────────────────
export function renderDraft(ctx) {
  const { state, act } = ctx;
  const round = currentRound(state);
  const mine = state.drafts?.[ctx.uid] || {};
  const pool = legends();
  let activePos = ctx._activePos || round.positions.find((p) => !mine[p]) || round.positions[0];

  const slots = el('div.slots', {}, round.positions.map((pos) => {
    const filledId = mine[pos];
    const who = filledId ? pool.find((p) => p.id === filledId) : null;
    return el('div.slot' + (who ? '.filled' : '') + (pos === activePos ? '' : ''), {
      onclick: () => { ctx._activePos = pos; ctx.rerender(); },
      style: pos === activePos ? { borderColor: 'var(--gold)' } : {},
    }, [
      el('div.posbadge', { text: pos }),
      el('div.who', { text: who ? who.name : 'tap to pick →' }),
      who ? el('span.badge', { text: '✓' }) : null,
    ]);
  }));

  const eligible = pool.filter((p) => p.pos.includes(activePos));
  const poolList = el('div.pool', {}, (eligible.length ? eligible : pool).map((p) => el('div.poolitem', {
    onclick: () => { act.setDraft(activePos, p.id); ctx._activePos = round.positions.find((x) => !((state.drafts?.[ctx.uid] || {})[x]) && x !== activePos); },
  }, [
    el('div.meta', {}, [ el('div', { text: p.name }), el('div.p', { text: `${p.era} · ${p.blurb}` }) ]),
    el('span.pos', { text: p.pos.join('/') }),
  ])));

  const filledCount = round.positions.filter((p) => mine[p]).length;

  mount(
    roundHeader(state, round),
    el('div.card.stack', {}, [
      el('div.row.between', {}, [ el('div.pin', { text: 'Your all-time roster' }), el('span.badge', { text: `${filledCount}/${round.positions.length}` }) ]),
      slots,
    ]),
    el('div.card.stack', {}, [
      el('div.pin', { text: `Pick your ${activePos}` }),
      poolList,
    ]),
    hostControls(ctx, { label: 'Everyone locked in → vote', onClick: act.next }),
    el('p.center.muted', { text: 'Fill every slot, then the host moves everyone to voting.' }),
  );
}

// ── Round 4c: Vote best team ────────────────────────────────────────────────
export function renderDraftReveal(ctx) {
  const { state, act } = ctx;
  const pool = legends();
  const round = currentRound(state);
  const teams = Object.entries(state.drafts || {});
  const myVote = state.teamVotes?.[ctx.uid];

  mount(
    roundHeader(state, round),
    el('div.card', {}, [ el('h2', { text: 'Vote for the best team' }), el('p.muted', { text: "You can't vote for your own. Winning GM earns 150 pts." }) ]),
    ...teams.map(([voterUid, roster]) => {
      const owner = state.players[voterUid];
      const lineup = round.positions.map((pos) => {
        const pl = pool.find((p) => p.id === roster[pos]);
        return el('div.row.between', {}, [ el('span.muted', { text: pos }), el('span', { style: { fontWeight: '600' }, text: pl ? pl.name : '—' }) ]);
      });
      const isMe = voterUid === ctx.uid;
      return el('div.card.stack', { style: myVote === voterUid ? { borderColor: 'var(--gold)' } : {} }, [
        el('div.row.between', {}, [ el('div.pin', { text: (owner?.name || 'Team') + (isMe ? ' (you)' : '') }), el('span.badge', { text: `${Object.values(state.teamVotes || {}).filter((v) => v === voterUid).length} votes` }) ]),
        ...lineup,
        isMe ? null : el('button.btn.secondary.small', { text: myVote === voterUid ? 'Voted ✓' : 'Vote for this team', onclick: () => act.teamVote(voterUid) }),
      ]);
    }),
    hostControls(ctx, { label: 'Final results', onClick: act.next }),
  );
}

// ── Results ─────────────────────────────────────────────────────────────────
export function renderResults(ctx) {
  const { state, act } = ctx;
  const board = leaderboard(state);
  const champ = board[0];
  mount(
    el('div.brand', {}, [ crest(), el('div.tag', { text: 'CHAMPION' }), el('h1', { text: champ?.name || '—' }), el('p.muted', { text: `${champ?.score || 0} points` }) ]),
    el('div.card.stack', {}, [ el('div.pin', { text: 'Final standings' }), leaderList(state, ctx.uid) ]),
    ctx.isHost ? el('button.btn', { text: 'Play again', onclick: act.playAgain }) : el('p.center.muted', { text: 'Thanks for playing! Host can restart.' }),
    el('button.btn.ghost.small', { text: 'Leave', onclick: act.leave }),
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────
function header(title, sub) {
  return el('div.stack', {}, [ el('h1', { text: title }), sub ? el('div.muted', { text: sub }) : null ]);
}
function roundHeader(state, round) {
  return el('div.row.between', {}, [
    el('div', {}, [ el('div.pin', { text: round.title }), el('div.muted', { text: round.subtitle }) ]),
    el('span.badge', { text: `Round ${state.roundIndex + 1}/4` }),
  ]);
}
function leaderList(state, myUid) {
  return el('div.leader', {}, leaderboard(state).map((p, i) => el('div.item' + (p.uid === myUid ? '.me' : ''), {}, [
    el('div.rank', { text: i === 0 ? '🏆' : String(i + 1) }),
    el('div.nm', { text: p.name }),
    el('div.sc', { text: String(p.score) }),
  ])));
}
function hostControls(ctx, { label, onClick }) {
  if (!ctx.isHost) return el('p.center.muted', { text: 'Waiting for the host…' });
  return el('button.btn', { text: label, onclick: onClick });
}
