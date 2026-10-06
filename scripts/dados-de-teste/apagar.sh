#!/bin/sh
# Apaga os dados de teste todos, incluindo as fotos do álbum.
# Corre na raiz do projeto:  sh scripts/dados-de-teste/apagar.sh
set -e
cd "$(dirname "$0")/../.."
supabase storage rm --experimental --linked -r "ss:///trip-photos/a0000000-0000-4000-8000-000000000801" || true
supabase db query --linked -f scripts/dados-de-teste/apagar.sql
