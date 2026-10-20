/**
 * Utilitários de sessão do WhatsApp.
 *
 * - Cache de tentativas de retry no formato que o Baileys espera (get/set/del).
 * - Filtro do ruído de "Bad MAC": o libsignal imprime o stack trace inteiro a
 *   cada mensagem que não consegue descriptografar, o que inunda o log.
 * - Diagnóstico por conversa, com reset automático da sessão quando a mesma
 *   conversa falha várias vezes seguidas (a sessão fica dessincronizada e a
 *   conversa só volta depois de renegociar as chaves).
 */

/** O Baileys usa get/set/del; um Map simples quebra o limite de tentativas. */
export function criarCacheDeTentativas(ttlMs = 60 * 60 * 1000) {
  const itens = new Map();

  return {
    get: (chave) => {
      const item = itens.get(chave);
      if (!item) return undefined;
      if (Date.now() > item.expira) {
        itens.delete(chave);
        return undefined;
      }
      return item.valor;
    },
    set: (chave, valor) => itens.set(chave, { valor, expira: Date.now() + ttlMs }),
    del: (chave) => itens.delete(chave),
    flushAll: () => itens.clear()
  };
}

const RUIDO_DE_SESSAO = /Bad MAC|Session error:|Failed to decrypt message with any known session|verifyMAC|doDecryptWhisperMessage/;
const INTERVALO_RESUMO_MS = 5 * 60 * 1000;

/**
 * Substitui console.error por uma versão que troca os stack traces de Bad MAC
 * por um resumo a cada 5 minutos. Qualquer outro erro passa intacto.
 */
export function instalarFiltroDeRuidoDeSessao() {
  const consoleErrorOriginal = console.error.bind(console);
  let mensagensIlegiveis = 0;
  let ultimoResumo = Date.now();

  console.error = (...args) => {
    const texto = args.map((a) => (typeof a === 'string' ? a : '')).join(' ');

    if (!RUIDO_DE_SESSAO.test(texto)) return consoleErrorOriginal(...args);

    mensagensIlegiveis++;
    const agora = Date.now();

    if (agora - ultimoResumo >= INTERVALO_RESUMO_MS) {
      consoleErrorOriginal(`⚠️ [sessão] ${mensagensIlegiveis} mensagem(ns) não puderam ser descriptografadas (Bad MAC).`);
      mensagensIlegiveis = 0;
      ultimoResumo = agora;
    }
  };
}

/** Identifica a conversa de forma legível (PN quando o WhatsApp usa LID). */
function identificarConversa(chave) {
  const jid = chave?.remoteJid || 'desconhecido';
  const pn = chave?.senderPn || chave?.participantPn;
  return pn && pn !== jid ? `${jid} (número ${pn.split('@')[0]})` : jid;
}

/**
 * Cria um registrador de falhas de descriptografia por conversa.
 *
 * - 3ª falha: avisa no log.
 * - `limite` falhas dentro da janela: chama `aoExceder(jid)` uma vez, para
 *   descartar as chaves daquela conversa e forçar a renegociação.
 * - `cooldownMs`: evita repetir o reset na mesma conversa.
 */
export function criarRegistradorDeFalhas({
  aoExceder,
  limite = 6,
  janelaMs = 3 * 60 * 1000,
  cooldownMs = 30 * 60 * 1000
} = {}) {
  const falhas = new Map();

  return function registrar(chave) {
    const jid = chave?.remoteJid || 'desconhecido';
    const agora = Date.now();
    const registro = falhas.get(jid) || { total: 0, desde: agora, ultimoReset: 0 };

    if (agora - registro.desde > janelaMs) {
      registro.total = 0;
      registro.desde = agora;
    }

    registro.total++;
    falhas.set(jid, registro);

    if (registro.total === 3) {
      console.warn(`⚠️ [sessão] Mensagens de ${identificarConversa(chave)} não estão sendo descriptografadas (Bad MAC). Tentando recuperar...`);
    }

    if (
      registro.total >= limite &&
      typeof aoExceder === 'function' &&
      agora - registro.ultimoReset > cooldownMs
    ) {
      registro.ultimoReset = agora;
      registro.total = 0;

      Promise.resolve()
        .then(() => aoExceder(jid, chave))
        .catch((err) => {
          console.warn('⚠️ [sessão] Não foi possível resetar a sessão:', err?.message || err);
        });
    }
  };
}
