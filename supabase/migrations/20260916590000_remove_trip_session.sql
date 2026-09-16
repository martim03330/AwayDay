-- Apagar umas contas abertas por engano.
--
-- Com as contas a poderem nascer da boleia, de um grupo ou do nada, é fácil abrir duas para o mesmo jogo e só depois
-- perceber que era uma só. Enquanto **não houver dinheiro lá dentro** — nenhuma despesa escrita à mão e nenhum
-- pagamento —, quem está nelas pode apagá-las. A despesa da boleia, que entra sozinha, não conta como dinheiro de
-- ninguém: vai atrás.
--
-- A partir do momento em que alguém lança a primeira despesa, não se apaga: apagam-se as despesas primeiro, uma a
-- uma, por quem as lançou. Dinheiro de outras pessoas não se apaga por atalho.

create function public.remove_trip_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_trip_member(p_session_id, auth.uid()) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.trip_expense as e
    where e.session_id = p_session_id and e.source = 'manual'
    union all
    select 1 from public.trip_settlement as t where t.session_id = p_session_id
  ) then
    raise exception 'has_money' using errcode = '22023';
  end if;

  delete from public.trip_session where id = p_session_id;
end;
$$;

revoke execute on function public.remove_trip_session(uuid) from public, anon;
grant execute on function public.remove_trip_session(uuid) to authenticated;
