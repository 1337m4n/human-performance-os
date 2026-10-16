import {judgmentBank} from './training-bank.js';
import {defaults,seed,today,weekStart,shiftDay,dailyTasks,sleepMinutes,reactionSummary,median,validResult,topics,languageScore,memoryScore,memoryScoringVersion,talkIntensity} from './data.js';

export const timeZones=['Asia/Shanghai','UTC','Asia/Tokyo','Europe/London','America/New_York'];
const resultKinds=['reaction','memory','language'];
const iso=()=>new Date().toISOString();
const nullable=v=>v===''||v==null?null:v;
const rating=(value,at)=>value==null?null:{value,evidence:'subjective',recordedAt:at};
const bare=r=>({id:r.id,createdAt:r.createdAt,updatedAt:r.updatedAt,revision:r.revision,deletedAt:r.deletedAt??null,source:r.source});
const dayBase=r=>({...bare(r),localDate:r.date,timeZone:r.timeZone});
const stamp=(r,source)=>({...r,id:r.id||crypto.randomUUID(),createdAt:r.createdAt||iso(),updatedAt:r.updatedAt||r.createdAt||iso(),revision:r.revision||1,deletedAt:r.deletedAt??null,source});
export function localTimeISO(date,time,timeZone) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw new Error('日期或时间格式无效。');
 const target=Date.parse(date+'T'+time+':00Z');
 if(!Number.isFinite(target)||new Date(target).toISOString().slice(0,16)!==date+'T'+time)throw new Error('日期或时间无效。');
 const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const offsets=new Set([-36,0,36].map(h=>{const t=target+h*3600000;return Date.parse(fmt.format(t).replace(' ','T')+':00Z')-t;}));
 const candidates=[...offsets].map(offset=>target-offset).filter(t=>fmt.format(t).replace(' ','T')===date+'T'+time).sort((a,b)=>a-b);
 if(!candidates.length)throw new Error('这个本地时间在所选时区不存在（夏令时切换）。请更正时间。');
 // ponytail: 夏令时重复时刻采用较早的一次；跨重复小时需用JSON中的完整时间戳补记。
 return new Date(candidates[0]).toISOString();
}
export function comparisonKey(r) {
 return [r.type,r.protocol,r.difficulty||'standard',r.device?.input||'unknown',r.device?.platform||'unknown',r.type==='memory'?r.material+':'+r.stage:r.contentVersion||r.protocol,r.type==='language'?[r.targetSeconds||90,r.scoringVersion||'self-rating',r.scoreInput||'unknown'].join(':'):r.type==='memory'?r.memoryScoringVersion||'self-check':''].join('|');
}
export function comparableRecords(records,type) {
 const rows=records.filter(r=>r.type===type&&validResult(r)&&(type!=='language'||r.structure!=null));
 const last=rows.sort((a,b)=>Date.parse(a.startedAt||a.createdAt)-Date.parse(b.startedAt||b.createdAt)).at(-1);
 return last?rows.filter(r=>comparisonKey(r)===comparisonKey(last)):[];
}
export function baselineRange(records,type) {
 const rows=comparableRecords(records.filter(r=>r.purpose==='baseline'),type);
 const days=[...new Set(rows.map(r=>r.date))];
 const values=rows.map(r=>type==='reaction'?r.summary.medianMs:type==='memory'?r.hits:r.structure).filter(v=>v!=null);
 return {n:rows.length,days:days.length,min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,established:days.length>=2&&values.length>=2};
}
export function sleepPairs(records,dates) {
 const reactions=comparableRecords(records,'reaction');
 return dates.map(date=>{
  const rs=reactions.filter(r=>r.date===date&&r.summary.medianMs!=null);
  const sleep=records.filter(r=>r.type==='sleep'&&r.sleepKind!=='nap'&&r.date===date).sort((a,b)=>Date.parse(b.wakeAt||b.createdAt)-Date.parse(a.wakeAt||a.createdAt))[0];
  const after=rs.filter(r=>!sleep?.wakeAt||Date.parse(r.startedAt||r.createdAt)>=Date.parse(sleep.wakeAt));
  if(!sleep||!after.length)return null;
  const correct=after.reduce((sum,r)=>sum+r.summary.correct,0),total=after.reduce((sum,r)=>sum+r.summary.total,0);
  return {date,sleep:sleep.minutes,speed:median(after.map(r=>r.summary.medianMs)),accuracy:total?correct/total:null,n:after.length};
 }).filter(Boolean);
}
export function windowSummary(records,start,end) {
 const inWindow=r=>r.date>=start&&r.date<=end,rows=records.filter(inWindow),moderate=rows.filter(r=>r.type==='fitness'&&r.activity!=='strength'&&r.intensity==='moderate');
 const reaction=comparableRecords(records,'reaction').filter(inWindow),correct=reaction.reduce((sum,r)=>sum+r.summary.correct,0),total=reaction.reduce((sum,r)=>sum+r.summary.total,0);
 const language=comparableRecords(records,'language').filter(inWindow),languageUnit=language.at(-1)?.scoringVersion?'规则分/5':'自评/5',languageSource=language.at(-1)?.scoringVersion?'rule-based':'subjective';
 const metric=(xs,field,unit,evidence)=>{const values=xs.map(field).filter(v=>v!=null);return {value:median(values),unit,n:values.length,evidence};};
 return {reactionSpeed:metric(reaction,r=>r.summary.medianMs,'毫秒','task-measured'),reactionAccuracy:{value:total?correct/total:null,unit:'比例',n:total,evidence:'task-measured'},
  memoryImmediate:metric(comparableRecords(records.filter(r=>r.stage==='immediate'),'memory').filter(inWindow),r=>r.hits,'信息单元/6',comparableRecords(records.filter(r=>r.stage==='immediate'),'memory').at(-1)?.memoryScoringVersion?'rule-based':'self-checked'),
  memoryDelayed:metric(comparableRecords(records.filter(r=>r.stage==='delayed'),'memory').filter(inWindow),r=>r.hits,'信息单元/6',comparableRecords(records.filter(r=>r.stage==='delayed'),'memory').at(-1)?.memoryScoringVersion?'rule-based':'self-checked'),
  languageStructure:metric(language,r=>r.structure,languageUnit,languageSource),
  languageLogic:metric(language,r=>r.logic,languageUnit,languageSource),
  languageFluency:metric(language,r=>r.fluency,languageUnit,languageSource),
  sleep:metric(rows.filter(r=>r.type==='sleep'&&r.sleepKind!=='nap'),r=>r.minutes/60,'小时','self-reported'),
  moderate:{value:moderate.length?moderate.reduce((sum,r)=>sum+r.minutes,0):null,unit:'分钟',n:moderate.length,evidence:'self-reported'},
  regulationPractice:metric(rows.filter(r=>r.type==='regulation'&&r.practice),r=>r.seconds/60,'分钟','task-measured'),
  pressure:metric(rows.filter(r=>r.type==='regulation'),r=>r.after??r.stress,'自评/10','subjective')};
}
export function goalsSnapshot(s) {
 return {priorities:s.goals,dailyTrainingMinutes:s.budget,sleepMinutes:s.sleepGoal,targetWakeTime:s.wakeTarget,weeklyModerateMinutes:s.moderateGoal,weeklyStrengthDays:s.strengthGoal,cognitiveSessionsPerWeek:s.budget>=5?s.trainingWeekdays.length:0,trainingWeekdays:s.trainingWeekdays};
}
export function normalizeSpace(input,source,day=today(input.settings?.timeZone||'Asia/Shanghai')) {
 if(!input||![1,2].includes(input.schemaVersion)||!Array.isArray(input.records)||!input.settings)throw new Error('不支持的数据版本，原始数据已保留。');
 if(input.source!==source||input.records.some(r=>r.source&&r.source!==source))throw new Error('数据空间不匹配，不能混入模拟或其他空间的记录。');
 const ds=structuredClone(input);ds.schemaVersion=2;ds.source=source;ds.revision=ds.revision||0;
 ds.settings=stamp({...defaults,...ds.settings,trainingWeekdays:[...(ds.settings.trainingWeekdays||defaults.trainingWeekdays)].sort((a,b)=>a-b)},source);
 const taskIds=new Map(),taskKeys=new Map();
 ds.records=ds.records.map(r=>{
  const record=stamp({...r,timeZone:r.timeZone||(r.type==='sleep'&&r.wakeAt?.endsWith('+08:00')?'Asia/Shanghai':r.type==='sleep'&&r.wakeAt?.endsWith('Z')?'UTC':ds.settings.timeZone),date:r.date||r.localDate},source);
  if(r.type==='sleep') {record.sleepKind=r.sleepKind||'night';record.awakeMinutes=nullable(r.awakeMinutes);record.minutes=sleepMinutes(r.sleepAt,r.wakeAt,record.awakeMinutes,r.longSleepConfirmed);record.wakeTime=new Intl.DateTimeFormat('en-GB',{timeZone:record.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(r.wakeAt));}
  if(r.type==='event'&&r.tag==='medication-change')record.tag='medication';
  if(r.type==='language'){for(const key of ['structure','logic','fluency','audioId','note'])record[key]=nullable(r[key]);}
  if(r.type==='reaction')record.summary=reactionSummary(r.trials);
  if(r.type==='memory') {record.checked=Array.isArray(r.checked)?r.checked:Array(6).fill(false);record.hits=record.checked.filter(Boolean).length;}
  if(resultKinds.includes(r.type)) {record.protocol=r.protocol||({reaction:'judge-v1',memory:'recall-v1',language:'speak-v1'})[r.type];record.contentVersion=r.contentVersion||r.material||record.protocol;record.difficulty=r.difficulty||'standard';record.device=r.device||{input:source==='demo'?'mouse':'unknown',platform:'unknown'};record.startedAt=r.startedAt??(source==='demo'?r.createdAt:null);record.endedAt=r.endedAt??(source==='demo'?r.createdAt:null);record.seconds=r.seconds??null;record.legacyConditions=source!=='demo'&&(!record.startedAt||!record.endedAt||record.device.input==='unknown');if(record.legacyConditions){record.excluded=true;record.exclusionReason='旧版缺少计时或输入设备条件，原始结果保留，暂不参与可比趋势。';}record.purpose=r.purpose||'regular';const taskKey=[r.type,record.protocol,record.contentVersion,record.difficulty,r.type==='language'?[record.targetSeconds||90,r.scoringVersion||'self-rating',r.scoreInput||'unknown'].join(':'):r.type==='memory'?r.memoryScoringVersion||'self-check':''].join(':');record.taskId=taskIds.get(taskKey)||r.taskId||crypto.randomUUID();if(taskKeys.has(record.taskId)&&taskKeys.get(record.taskId)!==taskKey)throw new Error('同一任务ID不能用于不同协议、材料、难度或目标时长。');taskIds.set(taskKey,record.taskId);taskKeys.set(record.taskId,taskKey);}
  return record;
 });
 for(const key of ['reviews','cycles','plans','planItems','due'])ds[key]=ds[key]||[];
 ds.planDays=ds.planDays||{};ds.reviews=ds.reviews.map(r=>stamp({...r,timeZone:r.timeZone||ds.settings.timeZone,sourceIds:r.sourceIds||[],summarySnapshot:r.summarySnapshot||{},knownConfounderIds:r.knownConfounderIds||[]},source));ds.cycles=ds.cycles.map(r=>stamp(r,source));
 if(ds.settings.onboarded) {
  const start=weekStart(day),goals=goalsSnapshot(ds.settings);
  let plan=ds.plans.filter(p=>p.weekStart===start).at(-1);
  if(!plan||JSON.stringify(plan.goalsSnapshot)!==JSON.stringify(goals)) {plan=stamp({weekStart:start,timeZone:ds.settings.timeZone,startsOn:day,endsOn:shiftDay(start,6),goalsSnapshot:goals,confirmedAt:ds.settings.updatedAt,origin:ds.plans.length===0?'onboarding':'user-edit'},source);ds.plans.push(plan);}
  for(let i=0;i<7;i++)for(const task of dailyTasks(ds,shiftDay(start,i))) {
   const date=shiftDay(start,i),existing=ds.planItems.find(p=>p.planId===plan.id&&p.localDate===date&&p.slot===task.id);
   if(!existing)ds.planItems.push(stamp({planId:plan.id,localDate:date,timeZone:ds.settings.timeZone,slot:task.id,system:task.id==='training'?'cognition':task.recordType,kind:task.recordType,title:task.title,estimatedMinutes:task.minutes,optional:task.optional,status:task.status,sourceRecordId:task.sourceRecordId,completedAt:task.sourceRecordId?iso():null,skipReason:null},source));
  }
 }
 ds.planItems=ds.planItems.map(p=>{const sourceRecord=ds.records.filter(r=>r.date===p.localDate&&r.type===p.kind&&(p.slot!=='training'||r.status==='completed')&&(p.slot!=='regulation'||r.practice)&&(p.slot!=='sleep'||r.sleepKind!=='nap')).at(-1);return {...p,sourceRecordId:sourceRecord?.id||null,status:sourceRecord?'completed':ds.planDays[p.localDate]?.[p.slot]==='skipped'?'skipped':'pending',completedAt:sourceRecord?.createdAt||null};});
 validateSpace(ds);return ds;
}
export function validateSpace(ds) {
 const fail=message=>{throw new Error(message);},num=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max,optional=(v,min,max)=>v==null||num(v,min,max),date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&shiftDay(v,0)===v;
 const s=ds.settings;
 if(!s||!Array.isArray(s.goals)||s.goals.length<1||s.goals.length>2||s.goals.some(g=>!['processing','memory','expression','sleep','fitness','calm'].includes(g)))fail('主要目标需为1至2项。');
 try {new Intl.DateTimeFormat('en',{timeZone:s.timeZone});}catch {fail('时区无效。');}
 if(!num(s.budget,3,60)||!num(s.sleepGoal,240,720)||!num(s.moderateGoal,0,1500)||!num(s.strengthGoal,0,7)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.wakeTarget))fail('个人目标超出允许范围。');
 if(!['light','dark','system'].includes(s.theme)||typeof s.reducedMotion!=='boolean'||!Array.isArray(s.trainingWeekdays)||s.trainingWeekdays.some(d=>!Number.isInteger(d)||d<1||d>7)||new Set(s.trainingWeekdays).size!==s.trainingWeekdays.length)fail('显示或训练日设置无效。');
 const ids=new Set();
 for(const r of ds.records) {
  if(typeof r.id!=='string'||!r.id||ids.has(r.id))fail('记录ID缺失或重复。');ids.add(r.id);
  if(!['sleep','fitness','regulation','nutrition','state','event',...resultKinds,'focus'].includes(r.type)||!date(r.date))fail('记录类别或日期无效。');
  try {new Intl.DateTimeFormat('en',{timeZone:r.timeZone});}catch {fail('记录时区无效。');}
  if(!Number.isFinite(Date.parse(r.createdAt)))fail('记录时间无效。');
  if(r.type==='sleep') {sleepMinutes(r.sleepAt,r.wakeAt,r.awakeMinutes,r.longSleepConfirmed);if(todayAt(r.wakeAt,r.timeZone)!==r.date)fail('睡眠需关联起床日期。');if(!optional(r.quality,1,5)||!optional(r.wakeEnergy,1,5))fail('睡眠评分需为1至5。');}
  if(r.type==='fitness'&&(!['walk','run','cycle','strength','other'].includes(r.activity)||!num(r.minutes,1,1440)||!['light','moderate','vigorous',null].includes(r.intensity)||!optional(r.sets,1,100)||!optional(r.fatigue,1,5)||!optional(r.recovery,1,5)))fail('运动记录超出允许范围。');
  if(r.type==='fitness'&&r.strengthItems!=null&&(!Array.isArray(r.strengthItems)||r.strengthItems.some(x=>!x||typeof x.exercise!=='string'||!x.exercise.trim()||!Number.isInteger(x.sets)||!num(x.sets,1,100)||x.repetitions!=null&&(!Number.isInteger(x.repetitions)||!num(x.repetitions,1,Infinity))||!optional(x.loadKg,0,Infinity))))fail('每项力量训练的项目、组数、次数或重量无效。');
  if(r.type==='regulation'&&(!optional(r.stress,0,10)||!optional(r.tension,0,10)||!optional(r.alertness,0,10)||!optional(r.before,0,10)||!optional(r.after,0,10)))fail('调节评分需为0至10。');
  if(r.type==='regulation'&&(r.practice||r.practiceKind!=null)&&(!['breathing','mindfulness','relaxation'].includes(r.practiceKind||'breathing')||!num(r.seconds,0,86400)||!num(r.targetSeconds??r.seconds,1,86400)||r.seconds>(r.targetSeconds??r.seconds)||!['completed','ended-early'].includes(r.status)||r.status==='completed'&&r.seconds!==(r.targetSeconds??r.seconds)||r.status==='ended-early'&&r.seconds===(r.targetSeconds??r.seconds)||r.startedAt!=null&&!Number.isFinite(Date.parse(r.startedAt))))fail('调节练习的实际时长、目标时长、状态或开始时间无效。');
  if(r.type==='nutrition'&&(!optional(r.water,0,20000)||!optional(r.caffeineMg,0,3000)||!optional(r.energy,1,5)||r.caffeineType&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.caffeineTime)))fail('饮食数值或咖啡因时间无效。');
  if(r.type==='nutrition'&&r.caffeineEntries!=null){const entries=r.caffeineEntries;if(!Array.isArray(entries)||new Set(entries.map(x=>x?.id)).size!==entries.length||entries.some(x=>!x||typeof x.id!=='string'||!x.id||typeof x.type!=='string'||!x.type.trim()||!Number.isFinite(Date.parse(x.consumedAt))||todayAt(x.consumedAt,r.timeZone)!==r.date||!optional(x.milligrams,0,3000)))fail('每次咖啡因摄入的ID、饮品、日期时间或毫克数无效。');}
  if(r.type==='nutrition'&&r.energyEntries!=null&&(!Array.isArray(r.energyEntries)||r.energyEntries.some(x=>!x||!['morning','afternoon','evening'].includes(x.period)||!num(x.rating?.value,1,5))))fail('每条历史精力记录的时段或评分无效。');
  if(resultKinds.includes(r.type)) {
   if(!['completed','interrupted','aborted'].includes(r.status)||!['baseline','regular','practice'].includes(r.purpose)||!optional(r.seconds,0,86400)||r.startedAt!=null&&!Number.isFinite(Date.parse(r.startedAt))||r.endedAt!=null&&!Number.isFinite(Date.parse(r.endedAt))||(!r.startedAt||!r.endedAt)&&!r.excluded)fail('训练会话状态或时间无效。');
   if(r.startedAt&&r.endedAt&&Date.parse(r.endedAt)<Date.parse(r.startedAt))fail('训练结束时间不能早于开始时间。');
   if(!['basic','standard','advanced'].includes(r.difficulty)||!['touch','keyboard','mouse','unknown'].includes(r.device?.input)||typeof r.device?.platform!=='string')fail('训练难度或输入条件无效。');
   if(r.type==='reaction'&&(!Array.isArray(r.trials)||r.trials.length>6||r.status==='completed'&&r.trials.length!==6||r.trials.some(t=>typeof t.correct!=='boolean'||!optional(t.responseMs,0,86400000)||![0,1,2,null].includes(t.response))))fail('判断原始题目结果无效。');
   if(r.type==='reaction'&&r.protocol==='judge-v2'){const keys=r.trials.map(t=>judgmentBank.find(q=>q.id===t.itemId));if(r.contentVersion!=='judge-bank-v1'||new Set(r.trials.map(t=>t.itemId)).size!==r.trials.length||keys.some(q=>!q)||r.trials.some((t,i)=>typeof t.timedOut!=='boolean'||!num(t.responseMs,0,30000)||t.timedOut&&(t.response!==null||t.responseMs!==30000)||!t.timedOut&&t.response===null||t.correct!==(!t.timedOut&&t.response===keys[i].answer))||r.status==='completed'&&[0,1,2].some(a=>keys.filter(q=>q.answer===a).length!==2))fail('判断题库版本、题目ID、答案或组卷比例无效。');}
   if(r.type==='memory'&&(!['immediate','delayed'].includes(r.stage)||r.checked.length!==6||r.checked.some(v=>typeof v!=='boolean')||typeof r.recall!=='string'))fail('记忆核对结果无效。');
   if(r.type==='language'&&(!optional(r.structure,r.scoringVersion?0:1,5)||!optional(r.logic,r.scoringVersion?0:1,5)||!optional(r.fluency,r.scoringVersion?0:1,5)||r.targetSeconds!=null&&![60,90,120].includes(r.targetSeconds)||!optional(r.preparationSeconds,0,30)||r.seconds!=null&&r.seconds>(r.targetSeconds||90)))fail('表达评分或实际/目标时长无效。');
  }
  if(r.type==='memory'&&r.memoryScoringVersion!=null){const score=memoryScore(r.recall,r.material,r.memoryScoringVersion);if(JSON.stringify(r.checked)!==JSON.stringify(score.checked))fail('记忆系统评分与回忆文字不一致。');}
  if(r.type==='fitness'&&r.intensitySource!=null&&(r.intensitySource!=='talk-test-v1'||!['sing','talk','few','unknown'].includes(r.talkTest)||r.intensity!==talkIntensity(r.talkTest)))fail('运动强度与说话情况不一致。');
  if(r.type==='language'&&r.scoringVersion!=null){if(!['text-rules-v1','text-rules-v2'].includes(r.scoringVersion)||!['typed','transcript'].includes(r.scoreInput)||typeof r.text!=='string'||r.text.length>5000)fail('表达评分规则、输入来源或文字无效。');const score=languageScore(r.text,r.topic,r.scoringVersion);if(['structure','logic','fluency'].some(k=>r[k]!==score.dimensions[k].score))fail('系统评分与表达文字或评分规则不一致。');}
  if(r.type==='focus'&&(!num(r.seconds,0,86400)||!num(r.targetSeconds,1,86400)||!num(r.distractions,0,10000)))fail('专注计时记录无效。');
 }
 const recordsById=new Map(ds.records.map(r=>[r.id,r])),dueIds=new Set(),dueParents=new Set();
 for(const d of ds.due){const parent=recordsById.get(d.parentId);if(typeof d.id!=='string'||!d.id||dueIds.has(d.id)||dueParents.has(d.parentId)||!Number.isFinite(Date.parse(d.dueAt))||!Number.isFinite(Date.parse(d.readAt))||Date.parse(d.dueAt)<=Date.parse(d.readAt)||!parent&&ds.source!=='demo'||parent&&(parent.type!=='memory'||parent.stage!=='immediate'||parent.material!==d.material))fail('延迟回忆需唯一关联同一材料的即时会话，且到期时间须晚于阅读时间。');dueIds.add(d.id);dueParents.add(d.parentId);}
 for(const r of ds.records.filter(r=>r.type==='memory'&&r.stage==='delayed')){const parent=recordsById.get(r.parentId);if(!parent&&ds.source!=='demo'||parent&&(parent.type!=='memory'||parent.stage!=='immediate'||parent.material!==r.material||r.endedAt&&parent.endedAt&&Date.parse(r.endedAt)<Date.parse(parent.endedAt))||!optional(r.delayMinutes,0,Infinity))fail('延迟回忆的原会话、材料或实际间隔无效。');}
 for(const c of ds.cycles)if(!date(c.start)||!date(c.end)||c.end<c.start)fail('观察周期的开始或结束日期无效。');
 for(const r of ds.reviews)if(!date(r.weekStart)||!date(r.weekEnd)||r.weekEnd<r.weekStart)fail('复盘的开始或结束日期无效。');
 for(const p of ds.plans)if(!date(p.weekStart)||!date(p.startsOn)||p.endsOn!=null&&(!date(p.endsOn)||p.endsOn<p.startsOn))fail('计划日期无效。');
 for(const p of ds.planItems)if(!date(p.localDate))fail('计划项目日期无效。');
 return ds;
}
export const todayAt=(at,timeZone)=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
export function toBundle(ds,audio=[]) {
 const s=ds.settings,tasks=[],taskMap=new Map();
 const taskFor=r=>{
  const key=[r.type,r.protocol,r.contentVersion,r.difficulty,r.type==='language'?[r.targetSeconds||90,r.scoringVersion||'self-rating',r.scoreInput||'unknown'].join(':'):r.type==='memory'?r.memoryScoringVersion||'self-check':''].join(':');
  if(!taskMap.has(key)) {const task={...bare(r),id:r.taskId||'task:'+key,kind:r.type,protocolVersion:r.protocol,contentVersion:r.contentVersion,difficulty:r.difficulty,instructions:({reaction:'短材料判断：支持/不支持/信息不足',memory:r.memoryScoringVersion?'45秒阅读后自由回忆，系统按6个信息单元评分':'45秒阅读后自由回忆，再自行核对6个关键点',language:'30秒准备，结论—依据—建议表达'})[r.type],scoring:r.scoringVersion?'text-rules':r.memoryScoringVersion?'idea-units':({reaction:'answer-key',memory:'self-check',language:'self-rating'})[r.type],itemIds:r.type==='reaction'?(r.protocol==='judge-v2'?judgmentBank.map(q=>q.id):r.trials.map(t=>t.itemId)):r.type==='memory'?r.checked.map((_,i)=>r.material+'-key-'+i):(r.contentVersion==='work-topics-v1'?topics.slice(0,5):topics).map((_,i)=>'work-'+i),timing:r.type==='reaction'?{responseDeadlineSeconds:30}:r.type==='memory'?{readingSeconds:45}:{prepareSeconds:30,expressionSeconds:r.targetSeconds||90}};tasks.push(task);taskMap.set(key,task);}
  return taskMap.get(key).id;
 };
 const records=ds.records,results=records.filter(r=>resultKinds.includes(r.type)).map(r=>{
  const base={...dayBase(r),taskId:taskFor(r),protocolVersion:r.protocol,contentVersion:r.contentVersion,difficulty:r.difficulty,purpose:r.purpose,startedAt:r.startedAt,endedAt:r.endedAt,actualSeconds:r.seconds??null,status:r.status,excludedFromComparison:!!r.excluded,exclusionReason:r.exclusionReason||null,device:r.device,note:nullable(r.note),kind:r.type};
  if(r.type==='reaction')return {...base,evidence:'task-measured',trials:r.trials.map(t=>({...t,response:[ 'supported','unsupported','insufficient'][t.response]||null})),summary:{correct:r.summary.correct,total:r.summary.total,accuracy:r.summary.accuracy,medianCorrectMs:r.summary.medianMs,iqrCorrectMs:r.summary.iqrMs}};
  if(r.type==='memory')return {...base,evidence:r.memoryScoringVersion?'rule-based':'self-checked',scoringVersion:r.memoryScoringVersion||null,stage:r.stage,parentResultId:r.parentId||null,recallText:r.recall,checkedKeyIds:r.checked.flatMap((v,i)=>v?[r.material+'-key-'+i]:[]),totalKeys:6,checkedBy:r.memoryScoringVersion?'system':'user',repeatedMaterial:!!r.repeated,reviewedBeforeRecall:!!r.reviewedBeforeRecall,reviewedBeforeDelayed:!!r.reviewedBeforeDelayed,scheduledRecallAt:ds.due.find(d=>d.parentId===r.id)?.dueAt||null,scheduledFromAt:ds.due.find(d=>d.parentId===r.id)?.readAt||null,actualDelaySeconds:r.delayMinutes==null?null:r.delayMinutes*60};
  return {...base,evidence:r.scoringVersion?'rule-based':'subjective',promptId:r.promptId||'work-'+Math.max(0,topics.indexOf(r.topic)),topicText:r.topic||null,structure:'conclusion-evidence-action',preparationSeconds:r.preparationSeconds??null,expressionSeconds:r.seconds,text:nullable(r.text),audioAssetId:r.audioId||null,selfRating:r.scoringVersion?null:{structure:r.structure,logic:r.logic,fluency:r.fluency},autoScore:r.scoringVersion?{ruleVersion:r.scoringVersion,input:r.scoreInput,structure:r.structure,logic:r.logic,fluency:r.fluency}:null,nextImprovement:nullable(r.next)};
 });
 const bundle={schemaVersion:1,format:'human-performance-os-core',exportedAt:iso(),space:ds.source,settings:{...bare(s),nickname:nullable(s.nickname),timeZone:s.timeZone,locale:'zh-CN',theme:s.theme,reducedMotion:s.reducedMotion,onboardingCompletedAt:s.onboarded?s.onboardingCompletedAt||s.updatedAt:null,exerciseExperience:s.exerciseExperience,goals:goalsSnapshot(s),baselineResultIds:Object.fromEntries(resultKinds.map(t=>[t,records.filter(r=>r.type===t&&r.purpose==='baseline'&&validResult(r)).map(r=>r.id)])),consents:s.consents||[]},
  dailyStates:records.filter(r=>r.type==='state').map(r=>({...dayBase(r),feeling:({'精力充足':'energetic','一般':'ordinary','疲惫':'tired'})[r.feeling]||null,energyMorning:r.energyMorning||null,energyAfternoon:r.energyAfternoon||null,energyEvening:r.energyEvening||null,note:nullable(r.note)})),
  sleep:records.filter(r=>r.type==='sleep').map(r=>({...dayBase(r),evidence:'self-reported',kind:r.sleepKind,sleepAt:r.sleepAt,wakeAt:r.wakeAt,awakeMinutes:nullable(r.awakeMinutes),quality:rating(r.quality,r.createdAt),wakeEnergy:rating(r.wakeEnergy,r.createdAt),note:nullable(r.note),longSleepConfirmed:!!r.longSleepConfirmed})),
  exercise:records.filter(r=>r.type==='fitness').map(r=>({...dayBase(r),evidence:'self-reported',kind:r.activity,startedAt:r.startedAt||null,minutes:r.minutes,intensity:r.intensity,talkTest:r.talkTest||null,intensitySource:r.intensitySource||null,strength:r.strengthItems||(r.activity==='strength'&&r.exercise?[{exercise:r.exercise,sets:r.sets,repetitions:null,loadKg:null}]:[]),fatigueAfter:rating(r.fatigue,r.createdAt),recoveryAfter:rating(r.recovery,r.createdAt),note:nullable(r.note)})),
  nutrition:records.filter(r=>r.type==='nutrition').map(r=>({...dayBase(r),evidence:'self-reported',breakfast:nullable(r.breakfast==='na'?'not-applicable':r.breakfast),lunch:nullable(r.lunch==='na'?'not-applicable':r.lunch),dinner:nullable(r.dinner==='na'?'not-applicable':r.dinner),waterMl:nullable(r.water),caffeine:r.caffeineEntries||(r.caffeineType?[{id:r.caffeineId||r.id+'-caffeine',type:r.caffeineType,consumedAt:localTimeISO(r.date,r.caffeineTime,r.timeZone),milligrams:nullable(r.caffeineMg)}]:[]),energy:r.energyEntries||(r.energy==null?[]:[{period:r.period||'afternoon',rating:rating(r.energy,r.createdAt)}]),note:nullable(r.note)})),
  regulation:records.filter(r=>r.type==='regulation').map(r=>({...dayBase(r),stress:rating(r.stress,r.createdAt),tension:rating(r.tension,r.createdAt),alertness:rating(r.alertness,r.createdAt),note:nullable(r.note),practice:r.practice?{kind:r.practiceKind||'breathing',startedAt:r.startedAt||r.createdAt,actualSeconds:r.seconds,targetSeconds:r.targetSeconds||r.seconds,status:r.status,stressBefore:nullable(r.before),stressAfter:nullable(r.after),inhaleSeconds:r.natural?null:4,exhaleSeconds:r.natural?null:6}:null})),
  tasks,results,focus:records.filter(r=>r.type==='focus').map(r=>({...dayBase(r),startedAt:r.startedAt||r.createdAt,endedAt:r.endedAt||r.createdAt,targetSeconds:r.targetSeconds,actualSeconds:r.seconds,pausedSeconds:r.pausedSeconds||0,distractions:r.distractions,status:r.status,goal:nullable(r.goal),note:nullable(r.note)})),
  plans:ds.plans,planItems:ds.planItems,events:records.filter(r=>r.type==='event').map(r=>({...dayBase(r),tags:[r.tag==='medication'?'medication-change':r.tag||'other'],endedOn:r.endedOn||null,description:nullable(r.note),annotateCharts:r.annotateCharts!==false})),
  weeklyReviews:ds.reviews.map(r=>({...bare(r),weekStart:r.weekStart,weekEnd:r.weekEnd,timeZone:r.timeZone,sourceRecordIds:r.sourceIds,summarySnapshot:r.summarySnapshot,workReflection:r.reflection,nextAdjustment:r.adjustment,nextPlanId:r.nextPlanId||null,knownConfounderIds:r.knownConfounderIds})),
  observations:ds.cycles.map(r=>({...bare(r),evidence:'observational',change:r.change,startsOn:r.start,endsOn:r.end,comparisonWindow:r.comparisonWindow||{beforeStart:shiftDay(r.start,-14),beforeEnd:shiftDay(r.start,-1),afterStart:r.start,afterEnd:r.end},protocolVersions:r.protocolVersions||[],eventIds:r.eventIds||[],reflection:r.reflection||null,decision:r.decision||null})),
  audioMetadata:audio.map(({blob,...a})=>a),audioIncluded:false};
 return bundle;
}
export function fromBundle(input,space) {
 if(input.format!=='human-performance-os-core')return normalizeSpace(input,space);
 if(input.schemaVersion!==1||input.space!==space||input.audioIncluded!==false)throw new Error('备份版本或空间不匹配。演示数据不能恢复到个人空间。');
 for(const key of ['dailyStates','sleep','exercise','nutrition','regulation','tasks','results','focus','plans','planItems','events','weeklyReviews','observations','audioMetadata'])if(!Array.isArray(input[key]))throw new Error('备份不完整：'+key);
 for(const key of ['dailyStates','sleep','exercise','nutrition','regulation','tasks','results','focus','plans','planItems','events','weeklyReviews','observations'])if(input[key].some(r=>r.source!==space))throw new Error('备份实体来源与空间不一致。');
 const tasks=new Map();
 for(const task of input.tasks){if(typeof task.id!=='string'||!task.id||tasks.has(task.id)||!resultKinds.includes(task.kind)||!task.timing||!Array.isArray(task.itemIds))throw new Error('备份任务ID缺失、重复或定义无效。');if(task.kind==='language'&&![60,90,120].includes(task.timing.expressionSeconds))throw new Error('备份表达目标时长无效。');tasks.set(task.id,task);}
 for(const r of input.results){const task=tasks.get(r.taskId);if(!task||task.kind!==r.kind||task.protocolVersion!==r.protocolVersion||task.contentVersion!==r.contentVersion||task.difficulty!==r.difficulty)throw new Error('备份训练结果缺少匹配的任务定义。');}
 for(const r of input.results)if(r.kind==='memory'&&(r.checkedBy==='system'||r.scoringVersion!=null)&&(r.checkedBy!=='system'||!['idea-units-v1','idea-units-v2'].includes(r.scoringVersion)||tasks.get(r.taskId).scoring!=='idea-units'))throw new Error('记忆自动评分规则或来源无效。');
 for(const r of input.results)if(r.kind==='language'&&r.autoScore&&(!['text-rules-v1','text-rules-v2'].includes(r.autoScore.ruleVersion)||!['typed','transcript'].includes(r.autoScore.input)||tasks.get(r.taskId).scoring!=='text-rules'))throw new Error('表达自动评分规则或输入来源无效。');
 for(const r of input.results)if(r.evidence!==(r.kind==='language'&&r.autoScore||r.kind==='memory'&&r.checkedBy==='system'?'rule-based':({reaction:'task-measured',memory:'self-checked',language:'subjective'})[r.kind])||r.kind==='language'&&r.autoScore&&r.selfRating!=null)throw new Error('训练证据来源不匹配，不能将自评转换为客观分数。');
 const s=input.settings,g=s.goals,ds=seed(space),day=r=>({...r,date:r.localDate}),value=r=>r?.value??null;
 ds.schemaVersion=2;ds.settings={...bare(s),nickname:s.nickname||'',timeZone:s.timeZone,theme:s.theme,reducedMotion:s.reducedMotion,onboarded:!!s.onboardingCompletedAt,onboardingCompletedAt:s.onboardingCompletedAt,onboardingStep:0,exerciseExperience:s.exerciseExperience,goals:g.priorities,budget:g.dailyTrainingMinutes,sleepGoal:g.sleepMinutes,wakeTarget:g.targetWakeTime,moderateGoal:g.weeklyModerateMinutes,strengthGoal:g.weeklyStrengthDays,trainingWeekdays:g.trainingWeekdays,consents:s.consents};
 ds.records=[
  ...input.dailyStates.map(r=>({...day(r),type:'state',feeling:({energetic:'精力充足',ordinary:'一般',tired:'疲惫'})[r.feeling],note:r.note})),
  ...input.sleep.map(r=>({...day(r),type:'sleep',sleepKind:r.kind,quality:value(r.quality),wakeEnergy:value(r.wakeEnergy),bedDate:todayAt(r.sleepAt,r.timeZone),bedTime:new Intl.DateTimeFormat('en-GB',{timeZone:r.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(r.sleepAt))})),
  ...input.exercise.map(r=>({...day(r),type:'fitness',activity:r.kind,strengthItems:r.strength,exercise:r.strength?.map(x=>x.exercise).join('、')||'',sets:r.strength?.reduce((sum,x)=>sum+x.sets,0)||null,fatigue:value(r.fatigueAfter),recovery:value(r.recoveryAfter)})),
  ...input.nutrition.map(r=>({...day(r),type:'nutrition',caffeineEntries:r.caffeine,energyEntries:r.energy,water:r.waterMl,caffeineType:r.caffeine[0]?.type||'',caffeineTime:r.caffeine[0]?new Intl.DateTimeFormat('en-GB',{timeZone:r.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(r.caffeine[0].consumedAt)):'',caffeineMg:r.caffeine[0]?.milligrams??null,energy:value(r.energy[0]?.rating),period:r.energy[0]?.period||'afternoon',breakfast:r.breakfast==='not-applicable'?'na':r.breakfast,lunch:r.lunch==='not-applicable'?'na':r.lunch,dinner:r.dinner==='not-applicable'?'na':r.dinner})),
  ...input.regulation.map(r=>({...day(r),type:'regulation',stress:value(r.stress),tension:value(r.tension),alertness:value(r.alertness),practice:r.practice?({breathing:'舒适呼吸',mindfulness:'正念观察',relaxation:'身体放松'})[r.practice.kind]:null,practiceKind:r.practice?.kind,natural:r.practice?.kind==='breathing'&&r.practice.inhaleSeconds===null&&r.practice.exhaleSeconds===null,seconds:r.practice?.actualSeconds,before:r.practice?.stressBefore??null,after:r.practice?.stressAfter??null,status:r.practice?.status||'completed',targetSeconds:r.practice?.targetSeconds,startedAt:r.practice?.startedAt})),
  ...input.results.map(r=>({...day(r),type:r.kind,protocol:r.protocolVersion,seconds:r.actualSeconds,excluded:r.excludedFromComparison,exclusionReason:r.exclusionReason,trials:r.trials?.map(t=>({...t,response:['supported','unsupported','insufficient'].indexOf(t.response)<0?null:['supported','unsupported','insufficient'].indexOf(t.response)})),material:r.contentVersion,memoryScoringVersion:r.kind==='memory'&&r.checkedBy==='system'?r.scoringVersion:null,checked:Array.from({length:6},(_,i)=>r.checkedKeyIds?.includes(r.contentVersion+'-key-'+i)||false),recall:r.recallText,repeated:r.repeatedMaterial,parentId:r.parentResultId,delayMinutes:r.actualDelaySeconds==null?null:r.actualDelaySeconds/60,scoringVersion:r.autoScore?.ruleVersion??null,scoreInput:r.autoScore?.input??null,structure:(r.autoScore||r.selfRating)?.structure??null,logic:(r.autoScore||r.selfRating)?.logic??null,fluency:(r.autoScore||r.selfRating)?.fluency??null,topic:r.topicText||topics[Number(r.promptId?.replace('work-',''))]||r.promptId,targetSeconds:input.tasks.find(t=>t.id===r.taskId)?.timing.expressionSeconds||90,text:r.autoScore?r.text??'':r.text,audioId:r.audioAssetId,next:r.nextImprovement})),
  ...input.focus.map(r=>({...day(r),type:'focus',seconds:r.actualSeconds})),
  ...input.events.map(r=>({...day(r),type:'event',tag:r.tags[0]==='medication-change'?'medication':r.tags[0],note:r.description}))
 ];
 ds.plans=input.plans;ds.planItems=input.planItems;ds.planDays={};for(const p of input.planItems)if(p.status==='skipped') {ds.planDays[p.localDate]??={};ds.planDays[p.localDate][p.slot|| (p.system==='cognition'?'training':p.system)]=p.status;}
 ds.due=input.results.filter(r=>r.kind==='memory'&&r.stage==='immediate'&&r.scheduledRecallAt).map(r=>({id:r.id+'-due',parentId:r.id,material:r.contentVersion,dueAt:r.scheduledRecallAt,readAt:r.scheduledFromAt||r.endedAt||r.createdAt,reviewed:!!r.reviewedBeforeDelayed,completed:input.results.some(x=>x.parentResultId===r.id&&x.stage==='delayed'),source:space}));
 ds.reviews=input.weeklyReviews.map(r=>({...r,sourceIds:r.sourceRecordIds,reflection:r.workReflection,adjustment:r.nextAdjustment}));
 ds.cycles=input.observations.map(r=>({...r,start:r.startsOn,end:r.endsOn}));
 return normalizeSpace(ds,space);
}
