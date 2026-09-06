// Agenda: compromissos da casa, com lembrete e repetição.
import { obter, inserir, atualizar, remover, buscar, nomePessoa, corPessoa, CATEGORIAS_EVENTO } from '../store.js';
import { abrirFormulario, confirmar, aviso, vazio, etiqueta, sinalizar } from '../ui.js';
import { icone } from '../icones.js';
import { esc, hojeISO, fmtData, fmtDataExtenso, isoParaData, diasEntre, dataParaISO, DIAS_SEMANA_LONGO } from '../util.js';

export const titulo = 'Agenda';
export const chaveIcone = 'agenda';

const REPETICOES = [
  { valor: 'nenhuma', texto: 'Não repete' },
  { valor: 'diaria', texto: 'Todo dia' },
  { valor: 'semanal', texto: 'Toda semana' },
  { valor: 'quinzenal', texto: 'A cada 15 dias' },
  { valor: 'mensal', texto: 'Todo mês' },
  { valor: 'anual', texto: 'Todo ano' }
];

export const LEMBRETES = [
  { valor: '0', texto: 'Na hora' },
  { valor: '15', texto: '15 minutos antes' },
  { valor: '30', texto: '30 minutos antes' },
  { valor: '60', texto: '1 hora antes' },
  { valor: '180', texto: '3 horas antes' },
  { valor: '1440', texto: '1 dia antes' },
  { valor: '-1', texto: 'Sem lembrete' }
];

let filtro = 'proximos';

function campos() {
  return [
    { nome: 'titulo', rotulo: 'O que é?', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Consulta com o dentista' },
    { nome: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true, largura: 'metade' },
    { nome: 'hora', rotulo: 'Hora', tipo: 'hora', largura: 'metade' },
    { nome: 'local', rotulo: 'Local', tipo: 'texto', placeholder: 'Opcional' },
    { nome: 'categoria', rotulo: 'Categoria', tipo: 'selecao', opcoes: CATEGORIAS_EVENTO, largura: 'metade' },
    { nome: 'pessoa', rotulo: 'De quem é', tipo: 'pessoa', largura: 'metade' },
    { nome: 'lembreteMin', rotulo: 'Avisar', tipo: 'selecao', opcoes: LEMBRETES, largura: 'metade' },
    { nome: 'repeticao', rotulo: 'Repetição', tipo: 'selecao', opcoes: REPETICOES, largura: 'metade' },
    { nome: 'notas', rotulo: 'Anotações', tipo: 'textoLongo', placeholder: 'Opcional' }
  ];
}

/*
  Entrada em lote: uma linha por compromisso. Serve para quem tem a agenda
  numa lista (ou no calendário do iPhone, que não dá para exportar) e não quer
  abrir um formulário por vez.

  Formatos aceitos por linha:
    10/09 14:00 Consulta com o dentista
    12/09 Comprar shampoo
    15/09 08:00 Academia semanal
    20/09 Aniversário da Ana anual
*/
const PALAVRAS_REPETICAO = {
  diaria: 'diaria', diária: 'diaria', diario: 'diaria', diário: 'diaria',
  semanal: 'semanal', quinzenal: 'quinzenal', mensal: 'mensal',
  anual: 'anual', aniversario: 'anual', aniversário: 'anual'
};

export function interpretarLinha(linha, hoje = hojeISO()) {
  const bruto = String(linha).trim();
  if (!bruto || bruto.startsWith('#')) return null;

  let resto = bruto;
  let repeticao = 'nenhuma';

  // A repetição, quando existe, é a última palavra da linha.
  const ultima = resto.split(/\s+/).pop().toLowerCase().replace(/[.,;]$/, '');
  if (PALAVRAS_REPETICAO[ultima]) {
    repeticao = PALAVRAS_REPETICAO[ultima];
    resto = resto.slice(0, resto.toLowerCase().lastIndexOf(ultima)).trim();
  }

  const mData = resto.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\s*/);
  if (!mData) return null;
  resto = resto.slice(mData[0].length);

  const dia = Number(mData[1]);
  const mes = Number(mData[2]);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;

  let ano = mData[3] ? Number(mData[3]) : Number(hoje.slice(0, 4));
  if (ano < 100) ano += 2000;

  const p = (n) => String(n).padStart(2, '0');
  let data = `${ano}-${p(mes)}-${p(dia)}`;
  // Sem ano escrito e já bem no passado: quem escreve isso quer o ano que vem.
  if (!mData[3] && diasEntre(hoje, data) < -180) {
    data = `${ano + 1}-${p(mes)}-${p(dia)}`;
  }
  if (!isoParaData(data) || isoParaData(data).getDate() !== dia) return null;

  let hora = '';
  const mHora = resto.match(/^(\d{1,2})[:h](\d{2})\s*/);
  if (mHora) {
    const h = Number(mHora[1]), mi = Number(mHora[2]);
    if (h < 24 && mi < 60) { hora = `${p(h)}:${p(mi)}`; resto = resto.slice(mHora[0].length); }
  }

  const titulo = resto.trim();
  if (!titulo) return null;
  return { titulo, data, hora, repeticao };
}

