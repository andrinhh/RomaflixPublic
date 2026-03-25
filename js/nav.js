// ── Bottom Nav ────────────────────────────────────────────────
const bottomNavItems = document.querySelectorAll('#bottom-nav .bottom-nav-item');

bottomNavItems.forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.dataset.nav;
        if (window.RomaRouter?.navigateToSection) {
            window.RomaRouter.navigateToSection(section);
        }
    });
});

// ── Scroll: header scrolled class + hide-on-scroll (mobile) ──
let _lastScroll = 0;

window.addEventListener('scroll', () => {
    const y = window.scrollY;
    document.getElementById('header')?.classList.toggle('scrolled', y > 40);

    if (window.innerWidth <= 768) {
        const header = document.getElementById('header');
        if (header) {
            const escondendo = y > _lastScroll && y > 100;
            header.style.transform = escondendo ? 'translateY(-100%)' : '';
        }
    }
    _lastScroll = y;
}, { passive: true });

// ── Click fora: fechar busca / sugestões ─────────────────────
document.addEventListener('click', e => {
    const searchWrapEl = document.getElementById('search-wrapper');
    const inputEl      = document.getElementById('input-busca');
    const suggsEl      = document.getElementById('search-suggestions');

    if (searchWrapEl && !searchWrapEl.contains(e.target)) {
        if (!inputEl?.value.trim()) fecharBusca();
        if (suggsEl) suggsEl.classList.remove('visivel');
    }
}, { passive: true });

// ── Escape: fechar modal ou busca ────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modal-container');
        if (modal?.style.display === 'flex') {
            if (typeof fecharModal === 'function') fecharModal();
        } else {
            fecharBusca();
        }
    }
});

// ── Boot ─────────────────────────────────────────────────────
Promise.resolve()
    .then(() => window.RomaRouter?.init?.())
    .catch(err => {
        console.error('[RomaFlix] Falha crítica ao carregar DB:', err);
        const main = document.getElementById('main-content');
        if (main) {
            main.innerHTML = `
                <div class="sem-resultados">
                    <div class="sem-resultados-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <div class="sem-resultados-titulo">Falha ao carregar catálogo</div>
                    <div class="sem-resultados-desc">Verifique sua conexão e tente novamente.</div>
                    <button class="btn-tentar-novamente" onclick="location.reload()">Tentar novamente</button>
                </div>`;
        }
    });

