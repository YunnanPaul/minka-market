(() => {
    'use strict';

    const ASSET_VERSION = '5.1.0';
    const FALLBACK_PATH = '/images/product-placeholder.svg';
    const FALLBACK = withAssetVersion(FALLBACK_PATH);

    function clean(value) {
        return String(value || '').trim().replaceAll('\\', '/');
    }

    function stripAssetVersion(value) {
        return clean(value)
            .replace(/([?&])v=[^&#]*(?:&|$)/, '$1')
            .replace(/[?&]$/, '');
    }

    function withAssetVersion(value) {
        const raw = stripAssetVersion(value);
        if (!raw.startsWith('/images/')) return raw;
        return `${raw}${raw.includes('?') ? '&' : '?'}v=${ASSET_VERSION}`;
    }

    function isSupportedSource(value, allowBlob = true) {
        const raw = clean(value);
        if (!raw) return false;
        if (/^https?:\/\//i.test(raw)) return true;
        if (allowBlob && /^blob:/i.test(raw)) return true;
        return raw.startsWith('/images/') || raw.startsWith('/uploads/')
            || raw.startsWith('images/') || raw.startsWith('uploads/');
    }

    function normalize(value) {
        let raw = clean(value);
        if (!raw) return FALLBACK;
        if (/^(https?:|blob:)/i.test(raw)) return raw;
        if (raw.startsWith('images/') || raw.startsWith('uploads/')) raw = `/${raw}`;
        if (raw.startsWith('/images/')) return withAssetVersion(raw);
        if (raw.startsWith('/uploads/')) return raw;
        return FALLBACK;
    }

    function productUrl(product) {
        return normalize(product?.imagenUrl);
    }

    function classify(value) {
        const raw = clean(value);
        const normalized = normalize(raw);
        if (!raw || stripAssetVersion(normalized) === FALLBACK_PATH
                || /product-placeholder\.svg(?:[?#].*)?$/i.test(normalized)) {
            return { key: 'fallback', label: 'Respaldo', url: FALLBACK };
        }
        if (/^https?:\/\//i.test(normalized)) return { key: 'remote', label: 'Remota', url: normalized };
        if (/^blob:/i.test(normalized)) return { key: 'preview', label: 'Vista previa', url: normalized };
        if (normalized.startsWith('/uploads/')) return { key: 'upload', label: 'Subida', url: normalized };
        if (normalized.startsWith('/images/')) return { key: 'builtin', label: 'Incluida', url: normalized };
        return { key: 'fallback', label: 'Respaldo', url: FALLBACK };
    }

    function imageContainer(img) {
        return img.closest('.product-image-button, .product-media, .product-modal-image, .cart-item-image, .product-cell, .order-product, .image-preview, .low-stock-item, .hero-product-card');
    }

    function bind(img, value, alt = '') {
        if (!img) return;
        img.dataset.productImage = 'true';
        img.dataset.imageFallback = FALLBACK;
        img.classList.remove('is-loaded', 'is-broken');
        img.classList.add('is-loading');
        imageContainer(img)?.classList.remove('image-ready');
        img.alt = alt || img.alt || 'Imagen de producto';
        img.decoding = 'async';
        const source = normalize(value);
        img.dataset.src = source;
        img.src = source;

        if (img.complete && img.naturalWidth > 0) markLoaded(img);
    }

    function hydrate(root = document) {
        root.querySelectorAll('img[data-product-image]').forEach(img => {
            const source = img.dataset.src || img.getAttribute('src');
            bind(img, source, img.alt);
        });
    }

    function markLoaded(img) {
        img.classList.remove('is-loading');
        img.classList.add('is-loaded');
        imageContainer(img)?.classList.add('image-ready');
    }

    function useFallback(img) {
        const fallback = img.dataset.imageFallback || FALLBACK;
        const current = normalize(img.getAttribute('src'));
        if (stripAssetVersion(current) !== stripAssetVersion(fallback)) {
            img.classList.add('is-broken');
            img.dataset.src = fallback;
            img.src = fallback;
            return;
        }
        img.classList.remove('is-loading');
        img.classList.add('is-broken', 'is-loaded');
        imageContainer(img)?.classList.add('image-ready');
    }

    async function probe(value, timeoutMs = 6000) {
        const raw = clean(value);
        if (!isSupportedSource(raw)) {
            return { ok: false, url: raw, reason: 'invalid-source' };
        }
        const url = normalize(raw);
        return new Promise(resolve => {
            const image = new Image();
            let settled = false;
            const done = result => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(result);
            };
            const timer = setTimeout(() => done({ ok: false, url, reason: 'timeout' }), timeoutMs);
            image.onload = () => done({ ok: true, url, width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => done({ ok: false, url, reason: 'load-error' });
            image.src = url;
        });
    }

    document.addEventListener('load', event => {
        const img = event.target;
        if (img instanceof HTMLImageElement && img.dataset.productImage === 'true') markLoaded(img);
    }, true);

    document.addEventListener('error', event => {
        const img = event.target;
        if (img instanceof HTMLImageElement && img.dataset.productImage === 'true') useFallback(img);
    }, true);

    document.addEventListener('DOMContentLoaded', () => hydrate(document));

    window.MinkaImages = {
        ASSET_VERSION,
        FALLBACK,
        normalize,
        productUrl,
        classify,
        isSupportedSource,
        bind,
        hydrate,
        probe
    };
})();
