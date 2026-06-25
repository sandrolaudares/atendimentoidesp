/**
 * =====================================================
 * IGC/IDE-SP – Sistema de Suporte
 * js/main.js – Lógica principal compartilhada
 * =====================================================
 */

// ===================== UTILITÁRIOS GLOBAIS =====================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatData(ts) {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}

/** Labels e badges para tipo de chamado (abertura pelo usuário) */
const TIPO_CHAMADO_LABELS = {
  correcao_alta:  { label:'Correção Alta Prioridade', sla:'1–5 dias úteis',    emoji:'🔴', css:'badge-critica' },
  correcao_media: { label:'Correção Média Prioridade', sla:'6–10 dias úteis',  emoji:'🟠', css:'badge-alta'    },
  correcao_baixa: { label:'Correção Baixa Prioridade', sla:'Próxima sprint',   emoji:'🟡', css:'badge-media'   },
  melhoria:       { label:'Melhoria',                  sla:'Próxima sprint',   emoji:'🟢', css:'badge-baixa'   },
};

/** Labels para reclassificação pós-triagem */
const TIPO_TRIAGEM_LABELS = {
  correcao_alta:  { label:'Correção Alta Prioridade', emoji:'🔴', css:'badge-critica' },
  correcao_media: { label:'Correção Média Prioridade', emoji:'🟠', css:'badge-alta'   },
  correcao_baixa: { label:'Correção Baixa Prioridade', emoji:'🟡', css:'badge-media'  },
  evolucao:       { label:'Evolução',                  emoji:'🔷', css:'badge-escalado' },
  melhoria:       { label:'Melhoria',                  emoji:'🟢', css:'badge-baixa'  },
  nao_e_bug:      { label:'Não é bug',                 emoji:'⚪', css:'badge-fechado' },
  duplicado:      { label:'Duplicado',                 emoji:'🔁', css:'badge-fechado' },
  cancelado:      { label:'Cancelado',                 emoji:'❌', css:'badge-fechado' },
};

function formatTipoChamado(val, campo) {
  const map = campo === 'triagem' ? TIPO_TRIAGEM_LABELS : TIPO_CHAMADO_LABELS;
  const item = map[val];
  if (!item) return val || '—';
  return `${item.emoji} ${item.label}`;
}

function renderBadgeTipo(val, campo) {
  const map = campo === 'triagem' ? TIPO_TRIAGEM_LABELS : TIPO_CHAMADO_LABELS;
  const item = map[val];
  if (!item) return val ? `<span class="badge">${escapeHtml(val)}</span>` : '—';
  return `<span class="badge ${item.css}">${item.emoji} ${item.label}</span>`;
}

function renderBadge(valor, tipo) {
  if (!valor) return '—';
  if (tipo === 'status') {
    const map = {
      aberto:            '🔵 Aberto',
      em_atendimento:    '🟠 Em Atendimento',
      aguardando_usuario:'🟣 Aguardando Usuário',
      escalado:          '🔴 Escalado',
      resolvido:         '🟢 Resolvido',
      fechado:           '⚫ Fechado',
    };
    return `<span class="badge badge-${valor}">${map[valor] || valor}</span>`;
  }
  return `<span class="badge">${escapeHtml(valor)}</span>`;
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ===================== TOAST =====================

function showToast(mensagem, tipo = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { info:'ℹ️', success:'✅', error:'❌', warning:'⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `<span>${icons[tipo] || 'ℹ️'}</span><span>${escapeHtml(mensagem)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s ease';
    setTimeout(() => toast.remove(), 450);
  }, 4000);
}

// ===================== MODAL =====================

function fecharModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

document.addEventListener('click', e => {
  if (e.target?.classList.contains('modal-overlay')) e.target.classList.remove('active');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    closeLightbox();
  }
});

// ===================== LIGHTBOX =====================

function openLightbox(src) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  if (!lb || !img) return;
  img.src = src;
  lb.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.remove('active');
  document.body.style.overflow = '';
}

// ===================== ACCORDION =====================

