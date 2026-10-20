import { checkIfOwner, isAdmin } from '../admin.js';
import { getGroupConfig, updateGroupConfig } from '../../database/sqlite.js';
import { grupoApenas, adminOuDonoApenas, uso, estado } from '../../config/messages.js';

export async function handleBoasvindasCommand(sock, msg, args, sender) {
  const from = msg.key.remoteJid;
  if (!from.endsWith('@g.us')) {
    return sock.sendMessage(from, { text: grupoApenas() }, { quoted: msg });
  }

  const groupMetadata = await sock.groupMetadata(from);
  const participants = groupMetadata.participants;

  if (!isAdmin(participants, sender) && !checkIfOwner(sender)) {
    return sock.sendMessage(from, { text: adminOuDonoApenas() }, { quoted: msg });
  }

  const param = args[0]?.toLowerCase();
  if (param !== 'on' && param !== 'off') {
    const cfg = getGroupConfig(from);
    return sock.sendMessage(from, { text: `${uso('/boasvindas on', 'Use `/boasvindas off` para desativar.')}\n\nEstado atual: *${estado(cfg.welcome)}*` }, { quoted: msg });
  }

  const active = param === 'on' ? 1 : 0;
  updateGroupConfig(from, { welcome: active });

  return sock.sendMessage(from, { text: `👋 Mensagens de boas-vindas neste grupo: *${estado(active)}*.` }, { quoted: msg });
}
