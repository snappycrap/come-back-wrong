// Headless balance check: plays runs with the autoplay bot (no graphics) and
// prints how each one went. Usage: npm run sim -- [runs] [firstSeed]
import { Game } from '../src/game/game.ts';
import { botChoice, botInput } from '../src/game/autoplay.ts';

const args = (globalThis as unknown as { process: { argv: string[] } }).process.argv.slice(2);
const runs = Number(args[0] ?? 10);
const first = Number(args[1] ?? 1);

let totalLives = 0;
let totalSeconds = 0;
let wins = 0;
for (let seed = first; seed < first + runs; seed++) {
  const g = new Game(seed);
  g.emitFx = false;
  let steps = 0;
  while (!g.result && steps++ < 60 * 400) {
    if (g.choices) g.chooseUpgrade(botChoice());
    g.step(botInput(g));
  }
  const r = g.result;
  if (!r) {
    console.log(`seed ${seed}: did not finish`);
    continue;
  }
  if (r.won) wins++;
  const lives = r.lives.map((l) => `${l.body} ${l.seconds.toFixed(0)}s`).join(', ');
  for (const l of r.lives) {
    totalLives++;
    totalSeconds += l.seconds;
  }
  console.log(
    `seed ${seed}: ${r.won ? 'WON ' : 'lost'} at ${r.time.toFixed(0)}s, level ${g.level}, kills ${r.kills}, ` +
      `rebirths ${g.stats.rebirths} | ${lives}`,
  );
}
console.log(`wins ${wins}/${runs}, average life ${(totalSeconds / Math.max(1, totalLives)).toFixed(1)}s`);
