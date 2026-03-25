let _modalController = null;

function _classeTitulo(nome) {
    const n = (nome || '').length;
    if (n <= 20)  return 'titulo-curto';
    if (n <= 40)  return 'titulo-medio';
    if (n <= 65)  return 'titulo-longo';
    return 'titulo-muito-longo';
}

function _fitTituloModal() {
    const h1 = document.querySelector('.col-principal h1');
    if (!h1) return;
    h1.style.fontSize = '';
    const MIN = 0.7;
    let size = parseFloat(getComputedStyle(h1).fontSize) / 16;
    while (h1.scrollWidth > h1.offsetWidth && size > MIN) {
        size = Math.max(MIN, size - 0.05);
        h1.style.fontSize = size + 'rem';
    }
}

function _buildCatalogMetaHTML({
    ano = '',
    classificacao = '',
    fallbackClassificacao = '',
    classificacaoClass = 'idade',
    generos = [],
    extras = [],
    duracao = '',
} = {}) {
    const duracaoText = duracao ? `${duracao} min` : '';
    return CatalogShared.buildMetaInfoHTML({
        items: [
            CatalogShared.createMetaItemHTML(ano, 'meta-ano'),
            CatalogShared.createMetaItemHTML(classificacao || fallbackClassificacao, classificacaoClass),
            CatalogShared.createMetaItemHTML(duracaoText, 'meta-duracao'),
            ...extras.filter(Boolean),
        ],
        genreSummary: CatalogShared.buildGenreSummary(generos),
    });
}

function _appendElencoAoModal(rootEl, synopsisSelector, cast) {
    const synopsisEl = rootEl?.querySelector(synopsisSelector);
    CatalogShared.appendCastBlock(synopsisEl, cast);
}

function _criarModalToken(dados, prefixo = 'modal') {
    const token = `${prefixo}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    if (dados) dados.dataset.modalToken = token;
    return token;
}

function _modalTokenValido(dados, token) {
    return !!dados && dados.dataset.modalToken === token;
}

function _limparAvisoIndisponibilidade(actionsEl) {
    actionsEl?.querySelector('.modal-indisponivel-alert')?.remove();
}

function _setModalPlayChecking(actionsEl, label = 'Verificando disponibilidade...') {
    const btn = actionsEl?.querySelector('.btn-play-netflix');
    if (!btn) return;
    btn.disabled = true;
    btn.dataset.playState = 'checking';
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${sanitizarHTML(label)}`;
    _limparAvisoIndisponibilidade(actionsEl);
}

function _setModalPlayReady(actionsEl, label = 'Assistir') {
    const btn = actionsEl?.querySelector('.btn-play-netflix');
    if (!btn) return;
    btn.disabled = false;
    btn.dataset.playState = 'ready';
    btn.innerHTML = `<i class="fa-solid fa-play"></i> ${sanitizarHTML(label)}`;
    _limparAvisoIndisponibilidade(actionsEl);
}

function _setModalPlayUnavailable(actionsEl, message = 'Vídeo indisponível no momento.') {
    const btn = actionsEl?.querySelector('.btn-play-netflix');
    if (btn) {
        btn.disabled = true;
        btn.dataset.playState = 'unavailable';
        btn.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Indisponível';
    }
    if (!actionsEl) return;
    let aviso = actionsEl.querySelector('.modal-indisponivel-alert');
    if (!aviso) {
        aviso = document.createElement('div');
        aviso.className = 'modal-indisponivel-alert';
        actionsEl.appendChild(aviso);
    }
    aviso.innerHTML = `
        <i class="fa-solid fa-circle-exclamation"></i>
        <p>${sanitizarHTML(message)}</p>`;
}

function _extrairEpisodiosIniciaisAnime(item) {
    if (Array.isArray(item.temporadas) && item.temporadas.length) {
        const primeiraTemp = item.temporadas.find(t => Array.isArray(t.episodios) && t.episodios.length);
        if (primeiraTemp) return primeiraTemp.episodios;
    }
    return Array.isArray(item.episodios) ? item.episodios : [];
}

