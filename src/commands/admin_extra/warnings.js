import { getWarns } from '../../database/sqlite.js';
import { grupoApenas } from '../../config/messages.js';

export async function handleWarningsCommand(sock, msg, args, sender, mentioned) {
  const from = msg.key.remoteJid;
  if (!from.endsWith('@g.us')) {
    return sock.sendMessage(from, { text: grupoApenas() }, { quoted: msg });
  }

  let target = mentioned[0] || msg.message?.extendedTextMessage?.contextInfo?.participant || sender;
  const count = getWarns(from, target);

  return sock.sendMessage(from, { 
    text: `📋 @${target.split('@')[0]} possui *${count}/3* advertências neste grupo.`,
    mentions: [target]
  }, { quoted: msg });
}
