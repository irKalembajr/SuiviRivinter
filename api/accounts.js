import {createClient} from '@supabase/supabase-js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST requis.'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:'Configurer les variables serveur Supabase sur Vercel.'});
 const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error}=await db.auth.getUser((req.headers.authorization||'').replace(/^Bearer /,''));
 if(error||!auth.user)return res.status(401).json({error:'Session invalide.'});
 const {data:profile}=await db.from('rg_profiles').select('role,active').eq('id',auth.user.id).single();
 if(!profile?.active||profile.role!=='admin')return res.status(403).json({error:'Administrateur requis.'});
 const {email,password,full_name,role}=req.body||{};
 if(typeof email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<12||typeof full_name!=='string'||full_name.trim().length<2||full_name.length>120||!['admin','user'].includes(role))return res.status(400).json({error:'Nom, email, rôle et mot de passe de 12 caractères minimum requis.'});
 const {data:created,error:creationError}=await db.auth.admin.createUser({email,password,email_confirm:true});
 if(creationError)return res.status(400).json({error:'Création impossible : vérifier l’adresse ou un compte déjà existant.'});
 const {error:insertError}=await db.from('rg_profiles').insert({id:created.user.id,email,full_name:full_name.trim(),role,active:true});
 if(insertError){await db.auth.admin.deleteUser(created.user.id);return res.status(500).json({error:'Création du profil impossible.'});}
 await db.from('rg_audit').insert({action:'create_account',actor_id:auth.user.id,details:{id:created.user.id,role}});
 return res.status(201).json({id:created.user.id});
}
