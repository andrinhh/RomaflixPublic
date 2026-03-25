const CatalogShared = (() => {
    const STRINGS = {
        genres: 'G\u00eaneros',
        synopsis: 'Sinopse',
        movie: 'Filme',
        series: 'S\u00e9rie',
        anime: 'Anime',
        cast: 'Elenco',
    };

    const UI_LIMITS = {
        genres: 3,
    };

    const GENRE_ALIASES = {
        acao: 'A\u00e7\u00e3o',
        action: 'A\u00e7\u00e3o',
        aventura: 'Aventura',
        adventure: 'Aventura',
        animacao: 'Anima\u00e7\u00e3o',
        animation: 'Anima\u00e7\u00e3o',
        biografia: 'Biografia',
        biography: 'Biografia',
        comedia: 'Com\u00e9dia',
        comedy: 'Com\u00e9dia',
        crime: 'Crime',
        documental: 'Document\u00e1rio',
        documentario: 'Document\u00e1rio',
        documentary: 'Document\u00e1rio',
        drama: 'Drama',
        familia: 'Fam\u00edlia',
        family: 'Fam\u00edlia',
        fantasia: 'Fantasia',
        fantasy: 'Fantasia',
        ficcao: 'Fic\u00e7\u00e3o Cient\u00edfica',
        'ficcao cientifica': 'Fic\u00e7\u00e3o Cient\u00edfica',
        historical: 'Hist\u00f3rico',
        historico: 'Hist\u00f3rico',
        horror: 'Terror',
        magic: 'Magia',
        magia: 'Magia',
        mecha: 'Mecha',
        misterio: 'Mist\u00e9rio',
        musical: 'Musical',
        police: 'Policial',
        policial: 'Policial',
        psicologico: 'Psicol\u00f3gico',
        psychological: 'Psicol\u00f3gico',
        reality: 'Reality',
        romance: 'Romance',
        'sci fi': 'Fic\u00e7\u00e3o Cient\u00edfica',
        'sci-fi': 'Fic\u00e7\u00e3o Cient\u00edfica',
        shounen: 'Shounen',
        'slice of life': 'Slice of Life',
        sobrenatural: 'Sobrenatural',
        supernatural: 'Sobrenatural',
        suspense: 'Suspense',
        terror: 'Terror',
        thriller: 'Suspense',
        western: 'Western',
    };

    function cleanText(value) {
        return String(value ?? '')
            .replace(/\uFEFF/g, '')
            .normalize('NFC')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeGenreKey(value) {
        return cleanText(value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function normalizeGenre(genre) {
        const raw = cleanText(genre);
        if (!raw || /^(?:[AL]\d+|AL\d+)$/i.test(raw)) return null;

        const alias = GENRE_ALIASES[normalizeGenreKey(raw)];
        return alias || raw;
    }

    function normalizeGenres(genres) {
        if (!Array.isArray(genres)) return [];

        const seen = new Set();
        const list = [];

        for (const genre of genres) {
            const normalized = normalizeGenre(genre);
            if (!normalized) continue;

            const key = normalizeGenreKey(normalized);
            if (seen.has(key)) continue;

            seen.add(key);
            list.push(normalized);
        }

        return list;
    }

    function normalizeCatalogItem(item, type = '') {
        const normalized = { ...item };

        if (normalized.titulo) normalized.titulo = cleanText(normalized.titulo);
        if (normalized.anime_title) normalized.anime_title = cleanText(normalized.anime_title);
        if (normalized.poster) normalized.poster = cleanText(normalized.poster);
        if (normalized.poster_local) normalized.poster_local = cleanText(normalized.poster_local);
        if (normalized.classificacao) normalized.classificacao = cleanText(normalized.classificacao);
        if (normalized.tmdb_classificacao) normalized.tmdb_classificacao = cleanText(normalized.tmdb_classificacao);
        if (normalized.tmdb_sinopse) normalized.tmdb_sinopse = cleanText(normalized.tmdb_sinopse);
        if (normalized.generos) normalized.generos = normalizeGenres(normalized.generos);
        normalized._catalogType = type || normalized._catalogType || '';

        return normalized;
    }

    function buildGenreSummary(genres, limit = UI_LIMITS.genres) {
        const all = normalizeGenres(genres);
        const visible = all.slice(0, limit);
        const hiddenCount = Math.max(0, all.length - visible.length);
        const text = hiddenCount > 0
            ? `${visible.join(' \u00B7 ')} \u00B7 +${hiddenCount}`
            : visible.join(' \u00B7 ');

        return {
            all,
            visible,
            hiddenCount,
            text,
            hasValue: visible.length > 0,
        };
    }

    function createMetaItemHTML(text, className = '') {
        const value = cleanText(text);
        if (!value) return '';
        const attr = className ? ` class="${className}"` : '';
        return `<span${attr}>${sanitizarHTML(value)}</span>`;
    }

    function buildMetaInfoHTML({ items = [], genreSummary = null, metaInfoClass = 'meta-info' } = {}) {
        const metaItems = items.filter(Boolean).join('');
        const genreHTML = genreSummary?.hasValue
            ? `<div class="col-lateral modal-detalhes-stack" id="modal-lateral"><p><span class="label-info">${STRINGS.genres}</span><span class="meta-generos-valor">${sanitizarHTML(genreSummary.text)}</span></p></div>`
            : '';

        return `
            <div class="${metaInfoClass}">
                <div class="meta-info-itens">${metaItems}</div>
                ${genreHTML}
            </div>`;
    }

    function buildSynopsisHTML(id, loadingHTML = '<i class="fa-solid fa-spinner fa-spin" style="color:#555"></i>') {
        return `
            <div class="sinopse-bloco">
                <span class="sinopse-label">${STRINGS.synopsis}</span>
                <p class="sinopse-netflix" id="${id}">${loadingHTML}</p>
            </div>`;
    }

    function prependRating(metaRoot, rating) {
        const target = metaRoot?.querySelector('.meta-info-itens');
        if (!target || !rating || target.querySelector('.match')) return;

        const span = document.createElement('span');
        span.className = 'match';
        span.textContent = `\u2B50 ${rating}`;
        target.insertBefore(span, target.firstChild);
    }

    function setMetaText(metaRoot, selector, value) {
        const text = cleanText(value);
        const node = metaRoot?.querySelector(selector);
        if (node && text) node.textContent = text;
    }

    function applyHeaderArtwork(headerEl, { backdropPath = '', posterPath = '', fallbackUrl = '' } = {}) {
        if (!headerEl) return;

        if (backdropPath) {
            headerEl.style.backgroundImage = `url('${TMDB_IMG_ORIGINAL + backdropPath}')`;
            return;
        }

        if (posterPath) {
            headerEl.style.backgroundImage = `url('${TMDB_IMG_W500_MODAL + posterPath}')`;
            return;
        }

        if (fallbackUrl) {
            headerEl.style.backgroundImage = `url('${fallbackUrl}')`;
        }
    }

    function appendCastBlock(anchorEl, cast) {
        if (!anchorEl || !Array.isArray(cast) || !cast.length) return;

        const elencoDiv = document.createElement('div');
        elencoDiv.className = 'elenco-bloco';

        const scrollDiv = document.createElement('div');
        scrollDiv.className = 'elenco-scroll';

        cast.forEach(actor => {
            const card = document.createElement('div');
            card.className = 'ator-card';

            const img = document.createElement('img');
            img.className = 'ator-foto';
            img.loading = 'lazy';
            img.src = actor.profile_path ? TMDB_IMG_W500 + actor.profile_path : '';
            img.alt = actor.nome || '';
            img.onerror = function () { this.style.display = 'none'; };

            const nomeEl = document.createElement('span');
            nomeEl.className = 'ator-nome';
            nomeEl.textContent = actor.nome || '';

            const persEl = document.createElement('span');
            persEl.className = 'ator-personagem';
            persEl.textContent = actor.personagem || '';

            card.appendChild(img);
            card.appendChild(nomeEl);
            card.appendChild(persEl);
            scrollDiv.appendChild(card);
        });

        const titulo = document.createElement('h4');
        titulo.className = 'elenco-titulo';
        titulo.textContent = STRINGS.cast;

        elencoDiv.appendChild(titulo);
        elencoDiv.appendChild(scrollDiv);
        anchorEl.insertAdjacentElement('afterend', elencoDiv);
    }

    return {
        STRINGS,
        UI_LIMITS,
        cleanText,
        normalizeGenre,
        normalizeGenres,
        normalizeCatalogItem,
        buildGenreSummary,
        createMetaItemHTML,
        buildMetaInfoHTML,
        buildSynopsisHTML,
        prependRating,
        setMetaText,
        applyHeaderArtwork,
        appendCastBlock,
    };
})();