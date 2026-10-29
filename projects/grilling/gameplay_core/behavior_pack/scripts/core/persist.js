import {PERSISTED_KEY} from './persist_keys.js';
let world;
export function configureItemDataWorld(host){world=host;}
/** Shared owner for world-scoped dynamic properties. Keep values in their
 * existing raw representation; domain code owns its established codecs.
 */
export function getWorldProperty(host,key){return host.getDynamicProperty(key);}
export function setWorldProperty(host,key,value){return host.setDynamicProperty(key,value);}
export function getWorldPropertyIds(host){return host.getDynamicPropertyIds?.();}
export function parseWorldJson(raw){return raw===undefined?undefined:JSON.parse(String(raw));}
export function stringifyWorldJson(value){return JSON.stringify(value);}
// Stable Bedrock forbids ItemStack dynamic properties when maxAmount > 1.
// Keep stackable item metadata in immutable, content-addressed world records.
// A short formatting-only lore token travels with the item through vanilla
// inventories, drops, table displays and reloads. Visible lore stays unchanged.
const PREFIX='§r§0§r§1§r§2',KEY=PERSISTED_KEY.GRILLING_ITEM_METADATA_PREFIX;
function text(v){if(typeof v==='string')return v;if(v?.text!==undefined)return String(v.text);if(v?.rawtext)return v.rawtext.map(text).join('');return '';}
function rawLore(stack){return stack?.getRawLore?.()??[];}
function token(stack){for(const row of rawLore(stack)){const s=text(row);if(!s.startsWith(PREFIX))continue;const value=s.slice(PREFIX.length).replace(/§r$/,'').replace(/§/g,'');if(/^[0-9a-f]{16}$/.test(value))return value;}return undefined;}
function visibleRaw(stack){return rawLore(stack).filter(x=>!text(x).startsWith(PREFIX));}
function hash(s,seed){let h=seed;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
function metadata(stack){const id=token(stack);if(!id)return {};const saved=getWorldProperty(world,KEY+id);if(typeof saved!=='string')throw Error('Missing Grilling item metadata '+id);const data=JSON.parse(saved);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid Grilling item metadata '+id);return data;}
function store(stack,data){
 const lore=visibleRaw(stack),keys=Object.keys(data).sort();
 if(!keys.length){stack.setLore(lore);return;}
 const payload=JSON.stringify(Object.fromEntries(keys.map(k=>[k,data[k]])));
 let salt=0,id;
 while(true){id=hash(payload,2166136261+salt)+hash(payload,2246822507+salt);const old=getWorldProperty(world,KEY+id);if(old===undefined||old===payload)break;salt++;}
 // Never overwrite a player's visible lore to make room for our token.
 if(lore.length>=20)throw Error('Grilling metadata requires one free lore line');
 setWorldProperty(world,KEY+id,payload);
 stack.setLore([...lore,{text:PREFIX+Array.from(id,c=>'§'+c).join('')+'§r'}]);
}
export function getItemProperty(stack,id){if(!stack)return undefined;return stack.maxAmount>1?metadata(stack)[id]:stack.getDynamicProperty(id);}
export function getItemPropertyIds(stack){if(!stack)return [];return stack.maxAmount>1?Object.keys(metadata(stack)):stack.getDynamicPropertyIds();}
export function setItemProperty(stack,id,value){
 if(stack.maxAmount<=1){stack.setDynamicProperty(id,value);return;}
 try{const data=metadata(stack);if(value===undefined)delete data[id];else data[id]=value;store(stack,data);}catch(error){console.error('[Grilling item data] '+error);throw error;}
}
export function getItemLore(stack){return visibleRaw(stack).map(text);}
export function setItemLore(stack,lore){const id=token(stack);const clean=lore.filter(x=>!text(x).startsWith(PREFIX));stack.setLore(id?[...clean,{text:PREFIX+Array.from(id,c=>'§'+c).join('')+'§r'}]:clean);}

export function getItemRawLore(stack){return visibleRaw(stack);}
