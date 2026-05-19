# Gridiron Coach — Design Document

A browser-based learning game for American Football formations, positions, and strategic matchups. Static site, deployable to GitHub Pages. No backend.

---

## 1. Design Philosophy

### 1.1 What we're really teaching

The user's stated request is "pick the formation that counters the opposing formation." Taken literally, this risks reducing football to rock-paper-scissors, which is **not how football actually works** and would teach a misleading mental model.

Real football decision-making layers three things:

1. **Personnel & Formation** — who is on the field, where they line up. This signals *intent*.
2. **Play call within the formation** — the same formation can run a deep pass or an inside dive.
3. **Situation** — down, distance, field position, score, clock. These weight everything else.

A good teaching game must surface all three, or the player will leave with the wrong mental model. We'll design the core loop so the player progresses from naive formation-matching toward situational, personnel-aware reads — which is the real football literacy skill.

### 1.2 Design pillars

- **Every interaction is a teaching moment.** Picking, watching, and scoring all double as instruction surfaces.
- **Explain the "why" after every play.** Outcome without reasoning trains superstition, not understanding.
- **Progressive disclosure.** Start with 3 formations per side. Unlock complexity as the player demonstrates mastery.
- **Show, don't quiz.** Tooltips, hovers, and inline glossary beat modal flashcards.
- **Honest uncertainty.** Outcomes are probabilistic — a "correct" call can still fail, and the post-play breakdown explains why. This mirrors real football.

### 1.3 Target player

Someone with casual familiarity (knows what a touchdown is, has watched games, vague sense that "shotgun" and "I-formation" are things) who wants structured understanding of *why* coaches do what they do. Not a complete novice; not a film-study coach.

---

## 2. Core Loop

A **drive** is a session of 4–8 plays against a single AI opponent. Each play follows this loop:

```
   ┌─────────────────────────────────────────────────┐
   │ 1. SITUATION                                    │
   │    Down & distance, field position, score/clock │
   └────────────────────┬────────────────────────────┘
                        ▼
   ┌─────────────────────────────────────────────────┐
   │ 2. SCOUT                                        │
   │    Opponent's formation revealed. Player can    │
   │    hover positions to see responsibilities.     │
   │    "Tells" panel hints at likely play types.    │
   └────────────────────┬────────────────────────────┘
                        ▼
   ┌─────────────────────────────────────────────────┐
   │ 3. CALL                                         │
   │    Pick your formation (and, later, play type). │
   │    Optionally set a confidence level.           │
   └────────────────────┬────────────────────────────┘
                        ▼
   ┌─────────────────────────────────────────────────┐
   │ 4. PLAYOUT                                      │
   │    Animated SVG: players move, ball travels,    │
   │    outcome resolves (yards gained, TO, score).  │
   └────────────────────┬────────────────────────────┘
                        ▼
   ┌─────────────────────────────────────────────────┐
   │ 5. BREAKDOWN                                    │
   │    Why it worked / didn't. Key matchup callouts.│
   │    Glossary terms surfaced inline. XP awarded.  │
   └─────────────────────────────────────────────────┘
```

The player alternates between **offensive** and **defensive** mode either drive-by-drive or play-by-play (configurable). This is critical: understanding one side is half the literacy.

---

## 3. Game Modes

### 3.1 Tutorial (linear, ~10 min)

Walks through field layout, positions, what a formation is, what "down and distance" means, and one play from each side. Skippable for returning players.

### 3.2 Coach Mode (main mode)

Multi-play drives. The player coaches one side; AI coaches the other. Scoring rewards drive outcomes (TDs, FGs, stops, turnovers) *and* decision quality (independent of outcome — see §6).

### 3.3 Drill Mode

Single-play puzzles with a fixed situation: "3rd & 2 from your own 35, defense is in Nickel — pick a play." Useful for targeted learning; unlocks specific situations the player has been weak on.

### 3.4 Sandbox / Glossary

A non-game space to inspect any formation, hover any position, read any term. Acts as the manual.

---

## 4. Content Scope

### 4.1 Phase 1 (MVP)

**Offensive formations**
- I-Formation (power run base)
- Shotgun Trips (spread passing)
- Singleback (balanced)
- Goal Line (heavy short-yardage)

**Defensive formations**
- 4-3 base (balanced)
- Nickel (5 DBs, pass-leaning)
- 46 / Stacked Box (run-stuff)
- Goal Line (short-yardage)

**Play types within each formation** (3 per formation max in MVP):
- Run: inside (dive), outside (sweep/toss)
- Pass: short (slant/screen), deep (post/go)
- Defense: cover-1, cover-2, cover-3, blitz

This gives ~12 offensive calls and ~12 defensive calls — enough for a real matchup matrix without overwhelming a learner.

### 4.2 Phase 2 expansions

- Pistol, Wildcat, Empty (5 wide)
- 3-4, Dime, Bear
- Motion / shifts (pre-snap adjustments)
- Personnel packages (11, 12, 21 personnel naming)

