// --- Función Helper para mostrar mensajes Toast ---
function showToast(message, type = 'info', duration = 3500) {
    const toast = document.getElementById('toast-message');
    if (!toast) {
        console.warn("Elemento Toast con id 'toast-message' no encontrado. Usando alert.");
        alert(message); 
        return;
    }
    toast.textContent = message;
    toast.classList.remove('info', 'error', 'success'); 
    toast.className = 'toast show'; 
    if (type === 'error') {
        toast.classList.add('error');
    } else if (type === 'success') {
        toast.classList.add('success');
    } else {
        toast.classList.add('info'); 
    }
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM completamente cargado y parseado.");

    // --- MENÚ PRINCIPAL (BOTÓN '+') ---
    const menuPrincipal = document.getElementById('menuOpciones');
    const toggleMenuPrincipalButton = document.querySelector('.btn-add-inside');

    if (toggleMenuPrincipalButton && menuPrincipal) {
        toggleMenuPrincipalButton.addEventListener('click', (event) => {
            event.stopPropagation();
            menuPrincipal.classList.toggle('menu-visible');
        });

        document.addEventListener('click', (event) => {
            const registrarEquipoModal = document.getElementById('registrarEquipoModal');
            const isClickInsideModal = registrarEquipoModal && registrarEquipoModal.contains(event.target) && registrarEquipoModal.style.display === 'flex';

            if (!isClickInsideModal && !toggleMenuPrincipalButton.contains(event.target) && !menuPrincipal.contains(event.target)) {
                menuPrincipal.classList.remove('menu-visible');
            }
        });

        menuPrincipal.querySelectorAll('.menu-opcion').forEach(opcion => {
            if (opcion.id !== 'triggerFileUpload' && opcion.id !== 'btnRegistrarNuevoEquipoGlobalMenu' && opcion.id !== 'btnRegistrarNuevoEquipoModalTrigger') {
                opcion.addEventListener('click', (event) => {
                    setTimeout(() => {
                        menuPrincipal.classList.remove('menu-visible');
                    }, 50);
                });
            } else {
                 opcion.addEventListener('click', (event) => {
                    event.stopPropagation(); 
                 });
            }
        });
    } else {
        console.warn("Advertencia: Elementos del menú principal ('#menuOpciones') o su toggle ('.btn-add-inside') no encontrados.");
    }

    // --- MODAL DE REGISTRO DE NUEVO EQUIPO ---
    const registrarEquipoModal = document.getElementById('registrarEquipoModal');
    const btnsOpenModalRegistrarEquipo = document.querySelectorAll('#btnRegistrarNuevoEquipoGlobalMenu, #btnRegistrarNuevoEquipoModalTrigger'); 
    
    const btnCloseModal = registrarEquipoModal?.querySelector('.modal-close-button');
    const btnCancelModal = registrarEquipoModal?.querySelector('.modal-cancel-button');
    const formRegistrarEquipo = document.getElementById('formRegistrarEquipo');
    
    const modalServiceNameDisplay = document.getElementById('modalServiceNameDisplay');
    const modalServiceKeyInput = document.getElementById('modalServiceKeyForJson');
    const modalParentDriveFolderIdInput = document.getElementById('modalParentDriveFolderId');
    const modalEquipoNombreInput = document.getElementById('modalEquipoNombre');
    const modalEquipoMarcaModeloInput = document.getElementById('modalEquipoMarcaModelo');
    const modalEquipoSerieInput = document.getElementById('modalEquipoSerie');
    const modalEquipoUbicacionInput = document.getElementById('modalEquipoUbicacion');
    const modalEntidadJsonInput = document.getElementById('modalEntidadJson'); // Para la modal de registro
    const modalEmpresaInput = document.getElementById('modalEmpresa');       // Para la modal de registro

    if (btnsOpenModalRegistrarEquipo.length > 0 && registrarEquipoModal) {
        btnsOpenModalRegistrarEquipo.forEach(button => {
            button.addEventListener('click', function(event) { 
                event.preventDefault();
                if (menuPrincipal) menuPrincipal.classList.remove('menu-visible');

                const entidadJson = this.dataset.entidadJsonKey || this.dataset.entidadJsonKkey;
                const empresa = this.dataset.empresa;
                let serviceNameForJson = this.dataset.currentServiceName;
                let parentDriveFolderId = this.dataset.parentFolderId;

                console.log("Abriendo modal de registro. Datos del botón:", { entidadJson, empresa, serviceNameForJson, parentDriveFolderId });

                if (serviceNameForJson) {
                    serviceNameForJson = serviceNameForJson.trim().toUpperCase();
                }

                if ((!serviceNameForJson || serviceNameForJson === "SERVICIO GENERAL") && !parentDriveFolderId ) {
                    let promptedServiceName = prompt("Introduce el nombre del SERVICIO (ej: AMBULANCIA, QUIROFANO) para el nuevo equipo. Se guardará en mayúsculas:");
                    if (!promptedServiceName || promptedServiceName.trim() === "") {
                        showToast("Se requiere un nombre de servicio para registrar un equipo.", 'error');
                        return; 
                    }
                    serviceNameForJson = promptedServiceName.trim().toUpperCase();
                    // Si se pide el nombre del servicio, parentDriveFolderId DEBE ser el ID de la carpeta de la ENTIDAD
                    // El botón que abre la modal debe tener este ID de entidad en data-parent-folder-id
                    // o se debe obtener de otra forma (ej. una variable global JS si siempre es la misma entidad en la página).
                    // Este es un punto crítico para asegurar que la carpeta del nuevo servicio se cree en el lugar correcto.
                    // Por ahora, si se ingresa el nombre, mantenemos el parentDriveFolderId que traiga el botón.
                    // Si parentDriveFolderId es vacío aquí, la creación en Drive podría ir a la raíz del usuario.
                    if (!parentDriveFolderId) {
                        console.warn("Nombre de servicio ingresado por prompt, pero no hay parentDriveFolderId. La carpeta de servicio se creará en la raíz de Drive del usuario o donde la API determine.");
                    }
                }
                
                if(modalEntidadJsonInput) modalEntidadJsonInput.value = entidadJson || '';
                if(modalEmpresaInput) modalEmpresaInput.value = empresa || '';
                if(modalServiceNameDisplay) modalServiceNameDisplay.textContent = serviceNameForJson || 'N/A';
                if(modalServiceKeyInput) modalServiceKeyInput.value = serviceNameForJson || ''; 
                if(modalParentDriveFolderIdInput) modalParentDriveFolderIdInput.value = parentDriveFolderId || ''; 
                
                if(formRegistrarEquipo) formRegistrarEquipo.reset(); 

                registrarEquipoModal.style.display = 'flex'; 
                setTimeout(() => {
                    if(modalEquipoNombreInput) modalEquipoNombreInput.focus(); 
                }, 100); 
            });
        });
    }

    if (btnCloseModal && registrarEquipoModal) btnCloseModal.addEventListener('click', () => { registrarEquipoModal.style.display = 'none'; if(formRegistrarEquipo) formRegistrarEquipo.reset(); });
    if (btnCancelModal && registrarEquipoModal) btnCancelModal.addEventListener('click', () => { registrarEquipoModal.style.display = 'none'; if(formRegistrarEquipo) formRegistrarEquipo.reset(); });
    if (registrarEquipoModal) {
        registrarEquipoModal.addEventListener('click', (event) => {
            if (event.target === registrarEquipoModal) {
                registrarEquipoModal.style.display = 'none';
                if(formRegistrarEquipo) formRegistrarEquipo.reset();
            }
        });
    }

    if (formRegistrarEquipo) {
        formRegistrarEquipo.addEventListener('submit', async (event) => {
            event.preventDefault(); 

            const nombreInputVal = modalEquipoNombreInput ? modalEquipoNombreInput.value.trim() : '';
            const marcaModeloInputVal = modalEquipoMarcaModeloInput ? modalEquipoMarcaModeloInput.value.trim() : '';
            const serieInputVal = modalEquipoSerieInput ? modalEquipoSerieInput.value.trim() : '';
            const ubicacionInputVal = modalEquipoUbicacionInput ? modalEquipoUbicacionInput.value.trim() : '';
            const serviceKeyInputVal = modalServiceKeyInput ? modalServiceKeyInput.value : '';
            const parentFolderIdInputVal = modalParentDriveFolderIdInput ? modalParentDriveFolderIdInput.value : '';
            const entidadJsonParaApi = modalEntidadJsonInput ? modalEntidadJsonInput.value : '';
            const empresaParaApi = modalEmpresaInput ? modalEmpresaInput.value : '';

            if (!nombreInputVal) { showToast('El nombre del equipo es obligatorio.', 'error'); if(modalEquipoNombreInput) modalEquipoNombreInput.focus(); return; }
            if (!serviceKeyInputVal) { showToast('Error interno: No se pudo determinar el servicio.', 'error'); return; }
            if (!entidadJsonParaApi) { showToast('Error interno: No se pudo determinar la entidad para el registro.', 'error'); console.error("Submit Error: entidadJsonParaApi está vacío."); return; }
            if (!parentFolderIdInputVal) { showToast('Error interno: No se pudo determinar la carpeta de servicio en Drive.', 'error'); console.error("Submit Error: parentFolderIdInputVal está vacío."); return; }

            const equipoDetails = {
                nombre: nombreInputVal.toUpperCase(),
                marca_modelo: marcaModeloInputVal,
                serie: serieInputVal,
                ubicacion: ubicacionInputVal
            };

            const dataToSend = {
                entidad_json_key: entidadJsonParaApi,
                empresa: empresaParaApi,            
                service_key_for_json: serviceKeyInputVal, 
                parent_drive_folder_id: parentFolderIdInputVal, 
                equipo_details: equipoDetails
            };

            console.log("[Registrar Equipo Submit] Datos a enviar:", JSON.stringify(dataToSend, null, 2));
            showToast('Registrando equipo y creando carpeta...', 'info', 15000);

            try {
                const response = await fetch('/api/registrar_equipo_completo', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToSend)
                });
                const result = await response.json(); 
                if (response.ok && result.success) { 
                    showToast(result.message || 'Equipo registrado!', 'success', 5000);
                    registrarEquipoModal.style.display = 'none'; 
                    if(formRegistrarEquipo) formRegistrarEquipo.reset(); 
                    setTimeout(() => window.location.reload(), 2000);
                } else { 
                    const errorMsg = result.error || 'Error desconocido del servidor.';
                    showToast(`Error al registrar equipo: ${errorMsg}`, 'error', 7000);
                }
            } catch (error) { 
                showToast('Error de red o conexión al registrar.', 'error', 7000);
            }
        });
    }

    // --- SUBIDA DE ARCHIVOS INDIVIDUALES ---
    const triggerUploadButton = document.getElementById('triggerFileUpload');
    const fileUploaderInput = document.getElementById('fileUploader');
    if (triggerUploadButton && fileUploaderInput) { /* ... tu código de subida ... */ }

    // =====================================================
    // Lógica para Menús y Eliminación de EQUIPOS (Carpetas)
    // =====================================================
    async function eliminarEquipo(folderId, elementToRemove, entidadJsonParaEliminar) { // Acepta entidadJsonParaEliminar
        if (!confirm('¡ADVERTENCIA! ¿Estás seguro de que quieres eliminar este equipo y TODO su contenido? Esta acción no se puede deshacer.')) {
            console.log("[Eliminar Equipo] Eliminación cancelada por el usuario.");
            return;
        }

        // --- MODIFICACIÓN: Validar entidadJsonParaEliminar ---
        if (!entidadJsonParaEliminar) {
            console.error("[Eliminar Equipo] Error: Falta la clave de entidad (entidad_json_key) para la eliminación.");
            showToast('Error interno: No se pudo determinar la entidad del equipo a eliminar.', 'error');
            return;
        }
        // --- FIN MODIFICACIÓN ---

        console.log(`[Eliminar Equipo] Procediendo a eliminar equipo ID: ${folderId} de entidad: ${entidadJsonParaEliminar}`);
        showToast('Eliminando equipo y su contenido...', 'info');

        try {
            // --- MODIFICACIÓN: Incluir entidad_json_key en el payload ---
            const payload = { 
                folderId: folderId,
                entidad_json_key: entidadJsonParaEliminar 
            };
            // --- FIN MODIFICACIÓN ---

            const response = await fetch('/delete_equipo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            console.log("[Eliminar Equipo] Respuesta del servidor:", { status: response.status, ok: response.ok, body: result });

            if (response.ok && result.success) {
                showToast(`Equipo eliminado con éxito!`, 'success', 4000);
                if (elementToRemove?.parentNode) {
                    elementToRemove.parentNode.removeChild(elementToRemove);
                }
            } else {
                let errorMessage = result.error || `Error HTTP ${response.status}.`;
                if (response.status === 404) errorMessage = 'Error: El equipo (carpeta) no fue encontrado en Drive.';
                if (response.status === 403) errorMessage = 'Error: Permisos insuficientes para eliminar este equipo.';
                showToast(`Error al eliminar el equipo: ${errorMessage}`, 'error', 8000);
            }
        } catch (error) {
            console.error('[Eliminar Equipo] Error en la petición fetch:', error);
            showToast('Error de red al intentar eliminar el equipo.', 'error', 8000);
        }
    }

    function setupDeleteTeamLinks() {
        document.querySelectorAll('.delete-team-option').forEach(link => {
            link.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();

                const folderCardElement = event.target.closest('.folder-card');
                if (!folderCardElement) {
                    console.error("[setupDeleteTeamLinks] Error: No se encontró .folder-card padre.");
                    showToast('Error interno al intentar eliminar.', 'error');
                    return;
                }

                const folderId = folderCardElement.dataset.folderId;
                // --- MODIFICACIÓN: Obtener entidad_json_key del data-attribute del folder-card ---
                const entidadJsonParaEliminar = folderCardElement.dataset.entidadJsonKey; // HTML data-entidad-json-key
                // --- FIN MODIFICACIÓN ---

                const optionsMenu = event.target.closest('.folder-options-menu');
                if (optionsMenu) optionsMenu.style.display = 'none';

                if (folderId && folderCardElement) { // entidadJsonParaEliminar se validará dentro de eliminarEquipo
                    await eliminarEquipo(folderId, folderCardElement, entidadJsonParaEliminar); // --- MODIFICACIÓN: Pasar entidad ---
                } else {
                    console.error("[setupDeleteTeamLinks] Error: No se pudo obtener folderId o folderCardElement.", {folderId, folderCardElement});
                    showToast('Error interno: No se pudo determinar qué equipo eliminar.', 'error');
                }
            });
        });
    }

    // --- (Tu lógica para setupFolderOptionMenus, eliminarArchivoDrive, setupFileOptionMenus, setupDeleteOptionLinks se mantiene igual que me la pasaste) ---
    // Asegúrate que estén aquí y sean llamadas. Por brevedad, no las repito si no cambiaron para ESTA tarea.
    // Solo como ejemplo, las funciones de menú:
    function setupFolderOptionMenus() {
        document.querySelectorAll('.folder-options-toggle').forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault(); event.stopPropagation();
                const folderCard = event.target.closest('.folder-card');
                const optionsMenu = folderCard?.querySelector('.folder-options-menu');
                document.querySelectorAll('.file-options-menu, .folder-options-menu').forEach(menu => {
                    if (menu !== optionsMenu) menu.style.display = 'none';
                });
                if (optionsMenu) optionsMenu.style.display = (optionsMenu.style.display === 'flex') ? 'none' : 'flex';
            });
        });
    }
    function setupFileOptionMenus() { 
        document.querySelectorAll('.file-options-toggle').forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault(); event.stopPropagation();
                const fileCard = event.target.closest('.file-card');
                const optionsMenu = fileCard?.querySelector('.file-options-menu');
                document.querySelectorAll('.file-options-menu, .folder-options-menu').forEach(menu => {
                    if (menu !== optionsMenu) menu.style.display = 'none';
                });
                if (optionsMenu) optionsMenu.style.display = (optionsMenu.style.display === 'flex') ? 'none' : 'flex';
            });
        });
    }
     async function eliminarArchivoDrive(fileId, elementToRemove) { /* Tu función actual */ }
     function setupDeleteOptionLinks() { /* Tu función actual */ }


    // Listener global para cerrar menús contextuales
    document.addEventListener('click', (event) => {
        const isClickOnToggle = event.target.closest('.file-options-toggle, .folder-options-toggle');
        const isClickInsideMenu = event.target.closest('.file-options-menu, .folder-options-menu');
        // También verifica que no sea el botón principal del FAB ni su menú
        const isClickOnFabToggle = toggleMenuPrincipalButton && toggleMenuPrincipalButton.contains(event.target);
        const isClickInsideFabMenu = menuPrincipal && menuPrincipal.contains(event.target);

        if (!isClickOnToggle && !isClickInsideMenu && !isClickOnFabToggle && !isClickInsideFabMenu) {
            document.querySelectorAll('.file-options-menu, .folder-options-menu').forEach(menu => {
                menu.style.display = 'none';
            });
        }
    });

    // Llamadas a las funciones de configuración
    setupFileOptionMenus();
    setupDeleteOptionLinks(); 
    setupFolderOptionMenus();
    setupDeleteTeamLinks();    

    console.log("Todas las funciones de setup ejecutadas al final de DOMContentLoaded.");
});