function toggleAccordion(btn) {
  const content = btn.nextElementSibling;
  const isOpen = btn.classList.contains('active');
  document.querySelectorAll('.accordion-btn.active').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-expanded', 'false');
    b.nextElementSibling.classList.remove('open');
  });
  if (!isOpen) {
    btn.classList.add('active');
    btn.setAttribute('aria-expanded', 'true');
    content.classList.add('open');
  }
}

// ===================== ESTADO DO FORMULÁRIO =====================

let passoAtual = 1;
let imagensBase64 = [];
let tipoChamadoSelecionado = '';
const TOTAL_PASSOS = 5;

/** Selecionar tipo de chamado via card */
function selecionarTipo(tipo) {
  tipoChamadoSelecionado = tipo;
  document.getElementById('tipo_chamado').value = tipo;
  // Atualizar visual dos cards
  ['correcao_alta','correcao_media','correcao_baixa','melhoria'].forEach(t => {
    const card = document.getElementById(`card_${t}`);
    if (!card) return;
    card.classList.toggle('selected', t === tipo);
    card.setAttribute('aria-checked', t === tipo ? 'true' : 'false');
  });
  // Atualizar hint do título se já estiver no passo 3
  atualizarHintTitulo();
}

/** Hint dinâmico do campo título baseado no tipo selecionado */
function atualizarHintTitulo() {
  const box = document.getElementById('tituloHintBox');
  if (!box) return;
  if (!tipoChamadoSelecionado) { box.classList.remove('visible'); return; }
  const isCorrecao = tipoChamadoSelecionado.startsWith('correcao');
  if (isCorrecao) {
    box.innerHTML = `<strong>💡 Dica para Correção:</strong> Escreva o título em forma <strong>negativa</strong>, descrevendo o que está errado.<br>
    <em style="color:var(--igc-cinza-medio);">Ex: "Camada subida não é exibida no catálogo do município"</em>`;
  } else {
    box.innerHTML = `<strong>💡 Dica para Melhoria:</strong> Escreva o título em forma de <strong>ação desejada</strong>.<br>
    <em style="color:var(--igc-cinza-medio);">Ex: "Visualizar lista de usuários dentro de um grupo"</em>`;
  }
  box.classList.add('visible');
}

/** Navegar entre passos */
function irParaPasso(passo) {
  // Validações por passo de origem
  if (passo > 1) {
    // Validar passo 1
    const nome = document.getElementById('nome');
    const email = document.getElementById('email');
    if (nome && email) {
      if (!nome.value.trim()) { irParaPasso_ir(1); nome.focus(); showToast('Informe seu nome completo.', 'warning'); return; }
      if (!email.value.trim() || !validarEmail(email.value.trim())) { irParaPasso_ir(1); email.focus(); showToast('Informe um e-mail válido.', 'warning'); return; }
    }
  }
  if (passo > 2) {
    // Validar passo 2
    if (!tipoChamadoSelecionado) { irParaPasso_ir(2); showToast('Selecione o tipo de chamado.', 'warning'); return; }
    const modulo = document.getElementById('modulo');
    const tipoUsr = document.getElementById('tipo_usuario');
    const tela = document.getElementById('tela');
    if (modulo && !modulo.value) { irParaPasso_ir(2); modulo.focus(); showToast('Selecione o módulo.', 'warning'); return; }
    if (tipoUsr && !tipoUsr.value) { irParaPasso_ir(2); tipoUsr.focus(); showToast('Selecione o tipo de usuário.', 'warning'); return; }
    if (tela && !tela.value) { irParaPasso_ir(2); tela.focus(); showToast('Selecione a tela.', 'warning'); return; }
  }
  if (passo > 3) {
    // Validar passo 3
    const titulo = document.getElementById('titulo');
    const desc = document.getElementById('descricao');
    if (titulo && !titulo.value.trim()) { irParaPasso_ir(3); titulo.focus(); showToast('Informe o título do chamado.', 'warning'); return; }
    if (desc && desc.value.trim().length < 20) { irParaPasso_ir(3); desc.focus(); showToast('A descrição precisa ter ao menos 20 caracteres.', 'warning'); return; }
  }
  if (passo === TOTAL_PASSOS) renderRevisao();
  irParaPasso_ir(passo);
}

