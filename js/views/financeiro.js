// Painel financeiro: salários, receitas, despesas avulsas, categorias e evolução.
import { obter, inserir, atualizar, remover, buscar, marcarRecebido, desmarcarRecebido, nomePessoa, CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '../store.js';
import { abrirFormulario, confirmar, aviso, vazio, etiqueta, barraProgresso, cartaoNumero, graficoBarras, sinalizar } from '../ui.js';
import { icone } from '../icones.js';
import { esc, fmtMoney, fmtDataCurta, hojeISO, competenciaDe, labelCompetencia, labelCompetenciaCurta, addMeses } from '../util.js';
import { resumoMes, historico, statusOrcamento } from '../financas.js';

export const titulo = 'Financeiro';
export const chaveIcone = 'grafico';

let comp = competenciaDe();
let aba = 'resumo';

/* ---------- Rendas (salário) ---------- */

async function novaRenda() {
  const v = await abrirFormulario({
    titulo: 'Nova renda',
    campos: [
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Salário' },
      { nome: 'valor', rotulo: 'Valor líquido', tipo: 'dinheiro', obrigatorio: true, largura: 'metade' },
      { nome: 'pessoa', rotulo: 'De quem', tipo: 'pessoa', largura: 'metade' },
      { nome: 'tipo', rotulo: 'Frequência', tipo: 'selecao', largura: 'metade',
        opcoes: [{ valor: 'mensal', texto: 'Todo mês' }, { valor: 'unica', texto: 'Uma vez só' }] },
      { nome: 'diaRecebimento', rotulo: 'Dia do recebimento', tipo: 'numero', min: 1, max: 31, largura: 'metade' },
      { nome: 'dataUnica', rotulo: 'Data (se for única)', tipo: 'data', largura: 'metade' },
      { nome: 'categoria', rotulo: 'Categoria', tipo: 'selecao', opcoes: CATEGORIAS_RECEITA, largura: 'metade' },
      { nome: 'inicioEm', rotulo: 'A partir de', tipo: 'data', dica: 'Opcional' }
    ],
    valores: { tipo: 'mensal', diaRecebimento: 5, categoria: 'Salário', dataUnica: hojeISO(), inicioEm: hojeISO() },
    aoValidar: (v) => {
      if (v.tipo === 'mensal' && !v.diaRecebimento) return 'Informe o dia do recebimento.';
      if (v.tipo === 'unica' && !v.dataUnica) return 'Informe a data do recebimento.';
      return null;
    }
  });
  if (!v) return;
  inserir('rendas', v);
  aviso('Renda cadastrada.');
}

async function editarRenda(id) {
  const r = buscar('rendas', id);
  if (!r) return;
  const v = await abrirFormulario({
    titulo: 'Editar renda',
    campos: [
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true },
      { nome: 'valor', rotulo: 'Valor líquido', tipo: 'dinheiro', obrigatorio: true, largura: 'metade' },
      { nome: 'pessoa', rotulo: 'De quem', tipo: 'pessoa', largura: 'metade' },
      { nome: 'tipo', rotulo: 'Frequência', tipo: 'selecao', largura: 'metade',
        opcoes: [{ valor: 'mensal', texto: 'Todo mês' }, { valor: 'unica', texto: 'Uma vez só' }] },
      { nome: 'diaRecebimento', rotulo: 'Dia do recebimento', tipo: 'numero', min: 1, max: 31, largura: 'metade' },
      { nome: 'dataUnica', rotulo: 'Data (se for única)', tipo: 'data', largura: 'metade' },
      { nome: 'categoria', rotulo: 'Categoria', tipo: 'selecao', opcoes: CATEGORIAS_RECEITA, largura: 'metade' }
    ],
    valores: r
  });
  if (!v) return;
  atualizar('rendas', id, v);
  aviso('Renda atualizada.');
}

async function receber(id) {
  const r = buscar('rendas', id);
  if (!r) return;
  const v = await abrirFormulario({
    titulo: `Receber ${r.descricao}`,
    campos: [
      { nome: 'valorRecebido', rotulo: 'Valor recebido', tipo: 'dinheiro', obrigatorio: true, largura: 'metade',
        dica: `Previsto: ${fmtMoney(r.valor)}` },
      { nome: 'dataRecebimento', rotulo: 'Data', tipo: 'data', obrigatorio: true, largura: 'metade' }
    ],
    valores: { valorRecebido: r.valor, dataRecebimento: hojeISO() },
    textoOk: 'Confirmar'
  });
  if (!v) return;
  marcarRecebido(id, comp, v);
  aviso('Recebimento registrado. ✓');
  sinalizar('salario');
}