export function interpretarLista(texto, hoje = hojeISO()) {
  const linhas = String(texto).split(/\r?\n/);
  const bons = [];
  const ruins = [];
  linhas.forEach((linha, i) => {
    if (!linha.trim()) return;
    const item = interpretarLinha(linha, hoje);
    if (item) bons.push(item);
    else ruins.push({ numero: i + 1, texto: linha.trim() });
  });
  return { bons, ruins };
}

async function adicionarVarios() {
  const v = await abrirFormulario({
    titulo: 'Adicionar vários de uma vez',
    campos: [
      { nome: 'lista', rotulo: 'Um compromisso por linha', tipo: 'textoLongo',
        obrigatorio: true,
        placeholder: '10/09 14:00 Consulta com o dentista\n12/09 Comprar shampoo\n15/09 08:00 Academia semanal',
        dica: 'Data, hora (opcional) e o que é. Para repetir, termine a linha com '
            + 'semanal, quinzenal, mensal ou anual.' },
      { nome: 'categoria', rotulo: 'Categoria de todos', tipo: 'selecao',
        opcoes: CATEGORIAS_EVENTO, largura: 'metade' },
      { nome: 'pessoa', rotulo: 'De quem são', tipo: 'pessoa', largura: 'metade' }
    ],
    valores: { categoria: 'Casa' },
    textoOk: 'Adicionar',
    aoValidar: (v) => {
      const { bons } = interpretarLista(v.lista);
      return bons.length ? null : 'Não consegui entender nenhuma linha. Comece cada uma com a data, como 10/09.';
    }
  });
  if (!v) return;

  const { bons, ruins } = interpretarLista(v.lista);
  const lembrete = Number(obter().config.lembretePadraoMin ?? 60);
  for (const item of bons) {
    inserir('eventos', {
      ...item, categoria: v.categoria, pessoa: v.pessoa,
      lembreteMin: lembrete, concluido: false, local: '', notas: ''
    });
  }
  sinalizar('evento');
  aviso(ruins.length
    ? `${bons.length} adicionados. ${ruins.length} linha${ruins.length > 1 ? 's' : ''} não entendi (linha ${ruins.map((r) => r.numero).join(', ')}).`
    : `${bons.length} compromisso${bons.length > 1 ? 's' : ''} na agenda.`,
    ruins.length ? 'atencao' : 'ok');
}

async function novoEvento(dataSugerida) {
  const v = await abrirFormulario({
    titulo: 'Novo compromisso',
    campos: campos(),
    valores: {
      data: dataSugerida || hojeISO(), hora: '09:00', categoria: 'Casa',
      lembreteMin: String(obter().config.lembretePadraoMin ?? 60), repeticao: 'nenhuma'
    }
  });
  if (!v) return;
  inserir('eventos', { ...v, lembreteMin: Number(v.lembreteMin), concluido: false });
  aviso('Compromisso adicionado à agenda.');
  sinalizar('evento');
}

