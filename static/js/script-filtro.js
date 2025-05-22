// Asegúrate de que este código esté dentro de tu script.js
// Asegúrate de que tu listener de eventos para #equipmentList esté activo

document.addEventListener('DOMContentLoaded', function() {
    const equipmentListDiv = document.getElementById('equipmentList');

    if (equipmentListDiv) {
        // Usar delegación de eventos en el contenedor de la lista
        equipmentListDiv.addEventListener('click', function(event) {
            const clickedButton = event.target;

            // Verificar si el clic fue en uno de los botones de acceso
            // Usamos clases específicas para distinguir los botones
            if (clickedButton.classList.contains('access-button')) {
                const equipmentItem = clickedButton.closest('.equipment-item');

                if (equipmentItem) {
                    const driveId = equipmentItem.dataset.id; // Obtener el ID de Drive del data-id del ítem padre

                    if (driveId) {
                        // --- MODIFICACIÓN AQUÍ ---
                        if (clickedButton.classList.contains('view-docs-button')) {
                            // --- Acción para "Ver documentación" ---
                            // === CONSTRUIR LA URL DE LA RUTA /carpeta Y NAVEGAR ===
                            // La ruta /carpeta/<folder_id> usará folder_id = driveId del equipo
                            const carpetaUrl = `/carpeta/${driveId}`; 
                            window.location.href = carpetaUrl; // Navega en la misma pestaña
                            // ======================================================

                        } else if (clickedButton.classList.contains('maintenance-button')) {
                            // --- Acción para "Realizar mantenimiento" (Se mantiene igual) ---
                            // Redirigir a la ruta de mantenimiento con el ID del equipo
                            const maintenanceUrl = `/Mantenimiento/${driveId}`; 
                            window.location.href = maintenanceUrl; // Navega en la misma pestaña
                        }
                        // --- FIN MODIFICACIÓN ---

                    } else {
                        console.error('ID de Drive no encontrado en el atributo data-id del ítem de equipo.', equipmentItem);
                        alert('Error: No se pudo obtener el ID del equipo.');
                    }
                }
            }
        });

        // ... Otras lógicas de tu script.js (como filtrarEquipos() si la usas para el submit del form) ...

    } else {
        console.error('Elemento #equipmentList no encontrado en el DOM.');

    }

    // --- MENÚ PRINCIPAL (BOTÓN '+') ---
    const menuPrincipal = document.getElementById('menuOpciones');
    const toggleMenuPrincipalButton = document.querySelector('.btn-add-inside');

    if (toggleMenuPrincipalButton && menuPrincipal) {
        toggleMenuPrincipalButton.addEventListener('click', (event) => {
            event.stopPropagation();
            menuPrincipal.classList.toggle('menu-visible');
        });

        document.addEventListener('click', (event) => {
            if (!menuPrincipal.contains(event.target) && !toggleMenuPrincipalButton.contains(event.target)) {
                menuPrincipal.classList.remove('menu-visible');
            }
        });

        menuPrincipal.querySelectorAll('.menu-opcion').forEach(opcion => {
            if (opcion.id !== 'triggerFileUpload') {
                opcion.addEventListener('click', () => {
                    menuPrincipal.classList.remove('menu-visible');
                });
            }
        });
    }
});

// Si tu script.js contenía lógica para controlar un modal de documentación,
// y ya no lo necesitas en ninguna parte, puedes remover ese código del script.