/* ---------- Transações avulsas ---------- */

async function novaTransacao(tipo) {
  const v = await abrirFormulario({
    titulo: tipo === 'receita' ? 'Nova receita' : 'Novo gasto',
    campos: [
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true,
        placeholder: tipo === 'receita' ? 'Ex.: Venda de um móvel' : 'Ex.: Almoço, gasolina' },
      { nome: 'valor', rotulo: 'Valor', tipo: 'dinheiro', obrigatorio: true, largura: 'metade' },
      { nome: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true, largura: 'metade' },
      { nome: 'categoria', rotulo: 'Categoria', tipo: 'selecao', largura: 'metade',
        opcoes: tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA },
      { nome: 'pessoa', rotulo: 'Quem', tipo: 'pessoa', largura: 'metade' }
    ],
    valores: { data: hojeISO(), categoria: tipo === 'receita' ? 'Outros' : 'Alimentação' }
  });
  if (!v) return;
  inserir('transacoes', { ...v, tipo, origem: 'manual' });
  aviso(tipo === 'receita' ? 'Receita lançada.' : 'Gasto lançado.');
  sinalizar(tipo === 'receita' ? 'receita' : 'gasto');
}

async function definirOrcamento() {
  const d = obter();
  const v = await abrirFormulario({
    titulo: 'Limite de gasto por categoria',
    campos: [
      { nome: 'categoria', rotulo: 'Categoria', tipo: 'selecao', opcoes: CATEGORIAS_DESPESA, obrigatorio: true },
      { nome: 'limite', rotulo: 'Limite por mês', tipo: 'dinheiro', obrigatorio: true }
    ],
    valores: { categoria: 'Mercado' },
    textoOk: 'Definir'
  });
  if (!v) return;
  const existente = d.orcamentos.find((o) => o.categoria === v.categoria);
  if (existente) atualizar('orcamentos', existente.id, { limite: v.limite });
  else inserir('orcamentos', v);
  aviso('Limite definido.');
}

/* ---------- Blocos de tela ---------- */

function blocoResumo(r) {
  const positivo = r.saldoRealizado >= 0;
  const serie = historico(6, comp);
  const maxCat = r.categorias[0]?.valor || 1;

  return `
    <div class="metricas metricas--3">
      ${cartaoNumero({ rotulo: 'Entrou', valor: fmtMoney(r.receitaRealizada), cor: 'ok', icone: '↓',
        sub: r.receitaPrevista !== r.receitaRealizada ? `previsto ${fmtMoney(r.receitaPrevista)}` : '' })}
      ${cartaoNumero({ rotulo: 'Saiu', valor: fmtMoney(r.despesaRealizada), cor: 'perigo', icone: '↑',
        sub: r.despesaPrevista !== r.despesaRealizada ? `previsto ${fmtMoney(r.despesaPrevista)}` : '' })}
      ${cartaoNumero({ rotulo: 'Sobrou', valor: fmtMoney(r.saldoRealizado), cor: positivo ? 'ok' : 'perigo',
        icone: positivo ? '✓' : '!', sub: `projeção ${fmtMoney(r.saldoPrevisto)}` })}
    </div>

    ${r.qtdAPagar > 0 ? `<div class="alerta ${r.qtdAtrasadas ? 'alerta--perigo' : 'alerta--atencao'}">
      <strong>${r.qtdAPagar} conta${r.qtdAPagar > 1 ? 's' : ''} em aberto</strong>
      <span>${fmtMoney(r.faltaPagar)} ainda para pagar neste mês.</span>
    </div>` : ''}

    <section class="painel">
      <div class="painel__topo"><h3>Evolução dos últimos 6 meses</h3></div>
      <div class="legenda">
        <span><i style="background:var(--cor-ok)"></i> Entrou</span>
        <span><i style="background:var(--cor-perigo)"></i> Saiu</span>
      </div>
      ${graficoBarras(serie.map((s) => ({
        rotulo: labelCompetenciaCurta(s.comp),
        barras: [
          { valor: s.receita, cor: 'var(--cor-ok)', nome: 'entrou' },
          { valor: s.despesa, cor: 'var(--cor-perigo)', nome: 'saiu' }
        ]
      })), { altura: 140, formatar: fmtMoney })}
    </section>

    <section class="painel">
      <div class="painel__topo"><h3>Para onde foi o dinheiro</h3></div>
      ${r.categorias.length ? r.categorias.map((c) => `
        <div class="linha-categoria">
          <div class="linha-categoria__topo">
            <span>${esc(c.categoria)}</span>
            <strong>${fmtMoney(c.valor)}</strong>
          </div>
          ${barraProgresso((c.valor / maxCat) * 100, 'primario')}
        </div>`).join('')
        : '<p class="texto-suave">Nenhum gasto registrado neste mês ainda.</p>'}
    </section>`;
}

