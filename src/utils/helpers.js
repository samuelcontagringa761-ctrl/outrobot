import { downloadMediaMessage as baileysDownload } from '@whiskeysockets/baileys';
import axios from 'axios';
import ytdl from 'youtube-dl-exec';
import { execFile } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import yts from 'yt-search';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { COOKIES_PATH } from '../config/paths.js';

import { DEFAULT_COOKIES } from './defaultCookies.js';

// Instâncias públicas do Piped (busca + streams sem bloqueio de datacenter).
// A ordem importa: tenta a primeira que responder. Instâncias do Piped
// caem/voltem com frequência — por isso há descoberta dinâmica abaixo e
// validação de streams (respostas só com espelho LBRY são descartadas).
// Sobrescreva com PIPED_INSTANCES="https://...,https://..." no .env.
const PIPED_INSTANCES = (process.env.PIPED_INSTANCES
  ? process.env.PIPED_INSTANCES.split(',').map((s) => s.trim()).filter(Boolean)
  : [
      'https://api.piped.private.coffee',
      'https://pipedapi.adminforge.de',
      'https://pipedapi.reallyaweso.me',
      'https://pipedapi.kavin.rocks',
      'https://pipedapi.leptons.xyz',
      'https://pipedapi-libre.kavin.rocks',
      'https://piped-api.privacy.com.de',
      'https://api.piped.yt',
      'https://pipedapi.owo.si',
      'https://pipedapi.ducks.party',
      'https://piped-api.codespace.cz',
      'https://pipedapi.nosebs.ru',
      'https://pipedapi.orangenet.cc',
      'https://pipedapi.darkness.services',
    ]);

// Cache da descoberta dinâmica de instâncias (evita 1 request por comando)
let pipedDiscoveryCache = { at: 0, list: [] };

// Tenta descobrir instâncias saudáveis via API pública do Piped.
// Best-effort: se falhar, usa a lista estática acima.
async function discoverPipedInstances() {
  const now = Date.now();
  if (now - pipedDiscoveryCache.at < 6 * 60 * 60 * 1000 && pipedDiscoveryCache.list.length) {
    return pipedDiscoveryCache.list;
  }
  try {
    const res = await axios.get('https://piped-instances.kavin.rocks/filtered', { timeout: 8000 });
    const live = (Array.isArray(res.data) ? res.data : [])
      .filter((i) => i?.api_url)
      .map((i) => i.api_url.replace(/\/$/, ''));
    if (live.length) {
      pipedDiscoveryCache = { at: now, list: live };
      console.log(`[piped] 🔍 Descobertas ${live.length} instâncias saudáveis.`);
      return live;
    }
  } catch (err) {
    console.warn(`⚠️ Descoberta de instâncias Piped falhou, usando lista estática: ${err.message?.slice(0, 80)}`);
  }
  return [];
}

// Última instância que funcionou: vai na frente nas próximas tentativas.
let basePipedBoa = null;

async function getPipedBases() {
  const discovered = await discoverPipedInstances();
  const merged = [...discovered];
  for (const b of PIPED_INSTANCES) {
    if (!merged.includes(b)) merged.push(b);
  }
  if (basePipedBoa) {
    const semRepetir = merged.filter((b) => b !== basePipedBoa);
    return [basePipedBoa, ...semRepetir];
  }
  return merged;
}

// Streams vindos de espelho LBRY (odycdn) não são o áudio original do
// YouTube e costumam falhar — só aceita googlevideo ou proxy do Piped.
function isUsableStreamUrl(url = '') {
  if (!url) return false;
  if (/odycdn\.com|lbry|phantom/i.test(url)) return false;
  return /googlevideo\.com|pipedproxy|proxy\.piped|piped\.video/i.test(url) || url.startsWith('https://');
}

// Instâncias públicas do Invidious (segundo fallback de busca/streams).
const INVIDIOUS_INSTANCES = (process.env.INVIDIOUS_INSTANCES
  ? process.env.INVIDIOUS_INSTANCES.split(',').map((s) => s.trim()).filter(Boolean)
  : [
      'https://inv.nadeko.net',
      'https://invidious.privacyredirect.in',
      'https://iv.melmac.space',
    ]);

// Instância do Cobalt (fallback opcional). As instâncias públicas mudam e
// muitas exigem chave — por isso SÓ é usada quando configurada.
// Para ativar: hospede sua instância (ou use uma liberada) e defina
// COBALT_API_URL no Railway, ex: https://sua-instancia.com
// Se a instância exigir autenticação, defina também COBALT_API_KEY.
const COBALT_API_URL = (process.env.COBALT_API_URL || '').trim().replace(/\/$/, '');
const COBALT_API_KEY = (process.env.COBALT_API_KEY || '').trim();

// Provider de PO Token (bgutil). Em 2026 o YouTube exige prova de origem para
// vários clientes; sem isso o cookie morre rápido e vem "Sign in to confirm
// you're not a bot". O plugin já vem instalado na imagem; aqui só apontamos
// para o servidor, quando existir (ex: http://127.0.0.1:4416).
const POT_PROVIDER_URL = (process.env.POT_PROVIDER_URL || '').trim().replace(/\/$/, '');


