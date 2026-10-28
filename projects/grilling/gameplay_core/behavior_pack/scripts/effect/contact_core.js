export function overlappedBlockPositions({center,extent}){
 const min={x:Math.floor(center.x-extent.x+.0001),y:Math.floor(center.y-extent.y+.0001),z:Math.floor(center.z-extent.z+.0001)};
 const max={x:Math.floor(center.x+extent.x-.0001),y:Math.floor(center.y+extent.y-.0001),z:Math.floor(center.z+extent.z-.0001)};
 const out=[];
 for(let x=min.x;x<=max.x;x++)for(let y=min.y;y<=max.y;y++)for(let z=min.z;z<=max.z;z++)out.push({x,y,z});
 return out;
}
