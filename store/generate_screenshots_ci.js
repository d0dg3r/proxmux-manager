const playwright = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await playwright.chromium.launch();
  
  const mockPath = 'file://' + path.resolve(__dirname, 'mock/mock.html');
  const storeDir = path.resolve(__dirname);

  const sunPath = 'M12,7c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5S14.76,7,12,7L12,7z M2,13l2,0c0.55,0,1-0.45,1-1s-0.45-1-1-1l-2,0 c-0.55,0-1,0.45-1,1S1.45,13,2,13z M20,13l2,0c0.55,0,1-0.45,1-1s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S19.45,13,20,13z M11,2l0,2 c0,0.55,0.45,1,1,1s1-0.45,1-1l0-2c0-0.55-0.45-1-1-1S11,1.45,11,2z M11,20l0,2c0,0.55,0.45,1,1,1s1-0.45,1-1l0-2 c0-0.55-0.45-1-1-1S11,19.45,11,20z M5.99,4.58c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06 c0.39,0.39,1.03,0.39,1.41,0s0.39-1.03,0-1.41L5.99,4.58z M18.36,16.95c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41 l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0c0.39-0.39,0.39-1.03,0-1.41L18.36,16.95z M5.99,19.42c0.39,0.39,1.03,0.39,1.41,0 c0.39-0.39,0.39-1.03,0-1.41l-1.06-1.06c-0.39-0.39-1.03-0.39-1.41,0s-0.39,1.03,0,1.41L5.99,19.42z M18.36,7.05 c0.39,0.39,1.03,0.39,1.41,0c0.39-0.39,0.39-1.03,0-1.41l-1.06-1.06c-0.39-0.39-1.03-0.39-1.41,0s-0.39,1.03,0,1.41L18.36,7.05z';
  const moonPath = 'M9,2c-1.05,0-2.05,0.16-3,0.46c4.06,1.27,7,5.06,7,9.54s-2.94,8.27-7,9.54C6.95,21.84,7.95,22,9,22c5.52,0,10-4.48,10-10S14.52,2,9,2z';

  // 1. Capture Dark Mode
  const darkContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'dark'
  });
  const darkPage = await darkContext.newPage();
  await darkPage.goto(mockPath);
  
  // Inject Sun icon for Dark Mode (Action to go light)
  await darkPage.evaluate((path) => {
    const icon = document.querySelector('#theme-toggle-btn svg p');
    if (!icon) {
        document.querySelector('#theme-toggle-btn svg').innerHTML = `<path fill="currentColor" d="${path}"/>`;
    }
  }, sunPath);

  await darkPage.waitForTimeout(1000);
  await darkPage.screenshot({ 
    path: path.join(storeDir, 'screenshot_dark.png')
  });
  console.log('Saved screenshot_dark.png (1280x800, PNG)');
  await darkContext.close();

  // 2. Capture Light Mode
  const lightContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'light'
  });
  const lightPage = await lightContext.newPage();
  await lightPage.goto(mockPath);

  // Inject Moon icon for Light Mode (Action to go dark)
  await lightPage.evaluate((path) => {
    document.querySelector('#theme-toggle-btn svg').innerHTML = `<path fill="currentColor" d="${path}"/>`;
  }, moonPath);

  await lightPage.waitForTimeout(1000);
  await lightPage.screenshot({ 
    path: path.join(storeDir, 'screenshot_light.png')
  });
  console.log('Saved screenshot_light.png (1280x800, PNG)');
  await lightContext.close();

  await browser.close();
})();

