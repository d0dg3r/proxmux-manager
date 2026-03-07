const playwright = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await playwright.chromium.launch();
  
  const mockPath = 'file://' + path.resolve(__dirname, 'mock/mock.html');
  const storeDir = path.resolve(__dirname);

  // 1. Capture Dark Mode
  const darkContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'dark'
  });
  const darkPage = await darkContext.newPage();
  await darkPage.goto(mockPath);
  await darkPage.waitForTimeout(1000);
  await darkPage.screenshot({ 
    path: path.join(storeDir, 'screenshot_dark.jpg'),
    type: 'jpeg',
    quality: 90
  });
  console.log('Saved screenshot_dark.jpg (1280x800, JPEG)');
  await darkContext.close();

  // 2. Capture Light Mode
  const lightContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'light'
  });
  const lightPage = await lightContext.newPage();
  await lightPage.goto(mockPath);
  await lightPage.waitForTimeout(1000);
  await lightPage.screenshot({ 
    path: path.join(storeDir, 'screenshot_light.jpg'),
    type: 'jpeg',
    quality: 90
  });
  console.log('Saved screenshot_light.jpg (1280x800, JPEG)');
  await lightContext.close();

  await browser.close();
})();
