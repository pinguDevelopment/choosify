\set ON_ERROR_STOP 1
begin;
insert into rooms (id, code) values ('00000000-0000-0000-0000-000000000001', 'ABCDEFGH23');
insert into participants (id, room_id, name, token_hash, is_host) values
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','Anna','h1',true),
 ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000001','Ben','h2',false),
 ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000001','Cem','h3',false);
insert into room_movies (room_id, tmdb_id, position, title, vote_average) values
 ('00000000-0000-0000-0000-000000000001', 1, 1, 'Alle wollen', 7.0),
 ('00000000-0000-0000-0000-000000000001', 2, 2, 'Zwei wollen, gut bewertet', 8.5),
 ('00000000-0000-0000-0000-000000000001', 3, 3, 'Zwei wollen, schlechter', 6.0),
 ('00000000-0000-0000-0000-000000000001', 4, 4, 'Keiner will', 9.0);
insert into votes (room_id, participant_id, tmdb_id, liked)
select '00000000-0000-0000-0000-000000000001', p, m, l from (values
 ('00000000-0000-0000-0000-0000000000a1'::uuid,1,true),('00000000-0000-0000-0000-0000000000a2'::uuid,1,true),('00000000-0000-0000-0000-0000000000a3'::uuid,1,true),
 ('00000000-0000-0000-0000-0000000000a1'::uuid,2,true),('00000000-0000-0000-0000-0000000000a2'::uuid,2,true),('00000000-0000-0000-0000-0000000000a3'::uuid,2,false),
 ('00000000-0000-0000-0000-0000000000a1'::uuid,3,true),('00000000-0000-0000-0000-0000000000a2'::uuid,3,true),
 ('00000000-0000-0000-0000-0000000000a1'::uuid,4,false)) t(p,m,l);
select tmdb_id, title, likes, dislikes, unanimous from room_ranking('00000000-0000-0000-0000-000000000001');
-- Doppelte Stimme muss scheitern
savepoint s;
\set ON_ERROR_STOP 0
insert into votes values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1',1,false);
rollback to s;
-- Ungültiger Code muss scheitern
insert into rooms (code) values ('abc');
rollback;
