// Progresso de reprodução e Continuar Assistindo
// Separado do player.js para carregar na home sem lazy load

const PROGRESS_KEY = 'rf_progress';

function _salvarProgresso(slug, epIdx, currentTime, duration, meta = {}) {
    if (!slug || !duration || duration < 30) return;
    const percent = currentTime / duration;
    const data = _lerTodoProgresso();
    if (!data[slug]) data[slug] = {};
    data[slug][epIdx] = { t: Math.floor(currentTime), d: Math.floor(duration), p: percent, ts: Date.now(), ...meta };
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(data)); } catch(e) {}
}

function _lerProgresso(slug, epIdx) {
    const data = _lerTodoProgresso();
    return data[slug]?.[epIdx] || null;
}

function _lerTodoProgresso() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch(e) { return {}; }
}

function _limparProgressoConcluido(slug, epIdx) {
    const data = _lerTodoProgresso();
    if (data[slug]?.[epIdx]) {
        delete data[slug][epIdx];
        try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(data)); } catch(e) {}
    }
}

function _getAnimeBySlug(slug) {
    const allAnimes = typeof _animesComEpisodios === 'function' ? _animesComEpisodios() : (_localAnimeDB || []);
    return allAnimes.find(a => {
        // Normalizar removendo Dublado/Dub igual ao que _animeSlugAtual faz ao salvar
        const titulo = (a.anime_title || a._nomeExibicao || a.titulo || '')
            .replace(/\s*(dublado|dub)\s*/gi, '').trim();
        const s = typeof slugify === 'function'
            ? slugify(titulo)
            : titulo.toLowerCase().replace(/\W/g, '');
        return s === slug;
    }) || null;
}

function getContinuarAssistindo() {
    const data = _lerTodoProgresso();
    const byContent = {};
    for (const [slug, eps] of Object.entries(data)) {
        for (const [epIdx, prog] of Object.entries(eps)) {
            if (prog.p >= 0.95) continue;
            let contentKey;
            if (prog.tipo === 'serie') {
                contentKey = 'serie:' + (prog.serieSlug || slug);
            } else if (prog.tipo === 'filme') {
                contentKey = 'filme:' + (prog.filmeNome || slug);
            } else {
                contentKey = 'anime:' + slug;
            }
            const item = { slug, epIdx: parseInt(epIdx), prog };
            if (!byContent[contentKey] || prog.ts > byContent[contentKey].prog.ts) {
                byContent[contentKey] = item;
            }
        }
    }
    const items = Object.values(byContent);
    items.sort((a, b) => b.prog.ts - a.prog.ts);
    return items.slice(0, 20);
}

