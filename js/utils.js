function sanitizarHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

function slugify(str) {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\b(dublado|legendado|dub|leg)\b/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function slugifyPath(str) {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\b(dublado|legendado|dub|leg)\b/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

function rootPath(assetPath) {
    const raw = String(assetPath || '').trim();
    if (!raw) return '/';
    if (/^(?:[a-z]+:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw;
    return '/' + raw.replace(/^\/+/, '');
}

function encodeAssetSegment(segment) {
    return encodeURIComponent(String(segment || ''))
        .replace(/[!'()*]/g, (char) => '%' + char.charCodeAt(0).toString(16).toUpperCase());
}

function encodeAssetPath(assetPath) {
    const raw = String(assetPath || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!raw) return '';
    return raw.split('/').map(encodeAssetSegment).join('/');
}

function buildPosterAssetUrl(assetPath) {
    if (/^https?:\/\//i.test(assetPath)) return assetPath;
    const encodedPath = encodeAssetPath(assetPath);
    if (!encodedPath) return '';
    if (POSTER_BASE) return `${POSTER_BASE}/${encodedPath}`;
    return rootPath(encodedPath);
}

function escapar(str) {
    return (str || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/</g, '\\x3C')
        .replace(/>/g, '\\x3E')
        .replace(/\r?\n/g, ' ');
}

function mostrarLoading(msg) {
    const main = document.getElementById('main-content');
    if (!main) return;
    main.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            ${msg ? `<span class="loading-text">${sanitizarHTML(msg)}</span>` : ''}
        </div>`;
}

function criarSkeletonRow(titulo, count = 8) {
    const secao = document.createElement('section');
    secao.className = 'sessao-info';
    let cards = '';
    for (let i = 0; i < count; i++) {
        cards += '<div class="card-skeleton skeleton"></div>';
    }
    secao.innerHTML = `
        <h2 class="sessao-titulo">${sanitizarHTML(titulo)}</h2>
        <div class="row-wrapper">
            <div class="grid" style="pointer-events:none">${cards}</div>
        </div>`;
    return secao;
}

function setPageTitle(secao) {
    document.title = secao
        ? `${secao} — ROMAFLIX`
        : 'ROMAFLIX | BIBLIOTECA';
}

function showToast(msg, tipo = 'info', duracao = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { error: 'fa-circle-exclamation', success: 'fa-check-circle', info: 'fa-circle-info' };
    const icon  = icons[tipo] || icons.info;
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.style.setProperty('--toast-dur', duracao + 'ms');
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${sanitizarHTML(msg)}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duracao + 350);
}

const _loadedScripts = new Set(
    Array.from(document.scripts).map(s => {
        try { return new URL(s.src).pathname.replace(/^\//, ''); } catch { return ''; }
    }).filter(Boolean)
);
function _loadScript(src) {
    const normalizedSrc = rootPath(src).replace(/^\//, '');
    if (_loadedScripts.has(normalizedSrc)) return Promise.resolve();
    const existing = Array.from(document.scripts).find(s => {
        try {
            return new URL(s.src).pathname.replace(/^\//, '') === normalizedSrc;
        } catch {
            return false;
        }
    });
    if (existing) {
        _loadedScripts.add(normalizedSrc);
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = rootPath(src);
        el.onload  = () => { _loadedScripts.add(normalizedSrc); resolve(); };
        el.onerror = () => reject(new Error('Falha ao carregar ' + normalizedSrc));
        document.head.appendChild(el);
    });
}

let _heavyModulesPromise = null;
function _ensureHeavyModules() {
    if (_heavyModulesPromise) return _heavyModulesPromise;
    _heavyModulesPromise = (async () => {
        await _loadScript('https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js');
        await _loadScript('js/source-resolver.js');
        await _loadScript('js/player-flow.js');
        await _loadScript('js/modal.js');
        await _loadScript('js/series-modal.js');
        await _loadScript('js/player.js');
    })();
    return _heavyModulesPromise;
}

function _withHeavy(fn) {
    return function () {
        const self = this, args = arguments;
        _ensureHeavyModules()
            .then(() => fn.apply(self, args))
            .catch(err => {
                console.error('[RomaFlix] Falha ao carregar módulos:', err);
                showToast('Erro ao carregar. Tente novamente.', 'error');
            });
    };
}

function debounce(fn, delay) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), delay);
    };
}

const _imgObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const img = entry.target;
            if (img.dataset.src) {
                img.src = img.dataset.src;
                delete img.dataset.src;
            }
            obs.unobserve(img);
        });
    }, { rootMargin: '200px' })
    : null;

function lazyImg(src, alt, className) {
    const img = document.createElement('img');
    img.alt = alt || '';
    img.loading = 'lazy';
    if (className) img.className = className;
    if (_imgObserver) {
        img.dataset.src = src;
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';
        _imgObserver.observe(img);
    } else {
        img.src = src;
    }
    return img;
}

// ── Stubs globais (antes carregados via player-loader.js) ────────────────────
// Definem as funções que o restante do código espera encontrar.
// Ao serem chamadas, carregam os módulos pesados e delegam para a função real.

function _wrapHeavy(nomeFn, args) {
    return _ensureHeavyModules().then(() => {
        const fn = window[nomeFn];
        if (typeof fn !== 'function') {
            console.error('[RomaFlix] Função não encontrada após carga:', nomeFn);
            return;
        }
        return fn(...args);
    }).catch(err => {
        console.error('[RomaFlix] Erro ao carregar player:', err);
    });
}

function abrirPlayerAnime(...args) { return _wrapHeavy('abrirPlayerAnime', args); }
function abrirPlayerRave(...args)  { return _wrapHeavy('abrirPlayerRave', args); }
function abrirPlayer(...args){ return _wrapHeavy('abrirPlayer', args); }

async function _resolverVideoSrc(...args) {
    await _ensureHeavyModules();
    return window._resolverVideoSrc?.(...args);
}

// ── Pré-carregamento por intenção (hover/touch em cards) ─────────────────────
(function _iniciarPreload() {
    let _preloadDisparado = false;
    function _dispararPreload() {
        if (_preloadDisparado) return;
        _preloadDisparado = true;
        _ensureHeavyModules().catch(() => {});
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