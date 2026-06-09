import { createClient } from "@supabase/supabase-js";

const enderecoSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const chaveAnonimaSupabase = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigurado = Boolean(enderecoSupabase && chaveAnonimaSupabase);

export const supabase = createClient(
  supabaseConfigurado ? enderecoSupabase : "https://exemplo.supabase.co",
  supabaseConfigurado ? chaveAnonimaSupabase : "chave-anonima"
);
