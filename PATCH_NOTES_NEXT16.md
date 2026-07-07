# Ajuste aplicado pelo ChatGPT

Este pacote é uma versão revisada do projeto original para publicar com dependências mais atuais.

## Alterações feitas

- Next.js atualizado para 16.2.10.
- React e React DOM atualizados para 19.2.7.
- Tipagens React atualizadas para 19.
- Página dinâmica `/p/[id]` ajustada para o padrão de `params` assíncrono do Next.js moderno.
- `npm run build` executado com sucesso.

## Atenção

- O arquivo `.env.local` foi removido deste ZIP de entrega para evitar compartilhar chave de ambiente.
- Use o `.env.example` como base e preencha com a URL e anon key do Supabase.
- Ainda pode aparecer alerta moderado de `postcss` via dependência interna do Next.js no `npm audit`; o build passa e a vulnerabilidade crítica do Next.js antigo foi removida.
