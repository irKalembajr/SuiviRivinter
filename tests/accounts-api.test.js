import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/accounts.js';
test('Account endpoint rejects unsupported methods and missing server configuration',async()=>{
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};
 await handler({method:'GET'},res);assert.equal(res.code,405);assert.equal(res.headers['Cache-Control'],'no-store');
 const old=process.env.SUPABASE_URL;delete process.env.SUPABASE_URL;
 try{await handler({method:'POST'},res);assert.equal(res.code,503);}finally{if(old!==undefined)process.env.SUPABASE_URL=old;}
});
