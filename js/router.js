(function () {
    const SECTION_PATHS = {
        inicio: '/',
        filmes: '/filmes',
        series: '/series',
        animes: '/animes',
        canais: '/canais',
        doacao: '/apoiar',
    };

    const SECTION_ALIASES = {
        '': 'inicio',
        inicio: 'inicio',
        filmes: 'filmes',
        filme: 'filmes',
        series: 'series',
        serie: 'series',
        animes: 'animes',
        anime: 'animes',
        canais: 'canais',
        canal: 'canais',
        doacao: 'doacao',
        doacoes: 'doacao',
        apoiar: 'doacao',
    };

    const SECTION_TO_MODAL_TYPE = {
        filmes: 'movie',
        series: 'series',
        animes: 'anime',
    };

    let _routeToken = 0;
    let _initialized = false;

    function _consumeSuppressedModalOpen(route) {
        const marker = window.__RF_SKIP_NEXT_MODAL_ROUTE__;
        if (!marker) return false;

        const expiresAt = Number(marker.expiresAt || 0);
        if (expiresAt && Date.now() > expiresAt) {
            window.__RF_SKIP_NEXT_MODAL_ROUTE__ = null;
            return false;
        }

        if (!route?.detail) return false;

        const markedPath = _normalizePath(marker.path || '');
        const routePath = _normalizePath(route.pathname || location.pathname);
        if (markedPath && markedPath === routePath) {
            window.__RF_SKIP_NEXT_MODAL_ROUTE__ = null;
            return true;
        }

        return false;
    }

    function _normalizePath(pathname) {
        const path = String(pathname || '/').split('?')[0].split('#')[0] || '/';
        if (path === '/') return '/';
        return path.replace(/\/+$/, '') || '/';
    }

    function _parseRoute(pathname = location.pathname) {
        const normalized = _normalizePath(pathname);
        const parts = normalized.split('/').filter(Boolean);

        if (!parts.length) {
            return {
                pathname: '/',
                section: 'inicio',
                sectionPath: '/',
                detail: false,
                known: true,
            };
        }

        const alias = SECTION_ALIASES[(parts[0] || '').toLowerCase()];
        if (!alias) {
            return {
                pathname: normalized,
                section: 'inicio',
                sectionPath: '/',
                detail: false,
                known: false,
            };
        }

        const sectionPath = SECTION_PATHS[alias] || '/';
        if (parts.length === 1 || !SECTION_TO_MODAL_TYPE[alias]) {
            return {
                pathname: normalized,
                section: alias,
                sectionPath,
                detail: false,
                known: true,
            };
        }

        return {
            pathname: normalized,
            section: alias,
            sectionPath,
            detail: true,
            known: true,
            modalType: SECTION_TO_MODAL_TYPE[alias],
            slug: decodeURIComponent(parts.slice(1).join('/')),
        };
    }

    function _getCurrentRoute() {
        return _parseRoute(location.pathname);
    }

    function _getBackgroundPath(route = _getCurrentRoute(), historyState = history.state || {}) {
        if (!route.detail) return route.sectionPath;
        return _normalizePath(historyState.backgroundPath || route.sectionPath);
    }

    function _modalAberto() {
        return document.getElementById('modal-container')?.style.display === 'flex';
    }

    async function _loadItemForRoute(route) {
        if (!route?.detail || !route.slug) return null;

        if (route.modalType === 'series') {
            if (typeof _carregarSeriesDB === 'function') await _carregarSeriesDB();
            return typeof _getSerieLocal === 'function' ? _getSerieLocal(route.slug) : null;
        }

        if (typeof _carregarLocalDB === 'function') await _carregarLocalDB();
        if (route.modalType === 'anime') {
            return typeof _getAnimeLocal === 'function' ? _getAnimeLocal(route.slug) : null;
        }
        if (route.modalType === 'movie') {
            return typeof _getFilmeLocal === 'function' ? _getFilmeLocal(route.slug) : null;
        }
        return null;
    }

    async function _renderSection(section) {
        const fnMap = {
            inicio: typeof carregarInicio === 'function' ? carregarInicio : null,
            filmes: typeof carregarSoFilmes === 'function' ? carregarSoFilmes : null,
            series: typeof carregarSoSeries === 'function' ? carregarSoSeries : null,
            animes: typeof carregarPaginaAnimes === 'function' ? carregarPaginaAnimes : null,
            canais: typeof carregarPaginaCanais === 'function' ? carregarPaginaCanais : null,
            doacao: typeof carregarPaginaDoacao === 'function' ? carregarPaginaDoacao : null,
        };

        const fn = fnMap[section] || fnMap.inicio;
        if (typeof fn === 'function') {
            await fn();
        }
    }

    async function _openModalForRoute(route, item, opts = {}) {
        if (!route?.detail || !item) return;
        if (typeof _ensureHeavyModules === 'function') await _ensureHeavyModules();

        const modalOpts = {
            ...opts,
            syncRoute: false,
            backgroundPath: opts.backgroundPath || route.sectionPath,
        };

        if (route.modalType === 'anime' && typeof abrirModalAnimeLocal === 'function') {
            await abrirModalAnimeLocal(item, modalOpts);
            return;
        }
        if (route.modalType === 'movie' && typeof abrirModalFilmeLocal === 'function') {
            await abrirModalFilmeLocal(item, modalOpts);
            return;
        }
        if (route.modalType === 'series' && typeof abrirModalSerieLocal === 'function') {
            await abrirModalSerieLocal(item, modalOpts);
        }
    }

    async function applyRoute({ path = location.pathname, state = history.state || null, forceRender = false } = {}) {
        const token = ++_routeToken;
        const route = _parseRoute(path);
        const currentState = state || history.state || {};

        if (_consumeSuppressedModalOpen(route)) {
            return;
        }

        if (!route.detail && _modalAberto() && !forceRender && typeof fecharModal === 'function') {
            fecharModal({ skipRouteSync: true });
            return;
        }

        const backgroundPath = _getBackgroundPath(route, currentState);
        const backgroundRoute = _parseRoute(backgroundPath);

        if (!route.detail && _modalAberto() && typeof fecharModal === 'function') {
            fecharModal({ skipRouteSync: true });
        }

        await _renderSection(backgroundRoute.section);
        if (token !== _routeToken) return;

        if (!route.detail) return;

        const item = await _loadItemForRoute(route);
        if (token !== _routeToken) return;

        if (!item) {
            if (_modalAberto() && typeof fecharModal === 'function') {
                fecharModal({ skipRouteSync: true });
            }
            showToast?.('Titulo nao encontrado.', 'error');
            const fallbackState = {
                section: backgroundRoute.section,
                backgroundPath,
            };
            history.replaceState(fallbackState, '', backgroundPath);
            return;
        }

        await _openModalForRoute(route, item, { backgroundPath });
    }

    function _buildItemPath(type, item) {
        const titulo = item?.titulo || item?.anime_title || '';
        const slug = typeof slugifyPath === 'function'
            ? slugifyPath(titulo)
            : String(titulo || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');

        if (!slug) return '/';
        const section = type === 'movie'
            ? 'filmes'
            : (type === 'series' ? 'series' : 'animes');

        return `${SECTION_PATHS[section]}/${encodeURIComponent(slug)}`;
    }

    function syncModalRoute(type, item, opts = {}) {
        const route = _getCurrentRoute();
        const currentPath = _normalizePath(location.pathname);
        const targetPath = _buildItemPath(type, item);
        const historyState = history.state || {};
        const fallbackBackground = route.detail
            ? _getBackgroundPath(route, historyState)
            : currentPath;
        const backgroundPath = _normalizePath(opts.backgroundPath || fallbackBackground || SECTION_PATHS.inicio);

        if (opts.syncRoute === false || !targetPath || targetPath === '/') {
            return { targetPath, backgroundPath };
        }

        const nextState = {
            modal: true,
            modalType: type,
            backgroundPath,
        };

        const samePath = currentPath === targetPath;
        const sameBackground = _normalizePath(historyState.backgroundPath || '') === backgroundPath;
        const alreadyModal = !!historyState.modal;

        if (!samePath || !alreadyModal || !sameBackground) {
            const method = (opts.replace || samePath) ? 'replaceState' : 'pushState';
            history[method](nextState, '', targetPath);
        }

        return { targetPath, backgroundPath };
    }

    async function navigateToSection(section, opts = {}) {
        const normalized = section && SECTION_PATHS[section] ? section : 'inicio';
        const targetPath = SECTION_PATHS[normalized];
        const state = { section: normalized };

        if (_normalizePath(location.pathname) !== targetPath || _getCurrentRoute().detail) {
            const method = opts.replace ? 'replaceState' : 'pushState';
            history[method](state, '', targetPath);
        } else if (!history.state?.section) {
            history.replaceState({ ...(history.state || {}), ...state }, '', targetPath);
        }

        await applyRoute({ path: targetPath, state, forceRender: true });
    }

    function closeModalRoute() {
        const route = _getCurrentRoute();
        if (!route.detail) return false;

        const historyState = history.state || {};
        const backgroundPath = _getBackgroundPath(route, historyState);
        const backgroundRoute = _parseRoute(backgroundPath);

        if (historyState.modal && !historyState.directEntry) {
            history.back();
            return true;
        }

        history.replaceState({ section: backgroundRoute.section }, '', backgroundPath);
        if (typeof fecharModal === 'function') {
            fecharModal({ skipRouteSync: true });
        }
        return true;
    }

    async function init() {
        if (_initialized) return;
        _initialized = true;

        const route = _getCurrentRoute();
        const initialState = history.state || {};

        if (route.detail) {
            history.replaceState({
                ...initialState,
                modal: true,
                modalType: route.modalType,
                backgroundPath: _getBackgroundPath(route, initialState),
                directEntry: !initialState.modal,
            }, '', route.pathname);
        } else if (!initialState?.section) {
            history.replaceState({ section: route.section }, '', route.pathname);
        }

        window.addEventListener('popstate', () => {
            applyRoute().catch(err => {
                console.error('[RomaFlix] Falha ao aplicar rota:', err);
            });
        });

        await applyRoute();
    }

    window.RomaRouter = {
        applyRoute,
        buildItemPath: _buildItemPath,
        closeModalRoute,
        getCurrentRoute: _getCurrentRoute,
        init,
        navigateToSection,
        parseRoute: _parseRoute,
        suppressNextModalOpen(path = location.pathname, ttl = 1500) {
            window.__RF_SKIP_NEXT_MODAL_ROUTE__ = {
                path: _normalizePath(path),
                expiresAt: Date.now() + Math.max(200, Number(ttl || 1500)),
            };
        },
        syncModalRoute,
    };
})();



