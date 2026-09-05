// Cálculos do painel financeiro. Uma única fonte de verdade para o mês.
import { obter, contasDaCompetencia, pagamentoDe, rendasDaCompetencia, recebimentoDe } from './store.js';
import { vencimentoNaCompetencia, competenciaDoISO, hojeISO, diasEntre, addMeses, competenciaDe } from './util.js';

// Situação de uma conta dentro de um mês.
export function situacaoConta(conta, comp, hoje = hojeISO()) {
  const pagamento = pagamentoDe(conta.id, comp);
  const vencimento = conta.tipo === 'unica'
    ? conta.dataUnica
    : vencimentoNaCompetencia(comp, conta.diaVencimento);
  const faltam = diasEntre(hoje, vencimento);
  let estado = 'aberta';
  if (pagamento) estado = 'paga';
  else if (faltam < 0) estado = 'atrasada';
  else if (faltam === 0) estado = 'vence-hoje';
  else if (faltam <= 5) estado = 'proxima';
  return { pagamento, vencimento, faltam, estado, valorEfetivo: pagamento?.valorPago ?? conta.valor };
}

export function situacaoRenda(renda, comp, hoje = hojeISO()) {
  const recebimento = recebimentoDe(renda.id, comp);
  const data = renda.tipo === 'unica'
    ? renda.dataUnica
    : vencimentoNaCompetencia(comp, renda.diaRecebimento);
  const faltam = diasEntre(hoje, data);
  const estado = recebimento ? 'recebida' : (faltam <= 0 ? 'pendente' : 'aguardando');
  return { recebimento, data, faltam, estado, valorEfetivo: recebimento?.valorRecebido ?? renda.valor };
}

export function resumoMes(comp) {
  const d = obter();
  const hoje = hojeISO();

  const contas = contasDaCompetencia(comp)
    .map((c) => ({ conta: c, ...situacaoConta(c, comp, hoje) }))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  const rendas = rendasDaCompetencia(comp)
    .map((r) => ({ renda: r, ...situacaoRenda(r, comp, hoje) }))
    .sort((a, b) => a.data.localeCompare(b.data));

  const transacoes = d.transacoes
    .filter((t) => competenciaDoISO(t.data) === comp)
    .sort((a, b) => b.data.localeCompare(a.data));

  const somar = (lista, campo) => lista.reduce((t, x) => t + (Number(x[campo]) || 0), 0);

  const despesaContasPrevista = contas.reduce((t, c) => t + (Number(c.conta.valor) || 0), 0);
  const despesaContasPaga = contas.filter((c) => c.pagamento).reduce((t, c) => t + c.valorEfetivo, 0);
  const despesaAvulsa = somar(transacoes.filter((t) => t.tipo === 'despesa'), 'valor');

  const receitaRendasPrevista = rendas.reduce((t, r) => t + (Number(r.renda.valor) || 0), 0);
  const receitaRendasRecebida = rendas.filter((r) => r.recebimento).reduce((t, r) => t + r.valorEfetivo, 0);
  const receitaAvulsa = somar(transacoes.filter((t) => t.tipo === 'receita'), 'valor');

  const despesaPrevista = despesaContasPrevista + despesaAvulsa;
  const despesaRealizada = despesaContasPaga + despesaAvulsa;
  const receitaPrevista = receitaRendasPrevista + receitaAvulsa;
  const receitaRealizada = receitaRendasRecebida + receitaAvulsa;

  // Gasto por categoria (contas pagas + despesas avulsas)
  const porCategoria = {};
  for (const c of contas) {
    if (!c.pagamento) continue;
    const cat = c.conta.categoria || 'Outros';
    porCategoria[cat] = (porCategoria[cat] || 0) + c.valorEfetivo;
  }
  for (const t of transacoes) {
    if (t.tipo !== 'despesa') continue;
    const cat = t.categoria || 'Outros';
    porCategoria[cat] = (porCategoria[cat] || 0) + (Number(t.valor) || 0);
  }
  const categorias = Object.entries(porCategoria)
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);

  const aPagar = contas.filter((c) => !c.pagamento);
  const atrasadas = contas.filter((c) => c.estado === 'atrasada');

  return {
    comp, contas, rendas, transacoes, categorias,
    despesaPrevista, despesaRealizada, despesaContasPrevista, despesaContasPaga, despesaAvulsa,
    receitaPrevista, receitaRealizada, receitaRendasPrevista, receitaRendasRecebida, receitaAvulsa,
    saldoPrevisto: receitaPrevista - despesaPrevista,
    saldoRealizado: receitaRealizada - despesaRealizada,
    faltaPagar: aPagar.reduce((t, c) => t + (Number(c.conta.valor) || 0), 0),
    qtdAPagar: aPagar.length,
    qtdAtrasadas: atrasadas.length,
    valorAtrasado: atrasadas.reduce((t, c) => t + (Number(c.conta.valor) || 0), 0),
    percentualPago: despesaContasPrevista > 0
      ? Math.round((despesaContasPaga / despesaContasPrevista) * 100) : 100
  };
}

// Série dos últimos N meses, para o gráfico de evolução.
export function historico(meses = 6, ate = competenciaDe()) {
  const saida = [];
  for (let i = meses - 1; i >= 0; i--) {
    const comp = addMeses(ate, -i);
    const r = resumoMes(comp);
    saida.push({ comp, receita: r.receitaRealizada, despesa: r.despesaRealizada, saldo: r.saldoRealizado });
  }
  return saida;
}

// Orçamento por categoria: quanto já foi usado do limite definido.
export function statusOrcamento(comp) {
  const d = obter();
  const { categorias } = resumoMes(comp);
  const gasto = Object.fromEntries(categorias.map((c) => [c.categoria, c.valor]));
  return d.orcamentos.map((o) => {
    const usado = gasto[o.categoria] || 0;
    const limite = Number(o.limite) || 0;
    return {
      ...o, usado, limite,
      percentual: limite > 0 ? Math.round((usado / limite) * 100) : 0,
      restante: limite - usado
    };
  }).sort((a, b) => b.percentual - a.percentual);
}

export function totalGastoMercado(comp) {
  return obter().compras
    .filter((c) => competenciaDoISO(c.data) === comp)
    .reduce((t, c) => t + (Number(c.total) || 0), 0);
}