function extractVideoId(input) {
  const m = String(input || '').match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|v\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Formata segundos em "Xh Ym Zs"
export function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

// Formata milissegundos em tempo legível
export function formatDuration(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days} dia(s)`;
  if (hours > 0) return `${hours} hora(s)`;
  if (minutes > 0) return `${minutes} minuto(s)`;
  return `${seconds} segundo(s)`;
}

// Baixa uma mídia de uma mensagem do WhatsApp e retorna o caminho do arquivo temporário
export async function downloadWhatsAppMedia(message, messageType) {
  try {
    const buffer = await baileysDownload(message, 'buffer', {});

    let ext = 'bin';
    if (messageType === 'image') ext = 'jpg';
    else if (messageType === 'video') ext = 'mp4';
    else if (messageType === 'audio') ext = 'mp3';
    else if (messageType === 'sticker') ext = 'webp';

    const tempFile = path.join(os.tmpdir(), `wa-media-${Date.now()}.${ext}`);
    fs.writeFileSync(tempFile, buffer);
    return tempFile;
  } catch (error) {
    if (error?.message?.includes('Cannot derive from empty media key')) {
      console.warn('A mídia recebida não contém uma mediaKey disponível.');
    } else {
      console.error('Erro ao baixar mídia do WhatsApp:', error);
    }
    throw error;
  }
}

// Determina o melhor binário do yt-dlp disponível
function getBestYtDlpPath() {
  if (fs.existsSync('/usr/local/bin/yt-dlp')) {
    return '/usr/local/bin/yt-dlp';
  }
  if (process.platform !== 'win32') {
    // Tenta yt-dlp global
    return 'yt-dlp';
  }
  if (fs.existsSync(ytdl.constants.YOUTUBE_DL_PATH)) {
    return ytdl.constants.YOUTUBE_DL_PATH;
  }
  return 'yt-dlp';
}

// Executa o binário do yt-dlp com garantias de permissão e suporte a fallback de cookies
function runYtDlpExecFile(args) {
  return new Promise((resolve, reject) => {
    const ytDlpPath = getBestYtDlpPath();

    if (process.platform !== 'win32' && fs.existsSync(ytDlpPath)) {
      try {
        fs.chmodSync(ytDlpPath, '755');
      } catch (_) {}
    }

    execFile(ytDlpPath, args, (error, stdout, stderr) => {
      if (error) {
        const errStr = stderr || error.message;
        console.error('[yt-dlp error]', errStr);
        if (errStr.includes("python3': No such file or directory") || errStr.includes("python3: not found")) {
          return reject(new Error('Python 3 não está instalado no ambiente do servidor.'));
        }
        return reject(new Error(errStr));
      }
      resolve(stdout);
    });
  });
}

// Converte vários formatos de exportação de cookies para Netscape
// (o formato que o yt-dlp aceita). Aceita:
//  1) Netscape cru (extensão "Get cookies.txt LOCALLY")
//  2) Base64 do Netscape
//  3) JSON de extensões (Cookie-Editor/EditThisCookie): [{domain,name,value,...}]
//  4) Pares name=value (um por linha ou separados por ;)
export function normalizeCookiesToNetscape(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  if (!text) return null;

  // 2) Base64?
  if (!text.includes('\t') && !text.includes('# Netscape') && !text.includes('youtube.com') && text.length > 50) {
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf-8');
      if (decoded.includes('youtube.com') || decoded.includes('Netscape')) {
        console.log('[yt-dlp] Cookies decodificados de Base64 com sucesso.');
        text = decoded.trim();
      }
    } catch (_) {}
  }
  if (text.includes('\\n')) {
    text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }

  // 1) Já é Netscape?
  if ((text.includes('Netscape') || text.includes('# HTTP Cookie File')) && text.includes('youtube.com')) {
    return text.endsWith('\n') ? text : text + '\n';
  }

  // 3) JSON de extensões?
  const cookies = [];
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : parsed.cookies || parsed.data || [];
      for (const c of arr) {
        if (c && c.name && c.value !== undefined) {
          cookies.push({
            domain: c.domain || '.youtube.com',
            path: c.path || '/',
            secure: c.secure === true || String(c.name).startsWith('__Secure-'),
            expiry: Number(c.expirationDate || c.expiry || 1893456000),
            name: String(c.name),
            value: String(c.value),
          });
        }
      }
    } catch (_) {}
  }

  // 4) Pares name=value?
  if (!cookies.length && /[A-Za-z0-9_-]+\s*=\s*[^;\s\n]+/.test(text) && !text.includes('\t')) {
    const pairs = text.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
    for (const pair of pairs) {
      const eq = pair.indexOf('=');
      if (eq > 0) {
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (name && value && !/^(domain|path|expires|max-age|secure|samesite)$/i.test(name)) {
          cookies.push({ domain: '.youtube.com', path: '/', secure: name.startsWith('__Secure-'), expiry: 1893456000, name, value });
        }
      }
    }
  }

  const ytCookies = cookies.filter((c) => /youtube\.com|google\.com|youtu\.be/i.test(c.domain || ''));
  const source = ytCookies.length ? ytCookies : cookies;
  if (!source.length) return null;

  const lines = ['# Netscape HTTP Cookie File', '# Convertido automaticamente pelo bot a partir de YOUTUBE_COOKIES', ''];
  for (const c of source) {
    const domain = c.domain.startsWith('.') ? c.domain : `.${c.domain}`;
    lines.push([domain, 'TRUE', c.path || '/', c.secure ? 'TRUE' : 'FALSE', String(Math.floor(c.expiry) || 1893456000), c.name, c.value].join('\t'));
  }
  return lines.join('\n') + '\n';
}

// Sincroniza cookies REAIS vindos da variável de ambiente. NÃO cria mais
// cookies falsos automaticamente: cookies inválidos pioram o bloqueio
// ("Sign in to confirm you're not a bot") em vez de ajudar.
function ensureValidCookiesFile() {
  const dir = path.dirname(COOKIES_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Se houver variável YOUTUBE_COOKIES válida, sincroniza
  if (process.env.YOUTUBE_COOKIES && process.env.YOUTUBE_COOKIES.trim()) {
    try {
      const netscape = normalizeCookiesToNetscape(process.env.YOUTUBE_COOKIES);
      if (netscape && netscape.includes('youtube.com')) {
        fs.writeFileSync(COOKIES_PATH, netscape, 'utf-8');
        console.log(`[yt-dlp] ✅ Cookies do YouTube sincronizados a partir de YOUTUBE_COOKIES (${netscape.length} bytes).`);
      } else {
        const raw = process.env.YOUTUBE_COOKIES.trim();
        // Lista os domínios presentes para diagnosticar export do site errado
        let domains = '';
        try {
          domains = [...new Set(raw.split('\n').map((l) => (l.split('\t')[0] || '').trim()).filter((s) => s && s.includes('.') && !s.startsWith('#')))].slice(0, 6).join(', ');
        } catch (_) {}
        console.warn(`[yt-dlp] ⚠️ YOUTUBE_COOKIES ignorado: formato não reconhecido (${raw.length} chars, tabs=${raw.includes('\t')}, youtube.com=${raw.includes('youtube.com')}, json=${/^[[{]/.test(raw)}${domains ? `, dominios=[${domains}]` : ''}). Exporte com a extensão "Get cookies.txt LOCALLY" com a aba do youtube.com aberta e logada, e cole o conteúdo inteiro (ou o Base64 dele).`);
      }
    } catch (err) {
      console.error('❌ Erro ao escrever YOUTUBE_COOKIES no cookies.txt:', err);
    }
  }
}
ensureValidCookiesFile();

// Adiciona diretório do deno ao PATH se existir
if (fs.existsSync('/root/.deno/bin') && !process.env.PATH.includes('/root/.deno/bin')) {
  process.env.PATH = `/root/.deno/bin:${process.env.PATH}`;
}

// Verifica se há cookies REAIS no formato Netscape. Cookies falsos/expirados
// (como o DEFAULT_COOKIES antigo) são rejeitados: sessão inválida aumenta
// a chance de bloqueio pelo YouTube.
function checkValidCookies() {
  try {
    ensureValidCookiesFile();
    if (fs.existsSync(COOKIES_PATH) && fs.statSync(COOKIES_PATH).size > 500) {
      const content = fs.readFileSync(COOKIES_PATH, 'utf-8');
      const isNetscape = content.includes('Netscape') || content.includes('# HTTP Cookie File');
      const hasYoutubeTokens = content.includes('youtube.com');
      if (!isNetscape || !hasYoutubeTokens) return false;
      // Rejeita o cookie placeholder antigo que acompanha o repositório
      if (DEFAULT_COOKIES && content.trim() === DEFAULT_COOKIES.trim()) {
        console.warn('[yt-dlp] ⚠️ cookies.txt contém os cookies de exemplo (expirados). Ignorando cookies — rode sem cookies ou configure YOUTUBE_COOKIES reais.');
        return false;
      }
      // Heurística: cookie real precisa de ao menos um token de sessão longo
      const hasSession = /SID|LOGIN_INFO|__Secure-3PAPISID|SAPISID/.test(content);
      return hasSession;
    }
  } catch (_) {}
  return false;
}

// Monta os argumentos base do yt-dlp.
// IMPORTANTE: não força --user-agent manualmente. Um UA copiado que
// contradiz o player_client (ex: UA de Chrome com client android) é uma
// causa clássica do "Sign in to confirm you're not a bot". Deixa o yt-dlp
// escolher o UA correto para cada cliente.
function buildBaseArgs(withCookies = true, clientOverride = null) {
  const nodePath = process.execPath;

  const args = [
    '--no-playlist',
    '--force-ipv4',
    '--geo-bypass',
    '--retries', '3',
    '--fragment-retries', '3',
    '--socket-timeout', '20',
    '--sleep-requests', '1',
    '--no-warnings',
  ];

  // Runtimes JavaScript para resolver desafios de assinatura / PO Token
  if (fs.existsSync('/root/.deno/bin/deno')) {
    args.push('--js-runtimes', 'deno:/root/.deno/bin/deno');
  }
  if (nodePath) {
    args.push('--js-runtimes', `node:${nodePath}`);
  } else {
    args.push('--js-runtimes', 'node');
  }

  if (clientOverride) {
    args.push('--extractor-args', `youtube:player_client=${clientOverride}`);
  }

  if (ffmpegPath && fs.existsSync(ffmpegPath)) {
    args.push('--ffmpeg-location', ffmpegPath);
  }

  if (withCookies && checkValidCookies() && fs.existsSync(COOKIES_PATH)) {
    args.push('--cookies', COOKIES_PATH);
    console.log('[yt-dlp] Usando cookies autenticados do YouTube.');
  }

  // PO Token: só quando o servidor do provider estiver configurado.
  if (POT_PROVIDER_URL) {
    args.push('--extractor-args', `youtubepot-bgutilhttp:base_url=${POT_PROVIDER_URL}`);
    args.push('--extractor-args', 'youtube:fetch_pot=always');
  }

  return args;
}

// Executa o download com retentativas.
// Ordem testada em 2026: os clientes tv/android_vr/ios devolvem "page needs to
// be reloaded" ou 403 sem PO Token, então só desperdiçam tempo. tv_simply e
// mweb são os que ainda entregam áudio sem credenciais.
async function downloadWithYtDlp(url, specificArgs) {
  const attempts = [];
  const hasCookies = checkValidCookies();

  // Com cookies REAIS válidos, tenta PRIMEIRO: sem cookies o YouTube
  // bloqueia o IP do servidor, então começar pelas tentativas "sem cookies"
  // só gasta tempo (e enche o log de erros) antes de chegar na que funciona.
  if (hasCookies) {
    attempts.push({ name: 'web_safari + cookies', withCookies: true, client: 'web_safari' });
    attempts.push({ name: 'mweb + cookies', withCookies: true, client: 'mweb' });
    attempts.push({ name: 'tv_simply + cookies', withCookies: true, client: 'tv_simply' });
    attempts.push({ name: 'padrao + cookies', withCookies: true, client: null });
  }

  // Sem cookies (ou como reserva, se os cookies expirarem).
  attempts.push({ name: 'tv_simply (sem cookies)', withCookies: false, client: 'tv_simply' });
  attempts.push({ name: 'mweb (sem cookies)', withCookies: false, client: 'mweb' });
  attempts.push({ name: 'padrao (sem cookies)', withCookies: false, client: null });
  attempts.push({ name: 'web_safari (sem cookies)', withCookies: false, client: 'web_safari' });

  let lastError = null;
  let cookiesInvalidos = false;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];

    // Cookies mortos: não adianta repetir os 4 clientes com o mesmo cookie.
    if (attempt.withCookies && cookiesInvalidos) continue;

    try {
      const args = [url, ...buildBaseArgs(attempt.withCookies, attempt.client), ...specificArgs];
      return await runYtDlpExecFile(args);
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Tentativa ${i + 1} (${attempt.name}) falhou: ${err.message?.slice(0, 120)}`);

      if (attempt.withCookies && /cookies are no longer valid|Sign in to confirm|Please sign in/i.test(err.message || '')) {
        cookiesInvalidos = true;
        console.warn('[yt-dlp] ⚠️ Cookies inválidos/expirados — seguindo sem cookies.');
      }
    }
  }

  const errStr = lastError?.message || '';
  if (errStr.includes('Sign in to confirm you’re not a bot') || errStr.includes('429')) {
    throw new Error('O YouTube exigiu login no servidor. Caso persista, configure a variável YOUTUBE_COOKIES no Railway.');
  }
  throw lastError || new Error('Não foi possível realizar o download após várias tentativas.');
}

