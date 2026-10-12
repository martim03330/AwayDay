#!/bin/sh
# Corre todos os testes de SQL (supabase/tests/*.test.sql) contra a base de dados ligada (produção) ou, com
# SQL_ALVO=--local, contra o Supabase local (o CI cria um do zero, com as migrações e a seed).
# Cada ficheiro corre numa transação que é sempre desfeita: nada fica na base de dados.
# Sai com erro se algum teste falhar.
#   npm run test:sql
#   SQL_ALVO=--local npm run test:sql
cd "$(dirname "$0")/../.."
alvo="${SQL_ALVO:---linked}"
falhou=0
for ficheiro in supabase/tests/*.test.sql; do
  if [ "$alvo" = "--local" ]; then
    # `db query --local` sends the file as one prepared statement, which refuses several commands: psql runs it
    # as written, like the remote endpoint does.
    saida=$(psql "${SQL_LOCAL_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}" -X -A \
      -v ON_ERROR_STOP=1 -f "$ficheiro" 2>&1)
    passou=$(printf '%s\n' "$saida" | awk 'antes == "checks_passed" { print; exit } { antes = $0 }')
  else
    saida=$(supabase db query "$alvo" -o json -f "$ficheiro" 2>&1)
    passou=$(printf '%s' "$saida" | grep -oE '"checks_passed": [0-9]+' | grep -oE '[0-9]+')
  fi
  if [ -n "$passou" ]; then
    printf 'ok    %-40s %s verificações\n' "$(basename "$ficheiro")" "$passou"
  else
    falhou=1
    printf 'FALHA %s\n' "$(basename "$ficheiro")"
    erros=$(printf '%s\n' "$saida" | grep -oE 'FAILED[^"\\]*|ERROR:[^"\\]*' | head -3)
    if [ -n "$erros" ]; then printf '%s\n' "$erros"; else printf '%s\n' "$saida" | head -c 400; echo; fi
  fi
done
exit $falhou
