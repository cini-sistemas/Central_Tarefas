'use strict';

const sql        = require('mssql');
const dbConfigDw = require('../config/dbConfigDw');
const { TimeMembros, TimeTimes } = require('.');
const { ordenarPorTexto } = require('../database/consultas');

async function buscarUsuarios(nome) {
  let pool = null;
  try {
    const connectionPool = new sql.ConnectionPool(dbConfigDw);
    pool = await connectionPool.connect();
    if (!nome) {
      const result = await pool.request().query(`SELECT TOP 1000 * FROM [${dbConfigDw.database}].[dbo].[SYS_USR] WHERE D_E_L_E_T_ <> '*'`);
      return {
        colunas: result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [],
        registros: result.recordset,
      };
    }

    const colsRes = await pool.request()
      .input('tableName', sql.VarChar(128), 'SYS_USR')
      .query(`SELECT COLUMN_NAME FROM [${dbConfigDw.database}].INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName`);

    const availableCols = colsRes.recordset.map(r => r.COLUMN_NAME);
    const desiredCols = ['USR_ID','USR_CODIGO','USR_NOME','USR_CARGO'];
    const showCols = desiredCols.filter(c => availableCols.includes(c));
      const selectClause = (showCols && showCols.length > 0) ? showCols.map(c => `[${c}]`).join(', ') : '*';
      const termo = '%' + nome + '%';
      const request = pool.request();
      request.input('termo', sql.VarChar(200), termo);
      const whereParts = [];
      if (availableCols.includes('USR_CODIGO')) whereParts.push('[USR_CODIGO] LIKE @termo');
      if (availableCols.includes('USR_NOME'))   whereParts.push('[USR_NOME] LIKE @termo');
      if (whereParts.length === 0) {
        const textCols = availableCols.filter(c => typeof c === 'string');
        for (const c of textCols) whereParts.push('[' + c + '] LIKE @termo');
      }

      const sqlText = `SELECT TOP 1000 ${selectClause} FROM [${dbConfigDw.database}].[dbo].[SYS_USR] WHERE D_E_L_E_T_ <> '*' AND (${whereParts.join(' OR ')})`;
      const result = await request.query(sqlText);
      return {
        colunas: showCols && showCols.length > 0 ? showCols : (result.recordset.length > 0 ? Object.keys(result.recordset[0]) : []),
        registros: result.recordset,
      };
  } catch (error) {
    throw error;
  } finally {
    if (pool) {
      try { await pool.close(); } catch (_) {}
    }
  }
  }

async function getMembros() {
  const linhas = await TimeMembros.findAll({
    attributes: ['id', 'codigo', 'nome', 'grupo', 'data_cadastro'],
    where: { ativo: true },
    order: [['id', 'ASC']],
    raw: true,
  });
  return ordenarPorTexto(linhas, 'nome');
}

async function addMembro(codigo, nome, grupo) {
  const registro = await TimeMembros.create({
    codigo: codigo || '',
    nome:   nome   || '',
    grupo:  grupo  || null,
  });
  return registro.id;
}

async function removeMembro(id) {
  await TimeMembros.update({ ativo: false }, { where: { id } });
}

module.exports = { buscarUsuarios, getMembros, addMembro, removeMembro };
module.exports.getTimes = async function () {
  const times = await TimeTimes.findAll({
    attributes: ['id', 'codigo', 'nome', 'descricao', 'criado_em', 'ativo'],
    where: { ativo: true },
    order: [['id', 'ASC']],
    raw: true,
  });
  const totalMembros = await TimeMembros.count({ where: { ativo: true } });
  return ordenarPorTexto(times, 'nome').map(t => ({ ...t, total_membros: totalMembros }));
};

module.exports.addTime = async function (codigo, nome, descricao) {
  const registro = await TimeTimes.create({ codigo: codigo || null, nome: nome || null, descricao: descricao || null });
  return registro.id;
};

module.exports.updateTime = async function (id, codigo, nome, descricao) {
  await TimeTimes.update({ codigo: codigo || null, nome: nome || null, descricao: descricao || null }, { where: { id } });
};

module.exports.deleteTime = async function (id) {
  await TimeTimes.update({ ativo: false }, { where: { id } });
};