// Busca no Piped (não sofre o mesmo bloqueio de scraping do YouTube)
async function pipedSearch(query) {
  for (const base of await getPipedBases()) {
    try {
      const res = await axios.get(`${base}/search`, {
        params: { q: query, filter: 'videos' },
        timeout: 12000,
      });
      const items = res.data?.items || res.data?.data || [];
      const first = items.find((i) => i?.url && (i.url.includes('watch?v=') || i.type === 'stream'));
      if (first) {
        const videoId = extractVideoId(`https://x${first.url}`) || String(first.url).split('v=')[1]?.slice(0, 11);
        if (!videoId) continue;
        return {
          url: `https://www.youtube.com/watch?v=${videoId}`,
          videoId,
          title: first.title || query,
          duration: first.duration ? String(first.duration) : '',
          views: first.views || 0,
          author: first.uploaderName || first.uploader || 'YouTube',
        };
      }
    } catch (err) {
      console.warn(`⚠️ Piped search falhou em ${base}: ${err.message?.slice(0, 100)}`);
    }
  }
  return null;
}

// Busca no Invidious (segundo fallback)
async function invidiousSearch(query) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await axios.get(`${base}/api/v1/search`, {
        params: { q: query, type: 'video' },
        timeout: 12000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const first = Array.isArray(res.data) ? res.data.find((i) => i?.videoId) : null;
      if (first) {
        return {
          url: `https://www.youtube.com/watch?v=${first.videoId}`,
          videoId: first.videoId,
          title: first.title || query,
          duration: first.lengthSeconds ? `${Math.floor(first.lengthSeconds / 60)}:${String(first.lengthSeconds % 60).padStart(2, '0')}` : '',
          views: first.viewCount || 0,
          author: first.author || 'YouTube',
        };
      }
    } catch (err) {
      console.warn(`⚠️ Invidious search falhou em ${base}: ${err.message?.slice(0, 100)}`);
    }
  }
  return null;
}

