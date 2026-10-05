'use strict';

const {
  Tarefas, Categorias, WorkspaceColunas, ChecklistItems,
} = require('.');
const leitura = require('./leituraTarefas');
const {
  Op, dataLocal, dataParaGravar, ordenarPorTexto, distintosSemCaixa,
} = require('../database/consultas');

function truncate(str, max) {
  if (str === undefined || str === null) return null;
  const s = String(str);
  return s.length > max ? s.slice(0, max) : s;
}

async function getKanbanData() {
  const linhas = await leitura.quadro({}, { comColuna: false });
  const kanban = { A_FAZER: [], EM_ANDAMENTO: [], EM_REVISAO: [], CONCLUIDO: [] };
  linhas.forEach(row => {
    if (kanban[row.status]) kanban[row.status].push(row);
  });
  return kanban;
}

async function getAll() {
  return leitura.lista({}, { comColuna: false });
}

async function getStats() {
  return leitura.estatisticas({});
}

async function getChartData() {
  const tarefas = await Tarefas.findAll({ attributes: ['status', 'prioridade'], where: { ativo: true }, raw: true });
  const conta = (campo, valor) => tarefas.filter(t => String(t[campo] || '').toUpperCase() === valor).length;
  return {
    porStatus:     [conta('status', 'A_FAZER'), conta('status', 'EM_ANDAMENTO'), conta('status', 'EM_REVISAO'), conta('status', 'CONCLUIDO')],
    porPrioridade: [conta('prioridade', 'ALTA'), conta('prioridade', 'MEDIA'), conta('prioridade', 'BAIXA')],
  };
}

async function getById(id) {
  const tarefa = await Tarefas.findOne({ where: { id, ativo: true }, raw: true });
  if (!tarefa) return null;
  const categoria = tarefa.id_categoria ? await Categorias.findOne({ attributes: ['nome'], where: { id: tarefa.id_categoria }, raw: true }) : null;
  const coluna = tarefa.id_coluna ? await WorkspaceColunas.findOne({ attributes: ['nome'], where: { id: tarefa.id_coluna }, raw: true }) : null;
  return {
    ...tarefa,
    data_vencimento: dataLocal(tarefa.data_vencimento),
    categoria_nome: categoria ? categoria.nome : null,
    coluna_nome: coluna ? coluna.nome : null,
  };
}

async function getNextPosicao(payload) {
  const idWorkspace = payload.id_workspace || null;
  const idColuna = payload.id_coluna || null;
  const filtro = {
    ativo: true,
    id_workspace: idWorkspace === null ? { [Op.or]: [null, 0] } : idWorkspace,
  };
  if (idColuna !== null) filtro.id_coluna = idColuna;
  else Object.assign(filtro, { id_coluna: null, status: truncate(payload.status, 20) || 'A_FAZER' });
  const linhas = await Tarefas.findAll({ attributes: ['posicao'], where: filtro, raw: true });
  if (!linhas.length) return -1;
  return Math.min(...linhas.map(l => (l.posicao === null ? 0 : l.posicao))) - 1;
}

async function insert(payload) {
  const posicao = (payload.posicao !== undefined && payload.posicao !== null)
    ? payload.posicao
    : await getNextPosicao(payload);

  const registro = await Tarefas.create({
    titulo:           truncate(payload.titulo, 300) || '',
    descricao:        payload.descricao || null,
    status:           truncate(payload.status, 20) || 'A_FAZER',
    prioridade:       truncate(payload.prioridade, 10) || 'MEDIA',
    responsavel_nome: truncate(payload.responsavel_nome, 200),
    id_categoria:     payload.id_categoria || null,
    data_vencimento:  dataParaGravar(payload.data_vencimento),
    posicao,
    criado_por:       truncate(payload.criado_por, 100),
    id_workspace:     payload.id_workspace || null,
    id_coluna:        payload.id_coluna || null,
  });
  return registro.id;
}

