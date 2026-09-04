-- Exécuter UNE FOIS après création du premier utilisateur dans Authentication > Users.
-- Remplacer uniquement l'adresse ci-dessous par celle du compte créé.
-- Ce script ne crée pas de mot de passe et ne modifie aucun compte existant.
do $$
declare target_email text := 'REMPLACER@exemple.com'; target_id uuid;
begin
 if exists(select 1 from public.rg_profiles) then
  raise exception 'Des profils existent déjà. Utilisez Gestion des comptes.';
 end if;
 select id into target_id from auth.users where lower(email)=lower(target_email);
 if target_id is null then raise exception 'Créez d’abord cet utilisateur dans Authentication > Users.';end if;
 insert into public.rg_profiles(id,full_name,email,role,active)
 values(target_id,'Administrateur principal',target_email,'admin',true);
end $$;
