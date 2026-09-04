import {TYPES,KINDS,today} from './ledger.js';
const labels={delivery:'BON DE CONSIGNATION',return:'BON DE DECONSIGNATION',paid:'CONSIGNATION PAYANTE',bottles:'CONSIGNATION BOUTEILLES',breakage:'CASSE ET MANQUANT BOUTEILLES',loss:'PERTE EMBALLAGE COMPLET',legacy:'REPRISE HISTORIQUE'};
export const exportValue=lines=>lines.reduce((n,l)=>n+Number(l.delta)*Number(l.unit_price),0);
export function datedOrder(a,b){return (a.date||'').localeCompare(b.date||'')||(a.created_at||'').localeCompare(b.created_at||'')||(Number(a.source_row)||0)-(Number(b.source_row)||0)||a.key.localeCompare(b.key);}
export function exportEvents(data){
 const events=[];
 for(const m of data.operations){
  const delta=Object.fromEntries(TYPES.map(t=>[t.id,0]));
  for(const l of m.lines||[]){if(!(l.bremer_id in delta)||!Number.isSafeInteger(Number(l.delta)))throw Error('Ligne comptable invalide : '+m.ref);delta[l.bremer_id]+=Number(l.delta);}
  const debits={},credits={};
  for(const t of TYPES){
   const d=m.metadata?.original_debits?.[t.id],c=m.metadata?.original_credits?.[t.id];
   if(m.source==='workbook'&&Number.isSafeInteger(d)&&Number.isSafeInteger(c)&&d-c===delta[t.id]){debits[t.id]=d;credits[t.id]=c;}
   else{debits[t.id]=Math.max(delta[t.id],0);credits[t.id]=Math.max(-delta[t.id],0);}
  }
  const base={key:m.id||m.source_key||m.request_id||String(events.length),date:m.date||null,ref:String(m.ref),label:m.metadata?.source_kind||labels[m.kind]||KINDS[m.kind],kind:m.kind,source:m.source,source_row:m.metadata?.row,created_at:m.created_at||'',debits,credits,delta,value:exportValue(m.lines||[]),note:m.note||'',cancelled:!!m.cancel_date};
  events.push(base);
  if(m.cancel_date)events.push({...base,key:base.key+':cancel',date:m.cancel_date,created_at:m.cancelled_at||m.created_at||'',source:'reversal',source_row:null,label:'ANNULATION - '+base.label,debits:credits,credits:debits,delta:Object.fromEntries(TYPES.map(t=>[t.id,-delta[t.id]])),value:-base.value,note:m.cancel_reason||'',cancelled:false});
 }
 return events;
}
export function fullJournal(data){
 const events=exportEvents(data),historic=events.filter(e=>e.source==='workbook').sort((a,b)=>(a.source_row||0)-(b.source_row||0)||datedOrder(a,b));
 const rest=events.filter(e=>e.source!=='workbook').sort(datedOrder);
 const running=Object.fromEntries(TYPES.map(t=>[t.id,Number(data.opening.quantities[t.id]||0)]));
 return [...historic,...rest].map(e=>{for(const t of TYPES)running[t.id]+=e.delta[t.id];return {...e,balances:{...running},balanceValue:TYPES.reduce((n,t)=>n+running[t.id]*t.price,0)};});
}
export function recentTransactions(data,limit=10){
 return exportEvents(data).filter(e=>e.date).sort(datedOrder).reverse().slice(0,limit);
}
export function exportWarnings(data){
 const notes=[];if(!data.opening.date)notes.push('Date du report initial non confirmée.');
 const count=data.operations.filter(m=>!m.date).length;if(count)notes.push(count+' écriture(s) sans date : incluses dans l’Excel, exclues du classement des dernières transactions.');
 return notes;
}
export const exportFilename=(ext,isDemo=false)=>'RIVINTER-'+(isDemo?'DEMONSTRATION-':'')+(ext==='pdf'?'10-DERNIERES-TRANSACTIONS-':'AU-')+today()+'.'+ext;
