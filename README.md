# Come Back Wrong

Milestone 1 prototype: a 5-minute playable run of a 3D third-person survivors-like where dying is not losing. You are one soul living several lives. Each death spins a wheel and brings you back on the spot as a different creature, and the body you lost stays beside you as a ghost.

Built with TypeScript, Three.js and Vite. Everything you see is made from primitives in code; there are no art, model, texture or audio files.

## How to run

You need Node.js once. If you are not sure you have it:

1. Go to <https://nodejs.org>, download the **LTS** installer for Windows and run it with the default options.
2. Download this project (on GitHub: **Code → Download ZIP**) and unzip it.
3. Open the unzipped folder in File Explorer, click the address bar, type `cmd` and press Enter. A black command window opens in that folder.

Then, in that window:

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:5173> in Chrome or Edge and press **Begin**. Leave the command window open while you play; close it (or press Ctrl+C in it) to stop.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Runs the automated checks (about 90 seconds). The first time, it downloads a test browser. |
| `npm run build` | Type-checks and builds the game into `dist/`. |
| `npm run sim -- 20` | Plays 20 runs with the bot, without graphics, and prints how long each life lasted. Used for balancing. |

## Controls

| Input | Action |
|---|---|
| W A S D | Move, relative to the camera |
| Mouse | Turn the camera (click the game if the mouse is not captured) |
| Mouse wheel | Zoom between 6 and 14 m |
| Space | The current body's movement ability (can be held) |
| Hold E for 1 second | Let go: die on purpose. Disabled on the Last-chance level |
| Esc | Pause |
| 1 / 2 / 3 or click | Pick a soul upgrade |
| Enter | Begin / play again |

## The rules in short

- Bodies sit on a ladder: **Noble** (Stag), **Common** (Ram, Wolf), **Humble** (Frog, Hen), **Last chance** (Stone). A run starts on Common.
- **Life score** = seconds lived in this body + 5 for each elite killed during it. On death: 75 or more goes up a level, 30 to 74 stays, under 30 goes down.
- On the Last-chance level, dying ends the run; surviving 45 seconds promotes you.
- Each rebirth: 1.5 s of slow motion while the wheel spins, full health, a 10 m shockwave for 20 damage, and 2 s of invulnerability. The old body becomes a ghost that attacks at 40% damage. Five ghosts at most.
- Enemies drop experience. A level-up pauses the game and offers 3 of 8 soul upgrades, which last the whole run.
- Survive to 5:00 to win.

## Debug tools

| Key | Effect |
|---|---|
| F3 | Stats overlay: frame rate, time spent on game logic and drawing, enemy count, draw calls, seed |
| K | Kill the player |
| L | Level up |
| B | Switch to the next body (no rebirth) |
| G | Add a ghost of the current body |

URL parameters, for example `http://localhost:5173/?seed=7&speed=2`:

| Parameter | Effect |
|---|---|
| `?seed=7` | Fixes the random seed, so the same inputs give the same run |
| `?speed=4` | Runs the game faster or slower (0.1 to 16) |
| `?autoplay=1` | A bot plays the run |

## Changing the game

All content is data. You can edit these files without touching any system code:

| File | Contains |
|---|---|
| `src/content/bodies.ts` | The six bodies: level, health, speed, attack, ability, colour |
| `src/content/enemies.ts` | Clerk, Courier, Auditor: health, speed, damage, spawn rule |
| `src/content/upgrades.ts` | The eight soul upgrades |
| `src/content/tuning.ts` | Everything else: arena, camera, spawn ramp, ladder thresholds, rebirth, ghosts, experience curve, palette |

Code layout: `src/game/` is the simulation (no graphics, runs headless), `src/render/` draws it with Three.js, `src/ui/` is the HUD, wheel and screens, `src/core/` holds the random number generator and spatial grid.

## Automated checks

`npm test` runs two things:

- `tests/run.spec.ts` loads `?seed=1&autoplay=1&speed=4`, plays a full run, fails on any console error, confirms at least one rebirth and one level-up, and saves screenshots to `screenshots/`.
- `tests/rules.spec.ts` checks the ladder rules directly: the 1-second let-go hold, the 30 and 75 thresholds, the elite bonus, the Last-chance rules, the ghost cap, the 20 to 300 enemy ramp, the win at 5:00, and that a seed reproduces a run.

## Measured frame rate

**Not yet measured on real graphics hardware.** The machine this was built on has no graphics card, so the browser drew everything in software. Numbers from that machine, late in a run with 300 enemies and 5 ghosts:

| Measure | Value |
|---|---|
| Game logic | about 0.15 ms per simulation step |
| The page's own drawing work | 1.0 to 1.3 ms per frame |
| Draw calls | about 100 |
| Triangles | about 35,000 |
| Frame rate in software rendering | 12 to 17 fps (says nothing about a real GPU) |

