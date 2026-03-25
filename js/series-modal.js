const _serieTMDBCache = new Map();
const _epsTMDBCache = new Map();

function abrirPlayerEpisodioSerie(serie, tempIdx, epIdx, { preserveFullscreen = false } = {}) {
    const temp = serie.temporadas[tempIdx];
    const ep = temp?.episodios?.[epIdx];
    // Usar URL do prefetch se disponível (evita re-verificação)
    const videoSrcCached = typeof SourceResolver?.lerPrefetchSerie === 'function'
        ? SourceResolver.lerPrefetchSerie(serie, tempIdx, epIdx)
        : null;
    const videoSrc = videoSrcCached || ep?.video_src || '';

    // Prefetch do próximo episódio em background
    if (typeof SourceResolver?.prefetchEpisodioSerie === 'function') {
        const totalEpsNext = temp?.episodios?.length || 0;
        if (epIdx + 1 < totalEpsNext) {
            SourceResolver.prefetchEpisodioSerie(serie, tempIdx, epIdx + 1).catch(() => {});
        }
    }
    const nomeSerie = serie.titulo || '';
    const labelEp = `T${temp.temporada} \u00b7 Ep ${ep?.episodio || epIdx + 1}`;
    const totalEps = temp?.episodios?.length || 0;

    if (!videoSrc) {
        const modalDados = document.getElementById('modal-dados');
        if (modalDados) {
            modalDados.innerHTML = `
                <div class="player-erro">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p>Epis\u00f3dio sem fonte de v\u00eddeo dispon\u00edvel.</p>
                    <button id="btn-serie-ep-voltar">\u2190 Voltar</button>
                </div>`;
            document.getElementById('btn-serie-ep-voltar')
                ?.addEventListener('click', () => abrirModalSerieLocal(serie));
        }
        return;
    }

    const _serieSlugCa = typeof _slugSerie === 'function' ? _slugSerie(nomeSerie) : slugify(nomeSerie || '');
    abrirPlayer(videoSrc, { preserveFullscreen,
        titulo: `${nomeSerie} \u00b7 ${labelEp}`,
        progSlug: 'serie__' + _serieSlugCa,
        progEpIdx: tempIdx * 10000 + epIdx,
        progressMeta: { tipo: 'serie', serieSlug: _serieSlugCa, tempIdx, epIdx, poster: serie.poster || '' },
        onVoltar: () => abrirModalSerieLocal(serie),
        onAnterior: epIdx > 0 ? ({ preserveFullscreen } = {}) => abrirPlayerEpisodioSerie(serie, tempIdx, epIdx - 1, { preserveFullscreen }) : null,
        onProximo: epIdx < totalEps - 1 ? ({ preserveFullscreen } = {}) => abrirPlayerEpisodioSerie(serie, tempIdx, epIdx + 1, { preserveFullscreen }) : null,
        labelAnterior: 'Anterior',
        labelProximo: 'Pr\u00f3ximo',
        epIdx,
        totalEps,
    });
}

function _limparTituloSerie(nome) {
    return (nome || '')
        .replace(/^assistir\s+/i, '')
        .replace(/\s+online$/i, '')
        .replace(/\s+gr\u00e1tis$/i, '')
        .trim();
}

async function _buscarTMDBSerie(nome, itemLocal) {
    if (_serieTMDBCache.has(nome)) return _serieTMDBCache.get(nome);

    if (itemLocal && (itemLocal.tmdb_poster_path || itemLocal.tmdb_sinopse)) {
        const cached = {
            sinopse: itemLocal.tmdb_sinopse || '',
            tmdb_id: itemLocal.tmdb_id || null,
            nota: itemLocal.tmdb_rating ? String(itemLocal.tmdb_rating) : '',
            ano: String(itemLocal.ano || ''),
            classificacao: itemLocal.tmdb_classificacao || '',
            poster_path: itemLocal.tmdb_poster_path || '',
            backdrop_path: itemLocal.tmdb_backdrop_path || '',
            cast: itemLocal.tmdb_cast || [],
        };
        _serieTMDBCache.set(nome, cached);
        return cached;
    }

    const nomeClean = _limparTituloSerie(nome);
    const tmdb = typeof buscarSinopseAnimeTMDB === 'function'
        ? await buscarSinopseAnimeTMDB(nomeClean).catch(() => null)
        : null;
    _serieTMDBCache.set(nome, tmdb);
    return tmdb;
}

