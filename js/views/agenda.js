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

const LEMBRETES = [
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

async function novoEvento(dataSugerida) {
  const v = await abrirFormulario({
    titulo: 'Novo compromisso',
    campos: campos(),
    valores: {
      data: dataSugerida || hojeISO(), hora: '09:00', categoria: 'Casa',
      lembreteMin: '60', repeticao: 'nenhuma'
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
    <button class="botao-flutuante" data-acao="novo" aria-label="Novo compromisso">+</button>`;

  raiz.onclick = (e) => {
    const f = e.target.closest('[data-filtro]');
    if (f) { filtro = f.dataset.filtro; render(raiz); return; }
    if (e.target.closest('[data-acao="novo"]')) { novoEvento(); return; }
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
