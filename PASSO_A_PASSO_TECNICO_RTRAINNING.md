# RTrainning - Passo a passo tecnico e handoff

## 1. Estado validado

- Repositorio: `rafaelolv2511/treino-evolucao-mobile`
- Branch: `main`
- Commit entregue: `f9c86d4b24d30eafccb14415935bcd78ea4de86b`
- Commit anterior do cronometro em tela cheia: `b73677f`
- Producao: `https://treino-evolucao-mobile.vercel.app`
- Projeto Supabase: `yjnccmvlskhvmjbceztt`
- Migration nova: `20260711041750_rtrainning_tempo_calorias`

O ZIP deste handoff foi gerado apenas com arquivos versionados no Git e este documento. Ele nao inclui `.env.local`, `.git`, `.next`, `node_modules` ou `.vercel`.

## 2. O que foi implementado

### 2.1 Cronometro no modo tela cheia

O `RestTimer` foi movido para uma camada visual acima do portal do modo foco. O componente continua usando o mesmo estado do treino, mas agora recebe `z-index` superior ao fullscreen (`z-[10001]`). Assim, iniciar o descanso dentro do exercicio tambem exibe e atualiza o cronometro na tela cheia.

Commit: `b73677f Corrige cronometro no modo tela cheia`

### 2.2 Tempo real do treino

Foram adicionados estes campos opcionais em `workout_sessions`:

```sql
alter table public.workout_sessions
  add column if not exists started_at timestamptz,
  add column if not exists duration_seconds integer,
  add column if not exists calories_estimate numeric;

alter table public.workout_sessions
  add constraint workout_sessions_duration_seconds_nonnegative
  check (duration_seconds is null or duration_seconds >= 0),
  add constraint workout_sessions_calories_estimate_nonnegative
  check (calories_estimate is null or calories_estimate >= 0);
```

Regras aplicadas:

- O treino comeca somente quando a primeira carga valida e salva.
- Alterar apenas anotacao, repeticoes ou RIR nao inicia o cronometro.
- `started_at` e gravado apenas se ainda estiver nulo.
- Ao concluir, o sistema calcula `duration_seconds` pela diferenca entre conclusao e inicio.
- Durante o treino, o tempo decorrido aparece tanto na tela normal quanto no modo foco.

### 2.3 Estimativa de calorias

A funcao pura `estimateCalories` foi criada em `src/lib/calc.ts`.

Entradas consideradas:

- peso corporal mais recente do perfil;
- duracao real da sessao;
- quantidade de exercicios e series;
- cobertura de cargas preenchidas;
- volume relativo;
- densidade de series por minuto;
- RIR informado;
- exercicios isometricos ou sem carga externa.

O modelo usa MET dinamico entre `3.5` e `6.0` e a formula:

```text
kcal = MET x 3.5 x peso_em_kg / 200 x minutos
```

Regras de protecao:

- sem peso ou sem duracao valida, retorna `null`;
- o resultado e deterministico;
- a duracao usada apenas na estimativa calorica e limitada a 4 horas;
- a duracao real salva nao e truncada;
- o valor exibido recebe o rotulo `estimativa`.

### 2.4 Contagem semanal corrigida

O problema era de escopo de dados: a tela recebia somente o historico filtrado pelo plano ativo. Isso fazia a semana ignorar treinos concluidos em outros planos.

Correcao:

- o historico completo do perfil agora e passado separadamente para o resumo semanal;
- o historico usado para S1, S2, S3 etc. continua filtrado pelo plano ativo;
- `calendarWeekSummary` usa semana de segunda a domingo;
- concluidos no mesmo dia contam como um unico dia de treino.

### 2.5 Resumo e relatorios

O resumo de treino passou a mostrar:

- duracao formatada;
- calorias com `~` e `estimativa`;
- nomenclatura de recordes pessoais;
- os novos campos nas exportacoes e relatorios de sessoes concluidas.

### 2.6 Compartilhamento reformulado

O compartilhamento foi reconstruido em canvas `1080 x 1920`, apropriado para Stories.

Existem duas abas:

1. `Instagram`
2. `PNG transparente`

Cada aba possui tres conceitos visuais:

- `Pulso`
- `Impacto`
- `Fluxo`

Mudancas principais:

- o layout antigo em formato de ticket foi removido;
- cada conceito tem composicao propria;
- a aba Instagram permite compartilhar ou salvar;
- a aba transparente gera PNG com canal alfa real;
- no transparente, apenas elementos locais recebem fundos/scrims quando necessario;
- o fluxo de clipboard usa `ClipboardItem` com `Promise`, mantendo a chamada vinculada ao gesto do usuario no Safari;
- ha fallback para salvar quando compartilhamento ou clipboard nao estiverem disponiveis.

### 2.7 Rota de demonstracao

A rota `/demo` exibe o modal de compartilhamento com dados falsos e deterministas. Os dados deixaram de variar entre servidor e cliente, eliminando erro de hidratacao durante a validacao.

## 3. Arquivos principais alterados

- `src/components/RestTimer.tsx`: camada correta do cronometro em fullscreen.
- `src/components/ShareCard.tsx`: novo compartilhamento, canvas e seis variacoes.
- `src/components/SessionView.tsx`: inicio, tempo decorrido, conclusao e metricas.
- `src/components/TreinosView.tsx`: separacao entre historico do plano e historico semanal completo.
- `src/lib/calc.ts`: calorias, duracao e semana de calendario.
- `src/lib/data.ts`: persistencia de inicio, conclusao, duracao e calorias.
- `src/lib/types.ts`: tipos dos novos campos.
- `src/app/demo/page.tsx`: demonstracao deterministica.
- `supabase/migrations/20260711041750_rtrainning_tempo_calorias.sql`: alteracao do banco.
- `PROJECT_STATUS.md`: estado tecnico atualizado.

