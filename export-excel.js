import ExcelJS from 'exceljs';
import style from './excel-style.json' with {type:'json'};
import {TYPES,today} from './ledger.js';
import {fullJournal,exportWarnings} from './export-model.js';
const copy=x=>JSON.parse(JSON.stringify(x));
const letter=n=>String.fromCharCode(64+n);
const dateValue=d=>d?new Date(d+'T00:00:00Z'):null;
export async function createExcel(data,{isDemo=false}={}){
 const wb=new ExcelJS.Workbook();wb.creator='RIVINTER';wb.created=new Date();wb.calcProperties.fullCalcOnLoad=true;
 const ws=wb.addWorksheet('RIVINTER',{views:[{state:'frozen',xSplit:3,ySplit:5,showGridLines:false}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:5'}});
 style.widths.forEach((w,i)=>ws.getColumn(i+1).width=w);
 for(let r=1;r<=5;r++)for(let c=1;c<=23;c++){const cell=ws.getCell(r,c),s=style.rows[r-1][c-1];cell.style=copy(s.style);cell.value=s.value;}
 ws.getCell('B2').value='RIVIERA INTERNATIONAL';
 ws.getCell('B3').value=isDemo?'DÉMONSTRATION':style.rows[2][1].value;
 ws.getCell('B3').numFmt='@';
 ws.getCell('V1').value=style.rows[0][21].value;
 // Source group headers span three columns; presentation merges prevent clipping.
 for(const c of [4,7,10,13,16,19]){ws.mergeCells(4,c,4,c+2);ws.getCell(4,c).alignment={horizontal:'center',vertical:'middle'};}
 ws.getRow(1).height=30;ws.getRow(2).height=30;ws.getRow(4).height=23;ws.getRow(5).height=32;
 for(const addr of ['A1','A2'])ws.getCell(addr).alignment={wrapText:true,vertical:'middle'};
 for(let c=1;c<=23;c++)ws.getCell(5,c).alignment={horizontal:'center',vertical:'middle',wrapText:true};
 ws.getCell('W5').value='Observations';
 const journal=fullJournal(data),last=6+journal.length;
 const rows=[null,...journal];
 for(let i=0;i<rows.length;i++){
  const r=6+i,e=rows[i];ws.getRow(r).height=e?Math.max(20,16*Math.max(Math.ceil(e.label.length/32),Math.ceil(e.ref.length/18),e.cancelled?3:!e.date?2:1)):32;
  for(let c=1;c<=23;c++){
   const cell=ws.getCell(r,c);cell.style=copy(style.rows[e?6:5][c-1].style);
   cell.alignment={...cell.alignment,vertical:'middle',wrapText:c===2||c===3||c===23};
   cell.border={bottom:{style:'hair',color:{argb:'FFB4C6D9'}}};
   if(e&&i%2===0&&![6,9,12,15,18,21].includes(c))cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFC0E6F5'}};
  }
  ws.getCell(r,1).value=dateValue(e?.date||(!e?data.opening.date:null));ws.getCell(r,1).numFmt='dd/mm/yyyy';
  ws.getCell(r,2).value=e?e.label:(data.opening.date?'REPORT AU '+data.opening.date.split('-').reverse().join('/'):(data.opening.source_metadata?.raw_label||'REPORT INITIAL'));
  ws.getCell(r,3).value=e?e.ref:(data.opening.source_metadata?.raw_ref||'');ws.getCell(r,3).numFmt='@';
  for(let t=0;t<TYPES.length;t++){
   const type=TYPES[t],c=4+t*3,d=letter(c),cr=letter(c+1),s=letter(c+2);
   ws.getCell(r,c).value=e?e.debits[type.id]:null;ws.getCell(r,c+1).value=e?e.credits[type.id]:null;
   ws.getCell(r,c+2).value=e?{formula:s+(r-1)+'+'+d+r+'-'+cr+r,result:e.balances[type.id]}:Number(data.opening.quantities[type.id]||0);
   for(let j=0;j<3;j++)ws.getCell(r,c+j).numFmt='#,##0;-#,##0;0';
  }
  const value=e?e.balanceValue:TYPES.reduce((n,t)=>n+Number(data.opening.quantities[t.id]||0)*t.price,0);
  ws.getCell(r,22).value={formula:TYPES.map((t,i)=>letter(6+i*3)+r+'*'+letter(6+i*3)+'$3').join('+'),result:value};ws.getCell(r,22).numFmt='#,##0.00;[Red]-#,##0.00';
  ws.getCell(r,23).value=e?[!e.date?'DATE À CONFIRMER':'',e.source==='reversal'?'Contrepassation':e.cancelled?'Original conservé, voir annulation':''].filter(Boolean).join(' · '):(!data.opening.date?'DATE À CONFIRMER':'');
  if(!ws.getCell(r,23).value)ws.getCell(r,23).value=null;
  ws.getCell(r,21).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF4B084'}};
 }
 ws.addConditionalFormatting({ref:'U6:U'+last,rules:[{type:'cellIs',operator:'lessThan',formulae:[0],style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFFF0000'}},font:{color:{argb:'FF000000'}}}}]});
 for(let i=0;i<6;i++){const id=TYPES[i].id;ws.getCell(1,6+i).value={formula:letter(6+i*3)+'6',result:Number(data.opening.quantities[id]||0)};}
 ws.getCell('L1').value={formula:'V6',result:TYPES.reduce((n,t)=>n+Number(data.opening.quantities[t.id]||0)*t.price,0)};
 ws.autoFilter={from:'A5',to:'W'+last};
 const noteRow=last+2;ws.mergeCells(noteRow,1,noteRow,23);ws.getCell(noteRow,1).value=(isDemo?'DÉMONSTRATION - ':'')+'Export du '+today()+'. Solde positif : Rivinter doit à Brasimba. Solde négatif : Brasimba doit à Rivinter.';
 ws.getCell(noteRow,1).font={name:'Arial',size:11,italic:true};ws.getRow(noteRow).height=22;
 const notes=exportWarnings(data);if(notes.length){ws.mergeCells(noteRow+1,1,noteRow+1,23);ws.getCell(noteRow+1,1).value=notes.join(' ');ws.getRow(noteRow+1).height=25;}
 ws.pageSetup.printArea='A1:W'+(noteRow+1);
 ws.headerFooter.oddFooter='&LRIVINTER&CPage &P / &N&RExport du '+today();
 return wb.xlsx.writeBuffer();
}
