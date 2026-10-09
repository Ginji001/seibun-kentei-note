const assert=require('node:assert/strict');
const {chromium,devices}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{
 for(const [device,width] of [['iPhone 13',390],['Pixel 7',412]]){
 const context=await chromium.launchPersistentContext(require('node:fs').mkdtempSync('/private/tmp/seibun-start-'),{executablePath:process.env.CHROME_PATH,headless:true,...devices[device],viewport:{width,height:844}});
 try{
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:8878');await page.waitForSelector('h1');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForSelector('h1');
 async function route(r){await page.evaluate(r=>location.hash=r,r);await page.waitForFunction(r=>location.hash==='#'+r&&document.title.startsWith(({home:'ホーム',plan:'計画',problems:'問題記録',summary:'まとめ・比較',ingredients:'成分まとめ',comparisons:'比較',law:'法規',analysis:'全成分',mocks:'模試',memorize:'直前',mistakes:'間違い',other:'その他',settings:'設定'})[r.split('/')[0]]),r);}
 async function setStart(value){await route('settings');await page.locator('#study-start').fill(value);await page.locator('#study-start').dispatchEvent('change');await page.waitForFunction(v=>document.querySelector('#study-start')?.value===v&&document.querySelector('#status').textContent.includes('保存しました'),value);}
 await route('plan/W1');await page.locator('[data-check="W1:done"]').check();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('保存しました'));
 await route('plan/R2A');await page.locator('[data-check="R2A:done"]').check();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('保存しました'));
 const routes=['home','plan','plan/W1','plan/R2A','problems','summary','ingredients','comparisons','law','analysis','mocks','memorize','mistakes','other','settings'];
 for(const start of ['2026-10-01','2026-09-17','2026-10-22']){
 await setStart(start);await page.reload();await page.waitForSelector('#study-start');assert.equal(await page.locator('#study-start').inputValue(),start);
 for(const r of routes){await route(r);await page.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));assert.ok(await page.locator('h1').isVisible());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),device+' '+r);}
 await route('home');assert.ok((await page.locator('#app').innerText()).includes('学習開始 '+start));
 await route('plan/W1');assert.ok(await page.locator('[data-check="W1:done"]').isChecked());await route('plan/R2A');assert.ok(await page.locator('[data-check="R2A:done"]').isChecked());
 }
 await route('settings');for(const date of ['2026-12-13','2026-12-14']){await page.locator('#study-start').fill(date);await page.locator('#study-start').dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('#study-start-message').textContent.includes('試験日より前'));assert.equal(await page.evaluate(async()=> (await (await import('./js/store.js')).all('notes')).find(n=>n.id==='settings:study-start').text),'2026-10-22');}
 await setStart('2026-11-10');assert.ok((await page.locator('#study-start-message').innerText()).includes('期間が短いため1日あたりの量が増えます'));
 await page.locator('[data-action="reset-start"]').click();await page.waitForFunction(()=>document.querySelector('#study-start').value==='2026-10-01');
 await setStart('2026-10-22');
 const backup=await page.evaluate(async()=> (await import('./js/store.js')).backup());await page.evaluate(async b=>{const s=await import('./js/store.js');await s.clear();await s.restore(b);},backup);await page.reload();await page.waitForSelector('#study-start');assert.equal(await page.locator('#study-start').inputValue(),'2026-10-22');assert.deepEqual(await page.evaluate(async()=> (await (await import('./js/store.js')).backup()).data),backup.data);
 await page.locator('[data-note="settings:date"]').fill('2026-10-22');await page.locator('[data-note="settings:date"]').dispatchEvent('change');await route('home');assert.ok((await page.locator('#app').innerText()).includes('水性成分①'));assert.equal(await page.locator('.number').innerText(),'52');
 await context.setOffline(true);await page.reload();await page.waitForSelector('h1');for(const r of routes)await route(r);await setStart('2026-09-17');await page.reload();await page.waitForSelector('#study-start');assert.equal(await page.locator('#study-start').inputValue(),'2026-09-17');
 assert.deepEqual(errors,[]);console.log(device,width,'all screens, persistence, validation, backup, offline: PASS');
 }finally{await context.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
