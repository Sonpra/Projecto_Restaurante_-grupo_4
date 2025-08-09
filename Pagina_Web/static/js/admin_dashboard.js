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

// --- Lógica del Dashboard de Admin ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Selectores Globales ---
    const tablesGrid = document.getElementById('admin-tables-grid');
    const floorsTabsContainer = document.getElementById('floors-tabs-container');
    let allFloors = [];
    let activeFloorId = null;
    let allTablesForReservations = [];

    // --- LÓGICA DE PISOS Y MESAS ---
    async function fetchFloorsAndRenderAll() {
        try {
            allFloors = await apiFetch('/api/pisos/');
            floorsTabsContainer.innerHTML = '';

            if (!allFloors || allFloors.length === 0) {
                tablesGrid.innerHTML = '<p>No hay pisos creados. Haz clic en "Gestionar Pisos" para añadir el primero.</p>';
                activeFloorId = null;
                floorsTabsContainer.innerHTML = ''; 
                return;
            }
            
            allFloors.forEach((floor, index) => {
                const tabButton = document.createElement('button');
                tabButton.className = 'tab-button';
                tabButton.textContent = floor.nombre;
                tabButton.dataset.floorId = floor.id;
                
                if (activeFloorId === null && index === 0) {
                    activeFloorId = floor.id;
                }
                
                if (activeFloorId === floor.id) {
                    tabButton.classList.add('active');
                }
                floorsTabsContainer.appendChild(tabButton);
            });

            if (!allFloors.some(f => f.id === activeFloorId) && allFloors.length > 0) {
                activeFloorId = allFloors[0].id;
                floorsTabsContainer.querySelector('.tab-button').classList.add('active');
            }
            renderTablesForFloor(activeFloorId);
        } catch (error) {
            console.error('Error al cargar los pisos:', error);
            floorsTabsContainer.innerHTML = `<p style="color: red;">Error al cargar pisos.</p>`;
        }
    }

    function renderTablesForFloor(floorId) {
        const floor = allFloors.find(f => f.id === floorId);
        tablesGrid.innerHTML = '';
        if (!floor || !floor.mesas || floor.mesas.length === 0) {
            tablesGrid.innerHTML = '<p>Este piso no tiene mesas creadas.</p>';
            return;
        }
        floor.mesas.forEach(table => {
            const tableCard = document.createElement('div');
            tableCard.classList.add('table-card');
            const isActionable = table.estado !== 'Ocupada';
            tableCard.innerHTML = `
                <div class="table-info"><h3>${table.nombre}</h3><p>Capacidad: ${table.capacidad}</p><span class="table-status status-${table.estado.replace(/\s/g, '')}">${table.estado}</span></div>
                <div class="table-card-actions"><button title="Poner en Mantenimiento" data-action="maintenance" data-id="${table.id}" ${!isActionable || table.estado === 'Mantenimiento' ? 'disabled' : ''}>🔧</button><button title="Marcar como Libre" data-action="free" data-id="${table.id}" ${!isActionable || table.estado === 'Libre' ? 'disabled' : ''}>✅</button><button title="Eliminar Mesa" class="delete-table-btn" data-action="delete" data-id="${table.id}" ${!isActionable ? 'disabled' : ''}>❌</button></div>
            `;
            tablesGrid.appendChild(tableCard);
        });
    }

    floorsTabsContainer.addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON') {
            activeFloorId = parseInt(event.target.dataset.floorId);
            document.querySelectorAll('#floors-tabs-container .tab-button').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            renderTablesForFloor(activeFloorId);
        }
    });

    async function changeTableState(tableId, newState) {
        try {
            await apiFetch(`/api/mesas/${tableId}/cambiar_estado/`, { method: 'POST', body: { estado: newState } });
            await fetchFloorsAndRenderAll();
            await fetchAndRenderReservations();
        } catch (error) {
            alert(`Error al cambiar el estado: ${error.message}`);
        }
    }

    async function deleteTable(tableId) {
        if (confirm('¿Estás seguro de que quieres eliminar esta mesa?')) {
            try {
                await apiFetch(`/api/mesas/${tableId}/`, { method: 'DELETE' });
                await fetchFloorsAndRenderAll();
                await fetchAndRenderReservations();
            } catch (error) {
                alert(`Error al eliminar la mesa: ${error.message}`);
            }
        }
    }

    tablesGrid.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        const action = button.dataset.action;
        const tableId = button.dataset.id;
        if (action === 'maintenance') changeTableState(tableId, 'Mantenimiento');
        else if (action === 'free') changeTableState(tableId, 'Libre');
        else if (action === 'delete') deleteTable(tableId);
    });

    const createTableModal = document.getElementById('createTableModal');
    const createTableForm = document.getElementById('createTableForm');
    const tableFloorSelect = document.getElementById('tableFloor');

    function openCreateTableModal() {
        if (!allFloors || allFloors.length === 0) {
            alert("Primero debe crear un piso en 'Gestionar Pisos'.");
            return;
        }
        createTableForm.reset();
        tableFloorSelect.innerHTML = '';
        allFloors.forEach(floor => {
            const option = document.createElement('option');
            option.value = floor.id;
            option.textContent = floor.nombre;
            tableFloorSelect.appendChild(option);
        });
        tableFloorSelect.value = activeFloorId;
        createTableModal.classList.add('show');
    }

    function closeCreateTableModal() { createTableModal.classList.remove('show'); }

    createTableForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const pisoId = document.getElementById('tableFloor').value;
        const tableData = {
            nombre: document.getElementById('tableName').value.trim(),
            capacidad: parseInt(document.getElementById('tableCapacity').value),
            piso: pisoId,
            estado: 'Libre'
        };
        if (tableData.nombre && tableData.capacidad > 0 && tableData.piso) {
            try {
                await apiFetch('/api/mesas/', { method: 'POST', body: tableData });
                closeCreateTableModal();
                activeFloorId = parseInt(pisoId);
                await fetchFloorsAndRenderAll();
                await fetchAndRenderReservations();
            } catch (error) {
                alert(`Error al crear la mesa: ${error.message}`);
            }
        }
    });

    // --- LÓGICA DE RESERVAS ---
    const reservationTableBody = document.getElementById('reservations-table-body');
    const reservationModal = document.getElementById('reservationModal');
    const reservationForm = document.getElementById('reservationForm');
    const reservationTableSelect = document.getElementById('reservationTable');
    
    async function fetchAndRenderReservations() {
        try {
            allTablesForReservations = await apiFetch('/api/mesas/');
            const reservations = await apiFetch('/api/reservas/');
            reservationTableBody.innerHTML = '';
            if (!reservations || reservations.length === 0) {
                reservationTableBody.innerHTML = '<tr><td colspan="5">No hay reservas programadas.</td></tr>';
            } else {
                reservations.forEach(res => {
                    const row = document.createElement('tr');
                    const reservationDate = new Date(res.fecha_hora);
                    row.innerHTML = `
                        <td>${res.mesa_nombre || 'Mesa eliminada'}</td>
                        <td>${res.nombre_cliente}</td>
                        <td>${reservationDate.toLocaleString('es-CL')}</td>
                        <td>${res.cantidad_personas}</td>
                        <td><button class="remove-item-btn" onclick="deleteReservation(${res.id})">&times;</button></td>
                    `;
                    reservationTableBody.appendChild(row);
                });
            }
        } catch (error) {
            console.error('Error al cargar las reservas:', error);
            reservationTableBody.innerHTML = '<tr><td colspan="5" style="color: red;">Error al cargar las reservas.</td></tr>';
        }
    }
    
    function populateTableSelect() {
        reservationTableSelect.innerHTML = '<option value="">Seleccione una mesa...</option>';
        const availableTables = allTablesForReservations.filter(t => t.estado === 'Libre');
        availableTables.forEach(table => {
            const option = document.createElement('option');
            option.value = table.id;
            option.textContent = `${table.nombre} (${table.piso_nombre} - Cap: ${table.capacidad})`;
            reservationTableSelect.appendChild(option);
        });
    }

    function openReservationModal() {
        reservationForm.reset();
        populateTableSelect();
        reservationModal.classList.add('show');
    }

    function closeReservationModal() { reservationModal.classList.remove('show'); }

    window.deleteReservation = async function(reservationId) {
        if (confirm('¿Estás seguro de que quieres eliminar la reserva?')) {
            try {
                await apiFetch(`/api/reservas/${reservationId}/`, { method: 'DELETE' });
                await fetchFloorsAndRenderAll();
                await fetchAndRenderReservations();
            } catch (error) {
                alert(`Error al eliminar la reserva: ${error.message}`);
            }
        }
    }

    reservationForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const reservationData = {
            mesa: document.getElementById('reservationTable').value,
            nombre_cliente: document.getElementById('reservationClient').value,
            fecha_hora: document.getElementById('reservationDateTime').value,
            cantidad_personas: document.getElementById('reservationGuests').value,
            notas: document.getElementById('reservationNotes').value,
        };
        try {
            await apiFetch('/api/reservas/', { method: 'POST', body: reservationData });
            closeReservationModal();
            await fetchFloorsAndRenderAll();
            await fetchAndRenderReservations();
        } catch (error) {
            alert(`Error al guardar la reserva: ${error.message}`);
        }
    });
    
    // --- LÓGICA DE INCIDENTES ---
    const incidentModal = document.getElementById('incidentModal');
    const incidentForm = document.getElementById('incidentForm');

    function openIncidentModal() {
        incidentForm.reset();
        incidentModal.classList.add('show');
    }

    function closeIncidentModal() {
        incidentModal.classList.remove('show');
    }

    incidentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const incidentData = {
            tipo: document.getElementById('incidentType').value,
            mensaje: document.getElementById('incidentMessage').value,
        };
        try {
            await apiFetch('/api/incidentes/', { method: 'POST', body: incidentData });
            closeIncidentModal();
            alert('Incidente registrado con éxito.');
        } catch (error) {
            alert(`Error al registrar el incidente: ${error.message}`);
        }
    });

    // --- LÓGICA DE GESTIÓN DE PISOS ---
    const manageFloorsModal = document.getElementById('manageFloorsModal');
    const currentFloorsList = document.getElementById('current-floors-list');

    function openManageFloorsModal() {
        if (allFloors.length > 0) {
            let floorNames = allFloors.map(f => f.nombre).join(', ');
            currentFloorsList.innerHTML = `<p><strong>Pisos actuales:</strong> ${floorNames}</p>`;
        } else {
            currentFloorsList.innerHTML = '<p>Actualmente no hay ningún piso creado.</p>';
        }
        manageFloorsModal.classList.add('show');
    }

    function closeManageFloorsModal() { manageFloorsModal.classList.remove('show'); }

    async function addNewFloor() {
        const nextFloorNum = allFloors.length > 0 ? Math.max(...allFloors.map(f => f.numero)) + 1 : 1;
        const newFloorData = { nombre: `Piso ${nextFloorNum}`, numero: nextFloorNum };
        try {
            await apiFetch('/api/pisos/', { method: 'POST', body: newFloorData });
            await fetchFloorsAndRenderAll();
            closeManageFloorsModal();
        } catch (error) {
            alert(`Error al añadir el piso: ${error.message}`);
        }
    }

    async function deleteLastFloor() {
        if (allFloors.length === 0) {
            alert("No hay pisos para eliminar.");
            return;
        }
        const lastFloor = allFloors.reduce((prev, current) => (prev.numero > current.numero) ? prev : current);
        const warning = `¡ATENCIÓN!\n\nAl eliminar el "${lastFloor.nombre}", se borrarán también TODAS las mesas que contiene.\n\n¿Estás seguro de que quieres continuar?`;
        if (confirm(warning)) {
            try {
                await apiFetch(`/api/pisos/${lastFloor.id}/`, { method: 'DELETE' });
                activeFloorId = null;
                await fetchFloorsAndRenderAll();
                closeManageFloorsModal();
            } catch (error) {
                alert(`Error al eliminar el piso: ${error.message}`);
            }
        }
    }

    // --- EVENT LISTENERS ---
    document.getElementById('main-create-table-btn').addEventListener('click', openCreateTableModal);
    document.getElementById('cancel-create-table-btn').addEventListener('click', closeCreateTableModal);

    document.getElementById('main-create-reservation-btn').addEventListener('click', openReservationModal);
    document.getElementById('cancel-reservation-btn').addEventListener('click', closeReservationModal);

    document.getElementById('main-register-incident-btn').addEventListener('click', openIncidentModal);
    document.getElementById('cancel-incident-btn').addEventListener('click', closeIncidentModal);
    
    document.getElementById('manage-floors-btn').addEventListener('click', openManageFloorsModal);
    document.getElementById('cancel-manage-floors-btn').addEventListener('click', closeManageFloorsModal);
    document.getElementById('add-new-floor-btn').addEventListener('click', addNewFloor);
    document.getElementById('delete-last-floor-btn').addEventListener('click', deleteLastFloor);

    // --- CARGA INICIAL ---
    fetchFloorsAndRenderAll();
    fetchAndRenderReservations();
});