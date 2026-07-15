/**
 * =====================================================
 * IGC/IDE-SP – Sistema de Suporte
 * js/sheets.js – Integração com Google Sheets via API (server-side)
 * =====================================================
 *
 * O sistema envia os dados do chamado para o backend (/api/sheets/append)
 * que usa a API do Google Sheets com Service Account para gravar
 * diretamente na planilha — sem necessidade de Apps Script.
 *
 * Veja SHEETS_SETUP.md para instruções de configuração.
 * =====================================================
 */

/**
 * Envia os dados do chamado para o backend que grava no Google Sheets.
 * Retorna true se bem-sucedido, false caso contrário.
 */
async function enviarParaSheets(chamado) {
  const payload = buildSheetsPayload(chamado);

  try {
    const resp = await fetch('/api/sheets/append', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      const data = await resp.json();
      console.info('[Sheets] Chamado gravado com sucesso na planilha.');
      return true;
    } else {
      const err = await resp.json().catch(() => ({}));
      console.warn('[Sheets] Erro ao gravar:', err.error || resp.statusText);
      return false;
    }
  } catch (e) {
    console.error('[Sheets] Erro ao enviar para o backend:', e);
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
