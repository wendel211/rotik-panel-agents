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
