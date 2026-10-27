-- The trigger functions added today (plans and rides mark the game as going; a closed plan tells its groups) were
-- left executable by anon and authenticated, like every new function by default. They only run as triggers: nobody
-- calls them. Same rule as the rest of the schema (acesso_boleias_funcoes.test.sql): revoke.

revoke execute on function public.plan_answer_marks_going() from public, anon, authenticated;
revoke execute on function public.ride_seat_marks_going() from public, anon, authenticated;
revoke execute on function public.ride_offer_marks_going() from public, anon, authenticated;
revoke execute on function public.tell_groups_plan_closed() from public, anon, authenticated;
