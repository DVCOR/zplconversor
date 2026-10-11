import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),modules=path.resolve(process.env.ETIQUETAS_BUILD_DEPS||root,'node_modules');
const {build}=await import(pathToFileURL(path.join(modules,'esbuild/lib/main.js'))),{JSDOM}=await import(pathToFileURL(path.join(modules,'jsdom/lib/api.js'))),{zipSync,strToU8}=await import(pathToFileURL(path.join(modules,'fflate/esm/index.mjs')));
globalThis.DOMParser=new JSDOM('').window.DOMParser;
const out=path.join(root,'validacao/packing-test.mjs');await build({entryPoints:[path.join(root,'src/packing.js')],bundle:true,format:'esm',platform:'node',outfile:out,nodePaths:[modules]});
const {readPacking,groupOrders,parseProducts}=await import(pathToFileURL(out));let checks=0;function check(ok){assert.ok(ok);checks++;}
const info='[1] Product Name:Capa; Variation Name:Azul; Price: R$ 9; Quantity: 2; SKU Reference No.: A; Parent SKU Reference No.: A; [2] Product Name:Película; Variation Name:; Price: R$ 5; Quantity: 3; SKU Reference No.: B; Parent SKU Reference No.: B;';
check(parseProducts(info).length===2);check(parseProducts(info)[1].quantity===3);check(parseProducts(info)[0].variation==='Azul');
const orders=groupOrders([['tracking_number','order_sn','product_info'],['RASTREIO-A','PEDIDO-A',info],['RASTREIO-A','PEDIDO-A',info]]);check(orders.length===1&&orders[0].items[0].quantity===4);
for(const rows of [[['order_sn','product_info'],['A','[1] Product Name:X; Quantity: 0;']],[['outro'],['x']],[['tracking_number','order_sn','product_info'],['TRACK','A',info],['TRACK','B',info]]]){assert.throws(()=>groupOrders(rows));checks++;}
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;'),row=(n,values)=>`<row r="${n}">${values.map((v,i)=>`<c r="${String.fromCharCode(65+i)}${n}" t="inlineStr"><is><t>${escape(v)}</t></is></c>`).join('')}</row>`;
const zip=zipSync(Object.fromEntries(Object.entries({'xl/workbook.xml':'<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="orders" r:id="rId1"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>','xl/worksheets/sheet1.xml':`<worksheet><dimension ref="A1"/><sheetData>${row(1,['tracking_number','order_sn','product_info'])}${row(2,['TRACK','PEDIDO-A',info])}</sheetData></worksheet>`}).map(([k,v])=>[k,strToU8(v)])));
check(readPacking(zip.buffer).length===1);check(readPacking(zip.buffer)[0].items[1].name==='Película');
assert.throws(()=>readPacking(new ArrayBuffer(9*1024*1024)));checks++;
if(process.env.ETIQUETAS_PLANILHA_TESTE){const buf=await fs.readFile(process.env.ETIQUETAS_PLANILHA_TESTE),data=readPacking(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength));check(data.length===18);check(data.every(o=>o.items.length&&o.items.every(i=>i.quantity>0)));}
await fs.unlink(out);console.log(`PASSOU: ${checks} verificações de planilha. Dados reais não foram salvos.`);
