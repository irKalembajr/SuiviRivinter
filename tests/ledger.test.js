import test from 'node:test';
import assert from 'node:assert/strict';
import {TYPES,calculate,balances,normalizeRef} from '../ledger.js';
test('Delivery increases debt; return and paid reduce it',()=>{
 assert.equal(calculate('delivery',[{bremer_id:'ALE50',quantity:100}]).value,2450000);
 assert.equal(calculate('return',[{bremer_id:'ALE50',quantity:100}]).value,-2450000);
 assert.equal(calculate('paid',[{bremer_id:'B65',quantity:10}]).bv,165000);
});
test('Bottle deposit pairs cases and bacs once',()=>{
 const r=calculate('bottles',[{bremer_id:'B65',quantity:24}]);
 assert.deepEqual(r.lines,[{bremer_id:'B65',delta:-2,unit_price:16500},{bremer_id:'BAC',delta:2,unit_price:4500}]);
 assert.equal(r.value,-24000);assert.equal(r.bv,24000);
 assert.throws(()=>calculate('bottles',[{bremer_id:'B65',quantity:13}]),/multiple/);
});
test('Breakage credits surviving bacs; complete losses do not',()=>{
 assert.equal(calculate('breakage',[{bremer_id:'ALE50',quantity:2}]).value,40000);
 assert.equal(calculate('loss',[{bremer_id:'ALE50',quantity:2}]).value,49000);
});
test('Undated originals remain in global, excluded from dated reports',()=>{
 const data={opening:{date:null,quantities:{B65:10}},operations:[{date:null,lines:[{bremer_id:'B65',delta:2,unit_price:16500}]},{date:'2026-08-01',cancel_date:'2026-08-05',lines:[{bremer_id:'B65',delta:3,unit_price:16500}]}]};
 assert.equal(balances(data,'2026-08-03')[0].quantity,15);
 assert.equal(balances(data,'2026-08-06')[0].quantity,12);
 assert.equal(balances(data,'2026-08-03',false)[0].quantity,3);
});
test('Reference normalization and integer rejection',()=>{
 assert.equal(normalizeRef('5300000000/000000/2026'),'5300000000');
 for(const n of [-1,1.5,Infinity,NaN])assert.throws(()=>calculate('delivery',[{bremer_id:'B65',quantity:n}]));
});
