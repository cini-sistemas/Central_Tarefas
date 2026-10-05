'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const WorkspaceAcessos = sequelize.define('WorkspaceAcessos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_workspace: { type: DataTypes.INTEGER, allowNull: false },
  tipo: { type: DataTypes.STRING(10), allowNull: false },
  codigo: { type: DataTypes.STRING(200), allowNull: false },
  nome_display: { type: DataTypes.STRING(200) },
  permissao: { type: DataTypes.STRING(10) },
  data_cadastro: { type: DataTypes.DATE },
}, {
  tableName: 'WORKSPACE_ACESSOS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = WorkspaceAcessos;
