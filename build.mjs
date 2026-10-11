import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
// A variável abaixo só facilita a compilação no ambiente do autor.
// Para desenvolver normalmente, npm ci + npm run build usa node_modules local.
const modules=path.join(process.env.ETIQUETAS_BUILD_DEPS||root,'node_modules');
const {build}=await import(pathToFileURL(path.join(modules,'esbuild/lib/main.js')));
const bundle=await build({entryPoints:[path.join(root,'src/worker.js')],bundle:true,platform:'browser',format:'iife',target:'es2022',minify:true,write:false,nodePaths:[modules],legalComments:'inline'});
const worker=bundle.outputFiles[0].text;
const packingBundle=await build({entryPoints:[path.join(root,'src/packing.js')],bundle:true,platform:'browser',format:'iife',target:'es2022',minify:true,write:false,nodePaths:[modules],legalComments:'inline'});
const exampleNames=['simples.zpl','codigo-barras.zpl','qr-code.zpl','multiplas.zpl','imagem.zpl'];
const examples=await Promise.all(exampleNames.map(async name=>({name,content:await readFile(path.join(root,'exemplos',name),'utf8')})));
const template=await readFile(path.join(root,'src/template.html'),'utf8'),css=await readFile(path.join(root,'src/style.css'),'utf8');
const script=`const WORKER_SOURCE=${JSON.stringify(worker)};const EXAMPLES=${JSON.stringify(examples)};\n`+packingBundle.outputFiles[0].text+'\n'+await readFile(path.join(root,'src/bridge.js'),'utf8')+'\n'+await readFile(path.join(root,'src/app.js'),'utf8');
const safeScript=script.replace(/<\//g,'<\\/');
const notices=await readFile(path.join(root,'LICENCAS.txt'),'utf8');
const escapeHtml=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; worker-src blob:; img-src blob: data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
// Callbacks evitam que tokens $&/$` do JavaScript sejam tratados como substituição.
let html=template.replace('<link rel="stylesheet" href="style.css"><script src="app.js" defer></script>',()=>`<meta http-equiv="Content-Security-Policy" content="${csp}"><style>${css}</style>`);
html=html.replace('</footer>',()=>`<details><summary>Licenças das dependências</summary><pre style="white-space:pre-wrap;font-size:11px">${escapeHtml(notices)}</pre></details></footer>`);
html=html.replace('</body>',()=>`<script>${safeScript}</script></body>`);
await writeFile(path.join(root,'Etiquetas.html'),html);
console.log(`HTML offline gerado (${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MiB).`);
