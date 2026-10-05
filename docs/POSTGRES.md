# Banco de dados: SQL Server hoje, PostgreSQL quando quiser

Mesmo padrão do Planner Cini. As tabelas do `central_tarefas` só são usadas por este app (o `scripts/migrate_ct.js` do portal-consultas é um script avulso antigo, fora da execução).

## Como está organizado

| Conexão | Arquivo | Banco | Variáveis |
|---|---|---|---|
| Tabelas próprias (`TAREFAS`, `CHECKLIST_ITEMS`, `CATEGORIAS`, `WORKSPACES`, `WORKSPACE_COLUNAS`, `WORKSPACE_ACESSOS`, `ANOTACOES`, `ETIQUETAS`, `ANOTACOES_ETIQUETAS`, `TIME_TIMES`, `TIME_MEMBROS`) | `database/sequelize.js` | `mssql` (padrão) ou `postgres` | `DB_DIALECT`, `DB_SERVER_CENTRAL`, `DB_PORT_CENTRAL`, `DB_USER_CENTRAL`, `DB_PASSWORD_CENTRAL`, `DB_DATABASE_CENTRAL` (padrão `central_tarefas`), `DB_SSL_CENTRAL=1` (no SQL Server, se vazios, usam os `*_CT` de sempre) |
| DW (`SYS_USR` na busca de usuários, login) | `config/dbConfigDw.js` | sempre SQL Server | `DB_SERVER_CT`, `DB_USER_CT`, `DB_PASSWORD_CT`, `DB_DATABASE_DW` (sem mudança) |

- `models/`: models Sequelize das tabelas (`Tarefas.js`, `Workspaces.js`...), a ordem de migração (`ORDEM`) em `models/index.js`, e as camadas de dados de sempre (`tarefaModel.js`, `workspaceModel.js`, `anotacaoModel.js`, `timeModel.js`), agora sem SQL à mão.
- `database/consultas.js`: comparações de texto sem diferenciar maiúsculas (como o SQL Server fazia), ordenação por nome e conversão das datas de vencimento.
- `database/sql/postgres/create_tables.sql`: DDL do PostgreSQL. `config/dbConfig.js` saiu (ninguém mais usava).

Sem nenhuma variável nova no `.env`, o app continua exatamente como antes (SQL Server).

## Trocar para PostgreSQL

1. Crie o banco: `CREATE DATABASE central_tarefas ENCODING 'UTF8';`
2. Copie os dados (só lê o SQL Server; cria as tabelas, copia tudo e acerta as sequências de `id`):
   ```
   DESTINO_DB_SERVER=... DESTINO_DB_PORT=5432 DESTINO_DB_USER=... DESTINO_DB_PASSWORD=... DESTINO_DB_DATABASE=central_tarefas npm run db:migrar:postgres
   ```
3. No `.env`:
   ```
   DB_DIALECT=postgres
   DB_SERVER_CENTRAL=<postgres>  DB_PORT_CENTRAL=5432  DB_USER_CENTRAL=...  DB_PASSWORD_CENTRAL=...  DB_DATABASE_CENTRAL=central_tarefas
   (os *_CT continuam apontando para o SQL Server do DW)
   ```
4. Reinicie o app. Para voltar, basta remover `DB_DIALECT` e os `*_CENTRAL`.

## Testes

- `npm run test:unit`: sem banco (roda no CI). Confere a escolha do dialeto, que a busca no DW segue no SQL Server, que os models não usam mais SQL direto e que o DDL do PostgreSQL tem todas as tabelas/colunas dos models.
- `npm run test:integracao`: contra bancos reais, exercitando tarefas e quadro, checklist, workspaces (colunas, acessos por usuário/grupo, permissões), anotações (visibilidade, etiquetas) e times.
  - SQL Server (usa o `.env`; tudo roda numa transação desfeita no fim, nada é gravado e o `IDENTITY` das tabelas volta ao valor anterior): `TESTE_DIALETO=mssql npm run test:integracao`
  - PostgreSQL (banco vazio de teste): `TESTE_DIALETO=postgres TESTE_PG_SERVER=localhost TESTE_PG_PORT=5432 TESTE_PG_USER=postgres TESTE_PG_PASSWORD=... TESTE_PG_DATABASE=teste_central npm run test:integracao`

## Mudanças de comportamento

- No quadro, tarefas empatadas (mesma posição e sem vencimento) passam a sair na ordem do `id`; antes a ordem dependia do plano de execução do SQL Server.
- A detecção em tempo de execução das colunas `USR_ID`/`TIME_ID` em `TIME_MEMBROS` saiu: elas não existem no banco atual, então o comportamento é o mesmo de hoje (acesso por time não é usado; o total de membros de cada time é o total de membros ativos).
- `TIME_TIMES.criado_em` continua sendo gravado em UTC pelo padrão do banco (no PostgreSQL, `CURRENT_TIMESTAMP AT TIME ZONE 'UTC'`), igual ao `SYSUTCDATETIME()` do SQL Server.
