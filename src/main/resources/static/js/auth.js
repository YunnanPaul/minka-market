(() => {
    'use strict';

    const els = {};
    const buttonContent = new WeakMap();

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        cacheElements();
        bindEvents();

        const tab = new URLSearchParams(location.search).get('tab');
        if (tab === 'register') switchTab('register');
        checkCurrentSession();
    }

    function cacheElements() {
        [
            'loginTab', 'registerTab', 'loginSection', 'registerSection',
            'loginForm', 'registerForm', 'loginSubmit', 'registerSubmit',
            'authMessage', 'loginEmail', 'loginPassword', 'registerName',
            'registerEmail', 'registerPhone', 'registerAddress', 'registerPassword'
        ].forEach(id => { els[id] = document.getElementById(id); });
    }

    function bindEvents() {
        els.loginTab.addEventListener('click', () => switchTab('login'));
        els.registerTab.addEventListener('click', () => switchTab('register'));
        els.loginForm.addEventListener('submit', login);
        els.registerForm.addEventListener('submit', register);

        document.querySelectorAll('[data-toggle-password]').forEach(button => {
            button.addEventListener('click', () => togglePassword(button));
        });
    }

    async function checkCurrentSession() {
        try {
            const user = await Api.get('/api/auth/me');
            if (user) redirectAfterAuth(user);
        } catch (_) {
            // La pantalla continúa disponible si la verificación inicial falla.
        }
    }

    function switchTab(tab) {
        const isLogin = tab === 'login';
        els.loginTab.classList.toggle('active', isLogin);
        els.registerTab.classList.toggle('active', !isLogin);
        els.loginTab.setAttribute('aria-selected', String(isLogin));
        els.registerTab.setAttribute('aria-selected', String(!isLogin));
        els.loginTab.tabIndex = isLogin ? 0 : -1;
        els.registerTab.tabIndex = isLogin ? -1 : 0;
        els.loginSection.hidden = !isLogin;
        els.registerSection.hidden = isLogin;
        hideMessage();

        const focusTarget = isLogin ? els.loginEmail : els.registerName;
        requestAnimationFrame(() => focusTarget.focus());
    }

    function togglePassword(button) {
        const input = document.getElementById(button.dataset.togglePassword);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        button.textContent = show ? 'Ocultar' : 'Ver';
        button.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
        input.focus({ preventScroll: true });
    }

    async function login(event) {
        event.preventDefault();
        hideMessage();
        if (!els.loginForm.reportValidity()) return;

        setLoading(els.loginSubmit, true, 'Ingresando…');
        try {
            const user = await Api.post('/api/auth/login', {
                email: els.loginEmail.value.trim(),
                password: els.loginPassword.value
            });
            showMessage('Ingreso correcto. Preparando tu cuenta…', true);
            setTimeout(() => redirectAfterAuth(user), 320);
        } catch (error) {
            showMessage(error.message || 'No se pudo iniciar sesión.');
        } finally {
            setLoading(els.loginSubmit, false);
        }
    }

    async function register(event) {
        event.preventDefault();
        hideMessage();
        if (!els.registerForm.reportValidity()) return;

        const phone = els.registerPhone.value.trim();
        if (!/^[0-9+()\- ]{7,30}$/.test(phone)) {
            showMessage('El teléfono no tiene un formato válido.');
            els.registerPhone.focus();
            return;
        }

        setLoading(els.registerSubmit, true, 'Creando cuenta…');
        try {
            const user = await Api.post('/api/auth/registro', {
                nombreCompleto: els.registerName.value.trim(),
                email: els.registerEmail.value.trim(),
                telefono: phone,
                direccion: els.registerAddress.value.trim(),
                password: els.registerPassword.value
            });
            showMessage('Cuenta creada correctamente. Preparando tu tienda…', true);
            setTimeout(() => redirectAfterAuth(user), 420);
        } catch (error) {
            const fields = error.details?.fieldErrors;
            const detail = fields ? Object.values(fields).join(' ') : error.message;
            showMessage(detail || 'No se pudo crear la cuenta.');
        } finally {
            setLoading(els.registerSubmit, false);
        }
    }

    function redirectAfterAuth(user) {
        const params = new URLSearchParams(location.search);
        const stored = sessionStorage.getItem('minkaReturnTo');
        sessionStorage.removeItem('minkaReturnTo');
        const requested = params.get('return') || stored;
        const fallback = user?.rol === 'ADMIN' ? '/admin' : '/';
        location.href = sameOriginPath(requested) || fallback;
    }

    function sameOriginPath(value) {
        if (!value || !String(value).startsWith('/')) return null;
        try {
            const target = new URL(String(value), location.origin);
            if (target.origin !== location.origin) return null;
            return `${target.pathname}${target.search}${target.hash}`;
        } catch (_) {
            return null;
        }
    }

    function showMessage(message, success = false) {
        els.authMessage.hidden = false;
        els.authMessage.classList.toggle('success', success);
        els.authMessage.textContent = message;
    }

    function hideMessage() {
        els.authMessage.hidden = true;
        els.authMessage.classList.remove('success');
        els.authMessage.textContent = '';
    }

    function setLoading(button, loading, loadingText = '') {
        if (!buttonContent.has(button)) buttonContent.set(button, button.innerHTML);
        button.disabled = loading;
        button.setAttribute('aria-busy', String(loading));
        button.innerHTML = loading
            ? `<span>${escapeHtml(loadingText)}</span><b aria-hidden="true">···</b>`
            : buttonContent.get(button);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }
})();
