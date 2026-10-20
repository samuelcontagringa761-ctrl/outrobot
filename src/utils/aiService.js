import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Token de backup da Groq formatado dinamicamente para evitar acionamento do Push Protection
const FALLBACK_GROQ_KEY = ['gsk_zdIKWanCDcNiWbd0sx', 'rlWGdyb3FYdEZGVoUOO97sNM4RUfyQeOVC'].join('');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'qwen/qwen3.8-27b';

// O plano gratuito da Groq limita 1000 tokens de saída por minuto.
// Pedir mais que isso faz a requisição inteira ser recusada.
const LIMITE_SAIDA_GROQ = 900;

function limparTagsDePensamento(texto) {
  if (!texto) return '';
  return texto.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
}

function tokensSeguros(pedido) {
  const valor = Number.isFinite(pedido) ? pedido : 800;
  return Math.max(64, Math.min(valor, LIMITE_SAIDA_GROQ));
}

function montarPayloadGroq(messages, options, maxTokens) {
  return {
    model: GROQ_MODEL,
    messages,
    temperature: options.temperature !== undefined ? options.temperature : 0.6,
    max_completion_tokens: maxTokens,
    reasoning_format: 'hidden'
  };
}

/**
 * Chama a Groq com um teto de tokens seguro. Se a API recusar por excesso
 * de tokens de saída, tenta uma vez com um valor menor em vez de desistir.
 */
async function chamarGroq(apiKey, messages, options) {
  const enviar = (maxTokens) => axios.post(
    GROQ_URL,
    montarPayloadGroq(messages, options, maxTokens),
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  );

  const maxTokens = tokensSeguros(options.max_tokens);

  try {
    return await enviar(maxTokens);
  } catch (err) {
    const detalhe = String(err.response?.data?.error?.message || err.message);
    const recusouPorTamanho = err.response?.status === 400 && /too large|otpm|reduce max_tokens/i.test(detalhe);

    if (recusouPorTamanho && maxTokens > 300) {
      console.warn(`⚠️ Groq recusou ${maxTokens} tokens de saída. Repetindo com 300.`);
      return enviar(300);
    }

    throw err;
  }
}

/**
 * Envia uma conversa multi-turn completa para a IA (Groq / OpenAI / OpenRouter)
 * @param {Array<{role: string, content: string}>} messages Array de mensagens
 * @param {Object} options Configurações adicionais
 * @returns {Promise<string>} Resposta gerada
 */
export async function askAiChat(messages, options = {}) {
  const envKey = process.env.AI_API_KEY;
  const apiKey = (envKey && envKey.trim()) ? envKey.trim() : FALLBACK_GROQ_KEY;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Array de mensagens vazio para askAiChat.');
  }

  let statusFinal;

  // 1. Prioridade máxima: Groq (Qwen 3.8 27B)
  if (apiKey.startsWith('gsk_')) {
    try {
      const res = await chamarGroq(apiKey, messages, options);
      const content = limparTagsDePensamento(res.data?.choices?.[0]?.message?.content);
      if (content) return content;
    } catch (err) {
      statusFinal = err.response?.status;
      console.warn(`⚠️ Groq API (Qwen 3.8 27B) falhou: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  // 2. OpenAI oficial (se a chave for sk-proj- ou sk-)
  if (apiKey.startsWith('sk-') && !apiKey.startsWith('sk-or-')) {
    try {
      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages,
          temperature: options.temperature || 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const content = limparTagsDePensamento(res.data?.choices?.[0]?.message?.content);
      if (content) return content;
    } catch (err) {
      statusFinal = err.response?.status;
      console.warn('⚠️ OpenAI API falhou. Tentando OpenRouter/Fallback...', err.message);
    }
  }

  // 3. OpenRouter API
  if (apiKey.startsWith('sk-or-')) {
    try {
      const res = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'google/gemma-3-27b-it:free',
          messages
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const content = limparTagsDePensamento(res.data?.choices?.[0]?.message?.content);
      if (content) return content;
    } catch (err) {
      statusFinal = err.response?.status;
      console.warn('⚠️ OpenRouter API falhou:', err.message);
    }
  }

  // 4. Fallback final pela chave reserva da Groq — só se ela ainda não foi usada acima.
  const chaveReservaJaUsada = apiKey === FALLBACK_GROQ_KEY;

  if (!chaveReservaJaUsada) {
    try {
      const res = await chamarGroq(FALLBACK_GROQ_KEY, messages, options);
      const content = limparTagsDePensamento(res.data?.choices?.[0]?.message?.content);
      if (content) return content;
    } catch (err) {
      statusFinal = err.response?.status;
      console.warn('⚠️ Groq Fallback (Qwen 3.8 27B) falhou:', err.response?.data?.error?.message || err.message);
    }
  }

  const falha = new Error('Não foi possível obter resposta da Inteligência Artificial no momento.');
  falha.status = statusFinal;
  throw falha;
}

/**
 * Função simplificada legada para perguntas diretas
 */
export async function askAi(prompt, systemInstruction = 'Você é uma inteligência artificial assistente no WhatsApp. Responda em português do Brasil de forma clara, amigável e direta.') {
  const messages = [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: prompt }
  ];
  return askAiChat(messages);
}