function renderContinuarAssistindo(container) {
    const items = getContinuarAssistindo();
    if (!items.length) return null;

    const secao = document.createElement('div');
    secao.className = 'sessao-info continuar-assistindo-secao';
    secao.id = 'secao-continuar-assistindo';

    const tituloEl = document.createElement('h2');
    tituloEl.className = 'sessao-titulo';
    tituloEl.textContent = '▶ Continuar Assistindo';

    const wrapper = document.createElement('div');
    wrapper.className = 'row-wrapper';

    const btnLeft = document.createElement('button');
    btnLeft.className = 'row-arrow left';
    btnLeft.setAttribute('aria-label', 'Anterior');
    btnLeft.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';

    const btnRight = document.createElement('button');
    btnRight.className = 'row-arrow right';
    btnRight.setAttribute('aria-label', 'Próximo');
    btnRight.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';

    const grid = document.createElement('div');
    grid.className = 'grid continuar-grid';
    grid.id = 'grid-continuar';

    const scrollAmt = () => grid.clientWidth * 0.78;
    btnLeft.addEventListener('click',  () => grid.scrollBy({ left: -scrollAmt(), behavior: 'smooth' }));
    btnRight.addEventListener('click', () => grid.scrollBy({ left:  scrollAmt(), behavior: 'smooth' }));

    wrapper.append(btnLeft, grid, btnRight);
    secao.append(tituloEl, wrapper);

    items.forEach(({ slug, epIdx, prog }) => {
        const tipo = prog.tipo || null;
        let titulo, labelEp, thumb, onClickFn;

        if (tipo === 'serie') {
            const serieSlug = prog.serieSlug || '';
            const serie = _localSeriesDB?.find(s => {
                const ss = typeof _slugSerie === 'function' ? _slugSerie(s.titulo) : slugify(s.titulo || '');
                return ss === serieSlug;
            });
            if (!serie) return;
            titulo = serie.titulo || serieSlug;
            labelEp = `T${(prog.tempIdx || 0) + 1} · Ep ${(prog.epIdx || 0) + 1}`;
            thumb = typeof _posterUrlSerie === 'function' ? _posterUrlSerie(serie) : (serie.poster || '');
            onClickFn = () => {
                // Se a série já tem temporadas carregadas (local), usar direto
                if (serie.temporadas?.length) {
                    abrirPlayerEpisodioSerie(serie, prog.tempIdx, prog.epIdx);
                } else {
                    // Catálogo remoto: buscar detalhes antes de abrir
                    buscarSerieRave(serie.titulo).then(detalhe => {
                        if (detalhe?.found && detalhe.temporadas) {
                            Object.assign(serie, detalhe);
                        }
                        abrirPlayerEpisodioSerie(serie, prog.tempIdx || 0, prog.epIdx || 0);
                    });
                }
            };

        } else if (tipo === 'filme') {
            // Busca por tmdb_id primeiro (preciso), fallback para título (compatibilidade)
            const filme = (() => {
                if (!_localFilmesDB) return null;
                if (prog.tmdbId) {
                    // Comparação loose (==) para tolerar número vs string
                    const porTmdb = _localFilmesDB.find(f => f.tmdb_id != null && f.tmdb_id == prog.tmdbId);
                    if (porTmdb) return porTmdb;
                }
                // Fallback: busca por título (entradas antigas sem tmdbId, ou filme sem tmdb_id no banco)
                return typeof _getFilmeLocal === 'function' ? _getFilmeLocal(prog.filmeNome || '') : null;
            })();
            titulo = filme?.titulo || prog.filmeNome || slug;
            labelEp = 'Filme';
            thumb = filme && typeof _posterUrlFilme === 'function' ? _posterUrlFilme(filme) : (filme?.poster || '');
            onClickFn = () => {
                const itemOriginal = filme || null;
                if (prog.videoSrc) abrirPlayerRave(prog.videoSrc, titulo, prog.tmdbId || null, 'movie', [], { itemOriginal });
                else if (itemOriginal && typeof abrirModalFilmeLocal === 'function') abrirModalFilmeLocal(itemOriginal);
            };

        } else {
            const anime = _getAnimeBySlug(slug);
            if (!anime) return;
            const todosEps = anime.episodios || anime.episodes || [];
            const ep = todosEps[epIdx];
            // Usar dados do prog como fallback quando episódios não estão no índice
            titulo = anime._nomeExibicao || anime.anime_title || anime.titulo || slug;
            labelEp = ep?.episode_name || ep?.nome || ('Episódio ' + (epIdx + 1));
            thumb = ep?.thumbnail || (typeof _posterUrlAnime === 'function' ? _posterUrlAnime(anime) : (anime.poster || ''));
            onClickFn = () => {
                if (todosEps.length) {
                    // Episódios disponíveis no índice local — usar direto
                    const isDub = anime.tipo === 'dub';
                    const animeData = {
                        found: true,
                        episodes: todosEps.map((ep, i) => {
                            const srcs = [];
                            if (ep.video_src) srcs.push({ embed_url: ep.video_src });
                            let n = 2;
                            while (ep[`video_src${n}`]) { srcs.push({ embed_url: ep[`video_src${n}`] }); n++; }
                            return { episode_name: ep.episode_name || ep.nome || ('Episódio ' + (ep.episodio || i + 1)), embed_url: ep.video_src || '', sources: srcs };
                        }),
                        anime_title: titulo,
                        _nomeExibicao: titulo,
                        _isDub: isDub,
                        tipo: anime.tipo,
                        poster: anime.poster,
                    };
                    AppStore.setAnimeAtual(animeData);
                    AppStore.set('itemAnimeAtual', anime);
                    abrirPlayerAnime(epIdx, titulo, anime._tmdbIdReal || anime._tmdbId || null);
                } else {
                    // Catálogo remoto: abrir modal do anime para carregar episódios
                    if (typeof abrirModalAnimeLocal === 'function') abrirModalAnimeLocal(anime);
                }
            };
        }

        const percent = Math.min(100, Math.round(prog.p * 100));
        const card = document.createElement('div');
        card.className = 'card continuar-card';
        card.innerHTML = `
            <div class="continuar-thumb" style="${thumb ? "background-image:url('" + thumb + "')" : 'background:#1a1a1a'}">
                <div class="continuar-overlay"><i class="fa-solid fa-play"></i></div>
                <div class="continuar-barra"><div class="continuar-progresso" style="width:${percent}%"></div></div>
                <button class="continuar-remover" title="Remover"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="continuar-info">
                <span class="continuar-titulo">${sanitizarHTML(titulo)}</span>
                <span class="continuar-ep">${sanitizarHTML(labelEp)}</span>
            </div>`;
        card.querySelector('.continuar-remover').addEventListener('click', (e) => {
            e.stopPropagation();
            const data = _lerTodoProgresso();
            if (prog.tipo === 'serie') {
                const serieSlug = prog.serieSlug || slug;
                for (const s of Object.keys(data)) {
                    for (const idx of Object.keys(data[s] || {})) {
                        if (data[s][idx]?.tipo === 'serie' && (data[s][idx]?.serieSlug || s) === serieSlug) {
                            delete data[s][idx];
                        }
                    }
                    if (data[s] && !Object.keys(data[s]).length) delete data[s];
                }
            } else if (prog.tipo === 'filme') {
                const filmeNome = prog.filmeNome || slug;
                for (const s of Object.keys(data)) {
                    for (const idx of Object.keys(data[s] || {})) {
                        if (data[s][idx]?.tipo === 'filme' && (data[s][idx]?.filmeNome || s) === filmeNome) {
                            delete data[s][idx];
                        }
                    }
                    if (data[s] && !Object.keys(data[s]).length) delete data[s];
                }
            } else {
                delete data[slug];
            }
            try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(data)); } catch(e) {}
            card.style.transition = 'opacity 0.2s, transform 0.2s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.85)';
            setTimeout(() => {
                card.remove();
                if (!grid.children.length) secao.remove();
            }, 220);
        });
        card.addEventListener('click', onClickFn);
        grid.appendChild(card);
    });

    if (!grid.children.length) return null;
    container.prepend(secao);
    return secao;
}