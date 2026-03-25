const inputBusca    = document.getElementById('input-busca');
const searchBox     = document.getElementById('search-box');
const searchIconBtn = document.getElementById('search-icon-btn');
const searchWrap    = document.getElementById('search-wrapper');
const searchSuggs   = document.getElementById('search-suggestions');

let _searchDebounce  = null;
let _suggestDebounce = null;

function abrirBusca() {
    searchBox.classList.add('visivel');
    searchWrap.classList.add('aberto');
    setTimeout(() => inputBusca.focus(), 120);
}

function fecharBusca() {
    searchBox.classList.remove('visivel');
    searchWrap.classList.remove('aberto');
    inputBusca.blur();
    inputBusca.value = '';
    _fecharSugestoes();
}

function _fecharSugestoes() {
    if (searchSuggs) searchSuggs.classList.remove('visivel');
}

function _slugMatch(haystack, needle) {
    const h = slugify(haystack || '');
    const n = slugify(needle   || '');
    if (!n || n.length < 2) return false;
    return h.includes(n) || n.includes(h.substring(0, Math.max(5, h.length - 2)));
}

function _scoreMatch(titulo, termo) {
    const t = slugify(titulo);
    const q = slugify(termo);
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (t.includes(q)) return 60;
    const palavras = q.split(/(?=[A-Z])/).filter(Boolean);
    if (palavras.length > 1 && palavras.every(p => t.includes(p))) return 40;
    return 0;
}

async function _exibirSugestoes(termo) {
    if (!searchSuggs || !termo || termo.length < 2) { _fecharSugestoes(); return; }

    await _carregarLocalDB();
    if (typeof _carregarSeriesDB === 'function') await _carregarSeriesDB();

    const animes  = (_localAnimeDB  || [])
        .filter(a => _slugMatch(a.titulo, termo) && !a.sem_episodios && _temEpValido(a))
        .slice(0, 3);
    const filmes  = (_localFilmesDB || [])
        .filter(f => _slugMatch(f.titulo, termo))
        .slice(0, 2);
    const series  = (typeof _todasSeries === 'function' ? _todasSeries() : [])
        .filter(s => _slugMatch(s.titulo, termo))
        .slice(0, 2);

    const resultados = [
        ...animes.map(a  => ({ tipo: 'Anime', item: a,  poster: _posterUrlAnime(a) })),
        ...filmes.map(f  => ({ tipo: 'Filme', item: f,  poster: _posterUrlFilme(f) })),
        ...series.map(s  => ({ tipo: 'Série', item: s,  poster: typeof _posterUrlSerie === 'function' ? _posterUrlSerie(s) : '' })),
    ].slice(0, 6);

    if (!resultados.length) { _fecharSugestoes(); return; }

    searchSuggs.innerHTML = '';

    resultados.forEach(({ tipo, item, poster }) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'sugestao-item';
        el.setAttribute('role', 'option');

        const inicial = sanitizarHTML((item.titulo || '?').trim().slice(0, 1));
        const anoLabel = item.ano ? ` · ${item.ano}` : '';

        el.innerHTML = poster
            ? `<img class="sugestao-poster" src="${poster}" alt="" loading="lazy" onerror="this.outerHTML='<span class=\\'sugestao-poster-fallback\\'>${inicial}</span>'">`
            : `<span class="sugestao-poster-fallback">${inicial}</span>`;

        el.innerHTML += `
            <span class="sugestao-info">
                <span class="sugestao-titulo">${sanitizarHTML(item.titulo)}</span>
                <span class="sugestao-tipo">${tipo}${anoLabel}</span>
            </span>`;

        el.addEventListener('click', () => {
            fecharBusca();
            _ensureHeavyModules().then(() => {
                if (tipo === 'Anime') abrirModalAnimeLocal(item);
                else if (tipo === 'Série') abrirModalSerieLocal(item);
                else abrirModalFilmeLocal(item);
            });
        });
        searchSuggs.appendChild(el);
    });

    searchSuggs.classList.add('visivel');
}

