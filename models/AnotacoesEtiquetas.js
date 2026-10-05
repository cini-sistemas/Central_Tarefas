'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const AnotacoesEtiquetas = sequelize.define('AnotacoesEtiquetas', {
  id_anotacao: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  id_etiqueta: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
}, {
  tableName: 'ANOTACOES_ETIQUETAS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = AnotacoesEtiquetas;
