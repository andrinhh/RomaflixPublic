const _catalogIndexCache = new Map();

async function buscarCatalogoIndex(tipo) {
    if (_catalogIndexCache.has(tipo)) return _catalogIndexCache.get(tipo);

    const promise = fetch(`${WORKER_URL}/api/catalog/${encodeURIComponent(tipo)}`)
        .then(async (res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .catch((err) => {
            _catalogIndexCache.delete(tipo);
            throw err;
        });

    _catalogIndexCache.set(tipo, promise);
    return promise;
}

async function buscarEpisodiosWorker(titulo) {
    const tituloResolvido = titulo.trim();
    try {
        const res = await fetch(`${WORKER_URL}/api/anime/episodes?title=${encodeURIComponent(tituloResolvido)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch {
        return { found: false, episodes: [] };
    }
}

async function buscarFilmeRave(titulo) {
    try {
        const res = await fetch(`${WORKER_URL}/api/filmes/get?title=${encodeURIComponent(titulo)}`);
        return await res.json();
    } catch { return { found: false }; }
}

async function buscarSerieRave(titulo) {
    try {
        const res = await fetch(`${WORKER_URL}/api/series/get?title=${encodeURIComponent(titulo)}`);
        return await res.json();
    } catch { return { found: false }; }
}

async function buscarSinopseAnimeTMDB(titulo, { tmdb_id = null } = {}) {
    try {
        if (tmdb_id) {
            const res = await fetch(
                `${WORKER_URL}/api/tmdb?path=/3/tv/${tmdb_id}&language=pt-BR`
            );
            const r = await res.json();
            if (!r || r.success === false) return null;
            return {
                sinopse:       r.overview || '',
                tmdb_id:       r.id,
                nota:          r.vote_average ? r.vote_average.toFixed(1) : '',
                ano:           (r.first_air_date || '').substring(0, 4),
                poster_path:   r.poster_path   || '',
                backdrop_path: r.backdrop_path || '',
                classificacao: '',
            };
        }

        const res = await fetch(
            `${WORKER_URL}/api/tmdb?path=/3/search/tv&language=pt-BR&query=${encodeURIComponent(titulo)}&page=1`
        );
        const data = await res.json();
        const resultado = (data.results || [])[0];
        if (!resultado) return null;
        return {
            sinopse:       resultado.overview || '',
            tmdb_id:       resultado.id,
            nota:          resultado.vote_average ? resultado.vote_average.toFixed(1) : '',
            ano:           (resultado.first_air_date || '').substring(0, 4),
            poster_path:   resultado.poster_path   || '',
            backdrop_path: resultado.backdrop_path || '',
        };
    } catch { return null; }
}

async function buscarSinopseFilmeTMDB(titulo, { tmdb_id = null } = {}) {
    try {
        if (tmdb_id) {
            const res = await fetch(
                `${WORKER_URL}/api/tmdb?path=/3/movie/${tmdb_id}&language=pt-BR`
            );
            const r = await res.json();
            if (!r || r.success === false) return null;
            return {
                sinopse:       r.overview || '',
                tmdb_id:       r.id,
                nota:          r.vote_average ? r.vote_average.toFixed(1) : '',
                ano:           (r.release_date || '').substring(0, 4),
                poster_path:   r.poster_path   || '',
                backdrop_path: r.backdrop_path || '',
                duracao:       r.runtime || '',
            };
        }

        const url  = `${WORKER_URL}/api/tmdb?path=/3/search/movie&language=pt-BR&query=${encodeURIComponent(titulo)}&page=1`;
        const res  = await fetch(url);
        const data = await res.json();
        const resultados = data.results || [];
        if (!resultados.length) return null;

        const tituloNorm = titulo.toLowerCase().replace(/[^a-z0-9]/g, '');
        const melhor = resultados.reduce((best, r) => {
            let score = 0;
            const rt = (r.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const ro = (r.original_title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (rt === tituloNorm || ro === tituloNorm) score += 100;
            else if (rt.includes(tituloNorm) || tituloNorm.includes(rt)) score += 40;
            score += Math.min(10, (r.popularity || 0) / 10);
            return score > (best._score || 0) ? { ...r, _score: score } : best;
        }, {});

        if (!melhor.id) return null;
        return {
            sinopse:       melhor.overview || '',
            tmdb_id:       melhor.id,
            nota:          melhor.vote_average ? melhor.vote_average.toFixed(1) : '',
            ano:           (melhor.release_date || '').substring(0, 4),
            poster_path:   melhor.poster_path   || '',
            backdrop_path: melhor.backdrop_path || '',
        };
    } catch { return null; }
}

async function buscarDetalhesEpisodiosTMDB(tmdbId, temporada) {
    try {
        const res = await fetch(
            `${WORKER_URL}/api/tmdb?path=/3/tv/${tmdbId}/season/${temporada}&language=pt-BR`
        );
        const data = await res.json();
        return data.episodes || [];
    } catch { return []; }
}
