import { formatUptime } from '../../utils/helpers.js';
import { cabecalho, linha } from '../../config/messages.js';

export async function handleInfoCommand(sock, msg) {
  const from = msg.key.remoteJid;
  const uptimeSeconds = (Date.now() - (global.botStartTime || Date.now())) / 1000;
  const uptimeStr = formatUptime(uptimeSeconds);

  const text = `${cabecalho('🤖', 'Seiha — Informações')}\n\n` +
               `${linha('Versão', '1.0.0 (Multi-Funções)')}\n` +
               `${linha('Engine', '@whiskeysockets/baileys (ESM)')}\n` +
               `${linha('Banco de dados', 'SQLite + JSON')}\n` +
               `${linha('Uptime', uptimeStr)}\n\n` +
               `Digite \`/menu\` para ver todos os comandos disponíveis.`;

  return sock.sendMessage(from, { text }, { quoted: msg });
}
