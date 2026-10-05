'use strict';

const {
  Workspaces, WorkspaceColunas, WorkspaceAcessos, TimeMembros, Tarefas,
} = require('.');
const leitura = require('./leituraTarefas');
const {
  Op, textoIgual, ordenarPorTexto, distintosSemCaixa,
} = require('../database/consultas');

const DEFAULT_COLUNAS = [
  { id: null, nome: 'A Fazer',      cor: '#94a3b8', chave: 'A_FAZER'      },
  { id: null, nome: 'Em Andamento', cor: '#f59e0b', chave: 'EM_ANDAMENTO' },
  { id: null, nome: 'Em Revisão',   cor: '#6366f1', chave: 'EM_REVISAO'   },
  { id: null, nome: 'Concluído',    cor: '#22c55e', chave: 'CONCLUIDO'    },
];

const ATRIBUTOS_WORKSPACE = ['id', 'nome', 'descricao', 'criado_por', 'privado', 'data_criacao', 'ativo'];

async function gruposDoUsuario(username) {
  const membros = await TimeMembros.findAll({ attributes: ['codigo', 'nome', 'grupo'], where: { ativo: true }, raw: true });
  return membros
    .filter(m => textoIgual(m.codigo, username) || textoIgual(m.nome, username))
    .map(m => m.grupo)
    .filter(g => g !== null && g !== undefined);
}

function podeAcessar(workspace, username, acessos, grupos) {
  if (textoIgual(workspace.criado_por, username)) return true;
  if (workspace.privado !== false) return false;
  if (!acessos.length) return true;
  return acessos.some(a => (textoIgual(a.tipo, 'usuario') && textoIgual(a.codigo, username))
    || (textoIgual(a.tipo, 'grupo') && grupos.some(g => textoIgual(g, a.codigo))));
}

async function acessosPorWorkspace(ids) {
  const mapa = new Map(ids.map(id => [id, []]));
  if (!ids.length) return mapa;
  const linhas = await WorkspaceAcessos.findAll({ where: { id_workspace: { [Op.in]: ids } }, order: [['id', 'ASC']], raw: true });
  for (const linha of linhas) mapa.get(linha.id_workspace).push(linha);
  return mapa;
}

function maisRecentesPrimeiro(a, b) {
  const x = a.data_criacao ? new Date(a.data_criacao).getTime() : null;
  const y = b.data_criacao ? new Date(b.data_criacao).getTime() : null;
  if (x === y) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return y - x;
}

async function getAll(username) {
  const workspaces = await Workspaces.findAll({ attributes: ATRIBUTOS_WORKSPACE, where: { ativo: true }, order: [['id', 'ASC']], raw: true });
  const acessos = await acessosPorWorkspace(workspaces.map(w => w.id));
  const grupos = await gruposDoUsuario(username);
  const visiveis = workspaces.filter(w => podeAcessar(w, username, acessos.get(w.id), grupos));

  const tarefas = visiveis.length
    ? await Tarefas.findAll({ attributes: ['id_workspace'], where: { ativo: true, id_workspace: { [Op.in]: visiveis.map(w => w.id) } }, raw: true })
    : [];
  return visiveis
    .map(w => ({ ...w, total_tarefas: tarefas.filter(t => t.id_workspace === w.id).length }))
    .sort(maisRecentesPrimeiro);
}

async function getById(id) {
  return Workspaces.findOne({ attributes: ATRIBUTOS_WORKSPACE, where: { id, ativo: true }, raw: true });
}

async function create({ nome, descricao, criado_por, privado }) {
  const registro = await Workspaces.create({
    nome: nome || '',
    descricao: descricao || null,
    criado_por: criado_por || '',
    privado: Boolean(privado),
  });
  return registro.id;
}

async function getColunas(id_workspace) {
  const colunas = await WorkspaceColunas.findAll({
    attributes: ['id', 'id_workspace', 'nome', 'cor', 'posicao'],
    where: { id_workspace, ativo: true },
    order: [['id', 'ASC']],
    raw: true,
  });
  return colunas.sort((a, b) => {
    if (a.posicao === b.posicao) return 0;
    if (a.posicao === null) return -1;
    if (b.posicao === null) return 1;
    return a.posicao - b.posicao;
  });
}

async function addColuna(id_workspace, nome, cor, posicao) {
  const registro = await WorkspaceColunas.create({
    id_workspace,
    nome: nome || '',
    cor: cor || '#6366f1',
    posicao: posicao || 0,
  });
  return registro.id;
}

async function deleteColuna(id) {
  await WorkspaceColunas.update({ ativo: false }, { where: { id } });
}

