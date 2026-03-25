
function _preferirHttpsSePossivel(url = '') {
    const raw = String(url || '').trim();
    if (!raw) return '';

    try {
        const parsed = new URL(raw);
        if (location.protocol === 'https:' && parsed.protocol === 'http:') {
            parsed.protocol = 'https:';
            return parsed.toString();
        }
        return parsed.toString();
    } catch {
        return raw;
    }
}

function _desativarRemotePlayback(video) {
    if (!video) return;

    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('x-webkit-airplay', 'deny');
    video.setAttribute('disableremoteplayback', '');
    video.setAttribute('disablePictureInPicture', '');
    video.setAttribute('controlslist', 'nodownload noremoteplayback nofullscreen');

    try { video.disableRemotePlayback = true; } catch {}
    try { video.disablePictureInPicture = true; } catch {}

    const controlsList = video.controlsList;
    if (controlsList?.add) {
        try { controlsList.add('nodownload'); } catch {}
        try { controlsList.add('noremoteplayback'); } catch {}
        try { controlsList.add('nofullscreen'); } catch {}
    }
}

function _novoHls(opts = {}) {
    if (typeof Hls === 'undefined' || !Hls.isSupported()) return null;
    return new Hls({ enableWorker: true, ...opts });
}

Object.defineProperty(window, '_animeAtual', {
    get: () => AppStore.getAnimeAtual(),
    set: (v) => AppStore.setAnimeAtual(v),
    configurable: true,
});
Object.defineProperty(window, '_tituloAtivo', {
    get: () => AppStore.getTituloAtivo(),
    set: (v) => AppStore.setTituloAtivo(v),
    configurable: true,
});

function _marcarLinkMortoSessao(url)   { SourceResolver.marcarMorto(url); }
function _linkMortoNaSessao(url)       { return SourceResolver.estasMorto(url); }
function _lerPrefetch(ep, epIdx)       { return SourceResolver.lerPrefetch(_animeSlugAtual(), epIdx); }
function _salvarPrefetch(ep, epIdx, url) { SourceResolver.salvarPrefetch(_animeSlugAtual(), epIdx, url); }

function _animeSlugAtual() {
    const anime = AppStore.getAnimeAtual();
    const titulo = (anime?.anime_title || anime?._nomeExibicao || '')
        .replace(/\s*(dublado|dub)\s*/gi, '').trim();
    return typeof slugify === 'function'
        ? slugify(titulo)
        : titulo.toLowerCase().replace(/\W/g, '');
}

async function _prefetchEpisodio(ep, epIdx, anime) {
    if (!ep || _lerPrefetch(ep, epIdx)) return;
    const slug = typeof slugify === 'function' ? slugify(anime?.anime_title || '') : '';
    await SourceResolver.prefetchEpisodio(slug, ep, epIdx, anime);
}

function _preResolverSources(anime, qtd = 2) {
    SourceResolver.preResolverSources(anime, qtd);
}

async function getValidSource(ep, isDub, isBoth) {
    return SourceResolver.getValidSource(ep, isDub, isBoth);
}

function _limparIframeAtivo() {
    const modal = document.getElementById('modal-dados');
    if (!modal) return;
    const iframe = modal.querySelector('iframe');
    if (iframe) { iframe.src = 'about:blank'; iframe.remove(); }
}

function _desmontarMidiaAtiva() {
    _limparTimers();
    _limparIframeAtivo();

    const video = document.getElementById('rf-video');
    if (video) {
        try { video.pause(); } catch {}
        try { video.removeAttribute('src'); } catch {}
        try { video.load(); } catch {}
    }

    if (window._hlsInstancia) {
        try { window._hlsInstancia.destroy(); } catch {}
        window._hlsInstancia = null;
    }
}

let _playerSessionSeq = 0;
let _playerSessionAtiva = 0;
let _animePlayerOpenSeq = 0;

function _abrirSessaoPlayer() {
    _playerSessionAtiva = ++_playerSessionSeq;
    return _playerSessionAtiva;
}

function _encerrarSessaoPlayer(sessionId) {
    if (sessionId && _playerSessionAtiva === sessionId) {
        _playerSessionAtiva = 0;
    }
}

function _sessaoPlayerAtiva(sessionId) {
    return !!sessionId && _playerSessionAtiva === sessionId;
}

function _novaTentativaPlayerAnime() {
    return ++_animePlayerOpenSeq;
}

function _tentativaPlayerAnimeAtiva(token) {
    return !!token && token === _animePlayerOpenSeq;
}

function _deveUsarHistoricoPlayerMobile() {
    return !!window.PlayerFlow?.shouldUseHistory?.();
}

function _marcarRetornoDiretoParaModal() {
    window.PlayerFlow?.markDirectModalReturn?.(location.pathname);
}

function _desarmarHistoricoPlayer() {
    window.PlayerFlow?.disarm?.();
}

// ── Preservar / restaurar conteúdo do modal ao abrir player ──────────────
function _preservarConteudoModal(modalDados) {
    if (!modalDados) return;
    // Esconder todos os filhos atuais em vez de destruí-los
    Array.from(modalDados.children).forEach(child => {
        if (!child.classList.contains('rf-player-layer')) {
            child.dataset.rfHiddenByPlayer = '1';
            child.style.display = 'none';
        }
    });
}

function _restaurarConteudoModal(modalDados) {
    if (!modalDados) return false;
    // Remover a camada do player
    modalDados.querySelectorAll('.rf-player-layer').forEach(el => el.remove());
    // Restaurar filhos escondidos
    const ocultos = modalDados.querySelectorAll('[data-rf-hidden-by-player]');
    if (!ocultos.length) return false;
    ocultos.forEach(child => {
        delete child.dataset.rfHiddenByPlayer;
        child.style.removeProperty('display');
    });
    return true;
}

function _limparConteudoModalParaPlayer(modalDados) {
    // Preserva o conteúdo existente (se houver) e retorna container para o player
    _preservarConteudoModal(modalDados);
    const layer = document.createElement('div');
    layer.className = 'rf-player-layer';
    layer.style.cssText = 'width:100%;height:100%;';
    modalDados.appendChild(layer);
    return layer;
}

function _ativarPlayerUiBase() {
    document.body?.classList.add('rf-player-open');
    document.querySelector('.modal-conteudo')?.classList.add('player-mode');
    document.getElementById('modal-container')?.classList.add('modal-player-mode');
    document.getElementById('modal-close-btn')?.style.setProperty('display', 'none', 'important');
}

function _limparPlayerUiBase({ clearModal = false } = {}) {
    _desmontarMidiaAtiva();
    _sairImersaoMobile();
    document.body?.classList.remove('rf-player-open');
    document.querySelector('.modal-conteudo')?.classList.remove('player-mode');
    document.getElementById('modal-container')?.classList.remove('modal-player-mode');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    if (modalCloseBtn) modalCloseBtn.style.removeProperty('display');
    const dados = document.getElementById('modal-dados');
    if (dados) {
        // Sempre restaurar conteúdo preservado e remover camada do player
        _restaurarConteudoModal(dados);
        if (clearModal) dados.innerHTML = '';
    }
}

function _registrarHistoricoPlayer(onBackToModal) {
    window.PlayerFlow?.arm?.(onBackToModal);
}

function _voltarDoPlayer(onBackToModal) {
    if (window.PlayerFlow?.requestBack) {
        window.PlayerFlow.requestBack(onBackToModal);
        return;
    }
    if (typeof onBackToModal === 'function') {
        onBackToModal({ fromHistory: false });
    }
}

function _marcarEpIndisponivel(divEl) {
    if (!divEl) return;
    divEl.classList.add('ep-indisponivel');
    const tl = divEl.querySelector('.ep-titulo-linha');
    if (tl && !tl.querySelector('.badge-ep-indisponivel')) {
        const b = document.createElement('span');
        b.className = 'badge-ep-indisponivel';
        b.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Indisponível';
        tl.appendChild(b);
    }
}

function _desmarcarEpIndisponivel(divEl) {
    if (!divEl) return;
    divEl.classList.remove('ep-indisponivel');
    divEl.querySelector('.badge-ep-indisponivel')?.remove();
}

function _marcarTopoComoDisponivel(anime) {
    const titulo = anime?._nomeExibicao || anime?.anime_title || '';
    if (!titulo) return;
    const acoes = document.getElementById('modal-acoes-btn') || document.querySelector('.modal-acoes-netflix');
    if (!acoes) return;
    const isDub = !!anime?._isDub;
    const label = isDub ? 'Dublado' : 'Assistir';
    let btn = document.getElementById('btn-assistir-anime-inicial') || document.getElementById('btn-assistir-sync');
    if (!btn) {
        acoes.innerHTML = `<button class="btn-play-netflix" id="btn-assistir-sync">
            <i class="fa-solid fa-play"></i> ${label}</button>`;
        btn = document.getElementById('btn-assistir-sync');
    }
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-play"></i> ${label}`;
}

// Progresso e renderContinuarAssistindo → movidos para progress.js

let _playerTimer   = null;
let _autoplayTimer = null;

function _limparTimers() {
    if (_playerTimer)   { clearTimeout(_playerTimer);    _playerTimer = null; }
    if (_autoplayTimer) { clearInterval(_autoplayTimer); _autoplayTimer = null; }
}

function _formatarTempo(seg) {
    if (isNaN(seg) || seg < 0) return '0:00';
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = Math.floor(seg % 60);
    if (h > 0) return h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    return m + ':' + String(s).padStart(2,'0');
}

function _isMobileViewport() {
    return window.matchMedia ? window.matchMedia('(max-width: 768px)').matches : window.innerWidth <= 768;
}

function _isTouchViewport() {
    return window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : ((navigator.maxTouchPoints || 0) > 0);
}

function _deveUsarImersaoMobile() {
    return _isMobileViewport() && _isTouchViewport();
}

function _getFullscreenElement() {
    return document.fullscreenElement
        || document.webkitFullscreenElement
        || document.mozFullScreenElement
        || document.msFullscreenElement
        || null;
}

function _targetEstaEmFullscreen(targetEl) {
    const fsEl = _getFullscreenElement();
    if (!fsEl || !targetEl) return false;
    return fsEl === targetEl || !!targetEl.contains?.(fsEl);
}

function _restaurarUiAposSaidaFullscreen(targetEl, controlsEl = null) {
    if (!targetEl) return;
    targetEl.classList.remove('rf-player-fullscreen', 'rf-player-windowed', 'rf-mobile-immersive-active');
    targetEl.style.removeProperty('width');
    targetEl.style.removeProperty('height');
    targetEl.style.removeProperty('cursor');

    if (controlsEl) {
        controlsEl.classList.add('visible');
        targetEl.classList.add('controls-visible');
    }
}

