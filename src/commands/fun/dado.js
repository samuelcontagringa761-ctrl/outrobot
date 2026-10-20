export async function handleDadoCommand(sock, msg) {
  const from = msg.key.remoteJid;
  const result = Math.floor(Math.random() * 6) + 1;

  return sock.sendMessage(from, { text: `🎲 Você tirou o número *${result}*!` }, { quoted: msg });
}
