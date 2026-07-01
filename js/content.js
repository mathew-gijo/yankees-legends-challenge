// Loads game content and fetches freely-licensed player photos live from Wikipedia.

let _rounds = null;
let _legends = null;
const _photoCache = new Map();

export async function loadContent() {
  if (_rounds && _legends) return { rounds: _rounds, legends: _legends };
  const bust = `?v=${Date.now()}`; // always pull the freshest content ("dynamically updates")
  const [r, l] = await Promise.all([
    fetch(`content/rounds.json${bust}`).then((x) => x.json()),
    fetch(`content/legends.json${bust}`).then((x) => x.json()),
  ]);
  _rounds = r;
  _legends = l;
  return { rounds: _rounds, legends: _legends };
}

export function rounds() { return _rounds?.rounds || []; }
export function legends() { return _legends?.players || []; }

/**
 * Fetch a player's lead photo from the Wikipedia REST API.
 * Returns { url, credit } or null. Images are freely licensed (CC/PD) per Wikipedia.
 */
export async function fetchPhoto(wikiTitle) {
  if (!wikiTitle) return null;
  if (_photoCache.has(wikiTitle)) return _photoCache.get(wikiTitle);
  try {
    const title = encodeURIComponent(wikiTitle.replace(/ /g, '_'));
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const url = data.originalimage?.source || data.thumbnail?.source || null;
    const out = url ? { url, credit: 'Wikimedia Commons' } : null;
    _photoCache.set(wikiTitle, out);
    return out;
  } catch (_) {
    _photoCache.set(wikiTitle, null);
    return null;
  }
}

// Warm the cache for a set of titles (fire and forget).
export function prefetchPhotos(titles = []) {
  titles.forEach((t) => fetchPhoto(t));
}
