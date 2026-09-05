// Camada de dados. Tudo fica no aparelho (localStorage) — nenhum servidor, custo zero.
import { uid, hojeISO, competenciaDe } from './util.js';

const CHAVE = 'casaApp:dados:v1';
const VERSAO = 1;

export const CATEGORIAS_DESPESA = [
  'Moradia', 'Alimentação', 'Mercado', 'Transporte', 'Saúde', 'Farmácia',
  'Educação', 'Lazer', 'Assinaturas', 'Cartão', 'Impostos', 'Pets', 'Outros'
];
export const CATEGORIAS_RECEITA = ['Salário', 'Freelance', 'Benefício', 'Reembolso', 'Investimentos', 'Outros'];
export const CATEGORIAS_EVENTO = ['Casa', 'Saúde', 'Trabalho', 'Família', 'Lazer', 'Financeiro', 'Outros'];
export const CATEGORIAS_MERCADO = ['Hortifruti', 'Carnes', 'Laticínios', 'Padaria', 'Mercearia',
  'Bebidas', 'Congelados', 'Limpeza', 'Higiene', 'Pet', 'Outros'];

// O que é da casa (vai para os dois celulares) — o resto, como tema e
// permissão de notificação, é de cada aparelho e fica só aqui.
const COLECOES_SINCRONIZADAS = [
  'pessoas', 'eventos', 'medicamentos', 'doses', 'mercado', 'compras',
  'contas', 'pagamentos', 'rendas', 'recebimentos', 'transacoes', 'orcamentos'
];

export function colecoesSincronizadas() { return [...COLECOES_SINCRONIZADAS]; }

function estadoInicial() {
  return {
    versao: VERSAO,
    pessoas: [
      { id: 'p_1', nome: 'Eu', cor: '#6366f1' },
      { id: 'p_2', nome: 'Esposa', cor: '#ec4899' }
    ],
    eventos: [],
    medicamentos: [],
    doses: [],
    mercado: [],
    compras: [],
    contas: [],
    pagamentos: [],
    rendas: [],
    recebimentos: [],
    transacoes: [],
    orcamentos: [],
    config: {
      tema: 'escuro',
      notificacoes: true,
      horaResumoDiario: '08:00',
      resumoDiario: true,
      diasAvisoConta: 3,
      googleClientId: '',
      ultimaImportacaoGoogle: null,
      criadoEm: hojeISO()
    },
    notificados: {},   // dedupe: chave -> timestamp
    tumulos: [],       // o que foi apagado, para a exclusão chegar no outro celular
    nuvem: {
      casaId: null, codigo: null, nomeCasa: null,
      ultimoPushEm: 0, ultimoSyncServidor: null, ultimoSyncEm: null, ultimoErro: null
    },
    atualizadoEm: Date.now()
  };
}

let estado = carregar();
const ouvintes = new Set();

function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return estadoInicial();
    const dados = JSON.parse(bruto);
    return migrar(dados);
  } catch (e) {
    console.error('Falha ao ler dados salvos, começando do zero:', e);
    return estadoInicial();
  }
}

// Garante que dados antigos ganhem os campos novos sem perder nada.
function migrar(dados) {
  const base = estadoInicial();
  const saida = { ...base, ...dados };
  saida.config = { ...base.config, ...(dados.config || {}) };
  for (const chave of [...COLECOES_SINCRONIZADAS, 'tumulos']) {
    if (!Array.isArray(saida[chave])) saida[chave] = base[chave];
  }
  saida.nuvem = { ...base.nuvem, ...(dados.nuvem || {}) };
  if (!saida.pessoas.length) saida.pessoas = base.pessoas;
  if (typeof saida.notificados !== 'object' || !saida.notificados) saida.notificados = {};
  saida.versao = VERSAO;
  return saida;
}

export function obter() { return estado; }

