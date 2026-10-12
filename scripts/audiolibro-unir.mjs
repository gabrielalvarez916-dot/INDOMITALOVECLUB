// Une los trozos mp3 de cada capítulo (ya generados por ElevenLabs) en un solo mp3 por capítulo.
// Lee pedidos en estado "uniendo", une los capítulos que tienen todos sus trozos listos,
// sube el mp3 a R2 y marca el capítulo como listo. Cuando todos los capítulos están listos, el pedido pasa a "listo".
import { AwsClient } from "aws4fetch";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_ENDPOINT, R2_AUDIO_ACCESS_KEY_ID, R2_AUDIO_SECRET_ACCESS_KEY, R2_AUDIO_BUCKET } = process.env;
const faltan = Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_ENDPOINT, R2_AUDIO_ACCESS_KEY_ID, R2_AUDIO_SECRET_ACCESS_KEY, R2_AUDIO_BUCKET })
  .filter(([, v]) => !v).map(([k]) => k);
if (faltan.length) {
  console.error("Faltan secretos en GitHub (Settings > Secrets and variables > Actions): " + faltan.join(", "));
  process.exit(1);
}

const r2 = new AwsClient({ accessKeyId: R2_AUDIO_ACCESS_KEY_ID, secretAccessKey: R2_AUDIO_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
const H = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(`Supabase ${res.status} en ${path}: ${(await res.text()).slice(0, 300)}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}
const patch = (tabla, filtro, datos) => sb(`${tabla}?${filtro}`, { method: "PATCH", body: JSON.stringify(datos), headers: { Prefer: "return=minimal" } });

async function bajar(key) {
  const res = await r2.fetch(`${R2_ENDPOINT}/${R2_AUDIO_BUCKET}/${key}`);
  if (!res.ok) throw new Error(`R2 GET ${key}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
async function subir(key, buf) {
  const res = await r2.fetch(`${R2_ENDPOINT}/${R2_AUDIO_BUCKET}/${key}`, { method: "PUT", headers: { "Content-Type": "audio/mpeg" }, body: buf });
  if (!res.ok) throw new Error(`R2 PUT ${key}: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

function unirMp3(archivos, salida) {
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  for (const a of archivos) args.push("-i", a);
  const entradas = archivos.map((_, i) => `[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono[a${i}]`).join(";");
  const cadena = archivos.map((_, i) => `[a${i}]`).join("");
  const filtro = `${entradas};${cadena}concat=n=${archivos.length}:v=0:a=1[c];[c]loudnorm=I=-19:TP=-1.5:LRA=11[out]`;
  args.push("-filter_complex", filtro, "-map", "[out]", "-ar", "44100", "-ac", "1", "-b:a", "128k", salida);
  execFileSync("ffmpeg", args, { stdio: "inherit" });
  const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", salida]).toString().trim();
  return Math.round(Number(dur) || 0);
}

async function unirCapitulo(pedido, cap) {
  const trozos = await sb(`audiolibro_trozos?id_capitulo=eq.${cap.id}&select=orden,estado,audio_path&order=orden.asc`);
  if (!trozos.length) return false;
  if (trozos.some((t) => t.estado !== "listo" || !t.audio_path)) return false; // todavía faltan trozos

  const dir = mkdtempSync(join(tmpdir(), "cap-"));
  try {
    const archivos = [];
    for (const t of trozos) {
      const f = join(dir, `${String(t.orden).padStart(3, "0")}.mp3`);
      writeFileSync(f, await bajar(t.audio_path));
      archivos.push(f);
    }
    const salida = join(dir, "capitulo.mp3");
    const duracion = unirMp3(archivos, salida);
    const key = `pedidos/${pedido.id}/capitulos/${String(cap.numero).padStart(3, "0")}.mp3`;
    await subir(key, readFileSync(salida));
    await patch("audiolibro_capitulos", `id=eq.${cap.id}`, { audio_path: key, duracion_seg: duracion, estado: "listo" });
    console.log(`OK pedido ${pedido.id} capítulo ${cap.numero} (${duracion}s) -> ${key}`);
    return true;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const pedidos = await sb("audiolibro_pedidos?estado=eq.uniendo&select=id,titulo&order=created_at.asc");
console.log(`Pedidos esperando unión: ${pedidos.length}`);
let huboError = false;

for (const pedido of pedidos) {
  const caps = await sb(`audiolibro_capitulos?id_pedido=eq.${pedido.id}&select=id,numero,estado&order=numero.asc`);
  for (const cap of caps.filter((c) => c.estado !== "listo")) {
    try { await unirCapitulo(pedido, cap); }
    catch (e) {
      huboError = true;
      console.error(`ERROR pedido ${pedido.id} capítulo ${cap.numero}: ${e.message}`);
      await patch("audiolibro_pedidos", `id=eq.${pedido.id}`, { notas: `Error al unir capítulo ${cap.numero}: ${e.message}`.slice(0, 500) }).catch(() => {});
    }
  }
  const restantes = await sb(`audiolibro_capitulos?id_pedido=eq.${pedido.id}&estado=neq.listo&select=id`);
  if (restantes.length === 0) {
    await patch("audiolibro_pedidos", `id=eq.${pedido.id}`, { estado: "listo", notas: null });
    console.log(`Pedido ${pedido.id} listo: todos los capítulos están unidos.`);
  }
}
if (huboError) process.exit(1);
