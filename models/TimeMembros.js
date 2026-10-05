'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const TimeMembros = sequelize.define('TimeMembros', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  codigo: { type: DataTypes.STRING(20), allowNull: false },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  grupo: { type: DataTypes.STRING(100) },
  data_cadastro: { type: DataTypes.DATE },
  ativo: { type: DataTypes.BOOLEAN },
}, {
  tableName: 'TIME_MEMBROS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = TimeMembros;
