"""Verifica os PDFs sintéticos gerados por converter.mjs, sem dados reais."""
from pathlib import Path
import json
import fitz
from PIL import Image
import zxingcpp
root=Path(__file__).resolve().parents[1]/'validacao'
checks=[]
def check(ok,label):
    assert ok,label
    checks.append(label)
for dpi in (203,300):
    for rotation in (0,90,180,270):
        with fitz.open(root/f'etiquetas-{dpi}-{rotation}.pdf') as doc:
            check(len(doc)==6,f'6 páginas / {dpi} / {rotation}')
            w,h=(150,100) if rotation%180 else (100,150)
            for page in doc:
                check(abs(page.rect.width*25.4/72-w)<.01 and abs(page.rect.height*25.4/72-h)<.01,f'Dimensões exatas {w} × {h} mm')
            for index,text in [(1,'TESTE123456'),(2,'TESTE-QR-001'),(3,'ORDEM001'),(4,'ORDEM002')]:
                pix=doc[index].get_pixmap(dpi=dpi,alpha=False)
                image=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
                found=[b.text for b in zxingcpp.read_barcodes(image)]
                check(found==[text],f'Código {text} legível e na ordem / {dpi} / {rotation}')
            if rotation==0:
                pix=doc[5].get_pixmap(dpi=dpi,alpha=False)
                image=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
                check(image.getpixel((60,140))[0]<100 and image.getpixel((63,143))[0]>200 and image.getpixel((100,140))[0]<100,f'GFA e DG/XG / {dpi}')
                doc[0].get_pixmap(dpi=dpi).save(root/f'previa-{dpi}.png')
for w,h in [(100,100),(80,120),(150,100)]:
    with fitz.open(root/f'tamanho-{w}-{h}.pdf') as doc:
        check(len(doc)==1 and abs(doc[0].rect.width*25.4/72-w)<.01 and abs(doc[0].rect.height*25.4/72-h)<.01,f'Tamanho personalizado {w} × {h}')
with fitz.open(root/'baseline.pdf') as doc:
    check(len(doc)==1,'FT e PQ: uma página')
    pix=doc[0].get_pixmap(dpi=203,alpha=False)
    image=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
    check([b.text for b in zxingcpp.read_barcodes(image)]==['TESTE123456'],'Código legível com FT e PQ parametrizado')
with fitz.open(root/'imagens-z64-limpeza.pdf') as doc:
    check(len(doc)==13,'Z64: 13 imagens e nenhuma folha de limpeza')
    for index,page in enumerate(doc):
        check(abs(page.rect.width*25.4/72-100)<.01 and abs(page.rect.height*25.4/72-150)<.01,'Z64: dimensões físicas exatas')
        pix=page.get_pixmap(dpi=203,alpha=False)
        image=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
        for slot in range(3):
            check((image.getpixel((23+slot*20,43))[0]<100)==(slot==index%3),'Z64: conteúdo e ordem das imagens')
with fitz.open(root/'produtos.pdf') as doc:
    check(len(doc)==4,'Dois envios seguidos por duas etiquetas de produtos')
    for page in doc:
        check(abs(page.rect.width*25.4/72-100)<.01 and abs(page.rect.height*25.4/72-150)<.01,'Produtos: dimensões físicas exatas')
    for index,text in [(0,'ORDEM001'),(2,'ORDEM002')]:
        pix=doc[index].get_pixmap(dpi=203,alpha=False)
        image=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
        check([b.text for b in zxingcpp.read_barcodes(image)]==[text],'Envios preservados e intercalados na ordem')
    doc[1].get_pixmap(dpi=203).save(root/'produtos-previa.png')
for dpi in (203,300):
    with fitz.open(root/f'horizontal-{dpi}.pdf') as doc:
        check(len(doc)==2,'Horizontal: uma página por envio')
        for index,page in enumerate(doc):
            check(abs(page.rect.width*25.4/72-150)<.01 and abs(page.rect.height*25.4/72-100)<.01,'Horizontal: 150 × 100 mm')
            pix=page.get_pixmap(dpi=dpi,alpha=False)
            image=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
            check([b.text for b in zxingcpp.read_barcodes(image)]==['ORDEM001' if index==0 else 'ORDEM002'],'Código reduzido legível e na ordem')
            if index==0:pix.save(root/f'horizontal-previa-{dpi}.png')
    with fitz.open(root/f'horizontal-qr-{dpi}.pdf') as doc:
        pix=doc[0].get_pixmap(dpi=dpi,alpha=False)
        image=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
        check([b.text for b in zxingcpp.read_barcodes(image)]==['TESTE-QR-001'],'QR reduzido legível')
(root/'pdf.json').write_text(json.dumps({'checks':len(checks),'passed':checks,'pending':['Interface e prévia PNG do navegador; abertura file://','Associação das etiquetas reais aos 18 pedidos','Impressão e leitura físicas']},ensure_ascii=False,indent=2),encoding='utf-8')
print(f'PASSOU: {len(checks)} verificações de páginas, dimensões, imagens e códigos extraídos dos PDFs.')

for dpi in (203,300):
    with fitz.open(root/f'lote-100-{dpi}.pdf') as doc:
        check(len(doc)==100,f'Lote grande: 100 páginas / {dpi}')
        for index in (0,49,99):
            pix=doc[index].get_pixmap(dpi=dpi,alpha=False)
            image=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
            check([b.text for b in zxingcpp.read_barcodes(image)]==[f'{index+1:08d}'],f'Código legível na página {index+1} / {dpi}')
print('PASSOU: lotes grandes, dimensões e códigos de barras verificados.')