async function _bloquearOrientacaoPaisagem() {
    try {
        if (screen.orientation?.lock) await screen.orientation.lock('landscape');
    } catch (e) {}
}

function _desbloquearOrientacao() {
    try {
        if (screen.orientation?.unlock) screen.orientation.unlock();
    } catch (e) {}
}

async function _entrarImersaoMobile(targetEl) {
    if (!_deveUsarImersaoMobile()) return false;

    const fsAtivo = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    const el = targetEl || document.documentElement;

    if (!fsAtivo) {
        try {
            if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
            else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
            else if (el.msRequestFullscreen) el.msRequestFullscreen();
        } catch (e) {}
    }

    await _bloquearOrientacaoPaisagem();
    return true;
}

function _sairImersaoMobile() {
    _desbloquearOrientacao();
    try {
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozFullScreenElement && document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.msFullscreenElement && document.msExitFullscreen) document.msExitFullscreen();
    } catch (e) {}
}

function _prepararModoImersivoMobile(targetEl, { controlsEl = null, onExit = null } = {}) {
    if (!_deveUsarImersaoMobile() || !targetEl) return () => {};
    let disposed = false;
    let esteveEmFullscreen = false;

    const tentarImersao = () => {
        Promise.resolve(_entrarImersaoMobile(targetEl)).catch(() => {});
    };

    const syncFullscreenState = () => {
        if (disposed) return;
        const emFullscreen = _targetEstaEmFullscreen(targetEl);
        targetEl.classList.toggle('rf-mobile-immersive-active', emFullscreen);
        if (emFullscreen) {
            esteveEmFullscreen = true;
            return;
        }

        if (esteveEmFullscreen) {
            esteveEmFullscreen = false;
            _desbloquearOrientacao();
            _restaurarUiAposSaidaFullscreen(targetEl, controlsEl);
            if (typeof onExit === 'function') onExit();
        }
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState);
    document.addEventListener('mozfullscreenchange', syncFullscreenState);
    document.addEventListener('MSFullscreenChange', syncFullscreenState);

    requestAnimationFrame(tentarImersao);
    targetEl.addEventListener('touchstart', tentarImersao, { once: true, passive: true });
    targetEl.addEventListener('click', tentarImersao, { once: true });

    return () => {
        disposed = true;
        esteveEmFullscreen = false;
        document.removeEventListener('fullscreenchange', syncFullscreenState);
        document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
        document.removeEventListener('mozfullscreenchange', syncFullscreenState);
        document.removeEventListener('MSFullscreenChange', syncFullscreenState);
    };
}

