import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDocument,parseNumber} from '../pdf-parser.js';
test('Delivery date differs from edition; cases are not divided',()=>{
 const p=parseDocument('Date :04/09/2026\nBon de livraison N°5200000001\nDate de livraison:03/09/2026\n2018 DOPPEL 50CL VC C20 100 BRS C20\n2905 TEMBO 33CL VC C24 240 BRS C24',{ocr:true});
 assert.equal(p.date,'2026-09-03');assert.equal(p.rows.find(x=>x.bremer_id==='ALE50').quantity,100);assert.ok(p.warnings.length>=2);
});
test('Returned bottles and crates are not double counted; incomplete scan warned',()=>{
 const p=parseDocument('Page: 1/2 03/09/2026\nBon de Déconsignation N°5300000001/000000/2026\n250035 BOUTEILLE BREMER 65 -24 1.000,00 -24.000,00\n250080 CASIER DE 12 TROUS -2 4.500,00 -9.000,00',{pages:1});
 assert.equal(p.rows.find(x=>x.bremer_id==='B65').quantity,2);
 assert.equal(p.rows.find(x=>x.bremer_id==='BAC').quantity,0);
 assert.equal(p.source_amount,33000);assert.ok(p.warnings.some(w=>w.includes('incomplet')));
});
test('Unknown codes, incompatible bottles and multiple bons cannot silently import',()=>{
 assert.ok(parseDocument('Bon de livraison N°5200000001\n9999 INCONNU VC C20 10 BRS').unknown.length);
 assert.ok(parseDocument('Bon de Déconsignation N°5300000001\n250035 BOUTEILLE BREMER 65 -13 1.000,00 -13.000,00').unknown.length);
 assert.equal(parseDocument('Bon de livraison N°5200000001\nBon de livraison N°5200000002').blocked,true);
});
test('French numbers',()=>{assert.equal(parseNumber('-21.520'),-21520);assert.equal(parseNumber('-4.140.000,00'),-4140000);});
