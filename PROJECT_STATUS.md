# PROJECT_STATUS.md

Estado real da implementação em 03/07/2026.

## ✅ Implementado com sucesso

- **Perfis (até 8):** criação, remoção com confirmação, seleção por nome em cards Liquid Glass. Dados isolados por `profile_id` em todas as tabelas (FKs com `on delete cascade`).
- **Importação de JSON por perfil:** upload de arquivo ou colar texto; validação campo a campo com mensagens claras (ex.: `Campo obrigatório faltando em sessions[0].exercises[1]: "exerciseId"`); checa `sessionKey` A–E, `exerciseId` único no plano e `mobilityId` único na sessão. O JSON fica salvo no perfil (`training_plans.source_json`).
- **Preservação do ciclo anterior:** ao importar um novo JSON sobre um plano com registros, o relatório completo é salvo em `exported_reports` e baixado em `.md` automaticamente antes da troca.
- **Área Treinos:** sessões dinâmicas de A até E conforme o JSON; cada sessão com abas **Exercícios** e **Mobilidade**.
- **Data do treino:** pedida antes da primeira carga do dia; a mesma data vale para toda a sessão; alimenta semana (S1 = primeira data do plano ativo, blocos de 7 dias), gráficos e relatórios.
- **Timer de descanso:** presets 1:00 / 1:30 / 2:00, barra de progresso, vibração ao fim (quando o celular suporta), e botão por exercício que aciona o timer com o `suggestedRestSeconds` do JSON.
- **Registro de cargas:** faixa semanal S1…Sn com pílulas (semana atual em destaque, herdadas tracejadas com rótulo "mantida"); registro **por série** (carga, reps, RIR); anotação por exercício; card mostra nome, grupo principal e secundários, séries, reps, RIR alvo, descanso e lápis de edição de nome/descrição.
- **Carga não preenchida:** tratada como "mantida da semana anterior" apenas para análise (nunca como recorde) — implementado na camada de cálculo (`weeklySeriesForExercise`, flag `inherited`).
- **Sugestão por RIR:** discreta, em texto ("Sugestão: tentar 24kg"); RIR ≥ 3 → +5%; RIR 2 → manter ou +2,5%; RIR 0–1 → manter ou −5%; sem histórico, sem sugestão; arredondamento em 0,5 kg.
- **Edição geral do treino:** mover exercício entre sessões, adicionar, remover, editar nome/grupo/séries/reps/descanso/RIR — salvo apenas no perfil atual.
- **Área Evolução:** peso corporal por data com gráfico; gráficos por **mês/ano** de evolução por exercício, por grupo muscular (carga média) e geral; bloco **Força** com % de evolução por grupo (primeira carga válida vs. mais recente, por `exerciseId`); observações gerais e de evolução/dores com salvamento automático.
- **Exportar evolução:** JSON estruturado + Markdown com todos os itens do escopo (período, treino base, pesos, cargas iniciais/recentes, %, mantidas, mais evoluídos, estagnados, anotações por exercício e do perfil, resumo final pronto para colar no ChatGPT). Também salvo em `exported_reports`.
- **Supabase:** schema completo aplicado no projeto **"musculacao projeto"** (`yjnccmvlskhvmjbceztt`, us-east-2) via migration `treino_evolucao_schema_inicial` — as 8 tabelas do escopo + índices + RLS com política aberta (app sem login, por escopo).
- **Build:** `npm run build` passou sem erros de compilação nem de tipos.
- **Repositório:** estrutura pronta para GitHub (`.gitignore`, `.env.example`, README, schema, exemplo de JSON).

## ⚠️ Decisões tomadas (dentro do escopo, mas vale saber)

- **Fontes:** o ambiente de build aqui bloqueia o download do Google Fonts pelo `next/font`, então as fontes (Space Grotesk + Inter) são carregadas via `<link>` no `<head>`. Funciona normalmente na Vercel; se preferir `next/font`, é uma troca simples no `layout.tsx`.
- **`carried_forward` em `set_logs`:** a coluna existe conforme o modelo pedido, mas o app **não grava linhas fantasma** de séries herdadas — a herança é calculada em tempo de análise (mais seguro, sem duplicar dados). A coluna fica disponível caso se queira materializar isso no futuro.
- **Notas do perfil:** o modelo pedia 1 nota por perfil; o escopo pedia 2 campos (geral + evolução/dores). Adicionei a coluna `note_type` com unique `(profile_id, note_type)` para suportar os dois campos sem tabela extra.
- **`.env.local`** já vem preenchido com a URL e a anon key do projeto "musculacao projeto" (e está no `.gitignore`, então não sobe para o GitHub).

## ❌ O que deu erro / não pôde ser concluído aqui

- **Deploy na Vercel:** o ambiente desta conversa não tem acesso de rede à API da Vercel, então o deploy não pôde ser executado daqui. O projeto está 100% pronto para deploy — passos exatos em `PROXIMOS_PASSOS.md` (leva ~5 minutos via GitHub → Vercel).
- **Push para o GitHub:** mesmo motivo (sem credenciais git no ambiente). Comandos prontos no `PROXIMOS_PASSOS.md`.
- **Teste ponta a ponta com o Supabase real:** o sandbox não alcança `*.supabase.co`, então os fluxos foram validados por build/tipos e revisão de lógica, não com dados reais. Primeiro teste real: criar um perfil na tela inicial após o deploy (ou `npm run dev` local).

## 📋 Pendências (se houver problema no primeiro uso)

1. Testar o fluxo completo com dados reais: criar perfil → importar `exemplo-treino.json` → registrar cargas → conferir gráficos e exportação.
2. Se alguma chamada ao Supabase falhar com erro de permissão, conferir se as políticas RLS "acesso_publico_*" existem (elas foram criadas na migration).

## 🔄 Como continuar o projeto em uma próxima conversa

Cole este contexto:

> Tenho o app "treino-evolucao-mobile" (Next.js 14 + TypeScript + Tailwind + Supabase). Supabase: projeto "musculacao projeto" (ref yjnccmvlskhvmjbceztt), schema já aplicado (migration treino_evolucao_schema_inicial) com as tabelas profiles, training_plans, body_metrics, workout_sessions, exercise_logs, set_logs, profile_notes, exported_reports — todas com RLS aberto para anon (app sem login). Estrutura: páginas em `src/app` (/ = perfis, /p/[id] = área do perfil com abas Treinos/Evolução), componentes em `src/components` (SessionView, TreinosView, EvolucaoView, ImportPlan, PlanEditor, RestTimer, ui), lógica em `src/lib` (types, validatePlan, db, calc, report). Regras principais: semana S1 = primeira data do plano ativo em blocos de 7 dias; carga não preenchida é herdada só para análise (flag inherited em calc.ts); sugestão por RIR em calc.ts; evolução = ((recente − inicial)/inicial)×100 por exerciseId. Preciso de: [descreva a mudança].
