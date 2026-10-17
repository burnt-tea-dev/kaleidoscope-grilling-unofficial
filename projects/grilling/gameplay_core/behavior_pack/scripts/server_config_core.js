/** Bounded server choices. These do not claim unavailable Java/client capabilities. */
export const CONFIG_DEFAULTS=Object.freeze({saturationMultiplier:1.25,fullHungerEating:true,enableEatingAnimations:true,enableOilBrushVisuals:true,interceptCookeryTableWhenPlacingPlate:true,graphicalEatingHud:true,enableCookeryFoodHeatAndSeasoning:true,enableSmeltedFoodHeat:false,smeltedFoodSeconds:30,contentsHelpers:2048,fixedGrillHelpers:1024,placedHelpers:1024,contentsTargetsPerTick:8});
const ranges={saturationMultiplier:[0,16],smeltedFoodSeconds:[1,86400],contentsHelpers:[32,8192],fixedGrillHelpers:[32,8192],placedHelpers:[32,8192],contentsTargetsPerTick:[1,32]};
export function configValue(key,value){
 if(!Object.hasOwn(CONFIG_DEFAULTS,key))throw Error('Unknown Grilling option');
 if(typeof CONFIG_DEFAULTS[key]==='boolean'){
  if(value===true||value==='true')return true;if(value===false||value==='false')return false;throw Error('Expected true or false');
 }
 const n=Number(value),range=ranges[key];
 if(!Number.isFinite(n)||n<range[0]||n>range[1]||(key!=='saturationMultiplier'&&!Number.isInteger(n)))throw Error('Outside option bounds');
 return n;
}
export function normalizeConfig(value){const out={...CONFIG_DEFAULTS};for(const [key,v] of Object.entries(value??{}))try{out[key]=configValue(key,v)}catch{}return out;}
