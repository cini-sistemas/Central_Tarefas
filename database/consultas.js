'use strict';

const { Op, fn, col, where } = require('sequelize');

const COLACAO = new Intl.Collator('pt-BR', { sensitivity: 'accent' });

const chaveTexto = valor => (valor === null || valor === undefined ? null : String(valor).replace(/ +$/, '').toLowerCase());

function textoIgual(a, b) {
  const x = chaveTexto(a);
  return x !== null && x === chaveTexto(b);
}

function ordenarPorTexto(linhas, campo) {
  return [...linhas].sort((a, b) => {
    const x = a[campo];
    const y = b[campo];
    if (x === y) return 0;
    if (x === null || x === undefined) return -1;
    if (y === null || y === undefined) return 1;
    return COLACAO.compare(String(x), String(y));
  });
}

function distintosSemCaixa(valores) {
  const vistos = new Set();
  const saida = [];
  for (const valor of valores) {
    const chave = chaveTexto(valor);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(valor);
  }
  return saida;
}

const igualSemCaixa = (nome, valor) => where(fn('LOWER', fn('RTRIM', col(nome))), chaveTexto(valor));

const textoDeData = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function dataParaGravar(valor) {
  if (!valor) return null;
  const [y, m, d] = String(valor).split('-').map(Number);
  const data = new Date(y, m - 1, d);
  return Number.isNaN(data.getTime()) ? null : textoDeData(data);
}

function dataLocal(valor) {
  if (!valor) return valor === undefined ? undefined : null;
  if (valor instanceof Date) return valor;
  const [y, m, d] = String(valor).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

const hoje = () => textoDeData(new Date());

const inicial = nome => (nome === null || nome === undefined ? '?' : String(nome)).slice(0, 1);

module.exports = {
  Op,
  fn,
  col,
  where,
  textoIgual,
  ordenarPorTexto,
  distintosSemCaixa,
  igualSemCaixa,
  dataParaGravar,
  dataLocal,
  hoje,
  inicial,
};
