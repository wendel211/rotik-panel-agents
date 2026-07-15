# rotik-panel-agents

**Painel de Monitoramento de Agentes de IA** — Desafio Técnico Fullstack · Rotik

MVP que permite ver, por cliente, quais agentes de IA estão ativos, quanto cada um consumiu da cota
mensal do plano contratado, e bloquear novas execuções quando o limite é atingido.

**Stack:** Node.js + TypeScript (backend) · React + TypeScript (frontend) · PostgreSQL

> **Sobre a escolha da stack.** O desafio dá liberdade e cita Nuxt/Laravel como referência. Escolhi
> React + Node/TS — que também está na stack da Rotik — por dois motivos: é onde produzo com mais
> densidade no tempo sugerido, e manter TypeScript nas duas pontas permite compartilhar os tipos do
> contrato da API sem geração de código. PostgreSQL (e não MongoDB) porque o problema central é
> **cota transacional**: a regra de negócio depende de verificar um limite e incrementar um contador
> de forma atômica, que é um caso clássico de transação ACID em linha única.

---

## Status

Este repositório é construído **por etapas**, seguindo o enunciado. Cada etapa é revisada antes da
seguinte começar — por isso o histórico de commits é granular e o README cresce junto com o projeto.

| Etapa | Entrega | Status |
|---|---|---|
| **0** | **Discovery** | ✅ **Concluída — documentada abaixo** |
| 1 | Modelagem de dados (ER + justificativas) | ⏳ Próxima |
| 2 | Backend REST API | ⏳ |
| 3 | Frontend (SPA) | ⏳ |
| 4 | Integração | ⏳ |
| 5 | Qualidade, testes e debug | ⏳ |
| 6 | DevOps (CI, deploy, env) | ⏳ |
| 7 | Mentalidade de produto | ⏳ |

**Convenção de commits:** [Conventional Commits 1.0.0](https://www.conventionalcommits.org/pt-br/v1.0.0/)
— `<tipo>(<escopo>): <descrição no imperativo>`. Tipos em uso: `feat`, `fix`, `docs`, `test`,
`refactor`, `chore`, `ci`. O escopo identifica a área (`discovery`, `db`, `api`, `web`).

---

# Etapa 0 — Discovery

O briefing tem uma frase que decide o projeto inteiro:

> "Quando o cliente estourar o limite, o agente deveria parar de responder **(ou pelo menos a gente
> precisa saber que isso aconteceu)**."

Esse parêntese não é um detalhe de redação — é o time de Produto admitindo que não sabe se está
pedindo um **mecanismo de enforcement** ou um **painel de observabilidade**. São produtos
diferentes, com donos, riscos e custos diferentes. Quase todas as perguntas abaixo saem dessa dúvida,
e a maior parte do meu Discovery foi decidir como **não apostar tudo em uma das duas leituras**.

## 1. Perguntas ao stakeholder e suposições adotadas

> São 6 perguntas (o mínimo pedido é 5). Cada uma está aqui porque a resposta **mudaria código** —
> não é uma lista de checagem. Para cada uma registro o **custo de ter errado**, porque uma suposição
> barata de reverter e uma cara de reverter não merecem o mesmo cuidado — e é isso que decide quanto
> vale discutir antes de construir.

---

### 1. O limite mensal é do **cliente** (pool compartilhado) ou de **cada agente**?

**Por que importa:** define o schema, o enforcement e a UI. Se o pool é do cliente, um agente sozinho
pode derrubar todos os outros — e o CS precisa saber qual foi.

**O que o briefing diz:** as duas coisas, em frases diferentes.
- _"Cada **plano** tem um limite mensal"_ e _"quando o **cliente** estourar o limite"_ → limite do cliente.
- _"quantas execuções cada **agente** fez"_ e _"agentes de um cliente com seu consumo atual (execuções no mês vs. limite do plano)"_ → consumo por agente.

**Suposição adotada:** **a cota é do cliente, a atribuição é do agente.** O plano é contratado pelo
cliente, então o limite é um pool compartilhado e o enforcement olha o contador do cliente. Mas
mantenho um contador **por agente** em paralelo, porque a primeira pergunta do CS ao ver uma conta em
95% nunca é "quanto o cliente usou?" — é "**qual agente** está queimando isso?".

**Como isso concilia as duas leituras:** o dashboard mostra a cota do **cliente** (é ela que bloqueia)
e, em cada agente, quanto **aquele agente** consumiu do mesmo limite. Um agente em 60/100 ao lado de
outro em 22/100 é lido na hora como "o primeiro é o problema".