function _mapearEpisodioAnime(ep, i) {
    const srcs = [];
    if (ep.video_src) srcs.push({ embed_url: ep.video_src });
    let n = 2;
    while (ep[`video_src${n}`]) {
        srcs.push({ embed_url: ep[`video_src${n}`] });
        n++;
    }
    return {
        episode_name: `Epis\u00f3dio ${ep.episodio || i + 1}`,
        embed_url: ep.video_src || '',
        sources: srcs,
    };
}

function _criarAnimeDataModal(item, nomeAnime, tmdbId = null, episodios = null) {
    const tipo = item.tipo || 'leg';
    const isDub = tipo === 'dub';
    const eps = Array.isArray(episodios) ? episodios : _extrairEpisodiosIniciaisAnime(item);
    if (!eps.length) return null;

    return {
        found: true,
        episodes: eps.map(_mapearEpisodioAnime),
        _epsDub: isDub ? eps.map(_mapearEpisodioAnime) : [],
        anime_title: nomeAnime,
        _nomeExibicao: nomeAnime,
        _isDub: isDub,
        _tmdbIdReal: tmdbId,
        tipo,
    };
}

function _hidratarAnimeItemDoWorker(itemBase, animeData) {
    if (!animeData?.found || !Array.isArray(animeData.episodes) || !animeData.episodes.length) {
        return itemBase;
    }

    // Se o endpoint retornou temporadas separadas, usar diretamente
    if (Array.isArray(animeData.temporadas) && animeData.temporadas.length > 0) {
        const temporadas = animeData.temporadas.map((t) => {
            const episodios = (t.episodios || []).map((ep, index) => {
                const principal = animeData.tipo === 'dub'
                    ? (ep.embed_url || ep.embed_url_leg || '')
                    : (ep.embed_url_leg || ep.embed_url || '');
                const alternativo = animeData.tipo === 'dub'
                    ? (ep.embed_url_leg || '')
                    : (ep.embed_url || '');
                const episodio = { episodio: String(index + 1) };
                if (principal) episodio.video_src = principal;
                if (alternativo && alternativo !== principal) episodio.video_src2 = alternativo;
                return episodio;
            });
            return { temporada: t.temporada || '1', episodios };
        });

        const todosEps = temporadas.flatMap(t => t.episodios);

        return {
            ...itemBase,
            titulo: animeData.anime_title || itemBase.titulo || '',
            tipo: animeData.tipo || itemBase.tipo || 'leg',
            temporadas,
            episodios: todosEps,
        };
    }

    // Fallback: sem temporadas, tudo numa só (compatibilidade)
    const episodios = animeData.episodes.map((ep, index) => {
        const principal = animeData.tipo === 'dub'
            ? (ep.embed_url || ep.embed_url_leg || '')
            : (ep.embed_url_leg || ep.embed_url || '');
        const alternativo = animeData.tipo === 'dub'
            ? (ep.embed_url_leg || '')
            : (ep.embed_url || '');
        const episodio = { episodio: String(index + 1) };
        if (principal) episodio.video_src = principal;
        if (alternativo && alternativo !== principal) episodio.video_src2 = alternativo;
        return episodio;
    });

    return {
        ...itemBase,
        titulo: animeData.anime_title || itemBase.titulo || '',
        tipo: animeData.tipo || itemBase.tipo || 'leg',
        temporadas: [{ temporada: '1', episodios }],
        episodios,
    };
}

function _fecharPlayerParaCatalogo() {
    if (!document.body?.classList.contains('rf-player-open')) return false;

    const modal = document.getElementById('modal-container');
    const dados = document.getElementById('modal-dados');
    const route = window.RomaRouter?.getCurrentRoute?.();
    const state = history.state || {};
    const backgroundPath = String(state.backgroundPath || route?.sectionPath || '/');
    const backgroundRoute = window.RomaRouter?.parseRoute?.(backgroundPath) || { section: 'inicio' };

    if (_modalController) {
        _modalController.abort();
        _modalController = null;
    }

    if (typeof _desarmarHistoricoPlayer === 'function') _desarmarHistoricoPlayer();
    if (typeof _limparPlayerUiBase === 'function') _limparPlayerUiBase({ clearModal: true });

    if (dados) dados.innerHTML = '';
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    AppStore.setAnimeAtual(null);
    AppStore.setTituloAtivo(null);
    AppStore.set('itemAnimeAtual', null);
    AppStore.set('itemFilmeAtual', null);

    history.replaceState({ section: backgroundRoute.section }, '', backgroundPath);
    return true;
}

