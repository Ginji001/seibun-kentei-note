const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium, devices} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const url = process.env.TEST_URL || 'http://127.0.0.1:8879';
const titles = {home:'ホーム',plan:'計画',problems:'問題記録',summary:'まとめ・比較',ingredients:'成分まとめ',comparisons:'比較',law:'法規・関連用語',analysis:'全成分表示分析',mocks:'模試記録',memorize:'直前暗記',mistakes:'間違いノート',other:'その他',settings:'設定',usage:'使い方'};
(async () => {
 for (const [device,width] of [['iPhone 13',390],['Pixel 7',412]]) {
  const profile = fs.mkdtempSync('/private/tmp/seibun-usage-');
  const context = await chromium.launchPersistentContext(profile, {executablePath:process.env.CHROME_PATH,headless:true,...devices[device],viewport:{width,height:844},timezoneId:'Asia/Tokyo',acceptDownloads:true});
  try {
   const page = await context.newPage(), errors = [];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.clock.setFixedTime(new Date('2026-10-02T03:00:00Z'));
   await page.goto(url); await page.waitForSelector('#start-onboarding');
   await page.evaluate(()=>navigator.serviceWorker.ready); await page.reload(); await page.waitForSelector('#start-onboarding');
   async function route(r) {
    await page.evaluate(r=>location.hash=r,r);
    await page.waitForFunction(({r,title})=>location.hash==='#'+r&&document.title.startsWith(title),{r,title:titles[r.split('/')[0]]});
   }
   const saved = () => page.waitForFunction(()=>document.querySelector('#status').textContent.includes('保存しました'));
   const data = () => page.evaluate(async()=> (await (await import('./js/store.js')).backup()).data);
   const persistedStart = () => page.evaluate(async()=> (await (await import('./js/store.js')).all('notes')).find(n=>n.id==='settings:study-start')?.text);
   assert.equal(await page.locator('#home-study-start').inputValue(),'2026-10-02');
   await page.locator('#start-onboarding a').click(); await page.waitForFunction(()=>document.title.startsWith('使い方'));
   assert.equal(await page.locator('#tabs [aria-current=page]').getAttribute('href'),'#other');
   await route('home'); await page.locator('#app > p a[href="#usage"]').click(); await page.waitForFunction(()=>document.title.startsWith('使い方'));
   await route('other'); await page.locator('#app a[href="#usage"]').click(); await page.waitForFunction(()=>document.title.startsWith('使い方'));
   assert.equal(await page.locator('.usage section').count(),8);
   const rules = JSON.parse(fs.readFileSync('data/rules.json','utf8'));
   const guideText = await page.locator('.usage').innerText();
   for (const s of rules.symbols) assert.ok(guideText.includes(s.meaning));
   for (const m of rules.miss_types) {assert.ok(guideText.includes(m.label));assert.ok(guideText.includes(m.action));}
   const links = await page.locator('.usage a').evaluateAll(a=>a.map(a=>a.getAttribute('href')));
   for (let i=0;i<links.length;i++) {
    await route('usage'); await page.locator('.usage a').nth(i).click();
    await page.waitForFunction(({href,title})=>location.hash===href&&document.title.startsWith(title),{href:links[i],title:titles[links[i].slice(1)]});
   }
   // Create real records before choosing a start, and ensure they survive every change.
   await route('plan/W1'); await page.locator('[data-check="W1:done"]').check(); await saved();
   await page.locator('[data-note="W1:explain"]').fill('開始日変更前のメモ'); await page.locator('h1').click(); await saved();
   await route('problems'); await page.locator('[name=problemNo]').fill('P.12 No.3'); await page.locator('[name=result]').selectOption('x'); await page.locator('[name=miss]').selectOption('A'); await page.locator('#problem-form button').click(); await saved();
   await route('settings'); await page.locator('[data-note="settings:weekly-hours"]').fill('7.5'); await page.locator('[data-note="settings:weekly-hours"]').dispatchEvent('change'); await saved(); assert.equal(await page.locator('[data-note="settings:weekly-hours"]').inputValue(),'7.5');
   const before = await data();
   await route('home'); await page.locator('#home-study-start').fill('2026-10-22');
   assert.equal(await persistedStart(),undefined); // Choosing a date alone does not save.
   await page.locator('#home-start-form button.primary').click(); await page.waitForSelector('#start-onboarding',{state:'detached'});
   assert.ok((await page.locator('.hero').innerText()).includes('開始日 2026-10-22'));
   await route('plan/W1'); assert.ok((await page.locator('#app > p').innerText()).startsWith('2026-10-22〜'));
   assert.ok(await page.locator('[data-check="W1:done"]').isChecked());
   await route('settings'); assert.equal(await page.locator('#study-start').inputValue(),'2026-10-22'); await page.reload(); await page.waitForSelector('#study-start'); assert.equal(await page.locator('[data-note="settings:weekly-hours"]').inputValue(),'7.5');
   await route('home'); await page.locator('[data-action=edit-start]').click();
   await page.locator('#home-study-start').fill('2026-11-10');
   assert.ok((await page.locator('#home-start-message').innerText()).includes('期間が短いため'));
   await page.locator('#home-start-form button.primary').click(); await page.waitForSelector('#home-study-start',{state:'detached'});
   await route('settings'); assert.equal(await page.locator('#study-start').inputValue(),'2026-11-10');
   await page.locator('#study-start').fill('2026-09-17'); await page.locator('#study-start').dispatchEvent('change'); await saved();
   await route('home'); assert.ok((await page.locator('.hero').innerText()).includes('開始日 2026-09-17')); await route('home'); assert.ok((await page.locator('#app').innerText()).includes('週7.5時間'));
   await page.locator('[data-action=edit-start]').click();
   for (const invalid of ['', '2026-12-13','2026-12-14','2026-11-28']) {
    await page.locator('#home-study-start').fill(invalid); await page.locator('#home-start-form button.primary').click();
    assert.equal(await persistedStart(),'2026-09-17'); assert.ok(await page.locator('#home-study-start').evaluate(e=>!e.checkValidity()));
   }
   await page.locator('#home-study-start').fill('2026-10-01'); await page.locator('#home-start-form button.primary').click(); await page.waitForSelector('#home-study-start',{state:'detached'});
   await page.reload(); await page.waitForSelector('.hero'); assert.equal(await page.locator('#start-onboarding').count(),0);
   const after = await data(); after.notes=after.notes.filter(n=>n.id!=='settings:study-start'); assert.deepEqual(after,before);
   // Actual UI export/import restores all stores, including the shared start date.
   await route('settings'); const downloadPromise=page.waitForEvent('download'); await page.locator('[data-action=export]').click();
   const download=await downloadPromise, file=profile+'/backup.json'; await download.saveAs(file);
   const backup=JSON.parse(fs.readFileSync(file,'utf8'));
   await page.locator('#study-start').fill('2026-10-22'); await page.locator('#study-start').dispatchEvent('change'); await saved();
   page.once('dialog',d=>d.accept()); await page.locator('#import').setInputFiles(file); await page.waitForFunction(()=>document.querySelector('#status').textContent==='バックアップを復元しました');
   assert.deepEqual(await data(),backup.data);
   await route('home'); assert.ok((await page.locator('.hero').innerText()).includes('開始日 2026-10-01'));
   const routes=[...Object.keys(titles),'plan/W1','plan/R2A'];
   for (const r of routes) {
    await route(r); await page.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));
    assert.ok(await page.locator('h1').isVisible()); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),device+' '+r);
   }
   await route('home'); await page.locator('[data-action=edit-start]').click(); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:'/private/tmp/seibun-start-editor-'+width+'.png',fullPage:true});
   await route('usage'); await page.screenshot({path:'/private/tmp/seibun-usage-'+width+'.png',fullPage:true});
   // Existing installation event handling is retained.
   await page.evaluate(()=>{window.promptCalls=0;const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>window.promptCalls++;event.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(event);});
   await page.locator('#install-app').click(); assert.equal(await page.evaluate(()=>window.promptCalls),1); assert.ok(await page.locator('#install-app').isHidden());
   await context.setOffline(true); await page.reload(); await page.waitForSelector('.usage');
   for (const r of routes) await route(r);
   await route('home'); await page.locator('[data-action=edit-start]').click(); await page.locator('#home-study-start').fill('2026-10-22'); await page.locator('#home-start-form button.primary').click(); await page.waitForSelector('#home-study-start',{state:'detached'});
   await page.reload(); await page.waitForSelector('.hero'); assert.ok((await page.locator('.hero').innerText()).includes('開始日 2026-10-22'));
   assert.ok((await page.evaluate(()=>caches.keys())).includes('public-seibun-notebook-v1.2.1'));
   // First-start defaults at/on/after the exam use the original JSON date.
   for (const date of ['2026-12-12','2026-12-13','2026-12-14']) {
    await page.evaluate(async date=>{const s=await import('./js/store.js');await s.remove('notes','settings:study-start');await s.put('notes',{id:'settings:date',text:date});},date);
    await page.reload(); await page.waitForSelector('#start-onboarding'); assert.equal(await page.locator('#home-study-start').inputValue(),date<'2026-12-13'?date:'2026-10-01');
   }
   assert.deepEqual(errors,[]);
   console.log(`${device} ${width}px: 初回・開始日同期/検証・既存記録保持・使い方${links.length}リンク・全画面・実ファイル復元・オフライン PASS`);
  } finally {await context.close();fs.rmSync(profile,{recursive:true,force:true});}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
