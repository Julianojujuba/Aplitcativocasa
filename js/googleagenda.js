// Trazer os compromissos que já existem no Google Agenda.
// Dois caminhos: conectar na conta (traz sempre) ou importar um arquivo .ics
// exportado do Google (não exige configuração nenhuma).
import { obter, alterar, inserir, atualizar } from './store.js';
import { dataParaISO, fmtData, hojeISO } from './util.js';
import { chamarFuncao } from './nuvem.js';

const ESCOPO = 'https://www.googleapis.com/auth/calendar.readonly';

/* ---------------------------------------------------------------- autorização */

export function enderecoDeRetorno() {
  return location.origin + location.pathname.replace(/[^/]*$/, '') + 'oauth.html';
}

// Abre a janelinha do Google e devolve o token. Fluxo direto no navegador:
// nenhum servidor no meio, nenhuma senha passa pelo app.
export function conectarAoGoogle(clientId) {
  return new Promise((resolve, reject) => {
    if (!clientId) { reject(new Error('Falta o ID do cliente do Google.')); return; }
    const estado = Math.random().toString(36).slice(2);
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: clientId,
      redirect_uri: enderecoDeRetorno(),
      response_type: 'token',
      scope: ESCOPO,
      include_granted_scopes: 'true',
      state: estado,
      prompt: 'consent'
    });

    const janela = window.open(url, 'google-agenda', 'width=520,height=640');
    if (!janela) { reject(new Error('O navegador bloqueou a janela. Libere os pop-ups para este site.')); return; }

    let encerrado = false;
    const terminar = (fn, valor) => {
      if (encerrado) return;
      encerrado = true;
      window.removeEventListener('message', aoReceber);
      clearInterval(vigia);
      fn(valor);
    };

    const aoReceber = (e) => {
      if (e.origin !== location.origin || e.data?.tipo !== 'google-oauth') return;
      if (e.data.state !== estado) return;              // resposta de outra tentativa
      if (e.data.error) {
        terminar(reject, new Error(e.data.error === 'access_denied'
          ? 'Autorização cancelada.' : `O Google recusou: ${e.data.error}`));
        return;
      }
      if (!e.data.access_token) { terminar(reject, new Error('O Google não devolveu o acesso.')); return; }
      terminar(resolve, e.data.access_token);
    };
    window.addEventListener('message', aoReceber);

    const vigia = setInterval(() => {
      if (janela.closed) terminar(reject, new Error('Janela fechada antes de autorizar.'));
    }, 700);
  });
}

/* ---------------------------------------------------------------- leitura no Google */

async function pedirAoGoogle(caminho, token, parametros = {}) {
  const url = `https://www.googleapis.com/calendar/v3${caminho}?` + new URLSearchParams(parametros);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const dados = await r.json();
  if (!r.ok) {
    const msg = dados?.error?.message || `Erro ${r.status}`;
    throw new Error(r.status === 401 ? 'A autorização venceu. Conecte de novo.' : msg);
  }
  return dados;
}

