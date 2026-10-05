'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Etiquetas = sequelize.define('Etiquetas', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(100), allowNull: false },
  cor: { type: DataTypes.STRING(30) },
  data_criacao: { type: DataTypes.DATE },
}, {
  tableName: 'ETIQUETAS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = Etiquetas;