async function editarEvento(id) {
  const ev = buscar('eventos', id);
  if (!ev) return;
  const v = await abrirFormulario({
    titulo: 'Editar compromisso',
    campos: campos(),
    valores: { ...ev, lembreteMin: String(ev.lembreteMin ?? 60) }
  });
  if (!v) return;
  atualizar('eventos', id, { ...v, lembreteMin: Number(v.lembreteMin) });
  aviso('Compromisso atualizado.');
}

function proximaData(iso, repeticao) {
  const d = isoParaData(iso);
  switch (repeticao) {
    case 'diaria': d.setDate(d.getDate() + 1); break;
    case 'semanal': d.setDate(d.getDate() + 7); break;
    case 'quinzenal': d.setDate(d.getDate() + 15); break;
    case 'mensal': d.setMonth(d.getMonth() + 1); break;
    case 'anual': d.setFullYear(d.getFullYear() + 1); break;
    default: return null;
  }
  return dataParaISO(d);
}

function concluir(id) {
  const ev = buscar('eventos', id);
  if (!ev) return;
  if (ev.concluido) { atualizar('eventos', id, { concluido: false }); return; }
  atualizar('eventos', id, { concluido: true, concluidoEm: hojeISO() });
  const proxima = proximaData(ev.data, ev.repeticao);
  if (proxima) {
    const { id: _ignorado, concluido, concluidoEm, criadoEm, ...resto } = ev;
    inserir('eventos', { ...resto, data: proxima, concluido: false });
    aviso(`Feito! Próxima vez em ${fmtData(proxima)}.`);
  } else {
    aviso('Compromisso concluído.');
  }
  sinalizar('feito');
}

function rotuloDia(iso) {
  const dif = diasEntre(hojeISO(), iso);
  if (dif === 0) return 'Hoje';
  if (dif === 1) return 'Amanhã';
  if (dif === -1) return 'Ontem';
  if (dif > 1 && dif <= 7) return DIAS_SEMANA_LONGO[isoParaData(iso).getDay()];
  return fmtDataExtenso(iso);
}

function cartaoEvento(ev) {
  const atrasado = !ev.concluido && diasEntre(hojeISO(), ev.data) < 0;
  const cor = ev.pessoa ? corPessoa(ev.pessoa) : 'var(--cor-primaria)';
  return `<article class="item ${ev.concluido ? 'item--feito' : ''}" data-id="${ev.id}">
    <button class="item__check" data-concluir="${ev.id}" aria-label="Marcar como feito"
      style="--cor-item:${cor}">${ev.concluido ? '✓' : ''}</button>
    <div class="item__conteudo" data-editar="${ev.id}">
      <div class="item__linha1">
        <strong>${esc(ev.titulo)}</strong>
        ${ev.hora ? `<span class="item__hora">${esc(ev.hora)}</span>` : ''}
      </div>
      <div class="item__linha2">
        ${ev.categoria ? etiqueta(ev.categoria, 'suave') : ''}
        ${ev.pessoa ? etiqueta(nomePessoa(ev.pessoa), 'pessoa') : ''}
        ${ev.local ? `<span class="item__meta item__meta--icone">${icone('local', 13)}${esc(ev.local)}</span>` : ''}
        ${ev.repeticao && ev.repeticao !== 'nenhuma'
          ? `<span class="item__meta item__meta--icone">${icone('repetir', 13)}repete</span>` : ''}
        ${atrasado ? etiqueta('Atrasado', 'perigo') : ''}
      </div>
      ${ev.notas ? `<p class="item__notas">${esc(ev.notas)}</p>` : ''}
    </div>
    <button class="botao-icone item__excluir" data-excluir="${ev.id}" aria-label="Excluir">${icone('lixo', 16)}</button>
  </article>`;
}

