import {createClient} from '@supabase/supabase-js';
export const db=import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_ANON_KEY?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY):null;
const checked=r=>{if(r.error)throw r.error;return r.data;};
async function all(table,order='id'){let result=[];for(let offset=0;;offset+=1000){const rows=checked(await db.from(table).select('*').order(order).range(offset,offset+999));result.push(...rows);if(rows.length<1000)return result;}}
export async function loadData(){
 const user=checked(await db.auth.getUser()).user;if(!user)throw Error('Connectez-vous.');
 const profile=checked(await db.from('rg_profiles').select('*').eq('id',user.id).single());
 if(!profile.active)throw Error('Ce compte est désactivé.');
 const [operations,opening,profiles,mappings,audit]=await Promise.all([all('rg_operations'),db.from('rg_opening').select('*').eq('id',1).single().then(checked),profile.role==='admin'?all('rg_profiles'):Promise.resolve([profile]),all('rg_mappings','code'),profile.role==='admin'?all('rg_audit'):Promise.resolve([])]);
 return {profile,operations,opening,profiles,mappings,audit};
}
export async function rpc(name,args){return checked(await db.rpc(name,args));}
export async function upload(file,request){const user=checked(await db.auth.getUser()).user;const path=user.id+'/'+request+'.pdf';checked(await db.storage.from('rg-documents').upload(path,file,{contentType:'application/pdf',upsert:false}));return path;}
export async function documentUrl(path){return checked(await db.storage.from('rg-documents').createSignedUrl(path,120)).signedUrl;}
export async function createAccount(payload){const token=checked(await db.auth.getSession()).session?.access_token;const response=await fetch('/api/accounts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw Error(result.error||'Création impossible.');return result;}
