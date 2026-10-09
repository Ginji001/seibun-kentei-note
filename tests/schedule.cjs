const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const d=await import('../js/domain.js'), schedule=JSON.parse(fs.readFileSync('data/schedule.json')),exam=JSON.parse(fs.readFileSync('data/exam.json'));
 const original=JSON.stringify(schedule);
 for(const start of ['2026-10-01','2026-09-17','2026-10-22','2026-11-27']){
  const s=d.reschedule(schedule,exam,start), periods=[...s.weeks,...s.blocks],unique=[...new Map(periods.map(p=>[p.start+':'+p.end,p])).values()];
  assert.equal(unique[0].start,start);
  unique.forEach((p,i)=>{assert.ok(p.start<=p.end);assert.equal(d.shiftDate(p.end,1),unique[i+1]?.start||s.days[0].date);});
  s.days.forEach((p,i)=>assert.equal(d.daysUntil(p.date,exam.exam_date),d.daysUntil(schedule.days[i].date,exam.exam_date)));
  for(let date=start;date<=exam.exam_date;date=d.shiftDate(date,1)){assert.equal(d.currentPlan(s,date)?.start<=date,true);assert.equal(d.daysUntil(date,exam.exam_date),Math.round((Date.parse(exam.exam_date)-Date.parse(date))/86400000));}
  s.weeks.forEach((p,i)=>assert.equal(p.sessions,Math.max(1,Math.min(7,Math.round(schedule.weeks[i].sessions*(d.daysUntil(p.start,p.end)+1)/(d.daysUntil(schedule.weeks[i].start,schedule.weeks[i].end)+1))))));
  assert.deepEqual(periods.map(p=>p.id),[...schedule.weeks,...schedule.blocks].map(p=>p.id));
  assert.equal(s.phases[0].start,start);assert.equal(s.phases.at(-1).end,exam.exam_date);
  assert.deepEqual(s.progress_chart_targets.map(t=>t.date),[s.blocks[1].end,s.blocks[2].end,s.blocks[2].end,s.blocks[3].end,s.blocks[4].end]);
 }
 assert.deepEqual(d.reschedule(schedule,exam,exam.study_start).weeks,schedule.weeks);
 const parallel=structuredClone(schedule);parallel.blocks.push({...parallel.blocks[0],id:'parallel'});
 const ps=d.reschedule(parallel,exam,'2026-10-22');assert.equal(ps.blocks[0].start,ps.blocks.at(-1).start);assert.equal(ps.blocks[0].end,ps.blocks.at(-1).end);
 for(const date of ['2026-12-13','2026-12-14','2026-02-30','', '2026-11-28'])assert.ok(d.startValidation(date,exam,schedule).error);
 assert.ok(d.startValidation('2026-11-10',exam,schedule).warning);assert.equal(d.startValidation('2026-10-22',exam,schedule).warning,'');
 assert.equal(JSON.stringify(schedule),original);console.log('schedule: all assertions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
