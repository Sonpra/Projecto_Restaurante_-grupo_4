
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
        const errorMsg = data.username ? `Usuario: ${data.username[0]}` : (data.detail || data.error || 'Error en la petición');
        throw new Error(errorMsg);
    }
    return data;
}

document.addEventListener('DOMContentLoaded', () => {
    const createEmployeeModal = document.getElementById('createEmployeeModal');
    const createEmployeeForm = document.getElementById('createEmployeeForm');

    async function fetchAndRenderEmployees() {
        const tableBody = document.getElementById('employee-table-body');
        tableBody.innerHTML = '<tr><td colspan="6">Cargando empleados...</td></tr>'; // Mensaje de carga

        try {
            const employees = await apiFetch('/api/empleados/');
            
            if (!employees || employees.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6">No hay empleados creados.</td></tr>';
                return;
            }

            tableBody.innerHTML = ''; // Limpiamos la tabla
            employees.forEach(employee => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${employee.first_name || '-'}</td>
                    <td>${employee.last_name || '-'}</td>
                    <td>${employee.username}</td>
                    <td>${employee.perfil?.rut || 'No especificado'}</td>
                    <td>${employee.perfil?.nacionalidad || 'No especificada'}</td>
                    <td>
                        <button class="remove-item-btn" style="background-color: #dc3545;" disabled title="Próximamente">&times;</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error al cargar los empleados:', error);
            tableBody.innerHTML = `<tr><td colspan="6" style="color: red;">Error al cargar la lista de empleados.</td></tr>`;
        }
    }

    function openCreateEmployeeModal() {
        createEmployeeModal.classList.add('show');
        createEmployeeForm.reset();
        document.getElementById('employeeFirstName').focus();
    }

    function closeCreateEmployeeModal() {
        createEmployeeModal.classList.remove('show');
    }

    createEmployeeForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const firstName = document.getElementById('employeeFirstName').value.trim();
        const lastName = document.getElementById('employeeLastName').value.trim();
        const rut = document.getElementById('employeeRut').value.trim();
        const nationality = document.getElementById('employeeNationality').value.trim();
        const password = document.getElementById('employeePassword').value;

        const username = `${firstName.split(' ')[0].toLowerCase()}.${lastName.split(' ')[0].toLowerCase()}`;

        const employeeData = {
            username: username,
            password: password,
            first_name: firstName,
            last_name: lastName,
            perfil: {
                rut: rut,
                nacionalidad: nationality
            }
        };

        try {
            await apiFetch('/api/empleados/', {
                method: 'POST',
                body: employeeData
            });
            alert(`¡Empleado ${firstName} ${lastName} creado con éxito!\nUsuario: ${username}`);
            closeCreateEmployeeModal();
            fetchAndRenderEmployees(); 
        } catch (error) {
            alert(`Error al crear el empleado: ${error.message}`);
        }
    });

    document.getElementById('main-create-employee-btn').addEventListener('click', openCreateEmployeeModal);
    document.getElementById('cancel-create-employee-btn').addEventListener('click', closeCreateEmployeeModal);

    fetchAndRenderEmployees();
});