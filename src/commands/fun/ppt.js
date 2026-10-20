import { uso, cabecalho, linha } from '../../config/messages.js';

export async function handlePptCommand(sock, msg, args) {
  const from = msg.key.remoteJid;
  const userChoice = args[0]?.toLowerCase();
  const validChoices = ['pedra', 'papel', 'tesoura'];

  if (!userChoice || !validChoices.includes(userChoice)) {
    return sock.sendMessage(from, { text: uso('/ppt pedra', 'Escolha entre pedra, papel ou tesoura.') }, { quoted: msg });
  }

  const botChoice = validChoices[Math.floor(Math.random() * validChoices.length)];

  let resultText = '';

  if (userChoice === botChoice) {
    resultText = '🤝 *EMPATE!*';
  } else if (
    (userChoice === 'pedra' && botChoice === 'tesoura') ||
    (userChoice === 'papel' && botChoice === 'pedra') ||
    (userChoice === 'tesoura' && botChoice === 'papel')
  ) {
    resultText = '🎉 *VOCÊ VENCEU!*';
  } else {
    resultText = '🤖 *O BOT VENCEU!*';
  }

  const text = `${cabecalho('✂️', 'Pedra, Papel e Tesoura')}\n\n` +
               `${linha('Você escolheu', userChoice)}\n` +
               `${linha('Bot escolheu', botChoice)}\n\n` +
               `Resultado: ${resultText}`;

  return sock.sendMessage(from, { text }, { quoted: msg });
}
