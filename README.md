# Nossa Casa

Aplicativo pessoal para organizar a casa de um casal: agenda, farmácia, lista de
mercado, contas a pagar e painel financeiro — tudo num lugar só.

**Custo zero. Sem servidor, sem mensalidade, sem anúncio, sem cadastro.**
Os dados ficam guardados no próprio celular.

---

## O que ele faz

| Tela | Para que serve |
|---|---|
| **Início** | O resumo do dia: o que precisa de atenção, quanto entrou e saiu no mês, compromissos de hoje, doses de remédio, contas vencendo e a lista de mercado. |
| **Agenda** | Compromissos com hora, local, responsável, lembrete e repetição (diária, semanal, quinzenal, mensal, anual). Ao concluir um item que se repete, o próximo já é criado. |
| **Farmácia** | Remédios com horários das doses, dias da semana, período do tratamento e controle de estoque. Marcar a dose baixa o estoque; quando fica baixo, o app avisa. Repor pode lançar a despesa direto no financeiro. |
| **Mercado** | Lista de compras com entrada rápida (digita e aperta Enter), categorias, preço estimado e itens que vocês compram sempre. Ao finalizar a compra, ela entra no histórico e vira despesa no financeiro. |
| **Contas** | Contas fixas (todo mês) e avulsas, com dia de vencimento, categoria, responsável e baixa de pagamento. Mostra total do mês, quanto já foi pago, quanto falta e o que está atrasado. |
| **Financeiro** | Salários e outras rendas, gastos avulsos, evolução dos últimos 6 meses, gasto por categoria e limite de gasto por categoria. |
| **Ajustes** | Nomes de vocês dois, notificações, tema, backup e instalação. |

---

## Como colocar no ar de graça (GitHub Pages)

O app é feito só de arquivos estáticos, então o GitHub hospeda sem cobrar nada.

1. Acesse este repositório no GitHub.
2. Vá em **Settings** (Configurações) → **Pages**, no menu da esquerda.
3. Em **Source**, escolha **Deploy from a branch**.
4. Em **Branch**, escolha a branch onde está o código e a pasta `/ (root)`.
5. Clique em **Save** e espere um ou dois minutos.
6. O GitHub mostra o endereço, algo como:
   `https://julianojujuba.github.io/aplitcativocasa/`

Guarde esse endereço — é por ele que vocês dois vão abrir o app.

> O endereço é público (qualquer um que souber o link vê o *aplicativo*), mas
> **os dados de vocês não vão para lugar nenhum**: ficam só no celular de cada um.

---

## Como instalar no celular

Abra o endereço no navegador do celular e instale como aplicativo:

- **Android (Chrome):** menu **⋮** → **Instalar aplicativo** (ou *Adicionar à tela inicial*).
- **iPhone (Safari):** botão **Compartilhar** → **Adicionar à Tela de Início**.

Depois de instalado ele abre em tela cheia, com ícone próprio, e **funciona sem
internet** — a conexão só é necessária na primeira abertura.

---

## Notificações

Na primeira vez, toque em **Ativar** quando o app perguntar (ou vá em
**Ajustes → Notificações → Ativar notificações**).

O app avisa sobre:

- compromissos da agenda, no tempo de antecedência que você escolher;
- hora de cada dose de remédio;
- estoque de remédio acabando;
- contas chegando (padrão: 3 dias antes), vencendo hoje e atrasadas;
- dia em que o salário cai;
- um resumo pela manhã, no horário que você definir.

**Sendo honesto sobre o limite:** os avisos são gerados pelo próprio aparelho,
sem servidor de notificação (é isso que mantém o custo em zero). Na prática:

- No **Android**, com o app instalado, os avisos chegam normalmente, inclusive
  com o app fechado — o sistema acorda o app de tempos em tempos.
- No **iPhone**, é preciso **iOS 16.4 ou mais novo** e o app **instalado na tela
  de início**. Os avisos são mais espaçados que no Android.
- Em qualquer aparelho, abrir o app põe tudo em dia na hora.

Se quiser aviso garantido no minuto exato mesmo com o celular parado há dias,
seria preciso um serviço de envio (com custo ou conta em algum provedor). Do
jeito que está, é grátis para sempre.

---

## Vocês dois no mesmo app

Cada celular guarda os próprios dados. Para deixar os dois iguais:

1. No celular que está mais atualizado: **Ajustes → Enviar backup**
   (manda por WhatsApp, e-mail, o que for) ou **Baixar arquivo**.
2. No outro celular: abra o app → **Ajustes** e escolha:
   - **Juntar backup** — mantém o que já existe ali e acrescenta o que vier do
     arquivo (bom para o dia a dia);
   - **Restaurar backup** — apaga o que está no aparelho e deixa igual ao arquivo
     (bom para começar do zero no segundo celular).

Vale o mesmo para trocar de celular ou para guardar uma cópia de segurança.
**Faça um backup de vez em quando** — se o navegador limpar os dados do site, o
que estiver só ali se perde.

---

## Privacidade

- Nada sai do aparelho. Não existe servidor, conta, login nem coleta de dados.
- O armazenamento usado é o `localStorage` do navegador, isolado por site.
- Só existe uma saída de dados: quando **você** exporta o backup e escolhe para
  onde mandar.

---

## Para mexer no código

Não precisa instalar nada nem compilar: é HTML, CSS e JavaScript puro
(módulos ES nativos).

```bash
# rodar localmente
python3 -m http.server 8000
# depois abra http://localhost:8000
```

> Abrir o `index.html` direto pelo arquivo (`file://`) não funciona: os módulos
> e o service worker exigem `http://` ou `https://`.

### Organização

```
index.html               casca do app (cabeçalho, menu, área de conteúdo)
manifest.webmanifest     dados de instalação do app no celular
sw.js                    service worker: funcionamento offline e cliques nas notificações
css/styles.css           todo o visual (tema escuro padrão + tema claro)
assets/icons/            ícones do app
js/
  app.js                 navegação entre telas e inicialização
  store.js               dados: leitura, gravação, backup, migração
  financas.js            contas do mês: previsto, realizado, categorias, histórico
  notify.js              cálculo dos alertas e disparo das notificações
  ui.js                  modal, formulários, avisos, gráfico, blocos reaproveitados
  icones.js              ícones em SVG
  tema.js                tema claro/escuro
  views/                 uma tela por arquivo
```

### Como os dados são guardados

Uma única chave no `localStorage` (`casaApp:dados:v1`) com um objeto contendo
`eventos`, `medicamentos`, `doses`, `mercado`, `compras`, `contas`, `pagamentos`,
`rendas`, `recebimentos`, `transacoes`, `orcamentos`, `pessoas` e `config`.

Contas fixas não são copiadas mês a mês: cada conta existe uma vez, e o mês em
que ela aparece é calculado. O que fica gravado é o **pagamento** daquele mês.
Mesma ideia para as rendas e seus recebimentos. Assim mudar o valor de uma conta
não reescreve o histórico.
