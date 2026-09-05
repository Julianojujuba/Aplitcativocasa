// Contas a pagar: fixas mensais e avulsas, com vencimento, baixa e histórico por mês.
import { obter, inserir, atualizar, remover, buscar, marcarPago, desmarcarPago, nomePessoa, CATEGORIAS_DESPESA } from '../store.js';
import { abrirFormulario, confirmar, aviso, vazio, etiqueta, barraProgresso, cartaoNumero, sinalizar } from '../ui.js';
import { icone } from '../icones.js';
import { esc, fmtMoney, fmtData, fmtDataCurta, hojeISO, competenciaDe, labelCompetencia, addMeses } from '../util.js';
import { resumoMes } from '../financas.js';

export const titulo = 'Contas';
export const chaveIcone = 'cartao';

let comp = competenciaDe();
let filtro = 'todas';

function campos(tipo) {
  const base = [
    { nome: 'descricao', rotulo: 'Nome da conta', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Luz, Aluguel, Internet' },
    { nome: 'valor', rotulo: 'Valor', tipo: 'dinheiro', obrigatorio: true, largura: 'metade' },
    { nome: 'categoria', rotulo: 'Categoria', tipo: 'selecao', opcoes: CATEGORIAS_DESPESA, largura: 'metade' },
    { nome: 'tipo', rotulo: 'Tipo', tipo: 'selecao', largura: 'metade',
      opcoes: [{ valor: 'mensal', texto: 'Todo mês (fixa)' }, { valor: 'unica', texto: 'Uma vez só' }] }
  ];
  if (tipo === 'unica') {
    base.push({ nome: 'dataUnica', rotulo: 'Vence em', tipo: 'data', obrigatorio: true, largura: 'metade' });
  } else {
    base.push({ nome: 'diaVencimento', rotulo: 'Dia do vencimento', tipo: 'numero', min: 1, max: 31,
      obrigatorio: true, largura: 'metade', dica: 'Dia do mês' });
  }
  base.push(
    { nome: 'pessoa', rotulo: 'Responsável', tipo: 'pessoa', largura: 'metade' },
    { nome: 'inicioEm', rotulo: 'A partir de', tipo: 'data', largura: 'metade', dica: 'Opcional' },
    { nome: 'obs', rotulo: 'Observações', tipo: 'textoLongo', placeholder: 'Ex.: débito automático no banco X' }
  );
  return base;
}

// O tipo muda os campos, então perguntamos o tipo primeiro.
async function novaConta() {
  const escolha = await abrirFormulario({
    titulo: 'Nova conta',
    campos: [{ nome: 'tipo', rotulo: 'Essa conta se repete?', tipo: 'selecao',
      opcoes: [{ valor: 'mensal', texto: 'Sim, todo mês' }, { valor: 'unica', texto: 'Não, é uma vez só' }] }],
    valores: { tipo: 'mensal' },
    textoOk: 'Continuar'
  });
  if (!escolha) return;

  const hoje = new Date();
  const v = await abrirFormulario({
    titulo: escolha.tipo === 'mensal' ? 'Nova conta fixa' : 'Nova conta avulsa',
    campos: campos(escolha.tipo),
    valores: {
      tipo: escolha.tipo, categoria: 'Moradia',
      diaVencimento: hoje.getDate(), dataUnica: hojeISO(), inicioEm: hojeISO()
    }
  });
  if (!v) return;
  inserir('contas', v);
  aviso(escolha.tipo === 'mensal' ? 'Conta fixa cadastrada. Vai aparecer todo mês.' : 'Conta cadastrada.');
}

async function editarConta(id) {
  const c = buscar('contas', id);
  if (!c) return;
  const v = await abrirFormulario({ titulo: 'Editar conta', campos: campos(c.tipo), valores: c });
  if (!v) return;
  atualizar('contas', id, v);
  aviso('Conta atualizada.');
}

async function pagar(id) {
  const c = buscar('contas', id);
  if (!c) return;
  const v = await abrirFormulario({
    titulo: `Pagar ${c.descricao}`,
    campos: [
      { nome: 'valorPago', rotulo: 'Valor pago', tipo: 'dinheiro', obrigatorio: true, largura: 'metade',
        dica: `Previsto: ${fmtMoney(c.valor)}` },
      { nome: 'dataPagamento', rotulo: 'Data do pagamento', tipo: 'data', obrigatorio: true, largura: 'metade' }
    ],
    valores: { valorPago: c.valor, dataPagamento: hojeISO() },
    textoOk: 'Confirmar pagamento'
  });
  if (!v) return;
  marcarPago(id, comp, v);
  aviso(`${c.descricao} paga. ✓`);
  sinalizar('conta');
}

const CORES_ESTADO = { paga: 'ok', atrasada: 'perigo', 'vence-hoje': 'atencao', proxima: 'atencao', aberta: 'neutro' };
const TEXTO_ESTADO = { paga: 'Paga', atrasada: 'Atrasada', 'vence-hoje': 'Vence hoje', proxima: 'Chegando', aberta: 'Em aberto' };

function cartaoConta(linha) {
  const { conta: c, estado, vencimento, faltam, pagamento, valorEfetivo } = linha;
  return `<article class="item item--conta item--${estado}">
    <button class="item__check ${estado === 'paga' ? 'is-marcado' : ''}" data-alternar="${c.id}"
      aria-label="${estado === 'paga' ? 'Desfazer pagamento' : 'Marcar como paga'}">${estado === 'paga' ? '✓' : ''}</button>
    <div class="item__conteudo" data-editar="${c.id}">
      <div class="item__linha1">
        <strong>${esc(c.descricao)}</strong>
        <span class="item__valor ${estado === 'paga' ? 'is-pago' : ''}">${fmtMoney(valorEfetivo)}</span>
      </div>
      <div class="item__linha2">
        ${etiqueta(TEXTO_ESTADO[estado], CORES_ESTADO[estado])}
        <span class="item__meta">Vence ${fmtDataCurta(vencimento)}</span>
        ${estado !== 'paga' && faltam >= 0 && faltam <= 7
          ? `<span class="item__meta">${faltam === 0 ? 'hoje' : `em ${faltam}d`}</span>` : ''}
        ${estado === 'atrasada' ? `<span class="item__meta item__meta--perigo">${Math.abs(faltam)}d de atraso</span>` : ''}
        ${c.categoria ? etiqueta(c.categoria, 'suave') : ''}
        ${c.pessoa ? etiqueta(nomePessoa(c.pessoa), 'pessoa') : ''}
        ${c.tipo === 'mensal' ? `<span class="item__meta item__meta--icone">${icone('repetir', 13)}todo mês</span>` : ''}
      </div>
      ${pagamento ? `<small class="item__notas">Pago em ${fmtData(pagamento.dataPagamento)}</small>` : ''}
      ${c.obs ? `<p class="item__notas">${esc(c.obs)}</p>` : ''}
    </div>
    <div class="item__lado">
      ${estado !== 'paga' ? `<button class="botao botao--primario botao--pequeno" data-pagar="${c.id}">Pagar</button>` : ''}
      <button class="botao-icone" data-excluir="${c.id}" aria-label="Excluir">${icone('lixo', 16)}</button>
    </div>
  </article>`;
}

export function render(raiz) {
  const r = resumoMes(comp);
  let linhas = r.contas;
  if (filtro === 'abertas') linhas = linhas.filter((c) => c.estado !== 'paga');
  else if (filtro === 'pagas') linhas = linhas.filter((c) => c.estado === 'paga');
  else if (filtro === 'atrasadas') linhas = linhas.filter((c) => c.estado === 'atrasada');

  raiz.innerHTML = `
    <div class="seletor-mes">
      <button class="botao-icone" data-mes="-1" aria-label="Mês anterior">‹</button>
      <strong>${labelCompetencia(comp)}</strong>
      <button class="botao-icone" data-mes="1" aria-label="Próximo mês">›</button>
    </div>

    <div class="metricas metricas--3">
      ${cartaoNumero({ rotulo: 'Total do mês', valor: fmtMoney(r.despesaContasPrevista), cor: 'neutro' })}
      ${cartaoNumero({ rotulo: 'Já pago', valor: fmtMoney(r.despesaContasPaga), cor: 'ok' })}
      ${cartaoNumero({ rotulo: 'Falta pagar', valor: fmtMoney(r.faltaPagar), cor: r.faltaPagar > 0 ? 'atencao' : 'ok' })}
    </div>

    <div class="progresso-rotulado">
      ${barraProgresso(r.percentualPago, r.percentualPago === 100 ? 'ok' : 'primario')}
      <small>${r.percentualPago}% das contas do mês já foram pagas</small>
    </div>

    ${r.qtdAtrasadas > 0 ? `<div class="alerta alerta--perigo">
      <strong class="alerta__titulo">${icone('aviso', 15)} ${r.qtdAtrasadas} conta${r.qtdAtrasadas > 1 ? 's' : ''} atrasada${r.qtdAtrasadas > 1 ? 's' : ''}</strong>
      <span>Total de ${fmtMoney(r.valorAtrasado)} em atraso.</span></div>` : ''}

    <div class="filtros">
      ${[['todas', 'Todas', r.contas.length], ['abertas', 'Em aberto', r.qtdAPagar],
         ['atrasadas', 'Atrasadas', r.qtdAtrasadas], ['pagas', 'Pagas', r.contas.length - r.qtdAPagar]]
        .map(([v, t, n]) => `<button class="filtro ${filtro === v ? 'is-ativo' : ''}" data-filtro="${v}">
          ${t}${n ? ` <span class="filtro__num">${n}</span>` : ''}</button>`).join('')}
    </div>

    ${linhas.length
      ? linhas.map(cartaoConta).join('')
      : vazio(icone('cartao', 40), r.contas.length ? 'Nada neste filtro' : 'Nenhuma conta cadastrada',
          r.contas.length ? 'Experimente outro filtro.'
            : 'Cadastre as contas da casa (luz, água, aluguel, internet) e o app avisa antes de cada vencimento.',
          r.contas.length ? null : { acao: 'nova', texto: '+ Cadastrar conta' })}

    <button class="botao-flutuante" data-acao="nova" aria-label="Nova conta">+</button>`;

  raiz.onclick = (e) => {
    const m = e.target.closest('[data-mes]');
    if (m) { comp = addMeses(comp, Number(m.dataset.mes)); render(raiz); return; }
    const f = e.target.closest('[data-filtro]');
    if (f) { filtro = f.dataset.filtro; render(raiz); return; }
    if (e.target.closest('[data-acao="nova"]')) { novaConta(); return; }
    const p = e.target.closest('[data-pagar]');
    if (p) { pagar(p.dataset.pagar); return; }
    const alt = e.target.closest('[data-alternar]');
    if (alt) {
      const id = alt.dataset.alternar;
      const linha = r.contas.find((x) => x.conta.id === id);
      if (linha?.pagamento) { desmarcarPago(id, comp); aviso('Pagamento desfeito.'); }
      else pagar(id);
      return;
    }
    const ed = e.target.closest('[data-editar]');
    if (ed) { editarConta(ed.dataset.editar); return; }
    const x = e.target.closest('[data-excluir]');
    if (x) {
      const c = buscar('contas', x.dataset.excluir);
      confirmar({
        titulo: 'Excluir conta',
        mensagem: `Excluir "${c?.descricao}"? O histórico de pagamentos dela também será apagado.`,
        textoOk: 'Excluir', perigo: true
      }).then((ok) => {
        if (!ok) return;
        remover('contas', x.dataset.excluir);
        const d = obter();
        d.pagamentos.filter((pg) => pg.contaId === x.dataset.excluir).forEach((pg) => remover('pagamentos', pg.id));
        aviso('Conta excluída.');
      });
    }
  };
}

export { novaConta };
