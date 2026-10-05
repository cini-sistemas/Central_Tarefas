'use strict';

const { Tarefas, Categorias, WorkspaceColunas, ChecklistItems } = require('.');
const {
  Op, dataLocal, inicial, hoje, textoIgual,
} = require('../database/consultas');

async function porId(Modelo, ids, atributos) {
  const unicos = [...new Set(ids.filter(id => id !== null && id !== undefined))];
  if (!unicos.length) return new Map();
  const linhas = await Modelo.findAll({ attributes: ['id', ...atributos], where: { id: { [Op.in]: unicos } }, raw: true });
  return new Map(linhas.map(l => [l.id, l]));
}

async function contagemChecklist(idsTarefas) {
  const contagem = new Map();
  if (!idsTarefas.length) return contagem;
  const itens = await ChecklistItems.findAll({ attributes: ['id_tarefa', 'concluido'], where: { id_tarefa: { [Op.in]: idsTarefas } }, raw: true });
  for (const item of itens) {
    const atual = contagem.get(item.id_tarefa) || { total: 0, feitos: 0 };
    atual.total += 1;
    if (item.concluido) atual.feitos += 1;
    contagem.set(item.id_tarefa, atual);
  }
  return contagem;
}

function ordemKanban(a, b) {
  const pa = a.posicao === null || a.posicao === undefined ? 0 : a.posicao;
  const pb = b.posicao === null || b.posicao === undefined ? 0 : b.posicao;
  const grupoA = pa < 0 ? 0 : 1;
  const grupoB = pb < 0 ? 0 : 1;
  if (grupoA !== grupoB) return grupoA - grupoB;
  const negA = pa < 0 ? a.posicao : 0;
  const negB = pb < 0 ? b.posicao : 0;
  if (negA !== negB) return negA - negB;
  const va = a.data_vencimento || '9999-12-31';
  const vb = b.data_vencimento || '9999-12-31';
  if (va !== vb) return va < vb ? -1 : 1;
  const fa = a.posicao === null || a.posicao === undefined ? 2147483647 : a.posicao;
  const fb = b.posicao === null || b.posicao === undefined ? 2147483647 : b.posicao;
  return fa - fb;
}

async function quadro(filtro, { comColuna }) {
  const tarefas = await Tarefas.findAll({
    attributes: ['id', 'titulo', 'descricao', 'status', 'prioridade', 'data_vencimento', 'posicao', 'data_criacao', 'responsavel_nome', 'id_coluna', 'id_categoria'],
    where: { ...filtro, ativo: true },
    order: [['id', 'ASC']],
    raw: true,
  });
  const categorias = await porId(Categorias, tarefas.map(t => t.id_categoria), ['nome', 'cor']);
  const colunas = comColuna ? await porId(WorkspaceColunas, tarefas.map(t => t.id_coluna), ['nome']) : null;
  const checklist = await contagemChecklist(tarefas.map(t => t.id));

  return tarefas.sort(ordemKanban).map((t) => {
    const categoria = categorias.get(t.id_categoria);
    const contagem = checklist.get(t.id) || { total: 0, feitos: 0 };
    const linha = {
      id: t.id,
      titulo: t.titulo,
      descricao: t.descricao,
      status: t.status,
      prioridade: t.prioridade,
      data_vencimento: dataLocal(t.data_vencimento),
      posicao: t.posicao,
      data_criacao: t.data_criacao,
      responsavel_nome: t.responsavel_nome,
    };
    if (comColuna) linha.id_coluna = t.id_coluna;
    linha.avatar_initials = inicial(t.responsavel_nome);
    linha.categoria_nome = categoria ? categoria.nome : null;
    linha.categoria_cor = categoria ? categoria.cor : null;
    if (comColuna) {
      const coluna = colunas.get(t.id_coluna);
      linha.coluna_nome = coluna ? coluna.nome : null;
    }
    linha.checklist_total = contagem.total;
    linha.checklist_done = contagem.feitos;
    return linha;
  });
}

async function lista(filtro, { comColuna }) {
  const tarefas = await Tarefas.findAll({
    attributes: ['id', 'titulo', 'descricao', 'status', 'prioridade', 'data_vencimento', 'posicao', 'ativo', 'criado_por', 'data_criacao', 'data_atualizacao', 'responsavel_nome', 'id_coluna', 'id_categoria'],
    where: { ...filtro, ativo: true },
    order: [['id', 'DESC']],
    raw: true,
  });
  const categorias = await porId(Categorias, tarefas.map(t => t.id_categoria), ['nome', 'cor']);
  const colunas = comColuna ? await porId(WorkspaceColunas, tarefas.map(t => t.id_coluna), ['nome']) : null;

  return tarefas.map((t) => {
    const categoria = categorias.get(t.id_categoria);
    const linha = {
      id: t.id,
      titulo: t.titulo,
      descricao: t.descricao,
      status: t.status,
      prioridade: t.prioridade,
      data_vencimento: dataLocal(t.data_vencimento),
      posicao: t.posicao,
      ativo: t.ativo,
      criado_por: t.criado_por,
      data_criacao: t.data_criacao,
      data_atualizacao: t.data_atualizacao,
      responsavel_nome: t.responsavel_nome,
    };
    if (comColuna) linha.id_coluna = t.id_coluna;
    linha.avatar_initials = inicial(t.responsavel_nome);
    linha.categoria_nome = categoria ? categoria.nome : null;
    linha.categoria_cor = categoria ? categoria.cor : null;
    if (comColuna) {
      const coluna = colunas.get(t.id_coluna);
      linha.coluna_nome = coluna ? coluna.nome : null;
    }
    return linha;
  });
}

async function estatisticas(filtro) {
  const tarefas = await Tarefas.findAll({ attributes: ['status', 'data_vencimento'], where: { ...filtro, ativo: true }, raw: true });
  if (!tarefas.length) return { total: 0, concluidas: null, em_andamento: null, atrasadas: null };
  const dia = hoje();
  return {
    total: tarefas.length,
    concluidas: tarefas.filter(t => textoIgual(t.status, 'CONCLUIDO')).length,
    em_andamento: tarefas.filter(t => textoIgual(t.status, 'EM_ANDAMENTO') || textoIgual(t.status, 'EM_REVISAO')).length,
    atrasadas: tarefas.filter(t => !textoIgual(t.status, 'CONCLUIDO') && t.data_vencimento && t.data_vencimento < dia).length,
  };
}

module.exports = { quadro, lista, estatisticas };
