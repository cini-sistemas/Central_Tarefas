'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Workspaces = sequelize.define('Workspaces', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  descricao: { type: DataTypes.STRING(500) },
  criado_por: { type: DataTypes.STRING(200), allowNull: false },
  privado: { type: DataTypes.BOOLEAN },
  data_criacao: { type: DataTypes.DATE },
  ativo: { type: DataTypes.BOOLEAN },
}, {
  tableName: 'WORKSPACES',
  timestamps: false,
  freezeTableName: true,
});

module.exports = Workspaces;