// Detalhes de um videoId via Piped (quando yt-search está bloqueado)
async function pipedVideoDetails(videoId) {
  for (const base of await getPipedBases()) {
    try {
      const res = await axios.get(`${base}/streams/${videoId}`, { timeout: 12000 });
      if (res.data?.title) {
        return {
          url: `https://www.youtube.com/watch?v=${videoId}`,
          videoId,
          title: res.data.title,
          duration: res.data.duration ? `${Math.floor(res.data.duration / 60)}:${String(Math.floor(res.data.duration % 60)).padStart(2, '0')}` : '',
          views: res.data.views || 0,
          author: res.data.uploader || 'YouTube',
        };
      }
    } catch (_) {}
  }
  return null;
}

// Metadados/busca via yt-dlp (usa os cookies autenticados). Funciona quando
// yt-search, Piped e Invidious estão bloqueados — o caso típico em datacenter.
function ytdlpJsonArgs(target, client = 'web_safari') {
  return [target, ...buildBaseArgs(true, client), '--dump-json'];
}

function parseFirstJson(stdout) {
  const line = String(stdout || '').trim().split('\n').filter(Boolean).pop();
  if (!line) return null;
  try {
    return JSON.parse(line);
  } catch (_) {
    return null;
  }
}

function ytdlpDuration(j) {
  if (j?.duration_string) return j.duration_string;
  if (j?.duration) {
    const m = Math.floor(j.duration / 60);
    const s = Math.floor(j.duration % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return '';
}

// Detalhes de vídeo (título/canal) direto do yt-dlp
async function ytdlpVideoDetails(videoId) {
  try {
    const j = parseFirstJson(await runYtDlpExecFile(ytdlpJsonArgs(`https://www.youtube.com/watch?v=${videoId}`)));
    if (!j?.title) return null;
    return {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
      title: j.title,
      duration: ytdlpDuration(j),
      views: j.view_count || 0,
      author: j.uploader || j.channel || 'YouTube',
    };
  } catch (err) {
    console.warn(`⚠️ yt-dlp não resolveu metadados de ${videoId}: ${err.message?.slice(0, 100)}`);
    return null;
  }
}

// Busca por texto usando ytsearch1 do yt-dlp
async function ytdlpSearch(query) {
  try {
    const j = parseFirstJson(await runYtDlpExecFile(ytdlpJsonArgs(`ytsearch1:${query}`)));
    if (!j?.id) return null;
    return {
      url: j.webpage_url || `https://www.youtube.com/watch?v=${j.id}`,
      videoId: j.id,
      title: j.title || query,
      duration: ytdlpDuration(j),
      views: j.view_count || 0,
      author: j.uploader || j.channel || 'YouTube',
    };
  } catch (err) {
    console.warn(`⚠️ yt-dlp não conseguiu buscar "${query}": ${err.message?.slice(0, 100)}`);
    return null;
  }
}

// Extrai ID ou resolve URL / busca do YouTube (com fallbacks anti-bloqueio)
async function resolveYoutubeInfo(query) {
  const cleanQuery = query.trim();
  const videoId = extractVideoId(cleanQuery);

  if (videoId) {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      const videoDetails = await yts({ videoId });
      if (videoDetails && videoDetails.title) {
        return {
          url,
          videoId,
          title: videoDetails.title,
          duration: videoDetails.timestamp || '',
          views: videoDetails.views || 0,
          author: videoDetails.author?.name || 'YouTube'
        };
      }
    } catch (err) {
      console.warn('⚠️ yts bloqueado para videoId, tentando Piped:', videoId, err.message?.slice(0, 80));
    }
    const piped = await pipedVideoDetails(videoId);
    if (piped) return piped;
    const viaYtDlp = await ytdlpVideoDetails(videoId);
    if (viaYtDlp) return viaYtDlp;
    return { url, videoId, title: 'Áudio do YouTube', duration: '', views: 0, author: 'YouTube' };
  }

  // Busca por texto: yt-search primeiro, Piped e Invidious como fallback
  try {
    const searchResult = await yts(cleanQuery);
    const video = searchResult.videos ? searchResult.videos[0] : searchResult;
    if (video?.url) {
      return {
        url: video.url,
        videoId: extractVideoId(video.url),
        title: video.title || cleanQuery,
        duration: video.timestamp || '',
        views: video.views || 0,
        author: video.author?.name || 'YouTube'
      };
    }
  } catch (err) {
    console.warn('⚠️ yt-search bloqueado, tentando Piped/Invidious:', err.message?.slice(0, 100));
  }

  const piped = await pipedSearch(cleanQuery);
  if (piped) {
    console.log(`[busca] ✅ Resolvido via Piped: ${piped.title}`);
    return piped;
  }
  const inv = await invidiousSearch(cleanQuery);
  if (inv) {
    console.log(`[busca] ✅ Resolvido via Invidious: ${inv.title}`);
    return inv;
  }
  const viaYtDlp = await ytdlpSearch(cleanQuery);
  if (viaYtDlp) {
    console.log(`[busca] ✅ Resolvido via yt-dlp (cookies): ${viaYtDlp.title}`);
    return viaYtDlp;
  }
  throw new Error('Nenhum vídeo encontrado para esta busca (YouTube bloqueou todas as fontes de pesquisa).');
}

// Baixa um stream remoto para arquivo temporário
async function downloadStreamToFile(streamUrl, tmpFile, referer = 'https://www.youtube.com/') {
  const res = await axios.get(streamUrl, {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxContentLength: 120 * 1024 * 1024,
    maxBodyLength: 120 * 1024 * 1024,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Referer: referer,
    },
  });
  fs.writeFileSync(tmpFile, Buffer.from(res.data));
  return tmpFile;
}

