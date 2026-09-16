-- As contas de boleia que já estavam abertas ficaram sem a despesa da boleia (só entrava a quem abrisse a partir de
-- agora). Põe-se lá, uma vez, para todas.
select public.sync_ride_trip_expense(s.id)
from public.trip_session as s
where s.ride_id is not null;
