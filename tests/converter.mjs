import fs from 'node:fs/promises';
import path from 'node:path';
import {deflateSync} from 'node:zlib';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const modules=path.resolve(process.env.ETIQUETAS_BUILD_DEPS||root,'node_modules');
await fs.mkdir(path.join(root,'validacao'),{recursive:true});
const {build}=await import(pathToFileURL(path.join(modules,'esbuild/lib/main.js')));
await build({entryPoints:[path.join(root,'src/worker.js')],bundle:true,platform:'node',format:'esm',target:'es2022',outfile:path.join(root,'validacao/worker-test.mjs'),nodePaths:[modules]});
// O renderer cria pixels sem depender de Canvas. Este adaptador de teste apenas
// recebe esses pixels; a codificação PNG e a interface do navegador NÃO são testadas aqui.
globalThis.OffscreenCanvas=class {
  constructor(w,h){this.width=w;this.height=h;}
  getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}};}
  async convertToBlob(){return new Blob([]);}
};
const {convert,sideBySide}=await import(pathToFileURL(path.join(root,'validacao/worker-test.mjs')));
const names=['simples.zpl','codigo-barras.zpl','qr-code.zpl','multiplas.zpl','imagem.zpl'];
const files=await Promise.all(names.map(async name=>({name,content:await fs.readFile(path.join(root,'exemplos',name),'utf8')})));
await fs.mkdir(path.join(root,'validacao'),{recursive:true});
let checks=0;
function check(ok,label){if(!ok)throw Error(label);checks++;}
// Na redução 2/3, a antiga amostragem pulava a linha 2 inteira.
const thin={width:12,height:18,stride:2,data:new Uint8Array(36)};
for(let x=0;x<12;x++)thin.data[2*2+(x>>3)]|=128>>(x%8);
const smallComposite=sideBySide(thin,{width:9,height:12,stride:2,data:new Uint8Array(24)},18,12);
check(smallComposite.data.some(v=>v),'Redução preserva traço horizontal fino de imagem incorporada');
const settings={width:100,height:150,dpi:203,orientation:'portrait',rotation:0};
const packing=[{id:'PEDIDO-A-TESTE',items:[{name:'Capa transparente para celular',variation:'Modelo A',quantity:2},{name:'Película de vidro',variation:'',quantity:3}]},{id:'PEDIDO-B-TESTE',items:[{name:'Cabo USB',variation:'Azul',quantity:1}]}];
const paired=await convert({files:[files[3]],settings,packing});
check(!paired.files[0].error,paired.files[0].error||'Etiquetas de produtos');
check(paired.pages===4&&paired.files[0].groups.length===2&&paired.files[0].groups.every(g=>g.count===2),'Envio e produtos intercalados');
await fs.writeFile(path.join(root,'validacao','produtos.pdf'),Buffer.from(paired.mergedPdf,'base64'));
for(const dpi of [203,300]){
 const compact=await convert({files:[files[3]],settings:{...settings,dpi,packingLayout:'side'},packing});
 check(!compact.files[0].error,compact.files[0].error||'Envio e produtos lado a lado');
 check(compact.pages===2&&compact.widthMm===150&&compact.heightMm===100&&compact.files[0].groups.every(g=>g.count===1),'Uma folha horizontal por envio');
 await fs.writeFile(path.join(root,'validacao',`horizontal-${dpi}.pdf`),Buffer.from(compact.mergedPdf,'base64'));
 const qr=await convert({files:[files[2]],settings:{...settings,dpi,packingLayout:'side'},packing:[packing[0]]});
 check(!!qr.mergedPdf,'QR horizontal');await fs.writeFile(path.join(root,'validacao',`horizontal-qr-${dpi}.pdf`),Buffer.from(qr.mergedPdf,'base64'));
}
const oversized=await convert({files:[files[0]],settings:{...settings,packingLayout:'side'},packing:[{id:'TESTE',items:Array.from({length:35},(_,i)=>({name:'Produto '+i,variation:'',quantity:1}))}]});
check(!!oversized.files[0].error&&!oversized.mergedPdf,'Horizontal rejeita lista que não cabe');
const paginated=await convert({files:[files[0]],settings,packing:[{id:'TESTE-LISTA-LONGA',items:Array.from({length:35},(_,i)=>({name:'Produto sintético '+i,variation:'',quantity:1}))}]});
check(!paginated.files[0].error&&paginated.pages>2,'Lista longa continua em folhas sem truncar');
for(const bad of [[],[{id:'TESTE',items:[{name:'Produto',variation:'',quantity:0}]}]]){const r=await convert({files:[files[0]],settings,packing:bad});check(!!r.files[0].error&&!r.mergedPdf,'Associação ausente ou quantidade inválida bloqueada');}
const escaped=await convert({files:[files[0]],settings,packing:[{id:'TESTE',items:[{name:'Produto ^XZ ^XA <script>',variation:'Acentos: ação',quantity:2}]}]});
check(!escaped.files[0].error&&escaped.pages===2,'Texto dos produtos não injeta comandos ZPL');
// Mesma estrutura do exportador, usando exclusivamente imagens sintéticas.
// 13 folhas + 13 operações de limpeza excediam o orçamento de pixels por engano.
function graphic(index) {
 const raw=Buffer.alloc(124236),x=20+(index%3)*20;
 for(let y=40;y<48;y++) for(let dx=x;dx<x+8;dx++) raw[y*102+(dx>>3)]|=128>>(dx%8);
 const b64=deflateSync(raw).toString('base64');let crc=0;
 for(const byte of Buffer.from(b64)) {crc^=byte<<8;for(let b=0;b<8;b++)crc=((crc<<1)^((crc&0x8000)?0x1021:0))&65535;}
 return `~DGR:DEMO.GRF,124236,102,:Z64:${b64}:${crc.toString(16).toUpperCase().padStart(4,'0')}^XA^MMT,Y^PON^MNY^FO0,0^XGR:DEMO.GRF,1,1^FS^PQ1,0,0,N^XZ^XA^IDR:DEMO.GRF^FS^XZ`;
}
const graphics=await convert({files:[{name:'imagens-sinteticas.zpl',content:Array.from({length:13},(_,i)=>graphic(i)).join('\n')}],settings});
check(!graphics.files[0].error,graphics.files[0].error||'Imagens Z64 com limpeza');
check(graphics.pages===13&&graphics.files[0].previews.length===13,'Limpezas não geram páginas');
check(graphics.files[0].warnings.some(w=>w.includes('13 bloco(s) de limpeza')),'Aviso de limpeza');
await fs.writeFile(path.join(root,'validacao','imagens-z64-limpeza.pdf'),Buffer.from(graphics.mergedPdf,'base64'));
const deleted=await convert({files:[{name:'recurso-apagado.zpl',content:graphic(0)+'^XA^FO0,0^XGR:DEMO.GRF,1,1^FS^XZ'}],settings});
check(!!deleted.files[0].error&&!deleted.mergedPdf,'ID realmente exclui o recurso');
const explicit='^XA^CI28^FT40,90^A0N,32,32^FDTESTE BASELINE^FS^FO50,150^BY2^BCN,100,Y,N,N^FDTESTE123456^FS^PQ1,0,1,Y^XZ';
const supported=await convert({files:[{name:'baseline.zpl',content:explicit}],settings});
check(!supported.files[0].error&&supported.pages===1,'FT explícito e PQ com parâmetros');
await fs.writeFile(path.join(root,'validacao','baseline.pdf'),Buffer.from(supported.mergedPdf,'base64'));
for(const suffix of ['^PQ2,0,1,Y','^PQ1,0,2,Y','^FT,100']) {
 const r=await convert({files:[{name:'parametros.zpl',content:'^XA^FO40,40^A0N,30,30^FDTESTE^FS'+suffix+'^XZ'}],settings});
 check(!!r.files[0].error&&!r.mergedPdf,'Parâmetros sem suporte continuam bloqueados');
}
for(const dpi of [203,300]) for(const rotation of [0,90,180,270]) {
  const result=await convert({files,settings:{...settings,dpi,rotation}});
  check(result.files.every(f=>!f.error),JSON.stringify(result.files.map(f=>f.error)));
  check(result.pages===6,'6 etiquetas');
  await fs.writeFile(path.join(root,'validacao',`etiquetas-${dpi}-${rotation}.pdf`),Buffer.from(result.mergedPdf,'base64'));
}
for(const setting of [{width:100,height:100},{width:80,height:120},{orientation:'landscape'}]) {
  const s={...settings,...setting},r=await convert({files:[files[0]],settings:s});
  check(!!r.mergedPdf,'tamanho personalizado');
  await fs.writeFile(path.join(root,'validacao',`tamanho-${r.widthMm}-${r.heightMm}.pdf`),Buffer.from(r.mergedPdf,'base64'));
}
for(const content of ['abc','^XA^FO10,10^FDteste^FS','^XZ','^XA^XA^XZ','^XA^PQ2^FO20,20^FDteste^FS^XZ','^XA^J91^FO10,10^FDteste^FS^XZ','^XA^XZ','^XA^FOoops^FDteste^FS^XZ','^XA^FO20,20^XGR:AUSENTE.GRF,1,1^FS^XZ']){
 const r=await convert({files:[{name:'invalido.zpl',content}],settings});check(!!r.files[0].error&&!r.mergedPdf,'rejeitar '+content);
}
const partial=await convert({files:[files[0],{name:'erro.txt',content:'erro'}],settings});
check(!partial.mergedPdf&&!!partial.files[0].pdf,'falha parcial');
console.log(`PASSOU: ${checks} verificações do fluxo de conversão. Canvas e file:// pendentes.`);
await fs.writeFile(path.join(root,'validacao','fluxo.json'),JSON.stringify({checks,canvas:'Adaptador sem PNG: prévia e abertura file:// ainda não verificadas automaticamente.'},null,2));

