# Treino Evolução Mobile

Aplicação web **mobile-first** para usar durante o treino de musculação: registrar cargas por semana (S1, S2, S3…), acompanhar a evolução por exercício e por grupo muscular, e exportar um relatório completo pronto para pedir um novo treino ao ChatGPT.

- Até **8 perfis**, cada um com seu próprio treino (JSON), registros, gráficos e evolução — dados totalmente isolados por `profile_id`.
- Sem login/senha: o perfil é selecionado pelo nome.
- Estética Liquid Glass, botões grandes e poucos cliques para uso na academia.

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Supabase (persistência) · Vercel (deploy) · Recharts (gráficos)

## Como instalar e rodar localmente

```bash
git clone <url-do-repositorio>
cd treino-evolucao-mobile
npm install
cp .env.example .env.local   # e preencha com os valores do Supabase
npm run dev
```

Abra http://localhost:3000 no celular ou no navegador (modo responsivo).

## Como configurar o Supabase

1. Crie (ou use) um projeto em https://supabase.com.
2. No **SQL Editor**, execute o conteúdo de `SUPABASE_SCHEMA.sql`.
   - Se estiver usando o projeto **"musculacao projeto"** já existente, o schema **já foi aplicado** (migration `treino_evolucao_schema_inicial`) — não precisa rodar de novo.
3. Em **Project Settings → API**, copie a **Project URL** e a **anon key**.
4. Preencha o `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

> Observação: por escopo, o app não tem autenticação. As tabelas usam RLS com política aberta para a anon key. Não use este banco para dados sensíveis.

## Como subir para o GitHub

```bash
cd treino-evolucao-mobile
git init
git add .
git commit -m "Treino Evolução Mobile — versão inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/treino-evolucao-mobile.git
git push -u origin main
```

O `.gitignore` já exclui `node_modules`, `.next` e `.env.local`.

## Como publicar na Vercel

1. Acesse https://vercel.com → **Add New → Project** → importe o repositório `treino-evolucao-mobile` do GitHub.
2. Framework: **Next.js** (detectado automaticamente). Não mude build/output.
3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Clique em **Deploy**. Cada `git push` na `main` gera um novo deploy automático.

## Como importar o JSON de treino

1. Na tela inicial, crie/abra um perfil.
2. Em **Treinos**, toque em **Importar JSON do treino** (ou **Novo JSON**, se já houver um treino).
3. Escolha o arquivo `.json` ou cole o conteúdo. O app **valida** o JSON e mostra exatamente qual campo está faltando se houver erro.
4. O treino fica **salvo no perfil** — não precisa subir de novo.
5. Se o perfil já tinha um treino com registros, o **relatório completo do ciclo anterior é salvo e baixado automaticamente** antes da troca.

Um exemplo completo está em [`exemplo-treino.json`](./exemplo-treino.json).

### Estrutura mínima do JSON

```json
{
  "profileName": "Rafael",
  "planName": "Treino Hipertrofia Julho",
  "startDate": "2026-07-03",
  "sessions": [
    {
      "sessionKey": "A",
      "sessionName": "Treino A",
      "focus": "Peito e tríceps",
      "exercises": [
        {
          "exerciseId": "supino_inclinado_haltere",
          "name": "Supino inclinado com halteres",
          "description": "Executar com controle e amplitude segura.",
          "primaryMuscleGroup": "Peito",
          "secondaryMuscleGroups": ["Ombro", "Tríceps"],
          "sets": 3,
          "reps": "8-10",
          "targetRIR": 2,
          "suggestedRestSeconds": 90,
          "initialLoadKg": null,
          "notes": ""
        }
      ],
      "mobility": [
        {
          "mobilityId": "mobilidade_ombro_aquecimento",
          "name": "Mobilidade de ombro",
          "description": "Movimento controlado antes do treino.",
          "durationSeconds": 60,
          "reps": null,
          "notes": ""
        }
      ]
    }
  ]
}
```

Regras: `sessionKey` de A até E; `exerciseId` único no treino inteiro; `mobilityId` único na sessão; o identificador principal é sempre o `exerciseId`, nunca o nome.

## Como o app calcula a evolução

- **Semana (S1, S2…):** a primeira data registrada no plano ativo é a S1; as seguintes são calculadas em blocos de 7 dias.
- **Evolução por exercício:** `((carga recente − carga inicial) / carga inicial) × 100`, sempre por `exerciseId`.
- **Evolução por grupo:** média das evoluções dos exercícios do `primaryMuscleGroup`.
- **Carga mantida:** semana sem preenchimento herda a última carga válida **apenas para análise** (aparece tracejada como "mantida") e nunca conta como novo recorde.
- **Sugestão por RIR:** RIR ≥ 3 → sugerir aumento leve; RIR 2 → manter ou aumento mínimo; RIR 0–1 → manter ou reduzir levemente. Sem histórico, sem sugestão. Sempre discreta — você decide a carga final.

## Estrutura do projeto

```
src/
  app/            páginas (perfis, área do perfil)
  components/     UI, sessões, timer, importação, editor, evolução
  lib/            tipos, Supabase, validação, cálculos, relatório
SUPABASE_SCHEMA.sql
PROJECT_STATUS.md
PROXIMOS_PASSOS.md
exemplo-treino.json
```
