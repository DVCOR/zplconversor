import { renderZpl, parseDocument, createRenderSession } from 'zplr/web';
import { zlibSync } from 'fflate';

// Adaptador mínimo: o renderer usa document apenas para criar um canvas.
// OffscreenCanvas mantém toda a conversão em um worker terminável.
globalThis.document = { createElement(name) { if (name !== 'canvas') throw Error('Elemento inesperado.'); return new OffscreenCanvas(1, 1); } };
const ascii = text => new TextEncoder().encode(text);
const encode64 = bytes => { let text = ''; for(let i=0;i<bytes.length;i+=32768) text += String.fromCharCode(...bytes.subarray(i,i+32768)); return btoa(text); };
function userError(message) { const e = new Error(message); e.userError = true; throw e; }
function prepare(content) {
  let zpl = content.trim().replace(/^\uFEFF/, '');
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFD]/.test(zpl)) userError('Conteúdo binário ou codificação inválida. Use UTF-8.');
  // Exportadores envolvem a exclusão de recursos em XA/XZ. São operações
  // de memória, não folhas. Mova somente esses blocos reconhecidos para o
  // nível do job: o renderer mantém a exclusão na sequência entre downloads.
  let cleanupBlocks=0;
  zpl=zpl.replace(/\^XA\s*((?:\^ID[^\^~]+\^FS\s*)+)\^XZ/g,(_,commands)=>{cleanupBlocks++;return commands.replace(/\^FS/g,'');});
  let inside=false, count=0, end=0;
  for(const marker of zpl.matchAll(/\^X[AZ]/g)) { if(marker[0]==='^XA') { if(inside) userError('Blocos ^XA aninhados: falta ^XZ.'); inside=true; count++; } else { if(!inside) userError('^XZ sem ^XA.'); inside=false; end=marker.index+3; } }
  if(inside || !count) userError('Cada etiqueta deve começar com ^XA e terminar com ^XZ, em maiúsculas.');
  if(zpl.slice(end).trim()&&!/^\s*(?:\^ID[^\^~]+\s*)+$/.test(zpl.slice(end))) userError('Há conteúdo após o último ^XZ.');
  if(/[\^~](?:CC|CT|CD|DF|XF|FN|DT|DU|DB|DY)|\^A@/.test(zpl)) userError('Esta versão não aceita prefixos personalizados, formatos armazenados ou fontes baixadas.');
  for(const m of zpl.matchAll(/\^(FO|FT|LH)([^\^~]*)/g)) if(!/^\d{1,4},\d{1,4}(?:,[012])?$/.test(m[2].trim())) userError('Coordenadas inválidas em ^'+m[1]+'. Use x,y em dots.');
  for(const m of zpl.matchAll(/\^PQ([^\^~]*)/g)) {
    const values=m[1].trim().split(',').map(v=>v.trim());
    if(values.length>5||!/^(?:0*1)$/.test(values[0])||(values[1]&&!/^\d{1,8}$/.test(values[1]))||(values[2]&&!/^[01]$/.test(values[2]))||values.slice(3).some(v=>v&&!/^[YN]$/.test(v))) userError('^PQ inválido: use quantidade 1 e repetição 0 ou 1. Cada bloco gera uma página.');
  }
  for(const m of zpl.matchAll(/\^CI([^\^~]*)/g)) if(!['0','28'].includes(m[1].trim())) userError('Codificação ^CI não suportada nesta versão: use ^CI0 ou ^CI28 e arquivo UTF-8.');
  for(const m of zpl.matchAll(/\^GF([^\^~]*)/g)) if(!m[1].startsWith('A,')) userError('Imagem ^GF não suportada: use ^GFA em ASCII, RLE, B64 ou Z64.');
  const parsed = parseDocument(zpl);
  if(parsed.labels.some(label => !label.explicit)) userError('Conteúdo de etiqueta fora de ^XA/^XZ.');
  return {zpl,count,cleanupBlocks};
}
function rotate(raster, rotation) {
  if(!rotation) return raster;
  const width=rotation%180?raster.height:raster.width, height=rotation%180?raster.width:raster.height;
  const stride=Math.ceil(width/8), data=new Uint8Array(stride*height);
  for(let y=0;y<raster.height;y++) for(let x=0;x<raster.width;x++) {
    if(!(raster.data[y*raster.stride+(x>>3)] & (128>>(x%8)))) continue;
    const dx=rotation===90?raster.height-1-y:rotation===180?raster.width-1-x:y;
    const dy=rotation===90?x:rotation===180?raster.height-1-y:raster.width-1-x;
    data[dy*stride+(dx>>3)] |=128>>(dx%8);
  }
  return {width,height,stride,data,bitOrder:'msb-first'};
}
export function sideBySide(shipping,products,width,height){
 const stride=Math.ceil(width/8),data=new Uint8Array(stride*height),half=Math.floor(width/2);
 const put=(x,y)=>{data[y*stride+(x>>3)]|=128>>(x%8);};
 const scale=Math.min(half/shipping.width,height/shipping.height),w=Math.floor(shipping.width*scale),h=Math.floor(shipping.height*scale),left=Math.floor((half-w)/2),top=Math.floor((height-h)/2);
 // Integre a área de origem: escolher apenas um pixel descartava traços finos
 // dos números em imagens GRF quando o envio era reduzido para a metade.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const x0=x/scale,x1=Math.min(shipping.width,(x+1)/scale),y0=y/scale,y1=Math.min(shipping.height,(y+1)/scale);let ink=0;
   for(let sy=Math.floor(y0);sy<Math.ceil(y1);sy++)for(let sx=Math.floor(x0);sx<Math.ceil(x1);sx++){
     if(shipping.data[sy*shipping.stride+(sx>>3)]&(128>>(sx%8)))ink+=(Math.min(x1,sx+1)-Math.max(x0,sx))*(Math.min(y1,sy+1)-Math.max(y0,sy));
   }
   if(ink/((x1-x0)*(y1-y0))>=.25)put(left+x,top+y);
 }
 for(let y=0;y<products.height;y++)for(let x=0;x<products.width;x++)if(products.data[y*products.stride+(x>>3)]&(128>>(x%8)))put(half+x,y);
 return {width,height,stride,data,bitOrder:'msb-first'};
}
async function png(raster) {
  const canvas=new OffscreenCanvas(raster.width,raster.height), ctx=canvas.getContext('2d'), image=ctx.createImageData(raster.width,raster.height);
  for(let y=0;y<raster.height;y++) for(let x=0;x<raster.width;x++) { const p=(y*raster.width+x)*4, color=(raster.data[y*raster.stride+(x>>3)] & (128>>(x%8)))?0:255; image.data[p]=image.data[p+1]=image.data[p+2]=color; image.data[p+3]=255; }
  ctx.putImageData(image,0,0); return encode64(new Uint8Array(await (await canvas.convertToBlob({type:'image/png'})).arrayBuffer()));
}
export function pdf(rasters,width,height) {
  return compressedPdf(rasters.map(r=>({width:r.width,height:r.height,bytes:zlibSync(r.data)})),width,height);
}
function compressedPdf(rasters,width,height) {
  const chunks=[], offsets=[0]; let length=0;
  const write=value=>{const bytes=typeof value==='string'?ascii(value):value; chunks.push(bytes); length+=bytes.length;};
  const object=(id,dict,bytes)=>{offsets.push(length);write(`${id} 0 obj\n${dict}\n`);if(bytes){write('stream\n');write(bytes);write('\nendstream\n');}write('endobj\n');};
  const w=(width*72/25.4).toFixed(8),h=(height*72/25.4).toFixed(8);
  write('%PDF-1.4\n');object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,`<< /Type /Pages /Count ${rasters.length} /Kids [${rasters.map((r,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
  rasters.forEach((r,i)=>{const id=3+i*3,bytes=r.bytes,content=ascii(`q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`);
    object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`);
    object(id+1,`<< /Type /XObject /Subtype /Image /Width ${r.width} /Height ${r.height} /ColorSpace /DeviceGray /BitsPerComponent 1 /Decode [1 0] /Interpolate false /Filter /FlateDecode /Length ${bytes.length} >>`,bytes);
    object(id+2,`<< /Length ${content.length} >>`,content);
  });
  const xref=length;write(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);for(const offset of offsets.slice(1))write(String(offset).padStart(10,'0')+' 00000 n \n');write(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const result=new Uint8Array(length);let position=0;for(const chunk of chunks){result.set(chunk,position);position+=chunk.length;}return encode64(result);
}
export async function convert(request,onProgress=()=>{}) {
  const {files,settings:s}=request;
  if(!Array.isArray(files)||!files.length||files.length>100) userError('Selecione de 1 a 100 arquivos.');
  if(!s||![203,300].includes(s.dpi)||![0,90,180,270].includes(s.rotation)||!['portrait','landscape'].includes(s.orientation)||!Number.isFinite(s.width)||!Number.isFinite(s.height)||s.width<20||s.width>200||s.height<20||s.height>300)userError('Configurações inválidas. Largura 20–200 mm; altura 20–300 mm.');
  let bytes=0; for(const f of files){if(typeof f.name!=='string'||f.name.length>180||! /\.(zpl|txt)$/i.test(f.name)||typeof f.content!=='string')userError('Arquivo inválido: use .zpl ou .txt.');const n=ascii(f.content).length;if(n<1||n>32*1024*1024)userError('Cada arquivo deve ter de 1 byte a 32 MiB.');bytes+=n;}if(bytes>128*1024*1024)userError('Sessão acima de 128 MiB.');
  const compact=!!request.packing&&s.packingLayout==='side';
  const width=(compact?'portrait':s.orientation)==='portrait'?Math.min(s.width,s.height):Math.max(s.width,s.height),height=(compact?'portrait':s.orientation)==='portrait'?Math.max(s.width,s.height):Math.min(s.width,s.height);
  const pxW=Math.round(width*s.dpi/25.4),pxH=Math.round(height*s.dpi/25.4),outW=compact?height:(s.rotation%180?height:width),outH=compact?width:(s.rotation%180?width:height);
  const results=[],all=[];let count=0,shippingCount=0,shippingOffset=0;
  for(let index=0;index<files.length;index++) {
    const file=files[index];onProgress(index+1,files.length);
    try {
      const {zpl,count:n,cleanupBlocks}=prepare(file.content);const orderOffset=shippingOffset;shippingOffset+=n;count+=n;shippingCount+=n;
      const renderer=createRenderSession();
      const rasters=[],groups=[],previews=[],diagnostics=[];
      let start=0,i=0;
      for(const marker of zpl.matchAll(/\^XZ/g)){
      const end=marker.index+3,chunk=zpl.slice(start,end);start=end;
      onProgress(index+1,files.length,i+1,n);
      const job=await renderer.render(chunk,{width:pxW,height:pxH,printDensity:s.dpi===203?8:12,strict:true,limits:{maxDimension:4096,maxPixels:24_000_000,maxLabels:1,maxGraphicBytes:512_000,maxSessionBytes:4_000_000,maxTemplateDepth:4,maxExpandedCommands:20_000}});
      // O catálogo marca CI/GF como parciais mesmo nos formatos implementados.
      // prepare restringe esses comandos aos subconjuntos que este app aceita.
      const fatal=job.diagnostics.filter(d=>d.severity==='error'||['UNKNOWN_COMMAND','UNSUPPORTED_COMMAND'].includes(d.code)||(d.code==='PARTIALLY_SUPPORTED_COMMAND'&&!['^CI','^GF','^FT'].includes(d.command)));
      if(fatal.length)userError('ZPL não convertido: '+[...new Set(fatal.map(d=>(d.command?d.command+' · ':'')+d.code))].slice(0,8).join(', ')+'. Consulte as limitações no README.');
      diagnostics.push(...job.diagnostics);
      if(job.labels.length!==1)userError('Quantidade de etiquetas divergente. Use um bloco por página.');
        const label=job.labels[0];if(!label.raster.data.some(v=>v))userError('Etiqueta vazia: nenhum pixel imprimível reconhecido.');
        const group={start:rasters.length,count:1};if(!compact)rasters.push(rotate(label.raster,s.rotation));
        if(request.packing){
          const order=request.packing[orderOffset+i];if(!order)userError('Selecione o pedido de cada etiqueta antes de gerar o PDF com produtos.');
          const extra=await packingRasters(order,compact?Math.floor(pxH/2):pxW,compact?pxW:pxH,s.dpi);
          if(compact){if(extra.length!==1)userError('Produtos não cabem na metade da etiqueta. Use etiquetas separadas ou uma folha maior.');rasters.push(sideBySide(label.raster,extra[0],pxH,pxW));}
          else{
          count+=extra.length;
          for(const r of extra)rasters.push(rotate(r,s.rotation));group.count+=extra.length;
          }
        }
        groups.push(group);
        for(let p=group.start;p<rasters.length;p++){const r=rasters[p];previews.push(await png(r));rasters[p]={width:r.width,height:r.height,bytes:zlibSync(r.data)};}
        i++;
      }
      await renderer.reset();
      const warnings=['Renderizador ZPLr: fontes aproximadas. Confira a prévia antes de imprimir.'];
      if(compact)warnings.push('Envio reduzido proporcionalmente para a metade esquerda; produtos à direita. Confira os códigos na impressão. Neste layout, orientação e rotação de saída são fixas em horizontal.');
      if(cleanupBlocks)warnings.push(`${cleanupBlocks} bloco(s) de limpeza ^ID processado(s), sem gerar páginas vazias.`);
      if(/\^FT/.test(zpl))warnings.push('^FT com coordenadas explícitas: confira alinhamento e linha de base dos textos na prévia.');
      if(/\^(PW|LL)/.test(zpl))warnings.push('^PW/^LL: a folha segue suas configurações. Conteúdo fora da folha será cortado.');
      const neutral=[...new Set(diagnostics.filter(d=>d.code==='NON_RENDERING_COMMAND').map(d=>d.command))];if(neutral.length)warnings.push('Comandos exclusivos de impressora sem efeito no PDF: '+neutral.join(', '));
      const other=[...new Set(diagnostics.filter(d=>d.severity==='warning').map(d=>d.code))];if(other.length)warnings.push('Avisos do renderizador: '+other.join(', '));
      results.push({name:file.name,error:null,warnings,previews,groups,pdf:compressedPdf(rasters,outW,outH)});for(const page of rasters)all.push(page);
    }catch(e){results.push({name:file.name,error:e.userError?e.message:'Falha ao renderizar. Verifique comandos, imagens e códigos.',warnings:[],previews:[],pdf:null});}
  }
  return {files:results,mergedPdf:results.some(f=>f.error)||!all.length?null:compressedPdf(all,outW,outH),widthMm:outW,heightMm:outH,pages:all.length};
}

