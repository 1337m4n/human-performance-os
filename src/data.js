export const DEMO_DAY = '2026-10-13';
export const names = {sleep:'睡眠恢复',fitness:'心肺与肌肉',cognition:'认知与专注',regulation:'身心调节',nutrition:'营养与精力',reaction:'反应与判断',memory:'记忆提取',language:'语言组织',focus:'深度专注',event:'生活事件',state:'主观状态'};
export const evidence = {reaction:'客观任务表现',memory:'系统信息单元评分',language:'系统文本规则评分',sleep:'自报记录',fitness:'自报记录',regulation:'事实与文字记录',nutrition:'自报记录',focus:'计时记录',event:'个人记录',state:'主观感受'};
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
export const sleepBedDate=(wakeDate,bedTime,wakeTime)=>!wakeDate||!bedTime||!wakeTime?'':bedTime<=wakeTime?wakeDate:shiftDay(wakeDate,-1);
export function wakeVariation(times,target='07:00') { if(times.length<3)return null;const tm=target.split(':').map(Number).reduce((a,b,i)=>a+b*(i===0?60:1),0);const xs=times.map(t=>{const [h,m]=t.split(':').map(Number);return ((h*60+m-tm+720+1440)%1440)-720;});const avg=mean(xs);return Math.sqrt(mean(xs.map(x=>(x-avg)**2))); }
export const validResult=r=>['reaction','memory','language'].includes(r.type)&&r.status==='completed'&&!r.excluded&&!r.reviewedBeforeRecall&&!(r.type==='reaction'&&r.trials?.some(t=>t.timedOut));
export function latest(records,type) { return records.filter(r=>r.type===type&&(!['reaction','memory','language'].includes(type)||validResult(r))).sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||'').localeCompare(a.createdAt||''))[0]; }
export function points(records,dates,type,field) { return dates.map(date=>{const rows=records.filter(r=>r.date===date&&r.type===type&&(type!=='sleep'||r.sleepKind!=='nap')&&(!['reaction','memory','language'].includes(type)||validResult(r)));const values=rows.map(field).filter(x=>x!=null&&Number.isFinite(x));return {date,value:type==='fitness'?values.length?values.reduce((a,b)=>a+b,0):null:type==='sleep'?mean(values):median(values),n:values.length};}); }
export function weeklyFitness(records,day) { const start=weekStart(day),end=shiftDay(start,6);const rows=records.filter(r=>r.type==='fitness'&&r.date>=start&&r.date<=end);return {moderate:rows.filter(r=>r.activity!=='strength'&&r.intensity==='moderate').reduce((a,r)=>a+r.minutes,0),vigorous:rows.filter(r=>r.activity!=='strength'&&r.intensity==='vigorous').reduce((a,r)=>a+r.minutes,0),strengthDays:new Set(rows.filter(r=>r.activity==='strength').map(r=>r.date)).size}; }
export function recordValue(r) { if(r.type==='sleep')return minutesLabel(r.minutes);if(r.type==='fitness')return `${({walk:'步行',run:'跑步',cycle:'骑行',strength:'力量训练',other:'其他活动'})[r.activity]} · ${r.minutes}分钟`;if(r.type==='reaction')return `${r.summary.correct}/${r.summary.total}正确 · ${r.summary.medianMs==null?'—':(r.summary.medianMs/1000).toFixed(1)+'秒'}`;if(r.type==='memory')return `${r.stage==='delayed'?'延迟':'即时'} · ${r.hits}/6关键点`;if(r.type==='language')return `结构${r.structure??'—'}/5 · 表达${r.seconds}秒`;if(r.type==='regulation')return r.practice?`${r.practice} · ${r.seconds}秒 · ${r.targetSeconds?Math.min(100,Math.round(r.seconds/r.targetSeconds*100))+'%进度':'计时记录'}`:r.note||'文字感受记录';if(r.type==='nutrition')return `饮水${r.water??'—'}ml · 三餐已记录${['breakfast','lunch','dinner'].filter(k=>r[k]!=null&&r[k]!=='').length}/3`;if(r.type==='focus')return `${r.seconds}秒 · 干扰${r.distractions}次`;if(r.type==='state')return r.note||r.feeling||'文字感受';return r.note||'生活事件'; }
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
export const languageScoringVersion='text-rules-v1';
export const languageScoreLabels={structure:'结构完整度',logic:'依据与行动',fluency:'文字连贯度'};
export const languageEvidence=r=>r?.scoringVersion?'系统规则评分（文本）':'历史自评';
export function languageScore(text,topic) {
 const input=(text||'').normalize('NFKC').trim(),length=s=>(s.match(/[\p{L}\p{N}]/gu)||[]).length;
 const headers=[...input.matchAll(/(?:^|[\n。！？；.!?;])\s*(结论|观点|依据|原因|建议|行动)\s*:/gu)],parts={};
 const kind=h=>({结论:'conclusion',观点:'conclusion',依据:'evidence',原因:'evidence',建议:'action',行动:'action'})[h];
 headers.forEach((h,i)=>{const key=kind(h[1]);if(!parts[key])parts[key]=input.slice(h.index+h[0].length,headers[i+1]?.index??input.length).trim();});
 const c=parts.conclusion||'',e=parts.evidence||'',a=parts.action||'',body=input.replace(/(?:结论|观点|依据|原因|建议|行动)\s*:/gu,''),available=length(body)>=12;
 const order=headers.map(h=>kind(h[1])),complete=length(c)>=8&&length(e)>=12&&length(a)>=8;
 const sentences=body.split(/[。！？；.!?;\n]+/).map(s=>s.trim()).filter(s=>length(s)>0),compact=s=>s.replace(/[^\p{L}\p{N}]/gu,'');
 const terms=[['会议','议题','汇报'],['故障','系统','服务','异常'],['工作','时间','任务','安排'],['工具','引入','成本','试用'],['任务','切换','专注','团队']][topics.indexOf(topic)]||[];
 // ponytail: 固定文本特征检查，不推断语义真假或声音流畅性；需要这些能力时另加经验证的语义/语音评估。
 const checks={
  structure:[['结论段至少8个文字或数字',length(c)>=8],['依据段至少12个文字或数字',length(e)>=12],['建议段至少8个文字或数字',length(a)>=8],['三段内容完整且顺序为结论→依据→建议',complete&&order.indexOf('conclusion')<order.indexOf('evidence')&&order.indexOf('evidence')<order.indexOf('action')],['三段内容各不相同',complete&&new Set([c,e,a].map(compact)).size===3]],
  logic:[['结论与依据均有展开',length(c)>=8&&length(e)>=12],['依据含因果或条件连接词',length(e)>=12&&/因为|由于|导致|所以|因此|如果|容易|否则|为了|意味着/.test(e)],['建议含具体行动词',length(a)>=8&&/设置|安排|减少|保留|取消|明确|记录|确认|检查|验证|试用|对比|优先|停止|拆分|发送|同步|评估|分配|排查/.test(a)],['建议含时间、顺序或执行条件',length(a)>=8&&/每|分钟|秒|先|再|负责人|如果|以内|一次|至少|最多|截至|结束|开始/.test(a)],['内容含当前主题关键词',terms.some(t=>body.includes(t))]],
  fluency:[['至少两个可识别的句子或分段',sentences.length>=2],['各句长度在6至80个文字或数字之间',sentences.length>=2&&sentences.every(s=>length(s)>=6&&length(s)<=80)],['没有完全重复的句子',sentences.length>=2&&new Set(sentences.map(compact)).size===sentences.length],['明显填充词不超过1处',(body.match(/嗯|呃|那个那个|就是说就是说/gu)||[]).length<=1],['各句以标点结束',sentences.length>=2&&body.split('\n').filter(s=>length(s)>0).every(s=>/[。！？；.!?;]\s*$/.test(s))]]
 };
 return {version:languageScoringVersion,available,dimensions:Object.fromEntries(Object.entries(checks).map(([key,rows])=>[key,{label:languageScoreLabels[key],score:available?rows.filter(([,pass])=>pass).length:null,checks:rows.map(([label,pass])=>({label,passed:available&&pass}))}]))};
}
export const material={...legacyMaterial,id:'park-v2',text:legacyMaterial.text+'居民可以现场了解具体安排。'};
export const materials=[material,
 {id:'library-v1',text:'青山图书馆计划在12月推出周末阅读活动。每周六上午十点到十一点半开放活动室，每次最多接待二十名居民。报名从11月15日开始，读者可以在服务台登记，也可以通过图书馆网页报名。活动分为二十分钟安静阅读、四十分钟小组讨论和三十分钟书目分享。首月主题是城市生活，不要求参与者提前购买书籍。活动室位于二楼，工作人员会在一楼入口提供引导。每次结束后，参与者可以匿名填写建议，馆方将在下月安排中说明采纳情况。',keys:['地点：青山图书馆二楼活动室','时间：12月开始，每周六10:00—11:30','人数：每次最多20名居民','报名：11月15日起，服务台或网页','流程：阅读20分钟→讨论40分钟→分享30分钟','主题与反馈：城市生活，匿名建议在下月说明采纳情况']},
 {id:'garden-v1',text:'云桥街道准备在明年三月建立一处共享花园，选址在文化中心南侧的空地。项目预算为十二万元，其中七万元用于整理土壤和步道，三万元购买种子与工具，两万元留作后续维护。居民报名将在二月一日开始，每户可以申请一个种植区域，首次分配最多三十户。花园每周三下午由志愿者进行公共维护，其他时间由各户照顾自己的区域。入口旁会设置工具柜，借用工具需要登记归还时间。街道将在首季结束后收集居民反馈，再决定是否扩大面积。',keys:['地点：文化中心南侧空地','时间：明年3月建立，2月1日报名','预算：12万元，土壤步道7万、种子工具3万、维护2万','分配：每户一个区域，首次最多30户','维护：每周三下午公共维护，其余各户照顾','工具与后续：借用登记归还时间，首季反馈后决定扩建']}
];
export const timerElapsed=(elapsedMs,startedAt,now,targetMs)=>Math.min(targetMs,elapsedMs+(startedAt==null?0:Math.max(0,now-startedAt)));
export const memoryScoringVersion='idea-units-v2';
export const memoryEvidence=r=>r?.memoryScoringVersion?'系统信息单元评分':'历史自行核对';
export const talkIntensity=value=>({sing:'light',talk:'moderate',few:'vigorous',unknown:null})[value]??null;
export function memoryScore(recall,materialId,version=memoryScoringVersion) {
 if(!['idea-units-v1','idea-units-v2'].includes(version))throw new Error('记忆评分规则版本无效。');
 const material=[...materials,legacyMaterial].find(m=>m.id===materialId),text=(recall||'').normalize('NFKC').replace(/\s+/g,'');
 const park=[[/清河社区/,/公园/],[/11月|十一月/,/10月25日|十月二十五日|10[/.]25/],[/(?<![\d一二三四五六七八九十百千])(?:80|八十)万/],[/(?:照明|灯光).{0,35}(?:步道|道路).{0,35}(?:座椅|椅子)/],[/东门(?:保持|照常|仍然|继续|一直|正常)?(?:开放|开着)/,/西门(?:暂时|暂|保持|会|将|已|仍)?(?:关闭|封闭|不开放)/],[/社区服务中心/,/每周五|周五|星期五/,/更新|进度|公布/]];
 const rules={
  'park-v1':park,'park-v2':park,
  'library-v1':[[/青山图书馆/,/二楼|2楼/],[/12月|十二月/,/周六|星期六|礼拜六/,/10点|十点|10:00|十时/,/11点半|十一点半|11:30/],[/(?<![\d一二三四五六七八九十百千])(?:20|二十)名?人|二十名居民|20名居民/],[/11月15日|十一月十五日|11[/.]15/,/服务台/,/网页|网站/],[/(?:阅读.{0,8}(?:20|二十)|(?:20|二十).{0,8}阅读)/,/(?:讨论.{0,8}(?:40|四十)|(?:40|四十).{0,8}讨论)/,/(?:分享.{0,8}(?:30|三十)|(?:30|三十).{0,8}分享)/],[/城市生活/,/匿名/,/下月|下个月/]],
  'garden-v1':[[/文化中心/,/南侧|南边|南面/],[/明年.{0,3}(?:3月|三月)/,/2月1日|二月一日|2[/.]1(?:[^\d]|$)/],[/(?<![\d一二三四五六七八九十百千])(?:12|十二)万/,/(?:7|七)万[^，,。；;]{0,12}(?:土壤|步道)|(?:土壤|步道)[^，,。；;]{0,12}(?:7|七)万/,/(?:3|三)万[^，,。；;]{0,12}(?:种子|工具)|(?:种子|工具)[^，,。；;]{0,12}(?:3|三)万/,/(?:2|两|二)万[^，,。；;]{0,12}维护|维护[^，,。；;]{0,12}(?:2|两|二)万/],[/每户.{0,8}(?:1|一)个/,/(?<![\d一二三四五六七八九十百千])(?:30|三十)户/],[/(?:周三|星期三|礼拜三).{0,4}下午/,/公共维护|志愿者.{0,10}维护/,/各户|住户|每户/],[/工具/,/登记.{0,8}归还|归还.{0,8}登记/,/首季|第一季/,/反馈/,/扩建|扩大/]]
 }[materialId];
 if(!material||!rules)throw new Error('缺少这份材料的系统评分规则。');
 if(version==='idea-units-v2'&&materialId==='garden-v1')rules[2]=[
  /(?<![\d一二三四五六七八九十百千])(?:12|十二)万/,
  /(?<![\d一二三四五六七八九十百千])(?:7|七)万[^，,。；;]{0,12}(?:土壤|步道)|(?:土壤|步道)[^，,。；;]{0,12}(?<![\d一二三四五六七八九十百千])(?:7|七)万/,
  /(?<![\d一二三四五六七八九十百千])(?:3|三)万[^，,。；;]{0,12}(?:种子|工具)|(?:种子|工具)[^，,。；;]{0,12}(?<![\d一二三四五六七八九十百千])(?:3|三)万/,
  /(?<![\d一二三四五六七八九十百千])(?:2|两|二)万[^，,。；;]{0,12}维护|维护[^，,。；;]{0,12}(?<![\d一二三四五六七八九十百千])(?:2|两|二)万/
 ];
 // ponytail: 固定材料的关键词/关系匹配只评已识别事实，不做全文语义理解；新增材料必须随附规则和回归样例。
 const units=rules.map((patterns,i)=>{const matches=patterns.map(p=>text.match(p));const passed=matches.every(m=>m&&!/(?:不是|并非|没有)\s*$/.test(text.slice(Math.max(0,m.index-4),m.index)));return {label:material.keys[i],passed,matched:matches.filter(Boolean).map(m=>m[0])};});
 return {version,units,checked:units.map(u=>u.passed),hits:units.filter(u=>u.passed).length};
}