function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const bin = (ffmpegPath && fs.existsSync(ffmpegPath)) ? ffmpegPath : 'ffmpeg';
    execFile(bin, ['-y', '-i', inputPath, '-vn', '-c:a', 'libmp3lame', '-q:a', '4', outputPath], (err) => {
      if (err) return reject(err);
      resolve(outputPath);
    });
  });
}

// Junta vídeo e áudio separados (streams "videoOnly" do Piped) num mp4.
function muxVideoAudio(videoPath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    const bin = (ffmpegPath && fs.existsSync(ffmpegPath)) ? ffmpegPath : 'ffmpeg';
    execFile(
      bin,
      ['-y', '-i', videoPath, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-shortest', outputPath],
      (err) => (err ? reject(err) : resolve(outputPath))
    );
  });
}

// Streams de áudio utilizáveis, preferindo os proxiados pela instância
// (URLs googlevideo podem estar presas ao IP da instância e dar 403).
function streamsDeAudio(data) {
  return (data?.audioStreams || [])
    .filter((s) => s?.url && isUsableStreamUrl(s.url))
    .sort((a, b) => {
      const proxiado = (u) => (/googlevideo\.com/i.test(u) ? 0 : 1);
      const dif = proxiado(b.url) - proxiado(a.url);
      return dif !== 0 ? dif : (b.bitrate || 0) - (a.bitrate || 0);
    });
}

// Streams de vídeo mp4, preferindo progressivo (com áudio embutido).
function streamsDeVideo(data) {
  const todos = (data?.videoStreams || []).filter((s) => s?.url && isUsableStreamUrl(s.url));
  const progressivos = todos.filter((s) => s.videoOnly === false && (s.mimeType || '').includes('mp4'));
  const pool = progressivos.length ? progressivos : todos.filter((s) => (s.mimeType || '').includes('mp4'));
  return pool.sort((a, b) => (a.height || 0) - (b.height || 0));
}

async function baixarAudioViaPiped(data, base) {
  let lastErr = null;
  for (const stream of streamsDeAudio(data)) {
    const rawTmp = path.join(os.tmpdir(), `piped-raw-${Date.now()}.tmp`);
    const mp3Tmp = path.join(os.tmpdir(), `yt-audio-${Date.now()}.mp3`);
    try {
      await downloadStreamToFile(stream.url, rawTmp, base);
      try {
        await convertToMp3(rawTmp, mp3Tmp);
        try { fs.unlinkSync(rawTmp); } catch (_) {}
      } catch (_) {
        fs.renameSync(rawTmp, mp3Tmp);
      }
      return mp3Tmp;
    } catch (err) {
      lastErr = err;
      try { fs.unlinkSync(rawTmp); } catch (_) {}
    }
  }
  throw lastErr || new Error('nenhum stream de áudio pôde ser baixado');
}

async function baixarVideoViaPiped(data, base) {
  let lastErr = null;
  const audio = streamsDeAudio(data)[0];

  for (const stream of streamsDeVideo(data)) {
    const tmpFile = path.join(os.tmpdir(), `yt-video-${Date.now()}.mp4`);
    try {
      await downloadStreamToFile(stream.url, tmpFile, base);

      // Stream "videoOnly": baixa o áudio e junta, senão o vídeo sai mudo.
      if (stream.videoOnly === true && audio) {
        const audioTmp = path.join(os.tmpdir(), `piped-audio-${Date.now()}.tmp`);
        const muxed = path.join(os.tmpdir(), `yt-video-mux-${Date.now()}.mp4`);
        await downloadStreamToFile(audio.url, audioTmp, base);
        await muxVideoAudio(tmpFile, audioTmp, muxed);
        try { fs.unlinkSync(tmpFile); fs.unlinkSync(audioTmp); } catch (_) {}
        return muxed;
      }

      return tmpFile;
    } catch (err) {
      lastErr = err;
      try { fs.unlinkSync(tmpFile); } catch (_) {}
    }
  }
  throw lastErr || new Error('nenhum stream de vídeo pôde ser baixado');
}

