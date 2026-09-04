import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {TYPES,calculate} from '../ledger.js';
const admin='00000000-0000-4000-8000-000000000001',user='00000000-0000-4000-8000-000000000002';
async function setup(){
 const db=new PGlite();await db.exec("create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;create function storage.extension(text) returns text language sql as $$select split_part($1,'.',2)$$;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth,storage to authenticated;grant select,insert on storage.objects to authenticated;");
 await db.exec(await readFile(new URL('../supabase/001_global.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/002_storage.sql',import.meta.url),'utf8'));
 await db.query("insert into auth.users values($1),($2)",[admin,user]);
 await db.query("insert into rg_profiles(id,full_name,email,role) values($1,'Admin','admin@example.test','admin'),($2,'User','user@example.test','user')",[admin,user]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await db.exec('set role authenticated');return db;
}
const rows=(id='B65',q=2)=>TYPES.map(t=>({bremer_id:t.id,quantity:t.id===id?q:0}));
const payload=(kind='delivery',id='B65',q=2)=>({request_id:crypto.randomUUID(),date:'2026-08-01',kind,ref:crypto.randomUUID(),rows:rows(id,q),source:'manual',note:'Motif de test',bv_amount:calculate(kind,rows(id,q)).bv});
test('SQL authoritative math, authorization, locks, duplicates, immutable postings, cancellations',async()=>{
 const db=await setup();try{
 await assert.rejects(db.query('select rg_post($1)',[payload()]),/report initial/);
 const quantities=Object.fromEntries(TYPES.map(t=>[t.id,0]));
 await db.query('select rg_save_opening($1,$2,$3,$4,$5)',['2026-07-31',quantities,true,0,'Ouverture']);
 await assert.rejects(db.query('select rg_save_opening($1,$2,$3,$4,$5)',['2026-07-30',quantities,true,1,'Modification']),/verrouillez/);
 for(const kind of ['delivery','return','paid','bottles','breakage','loss']){
  const p=payload(kind,'B65',kind==='bottles'?24:2);
  const result=await db.query('select rg_post($1) id',[p]);const id=result.rows[0].id;
  const again=await db.query('select rg_post($1) id',[p]);assert.equal(again.rows[0].id,id);
  const posted=(await db.query('select lines from rg_operations where id=$1',[id])).rows[0];
  assert.deepEqual(posted.lines,calculate(kind,p.rows).lines);
  await assert.rejects(db.query('select rg_post($1)',[{...p,request_id:crypto.randomUUID()}]),/déjà enregistré/);
 }
 const invalid=payload('paid');invalid.bv_amount=1;await assert.rejects(db.query('select rg_post($1)',[invalid]),/Montant BV/);
 await assert.rejects(db.query('delete from rg_operations'),/permission denied/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await assert.rejects(db.query('select rg_save_opening($1,$2,$3,$4,$5)',['2026-07-31',quantities,false,1,'test']),/Administrateur/);
 const id=(await db.query('select rg_post($1) id',[payload()])).rows[0].id;
 await assert.rejects(db.query('select rg_cancel($1,$2,$3)',[id,'2026-08-02','test']),/Administrateur/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
 await db.query('select rg_cancel($1,$2,$3)',[id,'2026-08-02','Correction']);
 assert.equal((await db.query('select count(*)::int n from rg_operations where id=$1',[id])).rows[0].n,1);
 await db.query('select rg_set_profile($1,$2,$3)',[user,'user',false]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 assert.equal((await db.query('select * from rg_operations')).rows.length,0);
 await assert.rejects(db.query('select rg_post($1)',[payload()]),/inactif/);
 }finally{await db.close();}
});
test('Workbook import preserves signs, repeated BV, zero and undated entries, prevents overwrite',async()=>{
 const db=await setup();try{
 const p={format:'rivinter-workbook-v1',file_hash:'a'.repeat(64),opening:{quantities:Object.fromEntries(TYPES.map(t=>[t.id,0])),source_metadata:{raw_date:'ambiguous'}},operations:[{date:null,ref:'BV',kind:'paid',source_key:'R:7',lines:[]},{date:'2026-08-01',ref:'BV',kind:'paid',source_key:'R:8',lines:[{bremer_id:'B65',delta:-1,unit_price:16500}]}]};
 assert.equal((await db.query('select rg_import_workbook($1) n',[p])).rows[0].n,2);
 const opening=(await db.query('select * from rg_opening')).rows[0];assert.equal(opening.date,null);assert.equal(opening.locked,true);
 const ops=(await db.query('select * from rg_operations order by source_key')).rows;assert.equal(ops[0].date,null);assert.deepEqual(ops[0].lines,[]);
 await assert.rejects(db.query('select rg_import_workbook($1)',[p]),/déjà/);
 await assert.rejects(db.query('select rg_import_workbook($1)',[{...p,file_hash:'b'.repeat(64)}]),/compte neuf/);
 }finally{await db.close();}
});
