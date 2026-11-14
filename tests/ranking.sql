-- Rangliste prüfen: psql -f tests/ranking.sql (gegen eine Test-Datenbank, läuft in einer Transaktion)
\set ON_ERROR_STOP 1
begin;
insert into rooms (id, code) values ('00000000-0000-0000-0000-000000000001', 'ABCDEFGH23');
insert into participants (id, room_id, name, token_hash) values
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','Anna','h1'),
 ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000001','Ben','h2'),
 ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000001','Cem','h3');
insert into room_movies (room_id, tmdb_id, position, title, vote_average) values
 ('00000000-0000-0000-0000-000000000001', 1, 1, 'Alle Ja', 6.0),
 ('00000000-0000-0000-0000-000000000001', 2, 2, 'Alle dabei (Ja, Ja, Ok)', 6.0),
 ('00000000-0000-0000-0000-000000000001', 3, 3, 'Zwei Ja, ein Nein', 9.0),
 ('00000000-0000-0000-0000-000000000001', 4, 4, 'Alle nur ok', 5.0),
 ('00000000-0000-0000-0000-000000000001', 5, 5, 'Keiner', 9.0);
insert into votes (room_id, participant_id, tmdb_id, choice)
select '00000000-0000-0000-0000-000000000001', p, m, c from (values
 ('00000000-0000-0000-0000-0000000000a1'::uuid,1,1),('00000000-0000-0000-0000-0000000000a2'::uuid,1,1),('00000000-0000-0000-0000-0000000000a3'::uuid,1,1),
 ('00000000-0000-0000-0000-0000000000a1'::uuid,2,1),('00000000-0000-0000-0000-0000000000a2'::uuid,2,1),('00000000-0000-0000-0000-0000000000a3'::uuid,2,0),
 ('00000000-0000-0000-0000-0000000000a1'::uuid,3,1),('00000000-0000-0000-0000-0000000000a2'::uuid,3,1),('00000000-0000-0000-0000-0000000000a3'::uuid,3,-1),
 ('00000000-0000-0000-0000-0000000000a1'::uuid,4,0),('00000000-0000-0000-0000-0000000000a2'::uuid,4,0),('00000000-0000-0000-0000-0000000000a3'::uuid,4,0),
 ('00000000-0000-0000-0000-0000000000a1'::uuid,5,-1)) t(p,m,c);
-- Erwartet: 1 Alle Ja, 2 Alle dabei, 4 Alle nur ok, 3 Zwei Ja ein Nein; 5 fehlt
select tmdb_id, title, likes, maybes, dislikes, unanimous, acceptable, score from room_ranking('00000000-0000-0000-0000-000000000001');
rollback;