// Fallback 1: baixa áudio/vídeo via Piped (backend fora do IP bloqueado).
// As instâncias são testadas em lotes paralelos: instâncias mortas antes
// custavam 15s cada, agora custam no máximo 6s por lote.
async function downloadViaPiped(info, kind = 'audio') {
  const videoId = info.videoId || extractVideoId(info.url);
  if (!videoId) throw new Error('Piped: sem videoId');

  const bases = await getPipedBases();
  let lastErr = null;

  for (let i = 0; i < bases.length; i += 4) {
    const lote = bases.slice(i, i + 4);
    const respostas = await Promise.all(
      lote.map(async (base) => {
        try {
          const res = await axios.get(`${base}/streams/${videoId}`, { timeout: 6000 });
          return { base, data: res.data };
        } catch (err) {
          return { base, erro: err };
        }
      })
    );

    for (const resposta of respostas) {
      if (!resposta.data) {
        lastErr = resposta.erro;
        console.warn(`⚠️ Piped ${resposta.base} falhou: ${resposta.erro?.message?.slice(0, 80)}`);
        continue;
      }

      const { base, data } = resposta;
      const audio = streamsDeAudio(data);
      const video = streamsDeVideo(data);

      if (kind === 'audio' && !audio.length) {
        lastErr = new Error('sem audioStreams utilizáveis (só espelho LBRY?)');
        continue;
      }
      if (kind === 'video' && !video.length) {
        lastErr = new Error('sem videoStreams utilizáveis (só espelho LBRY?)');
        continue;
      }

      try {
        const filePath = kind === 'audio'
          ? await baixarAudioViaPiped(data, base)
          : await baixarVideoViaPiped(data, base);

        basePipedBoa = base;
        console.log(`[download] ✅ ${kind === 'audio' ? 'Áudio' : 'Vídeo'} via Piped (${base})`);
        return {
          filePath,
          title: data.title || info.title,
          duration: info.duration,
          views: data.views ?? info.views,
          author: data.uploader || info.author,
          url: info.url
        };
      } catch (err) {
        lastErr = err;
        console.warn(`⚠️ Piped ${base} respondeu, mas o download falhou: ${err.message?.slice(0, 100)}`);
      }
    }
  }

  throw lastErr || new Error('Piped: todas as instâncias falharam');
}

// Fallback 2: baixa via Cobalt API (somente quando COBALT_API_URL configurada)
async function downloadViaCobalt(info, kind = 'audio') {
  if (!COBALT_API_URL) {
    throw new Error('Cobalt não configurado (defina COBALT_API_URL no Railway)');
  }
  const body = kind === 'audio'
    ? { url: info.url, downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '128', filenameStyle: 'basic' }
    : { url: info.url, downloadMode: 'auto', videoQuality: '720', youtubeVideoCodec: 'h264', filenameStyle: 'basic' };
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (COBALT_API_KEY) headers.Authorization = `Api-Key ${COBALT_API_KEY}`;
  const res = await axios.post(COBALT_API_URL, body, {
    timeout: 30000,
    headers,
  });
  const data = res.data;
  const fileUrl = data?.url || data?.tunnel?.[0];
  if (data?.status === 'error' || !fileUrl) {
    throw new Error(`Cobalt: ${data?.error?.code || data?.text || 'sem URL de download'}`);
  }
  const tmpFile = path.join(os.tmpdir(), kind === 'audio' ? `yt-audio-${Date.now()}.mp3` : `yt-video-${Date.now()}.mp4`);
  await downloadStreamToFile(fileUrl, tmpFile, COBALT_API_URL);
  console.log(`[download] ✅ Via Cobalt (${COBALT_API_URL})`);
  return { filePath: tmpFile, title: info.title, duration: info.duration, views: info.views, author: info.author, url: info.url };
}

// Busca e baixa áudio do YouTube.
// Cadeia de fallbacks: yt-dlp local → Piped → Cobalt.
// O yt-dlp falha com frequência em IP de datacenter (Fly/Railway);
// os fallbacks usam backends externos que não estão bloqueados.
export async function downloadYoutubeAudio(query) {
  const info = await resolveYoutubeInfo(query);

  // 1) yt-dlp local
  try {
    const tmpFile = path.join(os.tmpdir(), `yt-audio-${Date.now()}.mp3`);
    const specificArgs = [
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--output', tmpFile
    ];
    await downloadWithYtDlp(info.url, specificArgs);
    return { filePath: tmpFile, title: info.title, duration: info.duration, views: info.views, author: info.author, url: info.url };
  } catch (error) {
    console.warn('⚠️ yt-dlp falhou no áudio, tentando Piped:', error.message?.slice(0, 120));
  }

  // 2) Piped
  try {
    return await downloadViaPiped(info, 'audio');
  } catch (error) {
    console.warn('⚠️ Piped falhou no áudio, tentando Cobalt:', error.message?.slice(0, 120));
  }

  // 3) Cobalt
  try {
    return await downloadViaCobalt(info, 'audio');
  } catch (error) {
    console.error('Erro no downloadYoutubeAudio (todas as fontes falharam):', error.message?.slice(0, 200));
    const msg = error.message || '';
    const cookiesHint = checkValidCookies()
      ? ''
      : ' Sem cookies válidos no servidor: exporte o cookies.txt (extensão "Get cookies.txt LOCALLY", logado no YouTube) e cole em YOUTUBE_COOKIES no Railway.';
    if (msg.includes('not a bot') || msg.includes('429') || msg.includes('LOGIN_REQUIRED')) {
      throw new Error(`O YouTube bloqueou o IP do servidor.${cookiesHint}`);
    }
    throw new Error(`Não foi possível baixar o áudio após 3 fontes. Último erro: ${msg.slice(0, 120)}.${cookiesHint}`);
  }
}

