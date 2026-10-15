/** Indexed stable min-heap: one node per key, including replacements/cancels. */
export class TimedWorkQueue{
 constructor(){this.heap=[];this.live=new Map();this.serial=0;}
 before(a,b){return a.at<b.at||(a.at===b.at&&a.serial<b.serial);}
 schedule(key,at){
  const old=this.live.get(key);if(old?.at===at)return;
  if(old){old.at=at;old.serial=++this.serial;this.repair(old.index);return;}
  const node={key,at,serial:++this.serial,index:this.heap.length};
  this.live.set(key,node);this.heap.push(node);this.repair(node.index);
 }
 repair(index){
  const node=this.heap[index];let i=index;
  if(i&&this.before(node,this.heap[(i-1)>>1])){
   while(i){const p=(i-1)>>1;if(!this.before(node,this.heap[p]))break;this.heap[i]=this.heap[p];this.heap[i].index=i;i=p;}
  }else{
   while(i*2+1<this.heap.length){let c=i*2+1;if(c+1<this.heap.length&&this.before(this.heap[c+1],this.heap[c]))c++;if(!this.before(this.heap[c],node))break;this.heap[i]=this.heap[c];this.heap[i].index=i;i=c;}
  }
  this.heap[i]=node;node.index=i;
 }
 remove(index){
  const node=this.heap[index],last=this.heap.pop();this.live.delete(node.key);
  if(index<this.heap.length){this.heap[index]=last;last.index=index;this.repair(index);}
  return node;
 }
 cancel(key){const node=this.live.get(key);if(node)this.remove(node.index);}
 pop(){return this.heap.length?this.remove(0):undefined;}
 take(now,budget){const out=[];while(this.heap.length&&out.length<budget){if(this.heap[0].at>now)break;out.push(this.pop().key);}return out;}
 get size(){return this.live.size;}
}
