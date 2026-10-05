'use strict';

const sequelize = require('../database/sequelize');
const Anotacoes = require('./Anotacoes');
const Etiquetas = require('./Etiquetas');
const AnotacoesEtiquetas = require('./AnotacoesEtiquetas');
const Categorias = require('./Categorias');
const Tarefas = require('./Tarefas');
const ChecklistItems = require('./ChecklistItems');
const TimeMembros = require('./TimeMembros');
const TimeTimes = require('./TimeTimes');
const Workspaces = require('./Workspaces');
const WorkspaceAcessos = require('./WorkspaceAcessos');
const WorkspaceColunas = require('./WorkspaceColunas');

const ORDEM = ['Anotacoes', 'Etiquetas', 'AnotacoesEtiquetas', 'Categorias', 'Tarefas', 'ChecklistItems', 'TimeMembros', 'TimeTimes', 'Workspaces', 'WorkspaceAcessos', 'WorkspaceColunas'];

module.exports = { sequelize, Anotacoes, Etiquetas, AnotacoesEtiquetas, Categorias, Tarefas, ChecklistItems, TimeMembros, TimeTimes, Workspaces, WorkspaceAcessos, WorkspaceColunas, ORDEM };
