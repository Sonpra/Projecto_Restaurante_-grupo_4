// --- Bloque de Seguridad (CSRF) ---
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
    if (response.status === 204) { return null; }
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || data.error || 'Error en la petición');
    }
    return data;
}

// --- Lógica del Dashboard de Admin ---
const tablesGrid = document.querySelector('.tables-grid');
const createTableModal = document.getElementById('createTableModal');
const createTableForm = document.getElementById('createTableForm');

async function fetchAndRenderTables() {
    try {
        const tablesData = await apiFetch('/api/mesas/');
        tablesGrid.innerHTML = '';
        if (!tablesData || tablesData.length === 0) {
            tablesGrid.innerHTML = '<p style="text-align: center; color: #777; margin-top: 50px;">No hay mesas creadas.</p>';
        } else {
            tablesData.forEach(table => {
                const tableCard = document.createElement('div');
                tableCard.classList.add('table-card');
                const statusClass = `status-${table.estado.replace(/\s/g, '')}`;
                tableCard.innerHTML = `
                    <h3>${table.nombre}</h3>
                    <p>Capacidad: ${table.capacidad}</p>
                    <span class="table-status ${statusClass}">${table.estado}</span>
                    <button class="delete-table-btn" onclick="deleteTable(${table.id})">&times;</button>
                `;
                tablesGrid.appendChild(tableCard);
            });
        }
    } catch (error) {
        console.error('Error al cargar las mesas:', error);
        tablesGrid.innerHTML = `<p style="text-align: center; color: red;">Error al cargar las mesas: ${error.message}</p>`;
    }
}

async function deleteTable(tableId) {
    if (confirm(`¿Estás seguro de que quieres eliminar esta mesa?`)) {
        try {
            await apiFetch(`/api/mesas/${tableId}/`, { method: 'DELETE' });
            await fetchAndRenderTables();
        } catch (error) {
            console.error(`Error al eliminar mesa:`, error);
            alert(`Error al eliminar la mesa: ${error.message}`);
        }
    }
}

function openCreateTableModal() {
    createTableModal.classList.add('show');
    createTableForm.reset();
    document.getElementById('tableName').focus();
}

function closeCreateTableModal() {
    createTableModal.classList.remove('show');
}

createTableForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const tableName = document.getElementById('tableName').value.trim();
    const tableCapacity = parseInt(document.getElementById('tableCapacity').value);
    
    if (tableName && tableCapacity > 0) {
        try {
            await apiFetch('/api/mesas/', {
                method: 'POST',
                body: { nombre: tableName, capacidad: tableCapacity, estado: 'Libre' }
            });
            closeCreateTableModal();
            await fetchAndRenderTables();
        } catch (error) {
            console.error('Error al crear la mesa:', error);
            alert(`Error al crear la mesa: ${error.message}`);
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderTables();
    document.getElementById('main-create-table-btn').addEventListener('click', openCreateTableModal);
    document.getElementById('cancel-create-table-btn').addEventListener('click', closeCreateTableModal);
});