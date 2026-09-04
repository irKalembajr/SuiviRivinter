import {TYPES} from './ledger.js';
export const DEFAULT_MAP={'2018':'ALE50','2997':'ALE50','2927':'ALE50','2905':'B33N'};
export const BOTTLES={'250035':'B65','250027':'B33N','250028':'B33V','250060':'B30CL','250030':'ALE50'};
const CRATES=new Set(['250080','250083','250076','250082']);
export function parseNumber(s){let t=String(s).trim().replace(/[−–]/g,'-').replace(/\s/g,'');const neg=t.startsWith('-')||t.endsWith('-');t=t.replace(/-/g,'');if(t.includes(','))t=t.replace(/\./g,'').replace(',','.');else if(/^\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,'');const n=Number(t);return Number.isFinite(n)?(neg?-n:n):NaN;}
const clean=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
function dateISO(s){const m=s?.match(/(\d{2})[/.](\d{2})[/.](20\d{2})/);if(!m)return '';const x=m[3]+'-'+m[2]+'-'+m[1],d=new Date(x+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===x?x:'';}
export function parseDocument(text,{pages=1,mappings={},ocr=false,confidence=100}={}){
 const normalized=clean(text),kind=/DECONSIGNATION/.test(normalized)?'return':/BON DE LIVRAISON|BON DE CONSIGNATION/.test(normalized)?'delivery':'';
 const ref=normalized.match(/(?:DECONSIGNATION|LIVRAISON|CONSIGNATION)\s*N[°ºO]?\s*[:.]?\s*(\d{10}(?:\/\d+\/\d{4})?)/)?.[1]||'';
 const deliveryDate=normalized.match(/DATE DE LIVRAISON\s*:?\s*(\d{2}[/.]\d{2}[/.]20\d{2})/)?.[1],invoiceDate=normalized.match(/DATE DE FACTURE\s*:?\s*(\d{2}[/.]\d{2}[/.]20\d{2})/)?.[1];
 const allDates=[...normalized.matchAll(/\b\d{2}[/.]\d{2}[/.]20\d{2}\b/g)].map(m=>m[0]);
 const date=dateISO(kind==='delivery'?deliveryDate:(invoiceDate||allDates[0])),warnings=[],details=[],unknown=[];
 const references=new Set([...normalized.matchAll(/(?:DECONSIGNATION|LIVRAISON|CONSIGNATION)\s*N[°ºO]?\s*[:.]?\s*(\d{10})/g)].map(m=>m[1]));
 const blocked=references.size>1||(/BON DE LIVRAISON/.test(normalized)&&/BON DE DECONSIGNATION/.test(normalized));
 if(blocked)warnings.push('Plusieurs bons détectés : séparer les documents avant encodage.');
 if(kind==='delivery')warnings.push('Vérifier les quantités effectivement livrées et les éventuelles annotations manuscrites.');
 if(!kind)warnings.push('Nature du document non reconnue : choisissez-la.');
 if(!ref)warnings.push('Numéro BL / bon non reconnu : saisissez-le.');
 if(!date)warnings.push('Date de mouvement non reconnue : saisissez-la.');
 if(new Set(allDates).size>1)warnings.push('Plusieurs dates présentes : vérifier la date de mouvement, distincte de la date d’édition.');
 const expectedPages=Math.max(0,...[...normalized.matchAll(/PAGE\s*:?\s*\d+\s*\/\s*(\d+)/g)].map(m=>Number(m[1])));
 if(expectedPages>pages)warnings.push('Document incomplet : '+expectedPages+' pages annoncées, '+pages+' reçue(s). Obtenir les pages manquantes ou justifier la saisie partielle.');
 if(ocr)warnings.push('Lecture OCR : vérifier chaque ligne et le numéro'+(confidence<80?' (qualité limitée).':'.'));
 const sums=Object.fromEntries(TYPES.map(t=>[t.id,0]));let bottleCases=0,crateCount=0,amount=0,previousBottle=null;
 const map={...DEFAULT_MAP,...mappings};
 for(const original of text.split(/\r?\n/)){
  const line=clean(original),match=line.match(/(?:^|[^\d])(\d{4,6})\s+(.+)/);if(!match)continue;const code=match[1],rest=match[2];
  if(kind==='delivery'){
   if(!/C(?:12|20|24)\b/.test(rest))continue;
   const q=rest.match(/\bC(?:12|20|24)\s+(-?\d[\d.,]*)\s+(?:BRS|[A-Z]{2,4})\b/),quantity=q?parseNumber(q[1]):NaN,bremer_id=map[code]||'';
   const entry={code,label:original,quantity,bremer_id,unit:'casiers'};details.push(entry);
   if(!bremer_id||!Number.isSafeInteger(quantity)||quantity<=0){unknown.push(entry);continue;}sums[bremer_id]+=quantity;
  }else if(kind==='return'){
   if(!/BOUTEILLE|CASIER|BAC/.test(rest))continue;
   const q=rest.match(/\s(-?\d[\d.]*-?)\s+([\d.]+,\d{2})\s+(-?[\d.]+,\d{2})/),quantity=q?Math.abs(parseNumber(q[1])):NaN,price=q?parseNumber(q[2]):NaN,lineAmount=q?Math.abs(parseNumber(q[3])):NaN;
   const entry={code,label:original,quantity,unit:BOTTLES[code]?'bouteilles':'bacs'};details.push(entry);
   if(!q||!Number.isSafeInteger(quantity)||quantity<=0){unknown.push(entry);continue;}
   if(Math.abs(quantity*price-lineAmount)>1)warnings.push('Montant incohérent pour l’article '+code+'.');amount+=lineAmount;
   if(BOTTLES[code]){
    const id=BOTTLES[code],t=TYPES.find(t=>t.id===id),cases=quantity/t.pack;entry.bremer_id=id;entry.cases=cases;
    if(!Number.isInteger(cases)){unknown.push(entry);warnings.push('Bouteilles non divisibles en casiers complets : '+code);continue;}
    sums[id]+=cases;bottleCases+=cases;previousBottle={id,cases};
   }else if(CRATES.has(code)||/CASIER|BAC/.test(rest)){crateCount+=quantity;if(previousBottle&&quantity!==previousBottle.cases)warnings.push('Nombre de bacs différent des casiers de bouteilles pour '+previousBottle.id+'.');previousBottle=null;}
   else unknown.push(entry);
  }
 }
 if(kind==='return'&&bottleCases!==crateCount)warnings.push('Écart bouteilles/bacs : '+bottleCases+' casiers et '+crateCount+' bacs lus. Vérification manuelle obligatoire.');
 if(kind==='return'&&crateCount>bottleCases)sums.BAC=crateCount-bottleCases;
 if(kind==='return'&&crateCount<bottleCases)warnings.push('Bacs manquants : compléter/corriger le document avant encodage, pas de compensation automatique.');
 if(!details.length)warnings.push('Aucune ligne reconnue : saisir les quantités manuellement.');
 if(unknown.length)warnings.push(unknown.length+' ligne(s) à identifier ou corriger. Quantités inconnues non ajoutées automatiquement.');
 return {kind,ref,date,rows:TYPES.map(t=>({bremer_id:t.id,quantity:sums[t.id]})),warnings:[...new Set(warnings)],details,unknown,source_amount:kind==='return'?amount:null,expectedPages,pages,ocr,confidence,blocked};
}
