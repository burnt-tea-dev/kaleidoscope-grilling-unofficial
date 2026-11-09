// Counts work in the production pure-module import and selected classifier calls.
// Run in a fresh Node process. Counts are not Bedrock memory/timing measurements.
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=process.argv[2]?resolve(process.argv[2]):fileURLToPath(new URL('..',import.meta.url));
const source=root+'/projects/grilling/gameplay_core/behavior_pack/scripts/projectile_dodge_ground_core.js';
const sourceSha256=createHash('sha256').update(readFileSync(source)).digest('hex');
const OriginalSet=globalThis.Set,originalStringify=JSON.stringify;
const counters={sets:0,entries:0,tupleStringifies:0,tupleCharacters:0};
const calls=[];
globalThis.Set=class extends OriginalSet{
 constructor(values){super(values);counters.sets++;counters.entries+=this.size;}
};
JSON.stringify=function(value,...args){
 const result=originalStringify.call(this,value,...args);
 if(Array.isArray(value)&&value.every(x=>x===null||['string','number','boolean'].includes(typeof x))){counters.tupleStringifies++;counters.tupleCharacters+=result.length;}
 return result;
};
try{
 const {classifyProjectileDodgeGroundCell:classify}=await import(pathToFileURL(source));
 const startup={...counters};
 for(const [typeId,states] of [
  ['minecraft:stone',{stone_type:'stone'}],
  ['minecraft:stone',{stone_type:'stone'}],
  ['minecraft:stone',{stone_type:'granite'}],
  ['minecraft:acacia_door',{direction:1,door_hinge_bit:true,'minecraft:cardinal_direction':'west',open_bit:true,upper_block_bit:true}],
  ['minecraft:acacia_door',{direction:0,door_hinge_bit:true,'minecraft:cardinal_direction':'west',open_bit:true,upper_block_bit:true}],
  ['minecraft:not_a_reviewed_block',{}],
 ]){const before={...counters};const result=classify({typeId,states});calls.push({typeId,states,result,work:Object.fromEntries(Object.keys(counters).map(k=>[k,counters[k]-before[k]]))});}
 JSON.stringify=originalStringify;globalThis.Set=OriginalSet;
 console.log(JSON.stringify({kind:'offline-operation-counts',sourceSha256,startup,calls},null,2));
}finally{JSON.stringify=originalStringify;globalThis.Set=OriginalSet;}
