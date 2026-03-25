const AppStore = (() => {
    const _state = {
        animeAtual: null,
        tituloAtivo: null,
        workerEps: null,
        dubContext: {},
        _navToken: 0,
    };

    const _listeners = {};

    function get(key) {
        return _state[key];
    }

    function set(key, value) {
        _state[key] = value;
        (_listeners[key] || []).forEach(fn => {
            try { fn(value); } catch {}
        });
    }

    function patch(key, partial) {
        const prev = _state[key] || {};
        _state[key] = { ...prev, ...partial };
        (_listeners[key] || []).forEach(fn => {
            try { fn(_state[key]); } catch {}
        });
    }

    function on(key, fn) {
        if (!_listeners[key]) _listeners[key] = [];
        _listeners[key].push(fn);
        return () => {
            _listeners[key] = _listeners[key].filter(f => f !== fn);
        };
    }

    function newNavToken() {
        _state._navToken = Date.now() + Math.random();
        return _state._navToken;
    }

    function isCurrentNavToken(token) {
        return _state._navToken === token;
    }

    function getAnimeAtual() { return _state.animeAtual; }
    function setAnimeAtual(v) { set('animeAtual', v); }
    function getTituloAtivo() { return _state.tituloAtivo; }
    function setTituloAtivo(v) { set('tituloAtivo', v); }
    function getWorkerEps() { return _state.workerEps; }
    function setWorkerEps(v) { set('workerEps', v); }
    function getDubContext() { return _state.dubContext; }
    function setDubContext(k, v) {
        _state.dubContext[k] = v;
    }

    return {
        get, set, patch, on,
        newNavToken, isCurrentNavToken,
        getAnimeAtual, setAnimeAtual,
        getTituloAtivo, setTituloAtivo,
        getWorkerEps, setWorkerEps,
        getDubContext, setDubContext,
    };
})();

Object.defineProperty(window, '_workerEpsAtual', {
    get: () => AppStore.getWorkerEps(),
    set: (v) => AppStore.setWorkerEps(v),
    configurable: true,
});

Object.defineProperty(window, '_dubContext', {
    get: () => AppStore.getDubContext(),
    set: (v) => AppStore.set('dubContext', v || {}),
    configurable: true,
});
