const $ = id => document.getElementById(id);
let files = [], result = null, busy = false, controller = null, session = 0;
let editorEntry = null, previewPages = [], previewIndex = 0;
let packingOrders=null,packingAssignments=[],packingReady=false;
const urls = new Set();
function message(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : busy ? 'busy' : ''; }
function release() { for (const url of urls) URL.revokeObjectURL(url); urls.clear(); }
function dimensions() { const w=Number($('width').value),h=Number($('height').value),landscape=$('orientation').value==='landscape',rotated=Number($('rotation').value)%180; let width=landscape?Math.max(w,h):Math.min(w,h),height=landscape?Math.min(w,h):Math.max(w,h); if(rotated)[width,height]=[height,width]; $('dimensions').textContent=`PDF · ${width} × ${height} mm · ${$('dpi').value} DPI`; }
function ready() { $('convert').disabled = busy || (!files.length && !$('paste').value.trim()); }
function invalidate() { $('print-options').hidden=true; document.getElementById('print-pages')?.remove(); document.getElementById('print-size')?.remove(); release(); result = null; previewPages=[]; previewIndex=0;packingAssignments=[];packingReady=false;$('packing-confirm').checked=false;$('packing-links').replaceChildren();$('packing-actions').hidden=true; $('previews').replaceChildren(); $('preview-controls').hidden=true; $('empty').hidden = false; $('download').disabled = true; $('page-count').textContent = '0 etiquetas'; dimensions(); packingButtons(); }
function showPreview() {
  $('previews').replaceChildren(); if(!previewPages.length)return;
  const page=previewPages[previewIndex],figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');
  img.src=page.url; img.alt=`Prévia da etiqueta ${previewIndex+1}`; caption.textContent=`${previewIndex+1} · ${page.name}`;
  const zoom=$('zoom').value;
  if(zoom!=='fit'){figure.className='zoomed';img.style.width=(page.width*Number(zoom)/100)+'px';}
  figure.append(img);for(const url of page.extraUrls||[]){const block=document.createElement('div'),label=document.createElement('strong'),extra=document.createElement('img');block.className='packing-paper';label.textContent='Produtos desta etiqueta';extra.src=url;extra.alt='Etiqueta de produtos e quantidades';if(zoom!=='fit')extra.style.width=img.style.width;block.append(label,extra);figure.append(block);}figure.append(caption);$('previews').append(figure);
  $('page-position').textContent=`${previewIndex+1} de ${previewPages.length}`;
  $('previous-page').disabled=previewIndex===0;$('next-page').disabled=previewIndex===previewPages.length-1;
  document.querySelector('.preview-stage').scrollTop=0;document.querySelector('.preview-stage').scrollLeft=0;
}
function syncEditor() {
  const content=$('paste').value;
  if(!content.trim())return true;
  const existing=editorEntry&&files.includes(editorEntry);
  const bytes=new TextEncoder().encode(content).length;
  const total=files.filter(f=>f!==editorEntry).reduce((n,f)=>n+new TextEncoder().encode(f.content).length,bytes);
  if(bytes>32*1024*1024||total>128*1024*1024||(!existing&&files.length>=100)){message('Conteúdo colado acima do limite: 32 MiB por arquivo, 100 arquivos / 128 MiB por sessão.',true);return false;}
  if(existing)editorEntry.content=content;else{editorEntry={name:'conteudo-colado.zpl',content};files.push(editorEntry);}
  return true;
}
function blobUrl(base64, mime) { const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bytes], { type: mime })); urls.add(url); return url; }
function download(base64, name) { const url = blobUrl(base64, 'application/pdf'); const a = document.createElement('a'); a.href = url; a.download = name; a.hidden=true; document.body.append(a); a.click(); a.remove(); setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 30000); }
function setBusy(value) { busy = value; ready(); $('cancel').hidden = !busy; for (const id of ['size', 'dpi', 'orientation', 'rotation', 'upload', 'add-paste', 'sample','paste','packing-upload','packing-remove','packing-order','packing-confirm','packing-layout']) $(id).disabled = busy; $('width').disabled = busy || $('size').value !== 'custom'; $('height').disabled = busy || $('size').value !== 'custom';for(const select of $('packing-links').querySelectorAll('select'))select.disabled=busy;packingButtons();renderFiles(); }
function renderFiles() {
  $('files').replaceChildren();
  files.forEach((file, index) => {
    const row = document.createElement('div'); row.className = 'file'; const icon = document.createElement('span'); icon.className = 'file-icon'; icon.textContent = 'ZPL';
    const body = document.createElement('div'); const name = document.createElement('div'); name.className = 'file-name'; name.textContent = file.name;
    const info = document.createElement('small'); info.textContent = `${index + 1} na ordem · ${(new TextEncoder().encode(file.content).length / 1024).toFixed(1)} KiB`; body.append(name, info);
    const entry = result?.files[index]; if (entry) { const note = document.createElement('small'); note.className = entry.error ? 'error' : ''; note.textContent = entry.error || `${entry.previews.length} etiqueta(s) convertida(s)`; body.append(note); if(entry.warnings.length){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Observações da conversão';details.append(summary);for(const warning of entry.warnings){const w=document.createElement('small');w.className='warning';w.textContent=warning;details.append(w);}body.append(details);} if (entry.pdf) { const btn = document.createElement('button'); btn.className = 'file-download'; btn.textContent = '↓ Baixar PDF deste arquivo'; btn.onclick = () => download(entry.pdf, file.name.replace(/\.(zpl|txt)$/i, '') + '.pdf'); body.append(btn); } }
    const remove = document.createElement('button'); remove.textContent = '×'; remove.setAttribute('aria-label', `Remover ${file.name}`); remove.disabled = busy; remove.onclick = () => { if(file===editorEntry){editorEntry=null;$('paste').value='';} files.splice(index, 1); invalidate(); renderFiles(); ready(); message('Arquivo removido. Gere novamente para atualizar o PDF.'); };
    row.append(icon, body, remove); $('files').append(row);
  });
}
async function addFiles(selected) {
  if (busy) return; const current = session; const additions = []; const errors = []; setBusy(true); message('Lendo arquivos no seu computador…');
  let selectedBytes = new TextEncoder().encode(files.map(f => f.content).join('')).length;
  for (const file of selected) {
    if (!/\.(zpl|txt)$/i.test(file.name)) { errors.push(`${file.name}: extensão inválida.`); continue; }
    if (file.size < 1 || file.size > 32 * 1024 * 1024) { errors.push(`${file.name}: limite de 32 MiB ou arquivo vazio.`); continue; }
    if (files.length + additions.length >= 100 || selectedBytes + file.size > 128 * 1024 * 1024) { errors.push('Limite da sessão atingido: 100 arquivos / 128 MiB.'); break; }
    selectedBytes += file.size;
    try { const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); additions.push({ name: file.name, content }); } catch { errors.push(`${file.name}: salve em UTF-8.`); }
  }
  if (current !== session) return;
  for (const file of additions) { if (files.length >= 100 || new TextEncoder().encode([...files, file].map(f => f.content).join('')).length > 128 * 1024 * 1024) { errors.push('Limite da sessão atingido: 100 arquivos / 128 MiB.'); break; } files.push(file); }
  invalidate(); setBusy(false); message(errors.length ? errors.join(' ') : 'Arquivos adicionados. A ordem da lista será a ordem do PDF.', !!errors.length);
}
$('upload').onchange = async e => { await addFiles([...e.target.files]); e.target.value = ''; };
$('drop').onkeydown = e => { if (e.target===$('drop')&&(e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (!busy) $('upload').click(); } };
for (const type of ['dragenter', 'dragover']) $('drop').addEventListener(type, e => { e.preventDefault(); if (!busy) $('drop').classList.add('drag'); });
for (const type of ['dragleave', 'drop']) $('drop').addEventListener(type, e => { e.preventDefault(); $('drop').classList.remove('drag'); });
$('drop').addEventListener('drop', e => addFiles([...e.dataTransfer.files])); document.addEventListener('dragover', e => e.preventDefault()); document.addEventListener('drop', e => e.preventDefault());
$('add-paste').onclick = () => { if(busy)return;if(!$('paste').value.trim())return message('Cole o ZPL primeiro.',true);if(!syncEditor())return;editorEntry=null;$('paste').value='';invalidate();renderFiles();ready();message('Conteúdo adicionado ao lote. Você pode colar a próxima etiqueta.'); };
$('paste').oninput = () => { if(!$('paste').value.trim()&&editorEntry){files=files.filter(f=>f!==editorEntry);editorEntry=null;}invalidate();renderFiles();ready();message('Clique em Gerar prévia para converter o conteúdo.'); };
$('clear').onclick = () => { session++; controller?.abort(); files = []; editorEntry=null; $('paste').value = ''; invalidate(); setBusy(false); message('Sessão limpa. Arquivos e resultados removidos da memória da página.'); };
$('cancel').onclick = () => controller?.abort();
$('size').onchange = () => { if ($('size').value !== 'custom') { const [w,h] = $('size').value.split('x'); $('width').value = w; $('height').value = h; } $('width').disabled = $('height').disabled = $('size').value !== 'custom'; $('custom-size').hidden=$('size').value!=='custom'; invalidate(); renderFiles(); message('Tamanho alterado. Gere a prévia novamente.'); };
for (const id of ['width','height','dpi','orientation','rotation']) $(id).onchange = () => { invalidate(); renderFiles(); message('Configuração alterada. Gere a prévia novamente.'); };
$('convert').onclick = async () => {
  if (busy || !syncEditor() || !files.length) return; const settings = { width: Number($('width').value), height: Number($('height').value), dpi: Number($('dpi').value), orientation: $('orientation').value, rotation: Number($('rotation').value) };
  if (!Number.isFinite(settings.width) || !Number.isFinite(settings.height) || settings.width < 20 || settings.width > 200 || settings.height < 20 || settings.height > 300) return message('Largura: 20–200 mm. Altura: 20–300 mm.', true);
  const current = session; invalidate(); setBusy(true); message('Renderizando suas etiquetas localmente…'); controller = new AbortController();
  try {
    const data = await convertInBrowser({files,settings},controller.signal); if (current !== session) return; result = data;
    loadPreviews(data,settings);
    const page=previewPages.length;$('empty').hidden = page > 0; $('preview-controls').hidden=!page;showPreview();$('page-count').textContent = `${page} etiqueta(s)`; $('dimensions').textContent = `PDF · ${data.widthMm} × ${data.heightMm} mm · ${settings.dpi} DPI`; $('download').disabled = !data.mergedPdf;
    if(packingOrders){$('download').disabled=true;await associatePacking(current);renderFiles();}
    const failures=data.files.filter(f=>f.error);
    message(failures.length ? failures.map(f=>`${f.name}: ${f.error}`).join('\n')+(page?'\nOs arquivos válidos podem ser baixados separadamente.':'') : packingOrders?'Confira as associações abaixo da planilha e clique em Gerar PDF com produtos.':`Tudo pronto! ${page} etiqueta(s) convertida(s). Confira a prévia antes de imprimir.`, !!failures.length);
  } catch (e) { if (current === session) message(e.name === 'AbortError' ? 'Processamento cancelado.' : e.message, true); }
  finally { if (current === session) { setBusy(false); $('status').classList.remove('busy'); controller = null; } }
};
$('download').onclick = async () => {
  if(busy)return;
  if(packingOrders&&!packingReady){await $('packing-generate').onclick();if(!packingReady)return;}
  if(result?.mergedPdf)download(result.mergedPdf,'etiquetas.pdf');
};
$('print-labels').onclick = async () => {
 if(busy)return;
 if(packingOrders&&!packingReady){await $('packing-generate').onclick();if(!packingReady)return;}
 if(!result?.mergedPdf)return;
 const data=result;
 let root=document.getElementById('print-pages');if(!root){root=document.createElement('div');root.id='print-pages';document.body.append(root);}root.replaceChildren();
 let style=document.getElementById('print-size');if(!style){style=document.createElement('style');style.id='print-size';document.head.append(style);}
 style.textContent=`@page { size: ${data.widthMm}mm ${data.heightMm}mm; margin: 0; }`;
 setBusy(true);message('Preparando todas as etiquetas para impressão…');
 try{
   const images=[];
   for(const file of data.files)for(const preview of file.previews){const sheet=document.createElement('div'),img=document.createElement('img');sheet.className='print-sheet';sheet.style.width=data.widthMm+'mm';sheet.style.height=data.heightMm+'mm';img.alt='Etiqueta para impressão';img.src=blobUrl(preview,'image/png');sheet.append(img);root.append(sheet);images.push(img);}
   await Promise.all(images.map(img=>img.decode?img.decode():new Promise((resolve,reject)=>{if(img.complete&&img.naturalWidth)return resolve();img.onload=resolve;img.onerror=reject;})));
   if(result!==data)return;
   message('Na janela de impressão, escolha tamanho real / escala 100%, sem margens, e desative cabeçalhos e rodapés.');
   $('print-feedback').textContent='Se a seleção de impressora não aparecer, abra o link abaixo no Chrome ou Edge ou baixe o PDF para imprimir.';
   $('print-details').textContent=`${images.length} página(s) · papel ${data.widthMm} × ${data.heightMm} mm. Escala 100%, margens nenhuma, sem cabeçalhos e rodapés.`;
   $('print-options').hidden=false;
   $('print-now').focus();
 }catch{message('Não foi possível preparar a impressão. Tente novamente ou baixe o PDF para imprimir.',true);}
 finally{setBusy(false);}
};
$('print-close').onclick=()=>{$('print-options').hidden=true;$('print-labels').focus();};
// O diálogo nativo é solicitado diretamente no clique, após carregar as imagens.
// A lista real de impressoras pertence ao navegador e ao sistema operacional.
$('print-now').onclick=()=>{
 if(!result?.mergedPdf||!document.getElementById('print-pages'))return;
 try{window.print();$('print-feedback').textContent='Se não apareceu a seleção de impressora, abra este site no Chrome ou Edge. Você também pode baixar o PDF abaixo e imprimi-lo pelo leitor de PDF.';}
 catch{$('print-feedback').textContent='Este navegador não conseguiu abrir a impressão. Baixe o PDF e imprima pelo leitor de PDF, ou abra o site no Chrome ou Edge.';}
};
$('print-pdf').onclick=()=>{if(result?.mergedPdf)download(result.mergedPdf,'etiquetas.pdf');};
$('print-site-link').value='https://etiquetas-zpl-shopee.sojingabriel.chatgpt.site/';
$('sample').onclick = async () => { await addFiles(EXAMPLES.map(f => new File([f.content],f.name,{type:'text/plain'}))); };
$('previous-page').onclick=()=>{if(previewIndex>0){previewIndex--;showPreview();}};
$('next-page').onclick=()=>{if(previewIndex<previewPages.length-1){previewIndex++;showPreview();}};
$('zoom').onchange=showPreview;
window.addEventListener('pagehide', release);

function loadPreviews(data,settings){
 const rasterWidth=Math.round(data.widthMm*settings.dpi/25.4);
 for(const entry of data.files){const groups=entry.groups||entry.previews.map((_,i)=>({start:i,count:1}));for(const g of groups)previewPages.push({name:entry.name,url:blobUrl(entry.previews[g.start],'image/png'),extraUrls:entry.previews.slice(g.start+1,g.start+g.count).map(p=>blobUrl(p,'image/png')),width:rasterWidth});}
}
function packingButtons(){
 const assigned=previewPages.length>0&&packingAssignments.length===previewPages.length&&packingAssignments.every(i=>Number.isInteger(i)&&i>=0&&i<packingOrders?.length);
 const unique=new Set(packingAssignments).size===packingAssignments.length;
 const canGenerate=assigned&&unique&&$('packing-confirm').checked&&result&&!result.files.some(f=>f.error);
 $('packing-generate').disabled=busy||!canGenerate;
 const canDownload=packingOrders?(packingReady||canGenerate):!!result?.mergedPdf;
 $('download').disabled=busy||!canDownload;
 $('print-labels').disabled=busy||!canDownload;
 $('download').textContent=packingOrders&&!packingReady&&canGenerate?'Gerar e baixar PDF':'Baixar PDF';
 const reason=busy?'Aguarde o processamento.':!result?'Clique em Gerar prévia primeiro.':result.files.some(f=>f.error)?'Corrija os erros de conversão mostrados na lista.':packingOrders&&!packingReady?(!assigned?'Selecione o pedido de cada etiqueta.':!unique?'Corrija os pedidos associados mais de uma vez.':!$('packing-confirm').checked?'Marque Conferi os pedidos e os produtos de cada etiqueta.':'O PDF com produtos será gerado antes do download.'):'PDF pronto para baixar.';
 $('download').title=reason;
 $('download-help').textContent=canDownload&&!busy?'':reason;
}
function packingChanged(){packingReady=false;$('packing-confirm').checked=false;$('download').disabled=true;for(const page of previewPages){for(const url of page.extraUrls||[]){URL.revokeObjectURL(url);urls.delete(url);}page.extraUrls=[];}showPreview();renderFiles();packingButtons();const chosen=packingAssignments.filter(i=>i>=0);if(new Set(chosen).size!==chosen.length)message('Um pedido foi associado a mais de uma etiqueta. Corrija a seleção antes de gerar o PDF.',true);}
function packingRows(){
 $('packing-links').replaceChildren();$('packing-actions').hidden=!packingOrders||!previewPages.length;
 if(!packingOrders)return;
 previewPages.forEach((page,index)=>{
  const row=document.createElement('div'),see=document.createElement('button'),select=document.createElement('select'),list=document.createElement('p');row.className='packing-row';see.className='text-button';see.textContent=`Ver etiqueta ${index+1}`;see.onclick=()=>{previewIndex=index;showPreview();};select.setAttribute('aria-label',`Pedido da etiqueta ${index+1}`);
  const empty=document.createElement('option');empty.value='';empty.textContent='Selecione o pedido desta etiqueta';select.append(empty);
  packingOrders.forEach((order,i)=>{const opt=document.createElement('option');opt.value=i;opt.textContent=`${order.id} · ${order.tracking||'sem rastreio'}`;select.append(opt);});
  const update=()=>{const order=packingOrders[packingAssignments[index]];list.textContent=order?order.items.map(item=>`${item.quantity} un. — ${item.name}${item.variation?' ('+item.variation+')':''}`).join('\n'):'Sem associação. Escolha o pedido que aparece na etiqueta.';};
  select.value=packingAssignments[index]>=0?String(packingAssignments[index]):'';select.onchange=()=>{packingAssignments[index]=select.value===''?-1:Number(select.value);update();packingChanged();};update();row.append(see,select,list);$('packing-links').append(row);
 });packingButtons();
}
async function associatePacking(current){
 packingAssignments=previewPages.map(()=>-1);const keys=new Map();packingOrders.forEach((o,i)=>{for(const key of [o.id,o.tracking])if(key)keys.set(key,i);});
 let detector;try{if(globalThis.BarcodeDetector)detector=new BarcodeDetector({formats:['code_128','qr_code']});}catch{}
 for(let i=0;i<previewPages.length;i++){
  if(current!==session||!packingOrders)return;
  const candidates=new Set();
  if(detector)try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=previewPages[i].url;});for(const code of await detector.detect(img))if(keys.has(code.rawValue))candidates.add(keys.get(code.rawValue));}catch{}
  if(candidates.size===1)packingAssignments[i]=[...candidates][0];
 }
 if(current===session)packingRows();
}
$('packing-upload').onchange=async e=>{
 if(busy)return;const file=e.target.files[0];e.target.value='';if(!file)return;
 if(!/\.xlsx$/i.test(file.name)||file.size>8*1024*1024){message('Use uma planilha .xlsx de até 8 MiB.',true);return;}
 const current=session;setBusy(true);
 try{const orders=readPacking(await file.arrayBuffer());if(current!==session)return;packingOrders=orders;invalidate();$('packing-info').textContent=`${file.name}: ${orders.length} pedidos lidos. Gere a prévia das etiquetas para associar os pedidos.`;$('packing-remove').hidden=false;message('Planilha lida localmente. Agora gere a prévia das etiquetas.');}
 catch{if(current===session)message('Não foi possível ler a planilha. Use .xlsx da Shopee com order_sn, product_info e quantidades válidas, sem senha, até 8 MiB / 16 MiB descompactados.',true);}
 finally{if(current===session)setBusy(false);}
};
$('packing-remove').onclick=()=>{packingOrders=null;invalidate();$('packing-info').textContent='';$('packing-remove').hidden=true;renderFiles();message('Planilha removida. Gere novamente as etiquetas.');};
const clearSession=$('clear').onclick;$('clear').onclick=()=>{packingOrders=null;clearSession();$('packing-info').textContent='';$('packing-remove').hidden=true;};
$('packing-order').onclick=()=>{if(!packingOrders||busy)return;if(packingOrders.length!==previewPages.length){message('A quantidade de pedidos difere da quantidade de etiquetas. Associe cada pedido manualmente.',true);return;}packingAssignments=packingOrders.map((_,i)=>i);packingChanged();packingRows();message('Associações preenchidas pela ordem da planilha. Confira cada etiqueta antes de confirmar.');};
$('packing-confirm').onchange=packingButtons;
$('packing-generate').onclick=async()=>{
 packingButtons();if($('packing-generate').disabled)return;
 const current=session,selected=packingAssignments.map(i=>packingOrders[i]),settings={width:Number($('width').value),height:Number($('height').value),dpi:Number($('dpi').value),orientation:$('orientation').value,rotation:Number($('rotation').value),packingLayout:$('packing-layout').value};
 setBusy(true);controller=new AbortController();message('Gerando etiquetas de envio e de produtos…');
 try{const data=await convertInBrowser({files,settings,packing:selected},controller.signal);if(current!==session)return;
 if(!data.mergedPdf){message(data.files.filter(f=>f.error).map(f=>`${f.name}: ${f.error}`).join('\n')||'Não foi possível gerar o PDF. Confira a lista de produtos e tente novamente.',true);return;}
 release();previewPages=[];result=data;loadPreviews(data,settings);packingReady=!!data.mergedPdf;previewIndex=0;showPreview();$('dimensions').textContent=`PDF · ${data.widthMm} × ${data.heightMm} mm · ${settings.dpi} DPI`;$('download').disabled=!packingReady;$('page-count').textContent=`${previewPages.length} envios · ${data.pages} páginas`;
 message(packingReady?`PDF pronto: ${previewPages.length} etiquetas de envio, ${settings.packingLayout==='side'?'com envio e produtos na mesma página horizontal':'cada uma seguida pelos produtos correspondentes'}.`:data.files.filter(f=>f.error).map(f=>`${f.name}: ${f.error}`).join('\n'),!packingReady);renderFiles();}
 catch(e){if(current===session)message(e.name==='AbortError'?'Processamento cancelado.':e.message,true);}
 finally{if(current===session){controller=null;setBusy(false);}}
};
const renderShippingFiles=renderFiles;renderFiles=()=>{renderShippingFiles();if(packingOrders&&!packingReady)for(const button of $('files').querySelectorAll('.file-download')){button.disabled=true;button.title='Confira as associações e gere o PDF com produtos primeiro.';}};


$('packing-layout').onchange=()=>{invalidate();renderFiles();ready();message('Layout alterado. Gere a prévia e confira as associações novamente.');};
