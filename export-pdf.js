import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {TYPES,balances,position,today} from './ledger.js';
import {recentTransactions,exportWarnings} from './export-model.js';
const fmt=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(n).replace(/[\u202f\u00a0]/g,' ');
const text=s=>String(s??'').replace(/[\u2010-\u2015\u2212]/g,'-').replace(/[\u202f\u00a0]/g,' ').replace(/[\r\n\t]/g,' ');
export async function createRecentPdf(data,{isDemo=false,logoBytes}={}){
 const events=recentTransactions(data),doc=await PDFDocument.create();doc.setTitle('RIVINTER - 10 dernières transactions');doc.setAuthor('RIVINTER');
 const page=doc.addPage([841.89,595.28]),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const navy=rgb(.06,.16,.26),gray=rgb(.35,.4,.47),white=rgb(1,1,1);const margin=28,width=785.89;
 const safe=s=>Array.from(text(s)).map(c=>{try{font.encodeText(c);return c;}catch{return '?';}}).join('');
 function draw(s,x,y,size=9,heavy=false,color=navy){page.drawText(safe(s),{x,y,size,font:heavy?bold:font,color});}
 function wrap(s,w,size=8,f=font){const chars=Array.from(safe(s)),lines=[];let line='';for(const c of chars){if(line&&f.widthOfTextAtSize(line+c,size)>w){lines.push(line);line='';}line+=c;}if(line||!lines.length)lines.push(line);return lines;}
 if(logoBytes){const logo=await doc.embedPng(logoBytes);const dims=logo.scaleToFit(76,42);page.drawImage(logo,{x:margin,y:536,width:dims.width,height:dims.height});}
 draw('RIVINTER - COMPTE EMBALLAGES',116,566,17,true);
 draw('Les '+events.length+' dernières transactions datées',116,547,11);
 draw((isDemo?'DÉMONSTRATION - ':'')+'Export du '+today(),590,566,9,true);
 draw('Classement : date du mouvement, puis ordre de saisie. Annulations incluses.',margin,519,9,false,gray);
 const cols=[{label:'Date',w:57},{label:'Nature / référence du bon',w:238},...['65 cl','33 noir','33 vert','30 cl','50 cl','Bacs'].map(label=>({label,w:57})),{label:'Impact (Fc)',w:148.89}];
 let x=margin;for(const c of cols){page.drawRectangle({x,y:477,width:c.w,height:27,color:navy});draw(c.label,x+5,488,8,true,white);x+=c.w;}
 let y=477;
 for(let i=0;i<events.length;i++){
  const e=events[i],label=wrap(e.label,228,8),reference=wrap('Bon : '+e.ref,228,8),height=Math.max(26,(label.length+reference.length)*9+7);
  // Keep all content on A4; unusually long references are continued on an annex page below.
  const displayed=[...label,...reference],maxLines=3;const rowHeight=Math.min(height,36);
  page.drawRectangle({x:margin,y:y-rowHeight,width,height:rowHeight,color:i%2?rgb(.94,.96,.98):white});
  draw(e.date.split('-').reverse().join('/'),margin+4,y-15,8);
  displayed.slice(0,maxLines).forEach((line,j)=>draw(line,margin+62,y-10-j*9,8,j>=label.length));
  if(displayed.length>maxLines)draw('*',margin+284,y-12,8,true);
  let cx=margin+295;for(const t of TYPES){const n=fmt(e.delta[t.id]);draw(n,cx+52-font.widthOfTextAtSize(n,8),y-15,8);cx+=57;}
  const amount=fmt(e.value);draw(amount,margin+width-7-bold.widthOfTextAtSize(amount,9),y-15,9,true);
  page.drawLine({start:{x:margin,y:y-rowHeight},end:{x:margin+width,y:y-rowHeight},thickness:.3,color:rgb(.8,.84,.88)});y-=rowHeight;
 }
 if(!events.length)draw('Aucune transaction datée à exporter.',margin+8,450,11);
 const total=events.reduce((n,e)=>n+e.value,0);
 y-=20;draw('Impact net des '+events.length+' transactions : '+fmt(total)+' Fc',margin,y,10,true);
 const global=balances(data).reduce((n,t)=>n+t.value,0);y-=18;draw('Solde global (historique complet) : '+fmt(global)+' Fc - '+position(global),margin,y,10,true);
 const notes=['Quantités signées : casiers complets ; bacs seuls. Positif = débit, négatif = crédit.',...exportWarnings(data)];
 for(const note of notes)for(const line of wrap(note,width,8)){y-=12;draw(line,margin,y,8,false,gray);}
 // Only exceptionally long free-text references require a continuation, never silent truncation.
 const overflow=events.filter(e=>wrap(e.label,228,8).length+wrap('Bon : '+e.ref,228,8).length>3);
 if(overflow.length){
  let extra=doc.addPage([841.89,595.28]),ey=550;
  extra.drawText('RIVINTER - Références complètes (*)',{x:margin,y:ey,size:14,font:bold,color:navy});ey-=30;
  for(const e of overflow)for(const l of wrap(e.date+' - '+e.label+' - Bon : '+e.ref,width,10)){extra.drawText(l,{x:margin,y:ey,size:10,font,color:navy});ey-=15;}
 }
 doc.getPages().forEach((p,i)=>p.drawText('RIVINTER | Page '+(i+1)+' / '+doc.getPageCount(),{x:margin,y:18,size:8,font,color:gray}));
 return doc.save();
}
