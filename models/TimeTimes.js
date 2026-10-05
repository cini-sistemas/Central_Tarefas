'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const TimeTimes = sequelize.define('TimeTimes', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  codigo: { type: DataTypes.STRING(100), allowNull: false },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  descricao: { type: DataTypes.STRING(500) },
  criado_por: { type: DataTypes.STRING(200) },
  criado_em: { type: DataTypes.DATE },
  ativo: { type: DataTypes.BOOLEAN },
}, {
  tableName: 'TIME_TIMES',
  timestamps: false,
  freezeTableName: true,
});

module.exports = TimeTimes;
