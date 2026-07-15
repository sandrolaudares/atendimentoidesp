/**
 * =====================================================
 * IGC/IDE-SP – Sistema de Chat Interno
 * js/chat.js – Chat com histórico por data/hora
 * =====================================================
 */

const Chat = (() => {

  // ─── Configurações ───────────────────────────────────
  const POLL_INTERVAL  = 5000;   // ms entre verificações de novas mensagens
  const PAGE_SIZE      = 50;     // mensagens por carregamento
  const MAX_MSG_LEN    = 1000;   // caracteres por mensagem

  const SALAS = [
    { id: 'geral',         nome: 'Geral',              icon: 'fa-comments',     desc: 'Canal aberto para todos' },
    { id: 'igc_interno',   nome: 'IGC Interno',        icon: 'fa-building',     desc: 'Somente equipe IGC' },
    { id: 'desenvolvedores', nome: 'Desenvolvedores',  icon: 'fa-code',         desc: 'Equipe de desenvolvimento IDE-SP' },
    { id: 'suporte',       nome: 'Suporte ao Cliente', icon: 'fa-headset',      desc: 'Atendimento a clientes externos' },
  ];

  const PERFIS = [
    { id: 'igc',          label: 'Equipe IGC',         cor: '#333333', bg: '#f2f2f2' },
    { id: 'desenvolvedor',label: 'Desenvolvedor',       cor: '#2e7d32', bg: '#e8f5e9' },
    { id: 'cliente',      label: 'Cliente',             cor: '#546e7a', bg: '#f5f7fa' },
    { id: 'fapetec',      label: 'FAPETEC',             cor: '#7b1fa2', bg: '#f3e5f5' },
  ];

  // ─── Estado ──────────────────────────────────────────
  let state = {
    aberto:        false,
    salaAtual:     'geral',
    usuario:       null,        // { nome, email, tipo }
    mensagens:     {},          // { [salaId]: [] }
    ultimoId:      {},          // { [salaId]: timestamp }
    pollTimer:     null,
    carregando:    false,
    paginaAtual:   {},          // { [salaId]: 1 }
    totalPages:    {},
    naoLidas:      {},          // { [salaId]: count }
    protocoloRef:  '',
  };

  // ─── Utilitários ─────────────────────────────────────
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatHora(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d)) return '';
    const hoje    = new Date();
    const ontem   = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
    const hora    = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dataStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (d.toDateString() === hoje.toDateString())  return `hoje às ${hora}`;
    if (d.toDateString() === ontem.toDateString()) return `ontem às ${hora}`;
    return `${dataStr} às ${hora}`;
  }

  function formatDataSeparador(ts) {
    const d = new Date(ts);
    const hoje  = new Date();
    const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
    if (d.toDateString() === hoje.toDateString())  return 'Hoje';
    if (d.toDateString() === ontem.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  function getPerfil(tipo) {
    return PERFIS.find(p => p.id === tipo) || PERFIS[2];
  }

  function getSala(id) {
    return SALAS.find(s => s.id === id) || SALAS[0];
  }

  function inicialAvatar(nome) {
    if (!nome) return '?';
    const partes = nome.trim().split(' ');
    if (partes.length === 1) return partes[0][0].toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  function salvarUsuario(u) {
    localStorage.setItem('igc_chat_usuario', JSON.stringify(u));
  }

  function carregarUsuarioLocal() {
    try {
      const raw = localStorage.getItem('igc_chat_usuario');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // ─── API ─────────────────────────────────────────────
  async function apiGet(sala, page = 1) {
    const url = `tables/chat_mensagens?page=${page}&limit=${PAGE_SIZE}&sort=created_at`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Falha ao carregar mensagens');
    const json = await r.json();
    // filtrar pela sala
    const dados = (json.data || []).filter(m => m.sala_id === sala);
    return { mensagens: dados, total: json.total || 0 };
  }

  async function apiEnviar(msg) {
    const r = await fetch('tables/chat_mensagens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg)
    });
    if (!r.ok) throw new Error('Falha ao enviar mensagem');
    return r.json();
  }

  // ─── Carregamento de mensagens ────────────────────────
  async function carregarMensagens(sala, append = false) {
    if (state.carregando) return;
    state.carregando = true;
    const page = state.paginaAtual[sala] || 1;

    try {
      const { mensagens } = await apiGet(sala, page);
      if (!state.mensagens[sala]) state.mensagens[sala] = [];

      if (append) {
        // novas mensagens (polling) — adicionar apenas as novas
        const existIds = new Set(state.mensagens[sala].map(m => m.id));
        const novas = mensagens.filter(m => !existIds.has(m.id));
        if (novas.length > 0) {
          state.mensagens[sala] = [...state.mensagens[sala], ...novas];
          renderMensagens(sala, 'append', novas);
          // notificar se a sala não estiver visível
          if (sala !== state.salaAtual || !state.aberto) {
            state.naoLidas[sala] = (state.naoLidas[sala] || 0) + novas.length;
            atualizarBadgesSalas();
          }
        }
      } else {
        state.mensagens[sala] = mensagens;
        renderMensagens(sala, 'full');
      }
    } catch (e) {
      console.warn('[Chat] Erro ao carregar:', e.message);
    } finally {
      state.carregando = false;
    }
  }

  // ─── Polling ─────────────────────────────────────────
  function iniciarPolling() {
    pararPolling();
    // poll todas as salas para notificações
    state.pollTimer = setInterval(() => {
      SALAS.forEach(s => carregarMensagens(s.id, true));
    }, POLL_INTERVAL);
  }

  function pararPolling() {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
  }

  // ─── Envio ────────────────────────────────────────────
  async function enviarMensagem() {
    const input = document.getElementById('chatInput');
    const texto = (input?.value || '').trim();
    if (!texto || !state.usuario) return;
    if (texto.length > MAX_MSG_LEN) {
      mostrarErroChat(`Mensagem muito longa. Máximo: ${MAX_MSG_LEN} caracteres.`);
      return;
    }

    const sala = getSala(state.salaAtual);
    const msg  = {
      sala_id:      state.salaAtual,
      sala_nome:    sala.nome,
      autor_nome:   state.usuario.nome,
      autor_email:  state.usuario.email,
      autor_tipo:   state.usuario.tipo,
      texto:        esc(texto),
      protocolo_ref: state.protocoloRef || '',
      editada:      false,
      data_envio:   new Date().toISOString()
    };

    input.value = '';
    atualizarContadorChars();
    desabilitarEnvio(true);

    try {
      const nova = await apiEnviar(msg);
      if (!state.mensagens[state.salaAtual]) state.mensagens[state.salaAtual] = [];
      // evitar duplicação (o polling vai buscar também)
      const existIds = new Set(state.mensagens[state.salaAtual].map(m => m.id));
      if (!existIds.has(nova.id)) {
        state.mensagens[state.salaAtual].push(nova);
        renderMensagens(state.salaAtual, 'append', [nova]);
      }
    } catch (e) {
      mostrarErroChat('Não foi possível enviar a mensagem. Tente novamente.');
      input.value = texto;
    } finally {
      desabilitarEnvio(false);
      input.focus();
    }
  }

  // ─── Render: Mensagens ────────────────────────────────
  function renderMensagens(sala, modo, novas = []) {
    if (sala !== state.salaAtual) return;
    const container = document.getElementById('chatMensagens');
    if (!container) return;

    const msgs = state.mensagens[sala] || [];

    if (modo === 'full') {
      if (msgs.length === 0) {
        container.innerHTML = `
          <div class="chat-vazio">
            <i class="fas fa-comments"></i>
            <p>Nenhuma mensagem ainda.<br>Seja o primeiro a escrever!</p>
          </div>`;
        return;
      }
      container.innerHTML = '';
      // remover vazio se existir
      const vazioEl = container.querySelector('.chat-vazio');
      if (vazioEl) vazioEl.remove();
      renderBlocoMensagens(container, msgs, false);
      container.scrollTop = container.scrollHeight;
      return;
    }

    if (modo === 'append' && novas.length > 0) {
      // remover vazio se existir
      const vazioEl = container.querySelector('.chat-vazio');
      if (vazioEl) vazioEl.remove();
      const eraNaFundo = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
      renderBlocoMensagens(container, novas, true);
      if (eraNaFundo) container.scrollTop = container.scrollHeight;
    }
  }

  function renderBlocoMensagens(container, msgs, append) {
    let ultimaData = append
      ? (container.dataset.ultimaData || '')
      : '';

    msgs.forEach(msg => {
      const ts = msg.data_envio ? new Date(msg.data_envio).getTime() : (msg.created_at || 0);
      const dStr = new Date(ts).toDateString();

      if (dStr !== ultimaData) {
        const sep = document.createElement('div');
        sep.className = 'chat-separador-data';
        sep.innerHTML = `<span>${formatDataSeparador(ts)}</span>`;
        container.appendChild(sep);
        ultimaData = dStr;
      }

      const souEu = state.usuario && msg.autor_email === state.usuario.email;
      const perfil = getPerfil(msg.autor_tipo);
      const av = inicialAvatar(msg.autor_nome);

      const el = document.createElement('div');
      el.className = `chat-msg ${souEu ? 'chat-msg-eu' : 'chat-msg-outro'}`;
      el.dataset.id = msg.id;

      el.innerHTML = `
        <div class="chat-avatar" style="background:${perfil.cor};color:#fff;" title="${esc(msg.autor_nome)} (${perfil.label})">${av}</div>
        <div class="chat-bubble-wrap">
          <div class="chat-meta">
            <span class="chat-nome" style="color:${perfil.cor}">${esc(msg.autor_nome)}</span>
            <span class="chat-perfil-badge" style="background:${perfil.bg};color:${perfil.cor}">${perfil.label}</span>
            ${msg.protocolo_ref ? `<span class="chat-ref-badge"><i class="fas fa-ticket-alt"></i> ${esc(msg.protocolo_ref)}</span>` : ''}
          </div>
          <div class="chat-bubble" style="${souEu ? `background:${perfil.cor};color:#fff;` : `background:#fff;border:1px solid #e0e7ef;`}">
            <p>${esc(msg.texto).replace(/\n/g, '<br>')}</p>
          </div>
          <div class="chat-hora">${formatHora(msg.data_envio || msg.created_at)}</div>
        </div>`;

      container.appendChild(el);
    });

    container.dataset.ultimaData = ultimaData;
  }

  // ─── Render: Salas ───────────────────────────────────
  function renderSalas() {
    const container = document.getElementById('chatSalas');
    if (!container) return;
    container.innerHTML = SALAS.map(s => {
      const ativa  = s.id === state.salaAtual ? 'chat-sala-ativa' : '';
      const naoLid = state.naoLidas[s.id] || 0;
      return `
        <button class="chat-sala-btn ${ativa}" onclick="Chat.mudarSala('${s.id}')" title="${esc(s.desc)}" aria-pressed="${s.id === state.salaAtual}">
          <i class="fas ${s.icon}"></i>
          <span>${esc(s.nome)}</span>
          ${naoLid > 0 ? `<span class="chat-badge-nao-lidas">${naoLid > 99 ? '99+' : naoLid}</span>` : ''}
        </button>`;
    }).join('');
  }

  function atualizarBadgesSalas() {
    renderSalas();
    // badge total no botão flutuante
    const total = Object.values(state.naoLidas).reduce((a, b) => a + b, 0);
    const badge = document.getElementById('chatFabBadge');
    if (badge) {
      badge.textContent = total > 99 ? '99+' : total;
      badge.style.display = total > 0 ? 'flex' : 'none';
    }
  }

  // ─── Troca de sala ───────────────────────────────────
  async function mudarSala(salaId) {
    if (salaId === state.salaAtual) return;
    state.salaAtual = salaId;
    state.naoLidas[salaId] = 0;
    renderSalas();
    atualizarHeaderSala();
    const container = document.getElementById('chatMensagens');
    if (container) {
      container.innerHTML = '<div class="chat-loading"><i class="fas fa-spinner fa-spin"></i> Carregando mensagens…</div>';
    }
    await carregarMensagens(salaId, false);
  }

  function atualizarHeaderSala() {
    const sala = getSala(state.salaAtual);
    const el   = document.getElementById('chatSalaAtualNome');
    const desc = document.getElementById('chatSalaAtualDesc');
    if (el)   el.textContent = sala.nome;
    if (desc) desc.textContent = sala.desc;
  }

  // ─── UI Helpers ──────────────────────────────────────
  function atualizarContadorChars() {
    const input  = document.getElementById('chatInput');
    const contador = document.getElementById('chatContadorChars');
    if (!input || !contador) return;
    const len = input.value.length;
    contador.textContent = `${len}/${MAX_MSG_LEN}`;
    contador.style.color = len > MAX_MSG_LEN * 0.9 ? '#c62828' : '#90a4ae';
  }

  function desabilitarEnvio(sim) {
    const btn = document.getElementById('chatEnviarBtn');
    if (btn) btn.disabled = sim;
  }

  function mostrarErroChat(msg) {
    const el = document.getElementById('chatErro');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
  }

  function setProtocoloRef(protocolo) {
    state.protocoloRef = protocolo || '';
    const el = document.getElementById('chatRefProtocolo');
    if (el) {
      el.textContent = protocolo ? `📎 Referenciando: ${protocolo}` : '';
      el.style.display = protocolo ? 'block' : 'none';
    }
  }

  // ─── Abrir / Fechar ──────────────────────────────────
  function abrir() {
    state.aberto = true;
    const panel = document.getElementById('chatPanel');
    if (panel) {
      panel.classList.add('chat-panel-aberto');
      panel.setAttribute('aria-hidden', 'false');
    }
    // limpar não lidas da sala atual
    state.naoLidas[state.salaAtual] = 0;
    atualizarBadgesSalas();
    carregarMensagens(state.salaAtual, false);
    iniciarPolling();
    setTimeout(() => {
      const input = document.getElementById('chatInput');
      if (input) input.focus();
    }, 300);
  }

  function fechar() {
    state.aberto = false;
    const panel = document.getElementById('chatPanel');
    if (panel) {
      panel.classList.remove('chat-panel-aberto');
      panel.setAttribute('aria-hidden', 'true');
    }
    pararPolling();
  }

  function toggle() {
    state.aberto ? fechar() : abrir();
  }

  // ─── Login / Identificação ───────────────────────────
  function mostrarLogin() {
    const overlay = document.getElementById('chatLoginOverlay');
    if (overlay) overlay.style.display = 'flex';
  }

  function fecharLogin() {
    const overlay = document.getElementById('chatLoginOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  function confirmarLogin() {
    const nome  = (document.getElementById('chatLoginNome')?.value  || '').trim();
    const email = (document.getElementById('chatLoginEmail')?.value || '').trim();
    const tipo  = document.getElementById('chatLoginTipo')?.value  || 'cliente';

    if (!nome)  { document.getElementById('chatLoginNome')?.focus();  return; }
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      document.getElementById('chatLoginEmail')?.focus(); return;
    }

    state.usuario = { nome, email, tipo };
    salvarUsuario(state.usuario);
    fecharLogin();
    atualizarUsuarioUI();
    abrir();
  }

  function trocarUsuario() {
    fechar();
    state.usuario = null;
    localStorage.removeItem('igc_chat_usuario');
    atualizarUsuarioUI();
    mostrarLogin();
  }

  function atualizarUsuarioUI() {
    const info    = document.getElementById('chatUsuarioInfo');
    const btnBar  = document.getElementById('chatLoginBtnBar');
    if (!info) return;
    if (state.usuario) {
      const perfil = getPerfil(state.usuario.tipo);
      const av = inicialAvatar(state.usuario.nome);
      info.innerHTML = `
        <div class="chat-av-mini" style="background:${perfil.cor}">${av}</div>
        <span class="chat-usuario-nome">${esc(state.usuario.nome)}</span>
        <span class="chat-perfil-badge" style="background:${perfil.bg};color:${perfil.cor};font-size:10px;padding:1px 6px;border-radius:6px;font-weight:600;">${perfil.label}</span>
        <button class="chat-trocar-btn" onclick="Chat.trocarUsuario()" title="Trocar usuário"><i class="fas fa-exchange-alt"></i></button>`;
      info.style.display = 'flex';
      if (btnBar) btnBar.style.display = 'none';
    } else {
      info.innerHTML  = '';
      info.style.display = 'none';
      if (btnBar) btnBar.style.display = 'block';
    }
  }

  // ─── Inicialização ───────────────────────────────────
  function init() {
    // usuário já logado?
    const u = carregarUsuarioLocal();
    if (u) {
      state.usuario = u;
      atualizarUsuarioUI();
    }

    renderSalas();
    atualizarHeaderSala();

    // bind events
    const input = document.getElementById('chatInput');
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          enviarMensagem();
        }
      });
      input.addEventListener('input', atualizarContadorChars);
    }

    // fechar com ESC
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.aberto) fechar();
    });

    // iniciar polling passivo para notificações (sem abrir o painel)
    state.pollTimer = setInterval(() => {
      SALAS.forEach(s => carregarMensagens(s.id, true));
    }, POLL_INTERVAL * 2); // polling mais lento enquanto fechado
  }

  // ─── API pública ─────────────────────────────────────
  return {
    init,
    toggle,
    abrir,
    fechar,
    mudarSala,
    enviarMensagem,
    confirmarLogin,
    fecharLogin,
    trocarUsuario,
    setProtocoloRef,
    mostrarLogin: () => {
      if (!state.usuario) mostrarLogin();
      else toggle();
    },
  };

})();

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => Chat.init());
