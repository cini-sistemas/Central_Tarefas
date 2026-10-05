'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..', '..');

function rodar(codigo, env = {}) {
  const r = spawnSync(process.execPath, ['-e', codigo], { cwd: RAIZ, env: { ...process.env, DB_DIALECT: '', ...env }, encoding: 'utf8' });
  return { status: r.status, saida: r.stdout.trim(), erro: r.stderr };
}

describe('ORM: dialeto do banco', () => {
  test('usa SQL Server por padrão', () => {
    const r = rodar("console.log(require('./database/sequelize').getDialect())");
    assert.equal(r.saida, 'mssql', r.erro);
  });

  test('DB_DIALECT=postgres troca as tabelas próprias para PostgreSQL', () => {
    const r = rodar("console.log(require('./database/sequelize').getDialect())", { DB_DIALECT: 'postgres' });
    assert.equal(r.saida, 'postgres', r.erro);
  });

  test('a busca de usuários no DW continua no SQL Server mesmo com DB_DIALECT=postgres', () => {
    const fonte = fs.readFileSync(path.join(RAIZ, 'models', 'timeModel.js'), 'utf8');
    assert.match(fonte, /require\('mssql'\)/);
    assert.match(fonte, /dbConfigDw/);
    const r = rodar("require('./models/timeModel'); console.log(require('./database/sequelize').getDialect())", { DB_DIALECT: 'postgres' });
    assert.equal(r.saida, 'postgres', r.erro);
  });

  test('os models de dados não usam mais a conexão SQL direta nas tabelas próprias', () => {
    for (const arquivo of ['tarefaModel.js', 'workspaceModel.js', 'anotacaoModel.js']) {
      assert.doesNotMatch(fs.readFileSync(path.join(RAIZ, 'models', arquivo), 'utf8'), /require\('mssql'\)|config\/dbConfig'/, arquivo);
    }
  });

  test('dialeto desconhecido falha logo ao subir', () => {
    const r = rodar("require('./database/sequelize')", { DB_DIALECT: 'oracle' });
    assert.notEqual(r.status, 0);
    assert.match(r.erro, /DB_DIALECT não suportado/);
  });
});

describe('ORM: DDL do PostgreSQL acompanha os models', () => {
  const ddl = fs.readFileSync(path.join(RAIZ, 'database', 'sql', 'postgres', 'create_tables.sql'), 'utf8');
  const tabelas = {};
  for (const m of ddl.matchAll(/CREATE TABLE IF NOT EXISTS "(\w+)" \(([\s\S]*?)\n\);/g)) {
    tabelas[m[1]] = new Set([...m[2].matchAll(/^\s*"(\w+)"/gm)].map(c => c[1]));
  }
  const modelos = require('../../models');

  for (const nome of modelos.ORDEM) {
    test(`${nome} tem tabela e todas as colunas no create_tables.sql`, () => {
      const model = modelos[nome];
      const colunas = tabelas[model.tableName];
      assert.ok(colunas, `tabela ${model.tableName} ausente no DDL`);
      for (const atributo of Object.values(model.rawAttributes)) {
        assert.ok(colunas.has(atributo.field), `${model.tableName}.${atributo.field} ausente no DDL`);
      }
    });
  }
});
