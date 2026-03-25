/* ── Player de Canais (TV ao vivo) ─────────────────────────────── */

function _abrirPlayerCanal(canal) {
    const modal = document.getElementById('modal-container');
    const dados = document.getElementById('modal-dados');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    dados.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;width:100%;">
            <div class="loading">
                <div class="loading-spinner"></div>
                <span class="loading-text">Conectando a ${sanitizarHTML(canal.nome)}...</span>
            </div>
        </div>`;

    const workerUrl = typeof WORKER_URL !== 'undefined' ? WORKER_URL : '';
    const resolveUrl = `${workerUrl}/api/canal/resolve?slug=${encodeURIComponent(canal.slug)}`;

    fetch(resolveUrl, { signal: AbortSignal.timeout(10000) })
        .then(r => r.json())
        .then(result => {
            if (!result.ok || !result.url) {
                throw new Error(result.error || 'stream não encontrado');
            }
            _iniciarPlayerCanal(result.url, canal.nome);
        })
        .catch(err => {
            console.error('[Canais] Falha ao resolver:', err);
            dados.innerHTML = `
                <div class="sem-resultados" style="padding-top:30vh;">
                    <div class="sem-resultados-icon"><i class="fa-solid fa-satellite-dish"></i></div>
                    <div class="sem-resultados-titulo">Canal indisponível</div>
                    <div class="sem-resultados-desc">Não foi possível conectar a ${sanitizarHTML(canal.nome)}.</div>
                    <button class="btn-tentar-novamente" onclick="fecharModal()">Voltar</button>
                </div>`;
        });
}

function _iniciarPlayerCanal(m3u8Url, nomeCanal) {
    const dados = document.getElementById('modal-dados');
    document.body.classList.add('rf-player-open');
    document.querySelector('.modal-conteudo')?.classList.add('player-mode');
    document.getElementById('modal-container')?.classList.add('modal-player-mode');
    document.getElementById('modal-close-btn')?.style.setProperty('display', 'none', 'important');

    dados.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'rf-player rf-player-live';
    wrapper.id = 'rf-player-live';
    wrapper.innerHTML = `
        <video id="rf-live-video" class="rf-video" playsinline webkit-playsinline preload="auto" autoplay></video>
        <div class="rf-buffering" id="rf-live-buffering"><div class="rf-spinner"></div></div>
        <div class="rf-live-overlay" id="rf-live-overlay"></div>
        <div class="rf-live-controls" id="rf-live-controls">
            <div class="rf-live-top">
                <button class="rf-back" id="rf-live-back"><i class="fa-solid fa-arrow-left"></i></button>
                <span class="rf-live-badge"><i class="fa-solid fa-circle"></i> AO VIVO</span>
            </div>
            <div class="rf-live-bottom">
                <div class="rf-live-progress-row">
                    <div class="rf-live-progress-bar">
                        <div class="rf-live-progress-fill"></div>
                    </div>
                    <span class="rf-live-duration-label"><i class="fa-solid fa-circle"></i> Ao vivo</span>
                </div>
                <div class="rf-live-bar-main">
                    <div class="rf-live-bar-left">
                        <div class="rf-volume-wrap">
                            <button class="rf-btn-ctrl" id="rf-live-mute">
                                <i class="fa-solid fa-volume-high" id="rf-live-vol-icon"></i>
                            </button>
                            <div class="rf-volume-slider-wrap">
                                <input type="range" class="rf-volume-slider" id="rf-live-volume" min="0" max="1" step="0.05" value="1">
                            </div>
                        </div>
                    </div>
                    <div class="rf-live-title">${sanitizarHTML(nomeCanal)}</div>
                    <div class="rf-live-bar-right">
                        <button class="rf-btn-ctrl" id="rf-live-fullscreen">
                            <i class="fa-solid fa-expand" id="rf-live-fs-icon"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    dados.appendChild(wrapper);

    const video      = document.getElementById('rf-live-video');
    const buffering  = document.getElementById('rf-live-buffering');
    const controls   = document.getElementById('rf-live-controls');
    const overlay    = document.getElementById('rf-live-overlay');
    const muteBtn    = document.getElementById('rf-live-mute');
    const volIcon    = document.getElementById('rf-live-vol-icon');
    const volSlider  = document.getElementById('rf-live-volume');
    const fsBtn      = document.getElementById('rf-live-fullscreen');
    const fsIcon     = document.getElementById('rf-live-fs-icon');
    const backBtn    = document.getElementById('rf-live-back');

    const _isTouch = navigator.maxTouchPoints > 0;

    // ── Cleanup / fechar ─────────────────────────────────────────
    let _canalClosing = false;
    let _canalBackPending = false;

    const _cleanup = () => {
        _desarmarHistoricoPlayer();
        _disposeMobileImmersion();
        if (wrapper._hls) { wrapper._hls.destroy(); wrapper._hls = null; }
        try { video.pause(); } catch {}
        video.src = '';
        document.removeEventListener('fullscreenchange', _onFsChange);
        document.removeEventListener('webkitfullscreenchange', _onFsChange);
        document.removeEventListener('keydown', _onKey);
        _sairImersaoMobile();
        document.body.classList.remove('rf-player-open');
        document.querySelector('.modal-conteudo')?.classList.remove('player-mode');
        document.getElementById('modal-container')?.classList.remove('modal-player-mode');
        const modalCloseBtn = document.getElementById('modal-close-btn');
        if (modalCloseBtn) modalCloseBtn.style.removeProperty('display');
    };

    const _fecharPlayerCanal = () => {
        if (_canalClosing) return;
        _canalClosing = true;
        _cleanup();
        fecharModal();
    };

    const _solicitarVoltaCanal = ({ directToModal = false } = {}) => {
        if (_canalClosing || _canalBackPending) return;
        _canalBackPending = true;
        if (directToModal) _marcarRetornoDiretoParaModal?.();
        setTimeout(() => _voltarDoPlayer(_voltarPlayerCanal), 0);
    };

    const _voltarPlayerCanal = ({ fromHistory = false } = {}) => {
        if (_canalClosing) return;
        _canalClosing = true;
        _canalBackPending = false;
        _cleanup();
        if (!fromHistory) fecharModal();
    };

    // ── Imersão mobile ───────────────────────────────────────────
    if (_deveUsarImersaoMobile() && fsBtn) {
        fsBtn.classList.add('is-mobile-hidden');
        fsBtn.setAttribute('aria-hidden', 'true');
        fsBtn.tabIndex = -1;
    }

    const _disposeMobileImmersion = _prepararModoImersivoMobile(wrapper, {
        controlsEl: controls,
        onExit: () => _solicitarVoltaCanal(),
    });

    _registrarHistoricoPlayer(_voltarPlayerCanal);

    // ── HLS setup ────────────────────────────────────────────────
    const isM3u8 = /\.m3u8|\.txt/i.test(m3u8Url);
    if (isM3u8 && typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({
            maxBufferLength: 30,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 6,
            enableWorker: true,
        });
        hls.loadSource(m3u8Url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
        hls.on(Hls.Events.ERROR, (e, d) => {
            if (d.fatal) {
                if (d.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
                else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            }
        });
        wrapper._hls = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = m3u8Url;
        video.play().catch(() => {});
    } else {
        video.src = m3u8Url;
        video.play().catch(() => {});
    }

    // ── Buffering ────────────────────────────────────────────────
    video.addEventListener('waiting', () => buffering.style.display = '');
    video.addEventListener('playing', () => buffering.style.display = 'none');
    video.addEventListener('canplay', () => buffering.style.display = 'none');

    // ── Volume ───────────────────────────────────────────────────
    muteBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        _atualizarVol();
    });
    volSlider.addEventListener('input', () => {
        video.volume = parseFloat(volSlider.value);
        video.muted = video.volume === 0;
        _atualizarVol();
    });
    function _atualizarVol() {
        const v = video.muted ? 0 : video.volume;
        volIcon.className = v === 0 ? 'fa-solid fa-volume-xmark' : v < 0.5 ? 'fa-solid fa-volume-low' : 'fa-solid fa-volume-high';
        volSlider.value = video.muted ? 0 : video.volume;
        volSlider.style.setProperty('--vol', (v * 100) + '%');
    }

    // ── Fullscreen ───────────────────────────────────────────────
    fsBtn.addEventListener('click', () => {
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        if (fsEl) {
            _sairImersaoMobile();
        } else {
            try {
                if (wrapper.requestFullscreen) wrapper.requestFullscreen({ navigationUI: 'hide' });
                else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
                else if (wrapper.msRequestFullscreen) wrapper.msRequestFullscreen();
            } catch (e) {}
            if (_deveUsarImersaoMobile()) _bloquearOrientacaoPaisagem().catch(() => {});
        }
    });

    const _onFsChange = () => {
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        fsIcon.className = isFs ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
        if (isFs) _bloquearOrientacaoPaisagem().catch(() => {});
        else _desbloquearOrientacao();
    };
    document.addEventListener('fullscreenchange', _onFsChange);
    document.addEventListener('webkitfullscreenchange', _onFsChange);

    // ── Controles: show / hide / toggle ──────────────────────────
    let _hideTimer = null;

    function _mostrarControles() {
        controls.classList.remove('rf-live-controls-hidden');
        wrapper.style.cursor = '';
        clearTimeout(_hideTimer);
        _hideTimer = setTimeout(_esconderControles, 3000);
    }

    function _esconderControles() {
        clearTimeout(_hideTimer);
        controls.classList.add('rf-live-controls-hidden');
        wrapper.style.cursor = 'none';
    }

    // ── Mouse (desktop only) ─────────────────────────────────────
    if (!_isTouch) {
        wrapper.addEventListener('mousemove', _mostrarControles);
        wrapper.addEventListener('mouseenter', _mostrarControles);
        wrapper.addEventListener('mouseleave', () => _esconderControles());
    }

    // ── Touch (mobile) ───────────────────────────────────────────
    if (_isTouch) {
        wrapper.classList.add('rf-touch');

        // O overlay fica por cima do vídeo mas abaixo dos controles.
        // Toque nele = toggle controles (sem conflito com botões).
        overlay.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (controls.classList.contains('rf-live-controls-hidden')) {
                _mostrarControles();
            } else {
                _esconderControles();
            }
        }, { passive: false });
    }

    _mostrarControles();

    // ── Back button ──────────────────────────────────────────────
    backBtn.addEventListener('click', () => {
        if (typeof _deveUsarHistoricoPlayerMobile === 'function' && _deveUsarHistoricoPlayerMobile()) {
            _solicitarVoltaCanal({ directToModal: true });
            return;
        }
        _voltarDoPlayer(_voltarPlayerCanal);
    });

    // ── Keyboard ─────────────────────────────────────────────────
    const _onKey = (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
        if (!document.getElementById('rf-player-live')) return;
        switch (e.key) {
            case 'm': case 'M':
                video.muted = !video.muted;
                _atualizarVol();
                _mostrarControles();
                break;
            case 'f': case 'F':
                e.preventDefault();
                fsBtn.click();
                break;
            case 'Escape':
                if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                    _fecharPlayerCanal();
                }
                break;
        }
    };
    document.addEventListener('keydown', _onKey);
}