### 4.3 What we deliberately omit

- Special teams (punt, FG, kickoff) — handled by abstraction ("4th down, take a FG or go for it" button).
- Play-action subtleties, RPOs, complex protection schemes — too advanced for the target player.
- Penalties — would muddy the teaching signal.

---

## 5. The Matchup Model

### 5.1 Why a deterministic table is wrong

A flat "Shotgun beats 4-3, 46 beats I-Form" lookup is easy to build and teaches the wrong thing. Real outcomes vary because:

- A great defensive call can be beaten by execution.
- The *same* matchup at 3rd-and-1 vs 3rd-and-10 has different expected value.
- Some matchups are high-variance (boom or bust); others are reliable but low-ceiling.

### 5.2 The model

Each play resolves a probability distribution over outcomes (yards gained, turnover chance, big-play chance). The distribution is computed from:

```
base_distribution = matchup_table[offense_call][defense_call]
modifiers = situation_modifier(down, distance, field_position)
final = apply(base_distribution, modifiers)
outcome = sample(final)
```

The matchup table stores, per cell:
- `mean_yards` (e.g., 4.2)
- `stdev` (variance — how boom/bust)
- `turnover_chance`
- `big_play_chance` (20+ yards)
- `tags`: short reasons that the breakdown screen can surface (`"unblocked_blitzer"`, `"safety_help_over_top"`, `"numbers_advantage_in_box"`)

This is authored content, not simulated physics. ~150 cells for MVP — tractable for one weekend of design work, with citations to real football principles in code comments.

### 5.3 Situation modifiers

- **Down & distance**: short yardage shifts run-game variance down (more reliable), penalizes deep passes against soft coverage.
- **Field position**: red zone compresses the field — deep routes lose value, run defenses get a boost.
- **Score & clock** (later phase): trailing late forces predictable pass calls, defense gets an edge.

### 5.4 Data sourcing

Matchup distributions are AI-generated with real NFL play-by-play data used as a directional reference — for example, empirical run-success rates against heavy boxes, or completion rates against Nickel vs. base-4 defenses. Numbers are adjusted for teachability (slightly exaggerated toward the correct principle when real-world signal is noisy) and stored as editable JSON. Code comments cite the football principle, not raw data values.

### 5.5 Honest randomness

Outcomes are sampled, not picked. The player will sometimes lose with a great call and win with a bad one. **The breakdown screen always names the reason**, so the player learns to evaluate the call separately from the outcome — a real coaching skill.

---

## 6. Scoring & Progression

### 6.1 Two scores per play, surfaced separately

- **Drive Score**: actual football outcome. Yards, points, turnovers.
- **Decision Score (XP)**: how well-calibrated the call was, given the situation and what was knowable. Computed as the expected-value rank of the chosen call among all available calls.

This separation is the most important design choice in the document. It teaches the player that *process beats outcome*, which is the actual mindset of football strategists.

### 6.2 Confidence wager (optional toggle)

Before each play, the player can mark their call as "trust" or "gut." Trust calls multiply Decision XP gain or loss. Adds stakes without inventing arbitrary points.

### 6.3 Mastery tracking

Per formation and per situation, track a rolling Decision Score. When a category exceeds threshold, unlock the next tier (new formations, new modes). When a category lags, Drill Mode surfaces it.

### 6.4 What we do NOT do

- No streaks, lives, or punishment loops. This is a learning tool, not Duolingo.
- No leaderboards in MVP. Self-comparison only.
- No XP cosmetics. Reward is mastery and unlocks.

---

## 7. Teaching Surfaces

Every part of the UI must double as instruction.

| Surface | What it teaches |
|---|---|
| **Position dots** | Hover → name, abbreviation, responsibility on this play. Click → full position page. |
| **Formation header** | Name, personnel (e.g., "11 personnel: 1 RB, 1 TE, 3 WR"), strengths, weaknesses. |
| **Situation strip** | What "3rd and long" implies. Tap "?" for explanation. |
| **Tells panel** | "TE is on the right → run tendency that way." Optional; can be disabled for harder play. |
| **Playout** | Routes drawn pre-snap on player request; arrows show key matchup. |
| **Breakdown** | 2–3 sentences naming the principle. Glossary terms underlined. |
| **Glossary** | Every term that ever appears in the UI is clickable and indexed in Sandbox. |

### 7.1 Tone of explanations

Short, declarative, jargon-introduced-then-defined. Example:

> The defense called **Cover 2** — two safeties split the deep field. That left the **flat** (the short outside area) lightly defended, which is exactly where your slant-flat combo attacked. +9 yards.

---

## 8. Visual Design

### 8.1 Field

Top-down SVG. 100-yard field with yard markers every 5. Hash marks. End zones colored by team.

### 8.2 Players

Circles, 22 total. Offense one color, defense another. Position abbreviation inside the circle (QB, RB, WR, MLB, CB, etc.). No jerseys, no animation flourishes — focus is formation clarity.

### 8.3 Playout animation

