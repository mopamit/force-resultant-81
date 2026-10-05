const { chromium } = require('/Users/eyalezra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const BASE = process.env.APP_URL || 'http://127.0.0.1:8766';

async function setForce(page, id, value) {
  await page.locator(`#${id}Input`).evaluate((element, nextValue) => {
    element.value = String(nextValue);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function solve(page, values, final = false) {
  for (const [key, value] of Object.entries(values)) await setForce(page, key, value);
  await page.getByRole('button', { name: 'בדיקת המשימה' }).click();
  await page.locator('.mission-feedback.good').waitFor();
  await page.getByRole('button', { name: final ? 'לסיכום' : 'למשימה הבאה' }).click();
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/private/tmp/force-prisma-start.png', fullPage: true });
  if (await page.title() !== 'כוח בתנועה | פריזמה') throw new Error('Unexpected document title');

  const logoBox = await page.locator('.logo').boundingBox();
  const actionBox = await page.locator('.top-actions').boundingBox();
  if (!logoBox || !actionBox || logoBox.x >= actionBox.x) throw new Error('Header sides are reversed');

  await page.getByRole('button', { name: /מתחילים באתגר/ }).click();
  await page.locator('#labScreen.is-active').waitFor();
  const sliderDirection = await page.locator('#appliedInput').evaluate((element) => getComputedStyle(element).direction);
  if (sliderDirection !== 'ltr') throw new Error(`Applied-force slider direction should be ltr, received ${sliderDirection}`);
  const sliderBox = await page.locator('#appliedInput').boundingBox();
  if (!sliderBox) throw new Error('Applied-force slider is not visible');
  await page.mouse.click(sliderBox.x + sliderBox.width * 0.9, sliderBox.y + sliderBox.height / 2);
  if (Number(await page.locator('#appliedInput').inputValue()) <= 0) throw new Error('Right side of slider must produce a positive force');
  await page.mouse.click(sliderBox.x + sliderBox.width * 0.1, sliderBox.y + sliderBox.height / 2);
  if (Number(await page.locator('#appliedInput').inputValue()) >= 0) throw new Error('Left side of slider must produce a negative force');
  await page.getByRole('button', { name: 'איפוס הכוחות' }).click();
  await page.screenshot({ path: '/private/tmp/force-prisma-mission.png', fullPage: true });
  for (const [key,value] of Object.entries({applied:110,friction:70,normal:120,weight:10})) await setForce(page,key,value);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/private/tmp/force-prisma-extreme.png', fullPage: true });
  await solve(page, { applied: 60, friction: -60, normal: 80, weight: 80 });
  await solve(page, { applied: 80, friction: -40, normal: 90, weight: 90 });
  await solve(page, { applied: -70, friction: 40, normal: 60, weight: 60 });
  await solve(page, { applied: 70, friction: -70, normal: 100, weight: 100 });
  await solve(page, { applied: 100, friction: -80, normal: 60, weight: 60 }, true);
  await page.locator('#endScreen.is-active').waitFor();
  if (await page.locator('#finalScore').textContent() !== '100') throw new Error('Final score should be 100');
  await page.screenshot({ path: '/private/tmp/force-prisma-end.png', fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  mobile.on('pageerror', (error) => errors.push(error.message));
  await mobile.goto(BASE, { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: '/private/tmp/force-prisma-mobile-start.png', fullPage: true });
  await mobile.getByRole('button', { name: 'כניסה למעבדה חופשית' }).click();
  await mobile.locator('#labScreen.is-active').waitFor();
  await mobile.screenshot({ path: '/private/tmp/force-prisma-mobile-lab.png', fullPage: true });
  const bodyWidth = await mobile.locator('body').evaluate((element) => element.scrollWidth);
  if (bodyWidth > 392) throw new Error(`Mobile horizontal overflow: ${bodyWidth}px`);

  await browser.close();
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
  console.log('Browser smoke passed: desktop flow, five missions, score, header placement and mobile layout.');
})().catch((error) => { console.error(error); process.exit(1); });
