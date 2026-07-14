import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Aviso claro no console se as variáveis não estiverem configuradas (ex.: na Vercel).
// Sem elas, toda leitura/escrita falha silenciosamente e a UI parece "vazia".
if (typeof window !== "undefined" && (!url || !anon)) {
  // eslint-disable-next-line no-console
  console.error(
    "[RTrainning] Variáveis do Supabase ausentes. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY nas Environment Variables da Vercel e refaça o deploy."
  );
}

export const supabase = createClient(url ?? "", anon ?? "", {
  auth: { persistSession: false },
});

/** true se o app tem as credenciais mínimas para falar com o Supabase. */
export const supabaseConfigured = Boolean(url && anon);
