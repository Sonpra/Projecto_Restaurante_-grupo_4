document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderHistory();
});

async function fetchAndRenderHistory() {
    const tableBody = document.getElementById('history-table-body');
    tableBody.innerHTML = '<tr><td colspan="4">Cargando historial...</td></tr>';

    try {
        const pedidosCompletados = await fetch('/api/pedidos/?completado=true').then(handleApiResponse);

        if (!pedidosCompletados || pedidosCompletados.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4">No hay pedidos en el historial.</td></tr>';
            return;
        }

        tableBody.innerHTML = '';
        pedidosCompletados.forEach(pedido => {
            const row = document.createElement('tr');
            const fecha = new Date(pedido.fecha_creacion);
            const fechaFormateada = fecha.toLocaleString('es-CL');

            row.innerHTML = `
                <td>${pedido.id}</td>
                <td>${pedido.mesa ? pedido.mesa.nombre : 'Mesa eliminada'}</td>
                <td>${fechaFormateada}</td>
                <td>$${pedido.total.toLocaleString('es-CL')}</td>
            `;
            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Error al cargar el historial:', error);
        tableBody.innerHTML = '<tr><td colspan="4" style="color: red;">Error al cargar el historial.</td></tr>';
    }
}

async function handleApiResponse(response) {
    const textData = await response.text();
    if (!response.ok) {
        let errorDetails = {};
        try { errorDetails = JSON.parse(textData); } catch (e) {
            errorDetails.error = textData || `Error HTTP: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorDetails.error || `Error desconocido: ${response.status} ${response.statusText}`);
    }
    if (response.status === 204) { return []; } // Devuelve un array vacío para DELETE exitoso
    try { return JSON.parse(textData); } catch (e) {
        console.warn('Respuesta de API no es JSON válido:', textData);
        return {};
    }
}