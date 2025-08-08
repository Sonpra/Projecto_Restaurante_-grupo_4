// --- Selectores y Variables Globales ---
const tablesGrid = document.querySelector('.tables-grid');
const detailsPanelTitle = document.getElementById('detailsPanelTitle');
const orderDetailsContent = document.getElementById('order-details-content');
let activeTableId = null;
let activePedido = null;

// --- Funciones de la API y Renderizado ---
async function handleApiResponse(response) {
    if (response.status === 204) { return null; }
    const textData = await response.text();
    if (!response.ok) {
        let errorDetails = {};
        try { errorDetails = JSON.parse(textData); } catch (e) {
            errorDetails.detail = textData || `Error HTTP: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorDetails.detail || `Error desconocido`);
    }
    try { return JSON.parse(textData); } catch (e) {
        console.warn('Respuesta de API no es JSON válido:', textData);
        return null;
    }
}

async function fetchAndRenderTables() {
    try {
        const tablesData = await fetch('/api/mesas/').then(handleApiResponse);
        tablesGrid.innerHTML = '';
        if (!tablesData || tablesData.length === 0) {
            tablesGrid.innerHTML = '<p style="text-align: center; color: #777; margin-top: 50px;">No hay mesas disponibles.</p>';
            select_table(null);
        } else {
            tablesData.forEach(table => {
                const tableCard = document.createElement('div');
                tableCard.classList.add('table-card');
                if (table.id === activeTableId) { tableCard.classList.add('active'); }
                const statusClass = `status-${table.estado.replace(/\s/g, '')}`;
                tableCard.innerHTML = `<h3>${table.nombre}</h3><p>Capacidad: ${table.capacidad}</p><span class="table-status ${statusClass}">${table.estado}</span>`;
                tableCard.dataset.tableId = table.id;
                tableCard.addEventListener('click', () => select_table(table.id));
                tablesGrid.appendChild(tableCard);
            });
            const mesaActivaExiste = tablesData.some(mesa => mesa.id === activeTableId);
            if (activeTableId === null || !mesaActivaExiste) {
                select_table(tablesData[0].id);
            } else {
                select_table(activeTableId);
            }
        }
    } catch (error) {
        console.error('Error al cargar las mesas:', error);
    }
}

async function select_table(tableId) {
    activeTableId = tableId;
    document.querySelectorAll('.table-card').forEach(card => {
        card.classList.toggle('active', parseInt(card.dataset.tableId) === activeTableId);
    });

    if (tableId) {
        try {
            const selectedTable = await fetch(`/api/mesas/${tableId}/`).then(handleApiResponse);
            if (!selectedTable) return;

            detailsPanelTitle.textContent = `Detalles de ${selectedTable.nombre}`;
            orderDetailsContent.classList.remove('empty-state');
            
            if (selectedTable.estado === 'Libre') {
                activePedido = null;
                orderDetailsContent.innerHTML = `
                    <div class="detail-group"><span class="detail-label">Estado:</span><span class="detail-value">Esta mesa está libre.</span></div>
                    <button class="create-table-btn" onclick="iniciarPedido(${tableId})">Iniciar Pedido</button>
                `;
            } else { // Si está Ocupada o Pendiente
                const pedidos = await fetch(`/api/pedidos/?mesa=${tableId}&completado=false`).then(handleApiResponse);
                if (pedidos && pedidos.length > 0) {
                    activePedido = pedidos[0];
                    let detallesHTML = activePedido.detalles.length === 0 ? '<p>El pedido está vacío.</p>' :
                        activePedido.detalles.map(detalle => `
                            <div class="order-item">
                                <span>${detalle.cantidad}x ${detalle.plato.nombre}</span>
                                <div class="order-item-actions">
                                    <span>$${(detalle.subtotal).toLocaleString('es-CL')}</span>
                                    <button class="remove-item-btn" onclick="removerPlatoDelPedido(${detalle.plato.id})">&times;</button>
                                </div>
                            </div>`).join('');
                    
                    orderDetailsContent.innerHTML = `
                        <h4>Pedido #${activePedido.id}</h4>
                        <div id="order-items-container">${detallesHTML}</div><hr>
                        <div class="order-total"><strong>TOTAL:</strong><strong>$${(activePedido.total).toLocaleString('es-CL')}</strong></div>
                        <div class="order-main-actions">
                            <button class="add-products-btn" onclick="openMenuModal()">Añadir Productos</button>
                            <button class="finalize-btn" onclick="finalizarPedido(${activePedido.id})">Finalizar y Pagar</button>
                        </div>`;
                } else {
                    orderDetailsContent.innerHTML = `<p>La mesa está ${selectedTable.estado} pero no tiene pedido activo.</p>
                        <button class="create-table-btn" onclick="iniciarPedido(${tableId})">Iniciar Nuevo Pedido</button>`;
                }
            }
        } catch (error) {
            console.error('Error al seleccionar la mesa:', error);
        }
    } else {
        detailsPanelTitle.textContent = 'Detalles de la Mesa';
        orderDetailsContent.innerHTML = '<p>Selecciona una mesa.</p>';
        orderDetailsContent.classList.add('empty-state');
        activePedido = null;
    }
}

async function iniciarPedido(tableId) {
    try {
        await fetch(`/api/mesas/${tableId}/iniciar_pedido/`, { method: 'POST' });
        await fetchAndRenderTables();
        select_table(tableId);
    } catch (error) { console.error('Error al iniciar el pedido:', error); }
}

async function finalizarPedido(pedidoId) {
    if (confirm('¿Estás seguro de que quieres finalizar y cobrar este pedido?')) {
        try {
            await fetch(`/api/pedidos/${pedidoId}/finalizar/`, { method: 'POST' });
            await fetchAndRenderTables();
        } catch (error) {
            console.error('Error al finalizar el pedido:', error);
            alert('Error al finalizar el pedido.');
        }
    }
}

async function loadMenu() {
    const menuContainer = document.getElementById('menu-items-container');
    try {
        const platos = await fetch('/api/platos/').then(handleApiResponse);
        const menuAgrupado = {'Entrada':[],'Fondo':[],'Postre':[],'Bebida':[]};
        const ordenCategorias = ['Entrada', 'Fondo', 'Postre', 'Bebida'];
        platos.forEach(plato => {
            if (menuAgrupado.hasOwnProperty(plato.categoria)) {
                menuAgrupado[plato.categoria].push(plato);
            }
        });
        let tabsHTML = '<div class="menu-tabs">';
        let contentHTML = '<div class="menu-tab-content">';
        ordenCategorias.forEach((categoria, index) => {
            const platosDeCategoria = menuAgrupado[categoria];
            const isActive = index === 0 ? 'active' : '';
            tabsHTML += `<button class="tab-button ${isActive}" onclick="openMenuTab(event, '${categoria}')">${categoria}</button>`;
            contentHTML += `<div id="${categoria}" class="menu-tab-pane ${isActive}">`;
            if (platosDeCategoria.length > 0) {
                platosDeCategoria.forEach(plato => {
                    contentHTML += `<div class="menu-item"><span>${plato.nombre} - $${plato.precio.toLocaleString('es-CL')}</span><button onclick="addPlatoToPedido(${plato.id})">Agregar</button></div>`;
                });
            } else { contentHTML += '<p>No hay productos en esta categoría.</p>'; }
            contentHTML += '</div>';
        });
        tabsHTML += '</div>';
        contentHTML += '</div>';
        menuContainer.innerHTML = tabsHTML + contentHTML;
    } catch (error) {
        console.error('Error al cargar la carta:', error);
        menuContainer.innerHTML = '<p>Error al cargar la carta.</p>';
    }
}

async function addPlatoToPedido(platoId) {
    if (!activePedido) { return; }
    try {
        const updatedPedido = await fetch(`/api/pedidos/${activePedido.id}/agregar_plato/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plato_id: platoId })
        }).then(handleApiResponse);
        activePedido = updatedPedido;
        select_table(activeTableId);
        closeMenuModal();
    } catch (error) { console.error('Error al agregar el plato:', error); }
}

async function removerPlatoDelPedido(platoId) {
    if (!activePedido) { return; }
    try {
        const updatedPedido = await fetch(`/api/pedidos/${activePedido.id}/remover_plato/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plato_id: platoId })
        }).then(handleApiResponse);
        activePedido = updatedPedido;
        select_table(activeTableId);
    } catch (error) { console.error('Error al remover el plato:', error); }
}

function openMenuTab(evt, categoryName) {
    document.querySelectorAll('.menu-tab-pane').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
    document.getElementById(categoryName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

function openMenuModal() { document.getElementById('menuModal').classList.add('show'); }
function closeMenuModal() { document.getElementById('menuModal').classList.remove('show'); }


document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderTables();
    loadMenu();
    
    const closeMenuBtn = document.getElementById('close-menu-modal-btn');
    if (closeMenuBtn) { closeMenuBtn.addEventListener('click', closeMenuModal); }
    
    const navButtons = document.querySelectorAll('.nav-button');
    if (navButtons.length > 0) {
        const currentPage = window.location.pathname;
        navButtons.forEach(button => {
            button.classList.remove('active');
            if (button.getAttribute('href') === currentPage) {
                button.classList.add('active');
            }
        });
    }
});