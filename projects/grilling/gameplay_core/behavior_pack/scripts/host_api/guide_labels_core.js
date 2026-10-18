export const GUIDE_CAPABILITIES=Object.freeze(['guidebook_localized_labels_v1','guidebook_tavern_shared_projection_v1']);
/** Small public guide capability: keep the author's renderer and navigation. */
const methods={
 'Hand Threading':['手工穿串','手工穿串','Hand Threading'],
 'Grill':['烧烤架','燒烤架','Grill'],
 'Chopping Board':['砧板','砧板','Chopping Board'],
 'Millstone':['石磨','石磨','Millstone'],
 'Wok':['炒锅','炒鍋','Wok'],
 'Stockpot':['汤锅','湯鍋','Stockpot'],
 'Oil Press':['榨油器','榨油器','Oil Press'],
 'Big Vat':['大缸','大缸','Big Vat']
};
export function publicMethodLabel(method,locale){const labels=methods[method];return labels?.[locale==='zh_CN'?0:locale==='zh_TW'?1:2];}
export function publicExtensionName(extension,locale,id){const value=extension?.names?.[locale]?.[id];return typeof value==='string'&&value?value:undefined;}
// Guide locale keys use the author's names/text locale format, not token IDs.
export function publicGuideLocale(value){const locale=String(value??'').trim();return /^[a-z]{2}_[A-Z]{2}$/.test(locale)?locale:'';}

// The author's other chapters retain their renderer. Tavern owns its chapter's
// projection and UI; an acknowledged handoff avoids competing open forms.
export const TAVERN_GUIDE_CHAPTER='kaleidoscope_tavern:tavern';
export const TAVERN_GUIDE_EVENTS=Object.freeze({open:'kaleidoscope_tavern:guidebook_open',ack:'kaleidoscope_tavern:guidebook_ack',start:'kaleidoscope_tavern:guidebook_start',return:'kaleidoscope_tavern:guidebook_return'});
export const TAVERN_GUIDE_ACK_TICKS=40;
const GUIDE_LOCALES=new Set(['zh_TW','zh_CN','en_US']);
export function createTavernGuideBridge({system,world,onReturn,warn=console.warn}){
 const sessions=new Map();let sequence=0;
 const send=(player,event,row)=>player.runCommand('scriptevent '+event+' '+JSON.stringify(row));
 const clear=(session,result)=>{
  if(sessions.get(session.row.playerId)!==session)return;
  sessions.delete(session.row.playerId);system.clearRun(session.timeout);
  if(session.resolve){session.resolve(result);session.resolve=undefined;}
 };
 const receive=event=>{
  if(event.id!==TAVERN_GUIDE_EVENTS.ack&&event.id!==TAVERN_GUIDE_EVENTS.return)return;
  try{
   const row=JSON.parse(String(event.message??'')),source=event.sourceEntity,session=sessions.get(row.playerId);
   if(!session||source?.typeId!=='minecraft:player'||source.id!==row.playerId||row.api!==1||row.chapter!==TAVERN_GUIDE_CHAPTER)return;
   for(const key of ['nonce','locale','expiresTick'])if(row[key]!==session.row[key])return;
   if(event.id===TAVERN_GUIDE_EVENTS.ack){
    if(session.stage!=='waiting')return;
    if(system.currentTick>=row.expiresTick){clear(session,false);return;}
    if(row.ok===false){clear(session,false);return;}if(row.ok!==true)return;
    session.stage='active';system.clearRun(session.timeout);
    try{send(session.player,TAVERN_GUIDE_EVENTS.start,session.row);}
    catch{clear(session,false);return;}
    session.resolve?.(true);session.resolve=undefined;
   }else if(session.stage==='active'&&['back','closed','unavailable'].includes(row.outcome)){
    clear(session,true);
    if(row.outcome!=='closed')system.run(()=>{
     if(session.player.isValid===false)return;
     Promise.resolve().then(()=>onReturn(session.player,row.outcome)).catch(error=>warn('[Cookery guide] Return failed: '+String(error)));
    });
   }
  }catch{/* Invalid or unrelated event; preserve the existing session. */}
 };
 system.afterEvents.scriptEventReceive.subscribe(receive);
 world.afterEvents.playerLeave.subscribe(event=>{const session=sessions.get(event.playerId);if(session)clear(session,true);});
 return Object.freeze({
  open(player,chapter,locale){
   if(chapter!==TAVERN_GUIDE_CHAPTER||!GUIDE_LOCALES.has(locale)||player?.typeId!=='minecraft:player'||!player.id||player.isValid===false||typeof player.runCommand!=='function')return Promise.resolve(false);
   if(sessions.has(player.id))return Promise.resolve(true);
   const row={api:1,chapter,playerId:player.id,locale,nonce:'cg_'+system.currentTick.toString(36)+'_'+(++sequence).toString(36)+'_'+Math.random().toString(36).slice(2,10),expiresTick:system.currentTick+TAVERN_GUIDE_ACK_TICKS};
   return new Promise(resolve=>{
    const session={row,player,stage:'waiting',resolve};sessions.set(player.id,session);
    session.timeout=system.runTimeout(()=>clear(session,false),TAVERN_GUIDE_ACK_TICKS);
    try{send(player,TAVERN_GUIDE_EVENTS.open,row);}catch{clear(session,false);}
   });
  }
 });
}
