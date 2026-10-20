import os from 'os';
import { cabecalho, linha } from '../../config/messages.js';

export async function handleBotinfoCommand(sock, msg) {
  const from = msg.key.remoteJid;
  const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
  const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
  const platform = os.platform();
  const cpus = os.cpus().length;

  const text = `${cabecalho('📊', 'Estatísticas técnicas do bot')}\n\n` +
               `${linha('Sistema operacional', platform)}\n` +
               `${linha('Uso de memória RAM', `${memoryUsage} MB / ${totalMem} GB`)}\n` +
               `${linha('Processadores (cores)', `${cpus} cores`)}\n` +
               `${linha('Node.js', process.version)}`;

  return sock.sendMessage(from, { text }, { quoted: msg });
}
