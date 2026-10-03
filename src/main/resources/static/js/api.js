(() => {
    'use strict';

    const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

    class ApiRequestError extends Error {
        constructor(message, status, details = null) {
            super(message);
            this.name = 'ApiRequestError';
            this.status = status;
            this.details = details;
        }
    }

    function readCookie(name) {
        try {
            const prefix = `${name}=`;
            const cookie = document.cookie
                .split(';')
                .map(item => item.trim())
                .find(item => item.startsWith(prefix));
            return cookie ? decodeURIComponent(cookie.substring(prefix.length)) : null;
        } catch (_) {
            return null;
        }
    }

    async function request(url, options = {}) {
        const config = {
            method: 'GET',
            credentials: 'same-origin',
            headers: {},
            ...options
        };
        config.method = String(config.method || 'GET').toUpperCase();
        config.headers = { ...config.headers };

        if (config.body && !(config.body instanceof FormData) && typeof config.body !== 'string') {
            config.headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(config.body);
        }

        if (!SAFE_METHODS.has(config.method)) {
            const csrfToken = readCookie('XSRF-TOKEN');
            if (csrfToken) {
                config.headers['X-XSRF-TOKEN'] = csrfToken;
            }
        }

        let response;
        try {
            response = await fetch(url, config);
        } catch (error) {
            throw new ApiRequestError(
                'No se pudo conectar con el servidor. Verifica que Spring Boot y PostgreSQL estén activos.',
                0,
                { cause: error?.message || String(error) }
            );
        }

        if (response.status === 204) {
            return null;
        }

        const contentType = response.headers.get('content-type') || '';
        const raw = await response.text();
        let payload = raw;

        if (contentType.includes('application/json') && raw) {
            try {
                payload = JSON.parse(raw);
            } catch (_) {
                throw new ApiRequestError(
                    'El servidor devolvió una respuesta JSON incompleta o inválida.',
                    response.status,
                    { raw }
                );
            }
        } else if (!raw) {
            payload = null;
        }

        if (!response.ok) {
            const message = payload?.message || payload || `Error HTTP ${response.status}`;
            throw new ApiRequestError(message, response.status, payload);
        }
        return payload;
    }

    window.Api = {
        request,
        get: (url) => request(url),
        post: (url, body) => request(url, { method: 'POST', body }),
        put: (url, body) => request(url, { method: 'PUT', body }),
        patch: (url, body) => request(url, { method: 'PATCH', body }),
        delete: (url) => request(url, { method: 'DELETE' }),
        upload: (url, formData) => request(url, { method: 'POST', body: formData }),
        ApiRequestError
    };
})();
