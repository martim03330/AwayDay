# Cópias da base de dados

O plano gratuito do Supabase não guarda cópias que se possam descarregar. Todas as semanas (domingo às 04:23 UTC) o
GitHub corre `.github/workflows/copia-base-de-dados.yml`:

1. Copia os papéis, o esquema e os dados da base de dados de produção.
2. Cifra a cópia com a tua frase-passe (`BACKUP_PASSPHRASE`) e guarda-a 30 dias, em Actions › a execução › Artifacts.
3. Restaura a cópia num Supabase vazio, dentro do próprio GitHub, e confirma que cada tabela volta com o mesmo número de
   linhas. Se falhar, o GitHub manda-te um email.

Também se pode correr à mão: Actions › Copia da base de dados › Run workflow.

## Configurar (uma vez)

No terminal, na pasta do projeto:

```
gh secret set SUPABASE_DB_URL
gh secret set BACKUP_PASSPHRASE
```

- `SUPABASE_DB_URL`: no Supabase, botão **Connect** › **Session pooler** › copia o endereço e põe a password da base
  de dados no lugar de `[YOUR-PASSWORD]`. Se não souberes a password, muda-a em Project Settings › Database.
- `BACKUP_PASSPHRASE`: uma frase-passe longa à tua escolha. **Guarda-a num gestor de passwords:** sem ela não se abre
  nenhuma cópia.

## Restaurar a sério

1. Descarrega o artifact `copia-…` da execução que queres (Actions).
2. Decifra e abre: `gpg -d copia.tar.gz.gpg | tar xz` (pede a frase-passe).
3. Num projeto Supabase novo (ou o mesmo, depois de limpo), com o cliente `psql` 17:

```
psql "<endereço da base de dados de destino>" --single-transaction -v ON_ERROR_STOP=1 \
  --file copia/roles.sql --file copia/schema.sql \
  --command 'SET session_replication_role = replica' --file copia/data.sql
```

4. Volta a publicar as Edge Functions (`supabase functions deploy`) e os segredos delas, que não vão na cópia.

As fotos (Storage) não vão nesta cópia.