// Só as agendas que são de vocês. Feriados e aniversários entram como
// "reader" e ficam de fora, senão a agenda vira uma enxurrada.
export async function listarAgendas(token) {
  const dados = await pedirAoGoogle('/users/me/calendarList', token, { maxResults: 100 });
  return (dados.items || [])
    .filter((c) => ['owner', 'writer'].includes(c.accessRole))
    .filter((c) => !/holiday|birthday|#contacts/i.test(c.id || ''))
    .map((c) => ({ id: c.id, nome: c.summary, principal: Boolean(c.primary) }));
}

export async function buscarEventos(token, agendaId, { desdeDias = 30 } = {}) {
  const desde = new Date();
  desde.setDate(desde.getDate() - desdeDias);
  const todos = [];
  let pagina = null;

  do {
    const dados = await pedirAoGoogle(`/calendars/${encodeURIComponent(agendaId)}/events`, token, {
      timeMin: desde.toISOString(),
      maxResults: 250,
      singleEvents: 'false',      // mantém a repetição como repetição
      showDeleted: 'false',
      ...(pagina ? { pageToken: pagina } : {})
    });
    todos.push(...(dados.items || []));
    pagina = dados.nextPageToken;
  } while (pagina && todos.length < 1000);

  return todos
    .filter((e) => e.status !== 'cancelled' && e.summary)
    .map(converterDoGoogle)
    .filter(Boolean);
}

function converterDoGoogle(e) {
  const inicio = e.start || {};
  const quando = interpretarInstante(inicio.date, inicio.dateTime);
  if (!quando) return null;
  return {
    googleId: e.id,
    titulo: e.summary,
    data: quando.data,
    hora: quando.hora,
    local: e.location || '',
    notas: (e.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 500),
    repeticao: interpretarRepeticao((e.recurrence || []).find((r) => r.startsWith('RRULE')))
  };
}

function interpretarInstante(dataSolta, dataHora) {
  if (dataSolta) return { data: dataSolta.slice(0, 10), hora: '' };
  if (!dataHora) return null;
  const d = new Date(dataHora);
  if (Number.isNaN(d.getTime())) return null;
  return { data: dataParaISO(d), hora: d.toTimeString().slice(0, 5) };
}

function interpretarRepeticao(rrule) {
  if (!rrule) return 'nenhuma';
  const texto = rrule.toUpperCase();
  const freq = (texto.match(/FREQ=([A-Z]+)/) || [])[1];
  const intervalo = Number((texto.match(/INTERVAL=(\d+)/) || [])[1] || 1);
  if (freq === 'DAILY') return 'diaria';
  if (freq === 'WEEKLY') return intervalo === 2 ? 'quinzenal' : 'semanal';
  if (freq === 'MONTHLY') return 'mensal';
  if (freq === 'YEARLY') return 'anual';
  return 'nenhuma';
}

/* ---------------------------------------------------------------- link secreto */

/*
  O jeito fácil: o Google dá um endereço secreto para cada agenda. Copiar esse
  link é tudo que a pessoa precisa fazer — e dá para reler quando quiser.
  O navegador não consegue buscar direto (o Google não libera leitura por
  outro site), então uma função nossa no servidor faz o meio de campo.
*/
export async function buscarPeloLink(link) {
  const { ics } = await chamarFuncao('agenda-google', { url: link });
  const lista = interpretarICS(ics);
  if (!lista.length) throw new Error('A agenda veio vazia — não achei compromissos nela.');
  return lista;
}

export function pareceLinkDeAgenda(link) {
  return /^(https|webcal):\/\/calendar\.google\.com\/calendar\/ical\/.+\.ics$/i.test(String(link || '').trim());
}

// Relê a agenda sozinha, no máximo uma vez por dia, sem incomodar ninguém.
export async function relerAgendaSeNecessario({ minimoHoras = 20 } = {}) {
  const d = obter();
  const link = (d.config.linkAgendaGoogle || '').trim();
  if (!link || !pareceLinkDeAgenda(link) || !navigator.onLine) return null;
  if (Date.now() - (d.config.ultimaLeituraLinkEm || 0) < minimoHoras * 3600000) return null;
  try {
    const r = importarEventos(await buscarPeloLink(link));
    alterar((dd) => {
      dd.config.ultimaLeituraLinkEm = Date.now();
      dd.config.ultimaImportacaoGoogle = fmtData(hojeISO());
    });
    return r;
  } catch (e) {
    console.warn('Não consegui reler a agenda do Google agora:', e);
    return null;
  }
}

/* ---------------------------------------------------------------- arquivo .ics */

export function interpretarICS(texto) {
  // Linhas dobradas continuam na seguinte começando com espaço ou tab.
  const linhas = String(texto).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const eventos = [];
  let atual = null;

  for (const linha of linhas) {
    if (linha === 'BEGIN:VEVENT') { atual = {}; continue; }
    if (linha === 'END:VEVENT') {
      if (atual?.titulo && atual.data) eventos.push(finalizarICS(atual));
      atual = null;
      continue;
    }
    if (!atual) continue;

    const corte = linha.indexOf(':');
    if (corte < 0) continue;
    const cabeca = linha.slice(0, corte);
    const valor = linha.slice(corte + 1);
    const nome = cabeca.split(';')[0].toUpperCase();

    if (nome === 'SUMMARY') atual.titulo = desescapar(valor);
    else if (nome === 'LOCATION') atual.local = desescapar(valor);
    else if (nome === 'DESCRIPTION') atual.notas = desescapar(valor).slice(0, 500);
    else if (nome === 'UID') atual.googleId = 'ics:' + valor.trim();
    else if (nome === 'RRULE') atual.repeticao = interpretarRepeticao('RRULE:' + valor);
    else if (nome === 'DTSTART') {
      const q = interpretarDataICS(valor, cabeca);
      if (q) { atual.data = q.data; atual.hora = q.hora; }
    }
  }
  return eventos;
}

function finalizarICS(e) {
  return {
    googleId: e.googleId || null,
    titulo: e.titulo,
    data: e.data,
    hora: e.hora || '',
    local: e.local || '',
    notas: e.notas || '',
    repeticao: e.repeticao || 'nenhuma'
  };
}

function desescapar(v) {
  return String(v).replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\;/g, ';').replace(/\\\\/g, '\\').trim();
}

function interpretarDataICS(valor, cabeca) {
  const v = valor.trim();
  if (/VALUE=DATE(?!-TIME)/i.test(cabeca) || /^\d{8}$/.test(v)) {
    const m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
    return m ? { data: `${m[1]}-${m[2]}-${m[3]}`, hora: '' } : null;
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  const [, a, mes, dia, h, min, seg, zulu] = m;
  if (zulu) {
    // Veio em UTC: converte para a hora daqui.
    const d = new Date(Date.UTC(+a, +mes - 1, +dia, +h, +min, +seg));
    return { data: dataParaISO(d), hora: d.toTimeString().slice(0, 5) };
  }
  // Sem fuso ou com TZID: usa a hora como está escrita.
  return { data: `${a}-${mes}-${dia}`, hora: `${h}:${min}` };
}

/* ---------------------------------------------------------------- gravar aqui */

// Importa sem duplicar: o mesmo compromisso importado de novo é atualizado.
export function importarEventos(lista, { categoria = 'Outros', pessoa = '' } = {}) {
  const existentes = obter().eventos;
  let novos = 0, atualizados = 0, ignorados = 0;

  for (const e of lista) {
    if (!e.titulo || !e.data) { ignorados++; continue; }
    const igual = e.googleId
      ? existentes.find((x) => x.googleId === e.googleId)
      : existentes.find((x) => x.titulo === e.titulo && x.data === e.data && (x.hora || '') === (e.hora || ''));

    const campos = {
      titulo: e.titulo, data: e.data, hora: e.hora || '',
      local: e.local || '', notas: e.notas || '',
      repeticao: e.repeticao || 'nenhuma',
      googleId: e.googleId || null, origem: 'google'
    };

    if (igual) {
      const mudou = ['titulo', 'data', 'hora', 'local', 'repeticao']
        .some((c) => (igual[c] || '') !== (campos[c] || ''));
      if (mudou) { atualizar('eventos', igual.id, campos); atualizados++; }
      else ignorados++;
    } else {
      inserir('eventos', {
        ...campos, categoria, pessoa,
        lembreteMin: 60, concluido: false
      });
      novos++;
    }
  }
  return { novos, atualizados, ignorados, total: lista.length };
}