async function packingRasters(order,width,height,dpi){
  if(typeof order.id!=='string'||order.id.length>100||!Array.isArray(order.items)||!order.items.length||order.items.length>200)userError('Pedido de separação inválido.');
  const scale=dpi/203,margin=Math.round(scale*32),body=Math.round(scale*34),quantityFont=Math.round(scale*38),small=Math.round(scale*24),title=Math.round(scale*30),gap=Math.round(scale*20),available=width-margin*2;
  const wrap=(text,font)=>{const chars=Math.floor(available/(font*.8));if(chars<8)userError('Etiqueta pequena demais para a lista de produtos. Aumente o tamanho.');const lines=[];let rest=String(text).replace(/\s+/g,' ').trim();while(rest.length>chars){let end=rest.lastIndexOf(' ',chars);if(end<chars/3)end=chars;lines.push(rest.slice(0,end));rest=rest.slice(end).trimStart();}if(rest)lines.push(rest);return lines;};
  const textRows=(text,font)=>wrap(text,font).map(text=>({text,font,height:Math.ceil(font*1.4)}));
  let total=0;const blocks=[];
  for(const item of order.items){
    if(typeof item.name!=='string'||!item.name.trim()||item.name.length>2000||typeof item.variation!=='string'||item.variation.length>2000||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>100000)userError('Produto ou quantidade inválidos.');
    total+=item.quantity;
    blocks.push([...textRows(`QUANTIDADE: ${item.quantity}`,quantityFont),...textRows(item.name,body),...(item.variation?textRows('Variação: '+item.variation,small):[]),{divider:true,height:gap*2}]);
  }
  const header=[...textRows('PRODUTOS',title),...textRows('Pedido: '+order.id,small),...textRows(`Total: ${total} unidades`,small),{height:gap}];
  const headerHeight=header.reduce((n,r)=>n+r.height,0),capacity=height-margin*2-headerHeight-Math.ceil(small*1.4);
  if(capacity<quantityFont*3)userError('Etiqueta pequena demais para a lista de produtos. Aumente o tamanho.');
  const pages=[[]];let used=0;
  for(const block of blocks){
    const blockHeight=block.reduce((n,r)=>n+r.height,0);
    if(used&&blockHeight<=capacity&&used+blockHeight>capacity){pages.push([]);used=0;}
    for(const row of block){if(row.divider&&used+row.height>capacity)continue;if(used+row.height>capacity){pages.push([]);used=0;}pages.at(-1).push(row);used+=row.height;}
  }
  if(pages.length>10)userError('Lista de produtos acima de 10 folhas por pedido.');
  // Todos os bytes são escapados com FH, inclusive acentos e delimitadores ZPL.
  const field=text=>'\\'+[...ascii(text)].map(b=>b.toString(16).padStart(2,'0')).join('\\');
  const out=[];
  for(let p=0;p<pages.length;p++){
    let y=margin;const commands=[];
    for(const row of [...header,...pages[p]]){
      if(row.text)commands.push(`^FO${margin},${y}^A0N,${row.font},${row.font}^FH\\^FD${field(row.text)}^FS`);
      else if(row.divider)commands.push(`^FO${margin},${y+gap}^GB${available},${Math.max(1,Math.round(scale*2))},${Math.max(1,Math.round(scale*2))}^FS`);
      y+=row.height;
    }
    if(pages.length>1)commands.push(`^FO${margin},${height-margin-Math.ceil(small*1.4)}^A0N,${small},${small}^FH\\^FD${field(`Folha ${p+1} de ${pages.length}`)}^FS`);
    const rendered=await renderZpl('^XA^CI28'+commands.join('')+'^XZ',{width,height,printDensity:dpi===203?8:12,strict:true});
    const errors=rendered.diagnostics.filter(d=>d.severity==='error');if(errors.length)userError('Falha ao desenhar produtos: '+[...new Set(errors.map(d=>d.code))].join(', '));out.push(rendered.labels[0].raster);
  }
  return out;
}

globalThis.onmessage=async ({data})=>{try{globalThis.postMessage({result:await convert(data,(current,total,label,labels)=>globalThis.postMessage({progress:{current,total,label,labels}}))});}catch(e){globalThis.postMessage({error:e.userError?e.message:'Falha no renderizador do navegador.'});}};
