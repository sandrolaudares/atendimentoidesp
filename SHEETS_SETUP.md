# Integração com Google Sheets – Guia de Configuração

## Visão Geral

O sistema grava automaticamente os dados de cada chamado aberto na planilha Google BACKLOG via **API do Google Sheets** usando uma **Service Account**. Não é necessário Apps Script.

**Planilha**: https://docs.google.com/spreadsheets/d/1T87r0XXk4y1YopCfvu9XbN6LWh2o5uXpSu3G52pGc7M/edit?usp=sharing

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

## Configuração: Service Account do Google Cloud

### Passo 1 – Criar projeto no Google Cloud (se ainda não tem)

1. Acesse https://console.cloud.google.com/
2. Crie um novo projeto (ou use um existente)
3. Habilite a **Google Sheets API**:
   - Vá em **APIs e Serviços → Biblioteca**
   - Busque "Google Sheets API"
   - Clique em **Ativar**

### Passo 2 – Criar Service Account

1. Vá em **APIs e Serviços → Credenciais**
2. Clique em **Criar credenciais → Conta de serviço**
3. Dê um nome (ex: `atendimento-idesp`)
4. Clique em **Criar e Continuar** → **Concluído**
5. Na lista de contas de serviço, clique na que acabou de criar
6. Vá na aba **Chaves** → **Adicionar chave → Criar nova chave → JSON**
7. O arquivo JSON será baixado automaticamente

### Passo 3 – Compartilhar a planilha com a Service Account

1. Abra o arquivo JSON baixado e copie o campo `client_email` (ex: `atendimento-idesp@projeto.iam.gserviceaccount.com`)
2. Abra a planilha Google: https://docs.google.com/spreadsheets/d/1T87r0XXk4y1YopCfvu9XbN6LWh2o5uXpSu3G52pGc7M/edit
3. Clique em **Compartilhar**
4. Adicione o `client_email` da Service Account como **Editor**
5. Desmarque "Notificar pessoas" e clique em **Compartilhar**

### Passo 4 – Configurar no Fly.io

O conteúdo do arquivo JSON deve ser definido como variável de ambiente `GOOGLE_SERVICE_ACCOUNT_JSON`:

```bash
# Substitua o conteúdo do JSON abaixo pelo seu arquivo baixado
fly secrets set GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

Ou copie o conteúdo completo do arquivo JSON:

```bash
fly secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(cat caminho/para/service-account.json)"
```

---

## Variáveis de Ambiente

| Variável                       | Descrição                          | Padrão                                           |
|--------------------------------|------------------------------------|--------------------------------------------------|
| `GOOGLE_SERVICE_ACCOUNT_JSON`  | JSON completo da Service Account   | *(obrigatório)*                                  |
| `GOOGLE_SPREADSHEET_ID`       | ID da planilha Google              | `1T87r0XXk4y1YopCfvu9XbN6LWh2o5uXpSu3G52pGc7M` |
| `GOOGLE_SHEET_NAME`           | Nome da aba na planilha            | `BACKLOG`                                        |

---

## Como funciona

1. Usuário preenche o formulário no portal de suporte
2. O frontend envia os dados para `POST /api/sheets/append`
3. O backend usa a API do Google Sheets para gravar uma nova linha na planilha
4. Colunas B-N são preenchidas; coluna A (COD JIRA) permanece vazia para preenchimento manual

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
  "status": "Aberto"
}
```

---

## Verificação da aba

A planilha deve ter uma aba chamada **BACKLOG** (ou o nome configurado em `GOOGLE_SHEET_NAME`). Se a aba não existir, crie-a manualmente com os cabeçalhos nas colunas A-N.
