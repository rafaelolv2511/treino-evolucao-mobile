# Ferramentas de verificação (não entram no build)

Excluídas do `tsconfig.json` — rode sob demanda com `npx tsx`.

## `regress.ts` — regras de negócio
```bash
npx tsx tools/regress.ts
```
25 asserções sobre o que não pode quebrar: carga herdada, PR (primeira carga
nunca conta), semanas S1..Sn do plano, semana de calendário segunda→domingo com
1 check-in por dia, estagnação, sugestão por séries, calorias com cardio,
evolução do ranking e evolução da aba Evolução. Sem dependência externa.

## `audit-artes.ts` — layout dos compartilháveis
```bash
npm i --no-save canvas @fontsource/anton @fontsource/archivo @fontsource/space-grotesk
# disponibilizar Anton-Regular.ttf, Archivo-Black.ttf,
# SpaceGrotesk-Regular.ttf e SpaceGrotesk-Bold.ttf em tmp/fonts
# (ou apontar RTRAINNING_FONT_DIR para a pasta)
npx tsx tools/audit-artes.ts
```
Renderiza as 16 artes em 3 cenários (padrão, sem dados, textos longos) num
canvas instrumentado que mede cada `fillText` e acusa:
- texto fora do quadro 1080×1920 (lateral ou vertical);
- textos sobrepostos (ignora marca d'água com alpha baixo).

Foi assim que os bugs de alinhamento do `label()` e da medição da marca
apareceram — vale rodar sempre que uma arte nova for criada.
