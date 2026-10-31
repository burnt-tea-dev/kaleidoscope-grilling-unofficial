const N='kaleidoscope_grilling:';
export function plateRows(variant=0){
 const foods=['minecraft:apple','minecraft:carrot','minecraft:beef','minecraft:potato','minecraft:chicken','minecraft:bread'];
 return Array.from({length:5},(_,row)=>{
  const raw=Array.from({length:3},(_,cell)=>({id:foods[(variant+row+cell)%foods.length],edible:true,nutrition:2,saturation:.3}));
  const cooked=raw.map(value=>({...value,id:value.id==='minecraft:beef'?'minecraft:cooked_beef':value.id==='minecraft:chicken'?'minecraft:cooked_chicken':value.id}));
  return {id:N+'secret_skewer',native:{version:1,id:N+'secret_skewer',name:'Snapshot '+variant+'/'+row,props:{
   [N+'skewer_ingredients']:JSON.stringify(raw),[N+'secret_cooked']:row%2===0,
   [N+'secret_cooked_ingredients']:JSON.stringify(cooked),[N+'model_variants']:JSON.stringify([4+(row+variant)%3,4+(row+variant+1)%3,4+(row+variant+2)%3]),'snapshot_probe:foreign':'preserve'
  }}};
 });
}
