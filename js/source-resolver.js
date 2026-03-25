const SourceResolver = (() => {

    const _DEAD_TTL       = 5 * 60 * 1000;
    const _DEAD_KEY       = 'rfx_dead_links';
    const _PREFETCH_PRE   = 'rfx_pf_';
    const _PREFETCH_TTL   = 2 * 60 * 1000;
    const _HOST_SCORE_KEY = 'rfx_host_scores';
    const _PENDING_SOURCE_JOBS = new Map();
    const _PREFETCH_MEM = new Map();

    const HOST_PRIORITY = {};

    function _preferirHttpsSePossivel(url) {
        const raw = String(url || '').trim();
        if (!raw) return '';

        try {
            const parsed = new URL(raw);
            if (location.protocol === 'https:' && parsed.protocol === 'http:') {
                parsed.protocol = 'https:';
                return parsed.toString();
            }
            return parsed.toString();
        } catch {
            return raw;
        }
    }

    function normalizarUrl(url) {
        return _preferirHttpsSePossivel(url);
    }

    function _assinaturaTexto(input = '') {
        let hash = 2166136261;
        const texto = String(input || '');
        for (let i = 0; i < texto.length; i++) {
            hash ^= texto.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function _assinaturaUrl(url) {
        const normalizada = normalizarUrl(url);
        return normalizada ? _assinaturaTexto(normalizada) : '';
    }

    function _resumoUrl(url) {
        const normalizada = normalizarUrl(url);
        const assinatura = _assinaturaUrl(normalizada);
        if (!normalizada) return assinatura;
        try {
            const parsed = new URL(normalizada);
            return `${parsed.hostname || 'host-desconhecido'}#${assinatura}`;
        } catch {
            return assinatura;
        }
    }

    function _lerDeadMap() {
        try {
            const raw = JSON.parse(sessionStorage.getItem(_DEAD_KEY) || '{}');
            const map = {};
            let alterado = false;
            Object.entries(raw || {}).forEach(([key, value]) => {
                const ts = Number(value || 0);
                if (!ts) return;
                const assinatura = /^[0-9a-z]+$/i.test(key) ? key : _assinaturaUrl(key);
                if (!assinatura) return;
                if (!map[assinatura] || ts > map[assinatura]) map[assinatura] = ts;
                if (assinatura !== key) alterado = true;
            });
            if (alterado) sessionStorage.setItem(_DEAD_KEY, JSON.stringify(map));
            return map;
        } catch {
            return {};
        }
    }

    function _isLightspeedUrl(url) { return false; } catch {
            return false;
        }
    }

    function isUrlValida(url) {
        try {
            const u = new URL(url);
            if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
            if (!u.hostname || u.hostname.length < 4) return false;
            if (/^(127\.|10\.|192\.168\.|0\.0\.0\.0|localhost)/i.test(u.hostname)) return false;
            return true;
        } catch {
            return false;
        }
    }

    function estasMorto(url) {
        try {
            const assinatura = _assinaturaUrl(url);
            if (!assinatura) return false;
            const map = _lerDeadMap();
            const ts = map[assinatura];
            if (!ts) return false;
            if (Date.now() - ts > _DEAD_TTL) {
                delete map[assinatura];
                sessionStorage.setItem(_DEAD_KEY, JSON.stringify(map));
                return false;
            }
            return true;
        } catch {
            return false;
        }
    }

    function marcarMorto(url) {
        try {
            const assinatura = _assinaturaUrl(url);
            if (!assinatura) return;
            const map = _lerDeadMap();
            map[assinatura] = Date.now();
            const keys = Object.keys(map);
            if (keys.length > 300) {
                const oldest = keys.reduce((a, b) => map[a] < map[b] ? a : b);
                delete map[oldest];
            }
            sessionStorage.setItem(_DEAD_KEY, JSON.stringify(map));
        } catch {}
        try {
            if (typeof WORKER_URL !== 'undefined') {
                fetch(`${WORKER_URL}/api/log`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tipo: 'link_morto',
                        detalhe: _resumoUrl(url),
                        contexto: document.title
                    }),
                    keepalive: true,
                }).catch(() => {});
            }
        } catch {}
    }

    function limparMorto(url) {
        try {
            const assinatura = _assinaturaUrl(url);
            if (!assinatura) return;
            const map = _lerDeadMap();
            if (!map[assinatura]) return;
            delete map[assinatura];
            sessionStorage.setItem(_DEAD_KEY, JSON.stringify(map));
        } catch {}
    }

    function _prefetchKey(animeSlug, epIdx) {
        return _PREFETCH_PRE + (animeSlug || 'x') + '_' + epIdx;
    }

    function _pendingJobKey(animeSlug, epIdx) {
        return (animeSlug || 'x') + '_' + epIdx;
    }

    function _normalizarPrefetch(raw) {
        if (!raw) return null;
        if (raw[0] !== '{') return { url: normalizarUrl(raw), ts: 0, sig: _assinaturaUrl(raw) };
        try {
            const parsed = JSON.parse(raw);
            return {
                url: normalizarUrl(parsed?.url || ''),
                sig: String(parsed?.sig || ''),
                ts: Number(parsed?.ts || 0),
            };
        } catch {
            return null;
        }
    }

    function lerPrefetch(animeSlug, epIdx) {
        try {
            const key = _prefetchKey(animeSlug, epIdx);
            const mem = _PREFETCH_MEM.get(key);
            if (mem?.url) {
                const urlMem = normalizarUrl(mem.url);
                const expiradaMem = !!(mem.ts && (Date.now() - mem.ts > _PREFETCH_TTL));
                if (urlMem && !expiradaMem && isUrlValida(urlMem) && !estasMorto(urlMem)) {
                    return urlMem;
                }
                _PREFETCH_MEM.delete(key);
            }
            const raw = sessionStorage.getItem(key) || null;
            const data = _normalizarPrefetch(raw);
            const url = data?.url || '';
            const expirada = !!(data?.ts && (Date.now() - data.ts > _PREFETCH_TTL));
            if (!url || expirada || !isUrlValida(url) || estasMorto(url)) {
                sessionStorage.removeItem(key);
                return null;
            }
            const ts = Number(data?.ts || Date.now());
            _PREFETCH_MEM.set(key, { url, ts });
            sessionStorage.setItem(key, JSON.stringify({
                sig: data?.sig || _assinaturaUrl(url),
                ts,
            }));
            return url;
        } catch {
            return null;
        }
    }

    function salvarPrefetch(animeSlug, epIdx, url) {
        try {
            const key = _prefetchKey(animeSlug, epIdx);
            const normalizada = normalizarUrl(url);
            if (!normalizada) return;
            const ts = Date.now();
            // Mantemos a URL em memória; a sessão guarda só assinatura/TTL.
            _PREFETCH_MEM.set(key, { url: normalizada, ts });
            sessionStorage.setItem(key, JSON.stringify({
                sig: _assinaturaUrl(normalizada),
                ts,
            }));
        } catch {}
    }

    const _hostScores = (() => {
        try {
            return JSON.parse(sessionStorage.getItem(_HOST_SCORE_KEY) || '{}');
        } catch {
            return {};
        }
    })();

    function getHostScore(hostname) {
        const local = _hostScores[hostname] ?? 0;
        const base = HOST_PRIORITY[hostname] || 0;
        return base + local;
    }

    function _penalizarHost(hostname) {
        _hostScores[hostname] = (_hostScores[hostname] || 0) - 1;
        try {
            sessionStorage.setItem(_HOST_SCORE_KEY, JSON.stringify(_hostScores));
        } catch {}
    }

    function coletarCandidatos(ep, isDub, isBoth) {
        const raw = [];
        if (isBoth) {
            const urlP = isDub ? (ep.embed_url || '') : (ep.embed_url_leg || ep.embed_url || '');
            const urlA = isDub ? '' : (ep.embed_url || '');
            if (urlP) raw.push(urlP);
            if (urlA && urlA !== urlP) raw.push(urlA);
        } else {
            const url = ep.embed_url || ep.sources?.[0]?.embed_url || '';
            if (url) raw.push(url);
            (ep.sources || []).forEach((s) => {
                const u = s.embed_url || '';
                if (u) raw.push(u);
            });
        }

        return [...new Set(raw.map(normalizarUrl).filter(Boolean))]
            .sort((a, b) => {
                try {
                    const isMp4A = /\.mp4(\?|$)/i.test(a);
                    const isMp4B = /\.mp4(\?|$)/i.test(b);
                    if (isMp4A && isMp4B) {
                        const qDiff = classificarQualidadeUrl(b).score - classificarQualidadeUrl(a).score;
                        if (qDiff !== 0) return qDiff;
                    }
                    const ha = new URL(a).hostname;
                    const hb = new URL(b).hostname;
                    return getHostScore(hb) - getHostScore(ha);
                } catch {
                    return 0;
                }
            });
    }

    function _statusFalhaDefinitiva(status) {
        // 401 = auth expirada, 403 permanente em alguns CDNs, 404/410 = removido, 400/422/451 = inválido
        return [400, 401, 404, 410, 422, 451].includes(Number(status || 0));
    }

    function _podeFallbackOtimistaLightspeed(result) {
        if (!result || result.ok) return false;
        const status = Number(result.status || 0);
        return status === 0
            || status === 401
            || status === 403
            || status === 405
            || status === 429
            || status >= 500;
    }

    async function verificarUrlDetalhada(url) {
        if (!isUrlValida(url)) {
            return { ok: false, status: 0, method: 'invalid', via: 'local' };
        }

        // 1. Worker check (mais confiável, ignora CORS)
        try {
            const workerRes = await fetch(
                `${WORKER_URL}/api/check-video?url=${encodeURIComponent(url)}`,
                { signal: AbortSignal.timeout(5000) }
            );
            if (workerRes.ok) {
                const data = await workerRes.json();
                return {
                    ok: !!data.ok,
                    status: Number(data.status || 0),
                    method: data.method || 'worker',
                    redirected: !!data.redirected,
                    via: 'worker',
                };
            }
        } catch {}

        // 2. HEAD direto (timeout reduzido para 4s)
        try {
            const res = await fetch(url, {
                method: 'HEAD',
                signal: AbortSignal.timeout(4000),
            });
            // HEAD retornou algo útil
            if (res.status !== 405 && res.status !== 501) {
                return {
                    ok: res.ok || res.status === 206,
                    status: res.status || 0,
                    method: 'HEAD',
                    redirected: res.redirected,
                    via: 'direct',
                };
            }
        } catch {}

        // 3. Fallback GET Range (CDNs que rejeitam HEAD)
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: { Range: 'bytes=0-0' },
                signal: AbortSignal.timeout(5000),
            });
            return {
                ok: res.ok || res.status === 206 || res.status === 200,
                status: res.status || 0,
                method: 'GET-Range',
                redirected: res.redirected,
                via: 'direct',
            };
        } catch {
            return { ok: false, status: 0, method: 'error', via: 'direct' };
        }
    }

    async function verificarUrl(url) {
        const result = await verificarUrlDetalhada(url);
        return !!result.ok;
    }

    function resolverUrlPreview(ep, anime) {
        const isDub = !!anime?._isDub || anime?.tipo === 'dub';
        const isBoth = anime?.tipo === 'both';
        return coletarCandidatos(ep, isDub, isBoth)[0] || '';
    }

    function _tentarUpgradeLightspeed(url) { return null; }
        } catch {}
        return null;
    }

    async function getValidSource(ep, isDub, isBoth) {
        const candidatos = coletarCandidatos(ep, isDub, isBoth);
        if (!candidatos.length) return null;
        let lightspeedFallback = null;

        for (const url of candidatos) {
            const isMp4 = /\.mp4(\?|$)/i.test(url);
            const isLightspeed = _isLightspeedUrl(url);
            if (!isMp4) {
                if (isUrlValida(url)) return url;
                continue;
            }

            const upgradeUrl = _tentarUpgradeLightspeed(url);
            if (upgradeUrl && !estasMorto(upgradeUrl)) {
                const upgradeCheck = await verificarUrlDetalhada(upgradeUrl);
                if (upgradeCheck.ok) {
                    return upgradeUrl;
                }
                if (_statusFalhaDefinitiva(upgradeCheck.status)) {
                    marcarMorto(upgradeUrl);
                }
            }

            const estavaMorto = estasMorto(url);
            if (estavaMorto && !isLightspeed) continue;

            const check = await verificarUrlDetalhada(url);
            if (check.ok) {
                if (estavaMorto) limparMorto(url);
                return url;
            }

            if (isLightspeed) {
                if (_podeFallbackOtimistaLightspeed(check)) {
                    lightspeedFallback = lightspeedFallback || url;
                    continue;
                }
                if (_statusFalhaDefinitiva(check.status)) {
                    marcarMorto(url);
                }
                continue;
            }

            marcarMorto(url);
            try {
                const hostname = new URL(url).hostname;
                _penalizarHost(hostname);
            } catch {}
        }

        if (lightspeedFallback && isUrlValida(lightspeedFallback)) {
            return lightspeedFallback;
        }
        return null;
    }

    function isLightspeedUpgradedUrl(url) {
        try {
            const u = new URL(url);
            return _isLightspeedUrl(url) && /\/720p\.mp4$/i.test(u.pathname);
        } catch {
            return false;
        }
    }

    async function resolverOuPrefetchEpisodio(animeSlug, epIdx, ep, anime) {
        if (!ep) return null;

        const cached = lerPrefetch(animeSlug, epIdx);
        if (cached) return cached;

        const key = _pendingJobKey(animeSlug, epIdx);
        const pending = _PENDING_SOURCE_JOBS.get(key);
        if (pending) return pending;

        const isDub = !!anime?._isDub || anime?.tipo === 'dub';
        const isBoth = anime?.tipo === 'both';

        let job = null;
        job = (async () => {
            const url = await getValidSource(ep, isDub, isBoth);
            if (url) salvarPrefetch(animeSlug, epIdx, url);
            return url;
        })().finally(() => {
            if (_PENDING_SOURCE_JOBS.get(key) === job) {
                _PENDING_SOURCE_JOBS.delete(key);
            }
        });

        _PENDING_SOURCE_JOBS.set(key, job);
        return job;
    }

    async function prefetchEpisodio(animeSlug, ep, epIdx, anime) {
        await resolverOuPrefetchEpisodio(animeSlug, epIdx, ep, anime);
    }

    function preResolverSources(anime, qtd = 2) {
        if (!anime?.episodes) return;
        const slug = typeof slugify === 'function'
            ? slugify(anime.anime_title || '')
            : (anime.anime_title || '').toLowerCase().replace(/\s+/g, '');
        anime.episodes.slice(0, qtd).forEach((ep, i) =>
            prefetchEpisodio(slug, ep, i, anime).catch(() => {})
        );
    }

    function browserPrefetch(url) {
        if (!url || !/\.mp4(\?|$)/i.test(url) || estasMorto(url)) return;
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        link.as = 'video';
        link.dataset.rfxPreload = '1';
        document.head.appendChild(link);
        setTimeout(() => link.remove(), 60_000);
    }

    const _QUALITY_TIERS = [
        { pattern: /blu-?ray|brrip|remux/i, score: 100, label: 'BluRay' },
        { pattern: /web-?dl/i, score: 80, label: 'WEB-DL' },
        { pattern: /web-?rip/i, score: 60, label: 'WEBRip' },
        { pattern: /hdtv|\.hd\./i, score: 40, label: 'HDTV' },
        { pattern: /cam-?rip|hdcam|\.cam\.|\.ts\./i, score: 10, label: 'CAM' },
    ];

    function classificarQualidadeUrl(url) {
        const u = String(url || '').toLowerCase();
        let score = 50;
        let label = 'Desconhecida';

        for (const tier of _QUALITY_TIERS) {
            if (tier.pattern.test(u)) {
                score = tier.score;
                label = tier.label;
                break;
            }
        }

        if (/1080p/i.test(u)) score += 15;
        else if (/720p/i.test(u)) score += 8;
        else if (/480p/i.test(u)) score += 2;

        if (/5\.1/i.test(u)) score += 5;
        else if (/2\.0/i.test(u)) score += 2;

        if (/dual/i.test(u)) score += 4;
        else if (/dublado/i.test(u)) score += 2;

        if (/\.m3u8/i.test(u)) score += 3;

        return { score, label, url };
    }

    function coletarSrcsFilme(item) {
        const srcs = [];
        if (item.video_src) srcs.push(item.video_src);
        let n = 2;
        while (item['video_src' + n]) {
            srcs.push(item['video_src' + n]);
            n++;
        }
        return srcs.filter(Boolean);
    }

    function ordenarSrcsPorQualidade(srcs) {
        const classificados = srcs
            .filter((url) => url && !estasMorto(url))
            .map((url) => classificarQualidadeUrl(url))
            .sort((a, b) => b.score - a.score);
        return classificados;
    }

    // ── Prefetch para filmes ──
    // Usa a mesma infraestrutura de cache/jobs dos animes.
    // Chave: 'filme__<slug>' no índice 0.
    function _slugFilme(titulo) {
        return 'filme__' + (typeof slugify === 'function'
            ? slugify(titulo || '')
            : (titulo || '').toLowerCase().replace(/\W+/g, ''));
    }

    async function prefetchFilme(item) {
        if (!item) return null;
        const slug = _slugFilme(item.titulo || '');
        const cached = lerPrefetch(slug, 0);
        if (cached) return cached;

        const key = _pendingJobKey(slug, 0);
        const pending = _PENDING_SOURCE_JOBS.get(key);
        if (pending) return pending;

        const srcsRaw = coletarSrcsFilme(item);
        const srcsOrdenadas = ordenarSrcsPorQualidade(srcsRaw).map(s => s.url);

        if (!srcsOrdenadas.length) return null;

        const semCors = /$/;  // nenhum domínio especial

        let job = (async () => {
            for (const src of srcsOrdenadas) {
                if (estasMorto(src)) continue;
                const isMp4 = /\.mp4(\?|$)/i.test(src);
                // Embeds e domínios sem CORS não precisam de verificação
                if (!isMp4 || semCors.test(src)) {
                    salvarPrefetch(slug, 0, src);
                    browserPrefetch(src);
                    return src;
                }
                const ok = await verificarUrl(src);
                if (ok) {
                    salvarPrefetch(slug, 0, src);
                    browserPrefetch(src);
                    return src;
                }
                marcarMorto(src);
            }
            return null;
        })().finally(() => {
            if (_PENDING_SOURCE_JOBS.get(key) === job) _PENDING_SOURCE_JOBS.delete(key);
        });

        _PENDING_SOURCE_JOBS.set(key, job);
        return job;
    }

    function lerPrefetchFilme(item) {
        return lerPrefetch(_slugFilme(item?.titulo || ''), 0);
    }

    // ── Prefetch para séries ──
    // Chave: 'serie__<slug>__t<tempIdx>e<epIdx>'
    function _slugSerie(titulo) {
        return 'serie__' + (typeof slugify === 'function'
            ? slugify(titulo || '')
            : (titulo || '').toLowerCase().replace(/\W+/g, ''));
    }

    async function prefetchEpisodioSerie(serie, tempIdx, epIdx) {
        if (!serie) return null;
        const ep = serie.temporadas?.[tempIdx]?.episodios?.[epIdx];
        if (!ep?.video_src) return null;

        const slug = _slugSerie(serie.titulo || '');
        const jobIdx = tempIdx * 10000 + epIdx;
        const cached = lerPrefetch(slug, jobIdx);
        if (cached) return cached;

        const key = _pendingJobKey(slug, jobIdx);
        const pending = _PENDING_SOURCE_JOBS.get(key);
        if (pending) return pending;

        const src = normalizarUrl(ep.video_src);
        if (!src || !isUrlValida(src)) return null;

        let job = (async () => {
            if (estasMorto(src)) return null;
            const isMp4 = /\.mp4(\?|$)/i.test(src);
            const semCors = /$/;  // nenhum domínio especial
            if (!isMp4 || semCors.test(src)) {
                salvarPrefetch(slug, jobIdx, src);
                browserPrefetch(src);
                return src;
            }
            const ok = await verificarUrl(src);
            if (ok) {
                salvarPrefetch(slug, jobIdx, src);
                browserPrefetch(src);
                return src;
            }
            marcarMorto(src);
            return null;
        })().finally(() => {
            if (_PENDING_SOURCE_JOBS.get(key) === job) _PENDING_SOURCE_JOBS.delete(key);
        });

        _PENDING_SOURCE_JOBS.set(key, job);
        return job;
    }

    function lerPrefetchSerie(serie, tempIdx, epIdx) {
        return lerPrefetch(_slugSerie(serie?.titulo || ''), tempIdx * 10000 + epIdx);
    }

    return {
        normalizarUrl,
        isUrlValida,
        estasMorto,
        marcarMorto,
        limparMorto,
        lerPrefetch,
        salvarPrefetch,
        coletarCandidatos,
        verificarUrl,
        verificarUrlDetalhada,
        resolverUrlPreview,
        getValidSource,
        isLightspeedUpgradedUrl,
        resolverOuPrefetchEpisodio,
        prefetchEpisodio,
        preResolverSources,
        browserPrefetch,
        getHostScore,
        classificarQualidadeUrl,
        coletarSrcsFilme,
        ordenarSrcsPorQualidade,
        prefetchFilme,
        lerPrefetchFilme,
        prefetchEpisodioSerie,
        lerPrefetchSerie,
    };
})();