async function update(id, payload) {
  const campos = {
    titulo:           truncate(payload.titulo, 300) || '',
    descricao:        payload.descricao || null,
    status:           truncate(payload.status, 20) || 'A_FAZER',
    prioridade:       truncate(payload.prioridade, 10) || 'MEDIA',
    responsavel_nome: truncate(payload.responsavel_nome, 200),
    id_categoria:     payload.id_categoria || null,
    data_vencimento:  dataParaGravar(payload.data_vencimento),
    data_atualizacao: new Date(),
  };
  if (payload.id_workspace !== undefined && payload.id_workspace !== null) campos.id_workspace = payload.id_workspace;
  if (payload.id_coluna !== undefined && payload.id_coluna !== null) campos.id_coluna = payload.id_coluna;
  await Tarefas.update(campos, { where: { id, ativo: true } });
}

async function updateStatus(id, newStatus) {
  await Tarefas.update({ status: newStatus, data_atualizacao: new Date() }, { where: { id, ativo: true } });
}

async function updatePosicoes(items) {
  for (const item of items) {
    await Tarefas.update(
      { posicao: item.posicao, status: item.status || null, data_atualizacao: new Date() },
      { where: { id: item.id, ativo: true } }
    );
  }
}

async function updatePosicoesWorkspace(items) {
  for (const item of items) {
    const campos = { posicao: item.posicao, data_atualizacao: new Date() };
    if (item.id_coluna) campos.id_coluna = item.id_coluna;
    await Tarefas.update(campos, { where: { id: item.id, ativo: true } });
  }
}

async function deleteById(id) {
  await Tarefas.update({ ativo: false }, { where: { id } });
}

async function getChecklistItems(tarefaId) {
  return ChecklistItems.findAll({
    attributes: ['id', 'descricao', 'concluido', 'posicao'],
    where: { id_tarefa: tarefaId },
    order: [['posicao', 'ASC'], ['id', 'ASC']],
    raw: true,
  });
}

async function addChecklistItem(tarefaId, descricao) {
  const maior = await ChecklistItems.max('posicao', { where: { id_tarefa: tarefaId } });
  const registro = await ChecklistItems.create({
    id_tarefa: tarefaId,
    descricao,
    posicao: (maior || 0) + 1,
  });
  return registro.id;
}

async function toggleChecklistItem(itemId) {
  const item = await ChecklistItems.findOne({ attributes: ['concluido'], where: { id: itemId }, raw: true });
  if (!item) return 0;
  const concluido = !item.concluido;
  await ChecklistItems.update({ concluido }, { where: { id: itemId } });
  return concluido;
}

async function deleteChecklistItem(itemId) {
  await ChecklistItems.destroy({ where: { id: itemId } });
}

async function updateChecklistItem(itemId, descricao) {
  await ChecklistItems.update({ descricao }, { where: { id: itemId } });
}

async function reorderChecklistItems(items) {
  for (const item of items) {
    await ChecklistItems.update({ posicao: item.posicao }, { where: { id: item.id } });
  }
}

async function getResponsaveis() {
  const linhas = await Tarefas.findAll({
    attributes: ['responsavel_nome'],
    where: { responsavel_nome: { [Op.ne]: null }, ativo: true },
    order: [['id', 'ASC']],
    raw: true,
  });
  const nomes = distintosSemCaixa(linhas.map(l => l.responsavel_nome));
  return ordenarPorTexto(nomes.map(nome => ({ nome })), 'nome');
}

async function getCategorias() {
  const linhas = await Categorias.findAll({ attributes: ['id', 'nome', 'cor', 'icone'], where: { ativo: true }, raw: true });
  return ordenarPorTexto(linhas, 'nome');
}

module.exports = {
  getKanbanData,
  getAll,
  getStats,
  getChartData,
  getById,
  insert,
  update,
  updateStatus,
  updatePosicoes,
  updatePosicoesWorkspace,
  deleteById,
  getChecklistItems,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  updateChecklistItem,
  reorderChecklistItems,
  getResponsaveis,
  getCategorias,
};