function blocoRendas(r) {
  return `
    <section class="painel">
      <div class="painel__topo">
        <h3>Salários e rendas</h3>
        <button class="botao botao--suave botao--pequeno" data-acao="nova-renda">+ Nova</button>
      </div>
      ${r.rendas.length ? r.rendas.map((x) => `
        <article class="item item--compacto">
          <button class="item__check ${x.recebimento ? 'is-marcado' : ''}" data-alternar-renda="${x.renda.id}"
            aria-label="Marcar como recebido">${x.recebimento ? '✓' : ''}</button>
          <div class="item__conteudo" data-editar-renda="${x.renda.id}">
            <div class="item__linha1">
              <strong>${esc(x.renda.descricao)}</strong>
              <span class="item__valor item__valor--ok">${fmtMoney(x.valorEfetivo)}</span>
            </div>
            <div class="item__linha2">
              ${etiqueta(x.recebimento ? 'Recebido' : (x.faltam <= 0 ? 'Pendente' : `Cai dia ${x.data.slice(-2)}`),
                x.recebimento ? 'ok' : (x.faltam <= 0 ? 'atencao' : 'neutro'))}
              ${x.renda.pessoa ? etiqueta(nomePessoa(x.renda.pessoa), 'pessoa') : ''}
            </div>
          </div>
          <button class="botao-icone" data-excluir-renda="${x.renda.id}" aria-label="Excluir">${icone('lixo', 16)}</button>
        </article>`).join('')
        : vazio(icone('dinheiro', 40), 'Nenhuma renda cadastrada',
            'Cadastre os salários de vocês dois para o app calcular quanto sobra no mês.',
            { acao: 'nova-renda', texto: '+ Cadastrar salário' })}
    </section>`;
}

function blocoMovimentos(r) {
  return `
    <div class="linha-botoes linha-botoes--largo">
      <button class="botao botao--ok" data-acao="nova-receita">+ Receita</button>
      <button class="botao botao--perigo-suave" data-acao="nova-despesa">+ Gasto</button>
    </div>
    <section class="painel">
      <div class="painel__topo"><h3>Movimentos do mês</h3>
        <span class="painel__contador">${r.transacoes.length}</span></div>
      ${r.transacoes.length ? r.transacoes.map((t) => `
        <article class="item item--compacto">
          <span class="item__bolinha item__bolinha--${t.tipo}"></span>
          <div class="item__conteudo">
            <div class="item__linha1">
              <strong>${esc(t.descricao)}</strong>
              <span class="item__valor item__valor--${t.tipo === 'receita' ? 'ok' : 'perigo'}">
                ${t.tipo === 'receita' ? '+' : '−'} ${fmtMoney(t.valor)}</span>
            </div>
            <div class="item__linha2">
              <span class="item__meta">${fmtDataCurta(t.data)}</span>
              ${t.categoria ? etiqueta(t.categoria, 'suave') : ''}
              ${t.pessoa ? etiqueta(nomePessoa(t.pessoa), 'pessoa') : ''}
              ${t.origem && t.origem !== 'manual' ? `<span class="item__meta">auto</span>` : ''}
            </div>
          </div>
          <button class="botao-icone" data-excluir-transacao="${t.id}" aria-label="Excluir">${icone('lixo', 16)}</button>
        </article>`).join('')
        : '<p class="texto-suave">Nenhum movimento avulso neste mês.</p>'}
    </section>`;
}

