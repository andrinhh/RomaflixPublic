let _localAnimeDB  = null;
let _localFilmesDB = null;
let _localDBReady  = null;

function _posterUrlAnime(item) {
    if (item.tmdb_poster_path) return TMDB_IMG_W500 + item.tmdb_poster_path;
    if (!item.poster) return '';
    if (/^https?:\/\//i.test(item.poster)) return item.poster;
    let caminho = item.poster.replace(/\\/g, '/');
    if (!caminho.startsWith('posters/animes/')) {
        caminho = caminho.replace(/^posters\//, 'posters/animes/');
    }
    return buildPosterAssetUrl(caminho);
}

function _posterNomeFilme(titulo) {
    return (titulo || '')
        .replace(/\uFEFF/g, '')
        .trim()
        .replace(/\s+/g, '_');
}

function _posterUrlFilme(item) {
    if (item.tmdb_poster_path) return TMDB_IMG_W500 + item.tmdb_poster_path;
    if (item.poster) {
        if (/^https?:\/\//i.test(item.poster)) return item.poster;
        const caminho = item.poster.replace(/\uFEFF/g, '').replace(/\\/g, '/');
        return buildPosterAssetUrl(caminho);
    }
    if (item.poster_local) {
        if (/^https?:\/\//i.test(item.poster_local)) return item.poster_local;
        const caminho = item.poster_local.replace(/\uFEFF/g, '').replace(/\\/g, '/');
        return buildPosterAssetUrl(caminho);
    }
    if (!item.titulo) return '';
    const pasta = _posterNomeFilme(item.titulo);
    const base  = 'posters/filmes/' +
                  encodeAssetSegment(pasta) + '/' +
                  encodeAssetSegment(pasta);
    return buildPosterAssetUrl(base + '.webp');
}

function _carregarLocalDB() {
    if (_localDBReady) return _localDBReady;
    const animePromise = buscarCatalogoIndex('animes').catch(err => {
        console.warn('[RomaFlix] catalogo remoto de animes falhou:', err);
        return [];
    });
    const filmesPromise = buscarCatalogoIndex('filmes').catch(err => {
        console.warn('[RomaFlix] catalogo remoto de filmes falhou:', err);
        return [];
    });

    _localDBReady = Promise.all([
        animePromise,
        filmesPromise,
        typeof _carregarSeriesDB === 'function'
            ? _carregarSeriesDB().catch(err => { console.warn('[RomaFlix] catalogo remoto de series falhou:', err); })
            : Promise.resolve(),
    ]).then(([animes, filmes]) => {
        _localAnimeDB = animes.map(item =>
            CatalogShared.normalizeCatalogItem({
                ...item,
                tipo: item.tipo || item._tipo || 'leg',
            }, 'anime')
        );
        _localFilmesDB = filmes.map(item =>
            CatalogShared.normalizeCatalogItem(item, 'movie')
        );
    }).catch(err => {
        _localDBReady = null;
        throw err;
    });
    return _localDBReady;
}

function _slugAnime(titulo) {
    return slugify(titulo || '');
}

function _temEpValido(item) {
    if (typeof item?.has_video !== 'undefined') return !!item.has_video;
    const epsLeg = item._epsLeg || item.episodios || [];
    const epsDub = item._epsDub || [];
    const todos  = epsLeg.length || epsDub.length ? [...epsLeg, ...epsDub] : (item.episodios || []);
    return todos.some(e => e.video_src && e.video_src !== 'source_invalida');
}

function _checkAnimeLocal(titulo) {
    if (!_localAnimeDB) return false;
    const slug    = _slugAnime(titulo);
    if (slug.length < 2) return false;
    const isDub   = /dublado|dub/i.test(titulo);

    const exact = _localAnimeDB.find(a => _slugAnime(a.titulo) === slug);
    if (exact) return isDub ? 'dub' : 'leg';

    const parcial = _localAnimeDB.find(a => {
        const s = _slugAnime(a.titulo);
        return s.length >= 5 && (slug.startsWith(s) || s.startsWith(slug));
    });
    if (parcial) return isDub ? 'dub' : 'leg';

    return false;
}

function _getAnimeLocal(titulo) {
    if (!_localAnimeDB) return null;
    const slug = _slugAnime(titulo);
    if (slug.length < 2) return null;
    const exato = _localAnimeDB.find(a => _slugAnime(a.titulo) === slug);
    if (exato) return exato;
    return _localAnimeDB.find(a => {
        const s = _slugAnime(a.titulo);
        return s.length >= 8 && slug.length >= 8 && s === slug.substring(0, s.length);
    }) || null;
}

function _checkFilmeLocal(titulo) {
    if (!_localFilmesDB) return false;
    const slug = slugify(titulo || '');
    if (slug.length < 2) return false;
    return _localFilmesDB.some(f => slugify(f.titulo || '') === slug);
}

function _getFilmeLocal(titulo) {
    if (!_localFilmesDB) return null;
    const slug = slugify(titulo || '');
    if (!slug) return null;
    // Match exato primeiro
    const exato = _localFilmesDB.find(f => slugify(f.titulo || '') === slug);
    if (exato) return exato;
    // Sem fallback por prefixo — evita colisões entre títulos parecidos (ex: "Pânico" vs "Pânico Abaixo de Zero")
    return null;
}

function _getAnimesPorGenero(genero) {
    if (!_localAnimeDB) return [];
    const generoNormalizado = CatalogShared.normalizeGenre(genero) || CatalogShared.cleanText(genero);
    const g = generoNormalizado.toLowerCase();
    return _localAnimeDB
        .filter(a =>
            (a.generos || []).some(x => x.toLowerCase() === g) && !a.sem_episodios && _temEpValido(a)
        )
        .sort((a, b) => (b.ano || 0) - (a.ano || 0));
}

function _animesComEpisodios() {
    if (!_localAnimeDB) return [];
    return _localAnimeDB.filter(a => !a.sem_episodios && _temEpValido(a));
}

async function checkFilmesTitulos(titulos) {
    await _carregarLocalDB();
    const res = {};
    for (const t of titulos) res[t] = _checkFilmeLocal(t);
    return res;
}

function buscarVariacoes(tituloBase) {
    const nomeDub = tituloBase + ' Dublado';
    return _checkAnimeLocal(nomeDub) ? [nomeDub] : [];
}