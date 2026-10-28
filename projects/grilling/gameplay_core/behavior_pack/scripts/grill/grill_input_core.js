export const VANILLA_SHOVELS=Object.freeze([
 'minecraft:wooden_shovel','minecraft:stone_shovel','minecraft:iron_shovel',
 'minecraft:golden_shovel','minecraft:diamond_shovel','minecraft:netherite_shovel'
]);
export const COOKERY_EXTINGUISH_TOOLS=Object.freeze([
 'kaleidoscope_cookery:kitchen_shovel',
 'kaleidoscope_cookery:oiled_kitchen_shovel'
]);

const EXTINGUISH=new Set([...VANILLA_SHOVELS,...COOKERY_EXTINGUISH_TOOLS]);

export function isExtinguishTool(typeId){
 return EXTINGUISH.has(String(typeId??''));
}

export function isInitialBlockPress(isFirstEvent){
 return isFirstEvent!==false;
}

export function nextDurability(damage,maxDurability,amount=1,unbreakable=false){
 const current=Math.max(0,Number(damage)||0);
 const max=Math.max(0,Number(maxDurability)||0);
 const add=Math.max(0,Math.floor(Number(amount)||0));
 if(unbreakable||max<=0||add<=0)return {broken:false,damage:current};
 const next=current+add;
 return next>=max?{broken:true,damage:max}:{broken:false,damage:next};
}
