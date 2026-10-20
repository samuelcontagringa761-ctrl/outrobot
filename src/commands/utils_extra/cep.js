import axios from 'axios';
import { uso, erro, cabecalho, linha } from '../../config/messages.js';

export async function handleCepCommand(sock, msg, args) {
  const from = msg.key.remoteJid;
  const cep = args[0]?.replace(/\D/g, '');

  if (!cep || cep.length !== 8) {
    return sock.sendMessage(from, { text: uso('/cep 01001000', 'Informe um CEP válido com 8 dígitos.') }, { quoted: msg });
  }

  try {
    const res = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
    if (res.data.erro) {
      return sock.sendMessage(from, { text: erro('CEP não encontrado.') }, { quoted: msg });
    }

    const data = res.data;
    const text = `${cabecalho('📍', 'Consulta de CEP')}\n\n` +
                 `${linha('CEP', data.cep)}\n` +
                 `${linha('Logradouro', data.logradouro || 'N/A')}\n` +
                 `${linha('Bairro', data.bairro || 'N/A')}\n` +
                 `${linha('Cidade', data.localidade)}\n` +
                 `${linha('Estado (UF)', data.uf)}\n` +
                 `${linha('DDD', data.ddd)}`;

    return sock.sendMessage(from, { text }, { quoted: msg });
  } catch (err) {
    console.error('Erro no comando /cep:', err.message);
    return sock.sendMessage(from, { text: erro('Não foi possível consultar o CEP.') }, { quoted: msg });
  }
}