async function buscarTudo(termo) {
    if (!termo || termo.length < 2) return;

    setPageTitle(`Busca: ${termo}`);
    _setNavAtivo(null);
    mostrarLoading('Buscando...');
    const main = document.getElementById('main-content');

    await _carregarLocalDB();
    if (typeof _carregarSeriesDB === 'function') await _carregarSeriesDB();

    const animesRaw = (_localAnimeDB || [])
        .filter(a => _slugMatch(a.titulo, termo) && !a.sem_episodios && _temEpValido(a));
    const filmesRaw = (_localFilmesDB || [])
        .filter(f => _slugMatch(f.titulo, termo));
    const seriesRaw = (typeof _todasSeries === 'function' ? _todasSeries() : [])
        .filter(s => _slugMatch(s.titulo, termo));

    const animes = animesRaw
        .map(a => ({ ...a, _score: _scoreMatch(a.titulo, termo) }))
        .sort((a, b) => b._score - a._score);
    const filmes = filmesRaw
        .map(f => ({ ...f, _score: _scoreMatch(f.titulo, termo) }))
        .sort((a, b) => b._score - a._score);
    const series = seriesRaw
        .map(s => ({ ...s, _score: _scoreMatch(s.titulo, termo) }))
        .sort((a, b) => b._score - a._score);

    main.innerHTML = '';
    let temResultado = false;

    if (filmes.length > 0) {
        const secao = _criarRowBase(`🎬 Filmes: "${sanitizarHTML(termo)}"`);
        const grid  = secao.querySelector('.grid');
        main.appendChild(secao);
        filmes.forEach(f => {
            grid.appendChild(_criarCardFilmeLocal(f));
            temResultado = true;
        });
    }

    if (animes.length > 0) {
        const secao = _criarRowBase(`⚔️ Animes: "${sanitizarHTML(termo)}"`);
        const grid  = secao.querySelector('.grid');
        main.appendChild(secao);
        animes.forEach(a => {
            grid.appendChild(_criarCardAnimeLocal(a));
            temResultado = true;
        });
    }

    if (series.length > 0) {
        const secao = _criarRowBase(`📺 Séries: "${sanitizarHTML(termo)}"`);
        const grid  = secao.querySelector('.grid');
        main.appendChild(secao);
        series.forEach(s => {
            grid.appendChild(_criarCardSerieLocal(s));
            temResultado = true;
        });
    }

    if (!temResultado) {
        main.innerHTML = `
            <div class="sem-resultados">
                <div class="sem-resultados-icon"><i class="fa-solid fa-film"></i></div>
                <div class="sem-resultados-titulo">Nenhum resultado encontrado</div>
                <div class="sem-resultados-desc">
                    Não encontramos nada para <strong>"${sanitizarHTML(termo)}"</strong> na biblioteca.<br>
                    Tente outros termos ou explore os catálogos de Filmes e Animes.
                </div>
            </div>`;
    } else {
        _animarEntradaSecoes(main);
    }
}

searchIconBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (searchWrap.classList.contains('aberto')) {
        fecharBusca();
    } else {
        abrirBusca();
    }
});


inputBusca.addEventListener('input', () => {
    const termo = inputBusca.value.trim();

    clearTimeout(_searchDebounce);
    clearTimeout(_suggestDebounce);

    if (termo.length === 0) {
        _fecharSugestoes();
        return;
    }
    if (termo.length < 2) return;

    _suggestDebounce = setTimeout(() => _exibirSugestoes(termo), 400);
});

inputBusca.addEventListener('keydown', e => {
    if (e.key === 'Enter' && inputBusca.value.trim().length >= 2) {
        clearTimeout(_searchDebounce);
        clearTimeout(_suggestDebounce);
        _fecharSugestoes();
        inputBusca.blur();
        buscarTudo(inputBusca.value.trim());
    }
    if (e.key === 'Escape') fecharBusca();
    if (e.key === 'ArrowDown') {
        const first = searchSuggs?.querySelector('.sugestao-item');
        if (first) { e.preventDefault(); first.focus(); }
    }
});