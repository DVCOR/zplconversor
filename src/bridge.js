// WORKER_SOURCE e EXAMPLES são incorporados pelo empacotador; nenhuma requisição.
function convertInBrowser(request, signal) {
  return new Promise((resolve,reject)=>{
    if(!globalThis.Worker||!globalThis.OffscreenCanvas) {reject(new Error('Use uma versão atual do Chrome ou Edge com suporte a Worker e OffscreenCanvas.'));return;}
    let worker,url,timer,finished=false;
    const done=(error,result)=>{if(finished)return;finished=true;clearTimeout(timer);signal.removeEventListener('abort',abort);worker?.terminate();if(url)URL.revokeObjectURL(url);error?reject(error):resolve(result);};
    const abort=()=>done(new DOMException('Conversão cancelada.','AbortError'));
    try{
      url=URL.createObjectURL(new Blob([WORKER_SOURCE],{type:'text/javascript'}));worker=new Worker(url);
      signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}
      const watchdog=()=>{clearTimeout(timer);timer=setTimeout(()=>done(new Error('Processamento sem resposta por 60 segundos. Tente um lote menor.')),60000);};watchdog();
      worker.onerror=e=>{e.preventDefault();done(new Error('Não foi possível iniciar o renderizador. Abra o HTML em Chrome ou Edge atualizado.'));};
      worker.onmessage=({data})=>{if(data.progress){watchdog();message(`Renderizando no navegador… arquivo ${data.progress.current} de ${data.progress.total}${data.progress.label?` · etiqueta ${data.progress.label} de ${data.progress.labels}`:``}`);return;}done(data.error?new Error(data.error):null,data.result);};
      worker.postMessage(request);
    }catch{done(new Error('O navegador bloqueou o processamento local. Abra o arquivo em Chrome ou Edge atualizado.'));}
  });
}