export function render(raiz) {
  const d = obter();
  const hoje = hojeISO();
  let lista = [...d.eventos];

  if (filtro === 'proximos') lista = lista.filter((e) => !e.concluido && diasEntre(hoje, e.data) >= 0);
  else if (filtro === 'atrasados') lista = lista.filter((e) => !e.concluido && diasEntre(hoje, e.data) < 0);
  else if (filtro === 'concluidos') lista = lista.filter((e) => e.concluido);

  lista.sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')));

  const grupos = {};
  for (const ev of lista) (grupos[ev.data] ||= []).push(ev);

  const contadores = {
    proximos: d.eventos.filter((e) => !e.concluido && diasEntre(hoje, e.data) >= 0).length,
    atrasados: d.eventos.filter((e) => !e.concluido && diasEntre(hoje, e.data) < 0).length,
    concluidos: d.eventos.filter((e) => e.concluido).length
  };

  raiz.innerHTML = `
    <div class="filtros">
      ${[['proximos', 'Próximos', contadores.proximos], ['atrasados', 'Atrasados', contadores.atrasados],
         ['concluidos', 'Concluídos', contadores.concluidos], ['todos', 'Todos', d.eventos.length]]
        .map(([v, t, n]) => `<button class="filtro ${filtro === v ? 'is-ativo' : ''}" data-filtro="${v}">
          ${t}${n ? ` <span class="filtro__num">${n}</span>` : ''}</button>`).join('')}
    </div>
    ${Object.keys(grupos).length === 0
      ? `${vazio(icone('agenda', 40), 'Nada por aqui', filtro === 'proximos'
          ? 'Sua agenda está livre. Adicione um compromisso — ou traga os que já estão no Google.'
          : 'Nenhum compromisso neste filtro.', { acao: 'novo', texto: '+ Novo compromisso' })}
         ${filtro === 'proximos' ? `<div class="linha-botoes linha-botoes--largo">
           <a class="botao botao--suave" href="#/config">Importar do Google Agenda</a></div>` : ''}`
      : Object.entries(grupos).map(([data, evs]) => `
        <section class="grupo-dia">
          <h3 class="grupo-dia__titulo ${data === hoje ? 'is-hoje' : ''}">
            ${esc(rotuloDia(data))} <span class="grupo-dia__data">${fmtData(data)}</span>
          </h3>
          ${evs.map(cartaoEvento).join('')}
        </section>`).join('')}
    <div class="linha-botoes linha-botoes--largo">
      <button class="botao botao--suave" data-acao="varios">Adicionar vários de uma vez</button>
    </div>
    <button class="botao-flutuante" data-acao="novo" aria-label="Novo compromisso">+</button>`;

  raiz.onclick = (e) => {
    const f = e.target.closest('[data-filtro]');
    if (f) { filtro = f.dataset.filtro; render(raiz); return; }
    if (e.target.closest('[data-acao="novo"]')) { novoEvento(); return; }
    if (e.target.closest('[data-acao="varios"]')) { adicionarVarios(); return; }
    const c = e.target.closest('[data-concluir]');
    if (c) { concluir(c.dataset.concluir); return; }
    const x = e.target.closest('[data-excluir]');
    if (x) {
      const ev = buscar('eventos', x.dataset.excluir);
      confirmar({
        titulo: 'Excluir compromisso',
        mensagem: `Tem certeza que quer excluir "${ev?.titulo}"?`,
        textoOk: 'Excluir', perigo: true
      }).then((ok) => { if (ok) { remover('eventos', x.dataset.excluir); aviso('Compromisso excluído.'); } });
      return;
    }
    const ed = e.target.closest('[data-editar]');
    if (ed) editarEvento(ed.dataset.editar);
  };
}

export { novoEvento };