async function abrirModalAnimeLocal(item, opts = {}) {
    window.RomaRouter?.syncModalRoute('anime', item, opts);

    const modal = document.getElementById('modal-container');
    const dados = document.getElementById('modal-dados');
    const modalToken = _criarModalToken(dados, 'anime');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (_modalController) _modalController.abort();
    _modalController = new AbortController();
    const sinalModal = _modalController.signal;

    let itemAtual = item;
    if ((!Array.isArray(item.temporadas) || !item.temporadas.length) && !(item.episodios || []).length) {
        const animeRemoto = await buscarEpisodiosWorker(item.titulo || '').catch(() => ({ found: false, episodes: [] }));
        itemAtual = _hidratarAnimeItemDoWorker(item, animeRemoto);
    }

    const nome = itemAtual.titulo || '';
    const posterLocal = _posterUrlAnime(itemAtual);
    const tipo = itemAtual.tipo || 'leg';
    const labelBtn = tipo === 'dub' ? 'Assistir (Dub)' : 'Assistir';
    const metaHTML = _buildCatalogMetaHTML({
        ano: itemAtual.ano || '',
        classificacao: itemAtual.classificacao || '',
        fallbackClassificacao: CatalogShared.STRINGS.anime,
        generos: itemAtual.generos || [],
    });

    const botoesHTML = `<button class="btn-play-netflix" id="btn-assistir-anime-inicial">
               <i class="fa-solid fa-play"></i> ${labelBtn}
           </button>`;

    dados.innerHTML = `
        <div class="modal-header-poster modal-header-poster-stream" style="${posterLocal ? `background-image:url('${posterLocal}')` : ''}">
            <div class="modal-gradient-v"></div>
        </div>
        <div class="modal-corpo modal-corpo-stream">
            <div class="col-principal">
                ${metaHTML}
                <h1 class="${_classeTitulo(nome)}">${sanitizarHTML(nome)}</h1>
                <div class="modal-acoes-netflix modal-acoes-netflix-inline" id="modal-acoes-btn">
                    ${botoesHTML}
                </div>
                ${CatalogShared.buildSynopsisHTML('modal-sinopse')}
            </div>
        </div>
        <div id="container-episodios-anime">
            <div class="ep-header"><h2>Epis\u00f3dios</h2></div>
            <div id="lista-ep-anime" style="padding:20px;color:#555">
                <i class="fa-solid fa-spinner fa-spin"></i> Carregando epis\u00f3dios...
            </div>
        </div>`;

    document.getElementById('btn-assistir-anime-inicial')
        ?.addEventListener('click', () => abrirPlayerAnime(0, nome, null, tipo));
    requestAnimationFrame(_fitTituloModal);

    const animeDataInicial = _criarAnimeDataModal(itemAtual, nome, null);
    const actionsAnime = document.getElementById('modal-acoes-btn');
    const btnInicial = document.getElementById('btn-assistir-anime-inicial');
    if (btnInicial) _setModalPlayChecking(actionsAnime, 'Verificando disponibilidade...');
    if (animeDataInicial) {
        AppStore.setAnimeAtual(animeDataInicial);
        AppStore.setTituloAtivo(nome);
        AppStore.set('itemAnimeAtual', itemAtual);
        SourceResolver.preResolverSources(animeDataInicial, 2);
        const slugAnime = typeof slugify === 'function'
            ? slugify(animeDataInicial.anime_title || nome)
            : (animeDataInicial.anime_title || nome || '').toLowerCase().replace(/\W/g, '');
        SourceResolver.resolverOuPrefetchEpisodio(
            slugAnime,
            0,
            animeDataInicial.episodes[0],
            animeDataInicial
        ).then((url) => {
            if (sinalModal.aborted || !_modalTokenValido(dados, modalToken)) return;
            if (url) _setModalPlayReady(actionsAnime, labelBtn);
            else _setModalPlayUnavailable(actionsAnime, 'Vídeo indisponível no momento.');
        }).catch(() => {
            if (sinalModal.aborted || !_modalTokenValido(dados, modalToken)) return;
            _setModalPlayUnavailable(actionsAnime, 'Vídeo indisponível no momento.');
        });
    } else if (btnInicial) {
        _setModalPlayUnavailable(actionsAnime, 'Vídeo indisponível no momento.');
    }

    buscarSinopseAnimeTMDB(nome, { tmdb_id: itemAtual.tmdb_id || null }).then(tmdb => {
        if (sinalModal.aborted || !_modalTokenValido(dados, modalToken)) return;
        const sinopseEl = document.getElementById('modal-sinopse');
        if (sinopseEl) sinopseEl.textContent = tmdb?.sinopse || 'Sinopse n\u00e3o dispon\u00edvel.';

        CatalogShared.prependRating(dados, tmdb?.nota);
        CatalogShared.setMetaText(dados, '.meta-ano', tmdb?.ano);
        CatalogShared.setMetaText(dados, '.idade', tmdb?.classificacao);

        _renderEpisodiosAnimeLocal(itemAtual, tmdb?.tmdb_id || null, nome);
    }).catch(() => {
        if (sinalModal.aborted || !_modalTokenValido(dados, modalToken)) return;
        const sinopseEl = document.getElementById('modal-sinopse');
        if (sinopseEl) sinopseEl.textContent = 'Sinopse n\u00e3o dispon\u00edvel.';
        _renderEpisodiosAnimeLocal(itemAtual, null, nome);
    });
}

