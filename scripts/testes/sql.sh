#!/bin/sh
# Corre todos os testes de SQL (supabase/tests/*.test.sql) contra a base de dados ligada.
# Cada ficheiro corre numa transação que é sempre desfeita: nada fica na base de dados.
# Sai com erro se algum teste falhar.
#   npm run test:sql
cd "$(dirname "$0")/../.."
falhou=0
for ficheiro in supabase/tests/*.test.sql; do
  saida=$(supabase db query --linked -f "$ficheiro" 2>&1)
  passou=$(printf '%s' "$saida" | grep -oE '"checks_passed": [0-9]+' | grep -oE '[0-9]+')
  if [ -n "$passou" ]; then
    printf 'ok    %-40s %s verificações\n' "$(basename "$ficheiro")" "$passou"
  else
    falhou=1
    printf 'FALHA %s\n' "$(basename "$ficheiro")"
    printf '%s\n' "$saida" | grep -oE 'FAILED[^"\\]*|ERROR:[^"\\]*' | head -3
  fi
done
exit $falhou
