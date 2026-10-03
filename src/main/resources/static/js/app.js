(() => {
    'use strict';

    const state = {
        categories: [],
        products: [],
        cart: null,
        user: null,
        config: {
            storeAddress: 'Av. Los Emprendedores 245, Lima',
            storeSchedule: 'Lun-Dom: 8:00 a 22:00',
            igvRate: 0.18,
            deliveryFee: 5.90,
            freeDeliveryFrom: 80.00
        },
        category: null,
        search: '',
        sort: 'featured',
        selectedProduct: null,
        activeModal: null,
        searchTimer: null,
        catalogRequestId: 0
    };

    const $ = (id) => document.getElementById(id);
    const els = {};
    const modalHideTimers = new WeakMap();

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        cacheElements();
        bindEvents();
        window.addEventListener('scroll', () => els.siteHeader.classList.toggle('scrolled', window.scrollY > 8), { passive: true });

        const initialResults = await Promise.allSettled([
            loadConfiguration(),
            loadUser(),
            loadCategories(),
            loadCart()
        ]);
        if (initialResults[0].status === 'rejected') {
            renderConfiguration();
        }
        if (initialResults[1].status === 'rejected') {
            state.user = null;
            renderUser();
        }
        if (initialResults[2].status === 'rejected') {
            state.categories = fallbackCategories();
            renderCategories();
        }
        if (initialResults[3].status === 'rejected') {
            state.cart = emptyCartModel();
            renderCart();
        }

        try {
            await loadProducts();
        } catch (error) {
            showCatalogError(error);
            showToast('No se pudo cargar el catálogo', readableError(error), 'error');
        }
    }

    function cacheElements() {
        [
            'siteHeader', 'searchForm', 'searchInput', 'clearSearch', 'categoryGrid',
            'productGrid', 'emptyProducts', 'resetCatalogButton', 'resultSummary',
            'catalogError', 'catalogErrorMessage', 'retryCatalogButton',
            'catalogTitle', 'catalogEyebrow', 'activeFilter', 'activeFilterText',
            'clearFilter', 'sortSelect', 'accountButton', 'accountLabel', 'accountMenu',
            'accountMenuUser', 'accountName', 'accountEmail', 'loginMenuItem',
            'myOrdersMenuItem', 'adminMenuItem', 'logoutButton', 'openCartButton',
            'cartBadge', 'overlay', 'cartDrawer', 'closeCartButton', 'cartContent',
            'cartEmpty', 'cartSummary', 'cartSubtotal', 'cartIgv', 'cartTotal',
            'checkoutButton', 'emptyCartButton', 'continueShoppingButton', 'productModal',
            'productModalImage', 'productModalCategory', 'productModalTitle',
            'productModalBrand', 'productModalDescription', 'productModalPrice',
            'productModalOldPrice', 'productModalStock', 'modalQuantity', 'modalMinus',
            'modalPlus', 'modalAddButton', 'checkoutModal', 'checkoutForm',
            'deliveryAddressGroup', 'deliveryAddress', 'orderNotes', 'checkoutSummary',
            'confirmOrderButton', 'orderSuccessModal', 'successOrderCode',
            'successOrderMessage', 'successContinue', 'toastStack',
            'freeDeliveryAnnouncement', 'heroIgvRate', 'storeSchedule', 'storeAddress',
            'cartIgvLabel', 'pickupAddress', 'deliveryFeeText'
        ].forEach(id => { els[id] = $(id); });
    }

    function bindEvents() {
        els.searchForm.addEventListener('submit', (event) => event.preventDefault());
        els.searchInput.addEventListener('input', handleSearchInput);
        els.clearSearch.addEventListener('click', () => setSearch(''));
        els.sortSelect.addEventListener('change', () => {
            state.sort = els.sortSelect.value;
            renderProducts();
        });
        els.clearFilter.addEventListener('click', resetCatalog);
        els.resetCatalogButton.addEventListener('click', resetCatalog);
        els.retryCatalogButton.addEventListener('click', retryCatalog);
        els.categoryGrid.addEventListener('click', handleCategoryClick);
        els.productGrid.addEventListener('click', handleProductGridClick);
        document.querySelectorAll('[data-category]').forEach(button => {
            button.addEventListener('click', () => selectCategory(button.dataset.category));
        });

        els.accountButton.addEventListener('click', toggleAccountMenu);
        els.logoutButton.addEventListener('click', logout);
        document.addEventListener('click', closeAccountMenuOutside);

        els.openCartButton.addEventListener('click', openCart);
        els.closeCartButton.addEventListener('click', () => closeCart());
        els.continueShoppingButton.addEventListener('click', () => closeCart());
        els.emptyCartButton.addEventListener('click', emptyCart);
        els.checkoutButton.addEventListener('click', startCheckout);
        els.cartContent.addEventListener('click', handleCartClick);
        els.cartContent.addEventListener('change', handleCartChange);

        els.overlay.addEventListener('click', closeTopLayer);
        document.querySelectorAll('[data-close-modal]').forEach(button => {
            button.addEventListener('click', () => closeModal(button.closest('.modal')));
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeTopLayer();
        });

        els.modalMinus.addEventListener('click', () => changeModalQuantity(-1));
        els.modalPlus.addEventListener('click', () => changeModalQuantity(1));
        els.modalQuantity.addEventListener('change', normalizeModalQuantity);
        els.modalAddButton.addEventListener('click', addSelectedProduct);

        els.checkoutForm.addEventListener('change', handleCheckoutChoice);
        els.checkoutForm.addEventListener('submit', submitOrder);
        els.successContinue.addEventListener('click', () => closeModal(els.orderSuccessModal));
    }

    async function loadConfiguration() {
        const response = await Api.get('/api/configuracion');
        state.config = {
            ...state.config,
            storeAddress: String(response?.storeAddress || state.config.storeAddress),
            storeSchedule: String(response?.storeSchedule || state.config.storeSchedule),
            igvRate: numberOr(response?.igvRate, state.config.igvRate),
            deliveryFee: numberOr(response?.deliveryFee, state.config.deliveryFee),
            freeDeliveryFrom: numberOr(response?.freeDeliveryFrom, state.config.freeDeliveryFrom)
        };
        renderConfiguration();
    }

    function renderConfiguration() {
        const rate = state.config.igvRate;
        const rateLabel = `${new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(rate * 100)}%`;
        els.freeDeliveryAnnouncement.textContent = `🚚 Delivery gratis desde ${money(state.config.freeDeliveryFrom)}`;
        els.heroIgvRate.textContent = rateLabel;
        els.storeSchedule.textContent = state.config.storeSchedule;
        els.storeAddress.textContent = state.config.storeAddress;
        els.cartIgvLabel.textContent = `IGV (${rateLabel})`;
        els.pickupAddress.textContent = `${state.config.storeAddress} · Sin costo`;
        els.deliveryFeeText.textContent = `${money(state.config.deliveryFee)} o gratis desde ${money(state.config.freeDeliveryFrom)}`;
        if (state.cart) renderCheckoutSummary();
    }

    async function loadUser() {
        state.user = await Api.get('/api/auth/me');
        renderUser();
    }

    function renderUser() {
        const logged = Boolean(state.user);
        els.accountLabel.textContent = logged ? firstName(state.user.nombreCompleto) : 'Ingresar';
        els.accountMenuUser.hidden = !logged;
        els.loginMenuItem.hidden = logged;
        els.myOrdersMenuItem.hidden = !logged;
        els.logoutButton.hidden = !logged;
        els.adminMenuItem.hidden = !(logged && state.user.rol === 'ADMIN');
        if (logged) {
            els.accountName.textContent = state.user.nombreCompleto;
            els.accountEmail.textContent = state.user.email;
            if (!els.deliveryAddress.value) els.deliveryAddress.value = state.user.direccion || '';
        }
    }

    async function loadCategories() {
        const response = await Api.get('/api/categorias');
        state.categories = Array.isArray(response) ? response : fallbackCategories();
        renderCategories();
    }

    function renderCategories() {
        const allCards = [
            { slug: 'destacados', nombre: 'Ofertas y destacados', icono: '✨', descripcion: 'Selección recomendada' },
            ...state.categories
        ];
        els.categoryGrid.innerHTML = allCards.map(category => `
            <button type="button" class="category-card ${state.category === category.slug ? 'active' : ''}" data-category-slug="${escapeAttr(category.slug)}">
                <span class="category-icon" aria-hidden="true">${escapeHtml(category.icono || '🛒')}</span>
                <span><b>${escapeHtml(category.nombre)}</b><small>${escapeHtml(category.descripcion || '')}</small></span>
            </button>
        `).join('');
    }

    async function loadProducts() {
        const requestId = ++state.catalogRequestId;
        setCatalogBusy(true);

        const params = new URLSearchParams();
        if (state.search) params.set('q', state.search);
        if (state.category && state.category !== 'destacados') params.set('categoria', state.category);
        const url = `/api/productos${params.toString() ? `?${params}` : ''}`;

        try {
            let products = await Api.get(url);
            if (requestId !== state.catalogRequestId) return;
            if (!Array.isArray(products)) {
                throw new Error('El servidor devolvió un catálogo con formato inválido.');
            }
            products = products.map(normalizeProduct);
            if (state.category === 'destacados') {
                products = products.filter(product => product.destacado || hasDiscount(product));
            }
            state.products = products;
            hideCatalogError();
            renderProducts();
        } finally {
            if (requestId === state.catalogRequestId) setCatalogBusy(false);
        }
    }

    function renderProducts() {
        const products = sortedProducts(state.products);
        els.emptyProducts.hidden = products.length > 0;
        els.productGrid.hidden = products.length === 0;
        els.resultSummary.textContent = products.length === 1
            ? '1 producto disponible'
            : `${products.length} productos disponibles`;

        els.productGrid.innerHTML = products.map(productCard).join('');
        MinkaImages.hydrate(els.productGrid);
        hideCatalogError();
        updateCatalogHeading(products.length);
    }

    function productCard(product) {
        const onSale = hasDiscount(product);
        const image = MinkaImages.productUrl(product);
        const lowStock = product.stock > 0 && product.stock <= 5;
        const badge = onSale
            ? `<span class="product-badge">OFERTA</span>`
            : lowStock ? `<span class="product-badge low-stock">ÚLTIMAS UNIDADES</span>` : '';
        const stockText = product.stock <= 0
            ? 'Agotado'
            : lowStock ? `Solo ${product.stock} disponibles` : `${product.stock} disponibles`;
        const buttonText = product.stock <= 0 ? 'Sin stock' : '＋ Agregar';

        return `
            <article class="product-card">
                ${badge}
                <button type="button" class="product-image-button" data-view-product="${product.id}" aria-label="Ver ${escapeAttr(product.nombre)}">
                    <img data-product-image="true" data-sku="${escapeAttr(product.sku)}" data-src="${escapeAttr(image)}" src="${escapeAttr(image)}" alt="${escapeAttr(product.nombre)}" loading="lazy" decoding="async">
                </button>
                <div class="product-body">
                    <span class="product-category">${escapeHtml(product.categoria)}</span>
                    <h3>${escapeHtml(product.nombre)}</h3>
                    <p class="brand-line">${escapeHtml(product.marca)} · ${escapeHtml(product.unidadMedida)}</p>
                    <div class="product-price-row">
                        <strong>${money(product.precio)}</strong>
                        ${onSale ? `<del>${money(product.precioAnterior)}</del>` : ''}
                    </div>
                    <span class="product-stock ${lowStock || product.stock <= 0 ? 'low' : ''}">${stockText}</span>
                    <button type="button" class="add-to-cart" data-add-product="${product.id}" ${product.stock <= 0 ? 'disabled' : ''}>${buttonText}</button>
                </div>
            </article>
        `;
    }

    function normalizeProduct(product) {
        const value = product && typeof product === 'object' ? product : {};
        return {
            ...value,
            id: Number(value.id || 0),
            sku: String(value.sku || 'SIN-SKU'),
            nombre: String(value.nombre || 'Producto sin nombre'),
            marca: String(value.marca || 'Minka Market'),
            unidadMedida: String(value.unidadMedida || 'unidad'),
            descripcion: String(value.descripcion || 'Producto disponible en Minka Market.'),
            precio: Number(value.precio || 0),
            precioAnterior: value.precioAnterior == null ? null : Number(value.precioAnterior),
            stock: Math.max(0, Number(value.stock || 0)),
            imagenUrl: MinkaImages.normalize(value.imagenUrl),
            destacado: Boolean(value.destacado),
            activo: value.activo !== false,
            categoria: String(value.categoria || 'General'),
            categoriaSlug: String(value.categoriaSlug || 'general')
        };
    }

    function fallbackCategories() {
        return [
            { slug: 'bebidas', nombre: 'Bebidas', descripcion: 'Agua, jugos y refrescos.', icono: '🥤' },
            { slug: 'lacteos', nombre: 'Lácteos y refrigerados', descripcion: 'Leche, yogur, queso y huevos.', icono: '🥛' },
            { slug: 'despensa', nombre: 'Despensa', descripcion: 'Abarrotes para todos los días.', icono: '🫘' },
            { slug: 'snacks', nombre: 'Snacks', descripcion: 'Galletas, chocolates y piqueos.', icono: '🍪' },
            { slug: 'limpieza', nombre: 'Limpieza', descripcion: 'Cuidado práctico del hogar.', icono: '🧼' },
            { slug: 'cuidado-personal', nombre: 'Cuidado personal', descripcion: 'Higiene para toda la familia.', icono: '🧴' },
            { slug: 'panaderia', nombre: 'Panadería', descripcion: 'Panes y dulces.', icono: '🍞' },
            { slug: 'frescos', nombre: 'Frutas y verduras', descripcion: 'Productos frescos seleccionados.', icono: '🍎' }
        ];
    }

    function emptyCartModel() {
        return { items: [], cantidadTotal: 0, subtotal: 0, igv: 0, total: 0 };
    }

    function hasDiscount(product) {
        return Boolean(product.precioAnterior) && Number(product.precioAnterior) > Number(product.precio);
    }

    function sortedProducts(products) {
        const copy = [...products];
        switch (state.sort) {
            case 'price-asc': return copy.sort((a, b) => Number(a.precio) - Number(b.precio));
            case 'price-desc': return copy.sort((a, b) => Number(b.precio) - Number(a.precio));
            case 'name': return copy.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
            default: return copy.sort((a, b) => Number(b.destacado) - Number(a.destacado) || a.nombre.localeCompare(b.nombre, 'es'));
        }
    }

    function updateCatalogHeading() {
        const category = state.category === 'destacados'
            ? { nombre: 'Ofertas y destacados' }
            : state.categories.find(item => item.slug === state.category);
        if (state.search) {
            els.catalogEyebrow.textContent = 'RESULTADOS DE BÚSQUEDA';
            els.catalogTitle.textContent = `Resultados para “${state.search}”`;
        } else if (category) {
            els.catalogEyebrow.textContent = 'CATEGORÍA SELECCIONADA';
            els.catalogTitle.textContent = category.nombre;
        } else {
            els.catalogEyebrow.textContent = 'CATÁLOGO COMPLETO';
            els.catalogTitle.textContent = 'Productos para tu día a día';
        }

        const filterParts = [];
        if (category) filterParts.push(category.nombre);
        if (state.search) filterParts.push(`Búsqueda: ${state.search}`);
        els.activeFilter.hidden = filterParts.length === 0;
        els.activeFilterText.textContent = filterParts.join(' · ');
    }

    function handleSearchInput() {
        const value = els.searchInput.value.trim();
        els.searchForm.classList.toggle('has-value', value.length > 0);
        clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(() => setSearch(value), 320);
    }

    async function setSearch(value) {
        state.search = value.trim();
        els.searchInput.value = state.search;
        els.searchForm.classList.toggle('has-value', state.search.length > 0);
        await safeLoadProducts();
        if (state.search) document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function handleCategoryClick(event) {
        const button = event.target.closest('[data-category-slug]');
        if (!button) return;
        selectCategory(button.dataset.categorySlug);
    }

    async function selectCategory(slug) {
        state.category = slug || null;
        renderCategories();
        await safeLoadProducts();
        document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function resetCatalog() {
        state.category = null;
        state.search = '';
        els.searchInput.value = '';
        els.searchForm.classList.remove('has-value');
        renderCategories();
        await safeLoadProducts();
    }

    async function safeLoadProducts() {
        try {
            await loadProducts();
        } catch (error) {
            showCatalogError(error);
            showToast('No se pudo actualizar el catálogo', readableError(error), 'error');
        }
    }

    async function retryCatalog() {
        els.retryCatalogButton.disabled = true;
        els.retryCatalogButton.textContent = 'Reintentando...';
        try {
            await loadProducts();
        } catch (error) {
            showCatalogError(error);
            showToast('El catálogo sigue sin responder', readableError(error), 'error');
        } finally {
            els.retryCatalogButton.disabled = false;
            els.retryCatalogButton.textContent = 'Reintentar';
        }
    }

    function showCatalogError(error) {
        state.products = [];
        els.productGrid.innerHTML = '';
        els.productGrid.hidden = true;
        els.emptyProducts.hidden = true;
        els.catalogError.hidden = false;
        els.catalogErrorMessage.textContent = readableError(error);
        els.resultSummary.textContent = 'Catálogo temporalmente no disponible';
    }

    function hideCatalogError() {
        els.catalogError.hidden = true;
    }

    function setCatalogBusy(busy) {
        els.productGrid.setAttribute('aria-busy', String(busy));
        if (busy && !state.products.length) {
            els.catalogError.hidden = true;
            els.emptyProducts.hidden = true;
            els.productGrid.hidden = false;
            els.productGrid.innerHTML = '<div class="product-skeleton"></div><div class="product-skeleton"></div><div class="product-skeleton"></div><div class="product-skeleton"></div>';
        }
    }

    function readableError(error) {
        if (!error) return 'Comprueba que Spring Boot y PostgreSQL estén activos.';
        if (error.status === 500) {
            return 'La consulta del catálogo falló en el servidor. Revisa la consola de Spring Boot y la conexión con PostgreSQL.';
        }
        if (error.status === 404) {
            return 'No se encontró /api/productos. Ejecuta MinkaMarketApplication como Spring Boot App.';
        }
        if (error.status === 0 || error instanceof TypeError) {
            return 'No fue posible comunicarse con Spring Boot. Abre la tienda desde http://localhost:8080.';
        }
        return error.message || 'Comprueba la conexión con PostgreSQL y revisa la consola de Spring Tools.';
    }

    function handleProductGridClick(event) {
        const viewButton = event.target.closest('[data-view-product]');
        if (viewButton) {
            openProduct(Number(viewButton.dataset.viewProduct));
            return;
        }
        const addButton = event.target.closest('[data-add-product]');
        if (addButton) addProduct(Number(addButton.dataset.addProduct), 1, addButton);
    }

    async function openProduct(id) {
        try {
            state.selectedProduct = state.products.find(product => product.id === id) || await Api.get(`/api/productos/${id}`);
            const product = state.selectedProduct;
            MinkaImages.bind(els.productModalImage, product.imagenUrl, product.nombre, product.sku);
            els.productModalCategory.textContent = product.categoria;
            els.productModalTitle.textContent = product.nombre;
            els.productModalBrand.textContent = `${product.marca} · ${product.unidadMedida} · SKU ${product.sku}`;
            els.productModalDescription.textContent = product.descripcion;
            els.productModalPrice.textContent = money(product.precio);
            els.productModalOldPrice.textContent = product.precioAnterior ? money(product.precioAnterior) : '';
            els.productModalOldPrice.hidden = !product.precioAnterior;
            els.productModalStock.textContent = product.stock > 0 ? `${product.stock} unidades disponibles` : 'Producto agotado';
            els.productModalStock.className = `stock-line ${product.stock <= 5 ? 'low' : 'available'}`;
            els.modalQuantity.value = 1;
            els.modalQuantity.max = product.stock;
            els.modalAddButton.disabled = product.stock <= 0;
            els.modalAddButton.textContent = product.stock <= 0 ? 'Producto agotado' : 'Agregar al carrito';
            openModal(els.productModal);
        } catch (error) {
            showToast('No se pudo abrir el producto', error.message, 'error');
        }
    }

    function changeModalQuantity(delta) {
        if (!state.selectedProduct) return;
        const current = Number(els.modalQuantity.value) || 1;
        els.modalQuantity.value = Math.min(state.selectedProduct.stock, Math.max(1, current + delta));
    }

    function normalizeModalQuantity() {
        if (!state.selectedProduct) return;
        const value = Number(els.modalQuantity.value) || 1;
        els.modalQuantity.value = Math.min(state.selectedProduct.stock, Math.max(1, value));
    }

    async function addSelectedProduct() {
        if (!state.selectedProduct) return;
        const added = await addProduct(state.selectedProduct.id, Number(els.modalQuantity.value) || 1, els.modalAddButton);
        if (!added) return;
        closeModal(els.productModal);
        openCart();
    }

    async function addProduct(productId, quantity, button) {
        const original = button?.textContent;
        if (button) {
            button.disabled = true;
            button.textContent = 'Agregando...';
        }
        try {
            state.cart = await Api.post('/api/carrito/items', { productoId: productId, cantidad: quantity });
            renderCart();
            const product = state.products.find(item => item.id === productId);
            showToast('Producto agregado', product?.nombre || 'El producto se agregó al carrito.');
            return true;
        } catch (error) {
            showToast('No se pudo agregar', error.message, 'error');
            return false;
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = original;
            }
        }
    }

    async function loadCart() {
        state.cart = await Api.get('/api/carrito');
        renderCart();
    }

    function renderCart() {
        const cart = state.cart || { items: [], cantidadTotal: 0, subtotal: 0, igv: 0, total: 0 };
        els.cartBadge.textContent = cart.cantidadTotal || 0;
        const empty = !cart.items?.length;
        els.cartEmpty.hidden = !empty;
        els.cartContent.hidden = empty;
        els.cartSummary.hidden = empty;
        if (empty) {
            els.cartContent.innerHTML = '';
            return;
        }

        els.cartContent.innerHTML = cart.items.map(item => `
            <article class="cart-item" data-cart-item="${item.productoId}">
                <div class="cart-item-image"><img data-product-image="true" data-sku="${escapeAttr(item.sku)}" data-src="${escapeAttr(MinkaImages.productUrl({ imagenUrl: item.imagenUrl, sku: item.sku }))}" src="${escapeAttr(MinkaImages.productUrl({ imagenUrl: item.imagenUrl, sku: item.sku }))}" alt="${escapeAttr(item.nombre)}" loading="lazy" decoding="async"></div>
                <div>
                    <h4>${escapeHtml(item.nombre)}</h4>
                    <small>${escapeHtml(item.sku)} · ${money(item.precioUnitario)} c/u</small>
                    <div class="cart-item-actions">
                        <div class="quantity-control">
                            <button type="button" data-cart-delta="-1" aria-label="Restar uno">−</button>
                            <input type="number" min="1" max="${item.stockDisponible}" value="${item.cantidad}" data-cart-quantity aria-label="Cantidad de ${escapeAttr(item.nombre)}">
                            <button type="button" data-cart-delta="1" aria-label="Sumar uno">+</button>
                        </div>
                        <button type="button" class="remove-item" data-remove-cart>Eliminar</button>
                    </div>
                </div>
                <strong class="cart-item-total">${money(item.subtotal)}</strong>
            </article>
        `).join('');
        MinkaImages.hydrate(els.cartContent);
        els.cartSubtotal.textContent = money(cart.subtotal);
        els.cartIgv.textContent = money(cart.igv);
        els.cartTotal.textContent = money(cart.total);
        renderCheckoutSummary();
    }

    function handleCartClick(event) {
        const itemElement = event.target.closest('[data-cart-item]');
        if (!itemElement) return;
        const productId = Number(itemElement.dataset.cartItem);
        if (event.target.closest('[data-remove-cart]')) {
            removeCartItem(productId);
            return;
        }
        const deltaButton = event.target.closest('[data-cart-delta]');
        if (deltaButton) {
            const input = itemElement.querySelector('[data-cart-quantity]');
            const next = Number(input.value) + Number(deltaButton.dataset.cartDelta);
            if (next <= 0) removeCartItem(productId);
            else updateCartQuantity(productId, next);
        }
    }

    function handleCartChange(event) {
        if (!event.target.matches('[data-cart-quantity]')) return;
        const item = event.target.closest('[data-cart-item]');
        const value = Math.max(1, Number(event.target.value) || 1);
        updateCartQuantity(Number(item.dataset.cartItem), value);
    }

    async function updateCartQuantity(productId, quantity) {
        try {
            state.cart = await Api.put(`/api/carrito/items/${productId}`, { cantidad: quantity });
            renderCart();
        } catch (error) {
            showToast('No se pudo actualizar', error.message, 'error');
            await loadCart().catch(() => {});
        }
    }

    async function removeCartItem(productId) {
        try {
            state.cart = await Api.delete(`/api/carrito/items/${productId}`);
            renderCart();
            showToast('Producto eliminado', 'El carrito fue actualizado.');
        } catch (error) {
            showToast('No se pudo eliminar', error.message, 'error');
        }
    }

    async function emptyCart() {
        if (!confirm('¿Deseas vaciar todo el carrito?')) return;
        try {
            state.cart = await Api.delete('/api/carrito');
            renderCart();
        } catch (error) {
            showToast('No se pudo vaciar el carrito', error.message, 'error');
        }
    }

    function openCart() {
        els.accountMenu.hidden = true;
        els.cartDrawer.classList.add('open');
        els.cartDrawer.setAttribute('aria-hidden', 'false');
        showOverlay();
    }

    function closeCart(updateOverlay = true) {
        els.cartDrawer.classList.remove('open');
        els.cartDrawer.setAttribute('aria-hidden', 'true');
        if (updateOverlay) hideOverlayIfIdle();
    }

    function startCheckout() {
        if (!state.cart?.items?.length) return;
        if (!state.user) {
            sessionStorage.setItem('minkaReturnTo', '/');
            location.href = '/login?return=/';
            return;
        }
        closeCart(false);
        els.deliveryAddress.value = state.user.direccion || '';
        handleCheckoutChoice();
        openModal(els.checkoutModal);
    }

    function handleCheckoutChoice() {
        const delivery = selectedRadio('tipoEntrega') === 'DELIVERY';
        els.deliveryAddressGroup.hidden = !delivery;
        els.deliveryAddress.required = delivery;
        renderCheckoutSummary();
    }

    function renderCheckoutSummary() {
        if (!state.cart) return;
        const delivery = selectedRadio('tipoEntrega') === 'DELIVERY';
        const subtotal = Number(state.cart.subtotal || 0);
        const shipping = delivery && subtotal < state.config.freeDeliveryFrom ? state.config.deliveryFee : 0;
        const total = Number(state.cart.total || 0) + shipping;
        els.checkoutSummary.innerHTML = `
            <div><span>Productos</span><b>${state.cart.cantidadTotal || 0}</b></div>
            <div><span>Subtotal</span><b>${money(state.cart.subtotal)}</b></div>
            <div><span>IGV (${new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(state.config.igvRate * 100)}%)</span><b>${money(state.cart.igv)}</b></div>
            <div><span>Envío</span><b>${shipping ? money(shipping) : 'Gratis'}</b></div>
            <div class="checkout-total"><span>Total a registrar</span><b>${money(total)}</b></div>
        `;
    }

    async function submitOrder(event) {
        event.preventDefault();
        const tipoEntrega = selectedRadio('tipoEntrega');
        const metodoPago = selectedRadio('metodoPago');
        const direccionEntrega = els.deliveryAddress.value.trim();
        if (tipoEntrega === 'DELIVERY' && !direccionEntrega) {
            showToast('Falta la dirección', 'Ingresa una dirección para el delivery.', 'warning');
            els.deliveryAddress.focus();
            return;
        }

        setButtonLoading(els.confirmOrderButton, true, 'Registrando pedido...');
        try {
            const order = await Api.post('/api/pedidos', {
                tipoEntrega,
                metodoPago,
                direccionEntrega: tipoEntrega === 'DELIVERY' ? direccionEntrega : null,
                observacion: els.orderNotes.value.trim() || null
            });
            closeModal(els.checkoutModal, false);
            state.cart = { items: [], cantidadTotal: 0, subtotal: 0, igv: 0, total: 0 };
            renderCart();
            els.successOrderCode.textContent = order.codigo;
            els.successOrderMessage.textContent = order.estado === 'PAGADO'
                ? `Pago demo aprobado. Total: ${money(order.total)}.`
                : `Pedido pendiente de pago. Total: ${money(order.total)}.`;
            openModal(els.orderSuccessModal);
            els.checkoutForm.reset();
            if (state.user?.direccion) els.deliveryAddress.value = state.user.direccion;
            await safeLoadProducts();
        } catch (error) {
            if (error.status === 401) {
                state.user = null;
                renderUser();
            }
            showToast('No se pudo registrar el pedido', error.message, 'error');
            await loadCart().catch(() => {});
        } finally {
            setButtonLoading(els.confirmOrderButton, false, 'Confirmar pedido');
        }
    }

    function selectedRadio(name) {
        return els.checkoutForm.querySelector(`input[name="${name}"]:checked`)?.value;
    }

    function toggleAccountMenu(event) {
        event.stopPropagation();
        const willOpen = els.accountMenu.hidden;
        els.accountMenu.hidden = !willOpen;
        els.accountButton.setAttribute('aria-expanded', String(willOpen));
    }

    function closeAccountMenuOutside(event) {
        if (els.accountMenu.hidden) return;
        if (!els.accountMenu.contains(event.target) && !els.accountButton.contains(event.target)) {
            els.accountMenu.hidden = true;
            els.accountButton.setAttribute('aria-expanded', 'false');
        }
    }

    async function logout() {
        try {
            await Api.post('/api/auth/logout', {});
            state.user = null;
            renderUser();
            els.accountMenu.hidden = true;
            showToast('Sesión cerrada', 'Puedes seguir comprando como visitante.');
        } catch (error) {
            showToast('No se pudo cerrar la sesión', error.message, 'error');
        }
    }

    function openModal(modal) {
        if (state.activeModal && state.activeModal !== modal) closeModal(state.activeModal, false);
        const pendingHide = modalHideTimers.get(modal);
        if (pendingHide) {
            clearTimeout(pendingHide);
            modalHideTimers.delete(modal);
        }
        state.activeModal = modal;
        modal.hidden = false;
        showOverlay();
        requestAnimationFrame(() => modal.classList.add('visible'));
        setTimeout(() => modal.querySelector('button, input, textarea, select, a')?.focus(), 160);
    }

    function closeModal(modal, updateOverlay = true) {
        if (!modal || modal.hidden) return;
        modal.classList.remove('visible');
        if (state.activeModal === modal) state.activeModal = null;
        const pendingHide = modalHideTimers.get(modal);
        if (pendingHide) clearTimeout(pendingHide);
        const hideTimer = setTimeout(() => {
            modal.hidden = true;
            modalHideTimers.delete(modal);
        }, 180);
        modalHideTimers.set(modal, hideTimer);
        if (updateOverlay) setTimeout(hideOverlayIfIdle, 190);
    }

    function closeTopLayer() {
        if (state.activeModal) {
            closeModal(state.activeModal);
        } else if (els.cartDrawer.classList.contains('open')) {
            closeCart();
        }
    }

    function showOverlay() {
        els.overlay.hidden = false;
        document.body.classList.add('no-scroll');
    }

    function hideOverlayIfIdle() {
        const drawerOpen = els.cartDrawer.classList.contains('open');
        if (!drawerOpen && !state.activeModal) {
            els.overlay.hidden = true;
            document.body.classList.remove('no-scroll');
        }
    }

    function showToast(title, message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'success' ? '' : type}`;
        toast.innerHTML = `
            <span class="toast-icon">${type === 'error' ? '!' : type === 'warning' ? '⚠' : '✓'}</span>
            <div><b>${escapeHtml(title)}</b><p>${escapeHtml(message || '')}</p></div>
        `;
        els.toastStack.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(8px)';
            setTimeout(() => toast.remove(), 220);
        }, 3600);
    }

    function setButtonLoading(button, loading, text) {
        button.disabled = loading;
        button.textContent = text;
    }

    function numberOr(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : fallback;
    }

    function money(value) {
        return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value || 0));
    }

    function firstName(name) {
        return String(name || '').trim().split(/\s+/)[0] || 'Cuenta';
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
})();
