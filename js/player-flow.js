const PlayerFlow = (() => {
    let _historyCleanup = null;
    let _historyArmed = false;
    let _returnSuppressUntil = 0;
    let _directModalReturnPending = false;

    function _isMobileViewport() {
        return window.matchMedia ? window.matchMedia('(max-width: 768px)').matches : window.innerWidth <= 768;
    }

    function _isTouchViewport() {
        return window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : ((navigator.maxTouchPoints || 0) > 0);
    }

    function _shouldUseHistory() {
        const route = window.RomaRouter?.getCurrentRoute?.();
        return _isMobileViewport() && _isTouchViewport() && !!route?.detail;
    }

    function _markReturnSuppression(ms = 500) {
        _returnSuppressUntil = Date.now() + ms;
    }

    function _isReturnSuppressed() {
        return Date.now() < _returnSuppressUntil;
    }

    function _markDirectModalReturn(path = location.pathname) {
        _directModalReturnPending = true;
        window.RomaRouter?.suppressNextModalOpen?.(path);
    }

    function arm(onBackToModal) {
        _historyCleanup = typeof onBackToModal === 'function' ? onBackToModal : null;
        if (!_shouldUseHistory()) return false;

        const currentState = history.state || {};
        const nextState = {
            ...currentState,
            rfPlayer: true,
        };

        if (currentState.rfPlayer) {
            history.replaceState(nextState, '', location.pathname);
        } else {
            history.pushState(nextState, '', location.pathname);
        }

        _historyArmed = true;
        return true;
    }

    function disarm() {
        _historyCleanup = null;
        _historyArmed = false;
        _directModalReturnPending = false;
    }

    function requestBack(onBackToModal, { directToModal = false } = {}) {
        if (_historyArmed && _shouldUseHistory()) {
            if (directToModal) _markDirectModalReturn(location.pathname);
            history.back();
            return true;
        }

        if (_isReturnSuppressed()) return true;
        if (typeof onBackToModal === 'function') {
            onBackToModal({ fromHistory: false });
        }
        return true;
    }

    window.addEventListener('popstate', () => {
        if (!_historyArmed) return;
        if (history.state?.rfPlayer) return;

        const cleanup = _historyCleanup;
        const directReturnToModal = _directModalReturnPending;
        _markReturnSuppression();
        disarm();

        if (typeof cleanup === 'function') {
            cleanup({ fromHistory: !directReturnToModal });
        }
    });

    return {
        arm,
        disarm,
        markDirectModalReturn: _markDirectModalReturn,
        requestBack,
        shouldUseHistory: _shouldUseHistory,
    };
})();