The game's own work uses under 2 ms of the 16.7 ms a 60 fps frame allows, with no real-time shadows and a pixel ratio capped at 1.5, so 60 fps on integrated graphics is expected but unconfirmed. **To measure it: play to the last minute, press F3 and note the `fps` line.**

## Decisions

Details the brief left open. Each was settled with the simplest option; all the numbers are in `src/content/`.

**Survival and damage**

- Body health: Stag 100, Ram 90, Wolf 80, Frog 70, Hen 70, Stone 120.
- One enemy can hurt you once per second. After any hit you cannot be hit again for 0.5 s, which caps how fast a crowd can drain you.
- These were tuned so a typical life lasts 45 to 60 s. Across 16 bot runs the average life was 52 s. A bot is not a person; this needs human playtesting.
- Attack damage: Stag sweep 14, Ram headbutt 16, Wolf bite 10, Frog tongue 12, Hen egg 15. Leap landing 20, Charge 18, Big jump shockwave 10.
- The rebirth shockwave always does 20 damage; damage upgrades do not change it.

**Attacks and abilities**

- Auto-attacks aim at the nearest enemy in range and wait when nothing is in range, instead of swinging at empty air. Eggs always drop.
- The Ram's headbutt is a 100-degree arc that pushes enemies 4 m.
- While leaping, big-jumping, gliding or charging, enemies cannot touch you. The Frog's ordinary hops can be hit.
- Abilities go in the direction you are moving, or the way you face if standing still.
- The Frog's hop is 3 m in 0.34 s plus a 0.12 s rest (about 6.5 m/s overall).
- Auditors resist 70% of knockback.

**Ladder and rebirth**

- Any elite that dies during a life counts toward its score, whether you or a ghost killed it.
- The Last-chance promotion uses the normal rebirth sequence (wheel, shockwave, a Stone ghost).
- The wheel shows all six bodies and lights the ones on the target level.
- During the wheel's slow motion the run clock runs at 20% speed and the life timer stops.
- A Noble life of 75 or more stays Noble and comes back as the Stag again, since it is the only Noble body.
- A Stone ghost follows you but does nothing, because the Stone has no attack.
- Ghosts circle you at about 3 m and benefit from damage and attack-speed upgrades.

**Enemies and arena**

- The horde is 75% Clerks and 25% Couriers and refills at up to 40 per second. Auditors arrive on top of the horde size.
- Enemies left more than 50 m behind are moved back into the spawn ring.
- Spawn points are kept inside the fence, so near a corner the ring is partial.
- The meadow layout is the same every run: 30 rocks and trees, none within 12 m of the start. Nothing can pass the fence.

**Growth**

- Clerks and Couriers drop 1 experience, Auditors 10. Level n+1 needs 10 + 18 × (n − 1).
- Upgrades stack without limit. The health upgrade applies to every later body too.

**Camera, HUD and input**

- The mouse turns the camera left and right only; the height angle is fixed by the 9 m back / 5 m up rule.
- The timer counts down from 5:00.
- On the Last-chance level the life meter shows the 45 s to survive.
- Releasing the mouse (Esc) pauses. A level-up releases the mouse so cards can be clicked.
- An ability chip shows the Space cooldown. This was not in the HUD list but abilities are unreadable without it.
- Debug keys are always on.

**Tech**

- One dependency beyond the brief's list: `@types/three`. Three.js ships no type definitions and strict TypeScript cannot compile without them. It adds no code to the game. **This was added without asking first; say if you want it handled differently.**
- Playwright is pinned to 1.63.0.
- No sound at all; audio is a later milestone.
- `npm run sim` (headless bot runs) was added as a balancing tool.

## Known problems

- **Nothing has been played by a human.** Every check so far is a bot or a script. Feel, readability and difficulty are unverified.
- **Running away is very strong.** Most bodies move 6 to 9 m/s and Clerks move 3 m/s, so a player who only runs is rarely caught. The bot that fights wins most runs; the Stag is especially safe.
- **The camera sits low for a horde game.** At 9 m back and 5 m up, enemies between you and the camera can hide your body. Zooming out helps.
- **Trees can hide the player** when you stand behind one.
- **Humble bodies die fast.** In bot runs the Frog and Hen usually last 13 to 28 s, which means a drop to the Stone. Falling tends to keep falling.
- **The Stone kills a lot** through its 10 thorn damage, since Clerks have 10 health.
- The frame rate has not been measured on a real GPU (see above).
- Some names on the wheel are upside down while it rests.
- Each ghost is about 20 draw calls. Fine at five ghosts; would need merging if the cap is raised.

## Not in this milestone

Multiplayer, story, saving, unlocks, bosses, more arenas, music and sound, gamepad support and desktop packaging are deliberately absent.
