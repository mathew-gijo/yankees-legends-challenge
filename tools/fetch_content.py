#!/usr/bin/env python3
"""Refresh Yankees Legends Challenge content from the internet (Wikipedia).

Uses only the Python standard library. The app pulls photos live at runtime,
but this script lets you:
  • validate that every legend has a freely-licensed Wikipedia photo,
  • refresh the one-line blurbs from Wikipedia,
  • auto-generate a fresh Round 2 "photo" question set with distractors.

Usage:
  python3 tools/fetch_content.py --check                 # report photo/description status
  python3 tools/fetch_content.py --refresh-blurbs        # update legends.json blurbs
  python3 tools/fetch_content.py --build-photo-round 6    # rewrite Round 2 from the pool

Nothing here scrapes copyrighted media. Photos come from Wikipedia's REST API,
which serves CC/public-domain lead images. Famous broadcast "calls" are
copyrighted — add your own licensed clips to Round 3's audioUrl fields by hand.
"""
import argparse
import json
import os
import random
import time
import urllib.parse
import urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..")
LEGENDS = os.path.join(ROOT, "content", "legends.json")
ROUNDS = os.path.join(ROOT, "content", "rounds.json")
API = "https://en.wikipedia.org/api/rest_v1/page/summary/"
UA = "YankeesLegendsChallenge/1.0 (educational dinner game; contact: local)"


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def summary(title):
    url = API + urllib.parse.quote(title.replace(" ", "_"))
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


def check():
    data = load(LEGENDS)
    ok, missing = 0, []
    for p in data["players"]:
        try:
            s = summary(p["wiki"])
            has_photo = bool(s.get("thumbnail") or s.get("originalimage"))
            print(f"  {'✓' if has_photo else '✗'} {p['name']:<20} {'photo' if has_photo else 'NO PHOTO'}")
            ok += has_photo
            if not has_photo:
                missing.append(p["name"])
        except Exception as e:
            print(f"  ! {p['name']:<20} error: {e}")
            missing.append(p["name"])
        time.sleep(0.15)
    print(f"\n{ok}/{len(data['players'])} legends have a live photo.")
    if missing:
        print("No photo for:", ", ".join(missing))


def refresh_blurbs():
    data = load(LEGENDS)
    for p in data["players"]:
        try:
            s = summary(p["wiki"])
            extract = (s.get("extract") or "").split(". ")[0].strip()
            if extract:
                p["blurb"] = (extract[:120] + "…") if len(extract) > 121 else extract
                print(f"  updated {p['name']}")
        except Exception as e:
            print(f"  skip {p['name']}: {e}")
        time.sleep(0.15)
    data["updated"] = time.strftime("%Y-%m-%d")
    save(LEGENDS, data)
    print("Saved", LEGENDS)


def build_photo_round(n):
    legends = load(LEGENDS)["players"]
    pool = [p for p in legends]
    random.shuffle(pool)
    chosen = pool[:n]
    questions = []
    names = [p["name"] for p in legends]
    for p in chosen:
        distractors = random.sample([x for x in names if x != p["name"]], 3)
        choices = distractors + [p["name"]]
        random.shuffle(choices)
        questions.append({
            "wiki": p["wiki"],
            "prompt": "Name this Yankee",
            "choices": choices,
            "answer": choices.index(p["name"]),
            "fact": p["blurb"],
        })
    rounds = load(ROUNDS)
    for rd in rounds["rounds"]:
        if rd["id"] == 2:
            rd["questions"] = questions
    rounds["updated"] = time.strftime("%Y-%m-%d")
    save(ROUNDS, rounds)
    print(f"Rebuilt Round 2 with {len(questions)} photo questions.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="report which legends have live photos")
    ap.add_argument("--refresh-blurbs", action="store_true", help="update legends.json blurbs from Wikipedia")
    ap.add_argument("--build-photo-round", type=int, metavar="N", help="regenerate Round 2 with N photo questions")
    args = ap.parse_args()

    if args.check:
        check()
    if args.refresh_blurbs:
        refresh_blurbs()
    if args.build_photo_round:
        build_photo_round(args.build_photo_round)
    if not (args.check or args.refresh_blurbs or args.build_photo_round):
        ap.print_help()


if __name__ == "__main__":
    main()