function blocoOrcamento() {
  const lista = statusOrcamento(comp);
  return `
    <section class="painel">
      <div class="painel__topo">
        <h3>Limites de gasto</h3>
        <button class="botao botao--suave botao--pequeno" data-acao="orcamento">+ Definir</button>
      </div>
      ${lista.length ? lista.map((o) => {
        const cor = o.percentual >= 100 ? 'perigo' : (o.percentual >= 80 ? 'atencao' : 'ok');
        return `<div class="linha-categoria">
          <div class="linha-categoria__topo">
            <span>${esc(o.categoria)}</span>
            <strong class="texto-${cor}">${fmtMoney(o.usado)} / ${fmtMoney(o.limite)}</strong>
          </div>
          ${barraProgresso(o.percentual, cor)}
          <small class="texto-suave">${o.restante >= 0
            ? `Ainda pode gastar ${fmtMoney(o.restante)}`
            : `Passou ${fmtMoney(Math.abs(o.restante))} do limite`}</small>
          <button class="botao-icone linha-categoria__x" data-excluir-orcamento="${o.id}" aria-label="Remover limite">${icone('lixo', 16)}</button>
        </div>`;
      }).join('')
        : '<p class="texto-suave">Defina um limite mensal por categoria (ex.: R$ 800 de mercado) e acompanhe quanto já foi.</p>'}
    </section>`;
}

export function render(raiz) {
  const r = resumoMes(comp);

  raiz.innerHTML = `
    <div class="seletor-mes">
      <button class="botao-icone" data-mes="-1" aria-label="Mês anterior">‹</button>
      <strong>${labelCompetencia(comp)}</strong>
      <button class="botao-icone" data-mes="1" aria-label="Próximo mês">›</button>
    </div>
    <div class="abas">
      ${[['resumo', 'Resumo'], ['rendas', 'Rendas'], ['movimentos', 'Movimentos'], ['limites', 'Limites']]
        .map(([v, t]) => `<button class="aba ${aba === v ? 'is-ativa' : ''}" data-aba="${v}">${t}</button>`).join('')}
    </div>
    ${aba === 'resumo' ? blocoResumo(r)
      : aba === 'rendas' ? blocoRendas(r)
      : aba === 'movimentos' ? blocoMovimentos(r)
      : blocoOrcamento()}`;

  raiz.onclick = (e) => {
    const m = e.target.closest('[data-mes]');
    if (m) { comp = addMeses(comp, Number(m.dataset.mes)); render(raiz); return; }
    const a = e.target.closest('[data-aba]');
    if (a) { aba = a.dataset.aba; render(raiz); return; }
    if (e.target.closest('[data-acao="nova-renda"]')) { novaRenda(); return; }
    if (e.target.closest('[data-acao="nova-receita"]')) { novaTransacao('receita'); return; }
    if (e.target.closest('[data-acao="nova-despesa"]')) { novaTransacao('despesa'); return; }
    if (e.target.closest('[data-acao="orcamento"]')) { definirOrcamento(); return; }

    const ar = e.target.closest('[data-alternar-renda]');
    if (ar) {
      const id = ar.dataset.alternarRenda;
      const linha = r.rendas.find((x) => x.renda.id === id);
      if (linha?.recebimento) { desmarcarRecebido(id, comp); aviso('Recebimento desfeito.'); }
      else receber(id);
      return;
    }
    const er = e.target.closest('[data-editar-renda]');
    if (er) { editarRenda(er.dataset.editarRenda); return; }
    const xr = e.target.closest('[data-excluir-renda]');
    if (xr) {
      confirmar({ titulo: 'Excluir renda', mensagem: 'Excluir esta renda e o histórico de recebimentos?', textoOk: 'Excluir', perigo: true })
        .then((ok) => {
          if (!ok) return;
          const id = xr.dataset.excluirRenda;
          obter().recebimentos.filter((x) => x.rendaId === id).forEach((x) => remover('recebimentos', x.id));
          remover('rendas', id);
          aviso('Renda excluída.');
        });
      return;
    }
    const xt = e.target.closest('[data-excluir-transacao]');
    if (xt) { remover('transacoes', xt.dataset.excluirTransacao); aviso('Movimento excluído.'); return; }
    const xo = e.target.closest('[data-excluir-orcamento]');
    if (xo) { remover('orcamentos', xo.dataset.excluirOrcamento); aviso('Limite removido.'); }
  };
}

export { novaTransacao, novaRenda };
