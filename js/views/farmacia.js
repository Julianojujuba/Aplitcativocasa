// Farmácia: remédios, horários das doses, controle de estoque e histórico.
import { obter, inserir, atualizar, remover, buscar, nomePessoa, corPessoa, alterar } from '../store.js';
import { abrirFormulario, confirmar, aviso, vazio, barraProgresso } from '../ui.js';
import { icone } from '../icones.js';
import { esc, hojeISO, fmtData, isoParaData, DIAS_SEMANA } from '../util.js';

export const titulo = 'Farmácia';
export const chaveIcone = 'pilula';

const UNIDADES = ['comprimido(s)', 'ml', 'gota(s)', 'cápsula(s)', 'sachê(s)', 'dose(s)', 'aplicação(ões)'];

function campos() {
  return [
    { nome: 'nome', rotulo: 'Remédio', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Losartana' },
    { nome: 'dosagem', rotulo: 'Dosagem', tipo: 'texto', placeholder: 'Ex.: 50mg — 1 comprimido', largura: 'metade' },
    { nome: 'pessoa', rotulo: 'De quem é', tipo: 'pessoa', largura: 'metade' },
    { nome: 'horarios', rotulo: 'Horários das doses', tipo: 'horarios', obrigatorio: true },
    { nome: 'diasSemana', rotulo: 'Em quais dias', tipo: 'diasSemana' },
    { nome: 'estoque', rotulo: 'Quantidade em casa', tipo: 'numero', min: 0, passo: 1, largura: 'metade' },
    { nome: 'unidade', rotulo: 'Unidade', tipo: 'selecao', opcoes: UNIDADES, largura: 'metade' },
    { nome: 'estoqueMinimo', rotulo: 'Avisar quando restar', tipo: 'numero', min: 0, passo: 1, largura: 'metade',
      dica: 'Aviso de reposição' },
    { nome: 'consumoPorDose', rotulo: 'Consome por dose', tipo: 'numero', min: 0, passo: 0.5, largura: 'metade' },
    { nome: 'inicio', rotulo: 'Começa em', tipo: 'data', largura: 'metade' },
    { nome: 'fim', rotulo: 'Termina em', tipo: 'data', largura: 'metade', dica: 'Deixe vazio se for contínuo' },
    { nome: 'obs', rotulo: 'Observações', tipo: 'textoLongo', placeholder: 'Ex.: tomar em jejum' }
  ];
}

async function novoMedicamento() {
  const v = await abrirFormulario({
    titulo: 'Novo remédio',
    campos: campos(),
    valores: {
      horarios: ['08:00'], diasSemana: [0, 1, 2, 3, 4, 5, 6], unidade: 'comprimido(s)',
      estoque: 30, estoqueMinimo: 5, consumoPorDose: 1, inicio: hojeISO()
    }
  });
  if (!v) return;
  inserir('medicamentos', v);
  aviso('Remédio cadastrado. Os lembretes já estão ativos.');
}

async function editarMedicamento(id) {
  const m = buscar('medicamentos', id);
  if (!m) return;
  const v = await abrirFormulario({ titulo: 'Editar remédio', campos: campos(), valores: m });
  if (!v) return;
  atualizar('medicamentos', id, v);
  aviso('Remédio atualizado.');
}

// Doses previstas para um dia, já sabendo quais foram tomadas.
function dosesDoDia(iso) {
  const d = obter();
  const diaSemana = isoParaData(iso).getDay();
  const saida = [];
  for (const m of d.medicamentos) {
    if (m.arquivado) continue;
    if (m.inicio && iso < m.inicio) continue;
    if (m.fim && iso > m.fim) continue;
    const dias = Array.isArray(m.diasSemana) && m.diasSemana.length ? m.diasSemana : [0, 1, 2, 3, 4, 5, 6];
    if (!dias.includes(diaSemana)) continue;
    for (const hora of (m.horarios || [])) {
      const dose = d.doses.find((x) => x.medicamentoId === m.id && x.data === iso && x.hora === hora);
      saida.push({ medicamento: m, hora, tomada: Boolean(dose), dose });
    }
  }
  return saida.sort((a, b) => a.hora.localeCompare(b.hora));
}

function alternarDose(medId, data, hora) {
  const d = obter();
  const med = buscar('medicamentos', medId);
  const existente = d.doses.find((x) => x.medicamentoId === medId && x.data === data && x.hora === hora);
  const consumo = Number(med?.consumoPorDose) || 0;

  if (existente) {
    remover('doses', existente.id);
    if (consumo && med.estoque != null) atualizar('medicamentos', medId, { estoque: Number(med.estoque) + consumo });
  } else {
    inserir('doses', { medicamentoId: medId, data, hora, registradoEm: Date.now() });
    if (consumo && med.estoque != null) {
      const novo = Math.max(0, Number(med.estoque) - consumo);
      atualizar('medicamentos', medId, { estoque: novo });
      const minimo = Number(med.estoqueMinimo) || 0;
      if (novo <= minimo) aviso(`Estoque de ${med.nome} está acabando (${novo} ${med.unidade || 'un'}).`, 'atencao');
    }
    aviso('Dose registrada. ✓');
  }
}

async function reporEstoque(id) {
  const m = buscar('medicamentos', id);
  if (!m) return;
  const v = await abrirFormulario({
    titulo: `Repor ${m.nome}`,
    campos: [
      { nome: 'quantidade', rotulo: 'Quantidade comprada', tipo: 'numero', min: 0, passo: 1, obrigatorio: true },
      { nome: 'preco', rotulo: 'Quanto custou', tipo: 'dinheiro', dica: 'Opcional — entra como despesa de Farmácia' }
    ],
    valores: { quantidade: 30 },
    textoOk: 'Repor'
  });
  if (!v) return;
  atualizar('medicamentos', id, { estoque: (Number(m.estoque) || 0) + Number(v.quantidade) });
  if (v.preco > 0) {
    inserir('transacoes', {
      tipo: 'despesa', descricao: `Farmácia: ${m.nome}`, valor: v.preco,
      data: hojeISO(), categoria: 'Farmácia', pessoa: m.pessoa || '', origem: 'farmacia'
    });
    aviso('Estoque reposto e despesa lançada no financeiro.');
  } else {
    aviso('Estoque reposto.');
  }
}

function cartaoMedicamento(m) {
  const estoque = Number(m.estoque) || 0;
  const minimo = Number(m.estoqueMinimo) || 0;
  const baixo = m.estoque != null && estoque <= minimo;
  const percentual = minimo > 0 ? Math.min(100, (estoque / (minimo * 4)) * 100) : 100;
  const dias = Array.isArray(m.diasSemana) ? m.diasSemana : [0, 1, 2, 3, 4, 5, 6];
  const todosDias = dias.length === 7;
  return `<article class="cartao cartao--med" data-id="${m.id}">
    <div class="cartao__topo">
      <div>
        <strong class="cartao__titulo">${esc(m.nome)}</strong>
        ${m.dosagem ? `<span class="cartao__sub">${esc(m.dosagem)}</span>` : ''}
      </div>
      <div class="cartao__acoes">
        <button class="botao-icone" data-editar="${m.id}" aria-label="Editar">${icone('lapis', 16)}</button>
        <button class="botao-icone" data-excluir="${m.id}" aria-label="Excluir">${icone('lixo', 16)}</button>
      </div>
    </div>
    <div class="chips">
      ${(m.horarios || []).map((h) => `<span class="chip chip--hora">${icone('relogio', 13)}${esc(h)}</span>`).join('')}
      ${m.pessoa ? `<span class="chip" style="--cor-chip:${corPessoa(m.pessoa)}">${esc(nomePessoa(m.pessoa))}</span>` : ''}
      <span class="chip">${todosDias ? 'Todos os dias' : dias.map((i) => DIAS_SEMANA[i]).join(', ')}</span>
    </div>
    ${m.estoque != null ? `
      <div class="estoque ${baixo ? 'estoque--baixo' : ''}">
        <div class="estoque__linha">
          <span>Estoque: <strong>${estoque}</strong> ${esc(m.unidade || '')}</span>
          <button class="botao botao--suave botao--pequeno" data-repor="${m.id}">+ Repor</button>
        </div>
        ${barraProgresso(percentual, baixo ? 'perigo' : 'ok')}
        ${baixo ? `<small class="alerta-texto">${icone('aviso', 13)} Estoque baixo — hora de comprar mais.</small>` : ''}
      </div>` : ''}
    ${m.obs ? `<p class="cartao__nota">${esc(m.obs)}</p>` : ''}
    ${m.fim ? `<small class="cartao__rodape">Tratamento até ${fmtData(m.fim)}</small>` : ''}
  </article>`;
}

export function render(raiz) {
  const d = obter();
  const hoje = hojeISO();
  const doses = dosesDoDia(hoje);
  const tomadas = doses.filter((x) => x.tomada).length;
  const agora = new Date().toTimeString().slice(0, 5);

  raiz.innerHTML = `
    <section class="painel">
      <div class="painel__topo">
        <h3>Doses de hoje</h3>
        <span class="painel__contador">${tomadas}/${doses.length}</span>
      </div>
      ${doses.length ? `
        ${barraProgresso(doses.length ? (tomadas / doses.length) * 100 : 0, 'ok')}
        <div class="doses">
          ${doses.map((x) => {
            const passou = !x.tomada && x.hora <= agora;
            return `<button class="dose ${x.tomada ? 'is-tomada' : ''} ${passou ? 'is-atrasada' : ''}"
              data-dose="${x.medicamento.id}" data-hora="${x.hora}">
              <span class="dose__hora">${esc(x.hora)}</span>
              <span class="dose__nome">${esc(x.medicamento.nome)}</span>
              <span class="dose__marca">${x.tomada ? '✓' : (passou ? '!' : '')}</span>
            </button>`;
          }).join('')}
        </div>` : '<p class="texto-suave">Nenhuma dose programada para hoje.</p>'}
    </section>

    <h3 class="secao-titulo">Meus remédios</h3>
    ${d.medicamentos.filter((m) => !m.arquivado).length
      ? d.medicamentos.filter((m) => !m.arquivado).map(cartaoMedicamento).join('')
      : vazio(icone('pilula', 40), 'Nenhum remédio cadastrado',
          'Cadastre os remédios da casa para receber lembrete na hora certa e controlar o estoque.',
          { acao: 'novo', texto: '+ Cadastrar remédio' })}

    <button class="botao-flutuante" data-acao="novo" aria-label="Novo remédio">+</button>`;

  raiz.onclick = (e) => {
    if (e.target.closest('[data-acao="novo"]')) { novoMedicamento(); return; }
    const dose = e.target.closest('[data-dose]');
    if (dose) { alternarDose(dose.dataset.dose, hoje, dose.dataset.hora); return; }
    const rep = e.target.closest('[data-repor]');
    if (rep) { reporEstoque(rep.dataset.repor); return; }
    const ed = e.target.closest('[data-editar]');
    if (ed) { editarMedicamento(ed.dataset.editar); return; }
    const x = e.target.closest('[data-excluir]');
    if (x) {
      const m = buscar('medicamentos', x.dataset.excluir);
      confirmar({
        titulo: 'Excluir remédio',
        mensagem: `Excluir "${m?.nome}" e todo o histórico de doses dele?`,
        textoOk: 'Excluir', perigo: true
      }).then((ok) => {
        if (!ok) return;
        alterar((dados) => { dados.doses = dados.doses.filter((y) => y.medicamentoId !== x.dataset.excluir); });
        remover('medicamentos', x.dataset.excluir);
        aviso('Remédio excluído.');
      });
    }
  };
}

export { novoMedicamento };
