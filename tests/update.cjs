const assert=require('node:assert/strict');
const fs=require('node:fs');
const puppeteer=require(process.env.PUPPETEER_PATH||'puppeteer');
(async()=>{
 const originalSW=fs.readFileSync('sw.js','utf8'),originalCSS=fs.readFileSync('css/style.css','utf8');
 const version=originalSW.match(/seibun-notebook-(v[\w.]+)/)[1];
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox'],userDataDir:'/private/tmp/seibun-update-profile'});
 try{
  const page=await browser.newPage();page.on('console',m=>console.log('console',m.text()));page.on('pageerror',e=>console.log('error',e.message));await page.goto('http://127.0.0.1:8765');await page.waitForSelector('h1');await page.evaluate(async()=>navigator.serviceWorker.ready);await page.reload();await page.waitForSelector('h1');
  await page.setViewport({width:1280,height:900});for(const route of ['home','ingredients','comparisons','mocks']){await page.evaluate(r=>location.hash=r,route);await page.waitForFunction(r=>document.title.startsWith(r),{},({home:'ホーム',ingredients:'成分まとめ',comparisons:'比較',mocks:'模試記録'})[route]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=1280),true);}
  await new Promise(r=>setTimeout(r,1200));fs.writeFileSync('css/style.css',originalCSS+'\n:root{--test-update:updated}\n');fs.writeFileSync('sw.js',originalSW.replace(version,version+'-test'));
  const navigation=page.waitForNavigation({waitUntil:'load'});await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();}).catch(e=>{if(!e.message.includes('Execution context was destroyed'))throw e;});await navigation;console.log('navigated');await page.waitForSelector('h1');await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--test-update').trim()==='updated');
  const caches=await page.evaluate(()=>window.caches.keys());assert.ok(caches.includes('public-seibun-notebook-'+version+'-test'));assert.ok(!caches.includes('public-seibun-notebook-'+version));console.log('PASS: デスクトップ幅・新バージョン自動更新と再読み込み・古い公開キャッシュ削除');
 }finally{fs.writeFileSync('sw.js',originalSW);fs.writeFileSync('css/style.css',originalCSS);await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
