# PROJECT_STATUS.md

## Rodada 14/07/2026 — sugestão de carga por séries + diagnóstico de deploy parcial

### Diagnóstico: produção com deploy parcial
Sintomas reportados (sem play, sem contador, conclusão em tela cheia sem compartilhar) batiam 100% com código antigo. Verificado no GitHub (raw) no commit em produção `d2dae51` ("Add files via upload"): `ShareCard.tsx` e `calc.ts` atualizados, mas `WorkoutTimerBar.tsx` inexistente (404), `SessionView.tsx` e `ui.tsx` na versão antiga — o upload pela interface web do GitHub perdeu parte da estrutura. Nenhum bug na implementação; é preciso subir o pacote completo.

### Sugestão de carga inteligente (por séries)
`suggestLoad` reescrito: em vez de ancorar numa carga isolada (a maior da semana), agora usa TODAS as séries válidas:
- e1RM por série via Epley com esforço efetivo: `carga × (1 + (reps + RIR)/30)`; RIR ausente assume 2.
- Mediana dos e1RM da sessão (mata o outlier "primeira série pesada demais").
- Mistura 70/30 com a sessão anterior para estabilidade.
- Carga sugerida = e1RM para o meio da faixa alvo de reps com o RIR alvo do exercício (novo parâmetro `targetRir`, passado pelo SessionView).
- Viés de ±2,5% quando a mediana de reps estoura o teto (com folga) ou fica abaixo do piso.
- Trava de segurança de ±10% sobre a carga típica (mediana de cargas da última sessão) e arredondamento a 0,5 kg.
- Sem reps registradas → "manter" honesto; sem histórico → null.
Testes (tsx): 1ª série pesada não ancora (manter 50); acima do teto sobe (+10% travado); abaixo do piso reduz; cravado mantém; 2 sessões misturam; determinístico.

---

## Rodada 13/07/2026 — play + contador global, cardio nas calorias e correção do fluxo de conclusão

### Bug estrutural corrigido: `useBackClose` em cascata
Todo `popstate` disparava o `onClose` de **todas** as camadas abertas (modo foco, sessão, modais). Ao concluir pelo modo foco, o `history.back()` de consumo fechava o resumo recém-aberto e a própria sessão — por isso a conclusão "voltava tudo até o menu" sem mostrar resumo/compartilhar. Agora há uma pilha global de camadas: só a camada do topo responde ao gesto de voltar, e o `back()` interno de consumo não fecha camada nenhuma (`consumingBack`). O resumo com o botão Compartilhar permanece aberto após concluir.

### Outra desconexão corrigida: sessão do dia não era readotada
Ao reabrir a tela da sessão no meio do treino, o app mostrava o seletor de data de novo (o `workoutSession` começava nulo). Agora um efeito readota automaticamente a sessão em andamento (started_at sem completed_at) ou a sessão de hoje.

### Play + contador geral (estilo app Fitness)
- Botão **Iniciar** (play) na linha de progresso: grava `started_at` via `startWorkoutTimer` (update com `is started_at null`, atômico). O fallback da primeira carga continua valendo para quem não aperta play.
- Contador ao vivo em `m:ss`/`h:mm:ss` (`formatElapsed`), tick de 1s, ponto pulsante.
- **`WorkoutTimerBar`** (novo componente): pílula flutuante global no rodapé do perfil, visível em todas as telas (Treinos, Evolução, lista de sessões) enquanto houver treino em andamento. Tocar no tempo abre a sessão; **Encerrar** abre a sessão já no passo de conclusão (navegação via `sessionNav`/`concludeSignal` — page → TreinosView → SessionView).

### Cardio na estimativa de calorias
- Novo passo ao concluir: modal "Fez cardio hoje?" (Não fiz / Esteira / Bike / Escada + minutos + km opcional).
- Colunas novas em `workout_sessions`: `cardio_type` (check esteira/bike/escada), `cardio_minutes` (>0), `cardio_km` (>0). Migration `20260713100000_rtrainning_cardio.sql` **já aplicada no Supabase** (`rtrainning_cardio`) e refletida no `SUPABASE_SCHEMA.sql`.
- `estimateCalories` ganhou componente de cardio com METs documentados (Compendium): esteira por velocidade (caminhada `2 + 0,5×v`; corrida ≈ v km/h, teto 12; sem km 4,5), bike por velocidade (4 / 6,8 / 8 / 10; sem km 6,8), escada 9 fixo. Minutos de cardio são descontados do componente de musculação (piso zero) para não contar o mesmo minuto duas vezes; cardio limitado a 3h na estimativa.
- Resumo de conclusão mostra a linha de cardio quando informado.

### Salvar direto na galeria
O botão Salvar do compartilhamento não abre mais o PNG numa aba: em iOS/Android ele abre a folha nativa com o arquivo, onde "Salvar imagem" grava direto nas Fotos (não existe API web que escreva na galeria sem essa etapa). A dica aparece antes da folha abrir; cancelar a folha não dispara fallback. Download em aba ficou apenas como fallback de desktop/navegadores sem Web Share de arquivos.

