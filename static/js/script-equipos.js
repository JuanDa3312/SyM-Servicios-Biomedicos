// --- Función Helper para mostrar mensajes Toast (YA DEBE ESTAR EN TU JS) ---
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

// Asegúrate de que PDFDocument esté disponible globalmente o pásalo
const { PDFDocument } = PDFLib;


// --- FUNCIÓN MODIFICADA: Asegurar Fondo Blanco y Opaco ---
/**
 * Procesa una imagen para asegurar que su fondo sea blanco y opaco, eliminando ruidos/grises claros.
 * Esta versión NO hace el fondo transparente, sino que lo fuerza a ser blanco opaco.
 * @param {File} imageFile El archivo de imagen (JPEG o PNG).
 * @returns {Promise<ArrayBuffer>} Una promesa que resuelve con el ArrayBuffer de la imagen procesada (con fondo blanco opaco).
 */
async function processImageForSolidWhiteBackground(imageFile) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const upscaleFactor = 2; // Puedes ajustar este factor de escalado si la imagen original es de baja resolución
                const scaledWidth = img.width * upscaleFactor;
                const scaledHeight = img.height * upscaleFactor;

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                canvas.width = scaledWidth;
                canvas.height = scaledHeight;

                // Dibujar la imagen original en el canvas escalado
                ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // --- AJUSTES PARA LA DETECCIÓN DE BLANCO Y RUIDO ---
                const whiteThreshold = 230; // Más bajo para ser más agresivo con los grises claros
                const colorTolerance = 20;  // Rango para detectar "blancos" no puros
                const darkThreshold = 50;   // Umbral para proteger los píxeles de la firma (oscuros)

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3]; // Canal alfa actual

                    // Determina si el píxel es "blanco" o "gris muy claro" según los umbrales
                    const isWhiteish = (
                        r >= whiteThreshold - colorTolerance && r <= 255 &&
                        g >= whiteThreshold - colorTolerance && g <= 255 &&
                        b >= whiteThreshold - colorTolerance && b <= 255
                    );

                    // Determina si el píxel es "oscuro" (probable parte de la firma)
                    const isDarkPixel = (r < darkThreshold && g < darkThreshold && b < darkThreshold);

                    // Si el píxel es "blanco" o "gris claro" Y NO es un píxel oscuro de la firma
                    if (isWhiteish && !isDarkPixel) {
                        // Forzar el píxel a ser blanco puro y completamente opaco
                        data[i] = 255;     // Rojo a máximo
                        data[i + 1] = 255; // Verde a máximo
                        data[i + 2] = 255; // Azul a máximo
                        data[i + 3] = 255; // Alfa a máximo (totalmente opaco)
                    }
                    // NOTA: Si el píxel NO es "blanco" o "gris claro" (es decir, es parte de la firma),
                    // se mantiene su color original y su opacidad original.
                    // Si el original era PNG transparente, su transparencia se mantendrá para las áreas no-fondo.
                    // Pero para los JPG, siempre será opaco (255 de alfa).
                }
                ctx.putImageData(imageData, 0, 0);

                // Convertir el canvas a un Blob JPEG. ¡IMPORTANTE! JPG no soporta transparencia,
                // forzando todos los píxeles a ser opacos y manteniendo el fondo blanco.
                // Si la imagen original era un PNG transparente, ahora tendrá un fondo blanco.
                canvas.toBlob((blob) => {
                    if (blob) {
                        const blobReader = new FileReader();
                        blobReader.onloadend = () => resolve(blobReader.result);
                        blobReader.readAsArrayBuffer(blob);
                    } else {
                        reject(new Error('No se pudo convertir el canvas a Blob.'));
                    }
                }, 'image/jpeg', 0.95); // Usar JPEG con calidad (ej. 0.95) para forzar opacidad.


            };
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
    });
}


