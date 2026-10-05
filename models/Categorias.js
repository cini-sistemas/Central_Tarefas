'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Categorias = sequelize.define('Categorias', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(100), allowNull: false },
  cor: { type: DataTypes.STRING(30) },
  icone: { type: DataTypes.STRING(50) },
  ativo: { type: DataTypes.BOOLEAN },
  data_criacao: { type: DataTypes.DATE },
}, {
  tableName: 'CATEGORIAS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = Categorias;
