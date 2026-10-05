'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const WorkspaceColunas = sequelize.define('WorkspaceColunas', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_workspace: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(100), allowNull: false },
  cor: { type: DataTypes.STRING(20) },
  posicao: { type: DataTypes.INTEGER },
  ativo: { type: DataTypes.BOOLEAN },
}, {
  tableName: 'WORKSPACE_COLUNAS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = WorkspaceColunas;
