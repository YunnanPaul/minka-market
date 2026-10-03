(() => {
    'use strict';

    const state = {
        user: null,
        orders: [],
        query: '',
        status: ''
    };

    const els = {};
    const ACTIVE_STATUSES = new Set(['PENDIENTE', 'PAGADO', 'PREPARANDO', 'LISTO', 'ENVIADO']);
    const PROGRESS_STAGES = [
        { key: 'PENDIENTE', label: 'Recibido' },
        { key: 'PAGADO', label: 'Pago' },
        { key: 'PREPARANDO', label: 'Preparando' },
        { key: 'LISTO', label: 'Despacho' },
        { key: 'ENTREGADO', label: 'Entregado' }
    ];

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        cacheElements();
        bindEvents();

        try {
            state.user = await Api.get('/api/auth/me');
            if (!state.user) {
                redirectLogin();
                return;
            }

            renderIdentity();
            state.orders = await Api.get('/api/pedidos/mios');
            renderAll();
        } catch (error) {
            if (error.status === 401) {
                redirectLogin();
                return;
            }
            els.ordersList.innerHTML = '';
            els.ordersList.setAttribute('aria-busy', 'false');
            showToast('No se pudieron cargar los pedidos', error.message, 'error');
            showEmpty('No fue posible consultar tus compras. Revisa la conexión con el servidor.');
        }
    }

    function cacheElements() {
        [
            'ordersAdminLink', 'ordersLogout', 'ordersUserInitial', 'ordersUserName',
            'ordersGreeting', 'ordersCount', 'ordersTotalSpent', 'ordersActiveCount',
            'orderSearch', 'orderStatusFilter', 'ordersList', 'ordersEmpty',
            'ordersEmptyText', 'toastStack'
        ].forEach(id => { els[id] = document.getElementById(id); });
    }

    function bindEvents() {
        els.ordersLogout.addEventListener('click', logout);
        els.orderSearch.addEventListener('input', () => {
            state.query = normalize(els.orderSearch.value);
            renderOrders();
        });
        els.orderStatusFilter.addEventListener('change', () => {
            state.status = els.orderStatusFilter.value;
            renderOrders();
        });
    }

    function renderIdentity() {
        const firstName = String(state.user.nombreCompleto || 'Cliente').trim().split(/\s+/)[0];
        els.ordersUserName.textContent = firstName;
        els.ordersUserInitial.textContent = firstName.charAt(0).toUpperCase() || 'M';
        els.ordersGreeting.textContent = `Hola, ${firstName}. Aquí puedes consultar el detalle, el pago y el avance de cada compra.`;
        els.ordersAdminLink.hidden = state.user.rol !== 'ADMIN';
    }

    function renderAll() {
        const validOrders = state.orders.filter(Boolean);
        const totalSpent = validOrders
            .filter(order => order.estado !== 'CANCELADO')
            .reduce((sum, order) => sum + Number(order.total || 0), 0);
        const active = validOrders.filter(order => ACTIVE_STATUSES.has(order.estado)).length;

        els.ordersCount.textContent = number(validOrders.length);
        els.ordersTotalSpent.textContent = money(totalSpent);
        els.ordersActiveCount.textContent = number(active);
        renderOrders();
    }

    function renderOrders() {
        const filtered = state.orders.filter(order => {
            if (state.status && order.estado !== state.status) return false;
            if (!state.query) return true;
            const searchable = [
                order.codigo,
                order.estado,
                order.direccionEntrega,
                ...(order.detalles || []).flatMap(item => [item.nombre, item.sku])
            ];
            return searchable.some(value => normalize(value).includes(state.query));
        });

        els.ordersList.setAttribute('aria-busy', 'false');
        if (!filtered.length) {
            els.ordersList.hidden = true;
            showEmpty(state.orders.length
                ? 'No encontramos pedidos que coincidan con el filtro aplicado.'
                : 'Agrega productos al carrito y confirma tu primera compra.');
            return;
        }

        els.ordersEmpty.hidden = true;
        els.ordersList.hidden = false;
        els.ordersList.innerHTML = filtered.map(orderCard).join('');
        MinkaImages?.hydrate(els.ordersList);
    }

    function orderCard(order) {
        const date = formatDate(order.fecha);
        const items = (order.detalles || []).map(item => `
            <div class="order-product">
                <img data-product-image="true" src="${escapeAttr(normalizeImage(item.imagenUrl))}" alt="${escapeAttr(item.nombre)}" loading="lazy" width="62" height="62">
                <div>
                    <h3>${escapeHtml(item.nombre)}</h3>
                    <p>${number(item.cantidad)} × ${money(item.precioUnitario)} · SKU ${escapeHtml(item.sku)}</p>
                </div>
                <strong>${money(item.subtotal)}</strong>
            </div>
        `).join('');

        const payment = order.pago
            ? `${paymentLabel(order.pago.metodo)} · ${paymentStatus(order.pago.estado)}`
            : paymentLabel(order.metodoPago);

        const progress = order.estado === 'CANCELADO'
            ? '<div class="order-cancelled-note">Este pedido fue cancelado. El inventario fue repuesto automáticamente.</div>'
            : progressMarkup(order);

        return `
            <article class="order-card ${order.estado === 'CANCELADO' ? 'cancelled' : ''}">
                <header class="order-card-header">
                    <div class="order-meta"><span>Código</span><strong>${escapeHtml(order.codigo)}</strong><small>${date}</small></div>
                    <div class="order-meta"><span>Entrega y pago</span><strong>${deliveryLabel(order.tipoEntrega)}</strong><small>${escapeHtml(payment)}</small></div>
                    <div><span class="status-pill status-${String(order.estado).toLowerCase()}">${statusLabel(order.estado)}</span></div>
                    <div class="order-total"><span>Total</span><strong>${money(order.total)}</strong></div>
                </header>
                ${progress}
                <div class="order-products">${items || '<div class="order-cancelled-note">El pedido no tiene detalle disponible.</div>'}</div>
                <div class="order-footer-grid">
                    <div class="order-delivery">
                        <b>Destino:</b> ${escapeHtml(order.direccionEntrega || 'No indicado')}<br>
                        <b>Referencia de pago:</b> ${escapeHtml(order.pago?.referencia || 'No disponible')}
                        ${order.observacion ? `<br><b>Observación:</b> ${escapeHtml(order.observacion)}` : ''}
                    </div>
                    <div class="order-breakdown">
                        <div><span>Subtotal</span><b>${money(order.subtotal)}</b></div>
                        <div><span>IGV</span><b>${money(order.igv)}</b></div>
                        <div><span>Envío</span><b>${Number(order.costoEnvio) ? money(order.costoEnvio) : 'Gratis'}</b></div>
                        <div><span>Total</span><b>${money(order.total)}</b></div>
                    </div>
                </div>
            </article>
        `;
    }

    function progressMarkup(order) {
        const currentIndex = progressIndex(order);
        return `
            <div class="order-progress" aria-label="Progreso del pedido">
                ${PROGRESS_STAGES.map((stage, index) => {
                    const done = index < currentIndex;
                    const current = index === currentIndex;
                    return `
                        <div class="order-progress-step ${done ? 'done' : ''} ${current ? 'current' : ''}">
                            <i>${done ? '✓' : index + 1}</i>
                            <span>${stage.label}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function progressIndex(order) {
        switch (order.estado) {
            case 'PENDIENTE': return 0;
            case 'PAGADO': return 1;
            case 'PREPARANDO': return 2;
            case 'LISTO': return 3;
            case 'ENVIADO': return 3;
            case 'ENTREGADO': return 4;
            default: return 0;
        }
    }

    function showEmpty(message) {
        els.ordersEmptyText.textContent = message;
        els.ordersEmpty.hidden = false;
    }

    async function logout() {
        try {
            await Api.post('/api/auth/logout', {});
        } finally {
            location.href = '/';
        }
    }

    function redirectLogin() {
        sessionStorage.setItem('minkaReturnTo', '/mis-pedidos');
        location.href = '/login?return=/mis-pedidos';
    }

    function statusLabel(status) {
        return ({
            PENDIENTE: 'Pendiente',
            PAGADO: 'Pagado',
            PREPARANDO: 'Preparando',
            LISTO: 'Listo para entregar',
            ENVIADO: 'Enviado',
            ENTREGADO: 'Entregado',
            CANCELADO: 'Cancelado'
        })[status] || status;
    }

    function deliveryLabel(value) {
        return value === 'DELIVERY' ? 'Delivery' : 'Recojo en tienda';
    }

    function paymentLabel(value) {
        return ({
            YAPE_PLIN: 'Yape / Plin',
            TARJETA_DEMO: 'Tarjeta demo',
            EFECTIVO: 'Efectivo'
        })[value] || value || 'Sin método';
    }

    function paymentStatus(value) {
        return ({
            APROBADO: 'Aprobado',
            PENDIENTE: 'Pendiente',
            RECHAZADO: 'Rechazado',
            REEMBOLSADO: 'Reembolsado'
        })[value] || value || 'Sin estado';
    }

    function formatDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
        return new Intl.DateTimeFormat('es-PE', {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(date);
    }

    function money(value) {
        return new Intl.NumberFormat('es-PE', {
            style: 'currency',
            currency: 'PEN'
        }).format(Number(value || 0));
    }

    function number(value) {
        return new Intl.NumberFormat('es-PE').format(Number(value || 0));
    }

    function normalizeImage(value) {
        return MinkaImages?.normalize(value) || value || '/images/product-placeholder.svg';
    }

    function normalize(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function escapeAttr(value) {
        return escapeHtml(value).replaceAll('`', '&#096;');
    }

    function showToast(title, message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'success' ? '' : type}`;
        toast.innerHTML = `<span class="toast-icon">${type === 'error' ? '!' : '✓'}</span><div><b>${escapeHtml(title)}</b><p>${escapeHtml(message || '')}</p></div>`;
        els.toastStack.appendChild(toast);
        setTimeout(() => toast.remove(), 4200);
    }
})();
