import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { uso, erro, sucesso, linha } from '../../config/messages.js';

export async function handleQrcodeCommand(sock, msg, args) {
  const from = msg.key.remoteJid;
  const text = args.join(' ');

  if (!text) {
    return sock.sendMessage(from, { text: uso('/qrcode https://google.com', 'Informe o texto ou o link que deseja transformar em QR Code.') }, { quoted: msg });
  }

  const tmpFile = path.join(os.tmpdir(), `qr-gen-${Date.now()}.png`);

  try {
    await QRCode.toFile(tmpFile, text, { width: 400 });
    await sock.sendMessage(from, { 
      image: fs.readFileSync(tmpFile),
      caption: `${sucesso('QR Code gerado!')}\n\n${linha('Conteúdo', text)}`
    }, { quoted: msg });

    fs.unlinkSync(tmpFile);
  } catch (err) {
    console.error('Erro ao gerar QR code:', err);
    return sock.sendMessage(from, { text: erro('Não foi possível gerar o QR Code.') }, { quoted: msg });
  }
}
