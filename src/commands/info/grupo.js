import { grupoApenas, erro, cabecalho, linha } from '../../config/messages.js';

export async function handleGrupoCommand(sock, msg) {
  const from = msg.key.remoteJid;
  if (!from.endsWith('@g.us')) {
    return sock.sendMessage(from, { text: grupoApenas() }, { quoted: msg });
  }

  try {
    const groupMetadata = await sock.groupMetadata(from);
    const participants = groupMetadata.participants;
    const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');

    const text = `${cabecalho('👥', 'Informações do grupo')}\n\n` +
                 `${linha('Nome', groupMetadata.subject)}\n` +
                 `${linha('ID', groupMetadata.id)}\n` +
                 `${linha('Criador', `@${(groupMetadata.owner || groupMetadata.subjectOwner || '').split('@')[0]}`)}\n` +
                 `${linha('Total de membros', participants.length)}\n` +
                 `${linha('Administradores', admins.length)}\n` +
                 `${linha('Descrição', groupMetadata.desc || '(sem descrição)')}`;

    const mentions = [(groupMetadata.owner || groupMetadata.subjectOwner)].filter(Boolean);

    return sock.sendMessage(from, { text, mentions }, { quoted: msg });
  } catch (err) {
    console.error('Erro no comando /grupo:', err);
    return sock.sendMessage(from, { text: erro('Não foi possível obter as informações do grupo.') }, { quoted: msg });
  }
}
