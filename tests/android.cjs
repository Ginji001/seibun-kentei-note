const assert = require('node:assert/strict');
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
 const profile = require('node:fs').mkdtempSync('/private/tmp/seibun-android-');
 const context = await chromium.launchPersistentContext(profile, { executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'], ...devices['Pixel 7'], viewport: {width:412,height:915} });
 const browser = context.browser();
 try {

 const page = await context.newPage();
 const errors = [];
 page.on('pageerror', e => errors.push(e.message));
 page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
 const url = process.env.TEST_URL || 'http://127.0.0.1:8766';
 await page.goto(url); await page.waitForSelector('h1');
 await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForSelector('h1');
 const cdp = await context.newCDPSession(page);
 const manifest = await cdp.send('Page.getAppManifest');
 assert.equal(manifest.errors.length, 0); const m = JSON.parse(manifest.data);
 assert.equal(m.id, './'); assert.equal(m.icons.filter(i=>i.purpose==='any').length, 2);
 assert.equal(m.icons.filter(i=>i.purpose==='maskable').length, 2);
 const installability = await cdp.send('Page.getInstallabilityErrors');
 assert.deepEqual(installability.installabilityErrors, []);
 console.log('Chrome', await browser.version(), 'manifest errors', manifest.errors, 'installability', installability);
 assert.equal(await page.locator('meta[name=theme-color]').getAttribute('content'), m.theme_color);
 const routes = ['home','plan','plan/W1','problems','summary','ingredients','comparisons','law','analysis','mocks','memorize','mistakes','other','settings'];
 async function route(r) { await page.evaluate(r=>location.hash=r, r); await page.waitForFunction(r=>document.title.startsWith(r), ({home:'ホーム',plan:'計画',problems:'問題記録',summary:'まとめ・比較',ingredients:'成分まとめ',comparisons:'比較',law:'法規・関連用語',analysis:'全成分表示分析',mocks:'模試記録',memorize:'直前暗記',mistakes:'間違いノート',other:'その他',settings:'設定'})[r.split('/')[0]]); }
 for (const r of routes) { await route(r); await page.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true)); assert.ok(await page.locator('h1').isVisible()); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),r); }
 await route('home'); await route('plan'); await route('plan/W1'); await page.goBack(); await page.waitForFunction(()=>location.hash==='#plan'); await page.goBack(); await page.waitForFunction(()=>location.hash==='#home');
 for (const height of [700,915]) { await page.setViewportSize({width:412,height}); assert.ok(await page.evaluate(()=>parseFloat(getComputedStyle(document.body).minHeight)===innerHeight)); const tabs=await page.locator('#tabs').boundingBox(); assert.equal(Math.round(tabs.y+tabs.height),height); }
 await route('plan/W1'); await page.locator('[data-note="W1:explain"]').fill('Android保存確認'); await page.locator('h1').click(); await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('保存しました')); await page.reload(); await page.waitForSelector('[data-note="W1:explain"]'); assert.equal(await page.locator('[data-note="W1:explain"]').inputValue(),'Android保存確認');
 const dates=await page.evaluate(async()=>{const d=await import('./js/domain.js');const schedule=await (await fetch('./data/schedule.json')).json();return Array.from({length:74},(_,i)=>{const date=new Date(Date.UTC(2026,9,1+i)).toISOString().slice(0,10);return {days:d.daysUntil(date,'2026-12-13'),plan:d.currentPlan(schedule,date)?.id};});});dates.forEach((v,i)=>{assert.equal(v.days,73-i);assert.ok(v.plan);});
 const backup=await page.evaluate(async()=>{const s=await import('./js/store.js'); return s.backup();}); await page.evaluate(async b=>{const s=await import('./js/store.js');await s.clear();await s.restore(b);},backup); assert.deepEqual(await page.evaluate(async()=> (await import('./js/store.js')).backup().then(b=>b.data)),backup.data);
 await context.setOffline(true); await page.reload(); await page.waitForSelector('h1'); for(const r of routes) await route(r);
 assert.ok(await page.evaluate(async()=>{const c=await caches.open('public-seibun-notebook-v1.2.1');return !!await c.match('icons/maskable-512.png')&&!!await c.match('icons/maskable-192.png');}));
 await context.setOffline(false);
 // Synthetic events exercise button state and one-use prompts; no OS installation is performed.
 await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled'))); assert.ok(await page.locator('#install-app').isHidden());
 const fresh=await context.newPage(); await fresh.addInitScript(()=>window.addEventListener('beforeinstallprompt',e=>e.preventDefault())); await fresh.goto(url);await fresh.waitForSelector('h1');
 await fresh.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));await fresh.reload();await fresh.waitForSelector('h1');
 await fresh.evaluate(()=>{window.promptCalls=0;const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>window.promptCalls++;e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e);});
 assert.ok(await fresh.locator('#install-app').isVisible());await fresh.locator('#install-app').click(); assert.equal(await fresh.evaluate(()=>window.promptCalls),1);assert.ok(await fresh.locator('#install-app').isHidden());
 await fresh.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));await fresh.evaluate(()=>window.dispatchEvent(new Event('beforeinstallprompt',{cancelable:true})));assert.ok(await fresh.locator('#install-app').isHidden());
 const standalone=await context.newPage();await standalone.addInitScript(()=>{const original=window.matchMedia;window.matchMedia=q=>q==='(display-mode: standalone)'?{matches:true,addEventListener(){}}:original.call(window,q);});await standalone.goto(url);await standalone.waitForSelector('h1');await standalone.evaluate(()=>window.dispatchEvent(new Event('beforeinstallprompt',{cancelable:true})));assert.ok(await standalone.locator('#install-app').isHidden());
 const iphoneContext=await browser.newContext({...devices['iPhone 13'],viewport:{width:390,height:844}});const iphone=await iphoneContext.newPage();await iphone.goto(url+'/#settings');await iphone.waitForSelector('h1');assert.ok(await iphone.locator('#app').innerText().then(t=>t.includes('Safariの共有メニュー')));assert.ok(await iphone.locator('#install-app').isHidden());for(const r of routes){await iphone.evaluate(r=>location.hash=r,r);await iphone.waitForTimeout(60);assert.ok(await iphone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),r);}
 await page.screenshot({path:'/private/tmp/seibun-android-412.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS: Android 412px 全画面・戻る・高さ・theme-color・保存/復元・オフライン・インストール状態・iPhone UA 390px案内/全画面');
 } finally { await context.close(); require("node:fs").rmSync(profile,{recursive:true,force:true}); }
})().catch(e=>{console.error(e);process.exit(1);});