function irParaPasso_ir(passo) {
  passoAtual = passo;
  for (let p = 1; p <= TOTAL_PASSOS; p++) {
    const el = document.getElementById(`passo${p}`);
    if (el) el.classList.toggle('hidden', p !== passo);
    const step = document.getElementById(`step${p}`);
    if (step) {
      step.classList.remove('active','done');
      if (p === passo) step.classList.add('active');
      else if (p < passo) step.classList.add('done');
    }
    const con = document.getElementById(`con${p}`);
    if (con) con.classList.toggle('done', p < passo);
  }
  const badge = document.getElementById('formStepBadge');
  if (badge) badge.textContent = `Passo ${passo} de ${TOTAL_PASSOS}`;
  // Se entrar no passo 3, atualizar hint do título
  if (passo === 3) atualizarHintTitulo();
  // Scroll suave para o topo do formulário
  document.getElementById('formCard')?.scrollIntoView({ behavior:'smooth', block:'start' });
}

/** Renderizar revisão */
function renderRevisao() {
  const el = document.getElementById('revisaoConteudo');
  if (!el) return;

  const get = id => document.getElementById(id)?.value || '';
  const nome = get('nome'), email = get('email'), org = get('organizacao');
  const tipo = tipoChamadoSelecionado;
  const modulo = get('modulo'), tela = get('tela'), tipoUsr = get('tipo_usuario');
  const titulo = get('titulo'), desc = get('descricao'), comp = get('comportamento_esperado');

  const printsInfo = imagensBase64.length > 0
    ? `<span style="color:var(--igc-verde-sp);">✅ ${imagensBase64.length} imagem(s) anexada(s)</span>`
    : `<span style="color:var(--igc-cinza-claro);">Nenhuma imagem anexada</span>`;

  const tipoDef = TIPO_CHAMADO_LABELS[tipo] || {};

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:14px;">
      <div class="chamado-meta-item"><span class="chamado-meta-label">Nome</span><span class="chamado-meta-value">${escapeHtml(nome)}</span></div>
      <div class="chamado-meta-item"><span class="chamado-meta-label">E-mail</span><span class="chamado-meta-value" style="font-size:12px;">${escapeHtml(email)}</span></div>
      ${org ? `<div class="chamado-meta-item"><span class="chamado-meta-label">Organização</span><span class="chamado-meta-value">${escapeHtml(org)}</span></div>` : ''}
      <div class="chamado-meta-item"><span class="chamado-meta-label">Tipo de Chamado</span><span class="chamado-meta-value">${renderBadgeTipo(tipo,'abertura')}</span></div>
      <div class="chamado-meta-item"><span class="chamado-meta-label">Prazo</span><span class="chamado-meta-value">${escapeHtml(tipoDef.sla||'—')}</span></div>
      <div class="chamado-meta-item"><span class="chamado-meta-label">Módulo</span><span class="chamado-meta-value">${escapeHtml(modulo)}</span></div>
      <div class="chamado-meta-item"><span class="chamado-meta-label">Tela</span><span class="chamado-meta-value">${escapeHtml(tela)}</span></div>
      <div class="chamado-meta-item"><span class="chamado-meta-label">Tipo de Usuário</span><span class="chamado-meta-value">${escapeHtml(tipoUsr)}</span></div>
      <div class="chamado-meta-item"><span class="chamado-meta-label">Capturas</span><span class="chamado-meta-value">${printsInfo}</span></div>
    </div>
    <div style="background:var(--igc-cinza-bg);border-radius:8px;padding:12px 14px;margin-bottom:8px;">
      <div style="font-size:11px;font-weight:700;color:var(--igc-cinza-medio);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">Título</div>
      <div style="font-size:14px;font-weight:600;">${escapeHtml(titulo)}</div>
    </div>
    <div style="background:var(--igc-cinza-bg);border-radius:8px;padding:12px 14px;margin-bottom:8px;">
      <div style="font-size:11px;font-weight:700;color:var(--igc-cinza-medio);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">Descrição detalhada</div>
      <div style="font-size:13.5px;white-space:pre-wrap;line-height:1.6;">${escapeHtml(desc)}</div>
    </div>
    ${comp ? `<div style="background:var(--igc-azul-suave);border-radius:8px;padding:12px 14px;">
      <div style="font-size:11px;font-weight:700;color:var(--igc-azul-escuro);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px;">Comportamento esperado</div>
      <div style="font-size:13.5px;white-space:pre-wrap;line-height:1.6;">${escapeHtml(comp)}</div>
    </div>` : ''}
  `;
}

// ===================== UPLOAD DE PRINTS =====================

function handleDrop(event) {
  event.preventDefault();
  document.getElementById('uploadArea')?.classList.remove('dragover');
  processarArquivos(event.dataTransfer.files);
}

function handleFileSelect(event) {
  processarArquivos(event.target.files);
  event.target.value = '';
}

function processarArquivos(files) {
  const MAX = 5, MAX_SIZE = 5 * 1024 * 1024;
  if (imagensBase64.length >= MAX) { showToast(`Limite de ${MAX} imagens atingido.`, 'warning'); return; }
  Array.from(files).forEach(file => {
    if (imagensBase64.length >= MAX) { showToast(`Limite de ${MAX} imagens atingido.`, 'warning'); return; }
    if (!file.type.startsWith('image/')) { showToast(`"${file.name}" não é imagem válida.`, 'warning'); return; }
    if (file.size > MAX_SIZE) { showToast(`"${file.name}" excede 5MB.`, 'warning'); return; }
    const reader = new FileReader();
    reader.onload = e => { imagensBase64.push(e.target.result); renderUploads(); };
    reader.readAsDataURL(file);
  });
}

function renderUploads() {
  const preview = document.getElementById('uploadsPreview');
  if (!preview) return;
  preview.innerHTML = imagensBase64.map((b64, i) =>
    `<div class="upload-thumb" role="img" aria-label="Imagem ${i+1}">
      <img src="${b64}" alt="Print ${i+1}">
      <button class="remove-btn" onclick="removerImagem(${i})" type="button" aria-label="Remover imagem ${i+1}">✕</button>
    </div>`
  ).join('');
}

function removerImagem(idx) {
  imagensBase64.splice(idx, 1);
  renderUploads();
}

// ===================== ENVIO DO FORMULÁRIO =====================

function gerarProtocolo() {
  const ano = new Date().getFullYear();
  const num = String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0');
  const ts = Date.now().toString().slice(-4);
  return `IGC-${ano}-${num}${ts}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chamadoForm');
  if (form) form.addEventListener('submit', async e => { e.preventDefault(); await enviarChamado(); });

  // Contador descrição
  const desc = document.getElementById('descricao');
  if (desc) desc.addEventListener('input', () => {
    const el = document.getElementById('descCount');
    if (el) el.textContent = desc.value.length;
  });

  // Contador título
  const tit = document.getElementById('titulo');
  if (tit) tit.addEventListener('input', () => {
    const el = document.getElementById('tituloCount');
    if (el) el.textContent = tit.value.length;
  });
});