async function _renderEpisodiosAnimeLocal(item, tmdbId, nomeAnime) {
    const area = document.getElementById('container-episodios-anime');
    if (!area) return;

    const tipo = item.tipo || 'leg';
    const isDub = tipo === 'dub';

    const todasTemporadas = Array.isArray(item.temporadas) && item.temporadas.length
        ? item.temporadas.filter(t => t.episodios && t.episodios.length > 0)
        : null;
    const episodiosFlat = item.episodios || [];

    if (!todasTemporadas?.length && !episodiosFlat.length) {
        area.innerHTML = '<p style="padding:20px;color:#aaa">Nenhum epis\u00f3dio dispon\u00edvel.</p>';
        return;
    }

    let tempAtiva = todasTemporadas ? todasTemporadas[0].temporada : null;

    function episodiosDaTemp(tmpKey) {
        if (!todasTemporadas) return episodiosFlat;
        const temporada = todasTemporadas.find(t => String(t.temporada) === String(tmpKey));
        return temporada ? temporada.episodios : [];
    }

    function atualizarAnimeData(eps) {
        const animeData = _criarAnimeDataModal(item, nomeAnime, tmdbId, eps);
        if (!animeData) return;
        AppStore.setAnimeAtual(animeData);
        AppStore.setTituloAtivo(nomeAnime);
        AppStore.set('itemAnimeAtual', item);
        SourceResolver.preResolverSources(animeData, 2);
    }

    async function renderEpList(tmpKey) {
        const episodios = episodiosDaTemp(tmpKey);
        atualizarAnimeData(episodios);

        const numTemp = parseInt(tmpKey, 10);
        let tmdbEps = [];
        if (tmdbId && !isNaN(numTemp) && numTemp >= 1) {
            tmdbEps = await buscarDetalhesEpisodiosTMDB(tmdbId, numTemp).catch(() => []);
        }

        const lista = document.getElementById('lista-ep-anime');
        if (!lista) return;
        lista.innerHTML = '';

        episodios.forEach((ep, i) => {
            const tmdbEp = tmdbEps[i] || null;
            const thumb = tmdbEp?.still_path ? TMDB_IMG_W500 + tmdbEp.still_path : '';
            const overview = tmdbEp?.overview || '';
            const epNome = tmdbEp?.name || `Epis\u00f3dio ${ep.episodio || i + 1}`;

            const div = document.createElement('div');
            div.className = 'ep-linha';
            div.dataset.epIdx = i;
            div.innerHTML = `
                <div class="ep-id">${ep.episodio || i + 1}</div>
                <div class="ep-thumb">
                    ${thumb
                        ? `<img src="${thumb}" alt="${sanitizarHTML(epNome)}" loading="lazy">`
                        : `<div style="width:100%;height:100%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-play" style="color:#555"></i></div>`}
                    <div class="play-hover"><i class="fa-solid fa-play"></i></div>
                </div>
                <div class="ep-info-detalhe">
                    <div class="ep-titulo-linha">
                        <h4>${sanitizarHTML(epNome)}</h4>
                    </div>
                    ${overview ? `<p>${sanitizarHTML(overview)}</p>` : ''}
                </div>`;
            div.addEventListener('click', () => abrirPlayerAnime(i, nomeAnime, tmdbId || null));
            lista.appendChild(div);
        });

    }

    const seletorHTML = todasTemporadas && todasTemporadas.length > 1
        ? `<div class="temp-selector" id="temp-selector">
            ${todasTemporadas.map(t => {
                const label = t.temporada === 'Especiais' ? 'Especiais' : `Temporada ${t.temporada}`;
                const ativo = String(t.temporada) === String(tempAtiva) ? ' ativo' : '';
                return `<button class="btn-temp${ativo}" data-temp="${sanitizarHTML(String(t.temporada))}">${label}</button>`;
            }).join('')}
          </div>`
        : '';

    area.innerHTML = `
        <div class="ep-header">
            <h2>Epis\u00f3dios</h2>
            ${seletorHTML}
        </div>
        <div id="lista-ep-anime"></div>`;

    const seletorEl = document.getElementById('temp-selector');
    if (seletorEl) {
        seletorEl.addEventListener('click', async e => {
            const btn = e.target.closest('[data-temp]');
            if (!btn) return;
            const novaTemp = btn.dataset.temp;
            if (novaTemp === String(tempAtiva)) return;
            tempAtiva = novaTemp;
            seletorEl.querySelectorAll('.btn-temp').forEach(b =>
                b.classList.toggle('ativo', b.dataset.temp === String(tempAtiva))
            );
            await renderEpList(tempAtiva);
        });
    }

    await renderEpList(tempAtiva);
}

