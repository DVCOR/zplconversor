# Etiquetas no navegador — ZPL para PDF

## Abrir e usar

**Dê dois cliques em `Etiquetas.html` e abra com Chrome ou Edge atualizado.** Não precisa instalar .NET, Node, Python, Docker nem iniciar servidor. Também não precisa de internet. Se o Windows não associar HTML ao navegador, clique com o botão direito → Abrir com → Google Chrome ou Microsoft Edge.

No Windows, também pode dar dois cliques em `abrir.cmd`, ou executar `start Etiquetas.html` no terminal desta pasta.

1. Cole o ZPL no editor, clique em **Enviar arquivos**, ou arraste arquivos `.zpl`/`.txt` para a área do editor.
2. Escolha tamanho, DPI, orientação e rotação. O padrão é 100 × 150 mm / 203 DPI.
3. Clique em **Gerar prévia**, sem precisar adicionar o conteúdo colado à lista primeiro. Confira as etiquetas com as setas e o zoom à direita.
4. Use **Baixar PDF** para juntar tudo, ou baixe o PDF de cada arquivo na lista. A ordem é a da lista e dos blocos dentro de cada arquivo.
5. Ao imprimir, escolha **100% / tamanho real**, papel nas dimensões do PDF e desative “Ajustar à página”.

“Usar exemplos” carrega cinco arquivos sintéticos incorporados no HTML, totalizando seis etiquetas. Nenhum deles contém dados pessoais reais. Um arquivo pode conter vários blocos `^XA`/`^XZ`; cada bloco de etiqueta gera uma página. Blocos que contêm exclusivamente `^ID...^FS` apagam recursos e não geram folhas. Downloads `~DG` e exclusões são processados na ordem, inclusive quando o nome da imagem se repete. Remova arquivos com × ou use “Limpar”. Erros em qualquer arquivo bloqueiam o PDF unificado; PDFs dos arquivos válidos continuam disponíveis. A causa específica aparece diretamente na área da prévia.

