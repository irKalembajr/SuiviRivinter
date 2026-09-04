import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {PDFDocument} from 'pdf-lib';
import {demo,TYPES,calculate} from '../ledger.js';
import {fullJournal,recentTransactions,exportFilename} from '../export-model.js';
import {createExcel} from '../export-excel.js';
import {createRecentPdf} from '../export-pdf.js';
function fixture(){
 const data=demo();data.opening={date:'2026-08-01',quantities:{B65:5,B33N:-2,B33V:0,B30CL:0,ALE50:3,BAC:-1},source_metadata:{}};
 data.operations=Array.from({length:12},(_,i)=>({id:'x'+i,date:'2026-08-'+String(i+2).padStart(2,'0'),created_at:'2026-08-'+String(i+2).padStart(2,'0')+'T10:00:00Z',kind:i%2?'return':'delivery',ref:i===11?'=FORMULE-INTERDITE':'BON-'+i,source:'manual',lines:calculate(i%2?'return':'delivery',[{bremer_id:TYPES[i%6].id,quantity:i+1}]).lines,note:''}));
 data.operations[10].cancel_date='2026-08-20';data.operations[10].cancelled_at='2026-08-20T10:00:00Z';data.operations[10].cancel_reason='Correction';return data;
}
test('Recent PDF is A4 landscape and limited to ten dated accounting events',async()=>{
 const data=fixture(),events=recentTransactions(data);assert.equal(events.length,10);assert.equal(events[0].date,'2026-08-20');
 const bytes=await createRecentPdf(data),doc=await PDFDocument.load(bytes);assert.equal(doc.getPageCount(),1);
 const {width:w,height:h}=doc.getPage(0).getSize();assert.ok(Math.abs(w-841.89)<.1&&Math.abs(h-595.28)<.1);
});
test('Excel preserves 23-column debit/credit/balance structure and reconciles closing balances',async()=>{
 const data=fixture(),expected=fullJournal(data),bytes=await createExcel(data),wb=new ExcelJS.Workbook();await wb.xlsx.load(bytes);const ws=wb.getWorksheet('RIVINTER');
 assert.equal(ws.getCell('A5').value,'Date');assert.equal(ws.getCell('W5').value,'Observations');assert.equal(ws.actualColumnCount,23);
 const last=6+expected.length,escaped=7+expected.findIndex(e=>e.ref==='=FORMULE-INTERDITE');assert.equal(ws.getCell('C'+escaped).value,'=FORMULE-INTERDITE');assert.equal(ws.getCell('C'+escaped).type,3);
 for(let i=0;i<TYPES.length;i++)assert.equal(ws.getCell(last,6+i*3).result,expected.at(-1).balances[TYPES[i].id]);
 assert.equal(ws.getCell(last,22).result,expected.at(-1).balanceValue);assert.equal(ws.pageSetup.orientation,'landscape');
});
test('Demo exports are visibly named',()=>assert.match(exportFilename('xlsx',true),/DEMONSTRATION/));

test('Historical negative credits remain in their original columns',()=>{
 const data=fixture();data.operations=[{id:'historical',source:'workbook',ref:'CASSE',kind:'breakage',date:'2026-08-06',metadata:{row:50,original_debits:{B65:0},original_credits:{B65:-4}},lines:[{bremer_id:'B65',delta:4,unit_price:16500}]}];
 const [row]=fullJournal(data);assert.equal(row.debits.B65,0);assert.equal(row.credits.B65,-4);assert.equal(row.balances.B65,9);
});
