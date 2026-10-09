export function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function daysUntil(date,exam){return Math.round((Date.parse(exam+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000);}
export function currentPlan(schedule,date){return [...schedule.weeks,...schedule.blocks,...schedule.days.map(d=>({...d,id:d.date,title:d.task,start:d.date,end:d.date}))].find(p=>p.start<=date&&date<=p.end);}
export function stats(attempts){const total=attempts.length;const o=attempts.filter(a=>a.result==='o').length,t=attempts.filter(a=>a.result==='t').length;return {total,o,t,x:total-o-t,accuracy:total?(o+t)/total:null,explained:total?o/total:null};}
export const important=p=>p.attempts.filter(a=>a.result==='x').length>=2;

// UTC day arithmetic avoids DST differences on Safari and Android.
export const shiftDate=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
const duration=p=>daysUntil(p.start,p.end)+1;
function periods(schedule){return [...new Map([...schedule.weeks,...schedule.blocks].map(p=>[p.start+':'+p.end,p])).values()].sort((a,b)=>a.start.localeCompare(b.start));}
export function startValidation(start,exam,schedule){
 const valid=/^\d{4}-\d{2}-\d{2}$/.test(start)&&Number.isFinite(Date.parse(start+'T00:00:00Z'))&&shiftDate(start,0)===start;
 if(!valid)return {error:'学習開始日を入力してください'};
 if(start>=exam.exam_date)return {error:'学習開始日は試験日より前にしてください'};
 const first=schedule.days[0].date;
 const available=daysUntil(start,first);
 if(available<periods(schedule).length)return {error:`各期間を最低1日確保するため、学習開始日は${shiftDate(first,-periods(schedule).length)}以前にしてください`};
 return {warning:daysUntil(start,exam.exam_date)<daysUntil(exam.study_start,exam.exam_date)*.5?'期間が短いため1日あたりの量が増えます':''};
}
export function reschedule(schedule,exam,start){
 const validation=startValidation(start,exam,schedule);
 if(validation.error)throw Error(validation.error);
 const groups=periods(schedule),total=groups.reduce((n,p)=>n+duration(p),0),available=daysUntil(start,schedule.days[0].date);
 const sizes=groups.map(p=>Math.max(1,Math.floor(available*duration(p)/total)));
 // Reserve one day per period, then give rounding residue to later periods.
 let difference=available-sizes.reduce((a,b)=>a+b,0);
 for(let i=sizes.length-1;difference<0;i=(i-1+sizes.length)%sizes.length)if(sizes[i]>1){sizes[i]--;difference++;}
 for(let i=sizes.length-1;difference>0;i=(i-1+sizes.length)%sizes.length){sizes[i]++;difference--;}
 const ranges=new Map();let cursor=start;
 groups.forEach((p,i)=>{ranges.set(p.start+':'+p.end,{start:cursor,end:shiftDate(cursor,sizes[i]-1)});cursor=shiftDate(cursor,sizes[i]);});
 const remap=p=>{const range=ranges.get(p.start+':'+p.end);return {...p,...range,...(p.sessions?{sessions:Math.max(1,Math.min(7,Math.round(p.sessions*duration(range)/duration(p))))}:{})};};
 const mapDate=date=>{const p=groups.find(p=>p.start<=date&&date<=p.end);if(!p)return date;const r=ranges.get(p.start+':'+p.end);return shiftDate(r.start,Math.min(duration(r)-1,Math.floor(daysUntil(p.start,date)*duration(r)/duration(p))));};
 const blocks=schedule.blocks.map(remap);
 const targetIds=['R2B','R3M1','R3M1','M2','M3'];
 return {...schedule,weeks:schedule.weeks.map(remap),blocks,days:schedule.days.map(d=>({...d,date:shiftDate(exam.exam_date,-daysUntil(d.date,exam.exam_date))})),phases:schedule.phases.map(p=>({...p,start:mapDate(p.start),end:mapDate(p.end)})),progress_chart_targets:schedule.progress_chart_targets.map((t,i)=>({...t,date:blocks.find(b=>b.id===targetIds[i])?.end||mapDate(t.date)}))};
}
