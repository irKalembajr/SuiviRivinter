import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {createWorker} from 'tesseract.js';
import {parseDocument} from './pdf-parser.js';
GlobalWorkerOptions.workerSrc=workerUrl;
export async function readPdf(file,mappings,onProgress=()=>{}){
 if(file.size>15*1024*1024)throw Error('PDF limité à 15 Mo.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Le fichier n’est pas un PDF valide.');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 const doc=await getDocument({data:bytes,isEvalSupported:false}).promise;let text='',worker,ocr=false,confidence=100;
 try{
  if(doc.numPages>10)throw Error('PDF limité à 10 pages.');
  for(let i=1;i<=doc.numPages;i++){
   onProgress('Lecture de la page '+i+'/'+doc.numPages);const page=await doc.getPage(i),content=await page.getTextContent();let plain='',lastY;
   for(const item of content.items){if(!('str' in item))continue;const y=Math.round(item.transform[5]);if(lastY!==undefined&&Math.abs(y-lastY)>3)plain+='\n';plain+=item.str+' ';lastY=y;if(item.hasEOL)plain+='\n';}
   if(plain.trim().length<80){
    ocr=true;if(!worker)worker=await createWorker('fra',1,{workerPath:new URL('/ocr/worker.min.js',location.origin).href,corePath:new URL('/ocr/core',location.origin).href,langPath:new URL('/ocr',location.origin).href,logger:m=>{if(m.status==='recognizing text')onProgress('OCR page '+i+'/'+doc.numPages+' · '+Math.round(m.progress*100)+' %');}});
    const vp=page.getViewport({scale:Math.min(3,2200/page.getViewport({scale:1}).width)}),canvas=document.createElement('canvas');canvas.width=vp.width;canvas.height=vp.height;
    await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
    const r=await worker.recognize(canvas);plain=r.data.text;confidence=Math.min(confidence,r.data.confidence);canvas.width=canvas.height=0;
   }text+='\n'+plain;
  }return {...parseDocument(text,{pages:doc.numPages,mappings,ocr,confidence}),hash,text,filename:file.name};
 }finally{if(worker)await worker.terminate();await doc.destroy();}
}