### Validações desta rodada
- Testes ad-hoc (tsx): 80 kg/60 min sem cardio → 449 kcal; +corrida 20 min/3,3 km → 563; caminhada → 417; bike 30 min/10 km → 545; escada 15 min → 517; sem peso → null; cardio maior que a sessão não explode (480); determinístico; `formatElapsed` 0:00/0:59/7:42/1:07:05.
- `npm run build` limpo (6 rotas; aviso de Google Fonts é só do sandbox).
- Migration confirmada por consulta ao information_schema (3 colunas presentes).
- Pendente de teste físico: barra flutuante + gesto de voltar no Safari do iPhone real.

---

## Rodada 11/07/2026 — revisão pós-handoff (base: commit f9c86d4)

Revisão do compartilhamento novo (2 abas × 3 conceitos) com 4 correções pontuais:

1. **`bg-white/6` → `bg-white/10`** no seletor de conceitos do ShareCard e num chip do SessionView. `/6` não existe na escala de opacidade do Tailwind 3 — a classe não gerava CSS e o fundo simplesmente não aparecia.
2. **Conceito Impacto — tempo gigante ajustado à largura** (`fitFont`): valores como "1h 12min" em 250px estouravam os 1080px do canvas. Agora a fonte reduz em passos de 10px até caber em 940px.
3. **Conceito Impacto (Instagram) — pontos do gráfico legíveis no fundo claro:** os pontos brancos ficavam invisíveis sobre a metade inferior clara (#F4F7FA). Em fundo claro, os pontos agora são escuros com anel ciano (`drawLineChart` ganhou o parâmetro `lightBackground`).
4. **Sem instrução interna vazando para a imagem compartilhável:** o fallback "REGISTRE O PESO PARA ESTIMAR" (quando não há calorias) era impresso no Story. Substituído pela métrica real `X/Y exercícios · REGISTRADOS HOJE`. A dica de registrar o peso continua existindo apenas na interface do app.

Validação: `npm ci` + `npm run build` limpos (6 rotas; o build local exige `.env.local` com as vars do Supabase para o prerender). Restante da entrega do handoff (tempo real com `started_at` atômico via `.is(..., null)`, `estimateCalories` MET 3.5–6, semana de calendário com histórico completo do perfil, migration `20260711041750_rtrainning_tempo_calorias`) revisado e aprovado sem alterações.

Pendências ativas: teste físico de copiar/compartilhar no Safari do iPhone; RLS permissiva (dívida conhecida); atualização futura do Next 14.2.15.

---

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

---

## Atualização — novas funcionalidades (rodada mais recente)

Implementadas e testadas (build ok):

1. **PR pessoal:** ao registrar num exercício uma carga maior que qualquer carga anterior dele, aparece o selo discreto "PR batido" no card (aba Treinos). A primeira carga não conta como PR. Lógica em `calc.ts` (`personalRecordBefore`, `isNewRecord`).
2. **Resumo ao concluir o treino:** botão "Concluir treino (X/Y)" no fim da aba Exercícios abre um card com exercícios registrados, cargas que subiram, PRs batidos, tempo total e estimativa de calorias. Em `SessionView.tsx`.
3. **Ranking por evolução:** a página de ranking agora tem duas abas — "Check-ins" (frequência, como antes) e "Evolução %" (ganho médio de carga no período). Cada uma cruza com Semana/Mês/Ano. Novo helper `listFullHistoryAllProfiles` em `db.ts` e `overallEvolutionPct` em `calc.ts`.
4. **Aviso de estagnação:** banner gentil na aba Evolução listando exercícios do plano atual parados há 3+ semanas ("X parado em Nkg há 3 semanas — considere variar"). Usa `stagnantExercises` em `calc.ts` sobre o histórico completo.

Também: os gráficos de evolução agora usam o **histórico completo do perfil** (todos os planos), então não zeram ao trocar de treino; e há uma página **/demo** com 8 semanas simuladas (inclui um exercício estagnado de propósito para mostrar o aviso) acessível pela home.

### Arquivos alterados nesta rodada
- `src/lib/calc.ts` (PR, estagnação, evolução geral)
- `src/lib/db.ts` (`listFullHistoryAllProfiles`)
- `src/lib/demoData.ts` (dados de demonstração)
- `src/components/SessionView.tsx` (selo PR + resumo de conclusão)
- `src/components/EvolucaoView.tsx` (aviso de estagnação + histórico completo)
- `src/components/Icons.tsx` (ícones medal, flame, alert)
- `src/app/ranking/page.tsx` (abas Check-ins/Evolução)
- `src/app/p/[id]/page.tsx` (carrega histórico completo)
- `src/app/page.tsx` (links de ranking e demo)
- `src/app/demo/page.tsx` (nova página de demonstração)

---

## Atualização — RTrainning (rebrand + pacote social)

Implementado e testado (build ok, 6 rotas):

1. **Rebrand RTrainning:** novo nome no app, manifest e metadados; novo logo (monograma R em traço técnico + barras de evolução, gradiente ciano→violeta) em todos os tamanhos de ícone.
2. **Modo foco (tela cheia):** tocar num exercício abre em tela cheia; deslizar para cima/baixo troca de exercício com snap (estilo TikTok/Reels). Indicador "3/8" no topo, campos maiores para uso na academia. Ao salvar com dados, o card inteiro fica esverdeado (na lista também).
3. **Progresso do dia:** barra fina e discreta acima da lista com "X/Y · N%".
4. **Conclusão com regra:** "Concluir treino" só registra o check-in com ≥40% dos exercícios preenchidos (aviso gentil se faltar); grava `completed_at` na sessão.
5. **Ranking:** check-in agora = dia com treino concluído (máx. 1/dia, datas distintas); filtro por grupo (chips "Todos" + grupos) nas duas abas.
6. **Grupos de perfis:** criar grupos na home (trabalho, amigos…), perfis organizados por seção; mover perfil de grupo no lápis do card; grupo vazio pode ser removido.
7. **Senha (PIN) opcional por perfil:** 4-6 dígitos, definida na criação ou no lápis; pedida ao abrir o perfil (hash SHA-256, sem texto puro no banco); cadeado no card.
8. **Edição rápida do exercício:** além de nome/descrição, agora edita a quantidade de séries (stepper −/+).
9. **Sugestão de carga com repetições:** considera RIR e reps vs faixa alvo (teto da faixa → subir; abaixo do piso → reduzir; testado).
10. **Compartilhamento "instagramável":** ao concluir, o botão Compartilhar abre as abas Instagram e PNG transparente, com 3 conceitos modernos em cada formato, todos em 1080×1920. Stories podem ser compartilhados/salvos; overlays transparentes podem ser copiados/salvos.

Banco: migration `rtrainning_grupos_pin_conclusao` aplicada (completed_at, profile_groups, group_id, pin_hash).

Arquivos alterados: `src/lib/{calc,db,types}.ts`, `src/components/{SessionView,ShareCard,Icons}.tsx`, `src/app/{page,layout}.tsx`, `src/app/ranking/page.tsx`, `public/{icon.svg,icon-*.png,apple-touch-icon.png,favicon-32.png,manifest.webmanifest}`.

---

## Atualização — correções de UX do modo foco + marca

1. **Gesto de voltar (iOS):** navegação interna integrada ao histórico do navegador — arrastar da borda agora fecha o modo foco → volta pra sessão → volta pra lista, em vez de sair do app (hook `useBackClose` em ui.tsx).
2. **Modo foco redesenhado:** header fixo com botão voltar, nome da sessão + grupo muscular atual e posição "3/8"; barra de progresso do dia + trilho de bolinhas por exercício (atual = ciano alongado, feito = verde, tocável para pular); cada slide preenche a tela com card centralizado, rodapé de ações fixo e separador "▼ próximo: nome" entre exercícios.
3. **Verde de verdade:** ao salvar com carga, o card inteiro ganha borda/glow esverdeado permanente, chip "Feito", pílula da semana verde e o botão vira "Salvo — atualizar".
4. **Avanço automático:** depois de salvar com carga, rola sozinho para o próximo exercício (750ms para ver o verde).
5. **Cancelar treino de hoje:** link discreto abaixo do Concluir apaga a sessão do dia (cargas + check-in) com confirmação; histórico anterior intacto.
6. **Marca nova:** símbolo "pulso de evolução" (linha ascendente em degraus + seta + nó de dado, sem R literal) e wordmark RTrainning com **RT** em gradiente — aplicados na home, no ícone do app (todas as resoluções) e no rodapé dos cartões compartilháveis.

Arquivos: `src/components/{SessionView,ui,Brand,ShareCard}.tsx`, `src/components/TreinosView.tsx`, `src/app/page.tsx`, `public/icon*`.

---

## Atualização — tempo, calorias, semana de calendário e compartilhamento

1. **Tempo total persistido:** `workout_sessions.started_at` começa na primeira carga salva; `duration_seconds` é materializado na conclusão e sobrevive a reload. O timer de descanso permanece independente.
2. **Calorias estimadas:** `estimateCalories` usa MET entre 3,5 e 6,0, peso, duração, volume, séries e RIR. Sem peso, o resultado é `null`; toda exibição usa `~kcal` e o rótulo estimativa.
3. **Semana segunda→domingo:** o indicador de conclusão/compartilhamento usa o histórico completo do perfil e conta datas concluídas distintas. S1..Sn, ranking, evolução e regra de 40% não foram alterados.
4. **Meta semanal:** usa a quantidade de sessões do plano ativo, com mínimo 1. Meta configurável pelo usuário ficou registrada como possibilidade futura.
5. **Compartilhamento reformulado:** duas abas, 3 Stories completos + 3 overlays com alpha real. Instagram oferece Compartilhar/Salvar; PNG transparente oferece Copiar/Salvar com fallback para Safari.
6. **Nomenclatura:** conclusão, registro e compartilhamento usam "PR batido"/"PRs batidos" sem alterar o cálculo.
7. **Demo:** a rota `/demo` permite abrir e verificar os seis conceitos com dados fictícios de tempo, calorias e semana.

Banco: migration `rtrainning_tempo_calorias` (`20260711041750`) aplicada no Supabase.
