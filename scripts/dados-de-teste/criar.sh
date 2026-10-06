#!/bin/sh
# Cria os dados de teste todos: pessoas, grupos, planos, sessão, histórico e as fotos do álbum.
# Corre na raiz do projeto:  sh scripts/dados-de-teste/criar.sh
set -e
cd "$(dirname "$0")/../.."
supabase db query --linked -f scripts/dados-de-teste/criar.sql
supabase db query --linked -f scripts/dados-de-teste/historico.sql
for foto in a-caminho no-estadio o-golo jantar; do
  supabase storage cp --experimental --linked --content-type image/jpeg \
    "scripts/dados-de-teste/fotos/$foto.jpg" \
    "ss:///trip-photos/a0000000-0000-4000-8000-000000000801/$foto.jpg"
done
