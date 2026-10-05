'use strict';

const { Sequelize } = require('sequelize');
require('dotenv').config();

const DIALETO = (process.env.DB_DIALECT || 'mssql').toLowerCase();

const OPCOES_DIALETO = {
  mssql: () => {
    Sequelize.DataTypes.mssql.DATE.prototype._stringify = function (date, options) {
      if (!date || !date._isAMomentObject) date = this._applyTimezone(date, options);
      return date.format('YYYY-MM-DD HH:mm:ss.SSS');
    };
    Sequelize.DataTypes.mssql.DATEONLY.parse = v => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : v);
    return {
      dialectOptions: {
        options: {
          encrypt: true,
          trustServerCertificate: true,
          requestTimeout: 1200000,
          useUTC: false,
          cryptoCredentialsDetails: { minVersion: 'TLSv1' },
        },
      },
    };
  },
  postgres: () => {
    const pg = Sequelize.DataTypes.postgres;
    pg.DECIMAL.parse = v => Number(v);
    pg.DATEONLY.parse = v => v;
    pg.BIGINT.parse = v => Number(v);
    return {
      dialectOptions: process.env.DB_SSL_CENTRAL === '1' ? { ssl: { rejectUnauthorized: false } } : {},
    };
  },
};

if (!OPCOES_DIALETO[DIALETO]) throw new Error(`DB_DIALECT não suportado: ${DIALETO} (use mssql ou postgres).`);

const sequelize = new Sequelize(
  process.env.DB_DATABASE_CENTRAL || 'central_tarefas',
  process.env.DB_USER_CENTRAL || process.env.DB_USER_CT,
  process.env.DB_PASSWORD_CENTRAL || process.env.DB_PASSWORD_CT,
  {
    host: process.env.DB_SERVER_CENTRAL || process.env.DB_SERVER_CT,
    port: process.env.DB_PORT_CENTRAL ? Number(process.env.DB_PORT_CENTRAL) : undefined,
    dialect: DIALETO,
    ...OPCOES_DIALETO[DIALETO](),
    timezone: 'America/Sao_Paulo',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

module.exports = sequelize;
