let _navId = 0;

const _pageCache = new Map();
const _PAGE_CACHE_TTL = 5 * 60 * 1000;

function _getCached(key) {
    const entry = _pageCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > _PAGE_CACHE_TTL) { _pageCache.delete(key); return null; }
    return entry.data;
}

function _setCache(key, data) {
    _pageCache.set(key, { data, ts: Date.now() });
}

function _animarEntradaSecoes(main) {
    const sections = main.querySelectorAll('.sessao-info, .genre-grid-page');
    sections.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(16px)';
        requestAnimationFrame(() => {
            el.style.transition = `opacity 0.4s ease ${i * 0.05}s, transform 0.4s ease ${i * 0.05}s`;
            el.style.opacity = '1';
            el.style.transform = 'none';
        });
    });
}

const GENEROS_ANIME = [
    { nome: '⚔️ Ação',              genero: 'Ação' },
    { nome: '🌀 Fantasia',          genero: 'Fantasia' },
    { nome: '😂 Comédia',           genero: 'Comédia' },
    { nome: '💀 Shounen',           genero: 'Shounen' },
    { nome: '❤️ Romance',           genero: 'Romance' },
    { nome: '🔬 Ficção Científica', genero: 'Ficção Científica' },
    { nome: '🧠 Psicológico',       genero: 'Psicológico' },
    { nome: '👻 Horror',            genero: 'Horror' },
    { nome: '🤖 Mecha',             genero: 'Mecha' },
    { nome: '🏫 Slice of Life',     genero: 'Slice of Life' },
    { nome: '🔮 Magia',             genero: 'Magia' },
    { nome: '🌌 Sobrenatural',      genero: 'Sobrenatural' },
];

const CATEGORIAS_FILMES_INICIO = [
    { nome: '🆕 Filmes Recém Adicionados', label: null,                tipo: 'recentes' },
    { nome: '💥 Filmes de Ação',           label: 'Ação',              tipo: 'label' },
    { nome: '😱 Filmes de Terror',         label: 'Terror',            tipo: 'label' },
    { nome: '🎨 Filmes de Animação',       label: 'Animação',          tipo: 'label' },
    { nome: '😂 Filmes de Comédia',        label: 'Comédia',           tipo: 'label' },
    { nome: '🎭 Filmes de Drama',          label: 'Drama',             tipo: 'label' },
    { nome: '🗺️ Filmes de Aventura',      label: 'Aventura',          tipo: 'label' },
    { nome: '🚀 Ficção Científica',        label: 'Ficção Científica', tipo: 'label' },
];

const DONATION_QR_SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
let _donationQrScriptPromise = null;

function _getDonationWallets() {
    return Array.isArray(DONATION_WALLETS) ? DONATION_WALLETS : [];
}

function _getDonationValue(wallet) {
    return String(wallet?.qrValue || wallet?.address || '').trim();
}

function _hasDonationValue(wallet) {
    return !!_getDonationValue(wallet);
}

function _ensureDonationQrScript() {
    if (window.QRCode) return Promise.resolve();
    if (_donationQrScriptPromise) return _donationQrScriptPromise;
    _donationQrScriptPromise = _loadScript(DONATION_QR_SCRIPT_URL).catch(err => {
        _donationQrScriptPromise = null;
        throw err;
    });
    return _donationQrScriptPromise;
}

