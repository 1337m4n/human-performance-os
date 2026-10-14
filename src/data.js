export const DEMO_DAY = '2026-10-13';
export const names = {sleep:'睡眠恢复',fitness:'心肺与肌肉',cognition:'认知与专注',regulation:'身心调节',nutrition:'营养与精力',reaction:'反应与判断',memory:'记忆提取',language:'语言组织',focus:'深度专注',event:'生活事件',state:'主观状态'};
export const evidence = {reaction:'客观任务表现',memory:'自行核对',language:'主观自评',sleep:'自报记录',fitness:'自报记录',regulation:'主观评分',nutrition:'自报记录',focus:'计时记录',event:'个人记录',state:'主观感受'};
export const navItems = [['dashboard','个人驾驶舱','home'],['today','今日计划','calendar'],['sleep',names.sleep,'moon'],['fitness',names.fitness,'activity'],['cognition',names.cognition,'brain'],['regulation',names.regulation,'wind'],['nutrition',names.nutrition,'food'],['insights','趋势与复盘','chart'],['history','历史记录','file'],['settings','个人设置','settings']];
export const defaults = {nickname:'',timeZone:'Asia/Shanghai',theme:'system',reducedMotion:false,onboarded:false,onboardingStep:0,goals:['processing','expression'],budget:10,sleepGoal:450,wakeTarget:'07:00',moderateGoal:150,strengthGoal:2,trainingWeekdays:[1,3,5],exerciseExperience:'inactive',consents:[]};
export function today(timeZone='Asia/Shanghai') { return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export function shiftDay(day,n) { const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10); }
export function daysEnding(day,n) { return Array.from({length:n},(_,i)=>shiftDay(day,i-n+1)); }
export function weekStart(day) { const d=new Date(`${day}T12:00:00Z`);return shiftDay(day,-((d.getUTCDay()+6)%7)); }
export function dateLabel(day) { return new Date(`${day}T12:00:00Z`).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long',timeZone:'UTC'}); }
export const minutesLabel=n=>n==null?'尚未记录':`${Math.floor(n/60)}小时${Math.round(n%60)}分`;
export const clockLabel=n=>`${String(Math.floor(Math.max(n,0)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(n,0)%60)).padStart(2,'0')}`;
export const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
export function median(xs) { if(!xs.length)return null;const a=[...xs].sort((x,y)=>x-y);const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2; }
const quantile=(a,p)=>{const x=(a.length-1)*p,i=Math.floor(x);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(x-i);};
export function reactionSummary(trials) { const valid=trials.filter(t=>t.correct&&!t.timedOut&&Number.isFinite(t.responseMs)).map(t=>t.responseMs).sort((a,b)=>a-b);const c=trials.filter(t=>t.correct&&!t.timedOut).length;return {correct:c,total:trials.length,accuracy:trials.length?c/trials.length:0,medianMs:median(valid),iqrMs:valid.length>=4?quantile(valid,.75)-quantile(valid,.25):null}; }
export function sleepMinutes(start,end,awake=0,allowLong=false) { const interval=(Date.parse(end)-Date.parse(start))/60000,delta=interval-Number(awake??0);if(!Number.isFinite(delta)||!Number.isFinite(Number(awake??0))||Number(awake??0)<0||delta<=0||interval>1440&&!allowLong)throw new Error('请检查日期与时间：起床需晚于入睡，清醒分钟不能超过区间；超过24小时需再次确认。');return Math.round(delta); }
export function wakeVariation(times,target='07:00') { if(times.length<3)return null;const tm=target.split(':').map(Number).reduce((a,b,i)=>a+b*(i===0?60:1),0);const xs=times.map(t=>{const [h,m]=t.split(':').map(Number);return ((h*60+m-tm+720+1440)%1440)-720;});const avg=mean(xs);return Math.sqrt(mean(xs.map(x=>(x-avg)**2))); }
export const validResult=r=>['reaction','memory','language'].includes(r.type)&&r.status==='completed'&&!r.excluded&&!r.reviewedBeforeRecall&&!(r.type==='reaction'&&r.trials?.some(t=>t.timedOut));
export function latest(records,type) { return records.filter(r=>r.type===type&&(!['reaction','memory','language'].includes(type)||validResult(r))).sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||'').localeCompare(a.createdAt||''))[0]; }
export function points(records,dates,type,field) { return dates.map(date=>{const rows=records.filter(r=>r.date===date&&r.type===type&&(type!=='sleep'||r.sleepKind!=='nap')&&(!['reaction','memory','language'].includes(type)||validResult(r)));const values=rows.map(field).filter(x=>x!=null&&Number.isFinite(x));return {date,value:type==='fitness'?values.length?values.reduce((a,b)=>a+b,0):null:type==='sleep'?mean(values):median(values),n:values.length};}); }
export function weeklyFitness(records,day) { const start=weekStart(day),end=shiftDay(start,6);const rows=records.filter(r=>r.type==='fitness'&&r.date>=start&&r.date<=end);return {moderate:rows.filter(r=>r.activity!=='strength'&&r.intensity==='moderate').reduce((a,r)=>a+r.minutes,0),vigorous:rows.filter(r=>r.activity!=='strength'&&r.intensity==='vigorous').reduce((a,r)=>a+r.minutes,0),strengthDays:new Set(rows.filter(r=>r.activity==='strength').map(r=>r.date)).size}; }
export function recordValue(r) { if(r.type==='sleep')return minutesLabel(r.minutes);if(r.type==='fitness')return `${({walk:'步行',run:'跑步',cycle:'骑行',strength:'力量训练',other:'其他活动'})[r.activity]} · ${r.minutes}分钟`;if(r.type==='reaction')return `${r.summary.correct}/${r.summary.total}正确 · ${r.summary.medianMs==null?'—':(r.summary.medianMs/1000).toFixed(1)+'秒'}`;if(r.type==='memory')return `${r.stage==='delayed'?'延迟':'即时'} · ${r.hits}/6关键点`;if(r.type==='language')return `结构${r.structure??'—'}/5 · 表达${r.seconds}秒`;if(r.type==='regulation')return r.practice?`${r.practice} · ${r.seconds}秒 · 压力${r.before??'—'}→${r.after??'—'}`:`压力${r.stress??'—'}/10 · 警觉${r.alertness??'—'}/10`;if(r.type==='nutrition')return `饮水${r.water??'—'}ml · 精力${r.energy??'—'}/5`;if(r.type==='focus')return `${r.seconds}秒 · 干扰${r.distractions}次`;if(r.type==='state')return r.feeling;return r.note||'生活事件'; }
export function dailyTasks(ds,day,low=false) {
 const weekdays=ds.settings.trainingWeekdays||[1,3,5],weekday=((new Date(day+'T12:00Z').getUTCDay()+6)%7)+1,rest=!weekdays.includes(weekday),budget=low?3:ds.settings.budget;
 const index=weekdays.indexOf(weekday),week=Math.floor(Date.parse(weekStart(day)+'T12:00Z')/604800000);
 const kind=ds.source==='demo'?'reaction':['reaction','memory','language'][((week*weekdays.length+index)%3+3)%3];
 const tasks=[{id:'sleep',title:'记录昨晚睡眠',description:'起止时间与醒后感受',icon:'moon',minutes:1,recordType:'sleep',action:'sleep',optional:rest}];
 if(!rest&&budget>=5)tasks.push({id:'training',title:names[kind],description:'固定协议，成绩各自观察',icon:kind==='reaction'?'bolt':kind==='memory'?'brain':'file',minutes:Math.min(5,budget-1),recordType:kind,action:kind,optional:false});
 if(rest||budget<5||budget>=8)tasks.push({id:'regulation',title:'舒适呼吸',description:rest?'休息日的可选练习':'给自己两分钟放松空间',icon:'wind',minutes:2,recordType:'regulation',action:'breathing',optional:rest});
 return tasks.map(t=>{const source=ds.records.filter(r=>r.date===day&&r.type===t.recordType&&(t.id!=='training'||r.status==='completed')&&(t.id!=='regulation'||r.practice)&&(t.id!=='sleep'||r.sleepKind!=='nap')).at(-1);return {...t,sourceRecordId:source?.id||null,status:source?'completed':ds.planDays?.[day]?.[t.id]==='skipped'?'skipped':'pending'};});
}
export function seed(source='personal') {
  const ds={schemaVersion:1,source,settings:{...defaults,goals:[...defaults.goals],onboarded:source==='demo'},records:[],planDays:{},reviews:[],due:[],cycles:[]};if(source!=='demo')return ds;
  const make=(date,type,data)=>({id:`demo-${type}-${date}-${ds.records.length}`,date,type,source:'demo',status:'completed',createdAt:`${date}T09:00:00+08:00`,...data});
  for(let i=0;i<30;i++) {const date=shiftDay(DEMO_DAY,i-29);const mins=[402,424,438,417,456,442,448][i%7];ds.records.push(make(date,'sleep',{minutes:i===29?448:mins,bedDate:shiftDay(date,-1),bedTime:'23:35',wakeTime:['06:49','07:02','07:15','07:00'][i%4],quality:i%4===0?3:4,wakeEnergy:4}));ds.records.push(make(date,'regulation',{stress:[6,5,4,5,3][i%5],tension:4,alertness:5}));ds.records.push(make(date,'nutrition',{water:1600+(i%3)*200,breakfast:'usual',lunch:'usual',dinner:'usual',energy:[3,4,4,3,5][i%5],caffeineType:'咖啡',caffeineTime:'09:30',caffeineMg:null}));
    if(i%3===0||i>=23) {const ms=i>=23?[5200,4700,4680,4220,3860,4200,4200][i-23]:5600-(i*38);const trials=Array.from({length:6},(_,j)=>({itemId:`judge-${j+1}`,correct:j<5,responseMs:ms+(j-2)*110,timedOut:false,response:j<5?0:1}));ds.records.push(make(date,'reaction',{protocol:'judge-v1',purpose:'regular',summary:reactionSummary(trials),trials}));}
    if(i%3===1)ds.records.push(make(date,'memory',{protocol:'recall-v1',material:'park-v1',stage:'immediate',hits:i>18?5:4,checked:[true,true,true,true,i>18,false],recall:'一项社区公园改造计划，包含照明、步道和后续意见征集。',purpose:'regular',repeated:true}));
    if(i%3===2)ds.records.push(make(date,'language',{protocol:'speak-v1',structure:i>15?4:3,logic:4,fluency:3,seconds:90,topic:'如何减少项目中的无效会议？',text:'建议减少没有明确目标的会议，以书面同步替代状态汇报，并保留需要讨论的决策。',purpose:'regular'}));
    if(i%4===0)ds.records.push(make(date,'fitness',{activity:i%8===0?'strength':'run',minutes:30,intensity:'moderate',sets:3,exercise:'深蹲、划船',fatigue:3,recovery:4}));
  }
  ds.records=ds.records.map(r=>{if(r.type!=='sleep')return r;const [h,m]=r.wakeTime.split(':').map(Number);const delta=h*60+m-r.minutes,total=(delta+1440)%1440;const bedDate=delta<0?shiftDay(r.date,-1):r.date;const bedTime=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;return {...r,bedDate,bedTime,sleepAt:`${bedDate}T${bedTime}:00+08:00`,wakeAt:`${r.date}T${r.wakeTime}:00+08:00`};});
  ds.records=ds.records.filter(r=>!(r.type==='fitness'&&r.date>=weekStart(DEMO_DAY)));
  ds.records.push(make(shiftDay(DEMO_DAY,-1),'fitness',{activity:'walk',minutes:75,intensity:'moderate',fatigue:2,recovery:4}));ds.records.push(make(DEMO_DAY,'fitness',{activity:'cycle',minutes:45,intensity:'moderate',fatigue:3,recovery:4}));
  ds.records=ds.records.filter(r=>!(r.type==='reaction'&&r.date===DEMO_DAY)); // today's task remains available; latest comparable result is Oct12
  ds.records.push(make(DEMO_DAY,'state',{feeling:'一般'}));
  ds.records.push(make(shiftDay(DEMO_DAY,-5),'event',{note:'出差，作息晚了一些',tag:'travel'}));
  ds.due=[{id:'demo-due',parentId:'demo-memory-due',material:'park-v1',dueAt:'2026-10-13T00:00:00Z',readAt:'2026-10-12T00:00:00Z',source:'demo'}];
  return ds;
}
export const reactionItems=[
 {text:'本周三场评审均在上午进行。今天的评审属于本周三场之一。',claim:'今天的评审在上午进行。',answer:0,why:'属于已给出的三场评审，结论得到材料支持。'},
 {text:'项目甲比项目乙先上线。项目丙比项目甲晚一周上线。',claim:'项目丙一定比项目乙晚。',answer:2,why:'缺少乙与丙的先后信息。'},
 {text:'本次调查有40名参与者，其中24名选择线上会议。',claim:'选择线上会议的人不到一半。',answer:1,why:'24/40为60%，超过一半。'},
 {text:'只有完成安全检查的版本才能发布。当前版本还未完成安全检查。',claim:'当前版本可以按此规则发布。',answer:1,why:'尚未满足必要条件。'},
 {text:'所有紧急工单都会在当天回复。工单甲当天得到了回复。',claim:'工单甲一定是紧急工单。',answer:2,why:'当天回复不意味着一定紧急。'},
 {text:'培训从14:00开始，持续45分钟，中间没有休息。',claim:'培训在14:45结束。',answer:0,why:'开始时间加45分钟。'}
];
export const practiceItems=[{text:'所有红色箱子都放在一层。箱子甲是红色。',claim:'箱子甲放在一层。',answer:0,why:'材料支持结论。'},{text:'公交今天可能延误。',claim:'公交今天一定延误。',answer:2,why:'可能不等于一定。'}];
export const legacyMaterial={id:'park-v1',text:'清河社区计划在11月改造一座旧公园。项目预算为80万元，工作分为照明更新、步道修整和增加休息座椅三个部分。照明工程先开始，随后修整步道，最后安装座椅。施工期间公园东门保持开放，西门暂时关闭。社区将在10月25日举办居民意见会，并在会后公布最终施工安排。项目由社区服务中心负责，每周五更新一次进度。',keys:['地点：清河社区的旧公园','时间：11月改造，10月25日意见会','预算：80万元','内容与顺序：照明→步道→座椅','开放安排：东门开放，西门关闭','负责人及更新：社区服务中心，每周五']};
export const topics=['如何减少项目中的无效会议？','向不了解技术的同事解释一次系统故障。','你会如何安排一个信息很多但时间有限的工作日？','如何判断一个新工具是否值得引入？','给团队提出一个能减少多任务切换的建议。'];
export const material={...legacyMaterial,id:'park-v2',text:legacyMaterial.text+'居民可以现场了解具体安排。'};
export const materials=[material,
 {id:'library-v1',text:'青山图书馆计划在12月推出周末阅读活动。每周六上午十点到十一点半开放活动室，每次最多接待二十名居民。报名从11月15日开始，读者可以在服务台登记，也可以通过图书馆网页报名。活动分为二十分钟安静阅读、四十分钟小组讨论和三十分钟书目分享。首月主题是城市生活，不要求参与者提前购买书籍。活动室位于二楼，工作人员会在一楼入口提供引导。每次结束后，参与者可以匿名填写建议，馆方将在下月安排中说明采纳情况。',keys:['地点：青山图书馆二楼活动室','时间：12月开始，每周六10:00—11:30','人数：每次最多20名居民','报名：11月15日起，服务台或网页','流程：阅读20分钟→讨论40分钟→分享30分钟','主题与反馈：城市生活，匿名建议在下月说明采纳情况']},
 {id:'garden-v1',text:'云桥街道准备在明年三月建立一处共享花园，选址在文化中心南侧的空地。项目预算为十二万元，其中七万元用于整理土壤和步道，三万元购买种子与工具，两万元留作后续维护。居民报名将在二月一日开始，每户可以申请一个种植区域，首次分配最多三十户。花园每周三下午由志愿者进行公共维护，其他时间由各户照顾自己的区域。入口旁会设置工具柜，借用工具需要登记归还时间。街道将在首季结束后收集居民反馈，再决定是否扩大面积。',keys:['地点：文化中心南侧空地','时间：明年3月建立，2月1日报名','预算：12万元，土壤步道7万、种子工具3万、维护2万','分配：每户一个区域，首次最多30户','维护：每周三下午公共维护，其余各户照顾','工具与后续：借用登记归还时间，首季反馈后决定扩建']}
];
export const timerElapsed=(elapsedMs,startedAt,now,targetMs)=>Math.min(targetMs,elapsedMs+(startedAt==null?0:Math.max(0,now-startedAt)));
