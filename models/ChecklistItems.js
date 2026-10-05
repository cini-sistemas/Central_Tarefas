'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const ChecklistItems = sequelize.define('ChecklistItems', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_tarefa: { type: DataTypes.INTEGER, allowNull: false },
  descricao: { type: DataTypes.STRING(500), allowNull: false },
  concluido: { type: DataTypes.BOOLEAN },
  posicao: { type: DataTypes.INTEGER },
  data_criacao: { type: DataTypes.DATE },
}, {
  tableName: 'CHECKLIST_ITEMS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = ChecklistItems;
