import {seed,DEMO_DAY,today} from './data.js';
import {normalizeSpace} from './model.js';
const legacyPrefix='hp-os:prototype:v1:';
// ponytail: 单用户小型历史采用一份事务快照；历史明显变大时迁移到逐实体store及索引。
const stores=['workspace','audio','drafts','backups'];
const draftCopies=new Map();
const draftQueues=new Map();
const matchesDraft=(space,key,data)=>JSON.stringify(data??null)===(draftCopies.get(space+':'+key)??'null');
const draftConflict=()=>Object.assign(new Error('另一页面已修改同一草稿，当前输入仍保留。请先复制当前输入，再刷新读取最新草稿。'),{name:'ConflictError'});
export function openDatabase(space) {
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open('hp-os-local-'+space,1);
  req.onupgradeneeded=()=>{for(const name of stores)req.result.createObjectStore(name,{keyPath:'id'});req.transaction.objectStore('audio').createIndex('resultId','resultId');};
  req.onerror=()=>reject(req.error);
  req.onblocked=()=>reject(new Error('另一个页面正在使用旧数据库，请关闭它后重试。'));
  req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>db.close();resolve(db);};
 });
}
async function transaction(space,mode,run) {
 const db=await openDatabase(space);
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(stores,mode);let value,error;
  tx.oncomplete=()=>{db.close();resolve(value);};
  tx.onabort=()=>{db.close();reject(error||tx.error||new Error('数据库事务未完成，原数据已保留。'));};
  tx.onerror=()=>{};
  const result=v=>{value=v;},abort=e=>{error=e;tx.abort();};
  try {run(tx,result,abort);}catch(e){abort(e);}
 });
}
export const readWorkspace=space=>transaction(space,'readonly',(tx,result)=>{const req=tx.objectStore('workspace').get('current');req.onsuccess=()=>result(req.result?.data||null);});
export async function loadSpace(space) {
 const stored=await readWorkspace(space);
 try {
  if(stored){const normalized=normalizeSpace(stored,space,space==='demo'?DEMO_DAY:today(stored.settings.timeZone));return JSON.stringify(normalized)===JSON.stringify(stored)?normalized:writeSpace(space,normalized);}
  const raw=localStorage.getItem(legacyPrefix+space),input=raw?JSON.parse(raw):seed(space),day=space==='demo'?DEMO_DAY:today(input.settings.timeZone);
  const data=normalizeSpace(input,space,day),audio=raw?await readLegacyAudio(space):[];
  for(const asset of audio){const result=data.records.find(r=>r.audioId===asset.id);Object.assign(asset,{resultId:result?.id||null,createdAt:result?.createdAt||new Date().toISOString(),updatedAt:result?.updatedAt||new Date().toISOString(),revision:1,deletedAt:null,durationSeconds:asset.durationSeconds??asset.duration??0,byteLength:asset.blob.size,consentGrantedAt:asset.consentGrantedAt||asset.consentAt,localOnly:true});}
  const saved=await writeSpace(space,data,{audio,backup:raw?{raw,data,audio,reason:'prototype-migration'}:false});
  // 原型只有在新库事务成功且备份已保存后才移除；失败不修改原型库。
  if(raw){localStorage.removeItem(legacyPrefix+space);await clearLegacyAudio(space);}
  return saved;
 }catch(e){e.dataRevision=stored?.revision||0;throw e;}
}
export async function writeSpace(space,input,options={}) {
 if(options.deleteDraft)await draftQueues.get(space+':'+options.deleteDraft)?.catch(()=>{});
 const data=normalizeSpace(input,space,space==='demo'?DEMO_DAY:today(input.settings.timeZone));
 const legacyRaw=options.backup||options.clear?localStorage.getItem(legacyPrefix+space):null;
 const legacyAudio=legacyRaw?await readLegacyAudio(space):[];
 const saved=await transaction(space,'readwrite',(tx,result,abort)=>{
  const workspace=tx.objectStore('workspace'),audio=tx.objectStore('audio'),backups=tx.objectStore('backups');
  const safe=fn=>()=>{try{fn();}catch(e){abort(e);}};
  const request=workspace.get('current');
  request.onsuccess=safe(()=>{
   const current=request.result?.data;
   if((current?.revision||0)!==(input.revision||0)){const e=new Error('另一个页面已更新数据。请刷新后重试，当前输入仍保留。');e.name='ConflictError';abort(e);return;}
   data.revision=(current?.revision||0)+1;
   const save=()=>{
    if(options.clear){audio.clear();backups.clear();tx.objectStore('drafts').clear();}
    if(options.deleteDraft)tx.objectStore('drafts').delete(options.deleteDraft);
    if(options.replaceAudio)audio.clear();
    for(const id of options.deleteAudio||[])audio.delete(id);
    if(options.deleteRecordIds?.length||options.deleteAudio?.length){const req=backups.get('last');req.onsuccess=()=>{const snapshot=req.result;if(!snapshot)return;const ids=new Set(options.deleteRecordIds||[]),audioIds=new Set(options.deleteAudio||[]);snapshot.data.records=snapshot.data.records.filter(r=>!ids.has(r.id)).map(r=>audioIds.has(r.audioId)?{...r,audioId:null}:r);snapshot.data.due=snapshot.data.due.filter(d=>!ids.has(d.parentId));snapshot.audio=(snapshot.audio||[]).filter(a=>!ids.has(a.resultId)&&!audioIds.has(a.id));delete snapshot.raw;backups.put(snapshot);};}
    for(const asset of options.audio||options.replaceAudio||[])audio.put(asset);
    workspace.put({id:'current',data});result(data);
   };
   const persist=()=>{if(options.backup&&current) {const req=audio.getAll();req.onsuccess=safe(()=>{backups.put({id:'last',createdAt:new Date().toISOString(),reason:'before-restore',data:current,audio:[...req.result,...legacyAudio],...(legacyRaw?{raw:legacyRaw}:{})});save();});}
   else {if(options.backup)backups.put({id:'last',createdAt:new Date().toISOString(),...(typeof options.backup==='object'?options.backup:{data:normalizeSpace({...seed('personal'),source:space},space),audio:legacyAudio,raw:legacyRaw,reason:'protected-legacy'})});save();}};
   if(options.deleteDraft){const req=tx.objectStore('drafts').get(options.deleteDraft);req.onsuccess=safe(()=>{if(!matchesDraft(space,options.deleteDraft,req.result?.data)){abort(draftConflict());return;}persist();});}else persist();
  });
 });
 if(options.deleteDraft)draftCopies.set(space+':'+options.deleteDraft,'null');
 if((options.clear||options.repair)&&legacyRaw)try{localStorage.removeItem(legacyPrefix+space);await clearLegacyAudio(space);}catch(e){e.savedData=saved;throw e;}
 return saved;
}
export const listAudio=space=>transaction(space,'readonly',(tx,result)=>{const req=tx.objectStore('audio').getAll();req.onsuccess=()=>result(req.result);});
export const getAudio=(space,id)=>transaction(space,'readonly',(tx,result)=>{const req=tx.objectStore('audio').get(id);req.onsuccess=()=>result(req.result);});
export const getSnapshot=space=>transaction(space,'readonly',(tx,result)=>{const req=tx.objectStore('backups').get('last');req.onsuccess=()=>result(req.result);});
export function draftAction(space,action,key,data) {
 const id=space+':'+key,previous=draftQueues.get(id)||Promise.resolve();
 const operation=previous.catch(()=>{}).then(()=>changeDraft(space,action,key,data));draftQueues.set(id,operation);
 return operation.finally(()=>{if(draftQueues.get(id)===operation)draftQueues.delete(id);});
}
async function changeDraft(space,action,key,data) {
 if(!['get','put','delete'].includes(action))throw new Error('草稿操作无效。');
 let copy;const value=await transaction(space,action==='get'?'readonly':'readwrite',(tx,result,abort)=>{
  const store=tx.objectStore('drafts'),req=store.get(key);req.onsuccess=()=>{try{const current=req.result?.data??null;
   if(action==='get'){copy=JSON.stringify(current);result(current??undefined);return;}
   if(!matchesDraft(space,key,current)){abort(draftConflict());return;}
   const write=action==='delete'?store.delete(key):store.put({id:key,data});write.onsuccess=()=>{copy=JSON.stringify(action==='delete'?null:data??null);};
  }catch(e){abort(e);}};
 });
 draftCopies.set(space+':'+key,copy);return value;
}
export async function protectedRaw(space) {const data=await readWorkspace(space);return localStorage.getItem(legacyPrefix+space)||JSON.stringify(data,null,2);}
function legacyDB() {
 return new Promise((resolve,reject)=>{const req=indexedDB.open('hp-os-audio-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('audio',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
}
async function readLegacyAudio(space) {
 const db=await legacyDB();
 return new Promise((resolve,reject)=>{const tx=db.transaction('audio','readonly'),req=tx.objectStore('audio').getAll();let values=[];req.onsuccess=()=>{values=req.result.filter(a=>a.space===space).map(a=>({...a,id:a.id.replace(space+':',''),source:space,resultId:null}));};tx.oncomplete=()=>{db.close();resolve(values);};tx.onabort=()=>{db.close();reject(tx.error);};});
}
async function clearLegacyAudio(space) {
 const db=await legacyDB();
 return new Promise((resolve,reject)=>{const tx=db.transaction('audio','readwrite'),req=tx.objectStore('audio').openCursor();req.onsuccess=()=>{const c=req.result;if(c){if(c.value.space===space)c.delete();c.continue();}};tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};});
}
export function download(name,text,type='application/json') {
 const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function csvCell(value) {let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
