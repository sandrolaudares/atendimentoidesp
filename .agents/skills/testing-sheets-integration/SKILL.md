---
name: testing-sheets-integration
description: Test the IDE-SP/SIMM support ticket (chamado) form submission and Google Sheets integration end-to-end. Use when verifying that chamados are correctly recorded in the BACKLOG sheet.
---

# Testing: IDE-SP/SIMM Google Sheets Integration

## Overview
This skill covers end-to-end testing of the Central de Suporte IDE-SP/SIMM PWA, specifically the 5-step form submission flow and Google Sheets data recording.

## Devin Secrets Needed
- `FLY_API_TOKEN` - For deploying to fly.io
- `GOOGLE_SERVICE_ACCOUNT_JSON` - Configured as a fly.io secret (not a Devin secret). The Service Account JSON credential for Google Sheets API access.

## Prerequisites
- App deployed at https://atendimento-idesp.fly.dev/
- Google Service Account configured with Editor access to the target spreadsheet
- Service Account JSON set as fly.io secret: `fly secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<json>'`
- The spreadsheet must have the Service Account email added as Editor

## Test Procedure

### 1. Verify API Endpoint First (Quick Smoke Test)
Before running full UI test, verify the backend API works:
```bash
curl -s -X POST https://atendimento-idesp.fly.dev/api/sheets/append \
  -H "Content-Type: application/json" \
  -d '{"prioridade_comparada":"1","categoria":"Erro","modulo":"Módulo GEO","tipo_usuario":"Técnico IGC","tela":"Mapa Principal","titulo":"TESTE SMOKE","descricao":"Smoke test","comportamento_esperado":"Should appear in sheet","observacoes_anexos":"Smoke test","status":"Aberto"}'
```
Expected: `{"success":true,"message":"Chamado gravado na planilha."}`

### 2. Full UI E2E Test
Navigate to https://atendimento-idesp.fly.dev/ and fill the 5-step form:

**Step 1 - Identificação:**
- Nome, Email, Organização fields

**Step 2 - Chamado:**
- Select Tipo (cards: Correção Alta/Média/Baixa, Melhoria, Evolução)
- Select Módulo dropdown
- Select Tipo de Usuário dropdown
- Select Tela dropdown
- Note: dropdowns may need clicking to expand; options depend on selected módulo

**Step 3 - Detalhes:**
- Título (max 140 chars)
- Descrição (min 50 chars)
- Comportamento Esperado (min 30 chars)

**Step 4 - Prints (Optional):**
- Can skip this step

**Step 5 - Revisão:**
- Review all data, then click "Enviar Chamado"

### 3. Verify Success
After submission:
- Protocol number displayed (format: IGC-YYYY-XXXXXXXXX)
- Green confirmation: "Chamado registrado na planilha de controle do projeto."
- If red error appears instead, check fly.io logs: `fly logs -a atendimento-idesp`

### 4. Verify Google Sheets Data
Use Service Account credentials to read the sheet via API (more reliable than browser):
```python
# Use the Service Account JSON to authenticate and read rows via Google Sheets API v4
# Check the last row matches the submitted data
```

**Column mapping to verify (Row = last row in BACKLOG sheet):**
| Column | Header | Source |
|--------|--------|--------|
| A | COD JIRA | Always empty (reserved) |
| B | PRIORIDADE COMPARADA | Maps from tipo: Correção Alta=1, Média=2, Baixa=3, Melhoria/Evolução=4 |
| C | CATEGORIA | Human-readable label of tipo_chamado |
| D | MÓDULO | Selected module |
| E | TIPO DE USUÁRIO | Selected user type |
| F | TELA | Selected screen |
| G | TÍTULO | Title text |
| H | DESCRIÇÃO | Description text |
| I | COMPORTAMENTO ESPERADO | Expected behavior text |
| J | OBSERVAÇÕES E ANEXOS | Auto-generated: "Org: X \| Solicitante: Y \| E-mail: Z \| Protocolo: P" |
| K-M | Sprint columns | Always empty (filled manually later) |
| N | STATUS | Always "Aberto" for new submissions |

## Known Issues & Workarounds

### Data Validation Warning on STATUS Column
The spreadsheet may have a dropdown data validation on column N (STATUS). Writing "Aberto" via API might trigger a validation warning ("Invalid: Input must be an item on the specified list") if the exact text doesn't match the dropdown options. This is cosmetic and does not affect data integrity. If this is a problem, check the allowed values in the spreadsheet's data validation settings and update `formatStatusSheets()` in `js/sheets.js`.

### Google Workspace Restrictions
If the user's Google Workspace admin has restrictions:
- Apps Script web app deployment may be blocked
- Solution: Use server-side Google Sheets API with Service Account (current approach)
- This approach does NOT require Workspace admin approval

### fly.io Deployment
- Service Account JSON must be set as a fly.io secret (not committed to repo)
- After setting secrets, fly.io auto-redeploys
- Default spreadsheet ID and sheet name are hardcoded in server.js but can be overridden via env vars: `GOOGLE_SPREADSHEET_ID`, `GOOGLE_SHEET_NAME`

### Form Navigation Tips
- Type selection cards require clicking the card itself (not just the radio button)
- Dropdowns may need explicit clicking to open
- Character count validation: Título ≤ 140, Descrição ≥ 50, Comportamento ≥ 30
- Use unique test data (e.g. "TESTE E2E DEVIN") to easily identify test rows in the sheet

## Architecture Notes
- Frontend: PWA with vanilla JS (no framework)
- Backend: Express.js server (server.js)
- Sheets integration: Server-side via `/api/sheets/append` endpoint using `googleapis` npm package
- Authentication: Google Service Account (JSON key stored in fly.io secret)
- No client-side API keys or tokens needed
