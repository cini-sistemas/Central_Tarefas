'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  DIALETO, ativo, prepararBanco, emTransacaoDesfeita, restaurarIdentidades, semPermissaoDeGravar,
} = require('./ambiente');

describe(`Central de Tarefas no banco real (${DIALETO || 'desligado'})`, { skip: !ativo && 'defina TESTE_DIALETO=mssql ou TESTE_DIALETO=postgres + TESTE_PG_*' }, () => {
  let modelos;
  let sequelize;
  let tarefas;
  let workspaces;
  let anotacoes;
  let times;
  let motivoPulo;

  before(async () => {
    modelos = require('../../models');
    sequelize = modelos.sequelize;
    assert.equal(sequelize.getDialect(), DIALETO);
    await prepararBanco(sequelize);
    motivoPulo = await semPermissaoDeGravar(sequelize);
    tarefas = require('../../models/tarefaModel');
    workspaces = require('../../models/workspaceModel');
    anotacoes = require('../../models/anotacaoModel');
    times = require('../../models/timeModel');
  });

  after(async () => {
    if (!motivoPulo) await restaurarIdentidades(sequelize);
    await sequelize.close();
  });

  const cenario = fn => async (t) => {
    if (motivoPulo) return t.skip(motivoPulo);
    await emTransacaoDesfeita(sequelize, fn);
  };

  test('tarefas de um workspace: posição automática, ordem do quadro, estatísticas e exclusão lógica', cenario(async () => {
    const ws = await workspaces.create({ nome: 'ZZ Quadro', criado_por: 'zz.dono', privado: false });
    const categoria = await modelos.Categorias.create({ nome: 'ZZ Categoria', cor: '#123456' });
    const primeira = await tarefas.insert({ titulo: 'Primeira', id_workspace: ws, responsavel_nome: 'zz Fulano', id_categoria: categoria.id, data_vencimento: '2000-01-10' });
    const segunda = await tarefas.insert({ titulo: 'Segunda', id_workspace: ws, data_vencimento: '2099-02-01' });
    const fixa = await tarefas.insert({ titulo: 'Fixa', id_workspace: ws, posicao: 5, status: 'CONCLUIDO' });

    const detalhe = await tarefas.getById(primeira);
    assert.equal(detalhe.posicao, -1);
    assert.equal(detalhe.categoria_nome, 'ZZ Categoria');
    assert.equal(detalhe.coluna_nome, null);
    assert.ok(detalhe.data_vencimento instanceof Date);
    assert.deepEqual([detalhe.data_vencimento.getFullYear(), detalhe.data_vencimento.getMonth(), detalhe.data_vencimento.getDate(), detalhe.data_vencimento.getHours()], [2000, 0, 10, 0]);
    assert.equal((await tarefas.getById(segunda)).posicao, -2);

    const quadro = await workspaces.getKanbanData(ws);
    assert.equal(quadro.hasCustomColunas, false);
    assert.deepEqual(quadro.kanban.A_FAZER.map(t => t.titulo), ['Segunda', 'Primeira']);
    assert.equal(quadro.kanban.A_FAZER[1].avatar_initials, 'z');
    assert.equal(quadro.kanban.A_FAZER[0].avatar_initials, '?');
    assert.equal(quadro.kanban.A_FAZER[1].categoria_cor, '#123456');
    assert.deepEqual(quadro.kanban.CONCLUIDO.map(t => t.id), [fixa]);

    assert.deepEqual(await workspaces.getStats(ws), { total: 3, concluidas: 1, em_andamento: 0, atrasadas: 1 });
    assert.deepEqual(await workspaces.getStats(-1), { total: 0, concluidas: null, em_andamento: null, atrasadas: null });

    assert.ok((await tarefas.getResponsaveis()).some(r => r.nome === 'zz Fulano'));
    await tarefas.update(primeira, { titulo: 'Primeira editada', status: 'EM_ANDAMENTO', data_vencimento: '' });
    const editada = await tarefas.getById(primeira);
    assert.equal(editada.titulo, 'Primeira editada');
    assert.equal(editada.id_workspace, ws);
    assert.equal(editada.data_vencimento, null);
    assert.equal(editada.id_categoria, null);
    await tarefas.updateStatus(segunda, 'EM_REVISAO');
    await tarefas.updatePosicoesWorkspace([{ id: segunda, posicao: 9 }]);
    assert.equal((await tarefas.getById(segunda)).posicao, 9);

    const lista = await workspaces.getAllTasks(ws);
    assert.deepEqual(lista.map(t => t.id), [fixa, segunda, primeira]);
    assert.equal(lista[2].status, 'EM_ANDAMENTO');
    assert.equal(lista[1].status, 'EM_REVISAO');

    await tarefas.deleteById(fixa);
    assert.equal(await tarefas.getById(fixa), null);
    assert.equal((await workspaces.getAllTasks(ws)).length, 2);
  }));

  test('checklist: adiciona em sequência, alterna, edita, reordena e remove', cenario(async () => {
    const tarefa = await tarefas.insert({ titulo: 'Com checklist' });
    const a = await tarefas.addChecklistItem(tarefa, 'item A');
    const b = await tarefas.addChecklistItem(tarefa, 'item B');
    assert.deepEqual((await tarefas.getChecklistItems(tarefa)).map(i => [i.id, i.posicao, i.concluido]), [[a, 1, false], [b, 2, false]]);
    assert.equal(await tarefas.toggleChecklistItem(a), true);
    assert.equal(await tarefas.toggleChecklistItem(a), false);
    assert.equal(await tarefas.toggleChecklistItem(a), true);
    assert.equal(await tarefas.toggleChecklistItem(-1), 0);
    await tarefas.updateChecklistItem(b, 'item B editado');
    await tarefas.reorderChecklistItems([{ id: a, posicao: 2 }, { id: b, posicao: 1 }]);
    const itens = await tarefas.getChecklistItems(tarefa);
    assert.deepEqual(itens.map(i => i.descricao), ['item B editado', 'item A']);

    const quadro = await tarefas.getKanbanData();
    const card = quadro.A_FAZER.find(t => t.id === tarefa);
    assert.equal(card.checklist_total, 2);
    assert.equal(card.checklist_done, 1);

    await tarefas.deleteChecklistItem(a);
    assert.equal((await tarefas.getChecklistItems(tarefa)).length, 1);
  }));

  test('workspaces: colunas próprias, acesso por usuário, grupo e público, permissões', cenario(async () => {
    const membro = await times.addMembro('zz.membro', 'ZZ Membro', 'ZZ Grupo');
    const publico = await workspaces.create({ nome: 'ZZ Público', criado_por: 'zz.dono', privado: false });
    const restrito = await workspaces.create({ nome: 'ZZ Restrito', criado_por: 'zz.dono', privado: false });
    const privado = await workspaces.create({ nome: 'ZZ Privado', criado_por: 'zz.dono', privado: true });
    await workspaces.addAcesso(restrito, 'grupo', 'zz grupo', 'Grupo ZZ', 'editor');
    const acessoUsuario = await workspaces.addAcesso(restrito, 'usuario', 'ZZ.Convidado', null, 'viewer');

    const visiveis = async u => (await workspaces.getAll(u)).map(w => w.id).filter(id => [publico, restrito, privado].includes(id)).sort((x, y) => x - y);
    assert.deepEqual(await visiveis('ZZ.DONO'), [publico, restrito, privado]);
    assert.deepEqual(await visiveis('zz.membro'), [publico, restrito]);
    assert.deepEqual(await visiveis('zz.convidado'), [publico, restrito]);
    assert.deepEqual(await visiveis('zz.estranho'), [publico]);

    assert.equal(await workspaces.hasAccess(restrito, 'ZZ MEMBRO'), true);
    assert.equal(await workspaces.hasAccess(restrito, 'zz.estranho'), false);
    assert.equal(await workspaces.hasAccess(privado, 'zz.membro'), false);
    assert.equal(await workspaces.getPermissao(restrito, 'zz.dono'), 'owner');
    assert.equal(await workspaces.getPermissao(restrito, 'zz.convidado'), 'viewer');
    assert.equal(await workspaces.getPermissao(restrito, 'zz.membro'), 'editor');
    assert.equal(await workspaces.getPermissao(publico, 'zz.estranho'), 'viewer');
    assert.equal(await workspaces.getPermissao(privado, 'zz.estranho'), null);
    assert.ok((await workspaces.getGrupos()).some(g => g.grupo === 'ZZ Grupo'));

    await workspaces.removeAcesso(acessoUsuario);
    assert.equal((await workspaces.getAcessos(restrito)).length, 1);

    const tarefa = await tarefas.insert({ titulo: 'Na coluna padrão', id_workspace: publico, status: 'EM_ANDAMENTO' });
    const nova = await workspaces.addColunaSmart(publico, 'Extra', '#000000');
    const colunas = await workspaces.getColunas(publico);
    assert.deepEqual(colunas.map(c => [c.nome, c.posicao]), [['A Fazer', 0], ['Em Andamento', 1], ['Em Revisão', 2], ['Concluído', 3], ['Extra', 4]]);
    assert.equal(colunas[4].id, nova);
    const quadro = await workspaces.getKanbanData(publico);
    assert.equal(quadro.hasCustomColunas, true);
    assert.deepEqual(quadro.kanban[`col_${colunas[1].id}`].map(t => t.id), [tarefa]);
    assert.equal(quadro.kanban[`col_${colunas[1].id}`][0].coluna_nome, 'Em Andamento');

    await workspaces.reorderColunas([{ id: nova, posicao: -1 }]);
    assert.equal((await workspaces.getColunas(publico))[0].id, nova);
    await workspaces.deleteColuna(nova);
    assert.equal((await workspaces.getColunas(publico)).length, 4);

    await workspaces.softDelete(publico);
    assert.equal(await workspaces.getById(publico), null);
    await times.removeMembro(membro);
    assert.equal(await workspaces.hasAccess(restrito, 'zz.membro'), false);
  }));

  test('anotações: visibilidade, etiquetas, fixar e arquivar', cenario(async () => {
    const membro = await times.addMembro('zz.colega', 'ZZ Colega', 'ZZ Equipe');
    const etiquetaA = await modelos.Etiquetas.create({ nome: 'ZZ Etiqueta A' });
    const etiquetaB = await modelos.Etiquetas.create({ nome: 'ZZ Etiqueta B' });
    const privada = await anotacoes.insert({ titulo: 'Privada', id_usuario: 'zz.autor' });
    const doGrupo = await anotacoes.insert({ titulo: 'Do grupo', id_usuario: 'zz.autor', visibilidade: 'grupo', grupo_acesso: 'zz equipe' });
    const paraUsuario = await anotacoes.insert({ titulo: 'Para usuário', id_usuario: 'zz.autor', visibilidade: 'usuario', grupo_acesso: 'ZZ.LEITOR' });
    await modelos.Anotacoes.update({ visibilidade: null }, { where: { id: privada } });

    await anotacoes.addEtiquetaToNota(privada, etiquetaB.id);
    await anotacoes.addEtiquetaToNota(privada, etiquetaA.id);
    await anotacoes.addEtiquetaToNota(privada, etiquetaA.id);

    const titulos = async (u, arquivadas = false) => (await anotacoes.getAll(u, arquivadas)).map(n => n.titulo).filter(t => ['Privada', 'Do grupo', 'Para usuário'].includes(t)).sort();
    assert.deepEqual(await titulos('ZZ.AUTOR'), ['Do grupo', 'Para usuário', 'Privada']);
    assert.deepEqual(await titulos('zz.colega'), ['Do grupo']);
    assert.deepEqual(await titulos('zz.leitor'), ['Para usuário']);
    assert.deepEqual(await titulos('zz.estranho'), []);

    const nota = (await anotacoes.getAll('zz.autor')).find(n => n.id === privada);
    assert.equal(nota.visibilidade, 'privado');
    assert.equal(nota.etiquetas_nomes, 'ZZ Etiqueta A, ZZ Etiqueta B');
    assert.equal(nota.etiquetas_ids, `${etiquetaA.id},${etiquetaB.id}`);
    assert.equal((await anotacoes.getAll('zz.autor')).find(n => n.id === doGrupo).etiquetas_nomes, null);

    await anotacoes.removeEtiquetaFromNota(privada, etiquetaA.id);
    assert.equal((await anotacoes.getAll('zz.autor')).find(n => n.id === privada).etiquetas_ids, String(etiquetaB.id));

    assert.equal(await anotacoes.toggleFixado(doGrupo), true);
    assert.equal((await anotacoes.getAll('zz.autor')).filter(n => [privada, doGrupo, paraUsuario].includes(n.id))[0].id, doGrupo);
    assert.equal(await anotacoes.toggleArquivado(paraUsuario), true);
    assert.deepEqual(await titulos('zz.autor', true), ['Para usuário']);
    assert.equal(await anotacoes.toggleArquivado(-1), 0);

    await anotacoes.update(privada, { titulo: 'Privada 2', conteudo: 'texto' });
    const atualizada = await anotacoes.getById(privada);
    assert.equal(atualizada.titulo, 'Privada 2');
    assert.equal(atualizada.cor, 'default');
    assert.equal(atualizada.visibilidade, 'privado');
    await anotacoes.deleteById(privada);
    assert.equal(await anotacoes.getById(privada), null);
    await times.removeMembro(membro);
  }));

  test('times e membros', cenario(async () => {
    const time = await times.addTime('ZZ-T1', 'ZZ Time', 'desc');
    await times.updateTime(time, 'ZZ-T1', 'ZZ Time Renomeado', null);
    const membro = await times.addMembro('zz.m1', 'Zz Membro Um', 'ZZ G');
    const lista = await times.getTimes();
    const meu = lista.find(t => t.id === time);
    assert.equal(meu.nome, 'ZZ Time Renomeado');
    assert.equal(meu.total_membros, await modelos.TimeMembros.count({ where: { ativo: true } }));
    assert.ok((await anotacoes.getGrupos()).some(g => g.id === time));
    const membros = await times.getMembros();
    assert.ok(membros.some(m => m.id === membro && m.grupo === 'ZZ G'));
    await times.deleteTime(time);
    assert.equal((await times.getTimes()).some(t => t.id === time), false);
    await times.removeMembro(membro);
    assert.equal((await times.getMembros()).some(m => m.id === membro), false);
  }));
});
