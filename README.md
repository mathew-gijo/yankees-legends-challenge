# Yankees Legends Challenge ⚾

A four-round, increasing-difficulty Yankees trivia game built for the dinner table.
Everyone plays on their own phone; one person hosts. It's a **mobile-first
installable PWA** with **no build step** — just static files, plain ES-module
JavaScript, and content that updates live from the internet.

<p align="center"><img src="icons/icon-192.png" width="96" alt="app icon"></p>

## The game

| Round | Name | Difficulty | What happens |
|------|------|-----------|--------------|
| 1 | Pinstripe Warmup | Easy | Multiple-choice trivia, speed-scored |
| 2 | Faces of the Franchise | Medium | Name the player from a **rare photo** (loaded live from Wikipedia) |
| 3 | The Call | Hard | Identify the moment from a famous **broadcast call** |
| 4 | What-If & Dream Team | Expert | Vote on **trade "what-if" scenarios**, then **draft your all-time Yankees team** and vote for the best roster |

Scoring: 100 points per correct answer + up to 100 speed bonus. The winning
dream-team GM earns a 150-point bonus. Highest total is crowned champion.

## Run it locally

No Node required — it's served as static files.

```bash
# from the project root
python3 tools/serve.py 8123
# then open http://localhost:8123 on your computer…
# …and on phones connected to the same Wi-Fi: http://<your-computer-ip>:8123
```

`tools/serve.py` sends `Cache-Control: no-store` so you always see your latest
edits during development.

**Local test mode:** with no Firebase configured (the default), the app runs in
local mode — great for trying it out. Open a **second browser tab** to add a
second player (each tab is a distinct player).

## Real multiplayer (everyone's own phone)

For guests to join across different phones, add a free **Firebase** backend:

1. Create a project at <https://console.firebase.google.com>.
2. Add a **Web App**, then enable **Firestore** (start in test mode) and
   **Anonymous Authentication** (Build → Authentication → Sign-in method).
3. Paste the config into [`js/firebase-config.js`](js/firebase-config.js).

That's it — the app auto-detects the config and switches from local mode to live
Firestore rooms. Players join with a 4-letter room code.

> Firestore free tier is far more than a dinner game needs. For a locked-down
> setup, restrict security rules to the `games/{code}` collection.

## Deploy (free static hosting)

Because it's just static files, drop the folder on any static host:

- **Netlify / Vercel:** drag-and-drop the folder, or connect the repo. No build command; publish directory is the project root.
- **GitHub Pages:** push to a repo and enable Pages on the branch root.

The service worker ([`sw.js`](sw.js)) is **network-first**, so deployed updates
and fresh content reach players immediately, while the app still loads offline.

## Updating the content

Content lives in [`content/rounds.json`](content/rounds.json) and
[`content/legends.json`](content/legends.json) — edit them directly, or use the
refresher (standard library only, no pip installs):

```bash
python3 tools/fetch_content.py --check              # verify every legend has a live photo
python3 tools/fetch_content.py --refresh-blurbs     # refresh bios from Wikipedia
python3 tools/fetch_content.py --build-photo-round 6 # regenerate Round 2 from the legend pool
```

## A note on photos & audio

Rare player **photos load live from the Wikipedia REST API**, which serves
freely-licensed (Creative Commons / public-domain) images — no copyrighted media
is bundled or hotlinked. Famous **broadcast "calls" are copyrighted**, so Round 3
ships with transcripts to read aloud; to play real audio, add your own licensed
clips to each question's `audioUrl` in `content/rounds.json`.

## Project layout

```
index.html              app shell
manifest.webmanifest    PWA manifest (installable to home screen)
sw.js                   service worker (network-first, offline fallback)
css/styles.css          mobile-first Yankees theme
js/
  app.js                controller: boot, routing, host actions, timer
  net.js                realtime layer — LocalNet (testing) + FirebaseNet
  game.js               state machine, scoring, phase transitions
  screens.js            all screen renderers
  content.js            loads JSON + fetches live Wikipedia photos
  ui.js                 tiny DOM helpers
  firebase-config.js    ← paste your Firebase config here
content/                trivia, scenarios, and the legend pool
tools/                  serve.py, fetch_content.py, generate_icons.py
icons/                  generated app icons
```

## Regenerating the icons

```bash
python3 tools/generate_icons.py   # pure-Python PNG generation, no dependencies
```
