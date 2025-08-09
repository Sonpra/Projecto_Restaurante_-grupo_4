// --- Bloque de Seguridad (CSRF) y API Fetch ---
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
const csrftoken = getCookie('csrftoken');

async function apiFetch(url, options = {}) {
    options.headers = {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrftoken,
        ...options.headers,
    };
    if (options.body && typeof options.body !== 'string') {
        options.body = JSON.stringify(options.body);
    }
    const response = await fetch(url, options);
    if (response.status === 204) return null;
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || data.error || 'Error en la petición');
    }
    return data;
}

// --- Lógica del Dashboard de Empleado ---
document.addEventListener('DOMContentLoaded', () => {
    const tablesGrid = document.querySelector('.tables-grid');
    const detailsPanelTitle = document.getElementById('detailsPanelTitle');
    const orderDetailsContent = document.getElementById('orderDetailsContent');
    const menuModal = document.getElementById('menuModal');
    const menuItemsContainer = document.getElementById('menu-items-container');
    const closeMenuModalBtn = document.getElementById('close-menu-modal-btn');

    let activeTableId = null;
    let activePedido = null;

    async function fetchAndRenderTables() {
        try {
            const tablesData = await apiFetch('/api/mesas/');
            tablesGrid.innerHTML = '';
            if (!tablesData || tablesData.length === 0) {
                tablesGrid.innerHTML = '<p>No hay mesas disponibles.</p>';
                select_table(null);
            } else {
                tablesData.forEach(table => {
                    const tableCard = document.createElement('div');
                    tableCard.classList.add('table-card');
                    if (table.id === activeTableId) tableCard.classList.add('active');
                    
                    const statusClass = `status-${table.estado.replace(/\s/g, '')}`;
                    tableCard.innerHTML = `<h3>${table.nombre}</h3><p>Capacidad: ${table.capacidad}</p><span class="table-status ${statusClass}">${table.estado}</span>`;
                    tableCard.dataset.tableId = table.id;
                    tableCard.addEventListener('click', () => select_table(table.id));
                    tablesGrid.appendChild(tableCard);
                });
                
                if (activeTableId === null || !tablesData.some(t => t.id === activeTableId)) {
                    if (tablesData.length > 0) select_table(tablesData[0].id);
                } else {
                    select_table(activeTableId);
                }
            }
        } catch (error) {
            console.error('Error al cargar las mesas:', error);
            tablesGrid.innerHTML = `<p style="color: red;">Error al cargar mesas.</p>`;
        }
    }

    async function select_table(tableId) {
        activeTableId = tableId;
        document.querySelectorAll('.table-card').forEach(card => {
            card.classList.toggle('active', parseInt(card.dataset.tableId) === activeTableId);
        });

        if (!tableId) {
            detailsPanelTitle.textContent = 'Detalles de la Mesa';
            orderDetailsContent.innerHTML = '<p>Selecciona una mesa.</p>';
            activePedido = null;
            return;
        }

        try {
            const selectedTable = await apiFetch(`/api/mesas/${tableId}/`);
            detailsPanelTitle.textContent = `Detalles de ${selectedTable.nombre}`;
            orderDetailsContent.classList.remove('empty-state');

            if (selectedTable.estado === 'Libre') {
                activePedido = null;
                orderDetailsContent.innerHTML = `
                    <div class="detail-group">
                        <span class="detail-label">Estado:</span>
                        <span class="detail-value">Esta mesa está libre.</span>
                    </div>
                    <button class="create-table-btn" onclick="iniciarPedido(${tableId})">Iniciar Pedido</button>`;
            } else if (selectedTable.estado === 'Ocupada') {
                const pedidos = await apiFetch(`/api/pedidos/?mesa=${tableId}&completado=false`);
                if (pedidos && pedidos.length > 0) {
                    activePedido = pedidos[0];
                    renderOrderDetails(activePedido);
                } else {
                    orderDetailsContent.innerHTML = `<p>Error: La mesa está ocupada pero no se encontró un pedido activo.</p>`;
                }
            } else { // Para estados como 'Reservada' o 'Mantenimiento'
                activePedido = null;
                orderDetailsContent.innerHTML = `
                    <div class="detail-group">
                        <span class="detail-label">Estado:</span>
                        <span class="detail-value">Mesa no disponible (${selectedTable.estado}).</span>
                    </div>`;
            }
        } catch (error) {
            console.error('Error al seleccionar la mesa:', error);
            orderDetailsContent.innerHTML = `<p style="color: red;">Error al cargar detalles de la mesa.</p>`;
        }
    }

    function renderOrderDetails(pedido) {
        let detallesHTML = pedido.detalles.length === 0 ? '<p>El pedido está vacío.</p>' :
            pedido.detalles.map(detalle => `
                <div class="order-item">
                    <span>${detalle.cantidad}x ${detalle.plato.nombre}</span>
                    <div class="order-item-actions">
                        <span>$${(detalle.subtotal).toLocaleString('es-CL')}</span>
                        <button class="remove-item-btn" onclick="removerPlatoDelPedido(${detalle.plato.id})">&times;</button>
                    </div>
                </div>`).join('');

        orderDetailsContent.innerHTML = `
            <h4>Pedido #${pedido.id}</h4>
            <div id="order-items-container">${detallesHTML}</div><hr>
            <div class="order-total"><strong>TOTAL:</strong><strong>$${(pedido.total).toLocaleString('es-CL')}</strong></div>
            <div class="order-main-actions">
                <button class="add-products-btn" onclick="openMenuModal()">Añadir Productos</button>
                <button class="finalize-btn" onclick="finalizarPedido(${pedido.id})">Finalizar y Pagar</button>
            </div>`;
    }

    window.iniciarPedido = async function(tableId) {
        try {
            await apiFetch(`/api/mesas/${tableId}/iniciar_pedido/`, { method: 'POST' });
            await fetchAndRenderTables();
        } catch (error) {
            alert(`Error al iniciar el pedido: ${error.message}`);
        }
    }

    window.finalizarPedido = async function(pedidoId) {
        if (confirm('¿Estás seguro de que quieres finalizar y cobrar este pedido?')) {
            try {
                await apiFetch(`/api/pedidos/${pedidoId}/finalizar/`, { method: 'POST' });
                await fetchAndRenderTables();
            } catch (error) {
                alert(`Error al finalizar el pedido: ${error.message}`);
            }
        }
    }
    
    // --- Lógica del Modal del Menú ---
    window.openMenuModal = function() {
        if (!activePedido) {
            alert('Debes tener un pedido activo para añadir productos.');
            return;
        }
        menuModal.classList.add('show');
    }
    
    function closeMenuModal() {
        menuModal.classList.remove('show');
    }
    
    closeMenuModalBtn.addEventListener('click', closeMenuModal);
    
    async function loadMenu() {
        try {
            const platos = await apiFetch('/api/platos/');
            menuItemsContainer.innerHTML = '';
            
            if (!platos || platos.length === 0) {
                menuItemsContainer.innerHTML = '<p>No hay productos disponibles.</p>';
                return;
            }
            
            // Agrupar por categoría
            const categorias = [...new Set(platos.map(p => p.categoria))];
            
            let menuHTML = '<div class="menu-tabs">';
            categorias.forEach((cat, index) => {
                menuHTML += `<button class="tab-button" data-category="${cat}">${cat}</button>`;
            });
            menuHTML += '</div><div class="menu-items">';
            
            categorias.forEach(cat => {
                menuHTML += `<div class="menu-category" data-category="${cat}">`;
                platos.filter(p => p.categoria === cat).forEach(plato => {
                    menuHTML += `
                        <div class="menu-item">
                            <div class="menu-item-info">
                                <h4>${plato.nombre}</h4>
                                <p>${plato.descripcion || ''}</p>
                                <span>$${plato.precio.toLocaleString('es-CL')}</span>
                            </div>
                            <button onclick="addPlatoToPedido(${plato.id})">+</button>
                        </div>`;
                });
                menuHTML += '</div>';
            });
            
            menuHTML += '</div>';
            menuItemsContainer.innerHTML = menuHTML;
            
            // Activar primera categoría
            const firstTab = document.querySelector('.menu-tabs .tab-button');
            if (firstTab) firstTab.classList.add('active');
            const firstCategory = document.querySelector('.menu-category');
            if (firstCategory) firstCategory.style.display = 'block';
            
            // Eventos para cambiar categorías
            document.querySelectorAll('.menu-tabs .tab-button').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.menu-tabs .tab-button').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.menu-category').forEach(c => c.style.display = 'none');
                    
                    btn.classList.add('active');
                    const category = btn.dataset.category;
                    document.querySelector(`.menu-category[data-category="${category}"]`).style.display = 'block';
                });
            });
            
        } catch (error) {
            console.error('Error cargando menú:', error);
            menuItemsContainer.innerHTML = '<p>Error al cargar el menú.</p>';
        }
    }
    
    window.addPlatoToPedido = async function(platoId) {
        if (!activePedido) return;
        try {
            const updatedPedido = await apiFetch(`/api/pedidos/${activePedido.id}/agregar_plato/`, {
                method: 'POST', body: { plato_id: platoId }
            });
            activePedido = updatedPedido;
            renderOrderDetails(updatedPedido); // Actualiza solo el panel de detalles
            closeMenuModal();
        } catch (error) { alert(`Error al agregar el plato: ${error.message}`); }
    }

    window.removerPlatoDelPedido = async function(platoId) {
        if (!activePedido) return;
        try {
            const updatedPedido = await apiFetch(`/api/pedidos/${activePedido.id}/remover_plato/`, {
                method: 'POST', body: { plato_id: platoId }
            });
            activePedido = updatedPedido;
            renderOrderDetails(updatedPedido); // Actualiza solo el panel de detalles
        } catch (error) { alert(`Error al remover el plato: ${error.message}`); }
    }
    
    // --- LÓGICA PARA CARGAR INCIDENTES ---
    async function fetchAndRenderIncidents() {
        const incidentsList = document.getElementById('incidents-list');
        if (!incidentsList) return; 

        try {
            const incidents = await apiFetch('/api/incidentes/?visto=false');
            incidentsList.innerHTML = '';

            if (!incidents || incidents.length === 0) {
                incidentsList.innerHTML = '<p class="empty-state">No hay novedades.</p>';
                return;
            }

            incidents.forEach(inc => {
                const incidentCard = document.createElement('div');
                incidentCard.className = `incident-card ${inc.tipo.toLowerCase()}`;
                incidentCard.innerHTML = `
                    <h4>${inc.tipo}</h4>
                    <p>${inc.mensaje}</p>
                    <button data-id="${inc.id}">Marcar como Visto</button>
                `;
                incidentsList.appendChild(incidentCard);
            });
        } catch (error) {
            console.error('Error al cargar incidentes:', error);
            incidentsList.innerHTML = '<p style="color: red;">Error al cargar novedades.</p>';
        }
    }

    document.addEventListener('click', async (event) => {
        const targetButton = event.target.closest('.incident-card button');
        if (targetButton) {
            const incidentId = targetButton.dataset.id;
            try {
                await apiFetch(`/api/incidentes/${incidentId}/marcar_visto/`, { method: 'POST' });
                fetchAndRenderIncidents(); 
            } catch (error) {
                alert('Error al marcar como visto.');
            }
        }
    });
    
    // Carga inicial de todo
    fetchAndRenderTables();
    loadMenu();
    fetchAndRenderIncidents();
});