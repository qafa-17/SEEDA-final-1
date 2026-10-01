-- Removes ONLY the synthetic data from seed.sql: seeded articles (their
-- history, checks and publish attempts go with them) and the fictional team.
-- Real accounts and real articles are not touched.
begin;
delete from public.articles where drive_file_id like 'seed\_%';
delete from auth.users where id in (
  '521f60f4-d825-4184-81ba-b7db81e3de56',
  'c5069a2a-6f83-43ad-bbc5-dfcee8150d24',
  '5c19510d-ff8c-4865-82f2-5de5991a9ae0',
  'e4c0e0a1-0cef-45d4-b076-b9a4324f3218',
  'e17daab3-0cf2-4241-acd8-8ddd76e616f9',
  '102b4403-9de4-4f70-846d-3807956960dc',
  '9c328d8f-6992-4f2d-b7d0-698b43821a97',
  '78631027-9e51-4556-b9c9-d1a4218c3095'
);
commit;
