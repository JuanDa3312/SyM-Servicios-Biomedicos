// --- Función Helper para mostrar mensajes Toast ---
// (Tu función showToast ligeramente mejorada para limpiar clases de tipo)
function showToast(message, type = 'info', duration = 3500) {
    const toast = document.getElementById('toast-message');
    if (!toast) {
        console.warn("Elemento Toast con id 'toast-message' no encontrado. Usando alert.");
        alert(message); // Fallback a alert si no hay toast
        return;
    }
    toast.textContent = message;
    // Limpia clases de tipo y añade la nueva
    toast.classList.remove('info', 'error', 'success'); // Limpiar clases de tipo anteriores
    toast.className = 'toast show'; // Resetea clases base y añade 'show' para animar
    if (type === 'error') {
        toast.classList.add('error');
    } else if (type === 'success') {
        toast.classList.add('success');
    } else {
         toast.classList.add('info'); // Añadir clase info por defecto si no es error/success
    }
    // Ocultar el toast después de la duración especificada
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}


// --- Esperar a que el DOM esté completamente cargado ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM completamente cargado y parseado.");

    // =====================================================
    // Lógica existente (Botón flotante, Modal, Subida)
    // (Tu lógica tal cual la proporcionaste, ligeramente refactorizada y comentada)
    // =====================================================

    // --- MENÚ PRINCIPAL (BOTÓN '+') ---
    const menuPrincipal = document.getElementById('menuOpciones');
    const toggleMenuPrincipalButton = document.querySelector('.btn-add-inside');

    if (toggleMenuPrincipalButton && menuPrincipal) {
        toggleMenuPrincipalButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Evita que el clic en este botón active el listener global de cierre de *otros* menús
            menuPrincipal.classList.toggle('menu-visible'); // Alterna la clase para mostrar/ocultar el menú principal
        });

        // Listener global para cerrar menú principal si se hace clic fuera de él o su toggle
        // NOTA: Este listener *ya estaba* en tu código original para el menú principal
        document.addEventListener('click', (event) => {
            // Asegúrate de que el clic no fue en el botón de toggle principal NI dentro del menú principal
             if (!toggleMenuPrincipalButton.contains(event.target) && !menuPrincipal.contains(event.target)) {
                 menuPrincipal.classList.remove('menu-visible'); // Oculta el menú principal
             }
             // Importante: Este listener no debe interferir con el cierre de los MENÚS CONTEXTUALES de tarjetas.
             // El listener global para los MENÚS CONTEXTUALES se define más abajo.
        });


        // Listener para cerrar menú principal al hacer clic en una de sus opciones
        menuPrincipal.querySelectorAll('.menu-opcion').forEach(opcion => {
             // Excluimos el triggerFileUpload porque ese evento ya lo maneja la subida
            if (opcion.id !== 'triggerFileUpload') {
                 opcion.addEventListener('click', (event) => { // Añadir event aquí
                     event.stopPropagation(); // Evita que el clic propague y cierre otros menús si están abiertos
                     // Pequeño retraso para permitir que la acción del enlace (ej: navegación) ocurra antes de cerrar visualmente el menú
                     setTimeout(() => {
                         menuPrincipal.classList.remove('menu-visible');
                     }, 50); // Ajusta el retraso si es necesario
                 });
             } else {
                  // Para el botón de subir archivo, solo cerramos el menú principal inmediatamente al hacer clic
                  opcion.addEventListener('click', (event) => { // Añadir event aquí
                      event.stopPropagation(); // Evita que el clic propague
                      menuPrincipal.classList.remove('menu-visible');
                  });
             }
        });
    } else {
         console.warn("Advertencia: Elementos del menú principal ('#menuOpciones') o su toggle ('.btn-add-inside') no encontrados.");
    }


    // --- MODAL DE REGISTRO DE NUEVO EQUIPO ---
    const registrarEquipoModal = document.getElementById('registrarEquipoModal');
    const btnOpenModalRegistrarEquipo = document.getElementById('btnRegistrarNuevoEquipoGlobalMenu');
    // Usar optional chaining (?) para evitar errores si la modal o sus botones no existen
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


    if (btnOpenModalRegistrarEquipo && registrarEquipoModal) {
        btnOpenModalRegistrarEquipo.addEventListener('click', (event) => {
            event.preventDefault(); // Previene el comportamiento por defecto del enlace

            if (menuPrincipal) menuPrincipal.classList.remove('menu-visible'); // Cierra el menú principal

            let serviceNameForJson = btnOpenModalRegistrarEquipo.dataset.currentServiceName;
            let parentDriveFolderId = btnOpenModalRegistrarEquipo.dataset.parentFolderId;

            if (serviceNameForJson) {
                serviceNameForJson = serviceNameForJson.trim().toUpperCase();
            }

            // Si no hay nombre de servicio en el data-attribute (ej: estás en la vista principal), pedirlo con prompt
             if (!serviceNameForJson || serviceNameForJson === "") {
                let promptedServiceName = prompt("Introduce el nombre del SERVICIO (ej: AMBULANCIA, CITOLOGIA) para el nuevo equipo. Se guardará en mayúsculas:");
                 if (!promptedServiceName || promptedServiceName.trim() === "") {
                     showToast("Se requiere un nombre de servicio para registrar un equipo.", 'error');
                     return; // Detiene la apertura del modal si se cancela o está vacío
                 }
                 serviceNameForJson = promptedServiceName.trim().toUpperCase();
                 parentDriveFolderId = null; // Si pides el servicio, asumes que estás creando un nuevo servicio (en la raíz o un padre predeterminado)
             }

            // Rellena los campos de la modal
            if(modalServiceNameDisplay) modalServiceNameDisplay.textContent = serviceNameForJson;
            if(modalServiceKeyInput) modalServiceKeyInput.value = serviceNameForJson; // Guarda el nombre del servicio aquí para enviarlo al backend
            if(modalParentDriveFolderIdInput) modalParentDriveFolderIdInput.value = parentDriveFolderId || ''; // Guarda el ID de la carpeta padre si existe
            if(formRegistrarEquipo) formRegistrarEquipo.reset(); // Limpiar campos del formulario

            // Muestra la modal y pone el foco en el primer campo de input
            registrarEquipoModal.style.display = 'flex'; // Usa display: flex para centrar via CSS si el overlay es flex
            setTimeout(() => {
                if(modalEquipoNombreInput) modalEquipoNombreInput.focus(); // Pone el foco en el input de nombre
            }, 100); // Pequeño retraso para asegurar que la modal esté visible antes de poner foco
        });
    } else {
         console.warn("Advertencia: Botón para registrar equipo ('#btnRegistrarNuevoEquipoGlobalMenu') o la modal ('#registrarEquipoModal') no encontrados.");
    }

    // Listeners para cerrar/cancelar modal
    if (btnCloseModal && registrarEquipoModal) btnCloseModal.addEventListener('click', () => { registrarEquipoModal.style.display = 'none'; if(formRegistrarEquipo) formRegistrarEquipo.reset(); });
    if (btnCancelModal && registrarEquipoModal) btnCancelModal.addEventListener('click', () => { registrarEquipoModal.style.display = 'none'; if(formRegistrarEquipo) formRegistrarEquipo.reset(); });
    if (registrarEquipoModal) {
        // Cierra modal si el clic fue directamente en el overlay (no en el contenido de la modal)
        registrarEquipoModal.addEventListener('click', (event) => {
            if (event.target === registrarEquipoModal) {
                 registrarEquipoModal.style.display = 'none';
                 if(formRegistrarEquipo) formRegistrarEquipo.reset(); // Limpiar también si se cierra con click fuera
            }
        });
    }

    // Listener para submit del formulario de la modal
    if (formRegistrarEquipo) {
        formRegistrarEquipo.addEventListener('submit', async (event) => {
            event.preventDefault(); // Previene el envío tradicional del formulario HTML

            // Obtener valores de los campos (con verificación de existencia de elementos)
            const nombreInput = modalEquipoNombreInput ? modalEquipoNombreInput.value.trim() : '';
            const marcaModeloInput = modalEquipoMarcaModeloInput ? modalEquipoMarcaModeloInput.value.trim() : '';
            const serieInput = modalEquipoSerieInput ? modalEquipoSerieInput.value.trim() : '';
            const ubicacionInput = modalEquipoUbicacionInput ? modalEquipoUbicacionInput.value.trim() : '';
            const serviceKeyInput = modalServiceKeyInput ? modalServiceKeyInput.value : ''; // Esto es el nombre del servicio padre ahora
            const parentFolderIdInputVal = modalParentDriveFolderIdInput ? modalParentDriveFolderIdInput.value : ''; // ID de la carpeta padre en Drive

            // Validaciones básicas
            if (!nombreInput) {
                 showToast('El nombre del equipo es obligatorio.', 'error');
                 if(modalEquipoNombreInput) modalEquipoNombreInput.focus(); // Poner foco si falta
                 return;
             }
             // El serviceKeyInput (nombre del servicio) siempre debería tener un valor por la lógica de apertura del modal
            if (!serviceKeyInput) {
                 showToast('Error interno: No se pudo determinar el servicio para registrar el equipo.', 'error');
                 console.error("[Registrar Equipo Submit] Error: serviceKeyInput está vacío en el envío del formulario.");
                 return;
             }

            const equipoNombreParaGuardar = nombreInput.toUpperCase(); // Nombre equipo en MAYÚSCULAS para guardar

            const equipoDetails = {
                nombre: equipoNombreParaGuardar,
                marca_modelo: marcaModeloInput,
                serie: serieInput,
                ubicacion: ubicacionInput
            };

            const dataToSend = {
                 // === MODIFICACIÓN APLICADA AQUÍ ===
                 // Cambia la clave de 'service_name' a 'service_key_for_json' según el error del backend
                "service_key_for_json": serviceKeyInput, // <-- CLAVE CAMBIADA
                // ==================================
                parent_drive_folder_id: parentFolderIdInputVal || null, // Enviar el ID de la carpeta padre si existe, o null
                equipo_details: equipoDetails // Objeto con los detalles del equipo
            };

            console.log("[Registrar Equipo Submit] Datos a enviar a /api/registrar_equipo_completo:", JSON.stringify(dataToSend, null, 2));
            showToast('Registrando equipo y creando carpeta...', 'info', 15000); // Mostrar toast informativo

            try {
                // Llama al endpoint de tu backend para registrar el equipo completo
                const response = await fetch('/api/registrar_equipo_completo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToSend) // Envía los datos como JSON
                });
                const result = await response.json(); // Espera la respuesta JSON del backend
                console.log("[Registrar Equipo Submit] Respuesta del servidor:", { status: response.status, ok: response.ok, body: result });

                if (response.ok && result.success) { // Si el backend responde OK y el resultado indica éxito
                    showToast(result.message || 'Equipo registrado!', 'success', 5000);
                    registrarEquipoModal.style.display = 'none'; // Cerrar modal
                    if(formRegistrarEquipo) formRegistrarEquipo.reset(); // Limpiar formulario

                     // Recargar la página para ver el nuevo equipo, con un pequeño retraso para que el usuario vea el toast
                    setTimeout(() => window.location.reload(), 2000);
                } else { // Si el backend responde con error o el resultado no es exitoso
                    const errorMsg = result.error || 'desconocido';
                     showToast(`Error al registrar equipo: ${errorMsg}`, 'error', 7000);
                     console.error("[Registrar Equipo Submit] Detalles del error:", result.details || "No hay detalles adicionales.");
                }
            } catch (error) { // Error de red o en la petición fetch
                console.error('[Registrar Equipo Submit] Error en fetch:', error);
                showToast('Error de red o conexión al registrar.', 'error', 7000);
            }
        });
    } else {
         console.warn("Advertencia: Formulario de registro de equipo ('#formRegistrarEquipo') no encontrado.");
    }


    // --- SUBIDA DE ARCHIVOS INDIVIDUALES ---
    const triggerUploadButton = document.getElementById('triggerFileUpload');
    const fileUploaderInput = document.getElementById('fileUploader');

    if (triggerUploadButton && fileUploaderInput) {
         // Activa el input file oculto cuando se hace clic en el enlace del menú flotante
        triggerUploadButton.addEventListener('click', (event) => {
            event.preventDefault();
            if (menuPrincipal) menuPrincipal.classList.remove('menu-visible'); // Cierra el menú principal
            fileUploaderInput.click(); // Simula el clic en el input file oculto para abrir el selector de archivos
        });

        // Maneja la selección de archivo y la subida
        fileUploaderInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) {
                 console.log("Subida cancelada: No se seleccionó archivo.");
                 return; // No se seleccionó ningún archivo
            }

            const folderId = triggerUploadButton.dataset.folderId; // Obtiene el ID de la carpeta destino del data-attribute del enlace
            if (!folderId) {
                 console.error("Error: data-folder-id no está establecido en el botón triggerFileUpload.");
                 showToast('No se pudo determinar carpeta destino para la subida.', 'error');
                 fileUploaderInput.value = ''; // Limpiar el input file
                 return;
             }


            const formData = new FormData();
            formData.append('pdfFile', file); // Asegúrate de que tu backend espere 'pdfFile' como nombre del campo del archivo
            formData.append('folderId', folderId); // Añade el ID de la carpeta
            formData.append('fileName', file.name); // Opcional: Envia el nombre original del archivo


            showToast(`Subiendo ${file.name}...`, 'info', 5000); // Mostrar toast de subida

            try {
                // Llama al endpoint de tu backend para subir el archivo
                const response = await fetch('/upload_pdf_to_drive', {
                    method: 'POST',
                    body: formData // FormData se encarga de configurar el Content-Type correctamente para archivos
                });
                const result = await response.json(); // Espera la respuesta JSON del backend

                if (response.ok && result.success) {
                    showToast(`Archivo "${result.fileName || file.name}" subido!`, 'success');
                    // Recargar la página para ver el nuevo archivo, con un pequeño retraso
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    const errorMsg = result.error || 'desconocido';
                     showToast(`Error al subir: ${errorMsg}`, 'error', 7000);
                     console.error("[Subida Archivo] Detalles del error:", result.details || "No hay detalles adicionales.");
                }
            } catch (error) {
                console.error('[Subida Archivo] Error de red:', error);
                showToast('Error de red al intentar subir.', 'error', 7000);
            } finally {
                // Limpiar el valor del input file para permitir seleccionar el mismo archivo de nuevo
                fileUploaderInput.value = '';
            }
        });
    } else {
        console.warn("Advertencia: Elementos para subida de archivo ('#triggerFileUpload' o '#fileUploader') no encontrados.");
    }


    // =====================================================
    // Lógica para Menús y Eliminación de EQUIPOS (Carpetas)
    // =====================================================

    // --- FUNCIÓN PRINCIPAL PARA ELIMINAR EQUIPOS (CARPETAS) ---
    // Nota: Esta función puede que necesites añadirla si no estaba en tu versión base.
    async function eliminarEquipo(folderId, elementToRemove) {
        // Confirmación del usuario (MUY IMPORTANTE para acciones destructivas como esta)
        if (!confirm('¡ADVERTENCIA! ¿Estás seguro de que quieres eliminar este equipo  y *TODO* su contenido ? Esta acción no se puede deshacer.')) {
            console.log("[Eliminar Equipo] Eliminación cancelada por el usuario.");
            return; // Sale de la función si el usuario hace clic en "Cancelar"
        }

        console.log(`[Eliminar Equipo] Procediendo a eliminar equipo (carpeta) con ID: ${folderId}`);
        showToast('Eliminando equipo y su contenido...', 'info'); // Muestra un toast informativo

        try {
            // Llama al endpoint de tu backend Flask para eliminar la carpeta en Google Drive
            // Asegúrate de que tu backend espera { "folderId": "..." } en el cuerpo de la petición POST
            const response = await fetch('/delete_equipo', { // <-- Implementa esta ruta en tu app Flask
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderId: folderId }) // Envía el ID de la carpeta al backend
            });

            const result = await response.json(); // Espera la respuesta JSON del backend (ej: { "success": true, "message": "..." })
            console.log("[Eliminar Equipo] Respuesta del servidor:", { status: response.status, ok: response.ok, body: result });

            if (response.ok && result.success) { // Si el backend responde OK (código 2xx) y el resultado indica éxito
                console.log(`[Eliminar Equipo] Equipo (carpeta) ${folderId} reportado como eliminado por el backend.`);
                showToast(`Equipo eliminado con éxito!`, 'success', 4000); // Muestra un toast de éxito

                // Opcional: Eliminar visualmente la tarjeta de carpeta del DOM sin recargar la página
                // Esto da retroalimentación inmediata al usuario.
                if (elementToRemove?.parentNode) { // Usa optional chaining (?) por seguridad
                    elementToRemove.parentNode.removeChild(elementToRemove);
                    console.log(`[Eliminar Equipo] Elemento HTML para el equipo ${folderId} eliminado del DOM.`);
                }

                // Considera recargar la página si la eliminación podría afectar otras partes de la UI (ej. paginación, conteos)
                 // setTimeout(() => window.location.reload(), 1000); // Recarga la página con un pequeño retraso

            } else { // Si el backend responde con un código de error o el resultado no es exitoso
                let errorMessage = result.error || `Error HTTP ${response.status}.`;
                 // Puedes añadir manejo para códigos de estado específicos si tu backend los usa (ej. 404 Not Found, 403 Forbidden)
                 if (response.status === 404) errorMessage = 'Error: El equipo (carpeta) no fue encontrado en Drive.';
                 if (response.status === 403) errorMessage = 'Error: Permisos insuficientes para eliminar este equipo.';

                showToast(`Error al eliminar el equipo: ${errorMessage}`, 'error', 8000); // Muestra un toast de error
                console.error("[Eliminar Equipo] Detalles adicionales del error:", result.details || "No hay detalles adicionales."); // Loggea detalles del error
            }
        } catch (error) { // Captura errores de red o en la petición fetch
            console.error('[Eliminar Equipo] Error en la petición fetch:', error);
            showToast('Error de red al intentar eliminar el equipo.', 'error', 8000); // Muestra un toast de error de red
        }
    }


    // --- CONFIGURACIÓN DE MENÚS CONTEXTUALES DE CARPETA (TRES PUNTOS) ---
    // Configura los listeners para abrir/cerrar los menús de opciones de las tarjetas de carpeta
    function setupFolderOptionMenus() {
        document.querySelectorAll('.folder-options-toggle').forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault(); // Previene el comportamiento por defecto (ej. si fuera un enlace)
                event.stopPropagation(); // !!! IMPEDIR que el clic en este botón active el listener global de cierre !!!

                const folderCard = event.target.closest('.folder-card'); // Encuentra el elemento ancestro más cercano con la clase 'folder-card'
                 // Usa optional chaining (?) por si closest devuelve null (aunque con stopPropagation no debería pasar si se encuentra el botón)
                const optionsMenu = folderCard?.querySelector('.folder-options-menu'); // Busca el elemento con la clase 'folder-options-menu' DENTRO de folderCard

                // Cierra CUALQUIER otro menú de opciones (de archivo o carpeta) que esté abierto actualmente
                // Iteramos sobre todos los menús posibles
                document.querySelectorAll('.file-options-menu, .folder-options-menu').forEach(menu => {
                     // Si el menú actual en el bucle NO es el menú que intentamos abrir/cerrar AHORA, ciérralo (display = 'none').
                     // La comparación `menu !== optionsMenu` asegura que no cerramos el menú correcto.
                    if (menu !== optionsMenu) {
                        menu.style.display = 'none';
                    }
                });

                if (optionsMenu) {
                    // Alterna la visibilidad del menú clicado: si display es 'flex' (visible), lo pone a 'none' (oculto); si es 'none' (oculto) o cualquier otra cosa, lo pone a 'flex' (visible).
                    optionsMenu.style.display = (optionsMenu.style.display === 'flex') ? 'none' : 'flex';
                } else {
                     // Este console.warn se dispara si setupFolderOptionMenus encuentra un toggle pero no su menú asociado
                     // Los logs de depuración DEBUG que añadimos antes son más detallados sobre por qué falla el querySelector
                     console.warn("setupFolderOptionMenus: No se encontró el menú .folder-options-menu para la tarjeta clicada. Verifique la estructura HTML.");
                }
            });
        });
        // NOTA: El listener global para cerrar menús al hacer clic fuera se define MÁS ABAJO, UNA SOLA VEZ, FUERA de esta función.
    }


    // --- CONFIGURACIÓN DE ENLACES 'ELIMINAR EQUIPO' EN MENÚS CONTEXTUALES ---
    // Nota: Esta función puede que necesites añadirla si no estaba en tu versión base.
    // Configura los listeners para manejar el clic en la opción "Eliminar Equipo" dentro del menú contextual de carpetas
    function setupDeleteTeamLinks() {
        document.querySelectorAll('.delete-team-option').forEach(link => {
            link.addEventListener('click', async (event) => {
                event.preventDefault(); // Evita que el navegador siga el enlace '#'
                event.stopPropagation(); // !!! Evita que el clic en este enlace active el listener global de cierre !!!

                const folderId = event.target.dataset.folderId; // Obtiene el ID de la carpeta del atributo data-folder-id del enlace clicado
                // Encuentra el elemento ancestro con la clase 'folder-card'. Este será el elemento a eliminar visualmente si la eliminación es exitosa.
                const folderCardElement = event.target.closest('.folder-card');

                // Cierra el menú de opciones de la carpeta después de hacer clic en una de sus opciones
                // Encontramos el menú padre del enlace clicado
                const optionsMenu = event.target.closest('.folder-options-menu');
                if (optionsMenu) optionsMenu.style.display = 'none'; // Oculta el menú

                // Verifica que tenemos el ID de la carpeta y el elemento de la tarjeta antes de intentar eliminar
                if (folderId && folderCardElement) {
                    // Llama a la función principal para eliminar el equipo
                    await eliminarEquipo(folderId, folderCardElement);
                } else {
                    console.error("[setupDeleteTeamLinks] Error: No se pudo obtener folderId o folderCardElement.", {folderId, folderCardElement});
                    showToast('Error interno: No se pudo determinar qué equipo eliminar.', 'error');
                }
            });
        });
    }


    // =====================================================
    // Lógica para Menús y Eliminación de ARCHIVOS
    // (Similar a la de Equipos, pero para archivos)
    // =====================================================

    // --- FUNCIÓN PRINCIPAL PARA ELIMINAR ARCHIVOS ---
    // Contiene la lógica para confirmar y hacer la llamada al backend para eliminar un archivo en Drive
    async function eliminarArchivoDrive(fileId, elementToRemove) {
        if (!confirm('¿Seguro que quieres eliminar el archivo? Esta acción no se puede deshacer.')) {
            console.log("[Eliminar Archivo] Eliminación cancelada por el usuario.");
            return; // Sale de la función si el usuario cancela
        }
        console.log(`[Eliminar Archivo] Intentando eliminar archivo ID: ${fileId}`);
        showToast('Eliminando archivo...', 'info'); // Muestra toast informativo

        try {
            // Llama al endpoint de tu backend Flask para eliminar el archivo en Google Drive
            // Asegúrate de que tu backend espera { "fileId": "..." } en el cuerpo de la petición POST
            const response = await fetch('/delete_file_from_drive', { // <-- Implementa esta ruta en tu app Flask
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId: fileId }) // Envía el ID del archivo al backend
            });

            const result = await response.json(); // Espera la respuesta JSON del backend (ej: { "success": true, "message": "..." })
            console.log("[Eliminar Archivo] Respuesta del servidor de eliminación:", { status: response.status, ok: response.ok, body: result });

            if (response.ok && result.success) { // Si el backend responde OK (código 2xx) y el resultado indica éxito
                console.log(`[Eliminar Archivo] Archivo ${fileId} eliminado con éxito del backend.`);
                showToast(`Archivo eliminado!`, 'success', 4000); // Muestra toast de éxito
                // Eliminar visualmente la tarjeta de archivo del DOM sin recargar la página
                if (elementToRemove?.parentNode) { // Usa optional chaining (?) por seguridad
                    elementToRemove.parentNode.removeChild(elementToRemove);
                    console.log(`[Eliminar Archivo] Elemento HTML para ${fileId} eliminado del DOM.`);
                }
                // Opcional: Recargar la página si es necesario
                // setTimeout(() => window.location.reload(), 1000);

            } else { // Si el backend devuelve un error
                let errorMessage = result.error || `Error HTTP ${response.status}.`;
                if (response.status === 404) errorMessage = 'Error: El archivo no fue encontrado en Drive.';
                if (response.status === 403) errorMessage = 'Error: Permisos insuficientes para eliminar este archivo.';
                showToast(`Error al eliminar: ${errorMessage}`, 'error', 8000); // Muestra toast de error
                console.error("[Eliminar Archivo] Detalles adicionales del error:", result.details || "No hay detalles adicionales."); // Loggea detalles del error
            }
        } catch (error) { // Captura errores de red o en la petición fetch
            console.error('[Eliminar Archivo] Error en la petición fetch de eliminación:', error);
            showToast('Error de red al intentar eliminar el archivo.', 'error', 8000); // Muestra toast de error de red
        }
    }

    // --- CONFIGURACIÓN DE MENÚS CONTEXTUALES DE ARCHIVO (TRES PUNTOS) ---
    // Configura los listeners para abrir/cerrar los menús de opciones de las tarjetas de archivo
    function setupFileOptionMenus() {
        document.querySelectorAll('.file-options-toggle').forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation(); // !!! IMPEDIR que el clic en este botón active el listener global de cierre !!!

                const fileCard = event.target.closest('.file-card'); // Encuentra el elemento ancestro más cercano con la clase 'file-card'
                const optionsMenu = fileCard?.querySelector('.file-options-menu'); // Busca el elemento con la clase 'file-options-menu' DENTRO de fileCard

                 // Cierra CUALQUIER otro menú de opciones (archivo o carpeta) abierto actualmente
                document.querySelectorAll('.file-options-menu, .folder-options-menu').forEach(menu => {
                     // Si el menú actual en el bucle NO es el menú que intentamos abrir/cerrar AHORA, ciérralo.
                     // La comparación `menu !== optionsMenu` asegura que no cerramos el menú correcto.
                     if (menu !== optionsMenu) {
                         menu.style.display = 'none';
                     }
                });


                if (optionsMenu) {
                    // Alterna la visibilidad del menú clicado
                    optionsMenu.style.display = (optionsMenu.style.display === 'flex') ? 'none' : 'flex';
                } else {
                     console.warn("setupFileOptionMenus: No se encontró el menú .file-options-menu para la tarjeta clicada. Verifique la estructura HTML.");
                }
            });
        });
         // NOTA: El listener global para cerrar menús al hacer clic fuera se define MÁS ABAJO, UNA SOLA VEZ.
         // Ya no está anidado aquí (hemos eliminado el que estaba).
    }

    // --- CONFIGURACIÓN DE ENLACES 'ELIMINAR ARCHIVO' EN MENÚS CONTEXTUALES ---
    // Maneja el clic específico en la opción "Eliminar Archivo" dentro del menú contextual de archivos
    function setupDeleteOptionLinks() {
        document.querySelectorAll('.delete-file-option').forEach(link => {
            link.addEventListener('click', async (event) => {
                event.preventDefault(); // Evita que el navegador siga el enlace '#'
                event.stopPropagation(); // !!! IMPEDIR que el clic en este enlace active el listener global de cierre !!!

                const fileId = event.target.dataset.fileId; // Obtiene el ID del archivo del atributo data-file-id del enlace clicado
                // Encuentra el elemento ancestro con la clase 'file-card'. Este será el elemento a eliminar visualmente si la eliminación es exitosa.
                const fileCardElement = event.target.closest('.file-card');

                // Cierra el menú de opciones del archivo después de hacer clic en una de sus opciones
                // Encontramos el menú padre del enlace clicado
                const optionsMenu = event.target.closest('.file-options-menu');
                if (optionsMenu) optionsMenu.style.display = 'none'; // Oculta el menú

                // Verifica que tenemos el ID del archivo y el elemento de la tarjeta antes de intentar eliminar
                if (fileId && fileCardElement) {
                    // Llama a la función principal para eliminar el archivo
                    await eliminarArchivoDrive(fileId, fileCardElement);
                } else {
                    console.error("[setupDeleteOptionLinks] Error: No se pudo obtener fileId o fileCardElement.", {fileId, fileCardElement});
                    showToast('Error interno: No se pudo determinar qué archivo eliminar.', 'error');
                }
            });
        });
    }


    // ==================================================================
    // !!! CONFIGURACIÓN DE UN ÚNICO LISTENER GLOBAL PARA CERRAR MENÚS AL CLIC FUERA !!!
    // !!! ESTE LISTENER SE AÑADE UNA SOLA VEZ Y MANEJA AMBOS TIPOS DE MENÚS !!!
    // !!! DEBE ESTAR DENTRO DEL DOMContentLoaded Y DESPUÉS DE LAS LLAMADAS SETUP !!!
    // ==================================================================
    // Este listener escucha clics en CUALQUIER PARTE de la página.
    document.addEventListener('click', (event) => {
        // Comprueba si el clic NO fue en un elemento que es un botón de opciones de tarjeta (file o folder)
        const isClickOnToggle = event.target.closest('.file-options-toggle, .folder-options-toggle');
        // Comprueba si el clic NO ocurrió dentro de un elemento que es un menú de opciones de tarjeta (file o folder)
        const isClickInsideMenu = event.target.closest('.file-options-menu, .folder-options-menu');

        // Si el clic fue fuera de ambos tipos de elementos (toggles y menús)...
        if (!isClickOnToggle && !isClickInsideMenu) {
             // ...entonces itera sobre TODOS los menús de opciones visibles y ocúltalos.
             console.log("Clic detectado fuera de toggles/menus contextuales, cerrando todos los menus..."); // Debugging
            document.querySelectorAll('.file-options-menu, .folder-options-menu').forEach(menu => {
                menu.style.display = 'none';
            });
        }
        // NOTA IMPORTANTE: Para que este listener funcione correctamente sin cerrar inmediatamente los menús
        // cuando los abres o usas, los listeners en los botones `.file-options-toggle`, `.folder-options-toggle`
        // y en los enlaces/botones dentro de los menús (`.delete-team-option`, etc.) DEBEN llamar a `event.stopPropagation()`.
        // Esto impide que el evento de clic llegue hasta este listener global.
        // Las funciones `setupFolderOptionMenus`, `setupFileOptionMenus`, `setupDeleteTeamLinks`, `setupDeleteOptionLinks` ya incluyen `event.stopPropagation()`.
    });


    // =====================================================
    // !!! LLAMADAS A LAS FUNCIONES DE CONFIGURACIÓN !!!
    // Estas funciones configuran los listeners. Deben ser llamadas al final del DOMContentLoaded.
    // =====================================================

    // Configura los listeners para menús y eliminación de ARCHIVOS
    setupFileOptionMenus();
    setupDeleteOptionLinks(); // Asegúrate de tener esta función implementada si no la tenías

    // Configura los listeners para menús y eliminación de EQUIPOS (CARPETAS)
    setupFolderOptionMenus(); // Configura el despliegue/ocultamiento de los menús de carpeta
    setupDeleteTeamLinks();   // Configura la acción del clic en "Eliminar Equipo" (Asegúrate de tener esta función)

    console.log("Todas las funciones de setup ejecutadas al final de DOMContentLoaded.");

}); // Fin de DOMContentLoaded listener

// NOTA: Las definiciones completas de las funciones asíncronas (eliminarArchivoDrive, eliminarEquipo)
// pueden estar definidas dentro o fuera del listener DOMContentLoaded. En este código unificado,
// están definidas dentro para mantener todo el código relacionado en un solo bloque fácil de copiar.
// Si decides definirlas fuera, asegúrate de que estén definidas ANTES de que las setup functions (que las llaman) se ejecuten.