async function abrirModalFilmeLocal(item, opts = {}) {
    window.RomaRouter?.syncModalRoute('movie', item, opts);

    const modal = document.getElementById('modal-container');
    const dados = document.getElementById('modal-dados');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (_modalController) _modalController.abort();
    _modalController = new AbortController();

    let itemAtual = item;
    if (!SourceResolver.coletarSrcsFilme(itemAtual).length) {
        const filmeRemoto = await buscarFilmeRave(item.titulo || '').catch(() => ({ found: false }));
        if (filmeRemoto?.found) itemAtual = { ...item, ...filmeRemoto };
    }
    AppStore.set('itemFilmeAtual', itemAtual);

    const nomeImediato = itemAtual.titulo || '';
    const metaHTML = _buildCatalogMetaHTML({
        ano: itemAtual.ano || '',
        fallbackClassificacao: CatalogShared.STRINGS.movie,
        generos: itemAtual.generos || [],
        duracao: itemAtual.duracao || itemAtual.runtime || '',
    });

    dados.innerHTML = `
        <div class="modal-header-poster modal-header-poster-stream">
            <div class="modal-gradient-v"></div>
        </div>
        <div class="modal-corpo modal-corpo-stream">
            <div class="col-principal">
                ${metaHTML}
                <h1 class="${_classeTitulo(nomeImediato)}">${sanitizarHTML(nomeImediato)}</h1>
                <div class="modal-acoes-netflix modal-acoes-netflix-inline">
                    <button class="btn-play-netflix" id="btn-assistir-filme" disabled>
                        <i class="fa-solid fa-spinner fa-spin"></i> Carregando...
                    </button>
                </div>
                ${CatalogShared.buildSynopsisHTML('modal-sinopse')}
            </div>
        </div>`;

    const btn = document.getElementById('btn-assistir-filme');
    requestAnimationFrame(_fitTituloModal);

    const todasSrcsRaw = SourceResolver.coletarSrcsFilme(itemAtual);
    const srcsOrdenadas = SourceResolver.ordenarSrcsPorQualidade(todasSrcsRaw);

    if (srcsOrdenadas.length) {
        // Iniciar prefetch em background assim que o modal abre
        const _prefetchFilmeJob = SourceResolver.prefetchFilme(itemAtual).catch(() => null);

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-play"></i> Assistir';
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';

                const srcList = srcsOrdenadas.map(s => s.url);

                // Tentar usar o resultado do prefetch primeiro (pode já estar pronto)
                let srcValida = await Promise.race([
                    _prefetchFilmeJob,
                    new Promise(r => setTimeout(() => r(null), 200)),
                ]);

                // Se prefetch não terminou ainda ou falhou, verificar na hora
                if (!srcValida) {
                    const semCors = /$/;
                    let srcIdx = -1;
                    for (let i = 0; i < srcList.length; i++) {
                        const src = srcList[i];
                        const isMp4 = /\.mp4(\?|$)/i.test(src);
                        if (!isMp4 || semCors.test(src)) {
                            srcValida = src; srcIdx = i; break;
                        }
                        if (SourceResolver.estasMorto(src)) continue;
                        const ok = await SourceResolver.verificarUrl(src);
                        if (ok) { srcValida = src; srcIdx = i; break; }
                        SourceResolver.marcarMorto(src);
                    }
                }

                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-play"></i> Assistir';

                if (srcValida) {
                    const fallbackSrcs = srcList.filter(s => s !== srcValida);
                    abrirPlayerRave(srcValida, nomeImediato, itemAtual?.tmdb_id || null, 'movie', fallbackSrcs, {
                        itemOriginal: itemAtual,
                    });
                } else {
                    btn.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Indispon\u00edvel';
                    btn.style.background = '#555';
                }
            });
        }
    } else if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Indispon\u00edvel';
        btn.style.background = '#555';
    }

    const header = dados.querySelector('.modal-header-poster');
    const localPoster = _posterUrlFilme(itemAtual);
    CatalogShared.applyHeaderArtwork(header, { fallbackUrl: localPoster });

    const tmdbCached = (itemAtual.tmdb_poster_path || itemAtual.tmdb_sinopse || itemAtual.tmdb_rating) ? {
        sinopse: itemAtual.tmdb_sinopse || '',
        nota: itemAtual.tmdb_rating ? String(itemAtual.tmdb_rating) : '',
        ano: itemAtual.tmdb_ano || '',
        classificacao: itemAtual.tmdb_classificacao || '',
        backdrop_path: itemAtual.tmdb_backdrop_path || null,
        poster_path: itemAtual.tmdb_poster_path || null,
        cast: itemAtual.tmdb_cast || [],
    } : null;

    const aplicarDadosTMDB = tmdb => {
        const sinopseEl = document.getElementById('modal-sinopse');
        if (sinopseEl) sinopseEl.textContent = tmdb?.sinopse || 'Sinopse n\u00e3o dispon\u00edvel.';

        CatalogShared.applyHeaderArtwork(dados.querySelector('.modal-header-poster'), {
            backdropPath: tmdb?.backdrop_path || '',
            posterPath: tmdb?.poster_path || '',
            fallbackUrl: localPoster,
        });

        CatalogShared.prependRating(dados, tmdb?.nota);
        CatalogShared.setMetaText(dados, '.meta-ano', tmdb?.ano);
        CatalogShared.setMetaText(dados, '.idade', tmdb?.classificacao);

        _appendElencoAoModal(dados, '#modal-sinopse', tmdb?.cast || []);
    };

    if (tmdbCached) {
        aplicarDadosTMDB(tmdbCached);
    } else {
        buscarSinopseFilmeTMDB(nomeImediato, {
            tmdb_id: itemAtual.tmdb_id || null,
        }).then(tmdb => {
            aplicarDadosTMDB(tmdb ? { ...tmdb, cast: [] } : null);
        }).catch(() => {
            const sinopseEl = document.getElementById('modal-sinopse');
            if (sinopseEl) sinopseEl.textContent = 'Sinopse n\u00e3o dispon\u00edvel.';
        });
    }
}

function fecharModal(opts = {}) {
    if (!opts.skipRouteSync && _fecharPlayerParaCatalogo()) {
        return;
    }

    if (!opts.skipRouteSync && window.RomaRouter?.closeModalRoute?.()) {
        return;
    }

    const modal = document.getElementById('modal-container');
    const dados = document.getElementById('modal-dados');
    if (_modalController) {
        _modalController.abort();
        _modalController = null;
    }
    if (dados) dados.innerHTML = '';
    document.querySelector('.modal-conteudo')?.classList.remove('player-mode');
    modal.style.display = 'none';
    document.body.style.overflow = '';
    AppStore.setAnimeAtual(null);
    AppStore.setTituloAtivo(null);
    AppStore.set('itemAnimeAtual', null);
    AppStore.set('itemFilmeAtual', null);
}