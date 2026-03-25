const _emBreveBuffer = [];
const _emBreveVistos = new Set();
let   _secaoEmBreve  = null;

function _resetEmBreve() {
    _emBreveBuffer.length = 0;
    _emBreveVistos.clear();
    _secaoEmBreve = null;
}

function _criarRowBase(titulo, opts = {}) {
    const secao = document.createElement('section');
    secao.className = 'sessao-info';

    const tituloEl = document.createElement('h2');
    tituloEl.className = 'sessao-titulo';
    tituloEl.textContent = titulo;

    if (opts.count) {
        const badge = document.createElement('span');
        badge.className = 'sessao-titulo-contagem';
        badge.textContent = opts.count;
        tituloEl.appendChild(badge);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'row-wrapper';

    const btnLeft  = document.createElement('button');
    btnLeft.className  = 'row-arrow left';
    btnLeft.setAttribute('aria-label', 'Anterior');
    btnLeft.innerHTML  = '<i class="fa-solid fa-chevron-left"></i>';

    const btnRight = document.createElement('button');
    btnRight.className = 'row-arrow right';
    btnRight.setAttribute('aria-label', 'Próximo');
    btnRight.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';

    const grid = document.createElement('div');
    grid.className = 'grid';

    const scrollAmt = () => grid.clientWidth * 0.78;
    btnLeft.addEventListener('click',  () => grid.scrollBy({ left: -scrollAmt(), behavior: 'smooth' }));
    btnRight.addEventListener('click', () => grid.scrollBy({ left:  scrollAmt(), behavior: 'smooth' }));

    wrapper.append(btnLeft, grid, btnRight);
    secao.append(tituloEl, wrapper);
    return secao;
}

function _criarCardAnimeLocal(item, opts = {}) {
    const card = document.createElement('div');
    card.className = 'card';

    const posterUrl = _posterUrlAnime(item);
    const nome      = item.titulo || '';

    const img = document.createElement('img');
    img.src     = posterUrl;
    img.alt     = nome;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = function() {
        if (this.src.endsWith('.webp')) {
            this.src = this.src.replace('.webp', '.jpg');
        } else {
            this.src = ''; this.style.background = '#1a1a1a';
        }
    };

    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';
    overlay.innerHTML = `
        <div class="card-title-overlay">${sanitizarHTML(nome)}</div>`;

    card.append(img, overlay);

    const tipoBadge = opts.badge || (item.tipo === 'dub' ? 'DUB' : 'LEG');
    const badge = document.createElement('span');
    badge.className = tipoBadge === 'DUB' ? 'badge-dub' : 'badge-leg';
    badge.textContent = tipoBadge;
    card.appendChild(badge);

    card.addEventListener('click', _withHeavy(() => abrirModalAnimeLocal(item)));
    return card;
}

function _criarCardFilmeLocal(item) {
    const card = document.createElement('div');
    card.className = 'card card-disponivel';

    const posterUrl = _posterUrlFilme(item);

    const img = document.createElement('img');
    img.alt     = item.titulo || '';
    img.loading = 'lazy';
    img.style.background = '#1a1a1a';
    img.decoding = 'async';
    if (posterUrl) {
        img.src = posterUrl;
        img.onerror = function() {
            if (this.src.endsWith('.webp')) {
                this.src = this.src.replace('.webp', '.jpg');
            } else {
                this.src = '';
                this.style.background = '#1a1a1a';
            }
        };
    } else {
        img.src = '';
    }

    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';
    overlay.innerHTML = `
        <div class="card-title-overlay">${sanitizarHTML(item.titulo)}</div>`;

    const badge = document.createElement('div');
    badge.className = 'rave-badge';
    badge.innerHTML = '<i class="fa-solid fa-play"></i>';

    card.append(img, overlay, badge);

    card.addEventListener('click', _withHeavy(() => abrirModalFilmeLocal(item)));

    return card;
}

function exibirGridGeneroLocal(titulo, itens, tipo) {
    const main = document.getElementById('main-content');
    main.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'genre-grid-page';

    const header = document.createElement('div');
    header.className = 'genre-page-header';
    header.innerHTML = `
        <h1 class="genre-page-title">${sanitizarHTML(titulo)}</h1>
        <span class="genre-page-count">${itens.length} títulos</span>`;

    const grid = document.createElement('div');
    grid.className = 'genre-card-grid';

    itens.forEach(item => {
        if (tipo === 'anime') grid.appendChild(_criarCardAnimeLocal(item));
        else if (tipo === 'serie') grid.appendChild(_criarCardSerieLocal(item));
        else grid.appendChild(_criarCardFilmeLocal(item));
    });

    wrapper.append(header, grid);
    main.appendChild(wrapper);
    _animarEntradaSecoes(main);
}

function _criarCardSerieLocal(item) {
    const card = document.createElement('div');
    card.className = 'card card-disponivel';

    const posterUrl = typeof _posterUrlSerie === 'function' ? _posterUrlSerie(item) : '';
    const nome      = item.titulo || '';
    const numTemps  = item.temporadas?.length || 1;

    const img = document.createElement('img');
    img.src     = posterUrl;
    img.alt     = nome;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = function() {
        if (this.src.endsWith('.webp')) {
            this.src = this.src.replace('.webp', '.jpg');
        } else {
            this.src = ''; this.style.background = '#1a1a1a';
        }
    };

    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';
    overlay.innerHTML = `
        <div class="card-title-overlay">${sanitizarHTML(nome)}</div>`;

    const badge = document.createElement('span');
    badge.className = 'badge-leg';
    badge.style.background = '#1a6ef5';
    badge.textContent = numTemps > 1 ? `${numTemps}T` : 'SÉRIE';

    card.append(img, overlay, badge);
    card.addEventListener('click', _withHeavy(() => abrirModalSerieLocal(item)));
    return card;
}
