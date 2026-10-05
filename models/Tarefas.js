'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Tarefas = sequelize.define('Tarefas', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  titulo: { type: DataTypes.STRING(300), allowNull: false },
  descricao: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING(20) },
  prioridade: { type: DataTypes.STRING(10) },
  responsavel_nome: { type: DataTypes.STRING(200) },
  id_categoria: { type: DataTypes.INTEGER },
  data_vencimento: { type: DataTypes.DATEONLY },
  posicao: { type: DataTypes.INTEGER },
  ativo: { type: DataTypes.BOOLEAN },
  criado_por: { type: DataTypes.STRING(100) },
  data_criacao: { type: DataTypes.DATE },
  data_atualizacao: { type: DataTypes.DATE },
  id_workspace: { type: DataTypes.INTEGER },
  id_coluna: { type: DataTypes.INTEGER },
}, {
  tableName: 'TAREFAS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = Tarefas;