**Se eu estiver errado:** limite por agente exigiria mover o limite para o agente (ou uma tabela de
override). O contador por agente **já existiria** no modelo, então a migração é aditiva e o
enforcement muda de linha. **Custo baixo — foi de propósito.**

---

### 2. Quem senta na frente desse painel: o **time de CS da Rotik** ou o **cliente final**?

**Por que importa:** muda o modelo de autenticação inteiro. CS precisa de visão multi-tenant ("me
mostre todas as contas em risco"); cliente final precisa do oposto, isolamento estrito.

**O que o briefing diz:** de novo, os dois. _"fácil de usar pelo nosso time de CS"_ (interno), mas a
Etapa 2 pede _"um cliente não pode ver dados de outro"_ (self-service).

**Suposição adotada:** modelo **tenant-scoped**. A autenticação é por cliente, o token carrega o
identificador do cliente, e **toda** query é filtrada por ele. O painel de CS vem depois, como um
papel `admin` capaz de assumir a visão de um tenant.

**Por que nessa ordem:** isolamento é a decisão irreversível. Construir tenant-scoped e depois abrir
para um admin é aditivo (um claim de papel no token). Construir aberto e depois tentar "apertar" o
isolamento é uma auditoria de vazamento em cada endpoint. Quando não dá para perguntar, escolho o
caminho que erra para o lado seguro.

**Se eu estiver errado:** o CS troca de login para ver cada conta — chato, mas funciona. **Custo
baixo.** O erro inverso teria sido vazamento de dados entre clientes.

---

### 3. A Rotik **executa** o agente, ou só registra que ele executou?

**Por que importa:** é o parêntese do briefing. Se a Rotik está no caminho da requisição, a recusa
deste serviço **é** o "parar de responder". Se ela só recebe logs depois, bloquear aqui não para
nada — é só um carimbo, e o produto real é o alerta.

**Suposição adotada:** a Rotik **executa** ("plataforma que permite criar, configurar e monitorar
agentes" — quem configura, executa). Logo, este serviço é o **sistema de registro da cota**: o runtime
do agente registra a execução **antes** de responder ao usuário final, e uma recusa faz o agente parar.
Essa suposição é o que torna a Etapa 2 uma regra de negócio de verdade, e não um contador decorativo.

**Consequência que assumo junto:** esse endpoint entra no caminho crítico de latência de **todo**
atendimento da Rotik. É por isso que trato performance de leitura como requisito, e não como
otimização prematura.

**Se eu estiver errado:** a recusa vira sinalização e as execuções bloqueadas viram o produto
(alerta). O código não muda — muda o que o consumidor faz com a resposta. **Custo baixo**, e é
exatamente por isso que **registro a execução bloqueada mesmo bloqueando**: uma execução recusada
gravada atende às duas leituras do parêntese ao mesmo tempo, sem escolher entre elas.

---

### 4. O que conta como "uma execução"? Erro conta? Retry conta? A bloqueada conta?

**Por que importa:** isso é semântica de faturamento. Se erro conta, o cliente paga por falha da
Rotik. Se não conta, um agente quebrado vira compute infinito de graça.

**Suposição adotada:**

| Situação | Consome cota? | Por quê |
|---|---|---|
| Execução com sucesso | **Sim** | Óbvio. |
| Execução com erro (ex.: timeout do LLM) | **Sim** | O custo de inferência foi pago pela Rotik. Não cobrar transforma agente instável em prejuízo. |
| Execução **bloqueada** por limite | **Não** | Nunca chegou a rodar. Cobrar por uma recusa seria indefensável — e criaria o absurdo de a cota estourada se auto-alimentar. |
| Retry | **Sim**, cada tentativa | O modelo não distingue retry de chamada nova. |

**Se eu estiver errado:** "erro não conta" é uma mudança de uma linha, mas **corrige o histórico para
trás com dificuldade** — competências já fechadas ficariam inconsistentes. **Custo médio.** É a
suposição desta lista que eu mais gostaria de confirmar antes de faturar em cima dela.

---

### 5. "Mensal" é **mês calendário** ou **ciclo da assinatura** (aniversário do contrato)?

**Por que importa:** um cliente que assinou dia 22 espera que a cota vire dia 22, não dia 1º. Errar
isso gera ticket de suporte e disputa de fatura.

**Suposição adotada:** **mês calendário, ancorado em UTC.** É o que "limite mensal" significa em
linguagem natural, e basta para o MVP. Ancoro em UTC explicitamente porque a virada precisa ser
determinística: sem uma âncora única, ela aconteceria em horários diferentes conforme o fuso de quem
consulta, e um cliente poderia consumir duas cotas na fronteira. (Custo assumido: para um cliente em
São Paulo, a cota vira às 21h do último dia do mês.)

**Se eu estiver errado:** ciclo por aniversário exige trocar a competência por uma janela
`(início, fim)` derivada da data de assinatura, e reescrever a lógica de virada. **Custo médio-alto —
é a suposição estruturalmente mais cara desta lista.** Aceito porque a alternativa é modelar um ciclo
de billing completo (proração, upgrade no meio do ciclo) que está claramente fora do MVP.

---

### 6. O bloqueio é **hard** ou existe **overage / carência**?

**Por que importa:** um bloqueio hard derruba o atendimento do cliente em produção. Nenhuma empresa
corta o serviço do maior cliente às 3h da manhã sem uma decisão comercial consciente.

**Suposição adotada:** **hard block, sem overage.** O briefing é literal: _"o agente deveria parar de
responder"_. Toda execução recusada é registrada, o que dá ao Comercial a lista exata de **demanda
reprimida** — quanto o cliente *teria* consumido. Isso é gatilho de upsell com evidência, e é receita
que hoje se perde em silêncio.

**Se eu estiver errado:** overage é aditivo — um limite hard opcional no plano, ou um campo de
tolerância. E os dados para decidir **já estarão sendo coletados** nas execuções bloqueadas.
**Custo baixo.**

---

## 2. Entidades e conceitos de negócio identificados

| Entidade | O que é | Vira tabela? |
|---|---|---|
| **Cliente** | Empresa contratante. É a **fronteira de tenant** e o **titular da cota**. | ✅ sim |
| **Plano** | Catálogo comercial. Carrega o limite mensal de execuções. | ✅ sim |
| **Agente** | Agente de IA configurado por um cliente. Unidade de **atribuição** de consumo. | ✅ sim |
| **Execução** | Uma chamada ao agente. Tabela de fatos, append-only. | ✅ sim |
| **Limite** | Citado no briefing como conceito. | ❌ **atributo de Plano** |
| **Competência** (mês de referência) | A janela contra a qual a cota é medida. | ❌ **atributo** |
| **Bloqueio** | O evento "execução recusada por limite". | ❌ **estado de Execução** |

As quatro primeiras são diretas. **As três decisões de _não_ criar tabela são as que valem
discussão** — modelar demais é tão caro quanto modelar de menos:

- **Limite é atributo de Plano, não entidade.** O briefing diz "cada plano tem um limite mensal" — a
  cardinalidade é 1:1. Uma entidade `Limite` só se justificaria com múltiplos limites por plano
  (execuções _e_ tokens _e_ agentes), que é a evolução mais provável deste modelo. Não construo
  agora: é YAGNI, e promover um atributo a tabela depois é uma migração mecânica.

- **Competência não é entidade.** A tentação é criar `uso_mensal (cliente, mês, total)` — uma linha
  por cliente por mês. É um agregado com identidade própria e daria histórico de consumo de graça.
  **Rejeitei para o MVP:** o briefing pergunta "quantas execuções **este mês**", nunca "compare com o
  mês passado". Uma linha por mês exige um upsert no caminho crítico e ainda deixa "qual é o mês
  atual?" para o código resolver. Guardar a competência **junto do contador** responde a pergunta do
  briefing com uma única leitura. Quando histórico entrar no escopo, as execuções já contêm os fatos
  para reconstruir o passado.

- **Bloqueio é um estado de Execução, não entidade.** Uma tentativa recusada **é** uma tentativa de
  execução — tem agente, cliente e timestamp, exatamente como as outras. Modelar `Bloqueios` à parte
  duplicaria a estrutura e forçaria unir duas tabelas para responder "o que aconteceu com este agente
  hoje?", que é literalmente a pergunta que o CS faz.

---

## 3. Escopo do MVP

### ✅ Dentro

| Item | Por quê |
|---|---|
| Cadastro e listagem de agentes | Pedido explícito. |
| Registro de execução com **enforcement atômico de cota** | **É a regra central do desafio.** Todo o resto é acessório. |
| Bloqueio com status HTTP adequado + registro da tentativa recusada | Atende às duas leituras do parêntese do briefing de uma vez só. |
| Histórico de execuções paginado | Pedido explícito. É como o CS diagnostica. |
| Autenticação simplificada + isolamento por cliente | Sem isso, um "painel de CS" é um vazamento de dados entre contas. |
| Dashboard com % de consumo e indicação visual de bloqueio | É a tela que resolve a dor descrita no briefing. |
| Estados de loading, vazio e erro na UI | O briefing pede "fácil de usar". Uma tela branca sob falha não é. |
| Testes da regra de bloqueio | É a única regra cuja falha custa dinheiro diretamente. |
| Log estruturado na ação de bloqueio | Pedido explícito, e é o evento que o negócio precisa auditar. |
| CI com lint + testes | Pedido explícito. |

### ❌ Fora (e por quê)

| Item | Por que fica fora |
|---|---|
| **Runtime do agente de IA** | O desafio é o painel de monitoramento. A execução é simulada pelo endpoint de registro. |
| **Cobrança / overage / proração** | Depende inteiramente da pergunta 5 (ciclo mensal). Modelar billing sem definição de ciclo é construir a coisa errada com precisão. |
| **Alertas ativos (e-mail/Slack em 80%)** | Reconheço que provavelmente é o item de **maior valor real** — o briefing diz "ser **alertados**", e alerta é push, não tela. Mas exige canal, destinatário, deduplicação e antispam, nenhum deles definido. O MVP entrega o **threshold visual em 80%**; o alerta ativo é o passo seguinte óbvio. |
| **Painel multi-tenant de CS** | Ver pergunta 2. É aditivo depois, e a ordem inversa seria insegura. |
| **Gestão de planos pela UI** | Planos mudam raramente e são decisão comercial. Seed + SQL resolve. |
| **Conversão de tokens em R$** | O dado de token é capturado para não se perder, mas precificação não foi especificada. |
| **Retenção / particionamento do histórico** | Só importa em outra ordem de grandeza. Ver riscos. |
| **Refresh token / RBAC / OAuth** | O desafio dispensa explicitamente: "uma simplificação documentada é aceitável". |

---

## 4. Riscos e ambiguidades que decidi não resolver agora

Não são itens esquecidos — são decisões conscientes de adiar. Para cada um, o que me deixa
confortável em seguir sem resolver:

**1. O painel pode não ser o produto certo.**
O briefing pede "ser alertados", e alerta não é tela — é notificação. Existe risco real de construir
um dashboard que ninguém abre.
**Por que é razoável adiar:** é o desafio proposto, e o dashboard é pré-requisito honesto do alerta
(todo alerta precisa de um destino para onde apontar). Mas trato isso de frente na Etapa 7, e as
métricas que vou propor são desenhadas para **detectar** esse fracasso, não para escondê-lo.

**2. Divergência entre o consumo consolidado e os fatos registrados.**
Manter um contador em vez de contar as execuções na hora é o que torna a leitura barata (ver Etapa 1),
mas cria a possibilidade de o contador mentir — e ele é a base do faturamento.
**Por que é razoável adiar:** contador e execução são escritos na **mesma transação**, então o banco
já garante o invariante contra o caminho normal. O que falta é defesa contra bug de código, não
contra falha de infraestrutura. E como as execuções continuam registradas, a verdade é sempre
reconstruível — um job de reconciliação comparando contagem real vs. contador fecha o risco depois,
rodando fora do caminho crítico.

**3. Crescimento do histórico de execuções.**
É a tabela que mais cresce e nada a limita. Em escala de milhões/mês, storage e índices viram custo.
**Por que é razoável adiar:** a decisão de particionar depende de volume real, que não temos.
Particionar cedo é complexidade sem retorno. **E o modelo não bloqueia essa evolução:** a leitura de
cota **não depende** do histórico (é o ponto central da Etapa 1), então dá para particionar,
arquivar ou expurgar sem tocar no dashboard nem no enforcement.

**4. Concorrência entre registrar execução e mudar de plano.**
Se o Comercial faz upgrade no exato momento de um bloqueio, o resultado depende de quem commita
primeiro.
**Por que é razoável adiar:** no pior caso, uma execução é recusada milissegundos antes de um upgrade
que a teria permitido, e o runtime já trata recusa com retry. Nunca há estado corrompido. Impacto
real: aproximadamente zero.

**5. Ambiguidade de fuso na virada do mês.**
Ancorar a competência em UTC (pergunta 5) significa que, para um cliente em São Paulo, a cota vira às
21h do último dia.
**Por que é razoável adiar:** o custo é explicar isso ao cliente; a alternativa (competência por fuso
do cliente) espalha lógica de timezone por todo o enforcement. Prefiro uma âncora única, previsível e
documentada a uma correta e frágil.

---

> **Etapa 0 concluída.** A próxima etapa (Modelagem de dados) parte da suposição central registrada
> na pergunta 1 — cota do cliente, atribuição por agente — e do requisito de performance que ela
> impõe: consultar consumo mensal sem contar execuções em tempo real.
