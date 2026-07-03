// ============================================================
// supabase-client.js — Indómita Love Club
// Cliente de Supabase (auth + base de datos)
// ============================================================

const SUPABASE_URL = 'https://zthimkucjtuffzcmdbtf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_oBo4s0ATMUI-GG3Q86J_4A_wdkBOLfS';

// Se crea una única instancia global del cliente, reutilizada en todo el sitio.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