async function addColunaSmart(id_workspace, nome, cor) {
  let colunas = await getColunas(id_workspace);
  if (colunas.length === 0) {
    for (let i = 0; i < DEFAULT_COLUNAS.length; i++) {
      const def   = DEFAULT_COLUNAS[i];
      const newId = await addColuna(id_workspace, def.nome, def.cor, i);
      await Tarefas.update(
        { id_coluna: newId },
        { where: { id_workspace, status: def.chave, id_coluna: null } }
      );
    }
    colunas = await getColunas(id_workspace);
  }
  return addColuna(id_workspace, nome, cor, colunas.length);
}

async function reorderColunas(items) {
  for (const item of items) {
    await WorkspaceColunas.update({ posicao: item.posicao }, { where: { id: item.id } });
  }
}

async function getAcessos(id_workspace) {
  return WorkspaceAcessos.findAll({
    attributes: ['id', 'id_workspace', 'tipo', 'codigo', 'nome_display', 'permissao'],
    where: { id_workspace },
    order: [['id', 'ASC']],
    raw: true,
  });
}

async function addAcesso(id_workspace, tipo, codigo, nome_display, permissao) {
  const registro = await WorkspaceAcessos.create({
    id_workspace,
    tipo,
    codigo,
    nome_display: nome_display || null,
    permissao: permissao || 'editor',
  });
  return registro.id;
}

async function removeAcesso(id) {
  await WorkspaceAcessos.destroy({ where: { id } });
}

async function softDelete(id) {
  await Workspaces.update({ ativo: false }, { where: { id } });
}

async function hasAccess(id_workspace, username) {
  const workspace = await getById(id_workspace);
  if (!workspace) return false;
  const acessos = await getAcessos(id_workspace);
  return podeAcessar(workspace, username, acessos, await gruposDoUsuario(username));
}

async function getPermissao(id_workspace, username) {
  const workspace = await getById(id_workspace);
  if (!workspace) return null;
  if (workspace.criado_por === username) return 'owner';
  const acessos = await getAcessos(id_workspace);
  const doUsuario = acessos.find(a => textoIgual(a.tipo, 'usuario') && textoIgual(a.codigo, username));
  if (doUsuario) return doUsuario.permissao;
  const grupos = await gruposDoUsuario(username);
  const doGrupo = acessos.find(a => textoIgual(a.tipo, 'grupo') && grupos.some(g => textoIgual(g, a.codigo)));
  if (doGrupo) return doGrupo.permissao;
  if (workspace.privado === false) {
    return 'viewer';
  }
  return null;
}

async function getKanbanData(id_workspace) {
  const colunas = await getColunas(id_workspace);
  const hasCustomColunas = colunas.length > 0;
  const linhas = await leitura.quadro({ id_workspace }, { comColuna: true });

  let colunasResult;
  const kanban = {};

  if (hasCustomColunas) {
    colunasResult = colunas.map(col => ({
      ...col,
      chave: 'col_' + col.id,
    }));
    colunasResult.forEach(col => { kanban[col.chave] = []; });
    linhas.forEach(row => {
      const chave = row.id_coluna ? 'col_' + row.id_coluna : null;
      if (chave && kanban[chave] !== undefined) {
        kanban[chave].push(row);
      } else if (colunasResult.length > 0) {
        kanban[colunasResult[0].chave].push(row);
      }
    });
  } else {
    colunasResult = DEFAULT_COLUNAS.map(c => ({ ...c }));
    DEFAULT_COLUNAS.forEach(col => { kanban[col.chave] = []; });
    linhas.forEach(row => {
      if (kanban[row.status] !== undefined) {
        kanban[row.status].push(row);
      } else {
        kanban['A_FAZER'].push(row);
      }
    });
  }

  return { colunas: colunasResult, kanban, hasCustomColunas };
}

async function getAllTasks(id_workspace) {
  return leitura.lista({ id_workspace }, { comColuna: true });
}

async function getStats(id_workspace) {
  return leitura.estatisticas({ id_workspace });
}

async function getGrupos() {
  const membros = await TimeMembros.findAll({
    attributes: ['grupo'],
    where: { grupo: { [Op.ne]: null }, ativo: true },
    order: [['id', 'ASC']],
    raw: true,
  });
  const grupos = distintosSemCaixa(membros.map(m => m.grupo));
  return ordenarPorTexto(grupos.map(grupo => ({ grupo })), 'grupo');
}

module.exports = {
  getAll,
  getById,
  create,
  getColunas,
  addColuna,
  addColunaSmart,
  deleteColuna,
  reorderColunas,
  getAcessos,
  addAcesso,
  removeAcesso,
  softDelete,
  hasAccess,
  getPermissao,
  getKanbanData,
  getAllTasks,
  getStats,
  getGrupos,
  DEFAULT_COLUNAS,
};
