import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface State {
  mode: string;
  time: number;
  body: string;
  rebirths: number;
  levelUps: number;
  kills: number;
  enemies: number;
  ghosts: number;
  won: boolean | null;
  averageFps: number;
}

function readState(page: Page): Promise<State> {
  return page.evaluate(() => (window as unknown as { __cbw: { state(): State } }).__cbw.state());
}

test('autoplay plays a full run with a rebirth and a level-up', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/?seed=1&autoplay=1&speed=4');
  await page.waitForFunction(() => 'state' in ((window as unknown as { __cbw?: object }).__cbw ?? {}));
  await page.screenshot({ path: 'screenshots/01-start.png' });

  const shots = { rebirth: false, mid: false, late: false };
  let state = await readState(page);
  while (state.mode !== 'results') {
    await page.waitForTimeout(250);
    state = await readState(page);
    if (!shots.rebirth && state.rebirths >= 1) {
      shots.rebirth = true;
      await page.screenshot({ path: 'screenshots/02-after-first-rebirth.png' });
    }
    if (!shots.mid && state.time >= 150) {
      shots.mid = true;
      await page.screenshot({ path: 'screenshots/03-midway.png' });
    }
    if (!shots.late && state.time >= 285) {
      shots.late = true;
      await page.screenshot({ path: 'screenshots/04-late.png' });
    }
  }
  await page.screenshot({ path: 'screenshots/05-results.png' });

  console.log(
    `Run ended at ${state.time.toFixed(0)} s (${state.won ? 'won' : 'lost'}): ` +
      `${state.rebirths} rebirths, ${state.levelUps} level-ups, ${state.kills} kills, ` +
      `average ${state.averageFps.toFixed(0)} fps in the software-rendered test browser.`,
  );
  expect(errors, 'console errors during the run').toEqual([]);
  expect(state.rebirths).toBeGreaterThanOrEqual(1);
  expect(state.levelUps).toBeGreaterThanOrEqual(1);
});
