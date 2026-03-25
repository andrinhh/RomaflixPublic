// Player Loader — carrega player.js e source-resolver.js sob demanda,
// na primeira vez que o usuário abre um conteúdo.
// Expõe os mesmos nomes de função que o restante do código espera.

const _PlayerLoader = (() => {
    let _carregado = false;
    let _carregando = null;

    const _SCRIPTS = [
        'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js',
        '/js/source-resolver.js',
        '/js/player-flow.js',
        '/js/modal.js',
        '/js/series-modal.js',
        '/js/player.js',
    ];

    function _carregarScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload  = resolve;
            s.onerror = () => reject(new Error('Falha ao carregar: ' + src));
            document.head.appendChild(s);
        });
    }

    async function carregar() {
        if (_carregado) return;
        if (_carregando) return _carregando;

        _carregando = (async () => {
            for (const src of _SCRIPTS) {
                await _carregarScript(src);
            }
            _carregado = true;
            _carregando = null;
        })();

        return _carregando;
    }

    // Wrapper genérico — carrega e delega para a função real
    function _wrap(nomeFn, args) {
        return carregar().then(() => {
            const fn = window[nomeFn];
            if (typeof fn !== 'function') {
                console.error('[PlayerLoader] Função não encontrada após carga:', nomeFn);
                return;
            }
            return fn(...args);
        }).catch(err => {
            console.error('[PlayerLoader] Erro ao carregar player:', err);
        });
    }

    return { carregar, _wrap };
})();

// ── Wrappers públicos ─────────────────────────────────────────────────────────

function abrirPlayerAnime(...args) {
    return _PlayerLoader._wrap('abrirPlayerAnime', args);
}

function abrirPlayerRave(...args) {
    return _PlayerLoader._wrap('abrirPlayerRave', args);
}

function abrirPlayer(...args) {
    return _PlayerLoader._wrap('abrirPlayer', args);
}

async function _resolverVideoSrc(...args) {
    await _PlayerLoader.carregar();
    return window._resolverVideoSrc?.(...args);
}

// ── Pré-carregamento inteligente ──────────────────────────────────────────────
// Inicia o download do player em background quando o usuário demonstra intenção
// (hover ou touch em card) — para que quando clicar já esteja pronto.

(function _iniciarPreload() {
    let _preloadDisparado = false;

    function _dispararPreload() {
        if (_preloadDisparado) return;
        _preloadDisparado = true;
        _PlayerLoader.carregar().catch(() => {});
        document.removeEventListener('mouseover',  _onIntent, { passive: true });
        document.removeEventListener('touchstart', _onIntent, { passive: true });
    }

    function _onIntent(e) {
        if (e.target?.closest?.('.card, .ep-linha, .btn-play-netflix, .continuar-card')) {
            _dispararPreload();
        }
    }

    document.addEventListener('mouseover',  _onIntent, { passive: true });
    document.addEventListener('touchstart', _onIntent, { passive: true });
})();
