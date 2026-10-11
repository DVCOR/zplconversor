import {unzipSync} from 'fflate';
const normalize=v=>String(v??'').trim();
function xml(bytes){if(!bytes)throw Error('Estrutura XLSX incompleta.');const doc=new DOMParser().parseFromString(new TextDecoder().decode(bytes),'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('XML inválido na planilha.');return doc;}
const elements=(node,name)=>Array.from(node.getElementsByTagNameNS('*',name));
export function parseProducts(value){
 const chunks=normalize(value).split(/\[\d+\]\s*(?=Product Name:)/i).filter(v=>v.trim());
 if(!chunks.length)throw Error('Pedido sem produtos.');
 return chunks.map(chunk=>{
  const field=name=>chunk.match(new RegExp('(?:^|;)\\s*'+name+':\\s*([\\s\\S]*?)(?=;\\s*(?:Product Name|Variation Name|Price|Quantity|SKU Reference No\\.|Parent SKU Reference No\\.)\\s*:|;\\s*$|$)','i'))?.[1]?.trim()??'';
  const name=field('Product Name'),quantity=Number(field('Quantity')),variation=field('Variation Name'),sku=field('SKU Reference No\\.');
  if(!name||name.length>2000||!Number.isInteger(quantity)||quantity<1||quantity>100000)throw Error('Produto ou quantidade inválidos no campo product_info.');
  return {name,quantity,variation,sku};
 });
}
export function groupOrders(rows){
 const header=rows[0]?.map(v=>normalize(v).toLowerCase()),oi=header?.indexOf('order_sn'),pi=header?.indexOf('product_info'),ti=header?.indexOf('tracking_number');
 if(oi<0||pi<0||oi===undefined)throw Error('Use a lista de empacotamento da Shopee com order_sn e product_info.');
 const map=new Map(),tracks=new Map();
 for(let i=1;i<rows.length;i++){
  const row=rows[i];if(!row.some(v=>normalize(v)))continue;
  const id=normalize(row[oi]),tracking=ti>=0?normalize(row[ti]):'';
  if(!id||id.length>100||tracking.length>100)throw Error(`Pedido inválido na linha ${i+1}.`);
  if(tracking&&tracks.has(tracking)&&tracks.get(tracking)!==id)throw Error(`Rastreio associado a pedidos diferentes na linha ${i+1}.`);
  let items;try{items=parseProducts(row[pi]);}catch(e){throw Error(`Linha ${i+1}: ${e.message}`);}
  const order=map.get(id)||{id,tracking,items:[]};
  if(order.tracking&&tracking&&order.tracking!==tracking)throw Error(`Rastreios diferentes para um pedido na linha ${i+1}.`);
  order.tracking||=tracking;
  for(const item of items){const found=order.items.find(p=>p.name===item.name&&p.variation===item.variation&&p.sku===item.sku);if(found)found.quantity+=item.quantity;else order.items.push(item);}
  if(order.items.length>200)throw Error('Limite de 200 produtos por pedido.');
  map.set(id,order);if(tracking)tracks.set(tracking,id);
 }
 if(!map.size||map.size>5000)throw Error('A planilha deve conter de 1 a 5.000 pedidos.');
 return [...map.values()];
}
export function readPacking(buffer){
 if(buffer.byteLength>8*1024*1024)throw Error('Planilha acima de 8 MiB.');
 let size=0,count=0;
 const archive=unzipSync(new Uint8Array(buffer),{filter:entry=>{size+=entry.originalSize;count++;if(size>16*1024*1024||count>256)throw Error('Planilha descompactada acima do limite.');return /^(?:xl\/(?:worksheets\/sheet\d+\.xml|sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels))$/.test(entry.name);}});
 const strings=archive['xl/sharedStrings.xml']?elements(xml(archive['xl/sharedStrings.xml']),'si').map(si=>elements(si,'t').map(t=>t.textContent).join('')):[];
 const workbook=xml(archive['xl/workbook.xml']),rels=elements(xml(archive['xl/_rels/workbook.xml.rels']),'Relationship');
 for(const sheet of elements(workbook,'sheet')){
  const rid=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'),rel=rels.find(r=>r.getAttribute('Id')===rid);
  const target=rel?.getAttribute('Target')||'',name=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');
  if(!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)||!archive[name])continue;
  const doc=xml(archive[name]),sheetRows=elements(doc,'row');if(sheetRows.length>10001)throw Error('Limite de 10.000 linhas por aba.');
  const rows=sheetRows.map(r=>{const out=[];for(const c of elements(r,'c')){const letters=c.getAttribute('r')?.match(/^[A-Z]+/)?.[0];if(!letters)throw Error('Endereço de célula inválido.');let col=0;for(const l of letters)col=col*26+l.charCodeAt(0)-64;if(col>100)throw Error('Limite de 100 colunas.');const type=c.getAttribute('t'),v=elements(c,'v')[0]?.textContent||'';out[col-1]=type==='s'?(strings[Number(v)]??''):type==='inlineStr'?elements(c,'t').map(t=>t.textContent).join(''):v;}return Array.from(out,v=>v??'');});
  const header=rows.findIndex(r=>r.some(v=>normalize(v).toLowerCase()==='order_sn')&&r.some(v=>normalize(v).toLowerCase()==='product_info'));
  if(header>=0)return groupOrders(rows.slice(header));
 }
 throw Error('Nenhuma aba com order_sn e product_info encontrada.');
}
globalThis.readPacking=readPacking;
