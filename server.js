const express = require('express');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const { google } = require('googleapis');

const app  = express();
const PORT = process.env.PORT || 8080;

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname), { index: 'index.html' }));

// ── Google Sheets API ────────────────────────────────────

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1T87r0XXk4y1YopCfvu9XbN6LWh2o5uXpSu3G52pGc7M';
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'BACKLOG';

let sheetsClient = null;

function initSheetsClient() {
  try {
    const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credJson) {
      console.warn('[Sheets] GOOGLE_SERVICE_ACCOUNT_JSON não configurado. Integração desabilitada.');
      return null;
    }
    const creds = JSON.parse(credJson);
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
    console.info('[Sheets] Cliente Google Sheets inicializado com sucesso.');
    return sheetsClient;
  } catch (e) {
    console.error('[Sheets] Erro ao inicializar cliente:', e.message);
    return null;
  }
}

initSheetsClient();

// POST /api/sheets/append – Grava chamado na planilha (colunas B-N, col A = JIRA fica vazia)
app.post('/api/sheets/append', async (req, res) => {
  if (!sheetsClient) {
    return res.status(503).json({ error: 'Google Sheets não configurado. Defina GOOGLE_SERVICE_ACCOUNT_JSON.' });
  }

  try {
    const d = req.body;

    // Colunas A-N: A fica vazia (JIRA), B-N preenchidas pelo sistema
    const row = [
      '',                                    // A: COD JIRA (vazio)
      d.prioridade_comparada ?? '',          // B: PRIORIDADE COMPARADA
      d.categoria ?? '',                     // C: CATEGORIA
      d.modulo ?? '',                        // D: MÓDULO
      d.tipo_usuario ?? '',                  // E: TIPO DE USUÁRIO
      d.tela ?? '',                          // F: TELA
      d.titulo ?? '',                        // G: TÍTULO
      d.descricao ?? '',                     // H: DESCRIÇÃO
      d.comportamento_esperado ?? '',        // I: COMPORTAMENTO ESPERADO
      d.observacoes_anexos ?? '',            // J: OBSERVAÇÕES E ANEXOS
      d.solicitada_na_sprint ?? '',          // K: SOLICITADA NA SPRINT
      d.lancado_na_sprint ?? '',             // L: LANÇADO NA SPRINT
      d.concluido_na_sprint ?? '',           // M: CONCLUÍDO NA SPRINT
      d.status ?? '',                        // N: STATUS
    ];

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:N`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    console.info('[Sheets] Chamado gravado com sucesso:', d.titulo || '(sem título)');
    res.json({ success: true, message: 'Chamado gravado na planilha.' });
  } catch (e) {
    console.error('[Sheets] Erro ao gravar:', e.message);
    res.status(500).json({ error: 'Erro ao gravar na planilha: ' + e.message });
  }
});

// ── Helpers ──────────────────────────────────────────────

function dbPath(table) {
  return path.join(DATA_DIR, `${table}.json`);
}

function readTable(table) {
  const p = dbPath(table);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return []; }
}

function writeTable(table, rows) {
  fs.writeFileSync(dbPath(table), JSON.stringify(rows, null, 2), 'utf8');
}

function uid() {
  return Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
}

// ── CRUD genérico em /tables/:table ──────────────────────

// LIST  GET /tables/:table?limit=N&page=P&sort=field
app.get('/tables/:table', (req, res) => {
  let rows = readTable(req.params.table);
  const sort = req.query.sort;
  if (sort) {
    rows.sort((a, b) => {
      if (a[sort] < b[sort]) return -1;
      if (a[sort] > b[sort]) return 1;
      return 0;
    });
  }
  const limit = parseInt(req.query.limit) || 100;
  const page  = parseInt(req.query.page)  || 1;
  const start = (page - 1) * limit;
  const slice = rows.slice(start, start + limit);
  res.json({ data: slice, total: rows.length });
});

// CREATE  POST /tables/:table
app.post('/tables/:table', (req, res) => {
  const rows = readTable(req.params.table);
  const row  = { id: uid(), created_at: Date.now(), ...req.body };
  rows.push(row);
  writeTable(req.params.table, rows);
  res.status(201).json(row);
});

// READ  GET /tables/:table/:id
app.get('/tables/:table/:id', (req, res) => {
  const rows = readTable(req.params.table);
  const row  = rows.find(r => r.id === req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// UPDATE  PATCH /tables/:table/:id
app.patch('/tables/:table/:id', (req, res) => {
  const rows = readTable(req.params.table);
  const idx  = rows.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  rows[idx] = { ...rows[idx], ...req.body, updated_at: Date.now() };
  writeTable(req.params.table, rows);
  res.json(rows[idx]);
});

// DELETE  DELETE /tables/:table/:id
app.delete('/tables/:table/:id', (req, res) => {
  let rows = readTable(req.params.table);
  rows = rows.filter(r => r.id !== req.params.id);
  writeTable(req.params.table, rows);
  res.json({ success: true });
});

// ── Start ────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`IGC Suporte IDE-SP rodando em http://0.0.0.0:${PORT}`);
});
