// Mercado: lista de compras compartilhada, com preço estimado e histórico.
import { obter, inserir, atualizar, remover, buscar, alterar, nomePessoa, CATEGORIAS_MERCADO } from '../store.js';
import { abrirFormulario, confirmar, aviso, vazio } from '../ui.js';
import { icone } from '../icones.js';
import { esc, fmtMoney, hojeISO, fmtData, competenciaDe, competenciaDoISO } from '../util.js';

export const titulo = 'Mercado';
export const chaveIcone = 'carrinho';

const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'pacote', 'caixa', 'dúzia', 'fardo'];
let aba = 'lista';

function campos() {
  return [
    { nome: 'nome', rotulo: 'Item', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Arroz 5kg' },
    { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'numero', min: 0, passo: 0.5, largura: 'metade' },
    { nome: 'unidade', rotulo: 'Unidade', tipo: 'selecao', opcoes: UNIDADES, largura: 'metade' },
    { nome: 'categoria', rotulo: 'Categoria', tipo: 'selecao', opcoes: CATEGORIAS_MERCADO, largura: 'metade' },
    { nome: 'precoEstimado', rotulo: 'Preço estimado', tipo: 'dinheiro', largura: 'metade' },
    { nome: 'recorrente', rotulo: 'Item que compramos sempre', tipo: 'booleano',
      dica: 'Volta para a lista automaticamente depois de finalizar a compra' },
    { nome: 'obs', rotulo: 'Observação', tipo: 'texto', placeholder: 'Ex.: da marca X' }
  ];
}

async function novoItem() {
  const v = await abrirFormulario({
    titulo: 'Adicionar à lista',
    campos: campos(),
    valores: { quantidade: 1, unidade: 'un', categoria: 'Mercearia', recorrente: false }
  });
  if (!v) return;
  inserir('mercado', { ...v, comprado: false });
  aviso('Item adicionado à lista.');
}

// Entrada rápida: digita e dá enter, sem abrir modal.
function adicionarRapido(texto) {
  const nome = texto.trim();
  if (!nome) return;
  inserir('mercado', {
    nome, quantidade: 1, unidade: 'un', categoria: 'Mercearia',
    precoEstimado: 0, comprado: false, recorrente: false
  });
}

async function editarItem(id) {
  const item = buscar('mercado', id);
  if (!item) return;
  const v = await abrirFormulario({ titulo: 'Editar item', campos: campos(), valores: item });
  if (!v) return;
  atualizar('mercado', id, v);
}

function alternarComprado(id) {
  const item = buscar('mercado', id);
  if (item) atualizar('mercado', id, { comprado: !item.comprado });
}

async function finalizarCompra() {
  const d = obter();
  const comprados = d.mercado.filter((i) => i.comprado);
  if (!comprados.length) { aviso('Marque os itens que você comprou primeiro.', 'atencao'); return; }

  const estimado = comprados.reduce((t, i) => t + (Number(i.precoEstimado) || 0) * (Number(i.quantidade) || 1), 0);
  const v = await abrirFormulario({
    titulo: 'Finalizar compra',
    campos: [
      { nome: 'total', rotulo: 'Total que você pagou', tipo: 'dinheiro', obrigatorio: true,
        dica: `Estimado pela lista: ${fmtMoney(estimado)}` },
      { nome: 'mercado', rotulo: 'Onde comprou', tipo: 'texto', placeholder: 'Ex.: Supermercado do bairro' },
      { nome: 'data', rotulo: 'Data da compra', tipo: 'data', obrigatorio: true, largura: 'metade' },
      { nome: 'pessoa', rotulo: 'Quem comprou', tipo: 'pessoa', largura: 'metade' },
      { nome: 'lancarFinanceiro', rotulo: 'Lançar no financeiro como despesa', tipo: 'booleano' }
    ],
    valores: { total: estimado || '', data: hojeISO(), lancarFinanceiro: true },
    textoOk: 'Finalizar'
  });
  if (!v) return;

  inserir('compras', {
    data: v.data, mercado: v.mercado, total: v.total, pessoa: v.pessoa,
    itens: comprados.map((i) => ({
      nome: i.nome, quantidade: i.quantidade, unidade: i.unidade,
      categoria: i.categoria, precoEstimado: i.precoEstimado
    }))
  });

  if (v.lancarFinanceiro && v.total > 0) {
    inserir('transacoes', {
      tipo: 'despesa',
      descricao: `Mercado${v.mercado ? ` — ${v.mercado}` : ''}`,
      valor: v.total, data: v.data, categoria: 'Mercado',
      pessoa: v.pessoa || '', origem: 'mercado'
    });
  }

  // Recorrentes voltam desmarcados; os demais saem da lista.
  alterar((dados) => {
    dados.mercado = dados.mercado
      .filter((i) => !i.comprado || i.recorrente)
      .map((i) => (i.comprado ? { ...i, comprado: false } : i));
  });

  aviso(`Compra de ${fmtMoney(v.total)} registrada.`);
}

function render_lista(d) {
  const itens = d.mercado;
  const pendentes = itens.filter((i) => !i.comprado);
  const comprados = itens.filter((i) => i.comprado);
  const estimadoTotal = itens.reduce((t, i) => t + (Number(i.precoEstimado) || 0) * (Number(i.quantidade) || 1), 0);
  const estimadoCarrinho = comprados.reduce((t, i) => t + (Number(i.precoEstimado) || 0) * (Number(i.quantidade) || 1), 0);

  const porCategoria = {};
  for (const i of pendentes) (porCategoria[i.categoria || 'Outros'] ||= []).push(i);

  const linha = (i) => `<article class="item item--compacto ${i.comprado ? 'item--feito' : ''}">
    <button class="item__check" data-marcar="${i.id}" aria-label="Marcar como comprado">${i.comprado ? '✓' : ''}</button>
    <div class="item__conteudo" data-editar="${i.id}">
      <div class="item__linha1">
        <strong>${esc(i.nome)}</strong>
        ${Number(i.precoEstimado) > 0
          ? `<span class="item__valor">${fmtMoney(Number(i.precoEstimado) * (Number(i.quantidade) || 1))}</span>` : ''}
      </div>
      <div class="item__linha2">
        <span class="item__meta">${esc(String(i.quantidade || 1))} ${esc(i.unidade || 'un')}</span>
        ${i.recorrente ? `<span class="item__meta item__meta--icone">${icone('repetir', 13)}sempre</span>` : ''}
        ${i.obs ? `<span class="item__meta">${esc(i.obs)}</span>` : ''}
      </div>
    </div>
    <button class="botao-icone item__excluir" data-excluir="${i.id}" aria-label="Remover">${icone('lixo', 16)}</button>
  </article>`;

  return `
    <form class="entrada-rapida" id="form-rapido">
      <input type="text" class="entrada" id="campo-rapido" placeholder="Digite um item e aperte Enter…" autocomplete="off">
      <button type="submit" class="botao botao--primario botao--pequeno">Add</button>
    </form>

    ${itens.length ? `
      <div class="resumo-linha">
        <span>${pendentes.length} para comprar · ${comprados.length} no carrinho</span>
        <strong>${fmtMoney(estimadoTotal)}</strong>
      </div>` : ''}

    ${pendentes.length === 0 && comprados.length === 0
      ? vazio(icone('carrinho', 40), 'Lista vazia', 'Adicione o que está faltando em casa. Vocês dois veem a mesma lista.',
          { acao: 'novo', texto: '+ Adicionar item' })
      : ''}

    ${Object.entries(porCategoria).sort().map(([cat, lista]) => `
      <section class="grupo-dia">
        <h3 class="grupo-dia__titulo">${esc(cat)} <span class="grupo-dia__data">${lista.length}</span></h3>
        ${lista.map(linha).join('')}
      </section>`).join('')}

    ${comprados.length ? `
      <section class="grupo-dia">
        <h3 class="grupo-dia__titulo">No carrinho <span class="grupo-dia__data">${fmtMoney(estimadoCarrinho)}</span></h3>
        ${comprados.map(linha).join('')}
        <button class="botao botao--primario botao--largo" data-acao="finalizar">✓ Finalizar compra</button>
      </section>` : ''}`;
}

function render_historico(d) {
  const compras = [...d.compras].sort((a, b) => b.data.localeCompare(a.data));
  if (!compras.length) {
    return vazio(icone('caixa', 40), 'Sem compras registradas', 'Quando você finalizar uma compra, ela aparece aqui com o valor gasto.');
  }
  const mesAtual = competenciaDe();
  const gastoMes = compras.filter((c) => competenciaDoISO(c.data) === mesAtual)
    .reduce((t, c) => t + (Number(c.total) || 0), 0);
  const media = compras.reduce((t, c) => t + (Number(c.total) || 0), 0) / compras.length;

  return `
    <div class="metricas metricas--2">
      <div class="metrica metrica--neutro">
        <div class="metrica__topo"><span class="metrica__rotulo">Gasto este mês</span></div>
        <strong class="metrica__valor">${fmtMoney(gastoMes)}</strong>
      </div>
      <div class="metrica metrica--neutro">
        <div class="metrica__topo"><span class="metrica__rotulo">Média por compra</span></div>
        <strong class="metrica__valor">${fmtMoney(media)}</strong>
      </div>
    </div>
    ${compras.map((c) => `
      <article class="cartao">
        <div class="cartao__topo">
          <div>
            <strong class="cartao__titulo">${esc(c.mercado || 'Compra de mercado')}</strong>
            <span class="cartao__sub">${fmtData(c.data)}${c.pessoa ? ` · ${esc(nomePessoa(c.pessoa))}` : ''}</span>
          </div>
          <strong class="cartao__valor">${fmtMoney(c.total)}</strong>
        </div>
        <p class="cartao__nota">${esc((c.itens || []).map((i) => i.nome).join(', ')) || 'Sem itens detalhados'}</p>
        <button class="botao botao--suave botao--pequeno" data-excluir-compra="${c.id}">Excluir registro</button>
      </article>`).join('')}`;
}

export function render(raiz) {
  const d = obter();
  raiz.innerHTML = `
    <div class="abas">
      <button class="aba ${aba === 'lista' ? 'is-ativa' : ''}" data-aba="lista">Lista</button>
      <button class="aba ${aba === 'historico' ? 'is-ativa' : ''}" data-aba="historico">Histórico</button>
    </div>
    ${aba === 'lista' ? render_lista(d) : render_historico(d)}
    ${aba === 'lista' ? '<button class="botao-flutuante" data-acao="novo" aria-label="Novo item">+</button>' : ''}`;

  const form = raiz.querySelector('#form-rapido');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const campo = raiz.querySelector('#campo-rapido');
      const valor = campo.value;
      if (!valor.trim()) return;
      adicionarRapido(valor);
      campo.value = '';
      campo.focus();
    };
  }

  raiz.onclick = (e) => {
    const a = e.target.closest('[data-aba]');
    if (a) { aba = a.dataset.aba; render(raiz); return; }
    if (e.target.closest('[data-acao="novo"]')) { novoItem(); return; }
    if (e.target.closest('[data-acao="finalizar"]')) { finalizarCompra(); return; }
    const m = e.target.closest('[data-marcar]');
    if (m) { alternarComprado(m.dataset.marcar); return; }
    const ed = e.target.closest('[data-editar]');
    if (ed) { editarItem(ed.dataset.editar); return; }
    const x = e.target.closest('[data-excluir]');
    if (x) { remover('mercado', x.dataset.excluir); return; }
    const xc = e.target.closest('[data-excluir-compra]');
    if (xc) {
      confirmar({ titulo: 'Excluir registro', mensagem: 'Excluir este registro de compra do histórico?', textoOk: 'Excluir', perigo: true })
        .then((ok) => { if (ok) { remover('compras', xc.dataset.excluirCompra); aviso('Registro excluído.'); } });
    }
  };
}

export { novoItem };
