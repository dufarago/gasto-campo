-- Promove um usuário a gestor (rode no SQL Editor após o primeiro cadastro).
-- Troque o e-mail abaixo pelo seu.

update public.profiles
set role = 'gestor'
where email = 'SEU_EMAIL@empresa.com';

-- Opcional: promover financeiro
-- update public.profiles
-- set role = 'financeiro'
-- where email = 'financeiro@empresa.com';

select id, email, name, role from public.profiles order by created_at;
