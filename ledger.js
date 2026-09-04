export const TYPES=[{id:'B65',label:'Bremer 65 cl',price:16500,pack:12,bottle:1000},{id:'B33N',label:'Bremer noir 33 cl',price:16500,pack:24,bottle:500},{id:'B33V',label:'Bremer vert 33 cl',price:16500,pack:24,bottle:500},{id:'B30CL',label:'Bambi 30 cl',price:16500,pack:24,bottle:500},{id:'ALE50',label:'ALE 50 cl',price:24500,pack:20,bottle:1000},{id:'BAC',label:'Bacs',price:4500,pack:1,bottle:0}];
export const KINDS={delivery:'Consignation / livraison',return:'Déconsignation / retour',paid:'Consignation payante',bottles:'Consignation bouteilles',breakage:'Casse et manquant bouteilles',loss:'Perte emballage complet',legacy:'Reprise historique'};
export const money=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(n)+' Fc';
export const qty=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(n);
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const monthRange=m=>({start:m+'-01',end:m+'-'+new Date(Number(m.slice(0,4)),Number(m.slice(5)),0).getDate()});
export const position=n=>n>0?'Rivinter doit à Brasimba':n<0?'Brasimba doit à Rivinter':'Équilibré';
export function normalizeRef(s){const r=String(s||'').trim().toUpperCase().replace(/\s+/g,'');return /^\d{10}(\/\d+\/\d{4})?$/.test(r)?r.slice(0,10):r;}
export function calculate(kind,rows){
 if(!KINDS[kind]||kind==='legacy')throw Error('Type invalide.');
 const lines=TYPES.map(t=>({bremer_id:t.id,delta:0,unit_price:t.price}));let bv=0;
 for(const r of rows){const t=TYPES.find(x=>x.id===r.bremer_id);const n=Number(r.quantity);if(!t||!Number.isSafeInteger(n)||n<0||n>10000000)throw Error('Quantité entière invalide.');if(!n)continue;
  if(['bottles','breakage'].includes(kind)&&t.id==='BAC')throw Error('Les bacs associés sont calculés automatiquement.');
  let q=n;if(kind==='bottles'){if(n%t.pack)throw Error(t.label+' : multiple de '+t.pack+' bouteilles requis.');q=n/t.pack;bv+=n*t.bottle;}
  if(kind==='paid')bv+=q*t.price;
  lines.find(x=>x.bremer_id===t.id).delta+=(['delivery','breakage','loss'].includes(kind)?q:-q);
  if(kind==='bottles')lines.find(x=>x.bremer_id==='BAC').delta+=q;
  if(kind==='breakage')lines.find(x=>x.bremer_id==='BAC').delta-=q;
 }
 if(!lines.some(l=>l.delta))throw Error('Saisissez au moins une quantité.');return {lines:lines.filter(l=>l.delta),bv,value:lines.reduce((n,l)=>n+l.delta*l.unit_price,0)};
}
export function balances(data,end=today(),includeUndated=true){
 return TYPES.map(t=>{let quantity=0,value=0;if(data.opening.date?data.opening.date<=end:includeUndated){quantity=Number(data.opening.quantities[t.id]||0);value=quantity*t.price;}
  for(const m of data.operations){if(!m.date&&!includeUndated)continue;for(const l of m.lines||[]){if(l.bremer_id!==t.id)continue;if(m.date?m.date<=end:includeUndated){quantity+=Number(l.delta);value+=Number(l.delta)*Number(l.unit_price);}if(m.cancel_date&&m.cancel_date<=end){quantity-=Number(l.delta);value-=Number(l.delta)*Number(l.unit_price);}}}return {...t,quantity,value};});
}
export function periodSummary(data,start,end){
 return TYPES.map(t=>{let debit=0,credit=0,delivery=0,returned=0;
  for(const m of data.operations){if(!m.date)continue;const amount=Number(m.lines.find(l=>l.bremer_id===t.id)?.delta||0);
   for(const [date,sign] of [[m.date,1],[m.cancel_date,-1]])if(date&&date>=start&&date<=end){
    const delta=amount*sign;debit+=Math.max(delta,0);credit+=Math.max(-delta,0);
    if(m.kind==='delivery')delivery+=delta;if(m.kind==='return')returned-=delta;
   }
  }return {...t,debit,credit,delivery,returned,gap:delivery-returned,net:debit-credit};
 });
}
export function demo(){const d=today();return {profile:{role:'admin',active:true,full_name:'Démonstration'},profiles:[],opening:{date:'2000-01-01',quantities:{B65:100,B33N:-40,B33V:10,B30CL:-20,ALE50:50,BAC:-8},locked:true,revision:0},operations:[{id:'demo-1',request_id:'demo-1',date:d,kind:'delivery',ref:'DEMO-BL-001',source:'manual',note:'Exemple fictif',lines:calculate('delivery',[{bremer_id:'ALE50',quantity:100}]).lines,created_at:d},{id:'demo-2',request_id:'demo-2',date:d,kind:'return',ref:'DEMO-BD-001',source:'manual',lines:calculate('return',[{bremer_id:'B65',quantity:30}]).lines,created_at:d}],audit:[],mappings:[]};}
