import { formatUptime } from '../../utils/helpers.js';
import { linha } from '../../config/messages.js';

export async function handleUptimeCommand(sock, msg) {
  const from = msg.key.remoteJid;
  const uptimeSeconds = (Date.now() - (global.botStartTime || Date.now())) / 1000;
  const uptimeStr = formatUptime(uptimeSeconds);

  return sock.sendMessage(from, { text: `🌙 ${linha('Bot ativo há', uptimeStr)}` }, { quoted: msg });
}
