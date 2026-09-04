import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {TYPES} from '../ledger.js';
test('PDF requires owned stored document, review, warning justification and unique hash',async()=>{
 const db=new PGlite();const uid='00000000-0000-4000-8000-000000000001';
 try{
 await db.exec("create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key);create table storage.objects(bucket_id text,name text);create function auth.uid() returns uuid language sql stable as $$select '00000000-0000-4000-8000-000000000001'::uuid$$;");
 await db.exec(await readFile(new URL('../supabase/001_global.sql',import.meta.url),'utf8'));
 await db.exec("insert into auth.users values(auth.uid());insert into rg_profiles(id,full_name,email,role) values(auth.uid(),'Test','test@example.test','admin');update rg_opening set date='2026-07-31';");
 const p={request_id:crypto.randomUUID(),date:'2026-08-01',kind:'return',ref:'5300000000',rows:TYPES.map(t=>({bremer_id:t.id,quantity:t.id==='B65'?1:0})),source:'pdf',reviewed:true,document_path:uid+'/sample.pdf',pdf_sha256:'c'.repeat(64),metadata:{warnings:['OCR à vérifier']},note:'Contrôlé'};
 await assert.rejects(db.query('select rg_post($1)',[p]),/non conservé/);
 await db.query("insert into storage.objects values('rg-documents',$1)",[p.document_path]);
 await assert.rejects(db.query('select rg_post($1)',[{...p,reviewed:false}]),/Vérification/);
 await assert.rejects(db.query('select rg_post($1)',[{...p,note:''}]),/avertissements/);
 await assert.rejects(db.query('select rg_post($1)',[{...p,document_path:'someone-else/file.pdf'}]),/non conservé/);
 await db.query('select rg_post($1)',[p]);
 await assert.rejects(db.query('select rg_post($1)',[{...p,request_id:crypto.randomUUID(),ref:'5300000001'}]),/unique constraint/);
 await assert.rejects(db.query('select rg_post($1)',[{...p,request_id:crypto.randomUUID(),ref:p.ref+'/000000/2026',pdf_sha256:'d'.repeat(64)}]),/déjà enregistré/);
 }finally{await db.close();}
});
