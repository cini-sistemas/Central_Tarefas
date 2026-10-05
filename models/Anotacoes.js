'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Anotacoes = sequelize.define('Anotacoes', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  titulo: { type: DataTypes.STRING(300) },
  conteudo: { type: DataTypes.TEXT },
  cor: { type: DataTypes.STRING(30) },
  fixado: { type: DataTypes.BOOLEAN },
  arquivado: { type: DataTypes.BOOLEAN },
  id_usuario: { type: DataTypes.STRING(200) },
  data_criacao: { type: DataTypes.DATE },
  data_atualizacao: { type: DataTypes.DATE },
  visibilidade: { type: DataTypes.STRING(10) },
  grupo_acesso: { type: DataTypes.STRING(100) },
}, {
  tableName: 'ANOTACOES',
  timestamps: false,
  freezeTableName: true,
});

module.exports = Anotacoes;