async function enviarChamado() {
  const btn = document.getElementById('btnEnviar');
  if (btn) { btn.innerHTML = '<span class="loading-spinner"></span> Enviando...'; btn.disabled = true; }

  const get = id => document.getElementById(id)?.value?.trim() || '';

  const nome        = get('nome');
  const email       = get('email');
  const organizacao = get('organizacao');
  const tipo_chamado = tipoChamadoSelecionado;
  const modulo      = get('modulo');
  const tela        = get('tela');
  const tipo_usuario = get('tipo_usuario');
  const titulo      = get('titulo');
  const descricao   = get('descricao');
  const comportamento_esperado = get('comportamento_esperado');
  const protocolo   = gerarProtocolo();

  // Escalonamento automático para correção alta
  const autoEscalar = tipo_chamado === 'correcao_alta';

  const historico = JSON.stringify([{
    data: new Date().toLocaleString('pt-BR'),
    autor: nome,
    acao: 'Chamado aberto pelo solicitante via portal de suporte IDE-SP/SIMM'
  }]);

  const payload = {
    protocolo, nome, email, organizacao,
    tipo_chamado,
    tipo_chamado_triagem: '',  // será preenchido na triagem
    modulo, tela, tipo_usuario,
    titulo, descricao, comportamento_esperado,
    status: 'aberto',
    prints_base64: JSON.stringify(imagensBase64),
    resposta: '',
    escalado_email: autoEscalar,
    sprint: '',
    historico
  };

  try {
    const resp = await fetch('tables/chamados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error('API error');
    const chamado = await resp.json();

    // Se correção alta, adicionar entrada no histórico
    if (autoEscalar) {
      try {
        let hist = JSON.parse(chamado.historico || historico);
        hist.push({
          data: new Date().toLocaleString('pt-BR'),
          autor: 'Sistema IGC',
          acao: 'Sinalizado automaticamente para escalonamento (Correção Alta Prioridade)'
        });
        await fetch(`tables/chamados/${chamado.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ historico: JSON.stringify(hist) })
        });
      } catch(e) {}
    }

    // Enviar para Google Sheets
    let sheetsOk = false;
    try {
      sheetsOk = await enviarParaSheets({ ...payload, id: chamado.id, created_at: chamado.created_at });
    } catch(e) {}

    // Exibir resultado
    document.getElementById('protocoloNum').textContent = protocolo;
    document.getElementById('formCard').classList.add('hidden');
    document.getElementById('protocoloCard').classList.remove('hidden');
    if (sheetsOk) {
      document.getElementById('avisoSheetsOk').classList.remove('hidden');
    } else {
      document.getElementById('avisoSheetsErro').classList.remove('hidden');
    }
    imagensBase64 = [];

  } catch(e) {
    showToast('Erro ao enviar chamado. Tente novamente.', 'error');
    if (btn) { btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Chamado'; btn.disabled = false; }
  }
}

function novoChamado() {
  imagensBase64 = [];
  tipoChamadoSelecionado = '';
  const form = document.getElementById('chamadoForm');
  if (form) form.reset();
  document.getElementById('tipo_chamado') && (document.getElementById('tipo_chamado').value = '');
  ['correcao_alta','correcao_media','correcao_baixa','melhoria'].forEach(t => {
    document.getElementById(`card_${t}`)?.classList.remove('selected');
  });
  document.getElementById('uploadsPreview') && (document.getElementById('uploadsPreview').innerHTML = '');
  document.getElementById('formCard').classList.remove('hidden');
  document.getElementById('protocoloCard').classList.add('hidden');
  document.getElementById('avisoSheetsOk')?.classList.add('hidden');
  document.getElementById('avisoSheetsErro')?.classList.add('hidden');
  irParaPasso_ir(1);
}

// ===================== HELPERS COMPARTILHADOS (status.html, admin.html) =====================

function getHistoricoIcon(acao) {
  if (!acao) return '📋';
  const a = acao.toLowerCase();
  if (a.includes('aberto') || a.includes('criado')) return '📩';
  if (a.includes('resolv')) return '✅';
  if (a.includes('escalad')) return '🔧';
  if (a.includes('atendiment')) return '👨‍💻';
  if (a.includes('resposta') || a.includes('respondido')) return '💬';
  if (a.includes('aguard')) return '⏰';
  if (a.includes('reclassif') || a.includes('triagem')) return '🏷️';
  if (a.includes('sprint')) return '📅';
  if (a.includes('sinalizado') || a.includes('sistema')) return '🤖';
  if (a.includes('informaç') || a.includes('atualiz')) return '📝';
  return '📋';
}

function formatStatus(s) {
  const map = {
    aberto:'Aberto', em_atendimento:'Em Atendimento',
    aguardando_usuario:'Aguardando Usuário', escalado:'Escalado',
    resolvido:'Resolvido', fechado:'Fechado'
  };
  return map[s] || s || '—';
}