- Pre-snap: brief pause to read the formation.
- Snap: ball moves to QB. Routes/blocks become visible as faint paths.
- Resolution: ball-carrier or pass arc, defenders converge, tackle/incompletion/score. ~3–5 seconds total.
- "Replay" and "Slow" buttons. Pause anywhere to inspect.

### 8.4 Layout

- Desktop: field center, situation bar top, call panel right, breakdown panel slides up from bottom.
- Mobile: stacked — situation, field, call panel, breakdown.

### 8.5 Style

Clean, flat, high-contrast. Two team colors + neutral. No skeuomorphism. Should look like a coach's whiteboard, not Madden.

---

## 9. Technical Architecture

### 9.1 Stack

- **Build**: Vite. Static output to `dist/`, deployed via GitHub Actions to `gh-pages`.
- **Framework**: Svelte (small bundle, reactive, fits the data-driven UI well). React is a fine alternative.
- **Rendering**: SVG for field and players. CSS transitions for animation. No canvas, no game engine.
- **State**: Svelte stores. Persisted to `localStorage` for progress and settings.
- **Data**: JSON files in `src/data/` — formations, positions, plays, matchup table, glossary. Editable without code changes.
- **Tests**: Vitest for matchup-table math and progression logic.

### 9.2 Directory sketch

```
src/
  data/
    positions.json         # name, abbr, side, responsibilities[]
    formations.json        # name, side, personnel, alignments[], tells[], notes
    plays.json             # name, formation, type, routes[]/assignments[]
    matchups.json          # offense_call × defense_call → {mean, stdev, ...}
    situations.json        # down/distance/field modifiers
    glossary.json          # term → definition, see-also
  lib/
    field.svelte           # field + player rendering
    formation.svelte       # formation panel w/ hover
    playout.svelte         # animation
    breakdown.svelte       # post-play teaching panel
    matchup.ts             # resolution math (pure, testable)
    progression.ts         # mastery / unlocks
  routes/
    +page.svelte           # menu
    coach/+page.svelte
    drill/+page.svelte
    sandbox/+page.svelte
    tutorial/+page.svelte
  app.css
```

### 9.3 No-server constraints

- All data shipped with the bundle.
- Progress in localStorage with versioned schema and a "reset" button.
- No analytics in MVP (consider Plausible later if hosted on a custom domain).

---

## 10. Accessibility

- Keyboard navigation for all calls (number keys for formation choices).
- Color is never the sole signal — shapes/labels distinguish teams and roles.
- Animation has a "reduce motion" toggle that swaps the playout for a static diagram + text.
- Glossary readable at 200% zoom.

---

## 11. Build Order

A suggested phased path. Each phase produces a playable artifact.

**Phase 0 — Foundation**
- Vite + Svelte scaffold, GH Pages deploy pipeline.
- Field SVG, render 11 dots per side from JSON.
- Glossary + Sandbox screen (browse formations and positions).

**Phase 1 — One playable matchup**
- 2 offensive formations, 2 defensive formations, 4 plays each side.
- Matchup table with initial cells.
- Single-play loop: situation → call → resolve → breakdown.
- Static "playout" (no animation yet) — text + diagram.

**Phase 2 — Animation & drives**
- SVG playout animation.
- Drive structure (4 downs, field position, scoring).
- Score panel and Decision XP.

**Phase 3 — Content expansion**
- Fill MVP formation list (§4.1).
- Tutorial flow.
- Drill Mode.

**Phase 4 — Teaching polish**
- Tells panel.
- Hover responsibilities.
- Breakdown templating with glossary linking.
- Mastery tracking and unlocks.

**Phase 5 — Stretch**
- Pre-snap motion / audibles.
- Personnel package selection.
- Clock & score management late-game.

---

## 12. Open Questions

These are decisions we should make before or during Phase 1, flagged here so they don't get answered by accident.

1. **Does the player coach both sides, or pick one per session?** Per-drive toggle; coaching both sides is required to unlock advanced content.
2. **How granular is the call?** Formation + play type. Pure formation-only is too thin to teach real matchups.
3. **Is the AI opponent deterministic or adaptive?** Weighted-random with situational priors. An adaptive opponent is a challenge-mode stretch goal.
4. **Confidence wager on by default?** Off. The tutorial introduces it after ~5 drives.
5. **How do we source the matchup table values?** AI-generated probability distributions informed by real NFL play-by-play data trends (e.g., run success rates against heavy boxes, completion rates vs. Nickel) — used as a directional guide, not verbatim data. Values are hand-reviewed for teachability and stored in editable JSON.

---

## 13. Success Criteria

We will consider the MVP successful when a new player can:

1. Name and identify the four MVP offensive formations and four defensive formations on sight.
2. Explain, in their own words, what each position is responsible for on a basic run and a basic pass.
3. Justify a play call using down, distance, and the opposing formation.
4. Understand that a good call can lose and a bad call can win, and articulate why.

If a player finishes ten drives and still can't do (4), the design has failed at its main goal, regardless of how polished the rest is.