O fluxo visual segue a referência do [conversor do LabelZoom](https://www.labelzoom.com/zpl-converter): editor à esquerda, prévia à direita, configurações abaixo do editor e botão para gerar a prévia. O tamanho e o DPI ficam visíveis; orientação e rotação estão em “Opções avançadas”. A interface está em português, com marca própria e sem conta ou marca-d'água. **Isso não significa que o renderizador seja o mesmo do LabelZoom** ou que produza resultados idênticos.

Para vários conteúdos colados, clique em “Adicionar ao lote” depois de cada um. Para uma conversão simples, basta colar e gerar a prévia. Depois de converter, editar o mesmo conteúdo e converter novamente atualiza sua entrada sem duplicar etiquetas. O conteúdo colado é acrescentado ao fim da lista na primeira conversão e conserva essa posição nas seguintes. Avisos de fontes e comandos ficam em “Observações da conversão” em cada arquivo; erros continuam visíveis.

O PDF tem dimensões físicas exatas, sem margens adicionais. O raster ZPL usa o DPI selecionado; o arredondamento a dots não muda o tamanho da página. Não há encaixe automático do conteúdo: elementos fora da folha são cortados. Rotação de 90°/270° também troca largura e altura do PDF. A orientação define a folha antes da renderização. O conteúdo ZPL não é escalado automaticamente quando você troca o DPI.

## Envio e produtos na mesma etiqueta (horizontal)

O layout padrão com planilha é **Uma etiqueta horizontal: envio + produtos**. No tamanho padrão, a página tem 150 × 100 mm: o envio original de 100 × 150 mm é reduzido proporcionalmente para cerca de 66,7 × 100 mm, centralizado na metade esquerda de 75 × 100 mm; os produtos e quantidades ficam na metade direita. Não distorce nem recorta o envio renderizado. Neste modo, a orientação e a rotação da saída são fixas em horizontal. Tamanhos personalizados usam a maior dimensão como largura da saída. A renderização de origem usa a folha em pé.

A lista destaca **QUANTIDADE** em fonte maior, apresenta o nome do produto em linhas com espaçamento e deixa a variação em uma linha própria. Linhas divisórias separam os itens. Nomes longos são quebrados em várias linhas para facilitar a leitura pelo separador.

A redução do envio considera a área dos pixels de origem para preservar traços finos de números em imagens incorporadas. Isso evita pular linhas da imagem; ainda há perda de definição física ao reduzir uma etiqueta. Aumentar o DPI não recria detalhes ausentes no ZPL original.

Se a lista não couber na metade direita, o app bloqueia a geração e informa para escolher **Duas etiquetas** ou um tamanho maior; não corta produtos nem gera folhas extras silenciosamente. A leitura dos códigos reduzidos foi verificada somente nos exemplos sintéticos, em 203 e 300 DPI. Confira uma impressão real da Shopee e faça a leitura dos códigos antes de usar o lote. Imprima em **100% / tamanho real**, sem ajustar à página.

## Alternativa: produtos abaixo em etiquetas separadas

1. Escolha **Duas etiquetas: envio e depois produtos** se quiser usar o formato anterior. Carregue os arquivos ZPL e envie a lista de empacotamento `.xlsx` em **Produtos abaixo da etiqueta**.
2. Clique em **Gerar prévia**. Escolha o pedido correspondente a cada etiqueta usando a lista e **Ver etiqueta** para conferir.
3. Se pedidos e etiquetas estiverem comprovadamente na mesma sequência, use **Associar pela ordem da planilha**. Essa opção exige a mesma quantidade de pedidos e etiquetas; não verifica a identidade dos pedidos.
4. Marque **Conferi os pedidos e os produtos de cada etiqueta**. O botão principal muda para **Gerar e baixar PDF** e faz as duas etapas em um clique; **Gerar PDF com produtos** também continua disponível para conferir a prévia antes de baixar.
5. Confira a prévia e baixe o PDF. A sequência é: envio do pedido A, produtos de A, envio do pedido B, produtos de B. Na prévia, os produtos aparecem abaixo da etiqueta de envio. No PDF são páginas separadas, nas mesmas dimensões físicas, para sair como duas etiquetas consecutivas na impressora. Listas longas continuam em páginas adicionais.

O app lê as colunas `order_sn`, `product_info` e, quando presente, `tracking_number`. Reconhece o formato Shopee com campos `Product Name`, `Variation Name` e `Quantity`; agrupa produtos do mesmo pedido. Quantidades inválidas, rastreios ambíguos e arquivos inválidos são rejeitados. Observações de comprador/vendedor não entram nas etiquetas. Não aceita `.xls`, CSV ou planilhas protegidas por senha.

A associação automática tenta ler Code 128 e QR usando `BarcodeDetector`, quando disponível no navegador, e exige igualdade com o pedido/rastreio da planilha. Ela pode não funcionar em HTML local ou em alguns navegadores; não faz OCR. Para ZPL com imagens incorporadas, selecione o pedido manualmente quando o código não for identificado. O app não presume silenciosamente que a ordem da planilha é a ordem das etiquetas. Pedidos repetidos nas associações bloqueiam a geração. Alterar a associação invalida o PDF e exige nova conferência.

A planilha é processada localmente e permanece somente na memória. **Limpar** também remove a planilha e as associações. Limites adicionais: XLSX de até 8 MiB, 16 MiB de XML descompactado, 256 entradas ZIP, 10.000 linhas de dados, 100 colunas, 5.000 pedidos e 200 produtos por pedido. Cada pedido pode gerar até dez páginas de produtos; não há limite fixo de páginas por lote. A memória disponível ainda limita o volume possível.

## Como funciona e por que este renderizador

Esta versão substitui o backend por um **Web Worker** com [ZPLr 0.3.0](https://github.com/le2ni/zplr), dependências e fontes incorporados. O ZPLr transforma comandos em pixels: textos, gráficos, imagens, códigos de barras e QR são realmente desenhados. O aplicativo grava esses pixels em páginas PDF com compressão sem perdas, sem escrever o código ZPL na folha. A prévia PNG usa os mesmos pixels do PDF.

Foram avaliados o [BinaryKits.Zpl](https://github.com/BinaryKits/BinaryKits.Zpl), usado na versão com backend, o [zpl-renderer-js](https://www.npmjs.com/package/zpl-renderer-js) e o ZPLr. O ZPLr foi escolhido nesta versão pela entrada específica para navegador, raster determinístico, fontes incorporadas, diagnósticos de comandos e limites de processamento. BinaryKits exige runtime .NET na implementação anterior; não foi portado para este HTML. Nenhuma API externa foi adotada: não há credenciais, custos de conversão nem limites de um serviço remoto.

Licença do ZPLr: **MIT**, verificada no pacote npm instalado. Seus ativos têm licenças próprias: fontes TeX Gyre Heros sob GUST/LPPL, Spleen sob BSD e avisos de fontes históricas Noto sob OFL; código derivado de ZXing sob Apache 2.0 e tabelas libzint sob BSD. Dependências diretas: fflate 0.8.3 (MIT); ZPLr usa também bwip-js, opentype.js e qrcode. O empacotamento usa esbuild 0.28.1. `package-lock.json` fixa todas as versões transitivas. **Os textos de licenças e avisos estão em `LICENCAS.txt` e também dentro do próprio HTML**, na seção “Licenças das dependências”. Preserve-os ao redistribuir.

## Compatibilidade e erros

**Não existe garantia de compatibilidade completa com ZPL ou com todas as etiquetas Shopee.** Confira `COMANDOS-ZPLr.md` e `DIAGNOSTICOS-ZPLr.md`, copiados da versão instalada do renderizador. Fontes podem diferir da impressora Zebra. Texto, acentos e tamanhos precisam de conferência visual. Dados rasterizados não são texto selecionável no PDF.

Este app restringe adicionalmente:

- Arquivos textuais UTF-8; delimitadores `^XA` e `^XZ` em maiúsculas, sem blocos aninhados. Não aceita arquivos binários.
- `^CI0` e `^CI28`; outros mapas de caracteres são rejeitados.
- Imagens `^GFA` em ASCII hexadecimal, RLE, B64 ou Z64, e recursos `~DG`/`^XG` suportados pelo renderizador. `^GFC` comprimido binário não é decodificado.
- Prefixos personalizados, formatos armazenados (`^DF`, `^XF`, `^FN`) e fontes baixadas (`^DT`, `^DU`, `^DB`, `^DY`, `^A@`) são rejeitados.
- `^PQ` aceita quantidade 1 e repetição 0 ou 1, inclusive formas como `^PQ1,0,0,N`; uma página por bloco de etiqueta. `^PW`/`^LL` são substituídos pelas dimensões escolhidas na interface, com aviso.
- Comandos desconhecidos/não implementados, falhas semânticas e comandos com implementação parcial geram erro, com a identificação do comando e do diagnóstico. `^CI`/`^GF` são aceitos somente nos subconjuntos acima; `^FT` é aceito com coordenadas explícitas e aviso para conferir a linha de base. Comandos de configuração física da impressora reconhecidos, sem efeito raster, produzem aviso.

Um diagnóstico como `UNKNOWN_COMMAND` identifica um comando desconhecido. `UNSUPPORTED_GRAPHIC_FORMAT` indica formato de imagem não aceito. Não se faz substituição fictícia para contornar erros: corrija o arquivo ou compare com a versão com backend. Diagnósticos não devem ser interpretados como certificação de impressão fiel.

## Privacidade e limites

O arquivo HTML não faz solicitações de rede nem envia etiquetas a terceiros. A política de segurança incorporada bloqueia conexões (`connect-src 'none'`). Não usa cookies, armazenamento local, banco de dados, conta Shopee ou telemetria. ZPL, rasters, prévias e PDFs ficam em memória; o worker é encerrado após a conversão ou cancelamento. Não há arquivos temporários de etiquetas. Limpar a sessão solta referências e revoga URLs; a recuperação da memória fica a cargo do navegador. PDFs que você baixar são arquivos salvos voluntariamente e continuam na pasta de downloads.

Entrada: até 100 arquivos, 32 MiB por arquivo e 128 MiB por sessão. Sem limite fixo de quantidade de etiquetas ou de pixels somados no lote. Cada etiqueta é renderizada sequencialmente e seus pixels são liberados após gerar a prévia PNG e comprimir a página PDF; recursos ZPL são preservados entre etiquetas do mesmo arquivo. O processamento pode durar mais de 45 segundos, com encerramento somente após 60 segundos sem progresso. Prévia e PDFs permanecem em memória, portanto a capacidade real depende do dispositivo; em volumes muito grandes, divida o lote. Cada gráfico continua limitado a 512.000 bytes, recursos do renderer a 4.000.000 bytes e cada página a 24 milhões de pixels. Tamanho personalizado: largura 20–200 mm e altura 20–300 mm.

Chrome/Edge atualizados com Worker e OffscreenCanvas são os navegadores previstos. Navegadores antigos, visualizadores HTML de aplicativos e políticas corporativas podem bloquear workers locais; a interface mostra um erro. Abra com um navegador normal. A execução por `file://` foi implementada, mas **não pôde ser validada automaticamente neste ambiente**, cuja automação proíbe esse protocolo.

## Validação efetivamente realizada

- **51 verificações** do fluxo de conversão: cinco exemplos / seis páginas, 203 e 300 DPI, rotações 0/90/180/270, tamanhos padrão e personalizados, arquivos inválidos, comando desconhecido, recursos ausentes, erro parcial, `^FT` e `^PQ` parametrizados. Lote sintético com 13 imagens Z64 de 816 × 1218 dots, alternadas com exclusões `^ID`: 13 páginas, sem folhas vazias de limpeza. Também foi verificado que excluir um recurso impede usá-lo novamente sem novo download.
- **167 verificações** dos PDFs com PyMuPDF e ZXing: número de páginas, dimensões com tolerância inferior a 0,01 mm, Code 128 `TESTE123456`, QR `TESTE-QR-001`, ordem `ORDEM001`/`ORDEM002`, imagens `^GFA` e `~DG`/`^XG`, conteúdo e ordem dos 13 rasters Z64.
- **51 verificações** de interação da interface em DOM simulado, incluindo a exibição da causa específica da falha na área da prévia.
- Dez verificações sintéticas de leitura XLSX e duas com a planilha fornecida: 18 pedidos reconhecidos, produtos e quantidades válidos. Os dados reais não foram salvos nos exemplos ou relatórios.
- Layout horizontal: dois envios em duas páginas de 150 × 100 mm, Code 128 e QR reduzidos decodificados por software em 203 e 300 DPI; excesso de produtos rejeitado. Inspeção visual do PDF horizontal.
- Etiquetas de produtos testadas com várias quantidades, acentos, paginação de listas longas, rejeição de associação ausente/quantidade inválida e escape de texto. PDF sintético de dois pedidos com quatro páginas, dimensões de 100 × 150 mm e códigos de envio ainda decodificáveis.
- Inspeção visual dos exemplos simples e de produtos renderizados a partir dos PDFs.

Os testes de conversão executam o mesmo renderer e escritor PDF do HTML em Node, com um adaptador de Canvas que só recebe pixels. Os testes de interface usam jsdom e um renderer simulado para verificar colar e converter em um clique, reconversão sem duplicação, edição, lote, navegação, zoom, configurações e limites. **Não validam o layout visual no navegador, a codificação PNG, o Web Worker real, os downloads reais nem a abertura local por duplo clique.** Os resultados e PDFs sintéticos estão em `validacao/`. Isso é distinto dos testes da versão anterior com backend.

A associação dos 18 pedidos às etiquetas reais ainda precisa ser conferida no navegador; a leitura do Excel não valida essa correspondência.

Pendências: abrir `Etiquetas.html` em Chrome/Edge e experimentar os exemplos; testar upload/arrastar/colar/prévia/download/remover/limpar; conferir o lote completo enviado pelo usuário; imprimir e testar com scanner físico. A estrutura do ZPL enviado foi reproduzida com imagens sintéticas; os dados enviados não foram salvos nos exemplos nem nos relatórios de validação. O lote completo enviado ainda precisa ser convertido e conferido no navegador.

## Código e reconstrução (opcional)

Para usar, basta o HTML pronto. Para modificar o projeto, instale Node.js 22 ou superior com npm. Dentro desta pasta:

```powershell
npm ci
npm run build
```

O resultado é `Etiquetas.html`. A instalação inicial das dependências requer internet; o uso do HTML gerado é offline. `src/template.html`, `src/style.css` e `src/app.js` contêm a interface; `src/bridge.js` inicia/encerra o worker; `src/packing.js` lê e valida a planilha; `src/worker.js` contém validação, renderização e geração PDF. `build.mjs` incorpora tudo em um arquivo e preserva avisos legais. Não é necessário Docker nesta versão.

Para repetir a validação (dependências de teste, não de uso):

```powershell
npm ci
node tests/converter.mjs
node tests/interface.mjs
node tests/packing.mjs
python -m pip install PyMuPDF==1.26.7 Pillow==11.3.0 zxing-cpp==2.3.0
python tests/pdf.py
```

Os arquivos de validação contêm exclusivamente os dados sintéticos fornecidos com o projeto.

### Botão de download desabilitado

O motivo aparece abaixo de **Baixar PDF**: falta gerar a prévia, selecionar os pedidos, confirmar a conferência ou corrigir um arquivo inválido. Falhas ao gerar produtos preservam as associações e a prévia para uma nova tentativa. Download real pelo navegador permanece uma verificação manual; o fluxo foi testado em DOM simulado.

### Imprimir pelo aplicativo

O botão **Imprimir etiquetas**, logo abaixo de **Baixar PDF**, abre a janela de impressão do navegador com todas as páginas na ordem do lote, incluindo os produtos. Escolha o papel nas dimensões exibidas, escala **100% / tamanho real**, margens **Nenhuma** e desative cabeçalhos e rodapés. O aplicativo solicita o tamanho físico via CSS; confira se o navegador e o driver da impressora respeitam essa configuração. Com planilha, associe e confirme os pedidos primeiro. Não é necessário baixar o PDF antes.

Testado em DOM simulado: acionamento de impressão, ordem e quantidade das folhas, tamanho físico configurado e limpeza da sessão. A janela e a impressão física dependem de conferência no navegador e na impressora.


### Selecionar a impressora

Clique em **Imprimir etiquetas** e depois em **Selecionar impressora e imprimir**. Na janela nativa escolha **Destino / Impressora**. A lista é fornecida pelo navegador e pelo Windows, a partir dos drivers instalados; o site não enumera nem instala impressoras. É compatível com impressão pelo navegador em impressoras térmicas, laser ou jato de tinta, respeitando o papel e o driver.

Se o navegador integrado ao app não mostrar a seleção, abra o link público no Chrome ou Edge. Também é possível usar **Baixar PDF para imprimir** e selecionar a impressora no leitor de PDF. Não há confirmação automática de impressão concluída. Abertura da janela e impressão física dependem do navegador e do driver e não foram testadas com uma impressora real.