function _renderDonationQr(container, wallet) {
    const qrValue = _getDonationValue(wallet);
    container.innerHTML = '';

    if (!qrValue) {
        const placeholder = document.createElement('div');
        placeholder.className = 'donation-qr-placeholder';
        placeholder.innerHTML = `
            <i class="fa-solid fa-qrcode"></i>
            <span>Adicione sua carteira em <code>js/config.js</code></span>
        `;
        container.appendChild(placeholder);
        return;
    }

    if (!window.QRCode) {
        const fallback = document.createElement('div');
        fallback.className = 'donation-qr-placeholder';
        fallback.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>QR indisponivel agora</span>
        `;
        container.appendChild(fallback);
        return;
    }

    new QRCode(container, {
        text: qrValue,
        width: 176,
        height: 176,
        colorDark: '#111111',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M,
    });

    const qrImg = container.querySelector('img');
    if (qrImg) {
        qrImg.alt = `QR Code para ${wallet.label}`;
        qrImg.loading = 'lazy';
    }
}


function _injetarRodapeSEO(main, secao) {
    const textos = {
        inicio: {
            h2: 'Assistir filmes, séries e animes online grátis',
            p:  'No RomaFlix você assiste filmes completos dublados e legendados em HD, séries online grátis sem cadastro e animes dublados em português — tudo em um só lugar, sem anúncios.',
        },
        filmes: {
            h2: 'Assistir filmes online grátis dublado HD',
            p:  'Acervo completo de filmes dublados e legendados em alta definição. Filmes de ação, terror, comédia, drama, lançamentos 2026 e clássicos — online grátis, sem login, em português.',
        },
        series: {
            h2: 'Assistir séries online grátis dubladas HD',
            p:  'Séries completas dubladas e legendadas online. Temporadas completas de séries de ação, drama, comédia e lançamentos 2026 — sem cadastro, em português, grátis.',
        },
        animes: {
            h2: 'Assistir animes online grátis dublado e legendado',
            p:  'Animes dublados e legendados completos em HD. Lançamentos 2026, animes populares em português, sem cadastro e sem anúncios — o maior catálogo de animes online grátis.',
        },
    };

    const t = textos[secao];
    if (!t) return;

    const existente = main.querySelector('.seo-rodape');
    if (existente) existente.remove();

    const footer = document.createElement('footer');
    footer.className = 'seo-rodape';
    footer.setAttribute('aria-hidden', 'false');
    footer.innerHTML = `<h2>${t.h2}</h2><p>${t.p}</p>`;
    main.appendChild(footer);
}

async function carregarInicio() {
    const myNav = ++_navId;
    if (typeof fecharMobileMenu === 'function') fecharMobileMenu();
    if (typeof fecharBusca === 'function') fecharBusca();
    _resetEmBreve();
    setPageTitle(null);
    _setNavAtivo('inicio');

    const main = document.getElementById('main-content');

    // SSR hydration: manter o #ssr-row visível enquanto carrega o conteúdo real
    // para evitar flash de tela em branco
    const ssrRow = document.getElementById('ssr-row');
    if (ssrRow) {
        // Não limpar o innerHTML ainda — deixar SSR visível durante o carregamento
        // Remover apenas elementos que não sejam o ssr-row
        Array.from(main.children).forEach(el => {
            if (el.id !== 'ssr-row') el.remove();
        });
    } else {
        main.innerHTML = '';
    }

    await _carregarLocalDB();
    // Garantir que séries estão prontas antes do Continuar Assistindo
    if (typeof _carregarSeriesDB === 'function') await _carregarSeriesDB();
    if (myNav !== _navId) return;

    if (typeof renderContinuarAssistindo === "function") {
        renderContinuarAssistindo(main);
    }

    const filmes = _localFilmesDB || [];
    let algumConteudo = false;

    // Yield para não bloquear thread principal durante renderização
    await new Promise(r => (window.requestIdleCallback || setTimeout)(r, { timeout: 50 }));
    if (myNav !== _navId) return;

    if (filmes.length > 0) {
        const filmesOrdenados = [...filmes].sort((a, b) =>
            (b.ano || 0) - (a.ano || 0)
        );
        const atribuidos = new Set();

        for (const cat of CATEGORIAS_FILMES_INICIO) {
            if (myNav !== _navId) return;

            let itens;
            if (cat.tipo === 'recentes') {
                itens = filmesOrdenados.slice(0, 24);
                itens.forEach(f => atribuidos.add(f.titulo));
            } else {
                itens = filmes
                    .filter(f =>
                        !atribuidos.has(f.titulo) &&
                        (f.generos || []).some(g => g === cat.label)
                    )
                    .sort((a, b) => (b.ano || 0) - (a.ano || 0))
                    .slice(0, 24);
                itens.forEach(f => atribuidos.add(f.titulo));
            }

            if (!itens.length) continue;
            const secao = _criarRowBase(cat.nome, { count: itens.length });
            const grid  = secao.querySelector('.grid');
            itens.forEach(f => grid.appendChild(_criarCardFilmeLocal(f)));
            main.appendChild(secao);
            algumConteudo = true;

            // Remover SSR row quando a primeira row real for adicionada
            if (algumConteudo) {
                const ssrRow = document.getElementById('ssr-row');
                if (ssrRow) ssrRow.remove();
            }
        }
    }

    const atribuidosAnime = new Set();
    const placeholders = GENEROS_ANIME.map(g => {
        const sk = criarSkeletonRow(g.nome);
        main.appendChild(sk);
        return sk;
    });

    GENEROS_ANIME.forEach((g, i) => {
        const itens = _getAnimesPorGenero(g.genero)
            .filter(a => !atribuidosAnime.has(a.anime_title || a.titulo))
            .slice(0, 24);
        if (myNav !== _navId) return;
        if (!itens.length) { placeholders[i].remove(); return; }
        itens.forEach(a => atribuidosAnime.add(a.anime_title || a.titulo));
        const secao = _criarRowBase(g.nome, { count: itens.length });
        const grid  = secao.querySelector('.grid');
        itens.forEach(a => grid.appendChild(_criarCardAnimeLocal(a)));
        placeholders[i].replaceWith(secao);
        algumConteudo = true;
    });

    await (typeof _carregarSeriesDB === 'function' ? _carregarSeriesDB() : Promise.resolve());
    if (myNav !== _navId) return;

    const todasSeries = typeof _todasSeries === 'function' ? _todasSeries() : [];
    if (todasSeries.length > 0) {
        const seriesRecentes = [...todasSeries].slice(0, 24);
        const secaoSeries = _criarRowBase('📺 Séries', { count: todasSeries.length });
        const gridSeries  = secaoSeries.querySelector('.grid');
        seriesRecentes.forEach(s => gridSeries.appendChild(_criarCardSerieLocal(s)));
        main.appendChild(secaoSeries);
        algumConteudo = true;
    }

    if (!algumConteudo) {
        main.innerHTML = `<div class="sem-resultados">
            <div class="sem-resultados-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <div class="sem-resultados-titulo">Falha ao carregar</div>
            <div class="sem-resultados-desc">Não foi possível carregar o catálogo.</div>
            <button class="btn-tentar-novamente" onclick="carregarInicio()">Tentar novamente</button>
        </div>`;
        return;
    }

    if (myNav !== _navId) return;
    _animarEntradaSecoes(main);
    _injetarRodapeSEO(main, 'inicio');
}

const CATEGORIAS_FILMES = [
    { nome: '🆕 Recém Adicionados', label: null,                tipo: 'recentes', limite: 24 },
    { nome: '💥 Ação',             label: 'Ação',              tipo: 'label' },
    { nome: '😂 Comédia',          label: 'Comédia',           tipo: 'label' },
    { nome: '😱 Terror',           label: 'Terror',            tipo: 'label' },
    { nome: '🚀 Ficção Científica',label: 'Ficção Científica', tipo: 'label' },
    { nome: '🎭 Drama',            label: 'Drama',             tipo: 'label' },
    { nome: '🗺️ Aventura',         label: 'Aventura',          tipo: 'label' },
    { nome: '❤️ Romance',          label: 'Romance',           tipo: 'label' },
    { nome: '🔍 Suspense',         label: 'Suspense',          tipo: 'label' },
    { nome: '🎵 Musical',          label: 'Musical',           tipo: 'label' },
    { nome: '🎨 Animação',         label: 'Animação',          tipo: 'label' },
    { nome: '🌀 Fantasia',         label: 'Fantasia',          tipo: 'label' },
];

async function carregarSoFilmes() {
    if (typeof fecharMobileMenu === 'function') fecharMobileMenu();
    _resetEmBreve();
    setPageTitle('Filmes');
    _setNavAtivo('filmes');
    const myNav = ++_navId;
    const main  = document.getElementById('main-content');
    mostrarLoading('Carregando filmes...');

    await _carregarLocalDB();
    if (myNav !== _navId) return;

    const filmes = _localFilmesDB || [];
    main.innerHTML = '';

    if (!filmes.length) {
        main.innerHTML = `<div class="sem-resultados">
            <div class="sem-resultados-icon"><i class="fa-solid fa-film"></i></div>
            <div class="sem-resultados-titulo">Nenhum filme disponível</div>
        </div>`;
        return;
    }

    const filmesOrdenados = [...filmes].sort((a, b) =>
        (b.ano || 0) - (a.ano || 0)
    );

    const atribuidos = new Set();

    const recentes = filmesOrdenados.slice(0, 24);
    if (recentes.length) {
        recentes.forEach(f => atribuidos.add(f.titulo));
        const secao = _criarRowBase('🆕 Recém Adicionados', { count: recentes.length });
        const grid  = secao.querySelector('.grid');
        recentes.forEach(f => grid.appendChild(_criarCardFilmeLocal(f)));
        main.appendChild(secao);
    }

    for (const cat of CATEGORIAS_FILMES) {
        if (myNav !== _navId) return;
        if (cat.tipo === 'recentes') continue;

        const itens = filmes
            .filter(f =>
                !atribuidos.has(f.titulo) &&
                (f.generos || []).some(g => g === cat.label)
            )
            .sort((a, b) => (b.ano || 0) - (a.ano || 0))
            .slice(0, 24);
        if (!itens.length) continue;

        itens.forEach(f => atribuidos.add(f.titulo));

        const secao = _criarRowBase(cat.nome, { count: itens.length });
        const grid  = secao.querySelector('.grid');
        itens.forEach(f => grid.appendChild(_criarCardFilmeLocal(f)));
        main.appendChild(secao);
    }

    _animarEntradaSecoes(main);
    _injetarRodapeSEO(main, 'filmes');
}

async function carregarSoSeries() {
    if (typeof fecharMobileMenu === 'function') fecharMobileMenu();
    _resetEmBreve();
    setPageTitle('Séries');
    _setNavAtivo('series');
    const myNav = ++_navId;
    const main  = document.getElementById('main-content');
    mostrarLoading('Carregando séries...');

    await (typeof _carregarSeriesDB === 'function' ? _carregarSeriesDB() : Promise.resolve());
    if (myNav !== _navId) return;

    const series = (typeof _todasSeries === 'function' ? _todasSeries() : []).slice().sort((a, b) => (b.ano || 0) - (a.ano || 0));
    main.innerHTML = '';

    if (!series.length) {
        main.innerHTML = `<div class="sem-resultados">
            <div class="sem-resultados-icon"><i class="fa-solid fa-tv"></i></div>
            <div class="sem-resultados-titulo">Nenhuma série disponível</div>
        </div>`;
        return;
    }

    const GENEROS_SERIES_ORDEM = [
        { nome: '🎭 Drama',             genero: 'Drama' },
        { nome: '⚔️ Ação',              genero: 'Ação' },
        { nome: '😂 Comédia',           genero: 'Comédia' },
        { nome: '🗺️ Aventura',          genero: 'Aventura' },
        { nome: '🔍 Suspense',          genero: 'Suspense' },
        { nome: '😱 Terror',            genero: 'Terror' },
        { nome: '❤️ Romance',           genero: 'Romance' },
        { nome: '🚀 Ficção Científica', genero: 'Ficção Científica' },
        { nome: '🎨 Animação',          genero: 'Animação' },
        { nome: '🔎 Crime',             genero: 'Crime' },
        { nome: '🌀 Fantasia',          genero: 'Fantasia' },
        { nome: '🎵 Musical',           genero: 'Musical' },
    ];
    const GENEROS_SERIES = GENEROS_SERIES_ORDEM.filter(g =>
        typeof _getSeriesPorGenero === 'function' &&
        _getSeriesPorGenero(g.genero).length > 0
    );

    const atribuidos = new Set();

    const recentes = series.slice(0, 24);
    if (recentes.length) {
        recentes.forEach(s => atribuidos.add(s.titulo));
        const secaoRecentes = _criarRowBase('🆕 Recém Adicionados', { count: recentes.length });
        const gridRecentes  = secaoRecentes.querySelector('.grid');
        recentes.forEach(s => gridRecentes.appendChild(_criarCardSerieLocal(s)));
        main.appendChild(secaoRecentes);
    }

    for (const g of GENEROS_SERIES) {
        if (myNav !== _navId) return;
        const itens = (typeof _getSeriesPorGenero === 'function'
            ? _getSeriesPorGenero(g.genero)
            : [])
            .filter(s => !atribuidos.has(s.titulo))
            .sort((a, b) => (b.ano || 0) - (a.ano || 0))
            .slice(0, 24);
        if (!itens.length) continue;
        itens.forEach(s => atribuidos.add(s.titulo));
        const secao = _criarRowBase(g.nome, { count: itens.length });
        const grid  = secao.querySelector('.grid');
        itens.forEach(s => grid.appendChild(_criarCardSerieLocal(s)));
        main.appendChild(secao);
    }

    if (myNav === _navId) { _animarEntradaSecoes(main); _injetarRodapeSEO(main, 'series'); }
}

async function carregarPaginaAnimes() {
    if (typeof fecharMobileMenu === 'function') fecharMobileMenu();
    _resetEmBreve();
    setPageTitle('Animes');
    _setNavAtivo('animes');
    const myNav = ++_navId;
    const main  = document.getElementById('main-content');
    main.innerHTML = '';

    await _carregarLocalDB();
    if (myNav !== _navId) return;

    const placeholders = GENEROS_ANIME.map(g => {
        const sk = criarSkeletonRow(g.nome);
        main.appendChild(sk);
        return sk;
    });

    const atribuidosAnime = new Set();
    GENEROS_ANIME.forEach((g, i) => {
        const itens = _getAnimesPorGenero(g.genero)
            .filter(a => !atribuidosAnime.has(a.anime_title || a.titulo))
            .slice(0, 24);
        if (myNav !== _navId) return;
        if (!itens.length) { placeholders[i].remove(); return; }
        itens.forEach(a => atribuidosAnime.add(a.anime_title || a.titulo));
        const secao = _criarRowBase(g.nome, { count: itens.length });
        const grid  = secao.querySelector('.grid');
        itens.forEach(a => grid.appendChild(_criarCardAnimeLocal(a)));
        placeholders[i].replaceWith(secao);
    });

    if (myNav === _navId) { _animarEntradaSecoes(main); _injetarRodapeSEO(main, 'animes'); }
}

async function carregarPaginaDoacao() {
    if (typeof fecharMobileMenu === 'function') fecharMobileMenu();
    if (typeof fecharBusca === 'function') fecharBusca();
    _resetEmBreve();
    setPageTitle('Apoiar');
    _setNavAtivo('doacao');

    const myNav = ++_navId;
    const main = document.getElementById('main-content');
    const wallets = _getDonationWallets();

    mostrarLoading('Preparando pagina de apoio...');

    const cardsHtml = wallets.map(wallet => {
        const hasValue = _hasDonationValue(wallet);
        const recommended = wallet.key === DONATION_RECOMMENDED_KEY;
        const classes = ['donation-card'];
        if (recommended) classes.push('is-recommended');
        if (!hasValue) classes.push('is-pending');

        return `
            <article class="${classes.join(' ')}">
                <div class="donation-card-head">
                    <div>
                        <div class="donation-coin">${sanitizarHTML(wallet.label)}</div>
                        <div class="donation-network">${recommended ? 'Recomendado para apoiar o projeto' : 'Carteira para apoiar'}</div>
                    </div>
                    ${recommended ? '<span class="donation-badge">Recomendado</span>' : ''}
                </div>
                <div class="donation-qr-shell">
                    <div class="donation-qr" data-donation-qr="${sanitizarHTML(wallet.key)}"></div>
                </div>
                <div class="donation-address-label">Endereco</div>
                <code class="donation-address">${hasValue ? sanitizarHTML(wallet.address) : 'Preencha em js/config.js'}</code>
                <div class="donation-hint">${hasValue ? 'Escaneie o QR ou copie o endereco na sua carteira.' : 'Assim que voce preencher a carteira, o QR aparece automaticamente.'}</div>
            </article>
        `;
    }).join('');

    main.innerHTML = `
        <section class="genre-grid-page donation-page">
            <div class="donation-hero">
                <span class="donation-kicker">&#x1F496; Apoie o projeto</span>
                <h1 class="donation-title">Apoie o projeto</h1>
                <p class="donation-copy">
                    Se voc&ecirc; usou e gostou do nosso site, considere apoiar.
                </p>
                <p class="donation-copy">
                    Sem an&uacute;ncios invasivos, sem complica&ccedil;&atilde;o.
                </p>
                <p class="donation-copy">
                    Manter tudo funcionando (servidores, dom&iacute;nio e melhorias) tem custo &mdash; e a sua ajuda faz toda a diferen&ccedil;a para que o projeto continue online e evoluindo.
                </p>
                <p class="donation-copy">
                    Mesmo um valor pequeno j&aacute; faz diferen&ccedil;a &#x1F64F;
                </p>
                <div class="donation-tip">
                    <i class="fa-solid fa-bolt"></i>
                    <span><strong>Recomendado:</strong> USDT (TRC20) &mdash; r&aacute;pido e com taxas baixas</span>
                </div>
                <p class="donation-footer">Obrigado por apoiar &#x2764;&#xFE0F;</p>
            </div>
            <div class="donation-grid">
                ${cardsHtml}
            </div>
        </section>
    `;

    if (myNav !== _navId) return;

    try {
        await _ensureDonationQrScript();
    } catch (err) {
        console.error('[RomaFlix] Falha ao carregar QR Code:', err);
    }

    if (myNav !== _navId) return;

    wallets.forEach(wallet => {
        const target = main.querySelector(`[data-donation-qr="${wallet.key}"]`);
        if (!target) return;
        _renderDonationQr(target, wallet);
    });

    _animarEntradaSecoes(main);
}

async function carregarEmBreve() {
    if (typeof fecharMobileMenu === 'function') fecharMobileMenu();
    setPageTitle('Em Breve');
    _setNavAtivo('embreve');
    const main = document.getElementById('main-content');

    await _carregarLocalDB();

    const semEps = (_localAnimeDB || []).filter(a => a.sem_episodios || !_temEpValido(a));
    main.innerHTML = '';

    if (!semEps.length) {
        main.innerHTML = `<div class="sem-resultados">
            <div class="sem-resultados-icon"><i class="fa-solid fa-film"></i></div>
            <div class="sem-resultados-titulo">Nada em breve no momento</div>
        </div>`;
        return;
    }

    const secao = _criarRowBase('\u{1F51C} Em Breve...');
    const grid  = secao.querySelector('.grid');
    semEps.slice(0, 30).forEach(a => {
        const card = document.createElement('div');
        card.className = 'card card-em-breve';
        const img = document.createElement('img');
        img.src     = _posterUrlAnime(a);
        img.alt     = a.titulo || '';
        img.loading = 'lazy';
        img.onerror = function() { this.style.background = '#1a1a1a'; };
        const overlay = document.createElement('div');
        overlay.className = 'em-breve-overlay';
        overlay.innerHTML = '<span>Em Breve</span>';
        card.append(img, overlay);
        grid.appendChild(card);
    });
    main.appendChild(secao);
    _animarEntradaSecoes(main);
}

async function filtrarPorGeneroLocal(genero, nomeGenero, tipo) {
    if (typeof fecharMobileMenu === 'function') fecharMobileMenu();
    setPageTitle(nomeGenero);
    _setNavAtivo(null);

    await _carregarLocalDB();

    let itens = [];
    if (tipo === 'anime') {
        itens = _getAnimesPorGenero(genero);
    } else {
        itens = (_localFilmesDB || []).filter(f =>
            (f.generos || []).some(g => g.toLowerCase() === genero.toLowerCase())
        );
    }

    exibirGridGeneroLocal(nomeGenero, itens, tipo);
}

function _setNavAtivo(secao) {
    document.querySelectorAll('.nav-btn, .bottom-nav-item').forEach(btn => {
        btn.classList.remove('ativo');
        if (secao && btn.dataset.nav === secao) btn.classList.add('ativo');
    });
}

/* ── Canais (TV ao vivo) — player em js/player-canais.js ────── */

function _criarCardCanal(canal, iconBase) {
    const card = document.createElement('div');
    card.className = 'canal-card';

    const resolvedBase = iconBase || '';
    const iconUrl = canal.icon ? (resolvedBase + canal.icon) : '';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'canal-card-icon';
    if (iconUrl) {
        const img = document.createElement('img');
        img.src = iconUrl;
        img.alt = canal.nome;
        img.loading = 'lazy';
        img.draggable = false;
        img.onerror = function() { this.style.display = 'none'; iconDiv.innerHTML = '<i class="fa-solid fa-satellite-dish"></i>'; };
        iconDiv.appendChild(img);
    } else {
        iconDiv.innerHTML = '<i class="fa-solid fa-satellite-dish"></i>';
    }

    const nome = document.createElement('div');
    nome.className = 'canal-card-nome';
    nome.textContent = canal.nome;

    const badge = document.createElement('span');
    badge.className = 'canal-card-badge canal-card-badge-online';
    badge.innerHTML = '<i class="fa-solid fa-circle"></i> AO VIVO';

    card.append(iconDiv, nome, badge);
    card.addEventListener('click', _withHeavy(() => _abrirPlayerCanal(canal)));

    return card;
}

async function carregarPaginaCanais() {
    if (typeof fecharMobileMenu === 'function') fecharMobileMenu();
    if (typeof fecharBusca === 'function') fecharBusca();
    _resetEmBreve();
    setPageTitle('Canais');
    _setNavAtivo('canais');

    const myNav = ++_navId;
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><span class="loading-text">Carregando canais...</span></div>';

    const workerUrl = typeof WORKER_URL !== 'undefined' ? WORKER_URL : '';

    let data;
    try {
        const res = await fetch(`${workerUrl}/api/catalog/canais`, { signal: AbortSignal.timeout(15000) });
        data = await res.json();
    } catch {
        main.innerHTML = `<div class="sem-resultados">
            <div class="sem-resultados-icon"><i class="fa-solid fa-satellite-dish"></i></div>
            <div class="sem-resultados-titulo">Erro ao carregar canais</div>
            <div class="sem-resultados-desc">Tente novamente em instantes.</div>
        </div>`;
        return;
    }

    if (myNav !== _navId) return;
    main.innerHTML = '';

    // Caminho D1: API retornou { icon_base, categorias: [{ nome, canais }] }
    if (data && data.categorias && data.categorias.length) {
        const iconBase = data.icon_base || '';
        for (const cat of data.categorias) {
            if (myNav !== _navId) return;
            if (!cat.canais || !cat.canais.length) continue;

            const secao = _criarRowBase(cat.nome, { count: cat.canais.length });
            const grid = secao.querySelector('.grid');
            grid.classList.add('canais-row-grid');
            cat.canais.forEach(c => grid.appendChild(_criarCardCanal(c, iconBase)));
            main.appendChild(secao);
        }
    } else {
        main.innerHTML = `<div class="sem-resultados">
            <div class="sem-resultados-icon"><i class="fa-solid fa-satellite-dish"></i></div>
            <div class="sem-resultados-titulo">Nenhum canal disponível</div>
        </div>`;
        return;
    }

    if (myNav === _navId) _animarEntradaSecoes(main);
}