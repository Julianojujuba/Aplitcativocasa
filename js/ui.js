// Componentes de interface reutilizados por todas as telas.
import { esc, parseMoney, fmtMoney, DIAS_SEMANA } from './util.js';
import { obter, pessoasVisiveis } from './store.js';

/* ---------- Avisos rápidos (toast) ---------- */

export function aviso(texto, tipo = 'ok') {
  const caixa = document.getElementById('avisos');
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.textContent = texto;
  caixa.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visivel'));
  setTimeout(() => {
    el.classList.remove('is-visivel');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

// Avisa o ajudante da casa que algo bom aconteceu. Quando ele está ligado, o
// balão dele já dá o recado — dois avisos ao mesmo tempo só poluem a tela.
export function sinalizar(tipo) {
  if (obter().config?.mascote !== false) {
    document.getElementById('avisos')?.replaceChildren();
  }
  window.dispatchEvent(new CustomEvent('casa-acao', { detail: { tipo } }));
}

/* ---------- Modal base ---------- */

function abrirModal({ titulo, corpo, rodape, aoFechar }) {
  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo';
  fundo.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <header class="modal__topo">
        <h2>${esc(titulo)}</h2>
        <button class="botao-icone" data-fechar aria-label="Fechar">✕</button>
      </header>
      <div class="modal__corpo"></div>
      <footer class="modal__rodape"></footer>
    </div>`;
  fundo.querySelector('.modal__corpo').appendChild(corpo);
  fundo.querySelector('.modal__rodape').appendChild(rodape);
  document.body.appendChild(fundo);
  document.body.classList.add('sem-rolagem');
  requestAnimationFrame(() => fundo.classList.add('is-visivel'));

  const fechar = (resultado) => {
    fundo.classList.remove('is-visivel');
    document.body.classList.remove('sem-rolagem');
    setTimeout(() => fundo.remove(), 200);
    document.removeEventListener('keydown', aoTeclar);
    aoFechar?.(resultado);
  };
  const aoTeclar = (e) => { if (e.key === 'Escape') fechar(null); };
  document.addEventListener('keydown', aoTeclar);
  fundo.querySelector('[data-fechar]').addEventListener('click', () => fechar(null));
  fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(null); });
  return { fundo, fechar };
}

/* ---------- Confirmação ---------- */

export function confirmar({ titulo = 'Confirmar', mensagem, textoOk = 'Confirmar', perigo = false }) {
  return new Promise((resolve) => {
    const corpo = document.createElement('div');
    corpo.innerHTML = `<p class="texto-corpo">${esc(mensagem)}</p>`;
    const rodape = document.createElement('div');
    rodape.className = 'linha-botoes';
    rodape.innerHTML = `
      <button class="botao botao--suave" data-cancelar>Cancelar</button>
      <button class="botao ${perigo ? 'botao--perigo' : 'botao--primario'}" data-ok>${esc(textoOk)}</button>`;
    const { fechar } = abrirModal({ titulo, corpo, rodape, aoFechar: (r) => resolve(Boolean(r)) });
    rodape.querySelector('[data-cancelar]').addEventListener('click', () => fechar(false));
    rodape.querySelector('[data-ok]').addEventListener('click', () => fechar(true));
  });
}

/* ---------- Formulário em modal ---------- */
/*
  campos: [{ nome, rotulo, tipo, opcoes, obrigatorio, dica, placeholder, min, max, passo, largura }]
  tipos: texto | textoLongo | numero | dinheiro | data | hora | selecao | booleano
         | pessoa | horarios | diasSemana
*/
export function abrirFormulario({ titulo, campos, valores = {}, textoOk = 'Salvar', aoValidar }) {
  return new Promise((resolve) => {
    const corpo = document.createElement('form');
    corpo.className = 'formulario';
    corpo.id = 'form-modal';
    corpo.noValidate = true;
    corpo.innerHTML = campos.map((c) => renderCampo(c, valores[c.nome])).join('');

    const rodape = document.createElement('div');
    rodape.className = 'linha-botoes';
    rodape.innerHTML = `
      <button type="button" class="botao botao--suave" data-cancelar>Cancelar</button>
      <button type="submit" form="form-modal" class="botao botao--primario">${esc(textoOk)}</button>`;

    const { fundo, fechar } = abrirModal({ titulo, corpo, rodape, aoFechar: resolve });
    rodape.querySelector('[data-cancelar]').addEventListener('click', () => fechar(null));

    // Botões de horário (campo "horarios")
    corpo.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add-hora]');
      if (add) {
        e.preventDefault();
        const lista = add.closest('.campo').querySelector('.lista-horarios');
        lista.insertAdjacentHTML('beforeend', linhaHorario('08:00'));
      }
      const rem = e.target.closest('[data-remove-hora]');
      if (rem) { e.preventDefault(); rem.closest('.linha-horario').remove(); }
    });

    corpo.addEventListener('submit', (e) => {
      e.preventDefault();
      const saida = {};
      let erro = null;
      for (const c of campos) {
        const v = lerCampo(corpo, c);
        if (c.obrigatorio && (v === '' || v == null || (Array.isArray(v) && !v.length))) {
          erro = `Preencha o campo "${c.rotulo}".`;
          break;
        }
        saida[c.nome] = v;
      }
      if (!erro && aoValidar) erro = aoValidar(saida) || null;
      if (erro) { aviso(erro, 'erro'); return; }
      fechar(saida);
    });

    setTimeout(() => fundo.querySelector('input,select,textarea')?.focus(), 120);
  });
}

function linhaHorario(valor) {
  return `<div class="linha-horario">
    <input type="time" value="${esc(valor)}" class="entrada">
    <button type="button" class="botao-icone" data-remove-hora aria-label="Remover horário">✕</button>
  </div>`;
}

function renderCampo(c, valor) {
  const id = `campo-${c.nome}`;
  const dica = c.dica ? `<small class="campo__dica">${esc(c.dica)}</small>` : '';
  const rotulo = `<label class="campo__rotulo" for="${id}">${esc(c.rotulo)}${c.obrigatorio ? ' <span class="obrigatorio">*</span>' : ''}</label>`;
  const larg = c.largura === 'metade' ? ' campo--metade' : '';
  let entrada = '';

  switch (c.tipo) {
    case 'textoLongo':
      entrada = `<textarea id="${id}" class="entrada" rows="3" placeholder="${esc(c.placeholder || '')}">${esc(valor || '')}</textarea>`;
      break;
    case 'numero':
      entrada = `<input id="${id}" type="number" inputmode="decimal" class="entrada" value="${valor ?? ''}"
        ${c.min != null ? `min="${c.min}"` : ''} ${c.max != null ? `max="${c.max}"` : ''} step="${c.passo || 1}"
        placeholder="${esc(c.placeholder || '')}">`;
      break;
    case 'dinheiro':
      entrada = `<div class="entrada-prefixo"><span>R$</span>
        <input id="${id}" type="text" inputmode="decimal" class="entrada" value="${valor != null && valor !== '' ? String(valor).replace('.', ',') : ''}" placeholder="0,00"></div>`;
      break;
    case 'data':
      entrada = `<input id="${id}" type="date" class="entrada" value="${esc(valor || '')}">`;
      break;
    case 'hora':
      entrada = `<input id="${id}" type="time" class="entrada" value="${esc(valor || '')}">`;
      break;
    case 'selecao': {
      const ops = (c.opcoes || []).map((o) => {
        const v = typeof o === 'string' ? o : o.valor;
        const t = typeof o === 'string' ? o : o.texto;
        return `<option value="${esc(v)}" ${String(valor) === String(v) ? 'selected' : ''}>${esc(t)}</option>`;
      }).join('');
      entrada = `<select id="${id}" class="entrada">${c.placeholder ? `<option value="">${esc(c.placeholder)}</option>` : ''}${ops}</select>`;
      break;
    }
    case 'pessoa': {
      const ops = pessoasVisiveis().map((p) =>
        `<option value="${esc(p.id)}" ${valor === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('');
      entrada = `<select id="${id}" class="entrada"><option value="">Casa (nós dois)</option>${ops}</select>`;
      break;
    }
    case 'booleano':
      return `<div class="campo campo--switch${larg}">
        <label class="switch"><input id="${id}" type="checkbox" ${valor ? 'checked' : ''}><span class="switch__pista"></span></label>
        <div><span class="campo__rotulo">${esc(c.rotulo)}</span>${dica}</div></div>`;
    case 'horarios': {
      const horas = Array.isArray(valor) && valor.length ? valor : ['08:00'];
      entrada = `<div class="lista-horarios">${horas.map(linhaHorario).join('')}</div>
        <button type="button" class="botao botao--suave botao--pequeno" data-add-hora>+ Adicionar horário</button>`;
      break;
    }
    case 'diasSemana': {
      const sel = Array.isArray(valor) ? valor : [0, 1, 2, 3, 4, 5, 6];
      entrada = `<div class="dias-semana" id="${id}">${DIAS_SEMANA.map((d, i) =>
        `<label class="pilula-check"><input type="checkbox" value="${i}" ${sel.includes(i) ? 'checked' : ''}><span>${d}</span></label>`
      ).join('')}</div>`;
      break;
    }
    default:
      entrada = `<input id="${id}" type="text" class="entrada" value="${esc(valor ?? '')}" placeholder="${esc(c.placeholder || '')}">`;
  }
  return `<div class="campo${larg}">${rotulo}${entrada}${dica}</div>`;
}

function lerCampo(raiz, c) {
  const el = raiz.querySelector(`#campo-${CSS.escape(c.nome)}`);
  switch (c.tipo) {
    case 'dinheiro': return parseMoney(el.value);
    case 'numero': return el.value === '' ? null : Number(el.value);
    case 'booleano': return el.checked;
    case 'horarios':
      return [...raiz.querySelectorAll('.linha-horario .entrada')]
        .map((i) => i.value).filter(Boolean).sort();
    case 'diasSemana':
      return [...el.querySelectorAll('input:checked')].map((i) => Number(i.value));
    default: return el.value.trim ? el.value.trim() : el.value;
  }
}

/* ---------- Blocos visuais ---------- */

export function vazio(icone, titulo, texto, acao) {
  return `<div class="vazio">
    <div class="vazio__icone">${icone}</div>
    <h3>${esc(titulo)}</h3>
    <p>${esc(texto)}</p>
    ${acao ? `<button class="botao botao--primario" data-acao="${esc(acao.acao)}">${esc(acao.texto)}</button>` : ''}
  </div>`;
}

export function cartaoNumero({ rotulo, valor, sub, cor = 'neutro', icone = '' }) {
  return `<div class="metrica metrica--${cor}">
    <div class="metrica__topo">${icone ? `<span class="metrica__icone">${icone}</span>` : ''}<span class="metrica__rotulo">${esc(rotulo)}</span></div>
    <strong class="metrica__valor">${esc(valor)}</strong>
    ${sub ? `<span class="metrica__sub">${sub}</span>` : ''}
  </div>`;
}

export function barraProgresso(percentual, cor = 'primario') {
  const p = Math.max(0, Math.min(100, percentual));
  return `<div class="progresso"><div class="progresso__preenchido progresso__preenchido--${cor}" style="width:${p}%"></div></div>`;
}

export function etiqueta(texto, cor = 'neutro') {
  return `<span class="etiqueta etiqueta--${cor}">${esc(texto)}</span>`;
}

/*
  Gráfico de barras agrupadas em SVG puro — sem biblioteca, funciona offline.
  grupos: [{ rotulo, barras: [{ valor, cor, nome }] }]
  Cada grupo vira uma coluna do eixo, com suas barras lado a lado.
*/
export function graficoBarras(grupos, { altura = 140, formatar = fmtMoney } = {}) {
  if (!grupos.length) return '';
  const valores = grupos.flatMap((g) => g.barras.map((b) => Math.abs(b.valor)));
  const max = Math.max(...valores, 1);
  const base = altura - 18;          // linha de base, deixando espaço embaixo
  const util = altura - 30;          // altura máxima de uma barra
  const larguraGrupo = 100 / grupos.length;

  const barras = grupos.map((g, i) => {
    const n = g.barras.length;
    const vao = larguraGrupo * 0.18;                       // respiro entre grupos
    const largura = (larguraGrupo - vao * 2) / n;
    return g.barras.map((b, j) => {
      const h = (Math.abs(b.valor) / max) * util;
      const x = i * larguraGrupo + vao + j * largura;
      const y = base - Math.max(h, 0.8);
      return `<rect x="${x + largura * 0.1}" y="${y}" width="${largura * 0.8}" height="${Math.max(h, 0.8)}"
        fill="${b.cor || 'var(--cor-primaria)'}" opacity="${h < 0.9 ? '.35' : '1'}"
        ><title>${esc(g.rotulo)} · ${esc(b.nome || '')}: ${esc(formatar(b.valor))}</title></rect>`;
    }).join('');
  }).join('');

  return `<div class="grafico">
    <svg viewBox="0 0 100 ${altura}" preserveAspectRatio="none" class="grafico__svg" role="img"
      aria-label="Gráfico de barras por mês">
      <line x1="0" y1="${base}" x2="100" y2="${base}" stroke="currentColor" stroke-width=".4" opacity=".25"/>
      ${barras}
    </svg>
    <div class="grafico__eixo">${grupos.map((g) => `<span>${esc(g.rotulo)}</span>`).join('')}</div>
  </div>`;
}
