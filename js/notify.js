// Motor de avisos: calcula o que está vencendo/chegando e dispara as notificações.
// Funciona sem servidor — o próprio aparelho agenda e mostra os avisos.
import {
  obter, marcarNotificado, jaNotificado, contasDaCompetencia, pagamentoDe,
  rendasDaCompetencia, recebimentoDe, nomePessoa
} from './store.js';
import {
  hojeISO, dataParaISO, isoHoraParaData, isoParaData, competenciaDe,
  vencimentoNaCompetencia, diasEntre, fmtMoney, fmtData, addDias
} from './util.js';

let registroSW = null;
let temporizador = null;

export function definirRegistroSW(reg) { registroSW = reg; }

export function permissaoNotificacao() {
  return 'Notification' in window ? Notification.permission : 'indisponivel';
}

export async function pedirPermissao() {
  if (!('Notification' in window)) return 'indisponivel';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function mostrar({ titulo, corpo, tag, url }) {
  if (permissaoNotificacao() !== 'granted') return false;
  const opcoes = {
    body: corpo,
    tag,
    icon: 'assets/icons/icon-192.png',
    badge: 'assets/icons/icon-192.png',
    data: { url: url || '#/inicio' },
    requireInteraction: false,
    vibrate: [120, 60, 120]
  };
  try {
    if (registroSW?.showNotification) await registroSW.showNotification(titulo, opcoes);
    else new Notification(titulo, opcoes);
    return true;
  } catch (e) {
    console.warn('Falha ao mostrar notificação:', e);
    return false;
  }
}

/* ---------- Cálculo dos alertas ---------- */

// Retorna todos os alertas relevantes, com a hora em que devem tocar.
export function calcularAlertas(agora = new Date()) {
  const d = obter();
  const alertas = [];
  const hoje = dataParaISO(agora);
  const comp = competenciaDe(agora);
  const diasAviso = Number(d.config.diasAvisoConta) || 3;

  /* --- Compromissos da agenda --- */
  for (const ev of d.eventos) {
    if (ev.concluido) continue;
    const quandoEvento = isoHoraParaData(ev.data, ev.hora || '09:00');
    if (!quandoEvento) continue;
    const minutos = Number(ev.lembreteMin ?? 60);
    const quando = new Date(quandoEvento.getTime() - minutos * 60000);
    // Só interessa o que acontece de hoje em diante (com 1 dia de tolerância)
    if (quandoEvento < new Date(agora.getTime() - 86400000)) continue;
    alertas.push({
      chave: `evento:${ev.id}:${ev.data}${ev.hora || ''}`,
      tipo: 'agenda',
      icone: '📅',
      titulo: ev.titulo,
      corpo: `${ev.hora ? `Às ${ev.hora}` : 'Hoje'}${ev.local ? ` · ${ev.local}` : ''}`,
      quando,
      instante: quandoEvento,
      url: '#/agenda',
      prioridade: 2
    });
  }

  /* --- Medicamentos --- */
  for (const med of d.medicamentos) {
    if (med.arquivado) continue;
    if (med.inicio && hoje < med.inicio) continue;
    if (med.fim && hoje > med.fim) continue;
    const dias = Array.isArray(med.diasSemana) && med.diasSemana.length ? med.diasSemana : [0, 1, 2, 3, 4, 5, 6];
    // Olha ontem, hoje e amanhã para não perder viradas de dia
    for (const desloc of [-1, 0, 1]) {
      const dia = addDias(hoje, desloc);
      const dataDia = isoParaData(dia);
      if (!dias.includes(dataDia.getDay())) continue;
      for (const hora of (med.horarios || [])) {
        const quando = isoHoraParaData(dia, hora);
        if (!quando) continue;
        // Dose de mais de 3h atrás já passou — não faz sentido continuar cobrando.
        if (agora - quando > 3 * 3600000) continue;
        const tomado = d.doses.some((x) => x.medicamentoId === med.id && x.data === dia && x.hora === hora);
        if (tomado) continue;
        alertas.push({
          chave: `dose:${med.id}:${dia}:${hora}`,
          tipo: 'farmacia',
          icone: '💊',
          titulo: `Hora do remédio: ${med.nome}`,
          corpo: `${med.dosagem || ''} ${med.pessoa ? `· ${nomePessoa(med.pessoa)}` : ''}`.trim() || `Às ${hora}`,
          quando,
          instante: quando,
          url: '#/farmacia',
          prioridade: 1
        });
      }
    }
    // Estoque acabando
    if (med.estoque != null && med.estoqueMinimo != null && med.estoque <= med.estoqueMinimo) {
      alertas.push({
        chave: `estoque:${med.id}:${hoje}`,
        tipo: 'farmacia',
        icone: '🧴',
        titulo: `Estoque baixo: ${med.nome}`,
        corpo: `Restam ${med.estoque} ${med.unidade || 'un'}. Hora de repor.`,
        quando: isoHoraParaData(hoje, '09:00'),
        instante: isoHoraParaData(hoje, '09:00'),
        url: '#/farmacia',
        prioridade: 3
      });
    }
  }

  /* --- Contas a pagar (mês atual e o anterior, para pegar atrasos) --- */
  for (const competencia of [comp, competenciaDe(new Date(agora.getFullYear(), agora.getMonth() - 1, 1))]) {
    for (const conta of contasDaCompetencia(competencia)) {
      if (pagamentoDe(conta.id, competencia)) continue;
      const venc = conta.tipo === 'unica'
        ? conta.dataUnica
        : vencimentoNaCompetencia(competencia, conta.diaVencimento);
      const faltam = diasEntre(hoje, venc);
      if (faltam > diasAviso || faltam < -60) continue;
      let titulo, corpo, prioridade;
      if (faltam < 0) {
        titulo = `Conta atrasada: ${conta.descricao}`;
        corpo = `Venceu em ${fmtData(venc)} · ${fmtMoney(conta.valor)}`;
        prioridade = 0;
      } else if (faltam === 0) {
        titulo = `Vence hoje: ${conta.descricao}`;
        corpo = `${fmtMoney(conta.valor)} · não esqueça de pagar`;
        prioridade = 1;
      } else {
        titulo = `Conta chegando: ${conta.descricao}`;
        corpo = `Vence em ${faltam} dia${faltam > 1 ? 's' : ''} (${fmtData(venc)}) · ${fmtMoney(conta.valor)}`;
        prioridade = 2;
      }
      alertas.push({
        chave: `conta:${conta.id}:${competencia}:${hoje}`,
        tipo: 'contas',
        icone: faltam < 0 ? '🔴' : '💳',
        titulo, corpo, prioridade,
        quando: isoHoraParaData(hoje, '09:00'),
        instante: isoHoraParaData(venc, '09:00'),
        url: '#/contas'
      });
    }
  }

  /* --- Salário / rendas a receber --- */
  for (const renda of rendasDaCompetencia(comp)) {
    if (recebimentoDe(renda.id, comp)) continue;
    const dia = renda.tipo === 'unica' ? renda.dataUnica : vencimentoNaCompetencia(comp, renda.diaRecebimento);
    const faltam = diasEntre(hoje, dia);
    if (faltam !== 0) continue;
    alertas.push({
      chave: `renda:${renda.id}:${comp}`,
      tipo: 'financeiro',
      icone: '💰',
      titulo: `${renda.descricao} cai hoje`,
      corpo: `${fmtMoney(renda.valor)} · ${nomePessoa(renda.pessoa)}`,
      quando: isoHoraParaData(hoje, '09:00'),
      instante: isoHoraParaData(hoje, '09:00'),
      url: '#/financeiro',
      prioridade: 2
    });
  }

  /* --- Lista de mercado pendente (lembrete de fim de semana) --- */
  const pendentesMercado = d.mercado.filter((i) => !i.comprado).length;
  if (pendentesMercado > 0 && agora.getDay() === 6) {
    alertas.push({
      chave: `mercado:${hoje}`,
      tipo: 'mercado',
      icone: '🛒',
      titulo: 'Lista de mercado',
      corpo: `${pendentesMercado} ite${pendentesMercado > 1 ? 'ns' : 'm'} esperando na lista.`,
      quando: isoHoraParaData(hoje, '09:00'),
      instante: isoHoraParaData(hoje, '09:00'),
      url: '#/mercado',
      prioridade: 3
    });
  }

  return alertas.sort((a, b) => a.prioridade - b.prioridade || a.quando - b.quando);
}

// O que mostrar na tela (sino / painel): tudo que já "chegou a hora" ou é de hoje.
export function alertasParaExibir(agora = new Date()) {
  const limite = new Date(agora.getTime() + 12 * 3600000);
  return calcularAlertas(agora).filter((a) => a.quando <= limite);
}

export function alertasVencidos(agora = new Date()) {
  return calcularAlertas(agora).filter((a) => a.quando <= agora);
}

/* ---------- Disparo ---------- */

export async function verificarEDisparar() {
  const d = obter();
  if (!d.config.notificacoes || permissaoNotificacao() !== 'granted') return 0;
  const agora = new Date();
  let enviadas = 0;
  for (const a of alertasVencidos(agora)) {
    // Não incomoda com coisa de mais de 6h atrás (ex.: app aberto depois de dias)
    if (agora - a.quando > 6 * 3600000 && a.prioridade > 0) continue;
    if (jaNotificado(a.chave)) continue;
    const ok = await mostrar({ titulo: `${a.icone} ${a.titulo}`, corpo: a.corpo, tag: a.chave, url: a.url });
    if (ok) { marcarNotificado(a.chave); enviadas++; }
  }
  await resumoDiario(agora);
  // A casca do app escuta isto para atualizar só o contador do sino,
  // sem redesenhar a tela em que a pessoa está mexendo.
  window.dispatchEvent(new CustomEvent('alertas-atualizados'));
  return enviadas;
}

async function resumoDiario(agora) {
  const d = obter();
  if (!d.config.resumoDiario) return;
  const hora = d.config.horaResumoDiario || '08:00';
  const quando = isoHoraParaData(dataParaISO(agora), hora);
  if (agora < quando || agora - quando > 4 * 3600000) return;
  const chave = `resumo:${dataParaISO(agora)}`;
  if (jaNotificado(chave)) return;

  const hoje = hojeISO();
  const eventosHoje = d.eventos.filter((e) => e.data === hoje && !e.concluido).length;
  const comp = competenciaDe(agora);
  const contasHoje = contasDaCompetencia(comp).filter((c) => {
    if (pagamentoDe(c.id, comp)) return false;
    const venc = c.tipo === 'unica' ? c.dataUnica : vencimentoNaCompetencia(comp, c.diaVencimento);
    return diasEntre(hoje, venc) <= 0;
  }).length;
  const doses = d.medicamentos.filter((m) => !m.arquivado).reduce((t, m) => t + (m.horarios?.length || 0), 0);

  const partes = [];
  if (eventosHoje) partes.push(`${eventosHoje} compromisso${eventosHoje > 1 ? 's' : ''}`);
  if (contasHoje) partes.push(`${contasHoje} conta${contasHoje > 1 ? 's' : ''} a pagar`);
  if (doses) partes.push(`${doses} dose${doses > 1 ? 's' : ''} de remédio`);
  if (!partes.length) return;

  const ok = await mostrar({
    titulo: '☀️ Bom dia! O dia de hoje',
    corpo: partes.join(' · '),
    tag: chave,
    url: '#/inicio'
  });
  if (ok) marcarNotificado(chave);
}

/* ---------- Ciclo de verificação ---------- */

export function iniciarMonitoramento() {
  parar();
  verificarEDisparar();
  temporizador = setInterval(verificarEDisparar, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') verificarEDisparar();
  });
  window.addEventListener('focus', verificarEDisparar);
}

export function parar() {
  if (temporizador) clearInterval(temporizador);
  temporizador = null;
}

// Sincronização periódica em segundo plano (Android/Chrome instalado).
export async function tentarSyncPeriodico() {
  try {
    if (!registroSW || !('periodicSync' in registroSW)) return false;
    const estado = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (estado.state !== 'granted') return false;
    await registroSW.periodicSync.register('verificar-alertas', { minInterval: 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

export async function notificacaoDeTeste() {
  const p = await pedirPermissao();
  if (p !== 'granted') return false;
  return mostrar({
    titulo: '🏠 Tudo certo!',
    corpo: 'As notificações do app da casa estão funcionando.',
    tag: 'teste',
    url: '#/inicio'
  });
}
