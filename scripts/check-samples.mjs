import {createWorker} from 'tesseract.js';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),lang=require('@tesseract.js-data/fra');
const w=await createWorker('fra',1,{langPath:lang.langPath,cacheMethod:'none'});
try{for(const path of process.argv.slice(2)){const {data}=await w.recognize(path);console.log(path,data.confidence,data.text);await writeFile(path+'.ocr.txt',data.text);}}finally{await w.terminate();}
