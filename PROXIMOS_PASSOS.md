# PRÓXIMOS PASSOS — Treino Evolução Mobile

Guia direto para colocar o app no ar e usar. Se algo travar, cole a seção correspondente no ChatGPT junto com a mensagem de erro.

---

## O que já está pronto (não precisa refazer)

- ✅ Código completo do app (esta pasta).
- ✅ Banco Supabase criado e configurado: projeto **"musculacao projeto"** (ref `yjnccmvlskhvmjbceztt`), com todas as tabelas, índices e permissões aplicadas.
- ✅ `.env.local` já preenchido com a URL e a chave do Supabase (esse arquivo não sobe para o GitHub — é proposital).
- ✅ Build testado e passando (`npm run build`).

Falta apenas: **subir para o GitHub** e **publicar na Vercel** (passos 2 e 3).

---

## Passo 1 — Rodar localmente (opcional, para testar antes)

Pré-requisito: Node.js 18+ instalado (https://nodejs.org).

```bash
cd treino-evolucao-mobile
npm install
npm run dev
```

Abra http://localhost:3000. Crie um perfil, importe o arquivo `exemplo-treino.json` e registre uma carga para testar.

## Passo 2 — Subir para o GitHub

1. Crie um repositório vazio em https://github.com/new com o nome `treino-evolucao-mobile` (privado ou público, tanto faz). **Não** marque "Add a README".
2. No terminal, dentro da pasta do projeto:

```bash
git init
git add .
git commit -m "Treino Evolução Mobile — versão inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/treino-evolucao-mobile.git
git push -u origin main
```

(Troque `SEU-USUARIO` pelo seu usuário do GitHub.)

## Passo 3 — Publicar na Vercel

1. Acesse https://vercel.com → **Add New… → Project**.
2. Importe o repositório `treino-evolucao-mobile` do seu GitHub.
3. A Vercel detecta Next.js sozinha — não mude nada de build.
4. Em **Environment Variables**, adicione estas duas (valores estão no seu `.env.local`):

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://yjnccmvlskhvmjbceztt.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (copie do arquivo `.env.local`) |

5. Clique em **Deploy**. Em ~2 minutos você recebe a URL (ex.: `treino-evolucao-mobile.vercel.app`).
6. Abra a URL no celular e **adicione à tela inicial** (menu do navegador → "Adicionar à tela de início") para usar como app.

A partir daí, todo `git push` na branch `main` publica automaticamente.

## Passo 4 — Primeiro uso (checklist de validação)

1. Criar um perfil na tela inicial.
2. Em **Treinos**, importar o `exemplo-treino.json` (ou o seu próprio JSON no mesmo formato).
3. Abrir o Treino A → definir a **data do treino** → registrar carga em um exercício → salvar.
4. Testar o **timer** (botão do exercício ou presets 1:00/1:30/2:00).
5. Em **Evolução**, registrar um peso corporal e ver o gráfico.
6. Depois de 2+ semanas de registros, conferir o bloco **Força** e testar **Exportar evolução** (baixa `.json` + `.md`).

## Passo 5 — Fim de ciclo: trocar de treino

1. Em **Evolução → Exportar evolução**, baixe o relatório.
2. Abra o arquivo `.md`: a seção **"Resumo final"** já está escrita para colar no ChatGPT pedindo um novo treino.
3. Peça ao ChatGPT que responda **no formato JSON do app** (o próprio resumo já pede isso).
4. Em **Treinos → Novo JSON**, importe o treino novo. O relatório do ciclo antigo é salvo e baixado automaticamente antes da troca — nada se perde.

## Se der problema

- **Erro ao carregar perfis / salvar dados:** confira se as duas variáveis de ambiente estão na Vercel exatamente com esses nomes e redeploye.
- **JSON recusado na importação:** o app diz qual campo falta. Compare com `exemplo-treino.json`.
- **Quer mudar algo no app:** abra `PROJECT_STATUS.md` — a última seção tem um parágrafo de contexto pronto para colar no ChatGPT (ou aqui no Claude) descrevendo toda a arquitetura.
