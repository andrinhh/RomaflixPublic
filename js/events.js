(function () {
    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    ready(function () {

        document.addEventListener('click', e => {
            const btn = e.target.closest('[data-nav]');
            if (!btn) return;

            const alvo = btn.dataset.nav;
            if (alvo === 'embreve') {
                carregarEmBreve();
            } else if (window.RomaRouter?.navigateToSection) {
                window.RomaRouter.navigateToSection(alvo);
            }

            if (typeof fecharBusca === 'function') fecharBusca();
        });

        document.addEventListener('click', e => {
            const btn = e.target.closest('[data-search]');
            if (!btn) return;
            const termo = btn.dataset.search;
            if (typeof buscarTudo === 'function') buscarTudo(termo);
            const inputEl   = document.getElementById('input-busca');
            const searchBx  = document.getElementById('search-box');
            const searchWrp = document.getElementById('search-wrapper');
            if (inputEl && searchBx && searchWrp) {
                inputEl.value = termo;
                searchBx.classList.add('visivel');
                searchWrp.classList.add('aberto');
            }
        });

        const btnFechar = document.getElementById('modal-close-btn');
        if (btnFechar) {
            btnFechar.addEventListener('click', () => {
                if (typeof fecharModal === 'function') fecharModal();
            });
        }

        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) {
            modalContainer.addEventListener('click', e => {
                if (e.target === modalContainer && typeof fecharModal === 'function') {
                    fecharModal();
                }
            });
        }

    });
})();

// Lazy load search.js na primeira interação com a busca
(function() {
    let _searchLoaded = false;
    function _loadSearch() {
        if (_searchLoaded) return;
        _searchLoaded = true;
        const s = document.createElement('script');
        s.src = '/js/search.js';
        document.head.appendChild(s);
    }
    // Carregar quando o usuário clica no botão de busca ou pressiona /
    const btn = document.getElementById('search-icon-btn');
    if (btn) btn.addEventListener('click', _loadSearch, { once: true, capture: true });
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' || e.key === 'k' && (e.ctrlKey || e.metaKey)) _loadSearch();
    }, { once: true });
    // Pre-load após 3s se o usuário não interagir — para que esteja pronto
    setTimeout(_loadSearch, 0);
})();