## 4. Validacoes executadas

### Git e GitHub

- `main` local alinhada com `origin/main`.
- Arvore de trabalho limpa antes da criacao deste documento externo ao pacote-fonte.
- Commit remoto confirmado: `f9c86d4b24d30eafccb14415935bcd78ea4de86b`.

### Build

```powershell
npm run build
```

Resultado: build Next.js concluido, sem erro de compilacao ou TypeScript.

Avisos nao bloqueantes observados:

- download de stylesheet do Google Fonts indisponivel no ambiente isolado;
- aviso de snapshot do cache do webpack.

### Testes de calculo

- 80 kg, treino vigoroso, 60 minutos: `444 kcal`.
- sem peso corporal: `null`.
- resultado deterministico: aprovado.
- exercicio isometrico/sem carga: estimativa valida.
- tres dias distintos concluidos entre 06/07/2026 e 12/07/2026: resultado `3`.
- segunda-feira seguinte: resultado `0`.

### Vercel

- Deployment de producao: `dpl_82arPZrTLtXdvdYF5x6PFMQJTeSs`.
- Estado: `READY`.
- Commit implantado: `f9c86d4b24d30eafccb14415935bcd78ea4de86b`.
- Nenhum erro de runtime encontrado na ultima hora consultada.
- `/demo`: HTTP 200.
- `/manifest.webmanifest`: HTTP 200.

### Supabase

Migration confirmada no historico:

```text
20260711041750 rtrainning_tempo_calorias
```

Colunas confirmadas em `workout_sessions`:

```text
started_at         timestamptz   nullable
duration_seconds   integer       nullable
calories_estimate  numeric       nullable
```

### Interface

- validacao visual em viewport de iPhone `390 x 844`;
- seis conceitos de compartilhamento renderizados;
- canvas transparente confirmado com canal alfa;
- controles sem estouro lateral;
- console do navegador sem erros apos a correcao da demo.

## 5. Como executar localmente

Requisitos: Node.js compativel com o projeto e credenciais do Supabase.

```powershell
npm ci
```

Crie `.env.local` na raiz, sem enviar esse arquivo ao Git:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
```

Desenvolvimento:

```powershell
npm run dev
```

Build de producao:

```powershell
npm run build
```

## 6. Banco e deploy

Para um Supabase novo, aplique as migrations em ordem a partir da pasta `supabase/migrations`. A ultima migration necessaria para esta entrega e:

```text
supabase/migrations/20260711041750_rtrainning_tempo_calorias.sql
```

Na Vercel, configure as mesmas variaveis publicas do Supabase nos ambientes desejados. O repositorio atual ja esta conectado e o push para `main` gerou o deployment de producao validado.

## 7. Pontos de atencao

- O gesto real de copiar/compartilhar deve receber uma rodada final em Safari fisico. A implementacao usa o padrao compativel com gesto do usuario, mas a automacao foi feita em navegador desktop.
- O linter do Supabase aponta politicas RLS permissivas com `USING (true)`. Isso ja existia e deve ser revisado antes de ampliar o uso para dados sensiveis ou usuarios nao confiaveis.
- O projeto usa Next.js `14.2.15`. Recomenda-se planejar atualizacao para uma versao corrigida e suportada, validando regressao antes do deploy.
- Nenhuma credencial foi incluida neste handoff.
- Um teste de mutacao direta no Supabase pelo terminal nao concluiu por bloqueio de rede do ambiente. Schema, migration, build, funcoes puras e producao foram verificados pelos conectores e pela aplicacao publicada.

## 8. Prompt copiavel para continuar no Claude

```text
Voce recebeu o projeto RTrainning no commit f9c86d4b24d30eafccb14415935bcd78ea4de86b.

Leia primeiro:
1. PASSO_A_PASSO_TECNICO_RTRAINNING.md
2. PROJECT_STATUS.md
3. supabase/migrations/20260711041750_rtrainning_tempo_calorias.sql

Contexto:
- Next.js 14 + TypeScript + Supabase + Vercel.
- Producao: https://treino-evolucao-mobile.vercel.app
- O cronometro de descanso ja funciona acima do portal de tela cheia.
- O inicio do treino e registrado na primeira carga valida salva.
- A conclusao persiste duracao e estimativa de calorias.
- A semana e calculada de segunda a domingo usando todo o historico do perfil.
- O compartilhamento possui 2 abas e 3 conceitos por aba, em canvas 1080x1920.
- O PNG transparente preserva canal alfa.

Antes de alterar:
- execute npm ci e npm run build;
- nao remova nem substitua migrations existentes;
- nao inclua .env.local ou chaves no Git;
- preserve o comportamento mobile e o modo foco fullscreen;
- teste em viewport 390x844;
- verifique console, compartilhamento, download e transparencia;
- trate as politicas RLS permissivas como divida de seguranca conhecida.

Ao terminar, entregue:
- resumo dos arquivos alterados;
- comandos/testes executados e resultados;
- migrations adicionais, se houver;
- riscos residuais;
- commit exato implantado na Vercel.
```
