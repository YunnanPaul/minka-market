(() => {
    'use strict';

    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/gif']);
    const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
    const FALLBACK_IMAGE = window.MinkaImages?.FALLBACK || '/images/product-placeholder.svg';

    const productFieldElements = {
        sku: 'productSku',
        nombre: 'productName',
        marca: 'productBrand',
        unidadMedida: 'productUnit',
        descripcion: 'productDescription',
        precio: 'productPrice',
        precioAnterior: 'productOldPrice',
        stock: 'productStock',
        imagenUrl: 'productImageUrl',
        categoriaId: 'productCategory'
    };

    const productFieldLabels = {
        sku: 'SKU',
        nombre: 'Nombre',
        marca: 'Marca',
        unidadMedida: 'Presentación',
        descripcion: 'Descripción',
        precio: 'Precio actual',
        precioAnterior: 'Precio anterior',
        stock: 'Stock',
        imagenUrl: 'Imagen',
        categoriaId: 'Categoría'
    };

    const state = {
        user: null,
        categories: [],
        products: [],
        orders: [],
        users: [],
        activeSection: 'dashboard',
        modalOpen: false,
        sidebarOpen: false,
        submittingProduct: false,
        selectedImageFile: null,
        previewObjectUrl: null,
        imageUrlTimer: null
    };

    const sectionMeta = {
        dashboard: { eyebrow: 'PANEL GENERAL', title: 'Resumen' },
        products: { eyebrow: 'CATÁLOGO E INVENTARIO', title: 'Productos' },
        orders: { eyebrow: 'VENTAS Y OPERACIÓN', title: 'Pedidos' },
        users: { eyebrow: 'CUENTAS DEL SISTEMA', title: 'Usuarios' }
    };

    const statusOptions = [
        ['PENDIENTE', 'Pendiente'],
        ['PAGADO', 'Pagado'],
        ['PREPARANDO', 'Preparando'],
        ['LISTO', 'Listo para entregar'],
        ['ENVIADO', 'Enviado'],
        ['ENTREGADO', 'Entregado'],
        ['CANCELADO', 'Cancelado']
    ];

    const els = {};

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        cacheElements();
        bindEvents();
        setPreview(FALLBACK_IMAGE, 'Vista previa del producto');

        try {
            const user = await Api.get('/api/auth/me');
            if (!user || user.rol !== 'ADMIN') {
                redirectToLogin();
                return;
            }

            state.user = user;
            renderAdminIdentity();

            const results = await Promise.allSettled([
                loadCategories(),
                loadDashboard(),
                loadProducts(),
                loadOrders(),
                loadUsers()
            ]);

            const failures = results.filter(result => result.status === 'rejected');
            const authFailure = failures.find(result => [401, 403].includes(result.reason?.status));
            if (authFailure) {
                redirectToLogin();
                return;
            }
            if (failures.length) {
                showToast(
                    'Carga parcialmente completada',
                    'Algunos datos no pudieron obtenerse. Revisa que PostgreSQL y Spring Boot estén activos.',
                    'warning'
                );
            }
        } catch (error) {
            if ([401, 403].includes(error.status)) {
                redirectToLogin();
                return;
            }
            showToast('No se pudo iniciar el panel', error.message || 'Revisa la conexión con el servidor.', 'error');
        }
    }

    function cacheElements() {
        const ids = [
            'adminSidebar', 'adminOverlay', 'mobileMenuButton', 'sectionEyebrow', 'sectionTitle',
            'adminUserName', 'adminUserEmail', 'adminUserInitial', 'adminLogout',
            'metricProducts', 'metricLowStock', 'metricOrders', 'metricSales',
            'recentOrders', 'lowStockList',
            'productSearch', 'newProductButton', 'imageHealthLabel',
            'productCountLabel', 'productsTableBody',
            'orderSearch', 'refreshOrdersButton', 'orderCountLabel', 'ordersTableBody',
            'userCountLabel', 'usersTableBody',
            'productFormModal', 'closeProductModal', 'cancelProductButton', 'productFormTitle',
            'productForm', 'productId', 'imageDropZone', 'productImageFile', 'productImagePreview',
            'clearProductImageButton', 'imageUploadStatus', 'imageFileMeta', 'productImageUrl',
            'testImageButton', 'productSku', 'productCategory', 'productName', 'productBrand',
            'productUnit', 'productDescription', 'productPrice', 'productOldPrice', 'productStock',
            'productFeatured', 'productActive', 'saveProductButton', 'adminToastStack'
        ];

        ids.forEach(id => {
            els[id] = document.getElementById(id);
            if (!els[id]) {
                console.warn(`[Minka Admin] No se encontró el elemento #${id}.`);
            }
        });
    }

    function bindEvents() {
        document.querySelectorAll('[data-section]').forEach(button => {
            button.addEventListener('click', () => showSection(button.dataset.section));
        });
        document.querySelectorAll('[data-go-section]').forEach(button => {
            button.addEventListener('click', () => showSection(button.dataset.goSection));
        });

        els.mobileMenuButton?.addEventListener('click', toggleSidebar);
        els.adminOverlay?.addEventListener('click', closeTopLayer);
        els.adminLogout?.addEventListener('click', logout);

        els.productSearch?.addEventListener('input', renderProducts);
        els.orderSearch?.addEventListener('input', renderOrders);
        els.refreshOrdersButton?.addEventListener('click', refreshOrders);

        els.newProductButton?.addEventListener('click', openNewProductModal);
        els.closeProductModal?.addEventListener('click', closeProductModal);
        els.cancelProductButton?.addEventListener('click', closeProductModal);
        els.productForm?.addEventListener('submit', saveProduct);
        els.productForm?.addEventListener('input', event => event.target.removeAttribute?.('aria-invalid'));
        els.productForm?.addEventListener('change', event => event.target.removeAttribute?.('aria-invalid'));
        els.productImageFile?.addEventListener('change', event => {
            const file = event.target.files?.[0];
            if (file) selectImageFile(file);
        });
        els.clearProductImageButton?.addEventListener('click', clearProductImage);
        els.testImageButton?.addEventListener('click', testImageUrl);
        els.productImageUrl?.addEventListener('input', scheduleUrlPreview);

        bindDropZone();

        els.productsTableBody?.addEventListener('click', handleProductTableClick);
        els.ordersTableBody?.addEventListener('change', handleOrderStatusChange);

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeTopLayer();
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 800 && state.sidebarOpen) closeSidebar();
        });
    }

    function bindDropZone() {
        const zone = els.imageDropZone;
        if (!zone) return;

        zone.addEventListener('click', event => {
            if (event.target.closest('button, label, input')) return;
            els.productImageFile?.click();
        });

        zone.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                els.productImageFile?.click();
            }
        });

        ['dragenter', 'dragover'].forEach(type => {
            zone.addEventListener(type, event => {
                event.preventDefault();
                event.stopPropagation();
                zone.classList.add('dragging');
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
            });
        });

        ['dragleave', 'dragend'].forEach(type => {
            zone.addEventListener(type, event => {
                event.preventDefault();
                event.stopPropagation();
                zone.classList.remove('dragging');
            });
        });

        zone.addEventListener('drop', event => {
            event.preventDefault();
            event.stopPropagation();
            zone.classList.remove('dragging');
            const file = event.dataTransfer?.files?.[0];
            if (file) selectImageFile(file);
        });
    }

    function renderAdminIdentity() {
        els.adminUserName.textContent = state.user.nombreCompleto;
        els.adminUserEmail.textContent = state.user.email;
        els.adminUserInitial.textContent = firstInitial(state.user.nombreCompleto);
    }

    function showSection(section) {
        if (!sectionMeta[section]) return;
        state.activeSection = section;

        document.querySelectorAll('.admin-section').forEach(element => {
            const active = element.id === `section-${section}`;
            element.hidden = !active;
            element.classList.toggle('active', active);
        });
        document.querySelectorAll('[data-section]').forEach(button => {
            button.classList.toggle('active', button.dataset.section === section);
        });

        els.sectionEyebrow.textContent = sectionMeta[section].eyebrow;
        els.sectionTitle.textContent = sectionMeta[section].title;
        closeSidebar();
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }

    async function loadCategories() {
        state.categories = await Api.get('/api/categorias');
        renderCategoryOptions();
    }

    async function loadDashboard() {
        const dashboard = await Api.get('/api/admin/dashboard');
        els.metricProducts.textContent = number(dashboard.productosActivos);
        els.metricLowStock.textContent = number(dashboard.productosBajoStock);
        els.metricOrders.textContent = number(dashboard.pedidosRegistrados);
        els.metricSales.textContent = money(dashboard.ventasAcumuladas);
    }

    async function loadProducts() {
        state.products = await Api.get('/api/admin/productos');
        renderProducts();
        renderLowStock();
        renderImageHealth();
    }

    async function loadOrders() {
        state.orders = await Api.get('/api/admin/pedidos');
        renderOrders();
        renderRecentOrders();
    }

    async function loadUsers() {
        state.users = await Api.get('/api/admin/usuarios');
        renderUsers();
    }

    async function refreshOrders() {
        setButtonLoading(els.refreshOrdersButton, true, 'Actualizando…');
        try {
            await Promise.all([loadOrders(), loadDashboard()]);
            showToast('Pedidos actualizados', 'La lista refleja los datos más recientes.');
        } catch (error) {
            showToast('No se pudo actualizar', error.message, 'error');
        } finally {
            setButtonLoading(els.refreshOrdersButton, false, '↻ Actualizar');
        }
    }

    function renderCategoryOptions() {
        if (!els.productCategory) return;
        const previous = els.productCategory.value;
        els.productCategory.innerHTML = '<option value="">Selecciona una categoría</option>' + state.categories
            .map(category => `<option value="${category.id}">${escapeHtml(category.icono || '')} ${escapeHtml(category.nombre)}</option>`)
            .join('');
        if (previous) els.productCategory.value = previous;
    }

    function renderProducts() {
        const query = normalize(els.productSearch?.value);
        const products = state.products.filter(product => {
            if (!query) return true;
            return [product.nombre, product.marca, product.sku, product.categoria]
                .some(value => normalize(value).includes(query));
        });

        els.productCountLabel.textContent = `${products.length} producto${products.length === 1 ? '' : 's'} mostrado${products.length === 1 ? '' : 's'}`;

        if (!products.length) {
            els.productsTableBody.innerHTML = emptyRow(7, 'No hay productos que coincidan con la búsqueda.');
            return;
        }

        els.productsTableBody.innerHTML = products.map(product => {
            const source = imageSource(product.imagenUrl);
            return `
                <tr>
                    <td>
                        <div class="product-cell">
                            <img data-product-image="true" src="${escapeAttr(normalizeImage(product.imagenUrl))}" alt="${escapeAttr(product.nombre)}" loading="lazy" width="54" height="54">
                            <div><b>${escapeHtml(product.nombre)}</b><small>${escapeHtml(product.marca)} · SKU ${escapeHtml(product.sku)}</small></div>
                        </div>
                    </td>
                    <td><span class="category-chip">${escapeHtml(product.categoria)}</span></td>
                    <td><b>${money(product.precio)}</b>${product.precioAnterior ? `<br><small><del>${money(product.precioAnterior)}</del></small>` : ''}</td>
                    <td class="stock-cell ${Number(product.stock) <= 5 ? 'low' : ''}">${number(product.stock)} ${escapeHtml(product.unidadMedida)}</td>
                    <td><span class="image-source-chip ${source.className}" title="${escapeAttr(product.imagenUrl || FALLBACK_IMAGE)}">${source.label}</span></td>
                    <td><span class="active-chip ${product.activo ? 'active' : 'inactive'}">${product.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                        <div class="row-actions">
                            <button type="button" data-edit-product="${product.id}">Editar</button>
                            <button class="danger" type="button" data-delete-product="${product.id}" ${!product.activo ? 'disabled' : ''}>Desactivar</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        MinkaImages?.hydrate(els.productsTableBody);
    }

    function renderLowStock() {
        const lowStock = state.products
            .filter(product => product.activo && Number(product.stock) <= 5)
            .sort((a, b) => Number(a.stock) - Number(b.stock))
            .slice(0, 6);

        if (!lowStock.length) {
            els.lowStockList.innerHTML = '<div class="empty-inline"><b>Inventario saludable</b><small>No hay productos activos con 5 unidades o menos.</small></div>';
            return;
        }

        els.lowStockList.innerHTML = lowStock.map(product => `
            <div class="low-stock-item">
                <img data-product-image="true" src="${escapeAttr(normalizeImage(product.imagenUrl))}" alt="${escapeAttr(product.nombre)}" loading="lazy" width="47" height="47">
                <div><b>${escapeHtml(product.nombre)}</b><small>${escapeHtml(product.sku)} · ${escapeHtml(product.categoria)}</small></div>
                <span class="stock-count">${number(product.stock)} und.</span>
            </div>
        `).join('');

        MinkaImages?.hydrate(els.lowStockList);
    }

    function renderImageHealth() {
        if (!els.imageHealthLabel) return;
        if (!state.products.length) {
            els.imageHealthLabel.textContent = 'Aún no hay productos para revisar.';
            return;
        }

        const counts = state.products.reduce((acc, product) => {
            const source = imageSource(product.imagenUrl);
            acc[source.className] = (acc[source.className] || 0) + 1;
            return acc;
        }, {});

        const configured = (counts.upload || 0) + (counts.builtin || 0) + (counts.remote || 0);
        const fallback = counts.fallback || 0;
        els.imageHealthLabel.textContent = fallback
            ? `${configured} productos tienen imagen configurada y ${fallback} usan el respaldo automático.`
            : `${configured} productos tienen una imagen configurada. El respaldo automático permanece activo ante cualquier error.`;
    }

    function renderOrders() {
        const query = normalize(els.orderSearch?.value);
        const orders = state.orders.filter(order => {
            if (!query) return true;
            return [order.codigo, order.clienteNombre, order.clienteEmail, order.estado]
                .some(value => normalize(value).includes(query));
        });

        els.orderCountLabel.textContent = `${orders.length} pedido${orders.length === 1 ? '' : 's'} mostrado${orders.length === 1 ? '' : 's'}`;

        if (!orders.length) {
            els.ordersTableBody.innerHTML = emptyRow(5, 'No hay pedidos que coincidan con la búsqueda.');
            return;
        }

        els.ordersTableBody.innerHTML = orders.map(order => {
            const items = order.detalles || [];
            const summary = items.slice(0, 3)
                .map(item => `${item.cantidad}× ${item.nombre}`)
                .join(', ');
            const extra = items.length > 3 ? ` y ${items.length - 3} más` : '';
            const options = statusOptions.map(([value, label]) =>
                `<option value="${value}" ${order.estado === value ? 'selected' : ''}>${label}</option>`
            ).join('');

            return `
                <tr>
                    <td><div class="order-code"><b>${escapeHtml(order.codigo)}</b><small>${formatDate(order.fecha)}</small></div></td>
                    <td><b>${escapeHtml(order.clienteNombre)}</b><br><small>${escapeHtml(order.clienteEmail)}</small></td>
                    <td><div class="order-items-summary">${escapeHtml(summary || 'Sin detalle')}${escapeHtml(extra)}</div><small>${deliveryLabel(order.tipoEntrega)} · ${paymentLabel(order.metodoPago)}</small></td>
                    <td><b>${money(order.total)}</b><br><small>${number(items.reduce((sum, item) => sum + Number(item.cantidad || 0), 0))} unidades</small></td>
                    <td><select class="order-status-select" data-order-status="${order.id}" aria-label="Estado del pedido ${escapeAttr(order.codigo)}">${options}</select></td>
                </tr>
            `;
        }).join('');
    }

    function renderRecentOrders() {
        const recent = state.orders.slice(0, 6);
        if (!recent.length) {
            els.recentOrders.innerHTML = '<div class="empty-inline"><b>Aún no hay pedidos</b><small>Las compras confirmadas aparecerán aquí.</small></div>';
            return;
        }

        els.recentOrders.innerHTML = recent.map(order => `
            <div class="recent-order">
                <div><b>${escapeHtml(order.codigo)} · ${escapeHtml(order.clienteNombre)}</b><small>${formatDate(order.fecha)} · ${statusLabel(order.estado)}</small></div>
                <strong>${money(order.total)}</strong>
            </div>
        `).join('');
    }

    function renderUsers() {
        els.userCountLabel.textContent = `${state.users.length} usuario${state.users.length === 1 ? '' : 's'} registrado${state.users.length === 1 ? '' : 's'}`;
        if (!state.users.length) {
            els.usersTableBody.innerHTML = emptyRow(5, 'No hay usuarios registrados.');
            return;
        }

        els.usersTableBody.innerHTML = state.users.map(user => `
            <tr>
                <td><b>${escapeHtml(user.nombreCompleto)}</b><br><small>${user.activo ? 'Cuenta activa' : 'Cuenta inactiva'}</small></td>
                <td><b>${escapeHtml(user.email)}</b><br><small>${escapeHtml(user.telefono)}</small></td>
                <td>${escapeHtml(user.direccion || 'Sin dirección')}</td>
                <td><span class="role-chip ${user.rol === 'ADMIN' ? 'admin' : 'client'}">${user.rol === 'ADMIN' ? 'Administrador' : 'Cliente'}</span></td>
                <td>${formatDate(user.creadoEn)}</td>
            </tr>
        `).join('');
    }

    function handleProductTableClick(event) {
        const editButton = event.target.closest('[data-edit-product]');
        if (editButton) {
            const product = state.products.find(item => item.id === Number(editButton.dataset.editProduct));
            if (product) openEditProductModal(product);
            return;
        }

        const deleteButton = event.target.closest('[data-delete-product]');
        if (deleteButton) deactivateProduct(Number(deleteButton.dataset.deleteProduct));
    }

    async function openNewProductModal() {
        if (!state.categories.length) {
            setButtonLoading(els.newProductButton, true, 'Cargando categorías…');
            try {
                await loadCategories();
            } catch (error) {
                if ([401, 403].includes(error.status)) {
                    redirectToLogin();
                    return;
                }
                showToast('No se puede abrir el formulario', 'Primero deben cargarse las categorías. ' + (error.message || ''), 'error');
                return;
            } finally {
                setButtonLoading(els.newProductButton, false, '＋ Nuevo producto');
            }
        }

        resetProductForm();
        els.productFormTitle.textContent = 'Nuevo producto';
        els.productActive.checked = true;
        els.productFeatured.checked = false;
        renderCategoryOptions();
        setPreview(FALLBACK_IMAGE, 'Vista previa del producto');
        setImageStatus('idle', 'Sin archivo nuevo', 'Puedes subir una imagen o dejar el respaldo automático.');
        openProductModal();
    }

    async function openEditProductModal(product) {
        if (!state.categories.length) {
            try {
                await loadCategories();
            } catch (error) {
                if ([401, 403].includes(error.status)) {
                    redirectToLogin();
                    return;
                }
                showToast('No se puede editar el producto', 'Primero deben cargarse las categorías. ' + (error.message || ''), 'error');
                return;
            }
        }

        resetProductForm();
        els.productId.value = product.id;
        els.productFormTitle.textContent = `Editar: ${product.nombre}`;
        renderCategoryOptions();
        els.productSku.value = product.sku;
        els.productCategory.value = String(product.categoriaId);
        els.productName.value = product.nombre;
        els.productBrand.value = product.marca;
        els.productUnit.value = product.unidadMedida;
        els.productDescription.value = product.descripcion;
        els.productPrice.value = product.precio;
        els.productOldPrice.value = product.precioAnterior ?? '';
        els.productStock.value = product.stock;
        els.productImageUrl.value = product.imagenUrl || '';
        els.productFeatured.checked = Boolean(product.destacado);
        els.productActive.checked = Boolean(product.activo);
        setPreview(product.imagenUrl, product.nombre);
        setImageStatus('idle', 'Imagen actual', product.imagenUrl || 'Respaldo automático');
        openProductModal();
    }

    function resetProductForm() {
        els.productForm.reset();
        els.productId.value = '';
        els.productImageFile.value = '';
        state.selectedImageFile = null;
        clearPreviewObjectUrl();
        els.productImageUrl.value = '';
        clearProductFieldErrors();
    }

    function openProductModal() {
        if (state.modalOpen) return;
        state.modalOpen = true;
        els.productFormModal.hidden = false;
        showOverlay();
        requestAnimationFrame(() => {
            els.productFormModal.classList.add('visible');
            setTimeout(() => els.productSku?.focus(), 180);
        });
    }

    function closeProductModal() {
        if (!state.modalOpen) return;
        state.modalOpen = false;
        els.productFormModal.classList.remove('visible');
        clearTimeout(state.imageUrlTimer);
        setTimeout(() => {
            els.productFormModal.hidden = true;
            hideOverlayIfIdle();
            clearPreviewObjectUrl();
        }, 200);
    }

    function selectImageFile(file) {
        try {
            validateImageFile(file);
            state.selectedImageFile = file;
            clearPreviewObjectUrl();
            state.previewObjectUrl = URL.createObjectURL(file);
            setPreview(state.previewObjectUrl, file.name);
            setImageStatus('ready', 'Imagen lista para subir', `${file.name} · ${formatBytes(file.size)}`);
            showToast('Imagen seleccionada', 'La vista previa está lista. Se subirá al guardar el producto.');
        } catch (error) {
            state.selectedImageFile = null;
            els.productImageFile.value = '';
            setImageStatus('error', 'Archivo rechazado', error.message);
            showToast('No se puede usar esa imagen', error.message, 'error');
        }
    }

    function validateImageFile(file) {
        const mime = String(file.type || '').toLowerCase();
        const extension = String(file.name || '').split('.').pop()?.toLowerCase() || '';
        const recognizedByBrowser = ALLOWED_IMAGE_TYPES.has(mime);
        const recognizedByName = ALLOWED_IMAGE_EXTENSIONS.has(extension);

        if (!recognizedByBrowser && !recognizedByName) {
            throw new Error('Usa una imagen JPG, PNG, WEBP o GIF.');
        }
        if (file.size <= 0) {
            throw new Error('El archivo seleccionado está vacío.');
        }
        if (file.size > MAX_IMAGE_SIZE) {
            throw new Error('La imagen no debe superar 5 MB.');
        }
    }

    function clearProductImage() {
        state.selectedImageFile = null;
        els.productImageFile.value = '';
        els.productImageUrl.value = '';
        clearPreviewObjectUrl();
        setPreview(FALLBACK_IMAGE, 'Imagen de respaldo');
        setImageStatus('idle', 'Imagen eliminada del formulario', 'Al guardar se utilizará el respaldo automático.');
    }

    function scheduleUrlPreview() {
        if (state.selectedImageFile) {
            setImageStatus('ready', 'Archivo local seleccionado', 'El archivo tendrá prioridad sobre la URL al guardar.');
            return;
        }
        clearTimeout(state.imageUrlTimer);
        state.imageUrlTimer = setTimeout(() => {
            const value = els.productImageUrl.value.trim();
            setPreview(value || FALLBACK_IMAGE, els.productName.value.trim() || 'Vista previa del producto');
            setImageStatus(
                value ? 'idle' : 'idle',
                value ? 'URL pendiente de verificación' : 'Respaldo automático',
                value || FALLBACK_IMAGE
            );
        }, 280);
    }

    async function testImageUrl() {
        const value = els.productImageUrl.value.trim();
        if (!value) {
            setPreview(FALLBACK_IMAGE, 'Imagen de respaldo');
            setImageStatus('ready', 'Respaldo disponible', FALLBACK_IMAGE);
            showToast('Respaldo activo', 'El producto siempre mostrará una imagen aunque no subas un archivo.');
            return;
        }

        setButtonLoading(els.testImageButton, true, 'Probando…');
        setImageStatus('uploading', 'Comprobando imagen', value);
        try {
            const result = await MinkaImages.probe(value);
            if (!result.ok) throw new Error('La imagen no pudo cargarse desde esa ruta o URL.');
            setPreview(result.url, els.productName.value.trim() || 'Vista previa del producto');
            setImageStatus('ready', 'Imagen verificada', `${result.width} × ${result.height} px · ${result.url}`);
            showToast('Imagen disponible', 'La ruta responde correctamente en el navegador.');
        } catch (error) {
            setPreview(FALLBACK_IMAGE, 'Imagen de respaldo');
            setImageStatus('error', 'No se pudo cargar la imagen', error.message);
            showToast('Ruta de imagen no válida', error.message, 'error');
        } finally {
            setButtonLoading(els.testImageButton, false, 'Probar');
        }
    }

    function setPreview(value, alt) {
        if (!els.productImagePreview) return;
        const source = value?.startsWith('blob:') ? value : normalizeImage(value);
        MinkaImages?.bind(els.productImagePreview, source, alt || 'Vista previa del producto');
        if (!window.MinkaImages) {
            els.productImagePreview.src = source;
            els.productImagePreview.alt = alt || 'Vista previa del producto';
        }
    }

    function setImageStatus(status, title, detail) {
        if (!els.imageUploadStatus) return;
        els.imageUploadStatus.dataset.state = status;
        const titleElement = els.imageUploadStatus.querySelector('b');
        if (titleElement) titleElement.textContent = title;
        if (els.imageFileMeta) els.imageFileMeta.textContent = detail;
    }

    function clearPreviewObjectUrl() {
        if (state.previewObjectUrl) {
            URL.revokeObjectURL(state.previewObjectUrl);
            state.previewObjectUrl = null;
        }
    }

    async function saveProduct(event) {
        event.preventDefault();
        if (state.submittingProduct || !els.productForm.reportValidity()) return;

        state.submittingProduct = true;
        clearProductFieldErrors();
        setButtonLoading(els.saveProductButton, true, 'Guardando…');

        try {
            // Valida primero todos los datos del formulario. Así una imagen no se
            // sube ni deja un archivo huérfano cuando existe un error de precio,
            // stock, categoría o texto pendiente de corregir.
            let payload = buildProductPayload(Boolean(state.selectedImageFile));

            if (state.selectedImageFile) {
                setImageStatus('uploading', 'Subiendo imagen', `${state.selectedImageFile.name} · ${formatBytes(state.selectedImageFile.size)}`);
                const formData = new FormData();
                formData.append('file', state.selectedImageFile);
                const upload = await Api.upload('/api/admin/productos/imagen', formData);
                els.productImageUrl.value = upload.url;

                // Si el guardado del producto falla después de subir la imagen,
                // el reintento reutiliza la misma URL y no genera archivos
                // duplicados en cada clic.
                state.selectedImageFile = null;
                els.productImageFile.value = '';
                clearPreviewObjectUrl();
                setPreview(upload.url, els.productName.value.trim() || 'Vista previa del producto');
                setImageStatus('ready', 'Imagen subida', upload.url);
                payload = { ...payload, imagenUrl: upload.url };
            }

            const id = Number(els.productId.value || 0);
            const saved = id
                ? await Api.put(`/api/admin/productos/${id}`, payload)
                : await Api.post('/api/admin/productos', payload);

            state.products = id
                ? state.products.map(item => item.id === saved.id ? saved : item)
                : [saved, ...state.products];

            renderProducts();
            renderLowStock();
            renderImageHealth();
            closeProductModal();
            showToast(
                id ? 'Producto actualizado' : 'Producto creado',
                'La información, el inventario y la imagen quedaron guardados correctamente.'
            );

            Promise.all([loadProducts(), loadDashboard()]).catch(error => {
                showToast('Cambio guardado', `No se pudo refrescar todo el panel: ${error.message}`, 'warning');
            });
        } catch (error) {
            if ([401, 403].includes(error.status)) {
                showToast('La sesión ya no es válida', 'Vuelve a iniciar sesión para continuar.', 'warning');
                redirectToLogin();
                return;
            }

            const detail = productErrorDetail(error);
            setImageStatus('error', 'Producto no guardado', detail);
            showToast('No se pudo guardar el producto', detail, 'error');
        } finally {
            state.submittingProduct = false;
            setButtonLoading(els.saveProductButton, false, 'Guardar producto');
        }
    }

    function buildProductPayload(ignoreCurrentImageUrl = false) {
        const precio = readDecimal(els.productPrice, 'Precio actual', true);
        const precioAnterior = readDecimal(els.productOldPrice, 'Precio anterior', false);
        const stock = readInteger(els.productStock, 'Stock');
        const categoriaId = readInteger(els.productCategory, 'Categoría');
        const imagenUrl = ignoreCurrentImageUrl ? '' : els.productImageUrl.value.trim();

        if (categoriaId < 1) {
            throw new ProductFormError('categoriaId', 'Selecciona una categoría válida.');
        }
        if (precioAnterior !== null && precioAnterior <= precio) {
            throw new ProductFormError('precioAnterior', 'El precio anterior debe ser mayor que el precio actual.');
        }
        if (imagenUrl && window.MinkaImages && !MinkaImages.isSupportedSource(imagenUrl, false)) {
            throw new ProductFormError('imagenUrl', 'Usa una ruta /images, /uploads o una URL http(s).');
        }

        return {
            sku: requiredText(els.productSku, 'sku').toUpperCase(),
            nombre: requiredText(els.productName, 'nombre'),
            marca: requiredText(els.productBrand, 'marca'),
            unidadMedida: requiredText(els.productUnit, 'unidadMedida'),
            descripcion: requiredText(els.productDescription, 'descripcion'),
            precio,
            precioAnterior,
            stock,
            imagenUrl: imagenUrl || null,
            destacado: els.productFeatured.checked,
            activo: els.productActive.checked,
            categoriaId
        };
    }

    function requiredText(input, field) {
        const value = input.value.trim();
        if (!value) {
            throw new ProductFormError(field, `Completa el campo ${productFieldLabels[field] || field}.`);
        }
        return value;
    }

    function readDecimal(input, label, required) {
        const raw = input.value.trim().replace(',', '.');
        if (!raw && !required) return null;
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) {
            const field = input === els.productOldPrice ? 'precioAnterior' : 'precio';
            throw new ProductFormError(field, `${label} debe ser un número mayor que cero.`);
        }
        if (value > 9999999999.99) {
            const field = input === els.productOldPrice ? 'precioAnterior' : 'precio';
            throw new ProductFormError(field, `${label} supera el máximo permitido.`);
        }
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }

    function readInteger(input, label) {
        const raw = input.value.trim();
        const value = Number(raw);
        const field = input === els.productCategory ? 'categoriaId' : 'stock';
        if (!raw || !Number.isSafeInteger(value) || value < 0) {
            throw new ProductFormError(field, `${label} debe ser un número entero válido.`);
        }
        const maximum = input === els.productCategory ? Number.MAX_SAFE_INTEGER : 2147483647;
        if (value > maximum) {
            throw new ProductFormError(field, `${label} supera el máximo permitido.`);
        }
        return value;
    }

    function productErrorDetail(error) {
        if (error instanceof ProductFormError) {
            focusProductField(error.field);
            return error.message;
        }

        const fields = error.details?.fieldErrors;
        if (fields && typeof fields === 'object') {
            const entries = Object.entries(fields);
            if (entries.length) {
                focusProductField(entries[0][0]);
                return entries
                    .map(([field, message]) => `${productFieldLabels[field] || field}: ${message}`)
                    .join(' ');
            }
        }
        return error.message || 'Revisa los datos ingresados y vuelve a intentarlo.';
    }

    function focusProductField(field) {
        const elementId = productFieldElements[field];
        const element = elementId ? els[elementId] : null;
        if (!element) return;
        element.setAttribute('aria-invalid', 'true');
        element.focus({ preventScroll: false });
    }

    function clearProductFieldErrors() {
        Object.values(productFieldElements).forEach(id => els[id]?.removeAttribute('aria-invalid'));
    }

    class ProductFormError extends Error {
        constructor(field, message) {
            super(message);
            this.name = 'ProductFormError';
            this.field = field;
        }
    }

    async function deactivateProduct(productId) {
        const product = state.products.find(item => item.id === productId);
        if (!product || !product.activo) return;
        if (!window.confirm(`¿Desactivar "${product.nombre}"? Dejará de aparecer en la tienda, pero sus pedidos históricos se conservarán.`)) return;

        try {
            await Api.delete(`/api/admin/productos/${productId}`);
            state.products = state.products.map(item => item.id === productId ? { ...item, activo: false } : item);
            renderProducts();
            renderLowStock();
            renderImageHealth();
            showToast('Producto desactivado', 'Ya no está visible en el catálogo público.');
            Promise.all([loadProducts(), loadDashboard()]).catch(error => {
                showToast('Producto desactivado', `No se pudo refrescar todo el panel: ${error.message}`, 'warning');
            });
        } catch (error) {
            showToast('No se pudo desactivar', error.message, 'error');
        }
    }

    async function handleOrderStatusChange(event) {
        const select = event.target.closest('[data-order-status]');
        if (!select) return;

        const orderId = Number(select.dataset.orderStatus);
        const order = state.orders.find(item => item.id === orderId);
        if (!order) return;

        const previous = order.estado;
        const next = select.value;
        if (previous === next) return;

        if (next === 'CANCELADO' && !window.confirm('¿Cancelar este pedido? El stock de sus productos será repuesto.')) {
            select.value = previous;
            return;
        }

        select.disabled = true;
        try {
            const updated = await Api.patch(`/api/admin/pedidos/${orderId}/estado`, { estado: next });
            state.orders = state.orders.map(item => item.id === orderId ? updated : item);
            renderOrders();
            renderRecentOrders();
            showToast('Estado actualizado', `${updated.codigo} ahora está ${statusLabel(updated.estado).toLowerCase()}.`);
            Promise.all([loadProducts(), loadDashboard()]).catch(error => {
                showToast('Estado guardado', `No se pudo refrescar todo el panel: ${error.message}`, 'warning');
            });
        } catch (error) {
            select.value = previous;
            showToast('No se pudo cambiar el estado', error.message, 'error');
        } finally {
            select.disabled = false;
        }
    }

    function imageSource(value) {
        const normalized = normalizeImage(value);
        if (/^https?:/i.test(normalized)) return { className: 'remote', label: 'URL externa' };
        if (normalized.startsWith('/uploads/')) return { className: 'upload', label: 'Subida' };
        if (normalized === FALLBACK_IMAGE || normalized.includes('product-placeholder')) {
            return { className: 'fallback', label: 'Respaldo' };
        }
        return { className: 'builtin', label: 'Colección' };
    }

    function normalizeImage(value) {
        return MinkaImages?.normalize(value) || (value || FALLBACK_IMAGE);
    }

    function toggleSidebar() {
        state.sidebarOpen ? closeSidebar() : openSidebar();
    }

    function openSidebar() {
        state.sidebarOpen = true;
        els.adminSidebar.classList.add('open');
        showOverlay();
    }

    function closeSidebar() {
        if (!state.sidebarOpen) return;
        state.sidebarOpen = false;
        els.adminSidebar.classList.remove('open');
        hideOverlayIfIdle();
    }

    function closeTopLayer() {
        if (state.modalOpen) closeProductModal();
        else if (state.sidebarOpen) closeSidebar();
    }

    function showOverlay() {
        els.adminOverlay.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    function hideOverlayIfIdle() {
        if (!state.modalOpen && !state.sidebarOpen) {
            els.adminOverlay.hidden = true;
            document.body.style.overflow = '';
        }
    }

    async function logout() {
        try {
            await Api.post('/api/auth/logout', {});
        } finally {
            location.href = '/';
        }
    }

    function redirectToLogin() {
        sessionStorage.setItem('minkaReturnTo', '/admin');
        location.href = '/login?return=/admin';
    }

    function emptyRow(columns, message) {
        return `<tr><td colspan="${columns}"><div class="empty-inline"><b>${escapeHtml(message)}</b><small>Modifica el filtro o registra nueva información.</small></div></td></tr>`;
    }

    function statusLabel(status) {
        return Object.fromEntries(statusOptions)[status] || status;
    }

    function deliveryLabel(value) {
        return value === 'DELIVERY' ? 'Delivery' : 'Recojo en tienda';
    }

    function paymentLabel(value) {
        return ({
            YAPE_PLIN: 'Yape / Plin',
            TARJETA_DEMO: 'Tarjeta demo',
            EFECTIVO: 'Efectivo'
        })[value] || value;
    }

    function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
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

    function formatBytes(bytes) {
        const value = Number(bytes || 0);
        if (value < 1024) return `${value} B`;
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
        return `${(value / (1024 * 1024)).toFixed(2)} MB`;
    }

    function normalize(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function firstInitial(value) {
        return String(value || 'A').trim().charAt(0).toUpperCase() || 'A';
    }

    function setButtonLoading(button, loading, text) {
        if (!button) return;
        button.disabled = loading;
        button.textContent = text;
    }

    function prefersReducedMotion() {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    }

    function showToast(title, message, type = 'success') {
        if (!els.adminToastStack) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'success' ? '' : type}`;
        toast.innerHTML = `
            <span class="toast-icon">${type === 'error' ? '!' : type === 'warning' ? '⚠' : '✓'}</span>
            <div><b>${escapeHtml(title)}</b><p>${escapeHtml(message || '')}</p></div>
        `;
        els.adminToastStack.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(8px)';
            setTimeout(() => toast.remove(), 220);
        }, 3900);
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
