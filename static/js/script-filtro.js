// En tu archivo static/js/script-filtro.js

document.addEventListener('DOMContentLoaded', function() {
    const equipmentListDiv = document.getElementById('equipmentList');

    // Estas variables globales se definen en filtro.html si necesitas usarlas para otras cosas,
    // como el botón "Limpiar Filtros" si lo implementas.
    // const currentPageEntidad = typeof CURRENT_ENTIDAD_JSON_KEY !== 'undefined' ? CURRENT_ENTIDAD_JSON_KEY : null;
    // const currentPageEmpresa = typeof CURRENT_EMPRESA !== 'undefined' ? CURRENT_EMPRESA : null;

    if (equipmentListDiv) {
        equipmentListDiv.addEventListener('click', function(event) {
            const clickedButton = event.target.closest('.access-button'); // Mejor usar closest para asegurar que obtenemos el botón

            if (clickedButton) { // Verificar que realmente se hizo clic en un botón con clase .access-button
                const equipmentItem = clickedButton.closest('.equipment-item');

                if (equipmentItem) {
                    const driveId = equipmentItem.dataset.id;
                    
                    // --- NUEVO: Obtener entidad y empresa de los data-attributes del ítem ---
                    const entidadParaJson = equipmentItem.dataset.entidad;
                    const empresaActual = equipmentItem.dataset.empresa;
                    // --- FIN NUEVO ---

                    if (driveId) {
                        if (!empresaActual || !entidadParaJson) {
                            console.error('Faltan data-empresa o data-entidad en el equipment-item:', equipmentItem);
                            alert('Error: No se pudo determinar la empresa o entidad para este equipo.');
                            return; // Salir si faltan datos cruciales
                        }

                        if (clickedButton.classList.contains('view-docs-button')) {
                            // --- Acción para "Ver documentación" ---
                            // Construye la URL para /carpeta/<folder_id> (ruta 'ver_equipos')
                            // Necesita ?empresa= y ?entidad_json_key=
                            const carpetaUrl = `/carpeta/${driveId}?empresa=${encodeURIComponent(empresaActual)}&entidad_json_key=${encodeURIComponent(entidadParaJson)}`; 
                            // window.location.href = carpetaUrl; // Navega en la misma pestaña
                            window.open(carpetaUrl, '_blank'); // RECOMENDADO: Abrir en nueva pestaña para no perder filtros

                        } else if (clickedButton.classList.contains('maintenance-button')) {
                            // --- Acción para "Realizar mantenimiento" ---
                            // Construye la URL para /Mantenimiento/<folder_id> (ruta 'mantenimiento')
                            // Necesita ?empresa= y ?entidad_json=
                            const maintenanceUrl = `/Mantenimiento/${driveId}?empresa=${encodeURIComponent(empresaActual)}&entidad_json=${encodeURIComponent(entidadParaJson)}`; 
                            // window.location.href = maintenanceUrl; // Navega en la misma pestaña
                            window.open(maintenanceUrl, '_blank'); // RECOMENDADO: Abrir en nueva pestaña
                        }
                    } else {
                        console.error('ID de Drive no encontrado en el atributo data-id del ítem de equipo.', equipmentItem);
                        alert('Error: No se pudo obtener el ID del equipo.');
                    }
                }
            }
        });
    } else {
        console.error('Elemento #equipmentList no encontrado en el DOM.');
    }

    // --- MENÚ PRINCIPAL (BOTÓN '+') ---
    // Tu código para el menú principal se mantiene igual, está bien.
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
            if (opcion.id !== 'triggerFileUpload') { // Asumo que triggerFileUpload es de otra página o no relevante aquí
                opcion.addEventListener('click', () => {
                    menuPrincipal.classList.remove('menu-visible');
                });
            }
        });
    }
});