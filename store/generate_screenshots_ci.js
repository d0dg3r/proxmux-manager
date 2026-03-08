const playwright = require('playwright');
const path = require('path');

(async () => {
  const browser = await playwright.chromium.launch();
  const mockPath = 'file://' + path.resolve(__dirname, 'mock/mock.html');
  const storeDir = path.resolve(__dirname);

  const sunPath = 'M12,7c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5S14.76,7,12,7L12,7z M2,13l2,0c0.55,0,1-0.45,1-1s-0.45-1-1-1l-2,0 c-0.55,0-1,0.45-1,1S1.45,13,2,13z M20,13l2,0c0.55,0,1-0.45,1-1s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S19.45,13,20,13z M11,2l0,2 c0,0.55,0.45,1,1,1s1-0.45,1-1l0-2c0-0.55-0.45-1-1-1S11,1.45,11,2z M11,20l0,2c0,0.55,0.45,1,1,1s1-0.45,1-1l0-2 c0-0.55-0.45-1-1-1S11,19.45,11,20z M5.99,4.58c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06 c0.39,0.39,1.03,0.39,1.41,0s0.39-1.03,0-1.41L5.99,4.58z M18.36,16.95c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41 l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0c0.39-0.39,0.39-1.03,0-1.41L18.36,16.95z M5.99,19.42c0.39,0.39,1.03,0.39,1.41,0 c0.39-0.39,0.39-1.03,0-1.41l-1.06-1.06c-0.39-0.39-1.03-0.39-1.41,0s-0.39,1.03,0,1.41L5.99,19.42z M18.36,7.05 c0.39,0.39,1.03,0.39,1.41,0c0.39-0.39,0.39-1.03,0-1.41l-1.06-1.06c-0.39-0.39-1.03-0.39-1.41,0s-0.39,1.03,0,1.41L18.36,7.05z';
  const moonPath = 'M9,2c-1.05,0-2.05,0.16-3,0.46c4.06,1.27,7,5.06,7,9.54s-2.94,8.27-7,9.54C6.95,21.84,7.95,22,9,22c5.52,0,10-4.48,10-10S14.52,2,9,2z';
  const sizes = [
    { width: 1280, height: 800, suffix: '' },
    { width: 640, height: 400, suffix: '_640x400' }
  ];

  for (const size of sizes) {
    const darkContext = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1,
      colorScheme: 'dark'
    });
    const darkPage = await darkContext.newPage();
    await darkPage.goto(mockPath);
    await darkPage.evaluate(() => {
      const panel = document.getElementById('collapsible-filters');
      const toggle = document.getElementById('filter-toggle-btn');
      if (panel && !panel.classList.contains('collapsed')) panel.classList.add('collapsed');
      if (toggle) toggle.classList.remove('active');
      const main = document.querySelector('main');
      if (main) main.scrollTop = 0;
    });
    await darkPage.evaluate((iconPath) => {
      document.querySelector('#theme-toggle-btn svg').innerHTML = `<path fill="currentColor" d="${iconPath}"/>`;
    }, sunPath);
    await darkPage.waitForTimeout(400);
    const darkFile = `screenshot_dark${size.suffix}.png`;
    await darkPage.screenshot({ path: path.join(storeDir, darkFile) });
    console.log(`Saved ${darkFile} (${size.width}x${size.height}, PNG)`);
    await darkContext.close();

    const lightContext = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1,
      colorScheme: 'light'
    });
    const lightPage = await lightContext.newPage();
    await lightPage.goto(mockPath);
    await lightPage.evaluate(() => {
      const panel = document.getElementById('collapsible-filters');
      const toggle = document.getElementById('filter-toggle-btn');
      if (panel && !panel.classList.contains('collapsed')) panel.classList.add('collapsed');
      if (toggle) toggle.classList.remove('active');
      const main = document.querySelector('main');
      if (main) main.scrollTop = 0;
    });
    await lightPage.evaluate((iconPath) => {
      document.querySelector('#theme-toggle-btn svg').innerHTML = `<path fill="currentColor" d="${iconPath}"/>`;
    }, moonPath);
    await lightPage.waitForTimeout(400);
    const lightFile = `screenshot_light${size.suffix}.png`;
    await lightPage.screenshot({ path: path.join(storeDir, lightFile) });
    console.log(`Saved ${lightFile} (${size.width}x${size.height}, PNG)`);
    await lightContext.close();
  }

  await browser.close();
})();

