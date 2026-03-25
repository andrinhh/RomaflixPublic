let _localSeriesDB  = null;
let _seriesDBReady  = null;

function _carregarSeriesDB() {
    if (_seriesDBReady) return _seriesDBReady;

    _seriesDBReady = buscarCatalogoIndex('series')
        .then(data => {
            _localSeriesDB = data
                .map(s => CatalogShared.normalizeCatalogItem(s, 'series'));
        })
        .catch(err => {
            console.error('[RomaFlix] Falha ao carregar series:', err);
            _localSeriesDB = [];
            _seriesDBReady = null;
            throw err;
        });
    return _seriesDBReady;
}

function _posterUrlSerie(item) {
    if (item.tmdb_poster_path) return TMDB_IMG_W500 + item.tmdb_poster_path;
    if (!item.poster) return '';
    let caminho = item.poster.replace(/\\/g, '/');
    if (!caminho.startsWith('posters/series/')) {
        caminho = caminho.replace(/^posters\//, 'posters/series/');
    }
    return buildPosterAssetUrl(caminho);
}

function _slugSerie(titulo) {
    return typeof slugify === 'function'
        ? slugify(titulo || '')
        : (titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function _checkSerieLocal(titulo) {
    if (!_localSeriesDB) return false;
    const slug = _slugSerie(titulo);
    if (slug.length < 2) return false;
    return _localSeriesDB.some(s => {
        const ss = _slugSerie(s.titulo);
        return ss === slug || (ss.length >= 5 && slug.startsWith(ss)) || (slug.length >= 5 && ss.startsWith(slug));
    });
}

function _getSerieLocal(titulo) {
    if (!_localSeriesDB) return null;
    const slug = _slugSerie(titulo);
    if (slug.length < 2) return null;
    const exato = _localSeriesDB.find(s => _slugSerie(s.titulo) === slug);
    if (exato) return exato;
    return _localSeriesDB.find(s => {
        const ss = _slugSerie(s.titulo);
        return ss.length >= 8 && slug.length >= 8 && ss === slug.substring(0, ss.length);
    }) || null;
}

function _getSeriesPorGenero(genero) {
    if (!_localSeriesDB) return [];
    const generoNormalizado = CatalogShared.normalizeGenre(genero) || CatalogShared.cleanText(genero);
    const g = generoNormalizado.toLowerCase();
    return _localSeriesDB
        .filter(s => (s.generos || []).some(x => x.toLowerCase() === g))
        .sort((a, b) => (b.ano || 0) - (a.ano || 0));
}

function _todasSeries() {
    return (_localSeriesDB || []).slice().sort((a, b) => (b.ano || 0) - (a.ano || 0));
}