async function _buscarEpsTMDB(tmdbId, numTemporada) {
    const chave = `${tmdbId}::${numTemporada}`;
    if (_epsTMDBCache.has(chave)) return _epsTMDBCache.get(chave);
    const eps = typeof buscarDetalhesEpisodiosTMDB === 'function'
        ? await buscarDetalhesEpisodiosTMDB(tmdbId, numTemporada).catch(() => [])
        : [];
    _epsTMDBCache.set(chave, eps);
    return eps;
}

async function _verificarDisponibilidadeSerieInicial(videoSrc) {
    const src = String(videoSrc || '').trim();
    if (!src || src === 'source_invalida') return false;

    const resolvida = typeof _resolverVideoSrc === 'function'
        ? await _resolverVideoSrc(src).catch(() => src)
        : src;

    if (!resolvida) return false;
    if (!/^https?:\/\//i.test(resolvida)) return true;

    const detalhe = await SourceResolver.verificarUrlDetalhada(resolvida);
    const status = Number(detalhe.status || 0);
    return !!detalhe.ok || status === 0 || status === 403 || status === 405 || status === 429 || status >= 500;
}

async function abrirModalSerieLocal(item, opts = {}) {
    window.RomaRouter?.syncModalRoute('series', item, opts);

    const modal = document.getElementById('modal-container');
    const dados = document.getElementById('modal-dados');
    const modalToken = typeof _criarModalToken === 'function' ? _criarModalToken(dados, 'serie') : '';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    let itemAtual = item;
    if (!Array.isArray(item.temporadas) || !item.temporadas.length) {
        const serieRemota = await buscarSerieRave(item.titulo || '').catch(() => ({ found: false }));
        if (serieRemota?.found) {
            itemAtual = {
                ...item,
                ...serieRemota,
                poster: item.poster || serieRemota.poster_local || item.poster_local || '',
            };
        }
    }

    const nome = _limparTituloSerie(itemAtual.titulo || '');
    const poster = typeof _posterUrlSerie === 'function' ? _posterUrlSerie(itemAtual) : '';
    const ano = itemAtual.ano || '';
    const numTemps = itemAtual.temporadas?.length || 0;
    const primeiroEp = itemAtual.temporadas?.[0]?.episodios?.[0] || null;
    const temEp = !!primeiroEp;
    const metaHTML = _buildCatalogMetaHTML({
        ano,
        fallbackClassificacao: CatalogShared.STRINGS.series,
        classificacaoClass: 'idade serie-classificacao',
        generos: itemAtual.generos || [],
        extras: [
            numTemps > 1
                ? CatalogShared.createMetaItemHTML(`${numTemps} temporadas`, 'serie-temporadas-total')
                : '',
        ],
    });

    const abasHTML = itemAtual.temporadas.map((t, ti) => `
        <button class="serie-tab-temp ${ti === 0 ? 'ativa' : ''}" data-temp-idx="${ti}">
            T${t.temporada || ti + 1}
        </button>`).join('');

    dados.innerHTML = `
        <div class="modal-header-poster modal-header-poster-stream" style="${poster ? `background-image:url('${poster}')` : ''}">
            <div class="modal-gradient-v"></div>
        </div>
        <div class="modal-corpo modal-corpo-stream">
            <div class="col-principal">
                ${metaHTML}
                <h1 class="${_classeTitulo(nome)}">${sanitizarHTML(nome)}</h1>
                <div class="modal-acoes-netflix modal-acoes-netflix-inline" id="modal-acoes-serie">
                    <button class="btn-play-netflix" id="btn-assistir-serie-inicial" ${temEp ? '' : 'disabled'}>
                        <i class="fa-solid fa-play"></i> Assistir
                    </button>
                </div>
                ${CatalogShared.buildSynopsisHTML('modal-sinopse-serie')}
            </div>
        </div>
        <div id="container-eps-serie">
            <div class="serie-tabs-header">
                <span class="serie-eps-titulo">Epis\u00f3dios</span>
                ${numTemps > 1 ? `<div class="serie-tabs">${abasHTML}</div>` : ''}
            </div>
            <div id="serie-lista-eps">
                <div style="padding:20px;color:#888;display:flex;align-items:center;gap:10px;">
                    <i class="fa-solid fa-spinner fa-spin"></i> Carregando epis\u00f3dios...
                </div>
            </div>
        </div>`;

    document.getElementById('btn-assistir-serie-inicial')
        ?.addEventListener('click', () => abrirPlayerEpisodioSerie(itemAtual, 0, 0));
    requestAnimationFrame(_fitTituloModal);

    const actionsSerie = document.getElementById('modal-acoes-serie');
    if (!temEp) {
        _setModalPlayUnavailable(actionsSerie, 'Vídeo indisponível no momento.');
    } else {
        _setModalPlayChecking(actionsSerie, 'Verificando disponibilidade...');

        // Iniciar prefetch dos primeiros 2 episódios em background
        if (typeof SourceResolver?.prefetchEpisodioSerie === 'function') {
            SourceResolver.prefetchEpisodioSerie(itemAtual, 0, 0).catch(() => {});
            if (itemAtual.temporadas?.[0]?.episodios?.length > 1) {
                SourceResolver.prefetchEpisodioSerie(itemAtual, 0, 1).catch(() => {});
            }
        }

        // Usar prefetch para verificação inicial: se já tiver cache, instantâneo
        const _prefetchSerieJob = typeof SourceResolver?.prefetchEpisodioSerie === 'function'
            ? SourceResolver.prefetchEpisodioSerie(itemAtual, 0, 0)
            : null;

        Promise.race([
            _prefetchSerieJob || Promise.resolve(null),
            _verificarDisponibilidadeSerieInicial(primeiroEp?.video_src || ''),
        ]).then((resultado) => {
            if (typeof _modalTokenValido === 'function' && !_modalTokenValido(dados, modalToken)) return;
            if (resultado) _setModalPlayReady(actionsSerie, 'Assistir');
            else _setModalPlayUnavailable(actionsSerie, 'Vídeo indisponível no momento.');
        }).catch(() => {
            if (typeof _modalTokenValido === 'function' && !_modalTokenValido(dados, modalToken)) return;
            _setModalPlayUnavailable(actionsSerie, 'Vídeo indisponível no momento.');
        });
    }

    dados.querySelectorAll('.serie-tab-temp').forEach(btn => {
        btn.addEventListener('click', () => {
            dados.querySelectorAll('.serie-tab-temp').forEach(b => b.classList.remove('ativa'));
            btn.classList.add('ativa');
            const ti = parseInt(btn.dataset.tempIdx, 10);
            const numTemp = itemAtual.temporadas[ti]?.temporada || ti + 1;
            const tmdbId = itemAtual._tmdbId || null;
            const chave = `${tmdbId}::${numTemp}`;

            if (tmdbId && !_epsTMDBCache.has(chave)) {
                _renderEpisodiosDaTemp(itemAtual, ti, []);
                _buscarEpsTMDB(tmdbId, numTemp).then(eps => _renderEpisodiosDaTemp(itemAtual, ti, eps));
            } else {
                _renderEpisodiosDaTemp(itemAtual, ti, tmdbId ? (_epsTMDBCache.get(chave) || []) : []);
            }
        });
    });

    _buscarTMDBSerie(nome, itemAtual).then(async tmdb => {
        if (typeof _modalTokenValido === 'function' && !_modalTokenValido(dados, modalToken)) return;
        const sinopseEl = document.getElementById('modal-sinopse-serie');
        if (sinopseEl) sinopseEl.textContent = tmdb?.sinopse || 'Sinopse n\u00e3o dispon\u00edvel.';

        _appendElencoAoModal(dados, '#modal-sinopse-serie', tmdb?.cast || []);

        CatalogShared.applyHeaderArtwork(dados.querySelector('.modal-header-poster'), {
            backdropPath: tmdb?.backdrop_path || '',
            posterPath: tmdb?.poster_path || '',
            fallbackUrl: poster,
        });

        CatalogShared.prependRating(dados, tmdb?.nota);
        CatalogShared.setMetaText(dados, '.meta-ano', tmdb?.ano);
        CatalogShared.setMetaText(dados, '.serie-classificacao', tmdb?.classificacao);

        if (tmdb?.tmdb_id) itemAtual._tmdbId = tmdb.tmdb_id;

        const numTemp0 = itemAtual.temporadas[0]?.temporada || 1;
        const epsT0 = tmdb?.tmdb_id ? await _buscarEpsTMDB(tmdb.tmdb_id, numTemp0) : [];
        _renderEpisodiosDaTemp(itemAtual, 0, epsT0);

        if (tmdb?.tmdb_id) {
            for (let ti = 1; ti < itemAtual.temporadas.length; ti++) {
                const nt = itemAtual.temporadas[ti]?.temporada || ti + 1;
                _buscarEpsTMDB(tmdb.tmdb_id, nt);
            }
        }
    }).catch(() => {
        if (typeof _modalTokenValido === 'function' && !_modalTokenValido(dados, modalToken)) return;
        const sinopseEl = document.getElementById('modal-sinopse-serie');
        if (sinopseEl) sinopseEl.textContent = 'Sinopse n\u00e3o dispon\u00edvel.';
        _renderEpisodiosDaTemp(itemAtual, 0, []);
    });
}

function _renderEpisodiosDaTemp(serie, tempIdx, tmdbEps) {
    const lista = document.getElementById('serie-lista-eps');
    if (!lista) return;

    const temp = serie.temporadas[tempIdx];
    const eps = temp?.episodios || [];

    if (!eps.length) {
        lista.innerHTML = '<p style="padding:20px;color:#888">Nenhum epis\u00f3dio dispon\u00edvel.</p>';
        return;
    }

    const tmdbMap = new Map();
    (tmdbEps || []).forEach(e => tmdbMap.set(String(e.episode_number), e));

    lista.innerHTML = '';

    eps.forEach((ep, ei) => {
        const numEp = String(ep.episodio || ei + 1);
        const tmdbEp = tmdbMap.get(numEp) || null;
        const nome = tmdbEp?.name ? sanitizarHTML(tmdbEp.name) : `Epis\u00f3dio ${numEp}`;
        const sinopse = tmdbEp?.overview ? sanitizarHTML(tmdbEp.overview) : '';
        const thumb = tmdbEp?.still_path ? `${TMDB_IMG_W500}${tmdbEp.still_path}` : '';
        const duracao = tmdbEp?.runtime ? `${tmdbEp.runtime} min` : '';

        const div = document.createElement('div');
        div.className = 'ep-linha ep-linha-serie';
        div.style.cssText = 'cursor:pointer;';

        div.innerHTML = `
            <div class="ep-id">${numEp}</div>
            <div class="ep-thumb" style="
                background:#1a1a1a;
                display:flex;align-items:center;justify-content:center;
                min-width:120px;height:68px;border-radius:4px;overflow:hidden;
                flex-shrink:0;position:relative;
                ${thumb ? `background-image:url('${thumb}');background-size:cover;background-position:center;` : ''}
            ">
                <div class="play-hover" style="
                    position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
                    background:rgba(0,0,0,.45);opacity:0;transition:opacity .2s;
                "><i class="fa-solid fa-play" style="font-size:1.3rem;color:#fff;"></i></div>
                ${!thumb ? '<i class="fa-solid fa-play" style="color:#444;font-size:1.2rem;"></i>' : ''}
            </div>
            <div class="ep-info-detalhe" style="flex:1;min-width:0;">
                <div class="ep-titulo-linha" style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
                    <h4 style="margin:0 0 4px;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nome}</h4>
                    ${duracao ? `<span style="font-size:.78rem;color:#888;white-space:nowrap;">${duracao}</span>` : ''}
                </div>
                ${sinopse ? `<p style="margin:0;font-size:.8rem;color:#aaa;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${sinopse}</p>` : ''}
            </div>`;

        const hoverEl = div.querySelector('.play-hover');
        if (hoverEl) {
            div.addEventListener('mouseenter', () => { hoverEl.style.opacity = '1'; });
            div.addEventListener('mouseleave', () => { hoverEl.style.opacity = '0'; });
        }

        div.addEventListener('click', () => abrirPlayerEpisodioSerie(serie, tempIdx, ei));
        lista.appendChild(div);
    });
}