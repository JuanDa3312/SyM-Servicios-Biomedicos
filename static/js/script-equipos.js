// --- Función Helper para mostrar mensajes Toast ---
function showToast(message, type = 'info', duration = 3500) {
    const toast = document.getElementById('toast-message');
    if (!toast) {
        console.warn("Elemento Toast con id 'toast-message' no encontrado. Usando alert para:", message);
        if (type === 'error' || type === 'success') {
            alert(message);
        }
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
    console.log("DOM completamente cargado y parseado. script-equipos.js (o similar)");

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
            const isClickOnFabToggle = toggleMenuPrincipalButton.contains(event.target);
            const isClickInsideFabMenu = menuPrincipal.contains(event.target);

            if (!isClickInsideModal && !isClickOnFabToggle && !isClickInsideFabMenu) {
                menuPrincipal.classList.remove('menu-visible');
            }
        });
        menuPrincipal.querySelectorAll('.menu-opcion').forEach(opcion => {
            if (opcion.id !== 'triggerFileUpload' && opcion.id !== 'btnRegistrarNuevoEquipoGlobalMenu' && opcion.id !== 'btnRegistrarNuevoEquipoModalTrigger') {
                opcion.addEventListener('click', () => { // No es necesario 'event' si no se usa
                    setTimeout(() => {
                        menuPrincipal.classList.remove('menu-visible');
                    }, 50);
                });
            } else {
                opcion.addEventListener('click', (event) => {
                    event.stopPropagation();
                    // Para estos botones, el menú se puede cerrar explícitamente en sus manejadores si es necesario.
                    // o aquí: menuPrincipal.classList.remove('menu-visible'); (después de que hagan su acción)
                });
            }
        });
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
    const modalEntidadJsonInput = document.getElementById('modalEntidadJson');
    const modalEmpresaInput = document.getElementById('modalEmpresa');

    if (btnsOpenModalRegistrarEquipo.length > 0 && registrarEquipoModal) {
        btnsOpenModalRegistrarEquipo.forEach(button => {
            button.addEventListener('click', function(event) {
                event.preventDefault();
                if (menuPrincipal) menuPrincipal.classList.remove('menu-visible');

                const entidadJson = this.dataset.entidadJsonKey; // Correcto es entidadJsonKey (camelCase)
                const empresa = this.dataset.empresa;
                let serviceNameForJson = this.dataset.currentServiceName;
                let parentDriveFolderId = this.dataset.parentFolderId;

                console.log("Abriendo modal de registro. Datos del botón:", { entidadJson, empresa, serviceNameForJson, parentDriveFolderId });

                if (serviceNameForJson) serviceNameForJson = serviceNameForJson.trim().toUpperCase();
                
                if ((!serviceNameForJson || serviceNameForJson === "SERVICIO GENERAL") && !parentDriveFolderId) {
                    let promptedServiceName = prompt("Introduce el nombre del SERVICIO para el nuevo equipo:");
                    if (!promptedServiceName || promptedServiceName.trim() === "") {
                        showToast("Se requiere un nombre de servicio.", 'error'); return;
                    }
                    serviceNameForJson = promptedServiceName.trim().toUpperCase();
                    if (!parentDriveFolderId) console.warn("Servicio por prompt, parentDriveFolderId no definido en botón.");
                }
                
                if(modalEntidadJsonInput) modalEntidadJsonInput.value = entidadJson || '';
                if(modalEmpresaInput) modalEmpresaInput.value = empresa || '';
                if(modalServiceNameDisplay) modalServiceNameDisplay.textContent = serviceNameForJson || 'N/A';
                if(modalServiceKeyInput) modalServiceKeyInput.value = serviceNameForJson || ''; 
                if(modalParentDriveFolderIdInput) modalParentDriveFolderIdInput.value = parentDriveFolderId || ''; 
                if(formRegistrarEquipo) formRegistrarEquipo.reset(); 
                registrarEquipoModal.style.display = 'flex'; 
                setTimeout(() => { if(modalEquipoNombreInput) modalEquipoNombreInput.focus(); }, 100); 
            });
        });
    }

    if (btnCloseModal) btnCloseModal.addEventListener('click', () => { registrarEquipoModal.style.display = 'none'; if(formRegistrarEquipo) formRegistrarEquipo.reset(); });
    if (btnCancelModal) btnCancelModal.addEventListener('click', () => { registrarEquipoModal.style.display = 'none'; if(formRegistrarEquipo) formRegistrarEquipo.reset(); });
    if (registrarEquipoModal) {
        registrarEquipoModal.addEventListener('click', (event) => {
            if (event.target === registrarEquipoModal) {
                registrarEquipoModal.style.display = 'none'; if(formRegistrarEquipo) formRegistrarEquipo.reset();
            }
        });
    }

    if (formRegistrarEquipo) {
        formRegistrarEquipo.addEventListener('submit', async (event) => {
            event.preventDefault(); 
            const nombreInputVal = modalEquipoNombreInput?.value.trim() || '';
            const marcaModeloInputVal = modalEquipoMarcaModeloInput?.value.trim() || '';
            const serieInputVal = modalEquipoSerieInput?.value.trim() || '';
            const ubicacionInputVal = modalEquipoUbicacionInput?.value.trim() || '';
            const serviceKeyInputVal = modalServiceKeyInput?.value || '';
            const parentFolderIdInputVal = modalParentDriveFolderIdInput?.value || '';
            const entidadJsonParaApi = modalEntidadJsonInput?.value || '';
            const empresaParaApi = modalEmpresaInput?.value || '';

            if (!nombreInputVal) { showToast('El nombre del equipo es obligatorio.', 'error'); modalEquipoNombreInput?.focus(); return; }
            if (!serviceKeyInputVal) { showToast('Error: No se pudo determinar el servicio.', 'error'); return; }
            if (!entidadJsonParaApi) { showToast('Error: No se pudo determinar la entidad para el registro.', 'error'); return; }
            if (!parentFolderIdInputVal) { showToast('Error: No se pudo determinar la carpeta de servicio en Drive.', 'error'); return; }

            const equipoDetails = { nombre: nombreInputVal.toUpperCase(), marca_modelo: marcaModeloInputVal, serie: serieInputVal, ubicacion: ubicacionInputVal };
            const dataToSend = { entidad_json_key: entidadJsonParaApi, empresa: empresaParaApi, service_key_for_json: serviceKeyInputVal, parent_drive_folder_id: parentFolderIdInputVal, equipo_details: equipoDetails };

            showToast('Registrando equipo...', 'info', 15000);
            try {
                const response = await fetch('/api/registrar_equipo_completo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSend) });
                const result = await response.json(); 
                if (response.ok && result.success) { 
                    showToast(result.message || 'Equipo registrado!', 'success', 5000);
                    registrarEquipoModal.style.display = 'none'; formRegistrarEquipo.reset(); 
                    setTimeout(() => window.location.reload(), 2000);
                } else { 
                    showToast(`Error al registrar: ${result.error || 'Error desconocido.'}`, 'error', 7000);
                }
            } catch (error) { 
                showToast('Error de red al registrar.', 'error', 7000);
            }
        });
    }

    // --- SUBIDA DE ARCHIVOS INDIVIDUALES ---
    const triggerUploadButton = document.getElementById('triggerFileUpload');
    const fileUploaderInput = document.getElementById('fileUploader');

    if (triggerUploadButton && fileUploaderInput) {
        triggerUploadButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation(); // Evita que el menú se cierre por el listener global de documento
            if (menuPrincipal) menuPrincipal.classList.remove('menu-visible');
            fileUploaderInput.dataset.triggeringButtonFolderId = triggerUploadButton.dataset.folderId; // Guardar el folderId del botón
            fileUploaderInput.click();
        });

        fileUploaderInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const folderId = fileUploaderInput.dataset.triggeringButtonFolderId; // Usar el folderId guardado
            if (!folderId) {
                showToast('Error: No se pudo determinar carpeta destino.', 'error');
                fileUploaderInput.value = '';
                return;
            }

            const formData = new FormData();
            formData.append('pdfFile', file);
            formData.append('folderId', folderId);
            formData.append('fileName', file.name);

            showToast(`Subiendo ${file.name}...`, 'info');
            try {
                const response = await fetch('/upload_pdf_to_drive', { method: 'POST', body: formData });
                const result = await response.json();
                if (response.ok && result.success) {
                    showToast(`Archivo "${result.fileName || file.name}" subido!`, 'success');
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    showToast(`Error al subir: ${result.error || 'desconocido'}`, 'error', 7000);
                }
            } catch (error) {
                showToast('Error de red al intentar subir.', 'error', 7000);
            } finally {
                fileUploaderInput.value = ''; // Limpiar para permitir resubir el mismo archivo
                delete fileUploaderInput.dataset.triggeringButtonFolderId; // Limpiar el folderId guardado
            }
        });
    }

    // --- LÓGICA PARA MENÚS Y ELIMINACIÓN DE EQUIPOS (CARPETAS) ---
    async function eliminarEquipo(folderId, elementToRemove, entidadJsonParaEliminar) {
        if (!confirm('¡ADVERTENCIA! ¿Seguro que quieres eliminar este equipo y TODO su contenido?')) return;
        if (!entidadJsonParaEliminar) {
            showToast('Error interno: Falta la entidad para eliminar el equipo.', 'error');
            return;
        }
        showToast('Eliminando equipo...', 'info');
        try {
            const payload = { folderId: folderId, entidad_json_key: entidadJsonParaEliminar };
            const response = await fetch('/delete_equipo', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (response.ok && result.success) {
                showToast('Equipo eliminado con éxito!', 'success');
                elementToRemove?.remove(); // Más simple
            } else {
                showToast(`Error al eliminar equipo: ${result.error || 'Error desconocido'}`, 'error');
            }
        } catch (error) {
            showToast('Error de red al eliminar equipo.', 'error');
        }
    }

    function setupDeleteTeamLinks() {
        document.querySelectorAll('.delete-team-option').forEach(link => {
            link.addEventListener('click', async (event) => {
                event.preventDefault(); event.stopPropagation();
                const folderCardElement = event.target.closest('.folder-card');
                if (!folderCardElement) { showToast('Error: No se encontró la tarjeta del equipo.', 'error'); return; }
                const folderId = folderCardElement.dataset.folderId;
                const entidadJsonParaEliminar = folderCardElement.dataset.entidadJsonKey; // data-entidad-json-key
                
                const optionsMenu = event.target.closest('.folder-options-menu');
                if (optionsMenu) optionsMenu.style.display = 'none';

                if (folderId) { // entidadJsonParaEliminar se validará en la función eliminarEquipo
                    await eliminarEquipo(folderId, folderCardElement, entidadJsonParaEliminar);
                } else {
                    showToast('Error: No se pudo obtener el ID del equipo.', 'error');
                }
            });
        });
    }

    // --- LÓGICA PARA MENÚS Y ELIMINACIÓN DE ARCHIVOS ---
    async function eliminarArchivoDrive(fileId, elementToRemove) {
        if (!confirm('¿Seguro que quieres eliminar este archivo?')) return;
        // NOTA: Si la eliminación de archivos también necesita 'entidad_json_key', deberás pasarla
        // y añadirla al payload, similar a como se hizo con eliminarEquipo.
        showToast('Eliminando archivo...', 'info');
        try {
            const response = await fetch('/delete_file_from_drive', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId: fileId })
            });
            const result = await response.json();
            if (response.ok && result.success) {
                showToast('Archivo eliminado!', 'success');
                elementToRemove?.remove();
            } else {
                showToast(`Error al eliminar archivo: ${result.error || 'Error desconocido'}`, 'error');
            }
        } catch (error) {
            showToast('Error de red al eliminar archivo.', 'error');
        }
    }

    function setupDeleteOptionLinks() { // Para archivos
        document.querySelectorAll('.delete-file-option').forEach(link => {
            link.addEventListener('click', async (event) => {
                event.preventDefault(); event.stopPropagation();
                const fileCardElement = event.target.closest('.file-card');
                if (!fileCardElement) { showToast('Error: No se encontró la tarjeta del archivo.', 'error'); return; }
                const fileId = fileCardElement.dataset.fileId || event.target.dataset.fileId; // Tomar de la tarjeta o del enlace
                
                const optionsMenu = event.target.closest('.file-options-menu');
                if (optionsMenu) optionsMenu.style.display = 'none';

                if (fileId) {
                    await eliminarArchivoDrive(fileId, fileCardElement);
                } else {
                    showToast('Error: No se pudo obtener el ID del archivo.', 'error');
                }
            });
        });
    }
    
    // --- Setup de menús contextuales (3 puntos) ---
    function setupOptionMenus(selectorToggle, selectorCard, selectorMenu) {
        document.querySelectorAll(selectorToggle).forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault(); event.stopPropagation();
                const card = event.target.closest(selectorCard);
                const optionsMenu = card?.querySelector(selectorMenu);
                
                // Cerrar otros menús abiertos
                document.querySelectorAll('.file-options-menu, .folder-options-menu').forEach(menu => {
                    if (menu !== optionsMenu) menu.style.display = 'none';
                });

                if (optionsMenu) {
                    optionsMenu.style.display = (optionsMenu.style.display === 'flex') ? 'none' : 'flex';
                }
            });
        });
    }
    setupOptionMenus('.folder-options-toggle', '.folder-card', '.folder-options-menu');
    setupOptionMenus('.file-options-toggle', '.file-card', '.file-options-menu');


    // Listener global para cerrar menús contextuales y el menú principal FAB
    document.addEventListener('click', (event) => {
        const isClickOnContextToggle = event.target.closest('.file-options-toggle, .folder-options-toggle');
        const isClickInsideContextMenu = event.target.closest('.file-options-menu, .folder-options-menu');
        const isClickOnFabToggle = toggleMenuPrincipalButton && toggleMenuPrincipalButton.contains(event.target);
        const isClickInsideFabMenu = menuPrincipal && menuPrincipal.contains(event.target);
        const isClickInsideModal = registrarEquipoModal && registrarEquipoModal.style.display === 'flex' && registrarEquipoModal.contains(event.target);


        if (!isClickOnContextToggle && !isClickInsideContextMenu && !isClickInsideModal) {
            document.querySelectorAll('.file-options-menu, .folder-options-menu').forEach(menu => {
                menu.style.display = 'none';
            });
        }
        // El cierre del menú FAB ya se maneja en su propio listener si el clic es fuera de él y de la modal.
    });

    // Llamadas a las funciones de configuración de acciones
    setupDeleteTeamLinks();    // Para los enlaces "Eliminar Equipo"
    setupDeleteOptionLinks();  // Para los enlaces "Eliminar Archivo"

    console.log("script-equipos.js: Todos los listeners y setups configurados.");
});