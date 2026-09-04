import test from 'node:test';
import assert from 'node:assert/strict';
import {periodSummary} from '../ledger.js';
test('Monthly summary includes dated cancellations and excludes undated records',()=>{
 const line=n=>[{bremer_id:'B65',delta:n}];
 const data={operations:[{date:'2026-08-01',kind:'delivery',lines:line(10)},{date:'2026-08-02',kind:'return',lines:line(-3),cancel_date:'2026-08-04'},{date:'2026-07-15',kind:'delivery',lines:line(2),cancel_date:'2026-08-05'},{date:null,kind:'delivery',lines:line(999)}]};
 const r=periodSummary(data,'2026-08-01','2026-08-31')[0];
 assert.equal(r.delivery,8);assert.equal(r.returned,0);assert.equal(r.gap,8);assert.equal(r.net,8);assert.equal(r.debit,13);assert.equal(r.credit,5);
});