await fs.unlink(path.join(root,'validacao/worker-test.mjs'));


for(const dpi of [203,300]){
 const progress=[];const bulk=await convert({files:[{name:'lote-100.zpl',content:Array.from({length:100},(_,i)=>`^XA^FO20,20^A0N,30,30^FDORDEM ${i+1}^FS^FO20,80^BY2^BCN,70,Y,N,N^FD${String(i+1).padStart(8,'0')}^FS^XZ`).join('')}],settings:{...settings,dpi}},(...p)=>progress.push(p));
 check(bulk.pages===100&&!!bulk.mergedPdf,bulk.files[0].error||'Lote de 100 etiquetas');
 check(progress.filter(p=>p[2]).length===100,'Progresso por etiqueta');
 check(bulk.files[0].groups.every((g,i)=>g.start===i&&g.count===1),'Ordem das páginas preservada');
 await fs.writeFile(path.join(root,'validacao',`lote-100-${dpi}.pdf`),Buffer.from(bulk.mergedPdf,'base64'));
}
const shared=await convert({files:[{name:'recurso-compartilhado.zpl',content:'~DGR:COMUM.GRF,8,1,FFFFFFFFFFFFFFFF^XA^FO10,10^XGR:COMUM.GRF,1,1^FS^XZ^XA^FO30,30^XGR:COMUM.GRF,1,1^FS^XZ'}],settings});
check(shared.pages===2&&!!shared.mergedPdf,'Recurso GRF mantido entre etiquetas sequenciais');
console.log(`PASSOU: ${checks} verificações, incluindo lotes de 100 etiquetas em 203 e 300 DPI.`);
