# BONK! — Phase 2 Roadmap (v3 — LOCKED 2026-09-05)

> Decisions locked with the product owner: M1 core+FTUE+analytics+save v2 · M2 gameplay+Remix+audio, **no energy wall** ·
> M3a home/breeds/chest · M3b cosmetics/personality/sharing · Paws = M3 flagged experiment only · 5 currencies as tabled ·
> timed objectives never game-over · breeds have no stats · **M2 gate = retention + gameplay funnel data, not D7 alone**.

**Core philosophy**

> 🎮 **Play → collect → progress → unlock → customize → come back**

**The long-term journey**

```
🎮 PLAY
 ↓
🦴 Score bones · earn 🪙 coins + ⭐ stars (+ 🏅 golden bones from bosses / 3-star packs)
 ↓
🏠 Upgrade your dog's home
 ↓
🐶 Unlock a new breed
 ↓
🌎 Reach a new world
 ↓
🎮 New gameplay mechanic
 ↓
🐶 More breeds + cosmetics
 ↓
🔁 Repeat
```

The player isn't just building a village — they're **building a world and collecting dogs.**

**Currencies (one job each — four is the ceiling)**

| | Job | Source |
|---|---|---|
| 🦴 Bones | in-run score only (not a wallet) | catching |
| 🪙 Coins | spend: buildings, cosmetics | levels, chest, remix |
| ⭐ Stars | gates: level packs, building tier 3, breeds | 3-star objectives |
| 🏅 Golden bones | rare: unlock breeds | bosses, 3-starring a whole pack |
| 💎 Diamonds | Phase 3 only, cosmetics only | real money |

---

## M1 — Make the game addictive
**Goal: make the 60–90 s run genuinely fun on its own.**

- Convert levels to JSON (mechanics, goals, rewards as data)
- Save v2 with schema version + migrations (needed before any wallet)
- **3 in-run hearts** per level (current behaviour, formalised)
- **Combo** ×1→×5 (paw-chain UI; a hit resets)
- **3-star objectives** per level: ⭐ finish · ⭐ don't lose a heart · ⭐ level-specific
- **Timed objectives are stars, never game-over** — e.g. *"10 bones in the first 30 s"*, *"combo ×4 before 40 s"*
- Instant retry · near-miss "Phew!" feedback
- Level map screen (winding meadow path, stars per node)
- Difficulty progression curve across levels 1–10
- **FTUE / tutorial** (first 20 s of level 1, no text walls)
- **Local analytics log** (sessions, level starts/ends, stars, retries) — so the gates below are measurable

**Gate:** Is the basic game fun without village, chest or monetization? (playtest 5 people; retry rate & voluntary replays)

---

## M2 — Make the world grow
**Goal: give players a reason to reach the next level.**

- Levels 3–10: wind · thief squirrel · puddles/frogs · bouncing items · fog · kites · **first boss (The Crow)**
- New items: golden bone (+50), shield biscuit, slow-mo clock, apple (heal), bee
- **Daily Remix** — one seeded level per day with modifiers; local board with ghost scores (return reason, measurable)
- Meadow world screen + **first Doghouse** (3 tiers, unlocked by ⭐ only — a teaser of the home)
- 🪙 Coins + ⭐ Stars start accruing (wallet via save v2)
- **Music + SFX pass** (one loop per world, proper catch/bonk/combo sounds)

**Gate:** If players aren't returning (D1/D7 from the local log), improve gameplay before adding more meta. No energy system in this milestone — keep the gate clean.

---

## M3 — Dogs + Village
**Goal: make progression emotional.**

**M3a — Home**
- Puppy Village (Meadow): Doghouse + Bone Bakery, Fountain, Playground, Statue — 3 tiers each
- Tier-ups cost 🪙; tier 3 needs a ⭐ threshold from that world's levels
- Completed buildings are lightly alive (smoke, wag, water ripples — reuse existing tech)
- **First breed collection** (Beagle + 3): 🪙 coin breeds · 🏅 golden-bone breeds
- **Daily Bone Chest** — one free open/day, 3 rarity tiers, odds shown, 7-day streak → guaranteed rare. Wooden chest & bones, never neon
- *(Flagged, default OFF)* **🐾 Paws** energy system — see §Paws below

**M3b — Identity**
- Dog cosmetics (bandanas, hats, glasses, trails, 3 result-screen emotes)
- Puppy personality: per-breed idle quirks, menu reactions
- Share card (PNG: score, combo, puppy + emote, your home)

**Important: breeds do NOT have gameplay stats.** A Corgi and a Husky play exactly the same; they are progression/identity rewards.

---

## M4 — More worlds
**Goal: make reaching the next area exciting.**

- Autumn + Night worlds, levels 11–20, new mechanics (haycart platform, lantern/fireflies/owls), two bosses
- New village + buildings per world, new breeds, new cosmetics
- Event JSON (weekend "Bone Rush", themed weeks, seasonal skins — no code ship per event)
- PWA improvements (install, offline, icons)

Progression: **Meadow → Autumn → Night → Winter → Beach**.
Each world introduces **something visually new + something mechanically new**.

---

## M5 — Social
**Only after the core works.**

- Anonymous accounts · cloud save
- Real weekly leaderboard (Daily Remix)
- Beat-my-run challenges · friend challenge links · share results
- Offline mode remains fully functional

---

## 💎 Phase 3 — Monetization
**Only after you know people actually love BONK!.**

- 💎 Diamonds (real money) → premium breeds, outfits, houses/decorations — cosmetic only
- Rewarded ads (second chest open, revive once per run)
- Advanced events; possibly sticker collection/trading (needs M5)
- If 🐾 Paws is ON: paw refill is the only "convenience" purchase, and never on Remix or cleared levels

**Never sell power.**

---

## 🐾 Paws (energy) — decision notes
An energy wall on a 60-second skill game is the feature most likely to hurt retention, and its benefits (pacing,
monetization hook) don't apply before Phase 3. So:

- Not in M1/M2 (keeps the gates honest).
- Built in M3 behind a flag; A/B on/off once there are enough players.
- If ON: lose a paw only on **level failure** (never per hit); cap 8; fixed 15–20 min refill (simple to explain);
  full refill on daily login; **never** charged for the Daily Remix or replaying a cleared level.
- Named "Paws" to avoid clashing with in-run hearts.

---

## Objectives example

> ⭐⭐⭐
> Finish level
> Don't lose a heart
> Collect 10 bones in the first 30 seconds

Skill, replayability and fun — without stress.

---

## Technical notes
Modules: `core/{economy,save,events,analytics}.js`, `game/mechanics/*` (hook interface), `game/bosses/*`,
`meta/{village,breeds,chest,goals,combo,cosmetics,paws}.js`, `scenes/{levelMap,village,chest,album}.js`,
`net/api.js` (no-op offline adapter, Supabase/Firebase later). Levels as JSON. Weather procedural. Budget ≤ 3.5 MB
initial, lazy-load per world, 60 fps on 2021 mid-range Android. Art pipeline as in v0.4–0.5.

## Market rationale (kept from v2)
Hybrid-casual (simple core + light meta) is what lifts D7 from ~5 % to 15–20 %; Coin Master's slot-heavy loop is
declining and reads as "casino for kids" to Gen Z; Monopoly GO won on events, tournaments and low-effort social.
Hence: no spin wheel, no raids, one daily luck beat (chest), compete-and-share instead of steal.