// Busca e baixa vídeo do YouTube (mesma cadeia de fallbacks do áudio)
export async function downloadYoutubeVideo(query) {
  const info = await resolveYoutubeInfo(query);

  try {
    const tmpFile = path.join(os.tmpdir(), `yt-video-${Date.now()}.mp4`);
    const specificArgs = [
      '--format', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best',
      '--merge-output-format', 'mp4',
      '--output', tmpFile
    ];
    await downloadWithYtDlp(info.url, specificArgs);
    return { filePath: tmpFile, title: info.title, duration: info.duration, views: info.views, author: info.author, url: info.url };
  } catch (error) {
    console.warn('⚠️ yt-dlp falhou no vídeo, tentando Piped:', error.message?.slice(0, 120));
  }

  try {
    return await downloadViaPiped(info, 'video');
  } catch (error) {
    console.warn('⚠️ Piped falhou no vídeo, tentando Cobalt:', error.message?.slice(0, 120));
  }

  try {
    return await downloadViaCobalt(info, 'video');
  } catch (error) {
    console.error('Erro no downloadYoutubeVideo (todas as fontes falharam):', error.message?.slice(0, 200));
    throw new Error(`Não foi possível baixar o vídeo após 3 fontes. Último erro: ${(error.message || '').slice(0, 120)}`);
  }
}

// Busca e baixa vídeo do TikTok sem marca d'água
export async function downloadTiktokVideo(url) {
  // 1) TikWM: tenta play (sem marca) -> hdplay -> wmplay, com headers de
  // navegador (o CDN do TikTok costuma dar 403 em IP de datacenter sem eles)
  try {
    const apiRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, { timeout: 15000 });
    const resData = apiRes.data;

    if (resData && resData.code === 0 && (resData.data?.play || resData.data?.hdplay || resData.data?.wmplay)) {
      const title = resData.data.title || 'Vídeo do TikTok';
      const author = resData.data.author?.nickname || resData.data.author?.unique_id || 'TikTok User';
      const candidates = [resData.data.play, resData.data.hdplay, resData.data.wmplay].filter(Boolean);
      let lastErr = null;
      for (const videoUrl of candidates) {
        try {
          const tmpFile = path.join(os.tmpdir(), `tt-video-${Date.now()}.mp4`);
          await downloadStreamToFile(videoUrl, tmpFile, 'https://www.tiktok.com/');
          if (!fs.existsSync(tmpFile) || fs.statSync(tmpFile).size < 1000) {
            throw new Error('arquivo baixado vazio ou inválido');
          }
          console.log('[download] ✅ Vídeo do TikTok via TikWM');
          return { filePath: tmpFile, title, author, url };
        } catch (err) {
          lastErr = err;
          console.warn(`⚠️ TikWM CDN falhou (${String(videoUrl).slice(0, 60)}...): ${err.message?.slice(0, 100)}`);
        }
      }
      if (lastErr) throw lastErr;
    } else {
      console.warn('⚠️ TikWM não resolveu o link:', resData?.msg || JSON.stringify(resData)?.slice(0, 120));
    }
  } catch (err) {
    console.warn('⚠️ Falha no TikWM API para vídeo, tentando Cobalt...', err.message?.slice(0, 120));
  }

  // 2) Cobalt (bom suporte a TikTok)
  try {
    return await downloadViaCobalt({ url, title: 'Vídeo do TikTok', author: 'TikTok' }, 'video');
  } catch (err) {
    console.warn('⚠️ Cobalt falhou no TikTok, tentando via yt-dlp...', err.message?.slice(0, 120));
  }

  // 3) Fallback via yt-dlp (com verificação do arquivo de saída)
  try {
    const tmpBase = path.join(os.tmpdir(), `tt-video-${Date.now()}`);
    const specificArgs = [
      '--format', 'best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--output', `${tmpBase}.mp4`
    ];
    await downloadWithYtDlp(url, specificArgs);
    const produced = [`${tmpBase}.mp4`].find((f) => fs.existsSync(f) && fs.statSync(f).size > 1000)
      || fs.readdirSync(os.tmpdir()).map((f) => path.join(os.tmpdir(), f))
        .find((f) => f.startsWith(`${tmpBase}.`) && fs.statSync(f).size > 1000);
    if (!produced) throw new Error('yt-dlp concluiu mas não gerou arquivo de vídeo');
    return {
      filePath: produced,
      title: 'Vídeo do TikTok',
      author: 'TikTok',
      url
    };
  } catch (error) {
    console.error('Erro no downloadTiktokVideo (todas as fontes falharam):', error.message?.slice(0, 200));
    throw new Error(`Não foi possível baixar o vídeo do TikTok (${(error.message || '').slice(0, 100)}). O link pode ser privado/restrito ou o TikTok bloqueou o IP do servidor.`);
  }
}