// Troca de episódio sem destruir o player — mantém o mesmo <video> e container fullscreen.
// Salva progresso do ep atual, carrega nova fonte no mesmo elemento, atualiza UI.
async function _trocarFontePlayerNativo({ novoEpIdx, novoEmbedUrl, novoLabelEp, novoSerieLabel,
    totalEps, titulo, tmdbId, slug, animeData, progressMeta = {},
    onVoltar, onAnterior, onProximo, playerSessionId }) {

    const player   = document.getElementById('rf-player');
    const video    = document.getElementById('rf-video');
    const controls = document.getElementById('rf-controls');
    if (!player || !video || !controls) return false;

    // ── 1. Salvar progresso do episódio atual ──────────────────────────────
    if (slug && video.duration) {
        const epAtual = parseInt(player.dataset.epIdx || '0', 10);
        const metaAtual = JSON.parse(player.dataset.progressMeta || '{}');
        _salvarProgresso(slug, epAtual, video.currentTime, video.duration, metaAtual);
    }

    // ── 2. Parar mídia atual SEM sair de fullscreen ────────────────────────
    _limparTimers();
    try { video.pause(); } catch {}
    if (window._hlsInstancia) {
        try { window._hlsInstancia.destroy(); } catch {}
        window._hlsInstancia = null;
    }
    try { video.removeAttribute('src'); video.load(); } catch {}

    // ── 3. Atualizar metadados no player DOM ───────────────────────────────
    player.dataset.epIdx = novoEpIdx;
    player.dataset.progressMeta = JSON.stringify(progressMeta);

    // Atualizar label de título/episódio
    const elSerie = controls.querySelector('.rf-nf-serie');
    const elEp    = controls.querySelector('.rf-nf-ep');
    if (elSerie) elSerie.textContent = novoSerieLabel;
    if (elEp)    elEp.textContent = novoLabelEp !== novoSerieLabel ? ' · ' + novoLabelEp : '';

    // Mostrar/ocultar botão Próximo conforme posição
    const elProximo = document.getElementById('rf-proximo-ep');
    if (elProximo) {
        elProximo.style.display = novoEpIdx < totalEps - 1 ? '' : 'none';
    }

    // ── 4. Esconder autoplay overlay se estava visível ─────────────────────
    const elAutoplay = document.getElementById('rf-autoplay');
    if (elAutoplay) elAutoplay.style.display = 'none';

    // ── 5. Mostrar buffering ───────────────────────────────────────────────
    const elBuffering = document.getElementById('rf-buffering');
    if (elBuffering) elBuffering.style.display = 'flex';

    // Resetar barra de progresso
    const elFill  = document.getElementById('rf-progress-fill');
    const elThumb = document.getElementById('rf-progress-thumb');
    const elTime  = document.getElementById('rf-time-current');
    if (elFill)  elFill.style.width  = '0%';
    if (elThumb) elThumb.style.left  = '0%';
    if (elTime)  elTime.textContent  = '0:00';

    // ── 6. Carregar nova fonte ─────────────────────────────────────────────
    const isM3u8 = _isM3u8ouManifest(novoEmbedUrl);
    const isMp4  = /\.mp4(\?|$)/i.test(novoEmbedUrl);
    const isProxiedMp4 = _deveProxificarMp4(novoEmbedUrl);
    const mediaUrl = isProxiedMp4 ? novoEmbedUrl : novoEmbedUrl;

    const _tentarPlay = async () => {
        if (!_sessaoPlayerAtiva(playerSessionId)) return;
        try { await video.play(); return; } catch {}
        if (!video.muted) {
            try { video.muted = true; await video.play(); } catch {}
        }
    };

    if (isM3u8 && typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = _novoHls({ maxBufferLength: 30 });
        window._hlsInstancia = hls;
        const hlsSrc = false
            ? novoEmbedUrl
            : novoEmbedUrl;
        hls.on(Hls.Events.MEDIA_ATTACHED, () => { if (_sessaoPlayerAtiva(playerSessionId)) hls.loadSource(hlsSrc); });
        hls.on(Hls.Events.MANIFEST_PARSED, () => { _tentarPlay(); });
        hls.on(Hls.Events.ERROR, (e, d) => {
            if (!d.fatal) return;
            if (d.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
            else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        });
        hls.attachMedia(video);
    } else if (isM3u8 && video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = novoEmbedUrl;
        video.addEventListener('loadedmetadata', _tentarPlay, { once: true });
    } else {
        video.src = mediaUrl;
        _tentarPlay();
    }

    // Retomar do progresso salvo se houver
    const progSalvo = _lerProgresso(slug, novoEpIdx);
    if (progSalvo && progSalvo.t > 5 && progSalvo.p < 0.95) {
        video.addEventListener('loadedmetadata', () => { video.currentTime = progSalvo.t; }, { once: true });
    }

    return true;
}

function _criarPlayerNativo({ labelEp, serieLabel, epIdx, totalEps }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'rf-player';
    wrapper.id = 'rf-player';
    wrapper.innerHTML = `
        <video id="rf-video" class="rf-video" playsinline webkit-playsinline preload="auto" autoplay x-webkit-airplay="deny" disableremoteplayback disablePictureInPicture controlslist="nodownload noremoteplayback nofullscreen"></video>
        <div class="rf-buffering" id="rf-buffering"><div class="rf-spinner"></div></div>
        <div class="rf-autoplay" id="rf-autoplay" style="display:none">
            <div class="rf-autoplay-inner">
                <span class="rf-autoplay-label">Próximo episódio em</span>
                <span class="rf-autoplay-count" id="rf-autoplay-count">5</span>
                <div class="rf-autoplay-btns">
                    <button class="rf-btn-secondary" id="rf-autoplay-cancel">Cancelar</button>
                    <button class="rf-btn-primary"   id="rf-autoplay-agora">Assistir agora</button>
                </div>
            </div>
        </div>
        <div class="rf-controls" id="rf-controls">
            <div class="rf-nf-top">
                <button class="rf-back" id="rf-back"><i class="fa-solid fa-arrow-left"></i></button>
            </div>
            <div class="rf-nf-middle" id="rf-nf-middle">
                <div class="rf-middle-controls" id="rf-middle-controls">
                    <button class="rf-center-skip" id="rf-center-skip-left" title="Voltar 10s">
                        <i class="fa-solid fa-rotate-left"></i>
                        <span class="rf-center-skip-label">10s</span>
                    </button>
                    <button class="rf-center-play" id="rf-center-play">
                        <i class="fa-solid fa-play" id="rf-center-play-icon"></i>
                    </button>
                    <button class="rf-center-skip" id="rf-center-skip-right" title="Avancar 10s">
                        <i class="fa-solid fa-rotate-right"></i>
                        <span class="rf-center-skip-label">10s</span>
                    </button>
                </div>
                <div class="rf-dtap-left"  id="rf-dtap-left"></div>
                <div class="rf-dtap-right" id="rf-dtap-right"></div>
            </div>
            <div class="rf-nf-bottom">
                <div class="rf-nf-progress-row">
                    <div class="rf-progress-wrap" id="rf-progress-wrap">
                        <div class="rf-progress-bg">
                            <div class="rf-progress-buffer" id="rf-progress-buffer"></div>
                            <div class="rf-progress-fill"   id="rf-progress-fill"></div>
                            <div class="rf-progress-thumb"  id="rf-progress-thumb"></div>
                        </div>
                        <div class="rf-thumb-preview" id="rf-thumb-preview">
                            <div class="rf-thumb-img" id="rf-thumb-img"></div>
                            <span class="rf-thumb-time" id="rf-thumb-time">0:00</span>
                        </div>
                    </div>
                    <span class="rf-nf-time" id="rf-time-current">0:00</span>
                </div>
                <div class="rf-nf-bar">
                    <div class="rf-nf-bar-left">
                        <button class="rf-btn-ctrl" id="rf-play-pause">
                            <i class="fa-solid fa-play" id="rf-play-icon"></i>
                        </button>
                        <button class="rf-btn-ctrl rf-desktop-skip" id="rf-skip-left-btn" title="Voltar 10s">
                            <i class="fa-solid fa-rotate-left"></i>
                        </button>
                        <button class="rf-btn-ctrl rf-desktop-skip" id="rf-skip-right-btn" title="Avançar 10s">
                            <i class="fa-solid fa-rotate-right"></i>
                        </button>
                        <div class="rf-volume-wrap">
                            <button class="rf-btn-ctrl" id="rf-mute">
                                <i class="fa-solid fa-volume-high" id="rf-vol-icon"></i>
                            </button>
                            <div class="rf-volume-slider-wrap">
                                <input type="range" class="rf-volume-slider" id="rf-volume" min="0" max="1" step="0.05" value="1">
                            </div>
                        </div>
                    </div>
                    <div class="rf-nf-title-center">
                        <span class="rf-nf-serie">${sanitizarHTML(serieLabel)}</span>
                        ${labelEp !== serieLabel ? `<span class="rf-nf-ep"> · ${sanitizarHTML(labelEp)}</span>` : ''}
                    </div>

                    <div class="rf-nf-bar-right">
                        ${epIdx < totalEps - 1 ? '<button class="rf-btn-ctrl rf-btn-next-ep" id="rf-proximo-ep"><i class="fa-solid fa-forward-step"></i><span>Próximo</span></button>' : ''}
                        <div class="rf-menu-wrap" id="rf-audio-wrap" style="display:none">
                            <button class="rf-btn-ctrl rf-btn-menu" id="rf-audio-btn" title="Áudio" aria-label="Áudio">
                                <span class="rf-btn-menu-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="none" role="img">
                                        <path fill="currentColor" fill-rule="evenodd" d="M1 3a1 1 0 0 1 1-1h20a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3v3a1 1 0 0 1-1.55.83L11.7 18H2a1 1 0 0 1-1-1zm2 1v12h9.3l.25.17L17 19.13V16h4V4zm7 5H5V7h5zm9 2h-5v2h5zm-7 2H5v-2h7zm7-6h-7v2h7z" clip-rule="evenodd"></path>
                                    </svg>
                                </span>
                                <span class="rf-btn-menu-text">Áudio</span>
                            </button>
                            <div class="rf-speed-menu" id="rf-audio-menu"></div>
                        </div>
                        <div class="rf-speed-wrap">
                            <button class="rf-btn-ctrl rf-btn-menu rf-btn-speed" id="rf-speed-btn" title="Velocidade" aria-label="Velocidade">
                                <i class="fa-solid fa-gauge-high"></i>
                                <span class="rf-btn-menu-text">1×</span>
                            </button>
                            <div class="rf-speed-menu" id="rf-speed-menu">
                                <button class="rf-speed-opt" data-speed="0.5">0.5×</button>
                                <button class="rf-speed-opt" data-speed="0.75">0.75×</button>
                                <button class="rf-speed-opt ativo" data-speed="1">1×</button>
                                <button class="rf-speed-opt" data-speed="1.25">1.25×</button>
                                <button class="rf-speed-opt" data-speed="1.5">1.5×</button>
                                <button class="rf-speed-opt" data-speed="2">2×</button>
                            </div>
                        </div>
                        <button class="rf-btn-ctrl" id="rf-fullscreen">
                            <i class="fa-solid fa-expand" id="rf-fs-icon"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    return wrapper;
}

function _inicializarPlayerNativo({ epIdx, totalEps, tSafe, idSafe, titulo, tmdbId, slug, animeData, embedUrl, progressMeta = {}, onVoltar = null, onAnterior = null, onProximo = null, onSourceFailure = null, labelAnterior = 'Anterior', labelProximo = 'Próximo', playerSessionId = 0 }) {
    const player   = document.getElementById('rf-player');
    const video    = document.getElementById('rf-video');
    const controls = document.getElementById('rf-controls');
    if (!player || !video || !controls) return;
    _desativarRemotePlayback(video);

    function _isPlayerFullscreen() {
        return !!(
            document.fullscreenElement === player ||
            document.webkitFullscreenElement === player ||
            document.mozFullScreenElement === player ||
            document.msFullscreenElement === player
        );
    }

    function _ajustarJanelaPlayer() {
        const isFs = _isPlayerFullscreen();
        player.classList.toggle('rf-player-fullscreen', isFs);

        const desktopWindowed = !isFs && window.innerWidth >= 1100 && window.innerWidth > window.innerHeight;
        if (!desktopWindowed || !video.videoWidth || !video.videoHeight) {
            player.classList.remove('rf-player-windowed');
            player.style.removeProperty('width');
            player.style.removeProperty('height');
            return;
        }

        const gutterX = Math.max(16, Math.round(window.innerWidth * 0.02));
        const gutterY = Math.max(16, Math.round(window.innerHeight * 0.02));
        const maxWidth = Math.max(320, window.innerWidth - (gutterX * 2));
        const maxHeight = Math.max(220, window.innerHeight - (gutterY * 2));
        const ratio = video.videoWidth / video.videoHeight;

        let width = maxWidth;
        let height = width / ratio;
        if (height > maxHeight) {
            height = maxHeight;
            width = height * ratio;
        }

        player.classList.add('rf-player-windowed');
        player.style.width = `${Math.round(width)}px`;
        player.style.height = `${Math.round(height)}px`;
        _ajustarVideoFit();
    }

    function _ajustarVideoFit() {
        let fitMode = 'contain';
        let objectPosition = 'center top';

        if (!_isPlayerFullscreen() && video.videoWidth && video.videoHeight) {
            const containerWidth = player.clientWidth || window.innerWidth || 1;
            const containerHeight = player.clientHeight || window.innerHeight || 1;
            const videoRatio = video.videoWidth / video.videoHeight;
            const containerRatio = containerWidth / containerHeight;
            const hasTopBottomBars = videoRatio > containerRatio;

            if (hasTopBottomBars) {
                const cropPenalty = videoRatio / containerRatio;
                if (cropPenalty <= 1.42) {
                    fitMode = 'cover';
                    objectPosition = 'center center';
                }
            }
        }

        player.dataset.videoFit = fitMode;
        player.style.setProperty('--rf-video-position', objectPosition);
    }

    let _voltarParaModalDoPlayer = null;
    let _playerClosing = false;
    let _playerBackPending = false;
    const _solicitarVoltaParaModal = ({ directToModal = false } = {}) => {
        if (_playerClosing || _playerBackPending || !_sessaoPlayerAtiva(playerSessionId)) return;
        _playerBackPending = true;
        if (directToModal) _marcarRetornoDiretoParaModal();
        if (typeof _voltarParaModalDoPlayer === 'function') {
            setTimeout(() => _voltarDoPlayer(_voltarParaModalDoPlayer), 0);
        }
    };
    const _disposeMobileImmersion = _prepararModoImersivoMobile(player, {
        controlsEl: controls,
        onExit: () => {
            _solicitarVoltaParaModal();
        },
    });
    _voltarParaModalDoPlayer = ({ fromHistory = false } = {}) => {
        if (_playerClosing) return;
        _playerClosing = true;
        _playerBackPending = false;
        _encerrarSessaoPlayer(playerSessionId);
        _desarmarHistoricoPlayer();
        _removeKey();
        _removeFsListeners();
        if (slug && video.duration) _salvarProgresso(slug, epIdx, video.currentTime, video.duration, progressMeta);
        _limparPlayerUiBase({ clearModal: fromHistory });

        if (fromHistory) return;

        if (typeof onVoltar === 'function') {
            onVoltar();
        } else {
            voltarParaDetalhesAnime(tSafe, idSafe);
        }
    };

    const isM3u8 = _isM3u8ouManifest(embedUrl);
    const isMp4  = /\.mp4(\?|$)/i.test(embedUrl);
    const isProxiedMp4 = _deveProxificarMp4(embedUrl);
    const mediaUrl = isProxiedMp4 ? embedUrl : embedUrl;
    let _autoplayBootAttempts = 0;
    const _tentarIniciarPlayback = async () => {
        if (!_sessaoPlayerAtiva(playerSessionId)) return;
        try {
            await video.play();
            return;
        } catch {}

        if (!video.muted) {
            try {
                video.muted = true;
                await video.play();
            } catch {}
        }
    };
    const _agendarTentativaPlayback = () => {
        if (!_sessaoPlayerAtiva(playerSessionId)) return;
        if (!video.paused || video.ended) return;
        if (video.currentTime > 1.5) return;
        if (_autoplayBootAttempts >= 4) return;
        _autoplayBootAttempts += 1;
        setTimeout(() => {
            if (!_sessaoPlayerAtiva(playerSessionId)) return;
            if (!video.paused || video.ended || video.currentTime > 1.5) return;
            _tentarIniciarPlayback();
        }, 180 * _autoplayBootAttempts);
    };

    if (isM3u8 && typeof Hls !== 'undefined' && Hls.isSupported()) {
        if (window._hlsInstancia) { window._hlsInstancia.destroy(); window._hlsInstancia = null; }
        const hls = (_novoHls({ maxBufferLength: 30 }));
        window._hlsInstancia = hls;
        const hlsSrc = false
            ? embedUrl
            : embedUrl;

        const _selecionarAudioPreferido = () => {
            const tracks = hls.audioTracks || [];
            if (!tracks.length) return;
            const idxPT = tracks.findIndex(t => {
                const lang = String(t?.lang || t?.language || '').toLowerCase();
                const name = String(t?.name || '').toLowerCase();
                return /^(pt|pt-br|por)$/.test(lang) || /portugu|dublado|brasil/.test(name);
            });
            if (idxPT >= 0 && hls.audioTrack !== idxPT) hls.audioTrack = idxPT;
        };

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            if (!_sessaoPlayerAtiva(playerSessionId)) return;
            hls.loadSource(hlsSrc);
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            _selecionarAudioPreferido();
            _renderAudios();
            _tentarIniciarPlayback();
            _agendarTentativaPlayback();
        });
        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
            _selecionarAudioPreferido();
            _renderAudios();
        });
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, () => _renderAudios());
        hls.on(Hls.Events.ERROR, (e, d) => {
            if (!d.fatal) return;
            if (d.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
            else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        });
        hls.attachMedia(video);
    } else if (isM3u8 && video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = embedUrl;
        video.addEventListener('loadedmetadata', _tentarIniciarPlayback, { once: true });
    } else {
        video.src = mediaUrl;
        _tentarIniciarPlayback();
    }

    const progSalvo = _lerProgresso(slug, epIdx);
    if (progSalvo && progSalvo.t > 5 && progSalvo.p < 0.95) {
        video.addEventListener('loadedmetadata', () => { video.currentTime = progSalvo.t; }, { once: true });
    }
    video.addEventListener('loadedmetadata', _ajustarVideoFit, { once: true });
    video.addEventListener('loadeddata', _ajustarVideoFit);

    const elPlayPause     = document.getElementById('rf-play-pause');
    const elPlayIcon      = document.getElementById('rf-play-icon');
    const elMute          = document.getElementById('rf-mute');
    const elVolIcon       = document.getElementById('rf-vol-icon');
    const elVolume        = document.getElementById('rf-volume');
    const elProgressFill  = document.getElementById('rf-progress-fill');
    const elProgressBuf   = document.getElementById('rf-progress-buffer');
    const elProgressThumb = document.getElementById('rf-progress-thumb');
    const elProgressWrap  = document.getElementById('rf-progress-wrap');
    const elTimeCurrent   = document.getElementById('rf-time-current');
    const elTimeTotal     = null;
    const elInlineCur     = null;
    const elInlineTotal   = null;
    const elBuffering     = document.getElementById('rf-buffering');
    const elBack          = document.getElementById('rf-back');
    const elFullscreen    = document.getElementById('rf-fullscreen');
    const elFsIcon        = document.getElementById('rf-fs-icon');
    const elAudioWrap     = document.getElementById('rf-audio-wrap');
    const elAudioBtn      = document.getElementById('rf-audio-btn');
    const elAudioMenu     = document.getElementById('rf-audio-menu');
    const elSpeedBtn      = document.getElementById('rf-speed-btn');
    const elSpeedMenu     = document.getElementById('rf-speed-menu');
    const elAutoplay      = document.getElementById('rf-autoplay');
    const elAutoCount     = document.getElementById('rf-autoplay-count');
    const elThumbPreview  = document.getElementById('rf-thumb-preview');
    const elThumbImg      = document.getElementById('rf-thumb-img');
    const elThumbTime     = document.getElementById('rf-thumb-time');
    const elSkipLeft      = null;
    const elSkipRight     = null;
    let _sourceRecovering = false;
    let _sourceHealthTimer = null;

    if (_deveUsarImersaoMobile() && elFullscreen) {
        elFullscreen.classList.add('is-mobile-hidden');
        elFullscreen.setAttribute('aria-hidden', 'true');
        elFullscreen.tabIndex = -1;
    }

    const _getMenuIconMarkup = (iconClass) => {
        if (iconClass === 'rf-icon-subtitles') {
            return '<span class="rf-btn-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="none" role="img"><path fill="currentColor" fill-rule="evenodd" d="M1 3a1 1 0 0 1 1-1h20a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3v3a1 1 0 0 1-1.55.83L11.7 18H2a1 1 0 0 1-1-1zm2 1v12h9.3l.25.17L17 19.13V16h4V4zm7 5H5V7h5zm9 2h-5v2h5zm-7 2H5v-2h7zm7-6h-7v2h7z" clip-rule="evenodd"></path></svg></span>';
        }
        return '<i class="' + iconClass + '"></i>';
    };

    const _setMenuBtn = (btn, iconClass, label, titulo) => {
        if (!btn) return;
        btn.innerHTML = _getMenuIconMarkup(iconClass) + '<span class="rf-btn-menu-text">' + sanitizarHTML(label) + '</span>';
        if (titulo) {
            btn.title = titulo;
            btn.setAttribute('aria-label', titulo + ': ' + label);
        }
    };

    const _hideMenus = () => {
        elAudioMenu?.classList.remove('visible');
        elSpeedMenu?.classList.remove('visible');
    };

    const _clearSourceHealthTimer = () => {
        if (_sourceHealthTimer) {
            clearTimeout(_sourceHealthTimer);
            _sourceHealthTimer = null;
        }
    };

    const _armSourceHealthTimer = () => {
        if (typeof onSourceFailure !== 'function') return;
        _clearSourceHealthTimer();
        _sourceHealthTimer = setTimeout(() => {
            if (!_sessaoPlayerAtiva(playerSessionId)) return;
            if (_sourceRecovering) return;
            if (video.readyState >= 2 || video.ended) return;
            _sourceRecovering = true;
            _limparTimers();
            _clearSourceHealthTimer();
            _removeKey();
            _removeFsListeners();
            if (window._hlsInstancia) { window._hlsInstancia.destroy(); window._hlsInstancia = null; }
            onSourceFailure();
        }, 12000);
    };

    const _renderAudios = () => {
        const hls = window._hlsInstancia;
        if (!hls || !elAudioWrap || !elAudioBtn || !elAudioMenu) return;
        const tracks = hls.audioTracks || [];
        if (!tracks.length) {
            elAudioWrap.style.display = 'none';
            return;
        }
        elAudioWrap.style.display = 'flex';
        const atualIdx = hls.audioTrack >= 0 ? hls.audioTrack : 0;
        const atual = tracks[atualIdx] || tracks[0];
        const atualLabel = (atual?.name || atual?.lang || ('Faixa ' + (atualIdx + 1))).trim();
        _setMenuBtn(elAudioBtn, 'rf-icon-subtitles', atualLabel, 'Áudio');

        elAudioMenu.innerHTML = tracks.map((t, idx) => {
            const label = (t?.name || t?.lang || ('Faixa ' + (idx + 1))).trim();
            const ativo = idx === atualIdx;
            return '<button class="rf-speed-opt ' + (ativo ? 'ativo' : '') + '" data-audio="' + idx + '">' + sanitizarHTML(label) + '</button>';
        }).join('');

        elAudioMenu.querySelectorAll('.rf-speed-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.audio, 10);
                hls.audioTrack = idx;
                _renderAudios();
                elAudioMenu.classList.remove('visible');
            });
        });
    };

    _setMenuBtn(elAudioBtn, 'rf-icon-subtitles', 'Áudio', 'Áudio');
    _setMenuBtn(elSpeedBtn, 'fa-solid fa-gauge-high', '1×', 'Velocidade');
    _atualizarIconeVolume(video, elVolIcon, elVolume);

    function mostrarControles() {
        controls.classList.add('visible');
        player.classList.add('controls-visible');
        player.style.cursor = '';
        _limparTimers();
        if (!video.paused) {
            _playerTimer = setTimeout(() => {
                controls.classList.remove('visible');
                player.classList.remove('controls-visible');
                player.style.cursor = 'none';
            }, 3000);
        }
    }

    // --- Touch (mobile) vs Mouse (desktop) separados por hardware ---
    const _ehDispositivoTouch = navigator.maxTouchPoints > 0;
    if (_ehDispositivoTouch) player.classList.add('rf-touch');

    if (!_ehDispositivoTouch) {
        // Mouse events só no desktop — no mobile disparam eventos sintéticos que bugam o touch
        player.addEventListener('mousemove', mostrarControles);
        player.addEventListener('mouseenter', mostrarControles);
        player.addEventListener('mouseleave', () => {
            if (!video.paused) { _limparTimers(); controls.classList.remove('visible'); player.style.cursor = 'none'; }
        });
    }

    if (_ehDispositivoTouch) {
        // Dispositivo touch: toque único mostra/esconde controles, duplo skip
        let _tapTimer = null;
        let _tapCount = 0;

        player.addEventListener('touchstart', (e) => {
            if (e.target.closest('button, input, .rf-progress-wrap, .rf-speed-menu, .rf-speed-wrap, .rf-volume-wrap, .rf-menu-wrap')) return;

            const touch = e.changedTouches[0];
            const playerRect = player.getBoundingClientRect();
            const relX = touch.clientX - playerRect.left;
            const zone = relX < playerRect.width * 0.35 ? 'left'
                       : relX > playerRect.width * 0.65 ? 'right'
                       : 'center';

            _tapCount++;

            if (_tapCount === 1) {
                _tapTimer = setTimeout(() => {
                    _tapCount = 0;
                    if (controls.classList.contains('visible')) {
                        _limparTimers();
                        controls.classList.remove('visible');
                    } else {
                        mostrarControles();
                    }
                }, 250);
            } else if (_tapCount === 2) {
                clearTimeout(_tapTimer);
                _tapCount = 0;
                if (zone === 'left') {
                    video.currentTime = Math.max(0, video.currentTime - 10);
                    _animarDtap('left', '-10s');
                    mostrarControles();
                } else if (zone === 'right') {
                    video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
                    _animarDtap('right', '+10s');
                    mostrarControles();
                }
            }
        }, { passive: true });

    } else {
        // Desktop: clique na área central faz play/pause
        document.querySelector('#rf-player .rf-nf-middle')?.addEventListener('click', togglePlay);
    }

    function _animarDtap(side, label) {
        const el = document.getElementById(side === 'left' ? 'rf-dtap-left' : 'rf-dtap-right');
        if (!el) return;
        const icon = side === 'left' ? 'rotate-left' : 'rotate-right';
        el.innerHTML = '<span class="rf-dtap-icon"><i class="fa-solid fa-' + icon + '"></i></span>'
                     + '<span class="rf-dtap-label">' + label + '</span>';
        el.classList.remove('rf-dtap-animate');
        void el.offsetWidth;
        el.classList.add('rf-dtap-animate');
    }

    mostrarControles();

    function togglePlay() {
        if (video.paused) video.play().catch(() => {}); else video.pause();
    }
    elPlayPause?.addEventListener('click', togglePlay);
    video.addEventListener('play',  () => {
        elPlayIcon?.classList.replace('fa-play','fa-pause');
        document.getElementById('rf-center-play-icon')?.classList.replace('fa-play','fa-pause');
        mostrarControles();
    });
    video.addEventListener('pause', () => {
        elPlayIcon?.classList.replace('fa-pause','fa-play');
        document.getElementById('rf-center-play-icon')?.classList.replace('fa-pause','fa-play');
        controls.classList.add('visible'); player.style.cursor = ''; _limparTimers();
    });

    video.addEventListener('waiting', () => elBuffering && (elBuffering.style.display = 'flex'));
    video.addEventListener('playing', () => elBuffering && (elBuffering.style.display = 'none'));
    video.addEventListener('canplay', () => elBuffering && (elBuffering.style.display = 'none'));
    video.addEventListener('loadedmetadata', _agendarTentativaPlayback, { once: true });
    video.addEventListener('loadeddata', _agendarTentativaPlayback, { once: true });
    video.addEventListener('canplay', () => {
        if (video.paused && video.currentTime <= 0.25) {
            _tentarIniciarPlayback();
        }
    }, { once: true });
    video.addEventListener('canplaythrough', _agendarTentativaPlayback, { once: true });

    function _renderProgressState(time, duration = video.duration || 0) {
        if (!duration) return;
        const pct = Math.max(0, Math.min(time / duration, 1));
        if (elProgressFill)  elProgressFill.style.width = (pct * 100) + '%';
        if (elProgressThumb) elProgressThumb.style.left = (pct * 100) + '%';
        if (elTimeCurrent) elTimeCurrent.textContent = _formatarTempo(time) + ' / ' + _formatarTempo(duration);
    }

    function _getSeekMetrics(clientX) {
        if (!elProgressWrap) return null;
        const rect = elProgressWrap.getBoundingClientRect();
        const width = rect.width || 0;
        if (!width) return null;
        const x = Math.max(0, Math.min(clientX - rect.left, width));
        const duration = video.duration || 0;
        return {
            rect,
            x,
            width,
            duration,
            time: (x / width) * duration,
        };
    }

    function _renderThumbPreview(metrics) {
        if (!metrics || !elThumbPreview) return;
        if (elThumbTime) elThumbTime.textContent = _formatarTempo(metrics.time);
        const previewW = elThumbPreview.offsetWidth || 64;
        elThumbPreview.style.left = Math.max(0, Math.min(metrics.x - previewW / 2, metrics.width - previewW)) + 'px';
        elThumbPreview.classList.add('visible');
    }

    let previewSeekTime = null;

    video.addEventListener('timeupdate', () => {
        const cur = video.currentTime, dur = video.duration || 0;
        if (!dur) return;
        if (previewSeekTime != null) {
            _renderProgressState(previewSeekTime, dur);
            return;
        }
        _renderProgressState(cur, dur);
        if (Math.floor(cur) % 5 === 0) _salvarProgresso(slug, epIdx, cur, dur, progressMeta);
    });
    video.addEventListener('loadedmetadata', () => {
        const dur = video.duration || 0;
        if (elTimeCurrent) elTimeCurrent.textContent = '0:00 / ' + _formatarTempo(dur);
        _ajustarJanelaPlayer();
    });
    video.addEventListener('progress', () => {
        if (!video.duration || !elProgressBuf) return;
        const buf = video.buffered;
        if (buf.length > 0) elProgressBuf.style.width = ((buf.end(buf.length-1) / video.duration) * 100) + '%';
    });

    let isDragging = false;
    let isTouchDragging = false;
    let touchDragMoved = false;
    let touchDragStartX = 0;
    let touchDragLastX = null;
    const TOUCH_SEEK_THRESHOLD = 8;
    function seekTo(clientX) {
        const metrics = _getSeekMetrics(clientX);
        if (!metrics) return;
        previewSeekTime = null;
        video.currentTime = metrics.time;
        _renderProgressState(metrics.time, metrics.duration);
    }
    function previewSeek(clientX) {
        const metrics = _getSeekMetrics(clientX);
        if (!metrics) return;
        previewSeekTime = metrics.time;
        _renderProgressState(metrics.time, metrics.duration);
        _renderThumbPreview(metrics);
    }
    elProgressWrap?.addEventListener('mousedown', (e) => { isDragging = true; seekTo(e.clientX); });
    document.addEventListener('mousemove', (e) => {
        if (isDragging) seekTo(e.clientX);
        if (elProgressWrap && elThumbPreview) {
            const rect = elProgressWrap.getBoundingClientRect();
            if (e.clientY > rect.top - 80 && e.clientY < rect.bottom + 30 && e.clientX > rect.left && e.clientX < rect.right) {
                const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
                const t = (x / rect.width) * (video.duration || 0);
                if (elThumbTime) elThumbTime.textContent = _formatarTempo(t);
                const previewW = elThumbPreview.offsetWidth || 64;
                elThumbPreview.style.left = Math.max(0, Math.min(x - previewW / 2, rect.width - previewW)) + 'px';
                elThumbPreview.classList.add('visible');
            } else {
                elThumbPreview.classList.remove('visible');
            }
        }
    });
    document.addEventListener('mouseup', (e) => { if (isDragging) { isDragging = false; seekTo(e.clientX); } });
    elProgressWrap?.addEventListener('mouseleave', () => elThumbPreview?.classList.remove('visible'));
    elProgressWrap?.addEventListener('touchstart', (e) => {
        const touch = e.touches?.[0];
        if (!touch) return;
        e.stopPropagation();
        isDragging = true;
        isTouchDragging = true;
        touchDragMoved = false;
        touchDragStartX = touch.clientX;
        touchDragLastX = touch.clientX;
        elProgressWrap?.classList.add('is-scrubbing');
        previewSeek(touch.clientX);
    }, { passive: true });
    elProgressWrap?.addEventListener('touchmove',  (e) => {
        const touch = e.touches?.[0];
        if (!isDragging || !isTouchDragging || !touch) return;
        e.stopPropagation();
        touchDragLastX = touch.clientX;
        if (!touchDragMoved && Math.abs(touch.clientX - touchDragStartX) >= TOUCH_SEEK_THRESHOLD) {
            touchDragMoved = true;
        }
        previewSeek(touch.clientX);
    }, { passive: true });
    elProgressWrap?.addEventListener('touchend',   (e) => {
        e.stopPropagation();
        if (isTouchDragging && touchDragLastX != null) seekTo(touchDragLastX);
        isDragging = false;
        isTouchDragging = false;
        touchDragMoved = false;
        touchDragLastX = null;
        elProgressWrap?.classList.remove('is-scrubbing');
        elThumbPreview?.classList.remove('visible');
    });
    elProgressWrap?.addEventListener('touchcancel', (e) => {
        e.stopPropagation();
        isDragging = false;
        isTouchDragging = false;
        touchDragMoved = false;
        touchDragLastX = null;
        previewSeekTime = null;
        elProgressWrap?.classList.remove('is-scrubbing');
        elThumbPreview?.classList.remove('visible');
        _renderProgressState(video.currentTime, video.duration || 0);
    });

    elMute?.addEventListener('click', () => { video.muted = !video.muted; _atualizarIconeVolume(video, elVolIcon, elVolume); });
    elVolume?.addEventListener('input', () => {
        video.volume = parseFloat(elVolume.value);
        video.muted = video.volume === 0;
        elVolume.style.setProperty('--vol', (video.volume * 100) + '%');
        _atualizarIconeVolume(video, elVolIcon, elVolume);
    });

    elAudioBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const abrir = !elAudioMenu?.classList.contains('visible');
        _hideMenus();
        if (abrir) elAudioMenu?.classList.add('visible');
    });
    elSpeedBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const abrir = !elSpeedMenu?.classList.contains('visible');
        _hideMenus();
        if (abrir) elSpeedMenu?.classList.add('visible');
    });
    elSpeedMenu?.querySelectorAll('.rf-speed-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            const spd = parseFloat(btn.dataset.speed);
            video.playbackRate = spd;
            _setMenuBtn(elSpeedBtn, 'fa-solid fa-gauge-high', spd + '×', 'Velocidade');
            elSpeedMenu.querySelectorAll('.rf-speed-opt').forEach(b => b.classList.remove('ativo'));
            btn.classList.add('ativo');
            elSpeedMenu.classList.remove('visible');
        });
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.rf-menu-wrap') && !e.target.closest('.rf-speed-wrap')) _hideMenus();
    });

    // Center controls wiring (mobile)
    document.getElementById('rf-center-play')?.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); mostrarControles(); });
    document.getElementById('rf-center-skip-left')?.addEventListener('click',  (e) => { e.stopPropagation(); video.currentTime = Math.max(0, video.currentTime - 10); mostrarControles(); });
    document.getElementById('rf-center-skip-right')?.addEventListener('click', (e) => { e.stopPropagation(); video.currentTime = Math.min(video.duration||0, video.currentTime+10); mostrarControles(); });
    // Desktop skip buttons (bottom bar)
    document.getElementById('rf-skip-left-btn')?.addEventListener('click',  () => { video.currentTime = Math.max(0, video.currentTime - 10); mostrarControles(); });
    document.getElementById('rf-skip-right-btn')?.addEventListener('click', () => { video.currentTime = Math.min(video.duration||0, video.currentTime+10); mostrarControles(); });

    function entrarFs() {
        const el = player;
        try {
            if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' });
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
            else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
            else if (el.msRequestFullscreen) el.msRequestFullscreen();
        } catch (e) {}
        if (_deveUsarImersaoMobile()) _bloquearOrientacaoPaisagem().catch(() => {});
    }
    function sairFs() {
        _sairImersaoMobile();
    }
    elFullscreen?.addEventListener('click', () => { _isPlayerFullscreen() ? sairFs() : entrarFs(); });
    const _onFsChange = () => {
        const isFs = _isPlayerFullscreen();
        if (elFsIcon) {
            elFsIcon.classList.toggle('fa-expand',   !isFs);
            elFsIcon.classList.toggle('fa-compress',  isFs);
        }
        _ajustarJanelaPlayer();
        if (isFs) Promise.resolve(_bloquearOrientacaoPaisagem()).catch(() => {});
        else {
            _desbloquearOrientacao();
            _restaurarUiAposSaidaFullscreen(player, controls);
        }
    };
    const _onNativeVideoFsExit = () => {
        if (_playerClosing || !_sessaoPlayerAtiva(playerSessionId)) return;
        _desbloquearOrientacao();
        _restaurarUiAposSaidaFullscreen(player, controls);
        if (_deveUsarHistoricoPlayerMobile()) {
            _solicitarVoltaParaModal();
        }
    };
    document.addEventListener('fullscreenchange',       _onFsChange);
    document.addEventListener('webkitfullscreenchange', _onFsChange);
    document.addEventListener('mozfullscreenchange',    _onFsChange);
    document.addEventListener('MSFullscreenChange',     _onFsChange);
    video.addEventListener('webkitendfullscreen', _onNativeVideoFsExit);
    window.addEventListener('resize', _ajustarJanelaPlayer);
    const _removeFsListeners = () => {
        document.removeEventListener('fullscreenchange',       _onFsChange);
        document.removeEventListener('webkitfullscreenchange', _onFsChange);
        document.removeEventListener('mozfullscreenchange',    _onFsChange);
        document.removeEventListener('MSFullscreenChange',     _onFsChange);
        video.removeEventListener('webkitendfullscreen', _onNativeVideoFsExit);
        video.removeEventListener('loadeddata', _ajustarVideoFit);
        window.removeEventListener('resize', _ajustarJanelaPlayer);
        _disposeMobileImmersion();
    };

    function handleKey(e) {
        if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
        if (!document.getElementById('rf-player')) return;
        switch(e.key) {
            case ' ': case 'k':
                e.preventDefault(); togglePlay(); mostrarControles(); break;
            case 'ArrowLeft':
                e.preventDefault();
                video.currentTime = Math.max(0, video.currentTime - 10);
                mostrarControles(); break;
            case 'ArrowRight':
                e.preventDefault();
                video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
                mostrarControles(); break;
            case 'ArrowUp':
                e.preventDefault();
                video.volume = Math.min(1, video.volume + 0.1);
                if (elVolume) elVolume.value = video.volume;
                _atualizarIconeVolume(video, elVolIcon, elVolume);
                mostrarControles(); break;
            case 'ArrowDown':
                e.preventDefault();
                video.volume = Math.max(0, video.volume - 0.1);
                if (elVolume) elVolume.value = video.volume;
                _atualizarIconeVolume(video, elVolIcon, elVolume);
                mostrarControles(); break;
            case 'm': case 'M':
                video.muted = !video.muted;
                _atualizarIconeVolume(video, elVolIcon, elVolume); break;
            case 'f': case 'F':
                e.preventDefault();
                (document.fullscreenElement || document.webkitFullscreenElement) ? sairFs() : entrarFs(); break;
        }
    }
    document.addEventListener('keydown', handleKey);
    const _removeKey = () => {
        document.removeEventListener('keydown', handleKey);
        _clearSourceHealthTimer();
    };

    _registrarHistoricoPlayer(_voltarParaModalDoPlayer);

    // Troca de episódio in-place: usa _trocarFontePlayerNativo quando dentro do
    // player nativo (mantém DOM/fullscreen), cai no callback externo para outros contextos.
    const _navegarParaEp = async (novoIdx) => {
        _limparTimers();
        if (animeData) {
            // Anime: resolve fonte e troca in-place
            const novoEp = animeData.episodes?.[novoIdx];
            if (!novoEp) return;
            const novoUrl = await SourceResolver.resolverOuPrefetchEpisodio(slug, novoIdx, novoEp, animeData)
                || await getValidSource(novoEp, !!animeData._isDub, animeData.tipo === 'both');
            if (!novoUrl || !_sessaoPlayerAtiva(playerSessionId)) return;
            const novoLabelEp  = novoEp.episode_name || ('Episódio ' + (novoIdx + 1));
            const novoSerieLabel = animeData._nomeExibicao || animeData.anime_title || titulo || '';
            await _trocarFontePlayerNativo({
                novoEpIdx: novoIdx, novoEmbedUrl: novoUrl,
                novoLabelEp, novoSerieLabel, totalEps,
                titulo, tmdbId, slug, animeData,
                progressMeta, onVoltar, onAnterior, onProximo, playerSessionId,
            });
            // Re-wire nav buttons para o novo índice
            _rewireNavButtons(novoIdx);
        } else {
            // Série/filme: delega ao callback externo (que chama abrirPlayer in-place via _trocarVideoInPlace)
            _removeKey(); _removeFsListeners();
            if (novoIdx < epIdx && typeof onAnterior === 'function') onAnterior();
            else if (novoIdx > epIdx && typeof onProximo === 'function') onProximo();
        }
    };

    // Re-wiring dos botões de navegação após troca in-place
    const _rewireNavButtons = (novoIdx) => {
        const elAnt  = document.getElementById('rf-anterior');
        const elProxStep = document.getElementById('rf-proximo-step');
        const elProxEp   = document.getElementById('rf-proximo-ep');
        // Substituir listeners clonando os elementos
        [elAnt, elProxStep, elProxEp].forEach(el => {
            if (!el) return;
            const clone = el.cloneNode(true);
            el.parentNode?.replaceChild(clone, el);
        });
        // Mostrar/ocultar botão próximo
        const elProxNovo = document.getElementById('rf-proximo-ep');
        if (elProxNovo) elProxNovo.style.display = novoIdx < totalEps - 1 ? '' : 'none';
        // Registrar novos listeners
        document.getElementById('rf-anterior')?.addEventListener('click', () => {
            if (novoIdx > 0) _navegarParaEp(novoIdx - 1);
        });
        document.getElementById('rf-proximo-step')?.addEventListener('click', () => {
            if (novoIdx < totalEps - 1) _navegarParaEp(novoIdx + 1);
        });
        document.getElementById('rf-proximo-ep')?.addEventListener('click', () => {
            if (novoIdx < totalEps - 1) _navegarParaEp(novoIdx + 1);
        });
    };

    document.getElementById('rf-anterior')?.addEventListener('click', () => {
        if (epIdx > 0) _navegarParaEp(epIdx - 1);
    });
    document.getElementById('rf-proximo-step')?.addEventListener('click', () => {
        if (epIdx < totalEps - 1) _navegarParaEp(epIdx + 1);
    });
    document.getElementById('rf-proximo-ep')?.addEventListener('click', () => {
        if (epIdx < totalEps - 1) _navegarParaEp(epIdx + 1);
    });

    elBack?.addEventListener('click', () => {
        if (_deveUsarHistoricoPlayerMobile()) {
            _solicitarVoltaParaModal({ directToModal: true });
            return;
        }
        _voltarDoPlayer(_voltarParaModalDoPlayer);
    });

    video.addEventListener('ended', () => {
        _clearSourceHealthTimer();
        _limparProgressoConcluido(slug, epIdx);
        if (epIdx < totalEps - 1) {
            if (elAutoplay) elAutoplay.style.display = 'flex';
            controls.classList.add('visible');
            let count = 5;
            if (elAutoCount) elAutoCount.textContent = count;
            _autoplayTimer = setInterval(() => {
                count--;
                if (elAutoCount) elAutoCount.textContent = count;
                if (count <= 0) { _limparTimers(); _navegarParaEp(epIdx + 1); }
            }, 1000);
        }
    });
    document.getElementById('rf-autoplay-cancel')?.addEventListener('click', () => { _limparTimers(); if(elAutoplay) elAutoplay.style.display='none'; });
    document.getElementById('rf-autoplay-agora')?.addEventListener('click',  () => { _limparTimers(); _navegarParaEp(epIdx + 1); });

    video.addEventListener('error', () => {
        if (!_sessaoPlayerAtiva(playerSessionId)) return;
        _clearSourceHealthTimer();
        if (!_sourceRecovering && typeof onSourceFailure === 'function') {
            _sourceRecovering = true;
            _removeKey();
            _removeFsListeners();
            if (window._hlsInstancia) { window._hlsInstancia.destroy(); window._hlsInstancia = null; }
            onSourceFailure();
            return;
        }
        if (isMp4 && !isProxiedMp4) SourceResolver.marcarMorto(embedUrl);
        const epDiv = document.querySelector('.ep-linha[data-ep-idx="' + epIdx + '"]');
        if (epDiv) _marcarEpIndisponivel(epDiv);
    }, { once: true });

    if (typeof onSourceFailure === 'function') {
        video.addEventListener('loadstart', _armSourceHealthTimer);
        video.addEventListener('waiting', _armSourceHealthTimer);
        video.addEventListener('stalled', _armSourceHealthTimer);
        video.addEventListener('canplay', _clearSourceHealthTimer);
        video.addEventListener('loadeddata', _clearSourceHealthTimer);
        video.addEventListener('playing', _clearSourceHealthTimer);
    }

    _ajustarJanelaPlayer();
}

function _atualizarIconeVolume(video, elVolIcon, elVolume) {
    if (!elVolIcon) return;
    const v = video.muted ? 0 : video.volume;
    elVolIcon.className = v === 0 ? 'fa-solid fa-volume-xmark' : v < 0.5 ? 'fa-solid fa-volume-low' : 'fa-solid fa-volume-high';
    if (elVolume) {
        elVolume.value = video.muted ? 0 : video.volume;
        elVolume.style.setProperty('--vol', (v * 100) + '%');
    }
}

const _thumbCanvas = document.createElement('canvas');
_thumbCanvas.width  = 160;
_thumbCanvas.height = 90;
let _thumbLastTime = -1;
let _thumbDrawing  = false;
function _gerarThumbnailCanvas(video, t, elThumbImg) {
    if (_thumbDrawing || Math.abs(t - _thumbLastTime) < 2) return;
    _thumbDrawing = true;
    const ctx = _thumbCanvas.getContext('2d');
    const vClone = document.createElement('video');
    vClone.src = video.src;
    vClone.crossOrigin = 'anonymous';
    vClone.muted = true;
    vClone.currentTime = t;
    vClone.addEventListener('seeked', () => {
        try { ctx.drawImage(vClone,0,0,160,90); if(elThumbImg) elThumbImg.style.backgroundImage = 'url(' + _thumbCanvas.toDataURL('image/jpeg',0.7) + ')'; } catch(e){}
        _thumbLastTime = t; _thumbDrawing = false; vClone.src = '';
    }, { once: true });
    vClone.addEventListener('error', () => { _thumbDrawing = false; vClone.src = ''; }, { once: true });
}

async function abrirPlayerAnime(epIdx, titulo, tmdbId) {
    const modalDados = document.getElementById('modal-dados');
    if (!modalDados) return;
    const openToken = _novaTentativaPlayerAnime();
    const playerSessionId = _abrirSessaoPlayer();

    const animeData = AppStore.getAnimeAtual();
    if (!animeData?.episodes?.length) {
        _encerrarSessaoPlayer(playerSessionId);
        modalDados.innerHTML = '<div class="player-erro"><i class="fa-solid fa-circle-exclamation"></i><p>Anime inválido.</p><button id="btn-fechar-anime-inv">← Fechar</button></div>';
        document.getElementById('btn-fechar-anime-inv')?.addEventListener('click', fecharModal);
        return;
    }

    AppStore.setTituloAtivo(titulo);
    const ep = animeData.episodes?.[epIdx];
    if (!ep) {
        _encerrarSessaoPlayer(playerSessionId);
        modalDados.innerHTML = '<div class="player-erro"><i class="fa-solid fa-circle-exclamation"></i><p>Episódio não encontrado.</p><button id="btn-fechar-ep-nf">← Fechar</button></div>';
        document.getElementById('btn-fechar-ep-nf')?.addEventListener('click', fecharModal);
        return;
    }

    const isDub  = !!animeData._isDub || animeData.tipo === 'dub';
    const isBoth = animeData.tipo === 'both';

    _desmontarMidiaAtiva();

    const slug = _animeSlugAtual();
    let embedUrl = await SourceResolver.resolverOuPrefetchEpisodio(slug, epIdx, ep, animeData);
    if (!embedUrl) embedUrl = await getValidSource(ep, isDub, isBoth);
    if (!_tentativaPlayerAnimeAtiva(openToken) || !_sessaoPlayerAtiva(playerSessionId) || AppStore.getAnimeAtual() !== animeData) {
        _encerrarSessaoPlayer(playerSessionId);
        return;
    }

    if (embedUrl) {
        _marcarTopoComoDisponivel(animeData);
        const epDiv = document.querySelector('.ep-linha[data-ep-idx="' + epIdx + '"]');
        if (epDiv) _desmarcarEpIndisponivel(epDiv);
    }

    if (!embedUrl) {
        _encerrarSessaoPlayer(playerSessionId);
        const tSafe = escapar(animeData._nomeExibicao || animeData.anime_title || titulo || 'Anime');
        modalDados.innerHTML = '<div class="player-erro"><i class="fa-solid fa-circle-exclamation"></i><p>Vídeo indisponível no momento.</p><button id="btn-voltar-indis">← Voltar</button></div>';
        document.getElementById('btn-voltar-indis')?.addEventListener('click', () => voltarParaDetalhesAnime(tSafe, tmdbId||null));
        return;
    }

    const isMp4    = /\.mp4(\?|$)/i.test(embedUrl);
    const isM3u8   = _isM3u8ouManifest(embedUrl);
    const isNativo = isMp4 || isM3u8;
    const retryLightspeedSource = SourceResolver.isLightspeedUpgradedUrl(embedUrl)
        ? () => {
            if (!_tentativaPlayerAnimeAtiva(openToken) || !_sessaoPlayerAtiva(playerSessionId)) return;
            SourceResolver.marcarMorto(embedUrl);
            abrirPlayerAnime(epIdx, titulo, tmdbId);
        }
        : null;

    const labelEp    = ep.episode_name || ('Episódio ' + (epIdx + 1));
    const totalEps   = animeData.episodes.length;
    const tSafe      = escapar(animeData._nomeExibicao || animeData.anime_title || titulo || 'Anime');
    const idSafe     = tmdbId || null;
    const serieLabel = animeData._nomeExibicao || animeData.anime_title || titulo || '';
    _ativarPlayerUiBase();
    const _playerLayer = _limparConteudoModalParaPlayer(modalDados);

    if (isNativo) {
        const playerEl = _criarPlayerNativo({ labelEp, serieLabel, epIdx, totalEps });
        _playerLayer.appendChild(playerEl);
        _inicializarPlayerNativo({ epIdx, totalEps, tSafe, idSafe, titulo, tmdbId, slug, animeData, embedUrl, onSourceFailure: retryLightspeedSource, playerSessionId, progressMeta: { tipo: 'anime' } });
    } else {
        const wrapper = document.createElement('div');
        wrapper.className = 'nf-player';
        wrapper.id = 'nf-player';
        wrapper.innerHTML =
            '<div class="nf-player-topbar">' +
                '<button class="nf-btn-voltar" id="btn-nf-voltar"><i class="fa-solid fa-arrow-left"></i> Voltar</button>' +
                '<span class="nf-ep-label"><i class="fa-solid fa-play" style="font-size:.65rem;color:var(--red)"></i> ' + sanitizarHTML(serieLabel) + ' &mdash; ' + sanitizarHTML(labelEp) + '</span>' +
            '</div>' +
            '<div class="nf-player-video-wrap">' +
                '<iframe src="' + embedUrl + '" frameborder="0" allowfullscreen allow="autoplay; encrypted-media; fullscreen"></iframe>' +
            '</div>' +
            '<div class="player-controls">' +
                (epIdx > 0 ? '<button class="player-nav-btn secondary" id="btn-nf-anterior"><i class="fa-solid fa-chevron-left"></i> Anterior</button>' : '<span></span>') +
                '<div class="player-ep-info"><i class="fa-solid fa-film" style="color:var(--red);font-size:.75rem"></i> <span>Ep ' + (epIdx+1) + '</span> de ' + totalEps + '</div>' +
                (epIdx < totalEps-1 ? '<button class="player-nav-btn primary" id="btn-nf-proximo">Próximo <i class="fa-solid fa-chevron-right"></i></button>' : '<span></span>') +
            '</div>';
        _playerLayer.appendChild(wrapper);
        // Salvar progresso inicial ao abrir player iframe (sem timeupdate disponível no iframe)
        // Usa duração estimada de 1440s (24min) para marcar ~0% — suficiente para aparecer no Continuar Assistindo
        _salvarProgresso(slug, epIdx, 1, 1440, { tipo: 'anime' });
        let _voltarPlayerIframe = null;
        let _playerIframeClosing = false;
        let _playerIframeBackPending = false;
        const _solicitarVoltaIframeAnime = ({ directToModal = false } = {}) => {
            if (_playerIframeClosing || _playerIframeBackPending || !_sessaoPlayerAtiva(playerSessionId)) return;
            _playerIframeBackPending = true;
            if (directToModal) _marcarRetornoDiretoParaModal();
            if (typeof _voltarPlayerIframe === 'function') {
                setTimeout(() => _voltarDoPlayer(_voltarPlayerIframe), 0);
            }
        };
        const _disposeMobileImmersion = _prepararModoImersivoMobile(wrapper, {
            onExit: () => {
                _solicitarVoltaIframeAnime();
            },
        });
        _voltarPlayerIframe = ({ fromHistory = false } = {}) => {
            if (_playerIframeClosing) return;
            _playerIframeClosing = true;
            _playerIframeBackPending = false;
            _encerrarSessaoPlayer(playerSessionId);
            _desarmarHistoricoPlayer();
            _disposeMobileImmersion();
            _limparPlayerUiBase({ clearModal: fromHistory });
            if (fromHistory) return;
            voltarParaDetalhesAnime(tSafe, idSafe);
        };
        _registrarHistoricoPlayer(_voltarPlayerIframe);
        document.getElementById('btn-nf-voltar')?.addEventListener('click', () => {
            if (_deveUsarHistoricoPlayerMobile()) {
                _solicitarVoltaIframeAnime({ directToModal: true });
                return;
            }
            _voltarDoPlayer(_voltarPlayerIframe);
        });
        document.getElementById('btn-nf-anterior')?.addEventListener('click',  () => { _disposeMobileImmersion(); abrirPlayerAnime(epIdx-1, titulo, tmdbId); });
        document.getElementById('btn-nf-proximo')?.addEventListener('click',   () => { _disposeMobileImmersion(); abrirPlayerAnime(epIdx+1, titulo, tmdbId); });
    }

    const preloadEps = Math.min(epIdx + 3, totalEps);
    for (let nextIdx = epIdx + 1; nextIdx < preloadEps; nextIdx++) {
        const nextEp = animeData.episodes[nextIdx];
        if (!nextEp) continue;
        _prefetchEpisodio(nextEp, nextIdx, animeData).catch(() => {});
        const nextUrl = SourceResolver.resolverUrlPreview(nextEp, animeData);
        SourceResolver.browserPrefetch(nextUrl);
    }
}

function voltarParaDetalhesAnime(titulo, tmdbId) {
    _desarmarHistoricoPlayer();
    _limparPlayerUiBase();
    // Se o conteúdo original foi preservado, _limparPlayerUiBase já restaurou — nada mais a fazer
    const dados = document.getElementById('modal-dados');
    if (dados && dados.querySelector('[data-rf-hidden-by-player]') === null && dados.children.length > 0) {
        // Conteúdo restaurado com sucesso, só garantir scroll no topo
        document.getElementById('modal-container')?.scrollTo?.(0, 0);
        return;
    }
    // Fallback: reconstruir se o conteúdo não estava preservado
    const anime = AppStore.getAnimeAtual();
    const itemOriginal = AppStore.get('itemAnimeAtual');
    if (itemOriginal) {
        abrirModalAnimeLocal(itemOriginal);
        return;
    }
    const nomeParaUsar = anime?._nomeExibicao || titulo;
    const itemLocal    = _getAnimeLocal ? _getAnimeLocal(nomeParaUsar) : null;
    if (itemLocal) {
        abrirModalAnimeLocal(itemLocal);
    }
    else fecharModal();
}

function voltarParaDetalhesFilme(titulo, { itemOriginal = null, usarStoreFallback = true } = {}) {
    _desarmarHistoricoPlayer();
    _limparPlayerUiBase();
    // Se o conteúdo original foi preservado, _limparPlayerUiBase já restaurou
    const dados = document.getElementById('modal-dados');
    if (dados && dados.querySelector('[data-rf-hidden-by-player]') === null && dados.children.length > 0) {
        document.getElementById('modal-container')?.scrollTo?.(0, 0);
        return;
    }
    // Fallback: reconstruir se necessário
    const itemParaUsar = itemOriginal || (usarStoreFallback ? (AppStore.get('itemFilmeAtual') || null) : null);
    if (itemParaUsar) {
        AppStore.set('itemFilmeAtual', itemParaUsar);
        abrirModalFilmeLocal(itemParaUsar);
        return;
    }
    const itemLocal = _getFilmeLocal ? _getFilmeLocal(titulo) : null;
    if (itemLocal) {
        AppStore.set('itemFilmeAtual', itemLocal);
        abrirModalFilmeLocal(itemLocal);
    } else fecharModal();
}

function _isM3u8ouManifest(url) {
    return /\.m3u8/i.test(url) || /\/master\.txt/i.test(url);
}

}

async function _resolverVideoSrc(videoSrc) {
    const src = _preferirHttpsSePossivel(videoSrc);
    return src;
}

async function abrirPlayer(videoSrc, { titulo = '', progSlug = null, progEpIdx = 0, progressMeta = {}, onVoltar = null, onAnterior = null, onProximo = null, labelAnterior = 'Anterior', labelProximo = 'Próximo', epIdx = null, totalEps = null } = {}) {
    const modalDados = document.getElementById('modal-dados');
    if (!modalDados) return;
    const playerSessionId = _abrirSessaoPlayer();
    if (!videoSrc) {
        _encerrarSessaoPlayer(playerSessionId);
        _mostrarErroPlayer(modalDados, 'Episódio sem fonte de vídeo.', onVoltar);
        return;
    }
    videoSrc = await _resolverVideoSrc(videoSrc);
    if (!_sessaoPlayerAtiva(playerSessionId)) return;

    const voltarFn = ({ fromHistory = false } = {}) => {
        _encerrarSessaoPlayer(playerSessionId);
        _desarmarHistoricoPlayer();
        _limparPlayerUiBase({ clearModal: fromHistory });
        if (fromHistory) return;
        // Se o conteúdo do modal foi restaurado, não reconstruir
        const _d = document.getElementById('modal-dados');
        if (_d && !_d.querySelector('[data-rf-hidden-by-player]') && _d.children.length > 0 && !_d.querySelector('.rf-player-layer')) {
            document.getElementById('modal-container')?.scrollTo?.(0, 0);
            return;
        }
        if (typeof onVoltar === 'function') {
            onVoltar();
        } else fecharModal();
    };

    const isM3u8 = _isM3u8ouManifest(videoSrc);
    const embedUrl = videoSrc;

    // Use caller-supplied epIdx/totalEps when available (e.g. series player)
    // so the Próximo/Anterior buttons render correctly.
    const _epIdxReal    = (epIdx !== null && epIdx !== undefined) ? epIdx : 0;
    const _totalEpsReal = (totalEps !== null && totalEps !== undefined && totalEps > 0) ? totalEps : 1;

    // Se o player nativo já está montado, fazer troca in-place (mantém fullscreen)
    const playerExistente = document.getElementById('rf-player');
    if (playerExistente && document.getElementById('rf-video')) {
        const novoSlug = progSlug || titulo.toLowerCase().replace(/\W/g, '');
        await _trocarFontePlayerNativo({
            novoEpIdx: _epIdxReal, novoEmbedUrl: embedUrl,
            novoLabelEp: titulo, novoSerieLabel: titulo,
            totalEps: _totalEpsReal,
            titulo, tmdbId: null,
            slug: novoSlug, animeData: null,
            progressMeta, onVoltar: voltarFn, onAnterior, onProximo, playerSessionId,
        });
        return;
    }

    _limparTimers();
    if (window._hlsInstancia) { window._hlsInstancia.destroy(); window._hlsInstancia = null; }
    _ativarPlayerUiBase();
    const _playerLayer = _limparConteudoModalParaPlayer(modalDados);

    const playerEl = _criarPlayerNativo({ labelEp: titulo, serieLabel: titulo, epIdx: _epIdxReal, totalEps: _totalEpsReal });
    _playerLayer.appendChild(playerEl);

    _inicializarPlayerNativo({
        epIdx: _epIdxReal, totalEps: _totalEpsReal,
        tSafe: sanitizarHTML(titulo),
        idSafe: null,
        titulo,
        tmdbId: null,
        slug: progSlug || titulo.toLowerCase().replace(/\W/g, ''),
        animeData: null,
        embedUrl,
        progressMeta,
        onVoltar: voltarFn,
        onAnterior,
        onProximo,
        labelAnterior,
        labelProximo,
        playerSessionId,
    });
}

function _mostrarErroPlayer(modalDados, msg, onVoltar) {
    modalDados.innerHTML =
        '<div class="player-erro"><i class="fa-solid fa-circle-exclamation"></i><p>' + sanitizarHTML(msg) + '</p><button id="btn-erro-voltar">← Voltar</button></div>';
    document.getElementById('btn-erro-voltar')?.addEventListener('click', () => {
        _desarmarHistoricoPlayer();
        _limparPlayerUiBase();
        if (typeof onVoltar === 'function') {
            onVoltar();
        } else fecharModal();
    });
}

function abrirPlayerRave(videoSrc, titulo, tmdbId, tipo, fallbackSrcs, opts = {}) {
    videoSrc = _preferirHttpsSePossivel(SourceResolver.normalizarUrl(videoSrc));
    const _fallbacks = Array.isArray(fallbackSrcs) ? [...fallbackSrcs] : [];
    const modalDados = document.getElementById('modal-dados');
    const playerSessionId = _abrirSessaoPlayer();
    const temItemOriginalExplicito = !!opts && Object.prototype.hasOwnProperty.call(opts, 'itemOriginal');
    const itemOriginal = temItemOriginalExplicito
        ? (opts.itemOriginal || null)
        : (AppStore.get('itemFilmeAtual') || null);
    if (itemOriginal) AppStore.set('itemFilmeAtual', itemOriginal);

    function _tentarProximaFonte(motivo) {
        SourceResolver.marcarMorto(videoSrc);
        if (_fallbacks.length) {
            const proxSrc = _fallbacks.shift();
            abrirPlayerRave(proxSrc, titulo, tmdbId, tipo, _fallbacks, { itemOriginal });
        } else {
            _desarmarHistoricoPlayer();
            _limparPlayerUiBase();
            voltarParaDetalhesFilme(titulo, {
                itemOriginal,
                usarStoreFallback: !temItemOriginalExplicito,
            });
            showToast('Nenhuma fonte disponível para este filme.', 'error');
        }
    }

    let _raveClosing = false;
    const voltarRaveFn = ({ fromHistory = false } = {}) => {
        if (_raveClosing) return;
        _raveClosing = true;
        _encerrarSessaoPlayer(playerSessionId);
        _desarmarHistoricoPlayer();
        _limparPlayerUiBase({ clearModal: fromHistory });
        if (fromHistory) return;
        voltarParaDetalhesFilme(titulo, {
            itemOriginal,
            usarStoreFallback: !temItemOriginalExplicito,
        });
    };

    const isMp4  = /\.mp4(\?|$)/i.test(videoSrc);
    const isM3u8 = _isM3u8ouManifest(videoSrc);

    if (isMp4 || isM3u8) {
        _limparTimers();
        if (window._hlsInstancia) { window._hlsInstancia.destroy(); window._hlsInstancia = null; }
        _ativarPlayerUiBase();
        const _playerLayer = _limparConteudoModalParaPlayer(modalDados);

        const playerEl = _criarPlayerNativo({ labelEp: titulo, serieLabel: titulo, epIdx: 0, totalEps: 1 });
        _playerLayer.appendChild(playerEl);

        _inicializarPlayerNativo({
            epIdx: 0, totalEps: 1,
            tSafe: sanitizarHTML(titulo),
            idSafe: tmdbId || null,
            titulo,
            tmdbId: tmdbId || null,
            slug: titulo.toLowerCase().replace(/\W/g, ''),
            animeData: null,
            embedUrl: videoSrc,
            progressMeta: { tipo: 'filme', videoSrc, filmeNome: titulo, tmdbId: tmdbId ? Number(tmdbId) : null },
            onVoltar: voltarRaveFn,
            playerSessionId,
        });

        const video = document.getElementById('rf-video');
        if (video) {
            let _fallbackTriggered = false;
            const _doFallback = (motivo) => {
                if (_fallbackTriggered) return;
                _fallbackTriggered = true;
                _tentarProximaFonte(motivo);
            };

            video.addEventListener('error', () => _doFallback('erro de mídia'), { once: true });

            let _stallTimer = null;
            const _iniciarStallCheck = () => {
                if (_stallTimer) clearTimeout(_stallTimer);
                _stallTimer = setTimeout(() => {
                    if (video.readyState < 2 && !video.paused) {
                        _doFallback('timeout/stall');
                    }
                }, 15000);
            };
            video.addEventListener('waiting', _iniciarStallCheck);
            video.addEventListener('playing', () => { if (_stallTimer) { clearTimeout(_stallTimer); _stallTimer = null; } });
            video.addEventListener('canplay', () => { if (_stallTimer) { clearTimeout(_stallTimer); _stallTimer = null; } });

            if (window._hlsInstancia) {
                const hls = window._hlsInstancia;
                const _origErrorHandler = hls.listeners('hlsError');
                hls.on(Hls.Events.ERROR, (e, d) => {
                    if (d.fatal && _fallbacks.length) {
                        _doFallback('HLS fatal: ' + d.type);
                    }
                });
            }
        }
        return;
    }

    _ativarPlayerUiBase();
    const _playerLayer = _limparConteudoModalParaPlayer(modalDados);

    const wrapper = document.createElement('div');
    wrapper.innerHTML =
        '<div class="nf-player">' +
            '<div class="nf-player-topbar">' +
                '<button class="nf-btn-voltar" id="btn-voltar-rave"><i class="fa-solid fa-arrow-left"></i> Voltar</button>' +
                '<span class="nf-ep-label"><i class="fa-solid fa-play" style="font-size:.65rem;color:var(--red)"></i> ' + sanitizarHTML(titulo||'') + '</span>' +
            '</div>' +
            '<div class="nf-player-video-wrap"><iframe id="rave-iframe" allowfullscreen allow="autoplay; fullscreen"></iframe></div>' +
        '</div>';

    _playerLayer.appendChild(wrapper);
    let _voltarRaveIframe = null;
    let _raveBackPending = false;
    const _solicitarVoltaRaveIframe = ({ directToModal = false } = {}) => {
        if (_raveClosing || _raveBackPending || !_sessaoPlayerAtiva(playerSessionId)) return;
        _raveBackPending = true;
        if (directToModal) _marcarRetornoDiretoParaModal();
        if (typeof _voltarRaveIframe === 'function') {
            setTimeout(() => _voltarDoPlayer(_voltarRaveIframe), 0);
        }
    };
    const _disposeMobileImmersion = _prepararModoImersivoMobile(wrapper, {
        onExit: () => {
            _solicitarVoltaRaveIframe();
        },
    });
    _voltarRaveIframe = ({ fromHistory = false } = {}) => {
        if (_raveClosing) return;
        _raveClosing = true;
        _raveBackPending = false;
        _encerrarSessaoPlayer(playerSessionId);
        _desarmarHistoricoPlayer();
        _disposeMobileImmersion();
        _limparPlayerUiBase({ clearModal: fromHistory });
        if (fromHistory) return;
        voltarRaveFn();
    };
    _registrarHistoricoPlayer(_voltarRaveIframe);
    document.getElementById('rave-iframe').src = videoSrc;
    document.getElementById('btn-voltar-rave')?.addEventListener('click', () => {
        if (_deveUsarHistoricoPlayerMobile()) {
            _solicitarVoltaRaveIframe({ directToModal: true });
            return;
        }
        _voltarDoPlayer(_voltarRaveIframe);
    });
}