export function inscrever(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function emitir() { ouvintes.forEach((fn) => { try { fn(estado); } catch (e) { console.error(e); } }); }

export function salvar() {
  estado.atualizadoEm = Date.now();
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch (e) {
    console.error('Não foi possível salvar:', e);
    alert('Não consegui salvar os dados. O armazenamento do navegador pode estar cheio ou bloqueado.');
  }
  emitir();
}

// Grava sem avisar as telas. Para dados que o usuário não vê (ex.: o registro
// de avisos já enviados) — assim uma verificação em segundo plano nunca
// redesenha a tela no meio de um toque.
export function salvarSilencioso() {
  estado.atualizadoEm = Date.now();
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch (e) {
    console.error('Não foi possível salvar:', e);
  }
}

// Uso: alterar(d => { d.contas.push(...) })
export function alterar(fn) {
  fn(estado);
  salvar();
}

/* ---------- CRUD genérico ---------- */

export function inserir(colecao, item) {
  const agora = Date.now();
  const registro = { id: uid(colecao.slice(0, 3)), criadoEm: agora, ...item, atualizadoEm: agora };
  alterar((d) => { d[colecao].unshift(registro); });
  return registro;
}

export function atualizar(colecao, id, campos) {
  alterar((d) => {
    const i = d[colecao].findIndex((x) => x.id === id);
    if (i >= 0) d[colecao][i] = { ...d[colecao][i], ...campos, atualizadoEm: Date.now() };
  });
}

export function remover(colecao, id) {
  alterar((d) => {
    d[colecao] = d[colecao].filter((x) => x.id !== id);
    if (COLECOES_SINCRONIZADAS.includes(colecao)) {
      // Guarda a marca da exclusão para ela também acontecer no outro celular.
      d.tumulos = d.tumulos.filter((t) => !(t.colecao === colecao && t.id === id));
      d.tumulos.push({ colecao, id, em: Date.now() });
      const limite = Date.now() - 60 * 86400000;
      d.tumulos = d.tumulos.filter((t) => t.em > limite);
    }
  });
}

// Aplica de uma vez o que veio da nuvem, sem marcar como mudança local
// (senão o app devolveria tudo de volta para o servidor sem parar).
export function aplicarLoteDaNuvem(linhas) {
  let mudou = false;
  for (const linha of linhas) {
    if (!COLECOES_SINCRONIZADAS.includes(linha.colecao)) continue;
    const lista = estado[linha.colecao] || (estado[linha.colecao] = []);
    const i = lista.findIndex((x) => x.id === linha.id);

    if (linha.removido) {
      if (i >= 0) { lista.splice(i, 1); mudou = true; }
      estado.tumulos = estado.tumulos.filter((t) => !(t.colecao === linha.colecao && t.id === linha.id));
      continue;
    }
    if (!linha.dados) continue;
    // Não sobrescreve uma alteração daqui que ainda é mais nova.
    const local = i >= 0 ? lista[i] : null;
    if (local && (local.atualizadoEm || 0) > (linha.dados.atualizadoEm || 0)) continue;
    if (i >= 0) lista[i] = linha.dados; else lista.unshift(linha.dados);
    mudou = true;
  }
  if (!mudou) return 0;
  salvarSilencioso();
  window.dispatchEvent(new CustomEvent('dados-vieram-da-nuvem'));
  return linhas.length;
}

export function buscar(colecao, id) {
  return (estado[colecao] || []).find((x) => x.id === id) || null;
}

/* ---------- Pessoas ---------- */

export function nomePessoa(id) {
  const p = estado.pessoas.find((x) => x.id === id);
  return p ? p.nome : 'Casa';
}

export function corPessoa(id) {
  const p = estado.pessoas.find((x) => x.id === id);
  return p ? p.cor : '#64748b';
}

/* ---------- Contas a pagar ---------- */

// Uma conta mensal "existe" em toda competência a partir do início; a única, só na sua.
export function contasDaCompetencia(comp) {
  return estado.contas.filter((c) => {
    if (c.arquivada) return false;
    if (c.tipo === 'unica') return (c.dataUnica || '').slice(0, 7) === comp;
    const inicio = (c.inicioEm || '').slice(0, 7);
    if (inicio && comp < inicio) return false;
    const fim = (c.fimEm || '').slice(0, 7);
    if (fim && comp > fim) return false;
    return true;
  });
}

export function pagamentoDe(contaId, comp) {
  return estado.pagamentos.find((p) => p.contaId === contaId && p.competencia === comp) || null;
}

export function marcarPago(contaId, comp, { valorPago, dataPagamento } = {}) {
  const conta = buscar('contas', contaId);
  if (!conta) return;
  const existente = pagamentoDe(contaId, comp);
  const valor = valorPago != null ? valorPago : conta.valor;
  const data = dataPagamento || hojeISO();
  if (existente) {
    atualizar('pagamentos', existente.id, { valorPago: valor, dataPagamento: data });
  } else {
    inserir('pagamentos', { contaId, competencia: comp, valorPago: valor, dataPagamento: data });
  }
}

export function desmarcarPago(contaId, comp) {
  const p = pagamentoDe(contaId, comp);
  if (p) remover('pagamentos', p.id);
}

/* ---------- Rendas (salário e afins) ---------- */

export function rendasDaCompetencia(comp) {
  return estado.rendas.filter((r) => {
    if (r.arquivada) return false;
    if (r.tipo === 'unica') return (r.dataUnica || '').slice(0, 7) === comp;
    const inicio = (r.inicioEm || '').slice(0, 7);
    if (inicio && comp < inicio) return false;
    return true;
  });
}

export function recebimentoDe(rendaId, comp) {
  return estado.recebimentos.find((r) => r.rendaId === rendaId && r.competencia === comp) || null;
}

export function marcarRecebido(rendaId, comp, { valorRecebido, dataRecebimento } = {}) {
  const renda = buscar('rendas', rendaId);
  if (!renda) return;
  const existente = recebimentoDe(rendaId, comp);
  const valor = valorRecebido != null ? valorRecebido : renda.valor;
  const data = dataRecebimento || hojeISO();
  if (existente) {
    atualizar('recebimentos', existente.id, { valorRecebido: valor, dataRecebimento: data });
  } else {
    inserir('recebimentos', { rendaId, competencia: comp, valorRecebido: valor, dataRecebimento: data });
  }
}

export function desmarcarRecebido(rendaId, comp) {
  const r = recebimentoDe(rendaId, comp);
  if (r) remover('recebimentos', r.id);
}

/* ---------- Backup ---------- */

export function exportarJSON() {
  return JSON.stringify(estado, null, 2);
}

export function importarJSON(texto, { mesclar = false } = {}) {
  const dados = JSON.parse(texto);
  if (!dados || typeof dados !== 'object') throw new Error('Arquivo inválido.');
  if (mesclar) {
    const atual = estado;
    const novo = migrar(dados);
    const juntar = (chave) => {
      const vistos = new Set(atual[chave].map((x) => x.id));
      return atual[chave].concat((novo[chave] || []).filter((x) => !vistos.has(x.id)));
    };
    const mesclado = { ...atual };
    for (const chave of ['eventos', 'medicamentos', 'doses', 'mercado', 'compras', 'contas',
      'pagamentos', 'rendas', 'recebimentos', 'transacoes', 'orcamentos']) {
      mesclado[chave] = juntar(chave);
    }
    estado = mesclado;
  } else {
    estado = migrar(dados);
  }
  salvar();
}

export function apagarTudo() {
  estado = estadoInicial();
  salvar();
}

export function marcarNotificado(chave) {
  estado.notificados[chave] = Date.now();
  // Limpa marcas com mais de 7 dias para o registro não crescer sem fim.
  const limite = Date.now() - 7 * 86400000;
  for (const k of Object.keys(estado.notificados)) {
    if (estado.notificados[k] < limite) delete estado.notificados[k];
  }
  salvarSilencioso();
}

export function jaNotificado(chave) {
  return Boolean(estado.notificados[chave]);
}

export const COMPETENCIA_ATUAL = competenciaDe();
