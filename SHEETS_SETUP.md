# Integração com Google Sheets – Guia de Configuração

## Visão Geral

O sistema envia automaticamente os dados de cada chamado aberto para a planilha Google BACKLOG via **Google Apps Script** (webhook). Chamados atualizados/triados pelo painel admin também podem ser reenviados.

**Planilha**: https://docs.google.com/spreadsheets/d/1g1R2rBkKsINm2ntWTb7uaIg_No7PbRSUyB6F9ff9pZ4/edit?usp=sharing

---

## Mapeamento de Colunas

A planilha possui as seguintes colunas. A **coluna A (COD JIRA)** é gerenciada manualmente e **não é preenchida pelo sistema**. O sistema preenche as colunas B a N:

| Col | Nome da Coluna                         | Campo no Sistema         |
|-----|----------------------------------------|--------------------------|
| A   | COD JIRA                               | *(não enviado)*          |
| B   | PRIORIDADE COMPARADA                   | prioridade_comparada     |
| C   | CATEGORIA                              | categoria                |
| D   | MÓDULO                                 | modulo                   |
| E   | TIPO DE USUÁRIO                        | tipo_usuario             |
| F   | TELA                                   | tela                     |
| G   | TÍTULO                                 | titulo                   |
| H   | DESCRIÇÃO                              | descricao                |
| I   | COMPORTAMENTO ESPERADO                 | comportamento_esperado   |
| J   | OBSERVAÇÕES E ANEXOS                   | observacoes_anexos       |
| K   | SOLICITADA NA SPRINT                   | solicitada_na_sprint     |
| L   | LANÇADO NA SPRINT (PREENCHIMENTO DEV)  | lancado_na_sprint        |
| M   | CONCLUÍDO NA SPRINT                    | concluido_na_sprint      |
| N   | STATUS (PREENCHIMENTO DEV)             | status                   |

---

## Google Apps Script

Na planilha, clique em **Extensões → Apps Script**, apague o conteúdo existente e cole:

```javascript
/**
 * IGC / IDE-SP – Webhook de recebimento de chamados (BACKLOG)
 * Colunas B-N preenchidas pelo sistema (A = COD JIRA, preenchido manualmente)
 */

const SHEET_NAME = 'BACKLOG'; // Nome da aba principal

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Aba não encontrada: ' + SHEET_NAME }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Colunas B-N (col A = COD JIRA fica vazia / é preenchida manualmente)
    const linha = [
      '',                                          // A: COD JIRA (vazio)
      dados.prioridade_comparada        || '',     // B: PRIORIDADE COMPARADA
      dados.categoria                   || '',     // C: CATEGORIA
      dados.modulo                      || '',     // D: MÓDULO
      dados.tipo_usuario                || '',     // E: TIPO DE USUÁRIO
      dados.tela                        || '',     // F: TELA
      dados.titulo                      || '',     // G: TÍTULO
      dados.descricao                   || '',     // H: DESCRIÇÃO
      dados.comportamento_esperado      || '',     // I: COMPORTAMENTO ESPERADO
      dados.observacoes_anexos          || '',     // J: OBSERVAÇÕES E ANEXOS
      dados.solicitada_na_sprint        || '',     // K: SOLICITADA NA SPRINT
      dados.lancado_na_sprint           || '',     // L: LANÇADO NA SPRINT
      dados.concluido_na_sprint         || '',     // M: CONCLUÍDO NA SPRINT
      dados.status                      || '',     // N: STATUS
    ];

    // Procura linha existente pelo título (col G, índice 6)
    const valores = sheet.getDataRange().getValues();
    let linhaExistente = -1;
    const protocolo = dados._protocolo || '';
    if (protocolo) {
      for (let i = 1; i < valores.length; i++) {
        // Busca por protocolo no campo observações (col J, índice 9)
        if (valores[i][9] && String(valores[i][9]).indexOf('Protocolo: ' + protocolo) >= 0) {
          linhaExistente = i + 1;
          break;
        }
      }
    }

    if (linhaExistente > 0) {
      // Atualiza colunas B-N (mantém col A intacta)
      sheet.getRange(linhaExistente, 2, 1, 13).setValues([linha.slice(1)]);
    } else {
      sheet.appendRow(linha);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, protocolo: protocolo }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function testarConexao() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  Logger.log(sheet ? 'Planilha encontrada: ' + sheet.getName() : 'Aba não encontrada');
}
```

---

## Publicar o Script como Web App

1. Clique em **Implantar → Nova implantação**.
2. Clique no ícone de engrenagem → **Aplicativo da Web**.
3. Configure:
   - **Executar como**: `Eu (seu e-mail)`
   - **Quem tem acesso**: **Qualquer pessoa**
4. Clique em **Implantar** e autorize.
5. **Copie a URL** gerada (`https://script.google.com/macros/s/AKfycb.../exec`).

---

## Configurar a URL no Portal

1. Acesse o portal de suporte (`index.html`).
2. Na sidebar, localize o card **"Planilha de Registro"**.
3. Cole a URL copiada no campo e pressione Enter.
4. A URL é salva no navegador (localStorage).

---

## Dados Enviados (JSON)

```json
{
  "prioridade_comparada": 1,
  "categoria": "Correção Alta",
  "modulo": "SIMM-HAB",
  "tipo_usuario": "Editor",
  "tela": "CARGA DE DADOS",
  "titulo": "Camada não exibida após carga de dados",
  "descricao": "Após fazer upload do shapefile...",
  "comportamento_esperado": "A camada deve aparecer no visualizador...",
  "observacoes_anexos": "Org: Prefeitura de SP | Solicitante: João | E-mail: joao@gov.br | Protocolo: IGC-2025-00011001",
  "solicitada_na_sprint": "",
  "lancado_na_sprint": "",
  "concluido_na_sprint": "",
  "status": "Novo",
  "_protocolo": "IGC-2025-00011001",
  "_nome": "João da Silva",
  "_email": "joao@prefeitura.sp.gov.br",
  "_organizacao": "Prefeitura de São Paulo",
  "_sistema": "IGC-Suporte-IDE-SP",
  "_timestamp": "2025-05-08T14:30:00.000Z"
}
```
