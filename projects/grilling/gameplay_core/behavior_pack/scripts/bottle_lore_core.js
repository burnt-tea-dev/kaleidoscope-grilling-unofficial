import {seasoningLore} from './localized_lore_core.js';
// Only documented RawMessage serialization equivalences are recognized here.
// Unknown/mixed custom messages remain structural values, never flattened text.
const OWNED=new Set(['ingredients','ready','missing_base'].map(k=>'tooltip.kaleidoscope_grilling.seasoning.'+k));
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function singleNode(value){
 let node=value;
 for(let depth=0;depth<16;depth++){
  if(!record(node)||Object.keys(node).length!==1||!Array.isArray(node.rawtext)||node.rawtext.length!==1)return node;
  node=node.rawtext[0];
 }
 return undefined;
}
function literal(value){
 const node=singleNode(value);
 if(typeof node==='string')return node;
 return record(node)&&Object.keys(node).length===1&&typeof node.text==='string'?node.text:undefined;
}
function argumentsOf(value){
 if(Array.isArray(value)&&value.every(v=>typeof v==='string'))return [...value];
 if(!record(value)||Object.keys(value).length!==1||!Array.isArray(value.rawtext))return undefined;
 const args=value.rawtext.map(literal);return args.every(v=>v!==undefined)?args:undefined;
}
function knownMessage(value){
 const node=singleNode(value);
 const text=literal(node);if(text!==undefined)return {text};
 if(!record(node)||typeof node.translate!=='string'||Object.keys(node).some(k=>k!=='translate'&&k!=='with'))return undefined;
 if(!Object.hasOwn(node,'with'))return {translate:node.translate};
 const args=argumentsOf(node.with);return args===undefined?undefined:{translate:node.translate,with:args};
}
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(record(value))return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
 return value;
}
export function isOwnedBottleLore(line){const node=knownMessage(line);return !!node&&OWNED.has(node.translate);}
// Comparison only: never rewrite stored lore or broaden ownership matching.
export function canonicalLoreForComparison(lines){return lines.map(line=>stable(knownMessage(line)??line));}
export function bottleLoreSignature(lines){return JSON.stringify(canonicalLoreForComparison(lines));}
export function bottleLoreMismatch(expected,actual){
 const count=Math.max(expected.length,actual.length);
 for(let i=0;i<count;i++)if(bottleLoreSignature([expected[i]])!==bottleLoreSignature([actual[i]])){
  // No custom text, token or metadata values enter diagnostic messages.
  const shape=line=>line===undefined?'missing':isOwnedBottleLore(line)?'owned':Array.isArray(line?.rawtext)?'rawtext':typeof line;
  return 'line '+i+' ('+shape(expected[i])+' -> '+shape(actual[i])+')';
 }
 return 'line count';
}

// Cookery used to prepend an English string without removing translated or
// engine-wrapped prior Uses lines. Match only our known single-node forms;
// preserve custom/mixed RawMessages and every non-Uses line unchanged.
export function isOwnedSeasoningUsesLore(line){
 const node=knownMessage(line);
 return node?.translate==='tooltip.kaleidoscope_grilling.seasoning.uses'
  ||(typeof node?.text==='string'&&/^§7Uses: (?:[0-9]|1[0-6])\/16$/.test(node.text));
}
export function replaceSeasoningUsesLore(lines,remaining){
 return [...seasoningLore(remaining),...lines.filter(line=>!isOwnedSeasoningUsesLore(line))];
}
