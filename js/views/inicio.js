// Tela inicial: o resumo do dia da casa, juntando agenda, remédios, contas e dinheiro.
import { obter, pessoasVisiveis } from '../store.js';
import { cartaoNumero, barraProgresso } from '../ui.js';
import { esc, fmtMoney, fmtDataCurta, hojeISO, competenciaDe, labelCompetencia, diasEntre, isoParaData, DIAS_SEMANA_LONGO, MESES } from '../util.js';
import { resumoMes } from '../financas.js';
import { icone, ICONE_POR_TIPO } from '../icones.js';
import { alertasParaExibir } from '../notify.js';

export const titulo = 'Início';
export const chaveIcone = 'casa';

function saudacao() {
  const h = new Date().getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function dosesDeHoje() {
  const d = obter();
  const hoje = hojeISO();
  const diaSemana = isoParaData(hoje).getDay();
  const lista = [];
  for (const m of d.medicamentos) {
    if (m.arquivado) continue;
    if (m.inicio && hoje < m.inicio) continue;
    if (m.fim && hoje > m.fim) continue;
    const dias = Array.isArray(m.diasSemana) && m.diasSemana.length ? m.diasSemana : [0, 1, 2, 3, 4, 5, 6];
    if (!dias.includes(diaSemana)) continue;
    for (const hora of (m.horarios || [])) {
      const tomada = d.doses.some((x) => x.medicamentoId === m.id && x.data === hoje && x.hora === hora);
      lista.push({ nome: m.nome, hora, tomada });
    }
  }
  return lista.sort((a, b) => a.hora.localeCompare(b.hora));
}

export function render(raiz) {
  const d = obter();
  const hoje = hojeISO();
  const comp = competenciaDe();
  const r = resumoMes(comp);
  const alertas = alertasParaExibir().slice(0, 6);

  const eventosHoje = d.eventos
    .filter((e) => !e.concluido && e.data === hoje)
    .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  const proximosEventos = d.eventos
    .filter((e) => !e.concluido && diasEntre(hoje, e.data) > 0 && diasEntre(hoje, e.data) <= 7)
    .sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')))
    .slice(0, 4);

  const doses = dosesDeHoje();
  const dosesPendentes = doses.filter((x) => !x.tomada);
  const mercadoPendente = d.mercado.filter((i) => !i.comprado).length;
  const proximasContas = r.contas.filter((c) => c.estado !== 'paga' && c.faltam <= 7)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 4);

  const hojeData = new Date();
  const dataExtenso = `${DIAS_SEMANA_LONGO[hojeData.getDay()]}, ${hojeData.getDate()} de ${MESES[hojeData.getMonth()].toLowerCase()}`;
  // Cumprimenta quem está com este celular na mão; se não souber, os dois.
  const dono = d.pessoas.find((p) => p.id === d.config.pessoaId);
  const nomes = dono ? dono.nome : pessoasVisiveis().map((p) => p.nome).join(' e ');

  raiz.innerHTML = `
    <header class="boas-vindas">
      <h2>${saudacao()}, ${esc(nomes)}!</h2>
      <p>${esc(dataExtenso)}</p>
    </header>

    ${alertas.length ? `
      <section class="painel painel--alertas">
        <div class="painel__topo"><h3>${icone('raio', 17)} Precisa de atenção</h3>
          <span class="painel__contador">${alertas.length}</span></div>
        ${alertas.map((a) => `
          <a class="alerta-linha" href="${a.url}">
            <span class="alerta-linha__icone">${icone(ICONE_POR_TIPO[a.tipo] || 'aviso', 18)}</span>
            <span class="alerta-linha__texto">
              <strong>${esc(a.titulo)}</strong>
              <small>${esc(a.corpo)}</small>
            </span>
            <span class="alerta-linha__seta">›</span>
          </a>`).join('')}
      </section>` : ''}

    <section class="painel">
      <div class="painel__topo">
        <h3>${icone('dinheiro', 17)} ${labelCompetencia(comp)}</h3>
        <a class="link-painel" href="#/financeiro">ver tudo ›</a>
      </div>
      <div class="metricas metricas--3">
        ${cartaoNumero({ rotulo: 'Entrou', valor: fmtMoney(r.receitaRealizada), cor: 'ok' })}
        ${cartaoNumero({ rotulo: 'Saiu', valor: fmtMoney(r.despesaRealizada), cor: 'perigo' })}
        ${cartaoNumero({ rotulo: 'Sobrou', valor: fmtMoney(r.saldoRealizado),
          cor: r.saldoRealizado >= 0 ? 'ok' : 'perigo' })}
      </div>
      ${r.despesaContasPrevista > 0 ? `
        <div class="progresso-rotulado">
          ${barraProgresso(r.percentualPago, r.percentualPago === 100 ? 'ok' : 'primario')}
          <small>${r.percentualPago}% das contas pagas · falta ${fmtMoney(r.faltaPagar)}</small>
        </div>` : ''}
    </section>

    <div class="grade-cartoes">
      <section class="painel painel--metade">
        <div class="painel__topo"><h3>${icone('agenda', 17)} Hoje</h3>
          <a class="link-painel" href="#/agenda">agenda ›</a></div>
        ${eventosHoje.length ? eventosHoje.map((e) => `
          <div class="mini-linha">
            <span class="mini-linha__hora">${esc(e.hora || '--:--')}</span>
            <span class="mini-linha__texto">${esc(e.titulo)}</span>
          </div>`).join('')
          : '<p class="texto-suave">Nenhum compromisso hoje.</p>'}
        ${proximosEventos.length ? `
          <div class="mini-separador">Próximos dias</div>
          ${proximosEventos.map((e) => `
            <div class="mini-linha mini-linha--suave">
              <span class="mini-linha__hora">${fmtDataCurta(e.data)}</span>
              <span class="mini-linha__texto">${esc(e.titulo)}</span>
            </div>`).join('')}` : ''}
      </section>

      <section class="painel painel--metade">
        <div class="painel__topo"><h3>${icone('pilula', 17)} Remédios</h3>
          <a class="link-painel" href="#/farmacia">farmácia ›</a></div>
        ${doses.length ? `
          <p class="destaque-numero">${doses.length - dosesPendentes.length}<span>/${doses.length} doses tomadas</span></p>
          ${barraProgresso(((doses.length - dosesPendentes.length) / doses.length) * 100, 'ok')}
          ${dosesPendentes.slice(0, 3).map((x) => `
            <div class="mini-linha">
              <span class="mini-linha__hora">${esc(x.hora)}</span>
              <span class="mini-linha__texto">${esc(x.nome)}</span>
            </div>`).join('')}`
          : '<p class="texto-suave">Nenhuma dose programada para hoje.</p>'}
      </section>

      <section class="painel painel--metade">
        <div class="painel__topo"><h3>${icone('cartao', 17)} Contas</h3>
          <a class="link-painel" href="#/contas">contas ›</a></div>
        ${proximasContas.length ? proximasContas.map((c) => `
          <div class="mini-linha">
            <span class="mini-linha__texto">${esc(c.conta.descricao)}</span>
            <span class="mini-linha__valor ${c.estado === 'atrasada' ? 'texto-perigo' : ''}">
              ${fmtMoney(c.conta.valor)}</span>
          </div>
          <small class="mini-linha__sub ${c.estado === 'atrasada' ? 'texto-perigo' : ''}">
            ${c.estado === 'atrasada' ? `atrasada há ${Math.abs(c.faltam)}d`
              : c.faltam === 0 ? 'vence hoje' : `vence em ${c.faltam}d`}</small>`).join('')
          : '<p class="texto-suave">Nenhuma conta vencendo nos próximos dias. ✓</p>'}
      </section>

      <section class="painel painel--metade">
        <div class="painel__topo"><h3>${icone('carrinho', 17)} Mercado</h3>
          <a class="link-painel" href="#/mercado">lista ›</a></div>
        ${mercadoPendente
          ? `<p class="destaque-numero">${mercadoPendente}<span>${mercadoPendente > 1 ? ' itens na lista' : ' item na lista'}</span></p>
             ${d.mercado.filter((i) => !i.comprado).slice(0, 4).map((i) => `
               <div class="mini-linha"><span class="mini-linha__texto">${esc(i.nome)}</span></div>`).join('')}`
          : '<p class="texto-suave">A lista de compras está vazia.</p>'}
      </section>
    </div>

    <div class="atalhos">
      <a class="atalho" href="#/agenda">${icone('agenda', 21)}<span>Compromisso</span></a>
      <a class="atalho" href="#/contas">${icone('cartao', 21)}<span>Conta</span></a>
      <a class="atalho" href="#/mercado">${icone('carrinho', 21)}<span>Compras</span></a>
      <a class="atalho" href="#/financeiro">${icone('grafico', 21)}<span>Gasto</span></a>
    </div>`;

  raiz.onclick = null;
}
