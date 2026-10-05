'use strict';

const {
  Anotacoes, AnotacoesEtiquetas, Etiquetas, TimeMembros, TimeTimes, sequelize,
} = require('.');
const {
  Op, textoIgual, igualSemCaixa, ordenarPorTexto,
} = require('../database/consultas');

function visivelPara(nota, userId, grupos) {
  const visibilidade = nota.visibilidade === null ? 'privado' : nota.visibilidade;
  const dono = textoIgual(nota.id_usuario, userId);
  if (textoIgual(visibilidade, 'privado')) return dono;
  if (textoIgual(visibilidade, 'grupo')) return dono || grupos.some(g => textoIgual(g, nota.grupo_acesso));
  if (textoIgual(visibilidade, 'usuario')) return dono || textoIgual(nota.grupo_acesso, userId);
  return false;
}

async function getAll(userId, includeArchived = false) {
  const membros = await TimeMembros.findAll({ attributes: ['codigo', 'nome', 'grupo'], where: { ativo: true }, raw: true });
  const grupos = membros
    .filter(m => textoIgual(m.codigo, userId) || textoIgual(m.nome, userId))
    .map(m => m.grupo)
    .filter(g => g !== null && g !== undefined);

  const candidatas = await Anotacoes.findAll({
    attributes: ['id', 'titulo', 'conteudo', 'cor', 'fixado', 'arquivado', 'data_criacao', 'data_atualizacao', 'visibilidade', 'grupo_acesso', 'id_usuario'],
    where: {
      arquivado: Boolean(includeArchived),
      [Op.or]: [
        igualSemCaixa('id_usuario', userId),
        igualSemCaixa('grupo_acesso', userId),
        ...grupos.map(g => igualSemCaixa('grupo_acesso', g)),
      ],
    },
    order: [['fixado', 'DESC'], ['data_atualizacao', 'DESC'], ['id', 'ASC']],
    raw: true,
  });
  const notas = candidatas.filter(n => visivelPara(n, userId, grupos));

  const vinculos = notas.length
    ? await AnotacoesEtiquetas.findAll({ where: { id_anotacao: { [Op.in]: notas.map(n => n.id) } }, order: [['id_anotacao', 'ASC'], ['id_etiqueta', 'ASC']], raw: true })
    : [];
  const etiquetas = vinculos.length
    ? new Map((await Etiquetas.findAll({ attributes: ['id', 'nome'], where: { id: { [Op.in]: [...new Set(vinculos.map(v => v.id_etiqueta))] } }, raw: true })).map(e => [e.id, e.nome]))
    : new Map();

  return notas.map((n) => {
    const daNota = vinculos.filter(v => v.id_anotacao === n.id);
    return {
      id: n.id,
      titulo: n.titulo,
      conteudo: n.conteudo,
      cor: n.cor,
      fixado: n.fixado,
      arquivado: n.arquivado,
      data_criacao: n.data_criacao,
      data_atualizacao: n.data_atualizacao,
      visibilidade: n.visibilidade === null ? 'privado' : n.visibilidade,
      grupo_acesso: n.grupo_acesso,
      etiquetas_nomes: daNota.length ? daNota.map(v => etiquetas.get(v.id_etiqueta)).join(', ') : null,
      etiquetas_ids: daNota.length ? daNota.map(v => String(v.id_etiqueta)).join(',') : null,
    };
  });
}

async function getById(id) {
  return Anotacoes.findOne({ where: { id }, raw: true });
}

async function insert(payload) {
  const registro = await Anotacoes.create({
    titulo:       payload.titulo || null,
    conteudo:     payload.conteudo || null,
    cor:          payload.cor || 'default',
    fixado:       Boolean(payload.fixado),
    id_usuario:   payload.id_usuario || null,
    visibilidade: payload.visibilidade || 'privado',
    grupo_acesso: payload.grupo_acesso || null,
  });
  return registro.id;
}

async function update(id, payload) {
  await Anotacoes.update({
    titulo:           payload.titulo || null,
    conteudo:         payload.conteudo || null,
    cor:              payload.cor || 'default',
    visibilidade:     payload.visibilidade || 'privado',
    grupo_acesso:     payload.grupo_acesso || null,
    data_atualizacao: new Date(),
  }, { where: { id } });
}

async function alternar(id, campo) {
  const nota = await Anotacoes.findOne({ attributes: [campo], where: { id }, raw: true });
  if (!nota) return 0;
  const valor = !nota[campo];
  await Anotacoes.update({ [campo]: valor, data_atualizacao: new Date() }, { where: { id } });
  return valor;
}

async function toggleFixado(id) {
  return alternar(id, 'fixado');
}

async function toggleArquivado(id) {
  return alternar(id, 'arquivado');
}

async function deleteById(id) {
  await Anotacoes.destroy({ where: { id } });
}

async function getEtiquetas() {
  const linhas = await Etiquetas.findAll({ attributes: ['id', 'nome', 'cor'], raw: true });
  return ordenarPorTexto(linhas, 'nome');
}

async function addEtiquetaToNota(notaId, etiquetaId) {
  const existe = await AnotacoesEtiquetas.findOne({ where: { id_anotacao: notaId, id_etiqueta: etiquetaId }, raw: true });
  if (existe) return;
  try {
    await AnotacoesEtiquetas.create({ id_anotacao: notaId, id_etiqueta: etiquetaId });
  } catch (e) {
    if (!(e instanceof sequelize.Sequelize.UniqueConstraintError)) throw e;
  }
}

async function removeEtiquetaFromNota(notaId, etiquetaId) {
  await AnotacoesEtiquetas.destroy({ where: { id_anotacao: notaId, id_etiqueta: etiquetaId } });
}

async function getGrupos() {
  const linhas = await TimeTimes.findAll({ attributes: ['id', 'nome'], where: { ativo: true }, raw: true });
  return ordenarPorTexto(linhas, 'nome');
}

module.exports = {
  getAll,
  getById,
  insert,
  update,
  toggleFixado,
  toggleArquivado,
  deleteById,
  getEtiquetas,
  addEtiquetaToNota,
  removeEtiquetaFromNota,
  getGrupos,
};
