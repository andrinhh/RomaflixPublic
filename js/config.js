const WORKER_URL = (() => {
    const { hostname, origin, port } = location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || /^192\.168\./.test(hostname)) {
        return `http://${hostname}:${port || 3000}`;
    }
    return origin;
})();

const POSTER_BASE        = String(window.__APP_CONFIG__?.POSTER_BASE_URL || '').replace(/\/+$/, '');
const TMDB_IMG_W500     = 'https://image.tmdb.org/t/p/w342';
const TMDB_IMG_W500_MODAL = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';

const DONATION_RECOMMENDED_KEY = '';
const DONATION_WALLETS = Object.freeze([]);