// Busca e baixa áudio do TikTok (MP3)
export async function downloadTiktokAudio(url) {
  // 1) TikWM (music -> play), com headers de navegador
  try {
    const apiRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, { timeout: 15000 });
    const resData = apiRes.data;

    if (resData && resData.code === 0 && (resData.data?.music || resData.data?.play)) {
      const title = resData.data.title || resData.data.music_info?.title || 'Áudio do TikTok';
      const author = resData.data.author?.nickname || 'TikTok';
      const candidates = [resData.data.music, resData.data.play].filter(Boolean);
      let lastErr = null;
      for (const audioUrl of candidates) {
        try {
          const rawTmp = path.join(os.tmpdir(), `tt-raw-${Date.now()}.tmp`);
          await downloadStreamToFile(audioUrl, rawTmp, 'https://www.tiktok.com/');
          const tmpFile = path.join(os.tmpdir(), `tt-audio-${Date.now()}.mp3`);
          try {
            await convertToMp3(rawTmp, tmpFile);
            try { fs.unlinkSync(rawTmp); } catch (_) {}
          } catch (_) {
            fs.renameSync(rawTmp, tmpFile);
          }
          if (!fs.existsSync(tmpFile) || fs.statSync(tmpFile).size < 1000) {
            throw new Error('arquivo baixado vazio ou inválido');
          }
          console.log('[download] ✅ Áudio do TikTok via TikWM');
          return { filePath: tmpFile, title, author, url };
        } catch (err) {
          lastErr = err;
          console.warn(`⚠️ TikWM áudio falhou: ${err.message?.slice(0, 100)}`);
        }
      }
      if (lastErr) throw lastErr;
    } else {
      console.warn('⚠️ TikWM não resolveu o link de áudio:', resData?.msg || JSON.stringify(resData)?.slice(0, 120));
    }
  } catch (err) {
    console.warn('⚠️ Falha no TikWM API para áudio, tentando Cobalt...', err.message?.slice(0, 120));
  }

  // 2) Cobalt
  try {
    return await downloadViaCobalt({ url, title: 'Áudio do TikTok', author: 'TikTok' }, 'audio');
  } catch (err) {
    console.warn('⚠️ Cobalt falhou no áudio do TikTok, tentando via yt-dlp...', err.message?.slice(0, 120));
  }

  // 3) Fallback via yt-dlp (com verificação do arquivo de saída)
  try {
    const tmpBase = path.join(os.tmpdir(), `tt-audio-${Date.now()}`);
    const specificArgs = [
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--output', `${tmpBase}.mp3`
    ];
    await downloadWithYtDlp(url, specificArgs);
    const produced = [`${tmpBase}.mp3`].find((f) => fs.existsSync(f) && fs.statSync(f).size > 1000)
      || fs.readdirSync(os.tmpdir()).map((f) => path.join(os.tmpdir(), f))
        .find((f) => f.startsWith(`${tmpBase}.`) && fs.statSync(f).size > 1000);
    if (!produced) throw new Error('yt-dlp concluiu mas não gerou arquivo de áudio');
    return {
      filePath: produced,
      title: 'Áudio do TikTok',
      author: 'TikTok',
      url
    };
  } catch (error) {
    console.error('Erro no downloadTiktokAudio (todas as fontes falharam):', error.message?.slice(0, 200));
    throw new Error(`Não foi possível baixar o áudio do TikTok (${(error.message || '').slice(0, 100)}).`);
  }
}

// Garante que o vídeo seja codificado em H.264 + AAC + yuv420p com +faststart para reproduzir perfeitamente no WhatsApp
export async function ensureWhatsAppCompatibleVideo(inputPath) {
  const outputPath = path.join(os.tmpdir(), `wa-compat-${Date.now()}.mp4`);
  const bin = (fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : (ffmpegPath || 'ffmpeg'));
  
  return new Promise((resolve) => {
    execFile(
      bin,
      [
        '-y',
        '-i', inputPath,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '24',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputPath
      ],
      { timeout: 90000 },
      (error) => {
        if (error) {
          console.warn('⚠️ Transcodificação para WhatsApp ignorada/falhou, usando vídeo original:', error.message);
          return resolve(inputPath);
        }
        try {
          if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
            try { fs.unlinkSync(inputPath); } catch (_) {}
            return resolve(outputPath);
          }
        } catch (_) {}
        resolve(inputPath);
      }
    );
  });
}

// Busca e baixa vídeo do Instagram garantindo reprodução no WhatsApp
export async function downloadInstagramVideo(url) {
  try {
    // Remove parâmetros de rastreamento da URL (?igsh=..., etc.)
    const cleanUrl = url.split('?')[0];
    const tmpRawFile = path.join(os.tmpdir(), `ig-raw-${Date.now()}.mp4`);

    const specificArgs = [
      '--no-playlist',
      '--force-ipv4',
      '--geo-bypass',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      '--add-header', 'Referer:https://www.instagram.com/',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--format', 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
      '--output', tmpRawFile
    ];

    if (ffmpegPath && fs.existsSync(ffmpegPath)) {
      specificArgs.push('--ffmpeg-location', ffmpegPath);
    }

    if (fs.existsSync(COOKIES_PATH)) {
      specificArgs.push('--cookies', COOKIES_PATH);
    }

    await runYtDlpExecFile([cleanUrl, ...specificArgs]);

    // Transcodifica para H.264 + AAC + yuv420p para evitar o erro de 'vídeo não reproduz' no WhatsApp
    const finalFile = await ensureWhatsAppCompatibleVideo(tmpRawFile);

    return {
      filePath: finalFile,
      title: 'Vídeo do Instagram',
      author: 'Instagram',
      url: cleanUrl
    };
  } catch (error) {
    console.error('Erro no downloadInstagramVideo:', error);
    throw new Error('Não foi possível baixar o vídeo do Instagram. Certifique-se de que a conta ou publicação é pública.');
  }
}

// Busca e baixa áudio do Instagram (MP3)
export async function downloadInstagramAudio(url) {
  try {
    const cleanUrl = url.split('?')[0];
    const tmpFile = path.join(os.tmpdir(), `ig-audio-${Date.now()}.mp3`);
    const specificArgs = [
      '--no-playlist',
      '--force-ipv4',
      '--geo-bypass',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      '--add-header', 'Referer:https://www.instagram.com/',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--output', tmpFile
    ];

    if (ffmpegPath && fs.existsSync(ffmpegPath)) {
      specificArgs.push('--ffmpeg-location', ffmpegPath);
    }

    if (fs.existsSync(COOKIES_PATH)) {
      specificArgs.push('--cookies', COOKIES_PATH);
    }

    await runYtDlpExecFile([cleanUrl, ...specificArgs]);

    return {
      filePath: tmpFile,
      title: 'Áudio do Instagram',
      author: 'Instagram',
      url: cleanUrl
    };
  } catch (error) {
    console.error('Erro no downloadInstagramAudio:', error);
    throw new Error('Não foi possível baixar o áudio do Instagram. Certifique-se de que a conta ou publicação é pública.');
  }
}