document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM completamente cargado y parseado. script-equipos.js");

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
            const anexarFirmaModal = document.getElementById('anexarFirmaModal'); // Captura el nuevo modal

            const isClickInsideRegistrarModal = registrarEquipoModal && registrarEquipoModal.contains(event.target) && registrarEquipoModal.style.display === 'flex';
            const isClickInsideFirmaModal = anexarFirmaModal && anexarFirmaModal.contains(event.target) && anexarFirmaModal.style.display === 'flex'; // Comprueba si el nuevo modal está abierto
            const isClickOnFabToggle = toggleMenuPrincipalButton.contains(event.target);
            const isClickInsideFabMenu = menuPrincipal.contains(event.target);

            // Asegúrate de que el clic no sea dentro de NINGUNA modal abierta ni en el FAB o su menú
            if (!isClickInsideRegistrarModal && !isClickInsideFirmaModal && !isClickOnFabToggle && !isClickInsideFabMenu) {
                menuPrincipal.classList.remove('menu-visible');
            }
        });
        menuPrincipal.querySelectorAll('.menu-opcion').forEach(opcion => {
            if (opcion.id !== 'triggerFileUpload' && opcion.id !== 'btnRegistrarNuevoEquipoGlobalMenu' && opcion.id !== 'btnRegistrarNuevoEquipoModalTrigger') {
                opcion.addEventListener('click', () => {
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
    }

    // --- MODAL DE REGISTRO DE NUEVO EQUIPO (TU CÓDIGO EXISTENTE) ---
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

                const entidadJson = this.dataset.entidadJsonKey;
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

    // --- NUEVA LÓGICA: ANEXAR FIRMA ---
    const anexarFirmaModal = document.getElementById('anexarFirmaModal');
    const btnCloseFirmaModal = anexarFirmaModal?.querySelector('.modal-close-button');
    const btnCancelFirmaModal = anexarFirmaModal?.querySelector('.modal-cancel-button-firma');
    const fileNameToSignDisplay = document.getElementById('fileNameToSignDisplay');
    const signatureImageInput = document.getElementById('signatureImageInput');
    const btnConfirmarFirma = document.getElementById('btnConfirmarFirma');
    const firmaLoadingMessage = document.getElementById('firmaLoadingMessage');

    let currentFileIdToSign = null; // Variable para guardar el ID del archivo actual
    let currentFileNameToSign = null; // Variable para guardar el nombre del archivo actual

    // Event listener para los enlaces "Anexar firma" en cada archivo
    document.querySelectorAll('.firma-file-option').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();

            const fileCardElement = event.target.closest('.file-card');
            currentFileIdToSign = fileCardElement.dataset.fileId;
            currentFileNameToSign = fileCardElement.querySelector('.file-name').textContent; // O desde data-file-name

            if (!currentFileIdToSign || !currentFileNameToSign) {
                showToast('Error: No se pudo obtener la información del archivo.', 'error');
                return;
            }

            // Cerrar menú de opciones del archivo
            const optionsMenu = event.target.closest('.file-options-menu');
            if (optionsMenu) optionsMenu.style.display = 'none';

            // Mostrar el modal de la firma
            if (fileNameToSignDisplay) fileNameToSignDisplay.textContent = currentFileNameToSign;
            if (signatureImageInput) signatureImageInput.value = ''; // Limpiar input de archivo
            if (anexarFirmaModal) anexarFirmaModal.style.display = 'flex';
        });
    });

    // Cierre del modal de firma
    if (btnCloseFirmaModal) btnCloseFirmaModal.addEventListener('click', () => { anexarFirmaModal.style.display = 'none'; });
    if (btnCancelFirmaModal) btnCancelFirmaModal.addEventListener('click', () => { anexarFirmaModal.style.display = 'none'; });
    if (anexarFirmaModal) {
        anexarFirmaModal.addEventListener('click', (event) => {
            if (event.target === anexarFirmaModal) {
                anexarFirmaModal.style.display = 'none';
            }
        });
    }

    // Event listener para el botón "Anexar Firma" dentro del modal
    if (btnConfirmarFirma) {
        btnConfirmarFirma.addEventListener('click', async () => {
            if (!currentFileIdToSign) {
                showToast('Error: No se ha seleccionado un archivo PDF para firmar.', 'error');
                return;
            }
            if (signatureImageInput.files.length === 0) {
                showToast('Por favor, selecciona una imagen de firma.', 'error');
                return;
            }

            firmaLoadingMessage.style.display = 'block'; // Mostrar mensaje de carga
            btnConfirmarFirma.disabled = true; // Deshabilitar botón
            signatureImageInput.disabled = true; // Deshabilitar input

            try {
                const imageFile = signatureImageInput.files[0];

                // Paso 1: Descargar el PDF existente desde Drive (backend Flask)
                showToast(`Descargando ${currentFileNameToSign} para añadir firma...`, 'info', 10000);
                const downloadResponse = await fetch(`/download_file/${currentFileIdToSign}`);
                if (!downloadResponse.ok) {
                    throw new Error(`Error al descargar el PDF: ${downloadResponse.statusText}`);
                }
                const pdfBlob = await downloadResponse.blob();
                const pdfArrayBuffer = await pdfBlob.arrayBuffer();

                // Paso 2: Procesar la imagen de la firma (asegurar fondo blanco opaco)
                showToast('Procesando imagen de firma...', 'info', 5000);
                // NOTA: Usamos processImageForSolidWhiteBackground para que el fondo sea blanco opaco.
                const processedImageArrayBuffer = await processImageForSolidWhiteBackground(imageFile);

                // Paso 3: Cargar el PDF y añadir la firma con pdf-lib
                const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
                // Incrustamos como JPEG porque la función processImageForSolidWhiteBackground ahora devuelve un JPEG.
                const image = await pdfDoc.embedJpg(processedImageArrayBuffer);

                const FIXED_WIDTH = 250;
                const FIXED_HEIGHT = 100;

                // Obtener la primera página del PDF
                const pages = pdfDoc.getPages();
                const firstPage = pages[0];

                // Dibuja la imagen en la página con el tamaño fijo
                firstPage.drawImage(image, {
                    x: 138, // Ajusta la posición X (desde la izquierda)
                    y: firstPage.getHeight() - FIXED_HEIGHT - 1287, // AJUSTA ESTE VALOR Y (desde abajo o calcula desde arriba)
                    width: FIXED_WIDTH,
                    height: FIXED_HEIGHT,
                });

                // Guardar los cambios en el PDF
                const pdfBytesConFirma = await pdfDoc.save();
                const finalPdfBlob = new Blob([pdfBytesConFirma], { type: 'application/pdf' });

                // Paso 4: Subir el PDF modificado de vuelta a Drive (backend Flask)
                showToast(`Subiendo PDF con firma: ${currentFileNameToSign}...`, 'info', 15000);
                const formData = new FormData();
                formData.append('pdfFile', finalPdfBlob);
                formData.append('fileId', currentFileIdToSign); // ¡IMPORTANTE! Para sobrescribir el archivo existente
                formData.append('fileName', currentFileNameToSign); // Mantener el mismo nombre

                const uploadResponse = await fetch('/update_file_in_drive', {
                    method: 'POST',
                    body: formData
                });

                if (!uploadResponse.ok) {
                    throw new Error(`Error al subir el PDF modificado: ${uploadResponse.statusText}`);
                }
                const uploadResult = await uploadResponse.json();

                if (uploadResult.success) {
                    showToast(`¡Éxito! Archivo "${uploadResult.fileName}" actualizado con la firma.`, 'success', 3000);
                    anexarFirmaModal.style.display = 'none'; // Cerrar modal
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    throw new Error(uploadResult.error || 'Error desconocido al subir el PDF.');
                }

            } catch (error) {
                console.error("Error al anexar firma:", error);
                showToast(`Error al anexar firma: ${error.message}`, 'error', 7000);
            } finally {
                firmaLoadingMessage.style.display = 'none';
                btnConfirmarFirma.disabled = false;
                signatureImageInput.disabled = false;
            }
        });
    }

    // --- SUBIDA DE ARCHIVOS INDIVIDUALES (TU CÓDIGO EXISTENTE) ---
    const triggerUploadButton = document.getElementById('triggerFileUpload');
    const fileUploaderInput = document.getElementById('fileUploader');

    if (triggerUploadButton && fileUploaderInput) {
        triggerUploadButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (menuPrincipal) menuPrincipal.classList.remove('menu-visible');
            fileUploaderInput.dataset.triggeringButtonFolderId = triggerUploadButton.dataset.folderId;
            fileUploaderInput.click();
        });

        fileUploaderInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const folderId = fileUploaderInput.dataset.triggeringButtonFolderId;
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
                fileUploaderInput.value = '';
                delete fileUploaderInput.dataset.triggeringButtonFolderId;
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
                elementToRemove?.remove();
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
                const entidadJsonParaEliminar = folderCardElement.dataset.entidadJsonKey;

                const optionsMenu = event.target.closest('.folder-options-menu');
                if (optionsMenu) optionsMenu.style.display = 'none';

                if (folderId) {
                    await eliminarEquipo(folderId, folderCardElement, entidadJsonParaEliminar);
                } else {
                    showToast('Error: No se pudo obtener el ID del equipo.', 'error');
                }
            });
        });
    }

    // --- LÓGICA PARA MENÚS Y ELIMINACIÓN DE ARCHIVOS (TU CÓDIGO EXISTENTE) ---
    async function eliminarArchivoDrive(fileId, elementToRemove) {
        if (!confirm('¿Seguro que quieres eliminar este archivo?')) return;
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

    function setupDeleteOptionLinks() { //Para archivos
        document.querySelectorAll('.delete-file-option').forEach(link => {
            link.addEventListener('click', async (event) => {
                event.preventDefault(); event.stopPropagation();
                const fileCardElement = event.target.closest('.file-card');
                if (!fileCardElement) { showToast('Error: No se encontró la tarjeta del archivo.', 'error'); return; }
                const fileId = fileCardElement.dataset.fileId || event.target.dataset.fileId;

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

    // --- Setup de menús contextuales (3 puntos) (TU CÓDIGO EXISTENTE) ---
    function setupOptionMenus(selectorToggle, selectorCard, selectorMenu) {
        document.querySelectorAll(selectorToggle).forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault(); event.stopPropagation();
                const card = event.target.closest(selectorCard);
                const optionsMenu = card?.querySelector(selectorMenu);

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
        const registrarEquipoModal = document.getElementById('registrarEquipoModal');
        const isClickInsideRegistrarModal = registrarEquipoModal && registrarEquipoModal.style.display === 'flex' && registrarEquipoModal.contains(event.target);
        const anexarFirmaModal = document.getElementById('anexarFirmaModal'); // Captura el nuevo modal
        const isClickInsideFirmaModal = anexarFirmaModal && anexarFirmaModal.style.display === 'flex' && anexarFirmaModal.contains(event.target); // Comprueba si el nuevo modal está abierto


        if (!isClickOnContextToggle && !isClickInsideContextMenu && !isClickInsideRegistrarModal && !isClickInsideFirmaModal) {
            document.querySelectorAll('.file-options-menu, .folder-options-menu').forEach(menu => {
                menu.style.display = 'none';
            });
            // El cierre del menú FAB ya se maneja en su propio listener si el clic es fuera de él y de la modal.
        }
    });

    // Llamadas a las funciones de configuración de acciones
    setupDeleteTeamLinks();
    setupDeleteOptionLinks();

    console.log("script-equipos.js: Todos los listeners y setups configurados.");

});