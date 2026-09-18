import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
await page.goto('http://localhost:3000');await page.waitForTimeout(900);await page.screenshot({path:'artifacts/company-desktop.png',fullPage:true});
await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:3000/arjun-devireddy');await page.waitForTimeout(700);await page.screenshot({path:'artifacts/profile-mobile.png',fullPage:true});
await browser.close();
