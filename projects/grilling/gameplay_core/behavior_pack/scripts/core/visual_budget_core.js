export function visitUniqueTracked(tracked,cursor,seen,budget,visit){
 const scanLimit=tracked.size;
 let scanned=0,visited=0;
 while(scanned<scanLimit&&visited<budget){
  if(!cursor)cursor=tracked.values();
  let next=cursor.next();
  if(next.done){cursor=tracked.values();next=cursor.next();if(next.done)break}
  scanned++;
  const row=next.value;if(seen.has(row))continue;
  seen.add(row);visited++;visit(row);
 }
 return {cursor,visited};
}
