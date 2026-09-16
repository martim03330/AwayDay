-- Uma boleia cancelada não serve para nada: vai fora.
--
-- Ficavam para sempre na base de dados e na ficha de quem as publicou. Passam a ser apagadas — mas **não na hora**:
-- quem tinha lugar precisa de ver o aviso «o condutor cancelou» quando abrir a app. Por isso saem **dois dias**
-- depois de canceladas, que é tempo de sobra para o aviso ser lido.
--
-- Uma exceção: se essa boleia chegou a ter contas com despesas lançadas, fica. Apagar a boleia apagava as contas
-- atrás dela (é `on delete cascade`), e o dinheiro de uma viagem que aconteceu não se apaga por causa de arrumação.

create function public.delete_cancelled_rides()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.ride as r
  where r.status = 'cancelled'
    and r.cancelled_at is not null
    and r.cancelled_at < now() - interval '2 days'
    and not exists (
      select 1
      from public.trip_session as s
      join public.trip_expense as e on e.session_id = s.id
      where s.ride_id = r.id
    );
$$;

revoke execute on function public.delete_cancelled_rides() from public, anon, authenticated;

select cron.schedule('delete-cancelled-rides', '43 4 * * *', $$ select public.delete_cancelled_rides(); $$);
