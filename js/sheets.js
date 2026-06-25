/**
 * =====================================================
 * IGC/IDE-SP – Sistema de Suporte
 * js/sheets.js – Integração com Google Sheets via Apps Script
 * =====================================================
 *
 * Para usar: configure um Google Apps Script com doPost(e) que
 * aceite JSON e escreva numa planilha Google. Cole a URL do
 * Apps Script publicado no campo da sidebar do portal.
 *
 * Veja SHEETS_SETUP.md para instruções detalhadas.
 * =====================================================
 */

/**
 * Envia os dados do chamado para o Google Apps Script (webhook).
 * Retorna true se bem-sucedido, false caso contrário.
 */
async function enviarParaSheets(chamado) {
  const url = localStorage.getItem('igc_sheets_webhook') || '';
  if (!url || !url.startsWith('https://script.google.com')) {
    console.warn('[Sheets] URL do webhook não configurada ou inválida.');
    return false;
  }

  // Montar payload no formato esperado pela planilha de sprint
  const payload = buildSheetsPayload(chamado);

  try {
    // Google Apps Script exige fetch sem CORS mode em alguns cenários;
    // usamos no-cors pois o Apps Script não retorna CORS headers por padrão.
    // Para confirmação de sucesso precisamos de um Apps Script configurado
    // com ContentService e Access: Anyone.
    const resp = await fetch(url, {
      method: 'POST',
      mode: 'no-cors',           // Apps Script não retorna CORS na maioria dos casos
      headers: { 'Content-Type': 'text/plain' }, // no-cors só aceita content-types simples
      body: JSON.stringify(payload)
    });
    // Com no-cors, resp.ok é sempre false (opaque response).
    // Consideramos sucesso se não lançou exceção.
    console.info('[Sheets] Payload enviado (modo no-cors). Verifique a planilha.');
    return true;
  } catch (e) {
    console.error('[Sheets] Erro ao enviar para o webhook:', e);
    return false;
  }
}

/**
 * Constrói o payload no formato da planilha BACKLOG.
 * Colunas mapeadas (na ordem exata da planilha, excluindo col A = COD JIRA):
 *   B: PRIORIDADE COMPARADA | C: CATEGORIA | D: MÓDULO |
 *   E: TIPO DE USUÁRIO | F: TELA | G: TÍTULO | H: DESCRIÇÃO |
 *   I: COMPORTAMENTO ESPERADO | J: OBSERVAÇÕES E ANEXOS |
 *   K: SOLICITADA NA SPRINT | L: LANÇADO NA SPRINT (PREENCHIMENTO DEV) |
 *   M: CONCLUÍDO NA SPRINT | N: STATUS (PREENCHIMENTO DEV)
 */
function buildSheetsPayload(c) {
  const CATEGORIA_LABELS = {
    correcao_alta:  'Correção Alta',
    correcao_media: 'Correção Média',
    correcao_baixa: 'Correção Baixa',
    melhoria:       'Melhoria',
    evolucao:       'Evolução',
    nao_e_bug:      'Não é bug',
    duplicado:      'Duplicado',
    cancelado:      'Cancelado',
  };

  const PRIORIDADE_MAP = {
    correcao_alta:  1,
    correcao_media: 2,
    correcao_baixa: 3,
    melhoria:       4,
    evolucao:       4,
  };

  return {
    // B: PRIORIDADE COMPARADA
    prioridade_comparada:   PRIORIDADE_MAP[c.tipo_chamado] || '',
    // C: CATEGORIA
    categoria:              CATEGORIA_LABELS[c.tipo_chamado] || c.tipo_chamado || '',
    // D: MÓDULO
    modulo:                 c.modulo || '',
    // E: TIPO DE USUÁRIO
    tipo_usuario:           c.tipo_usuario || '',
    // F: TELA
    tela:                   c.tela || '',
    // G: TÍTULO
    titulo:                 c.titulo || '',
    // H: DESCRIÇÃO
    descricao:              c.descricao || '',
    // I: COMPORTAMENTO ESPERADO
    comportamento_esperado: c.comportamento_esperado || '',
    // J: OBSERVAÇÕES E ANEXOS
    observacoes_anexos:     buildObservacoesAnexos(c),
    // K: SOLICITADA NA SPRINT
    solicitada_na_sprint:   c.solicitada_na_sprint || '',
    // L: LANÇADO NA SPRINT (PREENCHIMENTO DEV)
    lancado_na_sprint:      c.lancado_na_sprint || '',
    // M: CONCLUÍDO NA SPRINT
    concluido_na_sprint:    c.concluido_na_sprint || '',
    // N: STATUS (PREENCHIMENTO DEV)
    status:                 formatStatusSheets(c.status),

    // Metadados extras (não vão para colunas da planilha, mas úteis ao script)
    _protocolo:             c.protocolo || c.id || '',
    _nome:                  c.nome || '',
    _email:                 c.email || '',
    _organizacao:           c.organizacao || '',
    _sistema:               'IGC-Suporte-IDE-SP',
    _timestamp:             new Date().toISOString(),
  };
}

function buildObservacoesAnexos(c) {
  const partes = [];
  if (c.organizacao) partes.push('Org: ' + c.organizacao);
  if (c.nome) partes.push('Solicitante: ' + c.nome);
  if (c.email) partes.push('E-mail: ' + c.email);
  if (c.protocolo) partes.push('Protocolo: ' + c.protocolo);
  const numPrints = c.prints_base64 ? JSON.parse(c.prints_base64).length : 0;
  if (numPrints > 0) partes.push(numPrints + ' print(s) anexado(s)');
  return partes.join(' | ');
}

function formatDataSheets(ts) {
  if (!ts) return new Date().toLocaleDateString('pt-BR');
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}

function formatStatusSheets(s) {
  const map = {
    aberto:            'Aberto',
    em_atendimento:    'Em Atendimento',
    aguardando_usuario:'Aguardando Usuário',
    escalado:          'Escalado',
    resolvido:         'Resolvido',
    fechado:           'Fechado',
  };
  return map[s] || s || '';
}

/**
 * Reenvia um chamado já existente para a planilha (usado pelo admin).
 * Útil após triagem/reclassificação para manter a planilha sincronizada.
 */
async function reenviarParaSheets(chamado) {
  return await enviarParaSheets(chamado);
}
