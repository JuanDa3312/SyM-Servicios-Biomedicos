// Mapa para guardar el estado de inicialización y las instancias del canvas/context por tipo de formulario
const firmaState = {
    correctivo: { initialized: false, canvas: null, ctx: null, isEditing: false },
    preventivo: { initialized: false, canvas: null, ctx: null, isEditing: false }
};

// --- Función Helper para mostrar mensajes (MODIFICADA para usar solo la consola) ---  
function showToast(message, type = 'info', duration = 3500) {
    const toast = document.getElementById('toast-message');

    if (!toast) {
        console.warn("Elemento Toast con id 'toast-message' no encontrado. Usando alert como fallback.");
        alert(message); // Fallback a alert si no existe el elemento toast
        return;
    }

    toast.textContent = message;

    // Limpiar clases de tipo y visibilidad previas
    // Se asume que la clase 'toast' está permanentemente en el elemento HTML
    toast.classList.remove('show', 'info', 'success', 'error');

    // Añadir clase de tipo actual
    if (type === 'success') {
        toast.classList.add('success');
    } else if (type === 'error') {
        toast.classList.add('error');
    } else { // 'info' o cualquier otro tipo por defecto
        toast.classList.add('info');
    }

    // Forzar reflujo para reiniciar la animación si es necesario (útil si hay transiciones CSS)
    void toast.offsetWidth;

    // Añadir 'show' para activar la visibilidad/animación
    toast.classList.add('show');

    // Configurar temporizador para ocultar el toast
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// --- Función Principal para Mostrar/Ocular Formularios (del script de formato) ---
function mostrarFormulario() {
    console.log("[DEBUG] mostrarFormulario() llamada.");
    var tipo = document.getElementById("tipoMantenimiento").value;
    var formCorrectivo = document.getElementById("formCorrectivo");
    var formPreventivo = document.getElementById("formPreventivo");
    var fotoInputElement = document.getElementById('fotoInput'); // Asumiendo que es para correctivo
    var previewElement = document.getElementById('preview'); // Asumiendo que es para correctivo

    if (formCorrectivo) formCorrectivo.style.display = "none";
    if (formPreventivo) formPreventivo.style.display = "none";

    if (tipo === "correctivo" && formCorrectivo) {
        console.log("[DEBUG] Mostrando formulario correctivo.");
        formCorrectivo.style.display = "block";
        if (fotoInputElement && previewElement && !fotoInputElement.hasAttribute('data-listener-added-correctivo')) {
            fotoInputElement.addEventListener('change', function(event) {
                if (!previewElement) return;
                previewElement.innerHTML = '';
                const files = event.target.files;
                for (let i = 0; i < files.length; i++) {
                    let reader = new FileReader();
                    reader.onload = function(e) {
                        let img = document.createElement('img');
                        img.src = e.target.result;
                        img.style.maxWidth = '500px'; img.style.maxHeight = '500px'; img.style.height = 'auto';
                        img.style.margin = '5px'; img.style.border = '1px solid #ddd';
                        img.style.borderRadius = '4px'; img.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        previewElement.appendChild(img);
                    }
                    reader.readAsDataURL(files[i]);
                }
            });
            fotoInputElement.setAttribute('data-listener-added-correctivo', 'true');
            console.log("[DEBUG] Listener para fotos añadido (correctivo).");
        }
        if (!firmaState.correctivo.initialized) {
            inicializarFirma('correctivo');
        }
    } else if (tipo === "preventivo" && formPreventivo) {
        console.log("[DEBUG] Mostrando formulario preventivo.");
        formPreventivo.style.display = "block";
        if (!firmaState.preventivo.initialized) {
            inicializarFirma('preventivo');
        }
    }
}

// --- Función Separada para Inicializar el Canvas de la Firma (del script de formato) ---
function inicializarFirma(tipoMantenimiento) {
    console.log(`[DEBUG] inicializarFirma() llamada para tipo: ${tipoMantenimiento}.`);
    const canvasId = `firmaCanvas${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`;
    const canvas = document.getElementById(canvasId);

    if (!canvas) {
        console.warn(`[DEBUG] Elemento canvas con ID '${canvasId}' no encontrado.`);
        return;
    }

    if (firmaState[tipoMantenimiento].initialized) {
        console.log(`[DEBUG] Canvas de firma para ${tipoMantenimiento} ya inicializado.`);
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.warn("[DEBUG] No se pudo obtener el contexto 2D del canvas.");
        return;
    }

    firmaState[tipoMantenimiento].canvas = canvas;
    firmaState[tipoMantenimiento].ctx = ctx;

    try {
        canvas.width = canvas.offsetWidth > 0 ? canvas.offsetWidth : 300;
        canvas.height = canvas.offsetHeight > 0 ? canvas.offsetHeight : 150;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch (e) {
        console.error(`[DEBUG] Error ajustando tamaño inicial del canvas para ${tipoMantenimiento}:`, e);
        canvas.width = 300; canvas.height = 150;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
    let drawing = false;

    const drawingUtils = {
        getEventPos: function(evt) { 
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            let clientX, clientY;
            if (evt.touches && evt.touches.length > 0) {
                clientX = evt.touches[0].clientX;
                clientY = evt.touches[0].clientY;
            } else {
                clientX = evt.clientX;
                clientY = evt.clientY;
            }
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        },
        start: function(e) { 
            if (e.type === 'touchstart') e.preventDefault();
            if (!firmaState[tipoMantenimiento].isEditing) return;
            drawing = true;
            const pos = this.getEventPos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            canvas.removeAttribute('data-empty');
        },
        draw: function(e) { 
            if (e.type === 'touchmove') e.preventDefault();
            if (!drawing || !firmaState[tipoMantenimiento].isEditing) return;
            const pos = this.getEventPos(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        },
        stop: function() { 
            if (!drawing) return;
            drawing = false;
            ctx.beginPath();
        }
    };

    canvas.removeEventListener('mousedown', drawingUtils.start);
    canvas.removeEventListener('mousemove', drawingUtils.draw);
    canvas.removeEventListener('mouseup', drawingUtils.stop);
    canvas.removeEventListener('mouseleave', drawingUtils.stop);
    canvas.removeEventListener('touchstart', drawingUtils.start);
    canvas.removeEventListener('touchmove', drawingUtils.draw);
    canvas.removeEventListener('touchend', drawingUtils.stop);

    canvas.addEventListener('mousedown', drawingUtils.start.bind(drawingUtils));
    canvas.addEventListener('mousemove', drawingUtils.draw.bind(drawingUtils));
    canvas.addEventListener('mouseup', drawingUtils.stop.bind(drawingUtils));
    canvas.addEventListener('mouseleave', drawingUtils.stop.bind(drawingUtils));
    canvas.addEventListener('touchstart', drawingUtils.start.bind(drawingUtils), { passive: false });
    canvas.addEventListener('touchmove', drawingUtils.draw.bind(drawingUtils), { passive: false });
    canvas.addEventListener('touchend', drawingUtils.stop.bind(drawingUtils));

    firmaState[tipoMantenimiento].initialized = true;
    clearSignature(tipoMantenimiento);
    console.log(`[DEBUG] Canvas de firma para ${tipoMantenimiento} inicializado y configurado.`);
}

// --- Funciones para los botones de Firma (del script de formato) ---
window.startSignature = function(tipoMantenimiento) {
    console.log(`[DEBUG] startSignature() llamada para tipo: ${tipoMantenimiento}.`);
    const state = firmaState[tipoMantenimiento];
    if (!state || !state.canvas || !state.ctx) { console.warn(`[DEBUG] startSignature: Estado de firma no válido para ${tipoMantenimiento}.`); return; }
    state.isEditing = true;
    document.getElementById(`clearButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = false;
    document.getElementById(`saveButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = false;
    document.getElementById(`editButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = true;
    document.getElementById(`startButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = true;
    document.getElementById(`message${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).textContent = 'Dibuje su firma en el recuadro...';
    state.canvas.setAttribute('data-empty', 'true');
};
window.clearSignature = function(tipoMantenimiento) {
    console.log(`[DEBUG] clearSignature() llamada para tipo: ${tipoMantenimiento}.`);
    const state = firmaState[tipoMantenimiento];
    if (!state || !state.canvas || !state.ctx) { console.warn(`[DEBUG] clearSignature: Estado de firma no válido para ${tipoMantenimiento}.`); return; }
    state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    document.getElementById(`message${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).textContent = 'Firma borrada. Presione "Anexar Firma" para iniciar.';
    state.isEditing = false;
    document.getElementById(`clearButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = true;
    document.getElementById(`saveButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = true;
    document.getElementById(`editButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = true;
    document.getElementById(`startButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = false;
    state.canvas.setAttribute('data-empty', 'true');
};
window.saveSignature = function(tipoMantenimiento) {
    console.log(`[DEBUG] saveSignature() llamada para tipo: ${tipoMantenimiento}.`);
    const state = firmaState[tipoMantenimiento];
    if (!state || !state.canvas || !state.ctx) { console.warn(`[DEBUG] saveSignature: Estado de firma no válido para ${tipoMantenimiento}.`); return; }
    state.isEditing = false;
    document.getElementById(`editButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = false;
    document.getElementById(`saveButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = true;
    const blank = document.createElement('canvas');
    blank.width = state.canvas.width; blank.height = state.canvas.height;
    if (state.canvas.toDataURL() !== blank.toDataURL()) {
        state.canvas.removeAttribute('data-empty');
        document.getElementById(`message${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).textContent = 'Firma guardada. Presione "Editar" para modificar.';
        console.log(`[DEBUG] Firma guardada para ${tipoMantenimiento}.`);
    } else {
        document.getElementById(`message${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).textContent = 'Firma guardada (vacía). Presione "Editar" para modificar.';
        state.canvas.setAttribute('data-empty', 'true');
        console.log(`[DEBUG] Firma guardada (vacía) para ${tipoMantenimiento}.`);
    }
};
window.enableEditing = function(tipoMantenimiento) {
    console.log(`[DEBUG] enableEditing() llamada para tipo: ${tipoMantenimiento}.`);
    const state = firmaState[tipoMantenimiento];
    if (!state || !state.canvas || !state.ctx) { console.warn(`[DEBUG] enableEditing: Estado de firma no válido para ${tipoMantenimiento}.`); return; }
    state.isEditing = true;
    document.getElementById(`editButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = true;
    document.getElementById(`saveButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = false;
    document.getElementById(`clearButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = false;
    document.getElementById(`message${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).textContent = 'Modo de edición activado. Puede modificar la firma.';
};
// Asegúrate de que la función showToast esté definida antes en tu script o globalmente.
// function showToast(message, type = 'info', duration = 3500) { /* ... tu función ... */ }

// Asegúrate de que la función showToast esté definida antes en tu script o globalmente.
// function showToast(message, type = 'info', duration = 3500) { /* ... tu función ... */ }

async function generarYSubirPdfADrive(formId, folderIdDesdeHtml, statusElementId) {
    console.log(`[FormatoJS][PDF] Iniciando para formId: ${formId}, folderIdDesdeHtml: ${folderIdDesdeHtml}, statusId: ${statusElementId}`);
    const element = document.getElementById(formId);
    const botonSubir = document.querySelector(`button[onclick*="generarYSubirPdfADrive('${formId}'"]`);
    const statusDiv = statusElementId ? document.getElementById(statusElementId) : null;

    if (statusDiv) { // Limpiar mensaje de estado previo si existe
        statusDiv.textContent = '';
        statusDiv.className = ''; // Limpiar clases de estilo previas
    }

    if (!element) {
        showToast('Error: Formulario no encontrado para generar PDF.', 'error');
        if (statusDiv) { statusDiv.textContent = 'Error: Formulario no encontrado.'; }
        return;
    }

    const targetFolderId = folderIdDesdeHtml; 
    if (!targetFolderId || targetFolderId === 'None' || targetFolderId === '' || String(targetFolderId).includes('{{')) {
        const errorMsgCritico = `Error: ID de carpeta destino para Drive no válido (recibido: '${targetFolderId}'). No se puede subir el PDF.`;
        console.error("[FormatoJS][PDF] " + errorMsgCritico);
        showToast(errorMsgCritico, 'error', 7000);
        if (statusDiv) { statusDiv.textContent = errorMsgCritico; }
        if (botonSubir) botonSubir.disabled = false;
        return;
    }

    let tipoMantenimiento = formId.includes('Correctivo') ? 'CORRECTIVO' : 'PREVENTIVO';
    let nombreCampoEquipoNombre = formId.includes('Correctivo') ? 'equipo_nombre_corr' : 'equipo_nombre_prev';
    let nombreCampoFecha = formId.includes('Correctivo') ? 'fecha_corr' : 'fecha_prev';

    const equipoNombreInput = element.querySelector(`input[name="${nombreCampoEquipoNombre}"]`);
    const fechaInput = element.querySelector(`input[name="${nombreCampoFecha}"]`);

    if (!equipoNombreInput || !fechaInput) {
        showToast('Error: Faltan campos de nombre de equipo o fecha en el formulario.', 'error');
        if (botonSubir) botonSubir.disabled = false;
        return;
    }
    let equipoNombre = equipoNombreInput.value.trim();
    let fechaValor = fechaInput.value;
    if (!equipoNombre || !fechaValor) {
        showToast('La fecha es obligatoria para realizar el mantenimiento.', 'error');
        if (botonSubir) botonSubir.disabled = false;
        return;
    }

    let equipoNombreLimpio = equipoNombre.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.\-]/g, '');
    if (equipoNombreLimpio.length > 50) equipoNombreLimpio = equipoNombreLimpio.substring(0, 50);
    if (!equipoNombreLimpio) equipoNombreLimpio = 'EQUIPO_SIN_NOMBRE';
    const nombreArchivo = `${tipoMantenimiento}-${equipoNombreLimpio}-${fechaValor}.pdf`;
    console.log(`[FormatoJS][PDF] Nombre de archivo generado: ${nombreArchivo}`);

    const elementsToHide = element.querySelectorAll('.no-print');
    const originalDisplayState = new Map();
    elementsToHide.forEach(el => {
        originalDisplayState.set(el, el.style.display);
        el.style.display = 'none';
    });
    const originalFormWidth = element.style.width;
    const originalOverflow = document.body.style.overflow; // Guardar estado del overflow
    document.body.style.overflow = 'hidden'; // Evitar barras de scroll inesperadas

    element.style.width = '800px'; // Un ancho fijo temporal para la captura
    // O un ancho que sepas que hace que tu contenido se vea bien para el PDF

    // --- OPCIONES DE html2pdf.js AJUSTADAS ---
    const options = { 
        margin: [10, 0, 0, 0], // Margen: [arriba, izquierda, abajo, derecha] en mm. 15mm a los lados.
        filename: nombreArchivo, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { 
            scale: 2, // Tu escala preferida que te daba buen formato interno
            logging: false, 
            useCORS: true, 
            scrollY: 0
            // Quitamos windowWidth para que se base en el '80%' del viewport que estableciste
        },
        jsPDF: { 
            unit: 'mm', 
            format: [300, 610], // Tu formato de página grande
            orientation: 'portrait' 
        }, 
        pagebreak: { mode: ['css', 'avoid-all'] }
    };
    // --- FIN OPCIONES AJUSTADAS ---
    
    if (botonSubir) botonSubir.disabled = true;
    showToast(`Generando y subiendo: ${nombreArchivo}... Por favor espere.`, 'info', 25000);

    try {
        const pdfBlob = await html2pdf().from(element).set(options).outputPdf('blob');
        console.log("[FormatoJS][PDF] PDF generado como Blob.");
        
        element.style.width = originalFormWidth; 
        elementsToHide.forEach(el => { 
            el.style.display = originalDisplayState.get(el);
        });

        const formData = new FormData();
        formData.append('pdfFile', pdfBlob, nombreArchivo);
        formData.append('fileName', nombreArchivo);
        formData.append('folderId', targetFolderId);
        
        console.log("[FormatoJS][PDF] FormData para enviar:", {folderId: targetFolderId, fileName: nombreArchivo, pdfFileBlobName: pdfBlob.name});

        const response = await fetch('/upload_pdf_to_drive', { method: 'POST', body: formData });
        if (statusDiv) statusDiv.textContent = '';

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                showToast(`¡Éxito! Archivo "${result.fileName}" subido. Redirigiendo...`, 'success', 2000);
                
                if (element && typeof element.reset === 'function') element.reset();
                const tipoSelect = document.getElementById('tipoMantenimiento');
                if(tipoSelect) tipoSelect.selectedIndex = 0;
                if (document.getElementById('formCorrectivo')) document.getElementById('formCorrectivo').style.display = 'none';
                if (document.getElementById('formPreventivo')) document.getElementById('formPreventivo').style.display = 'none';
                const previewContainer = document.getElementById('preview'); 
                if (previewContainer) previewContainer.innerHTML = ''; 
                const fotoInputEl = document.getElementById('fotoInput'); 
                if (fotoInputEl) fotoInputEl.value = ''; 
                if (firmaState.correctivo.initialized) clearSignature('correctivo');
                if (firmaState.preventivo.initialized) clearSignature('preventivo');

                const currentParams = new URLSearchParams(window.location.search);
                const empresaParaRedirect = currentParams.get('empresa');
                const entidadJsonParaRedirect = currentParams.get('entidad_json');

                if (folderIdDesdeHtml && empresaParaRedirect && entidadJsonParaRedirect) {
                    const redirectUrl = `/carpeta/${folderIdDesdeHtml}?empresa=${encodeURIComponent(empresaParaRedirect)}&entidad_json_key=${encodeURIComponent(entidadJsonParaRedirect)}`;
                    console.log("[FormatoJS][PDF] Redirigiendo a:", redirectUrl);
                    setTimeout(() => { window.location.href = redirectUrl; }, 3100);
                } else {
                    console.error("[FormatoJS][PDF] Error al construir URL de redirección: faltan parámetros.", 
                                { folder: folderIdDesdeHtml, empresa: empresaParaRedirect, entidad: entidadJsonParaRedirect });
                    showToast("PDF subido. Error al redirigir. Recargando formulario actual.", 'warn', 4000);
                    setTimeout(() => { window.location.reload(); }, 4100);
                }
            } else {
                showToast(`Error al subir: ${result.error || 'Error desconocido del servidor.'}`, 'error', 7000);
            }
        } else {
            let errorText = `Error HTTP ${response.status}: ${response.statusText}`;
            try { const errorBody = await response.json(); if (errorBody && errorBody.error) errorText = errorBody.error; } catch (e) {}
            showToast(errorText, 'error', 7000);
            if (response.status === 401) {
                showToast("Sesión expirada. Redirigiendo para autenticar...", 'error', 3000);
                setTimeout(() => { window.location.href = '/authorize'; }, 3000);
            }
        }
    } catch (err) {
        showToast('Error inesperado durante la generación o envío del PDF.', 'error', 7000);
        console.error("[FormatoJS][PDF] Error crítico en generarYSubirPdfADrive:", err);
        if (element) element.style.width = originalFormWidth;
        elementsToHide.forEach(el => {
            el.style.display = originalDisplayState.get(el);
        });
    } finally {
        if (botonSubir) botonSubir.disabled = false;
        console.log("[FormatoJS][PDF] Proceso de PDF finalizado.");
    }
}
// --- Listener DOMContentLoaded (Integrando TU lógica) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM completamente cargado y parseado. (Mensaje del script general)");

    // --- INICIO DE TU LÓGICA DOMContentLoaded ---
    const menuPrincipal = document.getElementById('menuOpciones');
    const toggleMenuPrincipalButton = document.querySelector('.btn-add-inside');

    if (toggleMenuPrincipalButton && menuPrincipal) {
        toggleMenuPrincipalButton.addEventListener('click', (event) => {
            event.stopPropagation();
            menuPrincipal.classList.toggle('menu-visible');
            console.log("[DEBUG] Menú principal toggleado. Visible:", menuPrincipal.classList.contains('menu-visible'));
        });

        document.addEventListener('click', (event) => {
            const registrarEquipoModal = document.getElementById('registrarEquipoModal');
            const isClickInsideModalVisible = registrarEquipoModal && registrarEquipoModal.style.display !== 'none' && registrarEquipoModal.contains(event.target);
        
            if (!isClickInsideModalVisible && 
                toggleMenuPrincipalButton && !toggleMenuPrincipalButton.contains(event.target) &&
                menuPrincipal && !menuPrincipal.contains(event.target)) {
                if (menuPrincipal.classList.contains('menu-visible')) {
                    console.log("[DEBUG] Cerrando menú principal por clic fuera.");
                    menuPrincipal.classList.remove('menu-visible');
                }
            }
        });
        
        menuPrincipal.querySelectorAll('.menu-opcion').forEach(opcion => {
            const noAutoCloseIds = ['triggerFileUpload', 'btnRegistrarNuevoEquipoGlobalMenu', 'btnRegistrarNuevoEquipoModalTrigger'];
            
            if (!noAutoCloseIds.includes(opcion.id)) {
                opcion.addEventListener('click', (event) => {
                    console.log(`[DEBUG] Opción de menú '${opcion.id || opcion.textContent.trim()}' clickeada, cerrando menú.`);
                    setTimeout(() => { 
                        menuPrincipal.classList.remove('menu-visible');
                    }, 50);
                });
            } else {
                opcion.addEventListener('click', (event) => {
                    console.log(`[DEBUG] Opción de menú '${opcion.id || opcion.textContent.trim()}' clickeada, no se cierra automáticamente.`);
                    event.stopPropagation(); 
                });
            }
        });
    } else {
        console.warn("Advertencia: Elementos del menú principal ('#menuOpciones') o su toggle ('.btn-add-inside') no encontrados.");
    }

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
                console.log("[DEBUG] Botón para abrir modal de registro de equipo clickeado:", this.id);
                if (menuPrincipal) menuPrincipal.classList.remove('menu-visible');

                const entidadJson = this.dataset.entidadJsonKey || this.dataset.entidadJsonKkey; 
                const empresa = this.dataset.empresa;
                let serviceNameForJson = this.dataset.currentServiceName;
                let parentDriveFolderId = this.dataset.parentFolderId;

                console.log("[DEBUG] Abriendo modal de registro. Datos del botón:", { entidadJson, empresa, serviceNameForJson, parentDriveFolderId });

                if (serviceNameForJson) {
                    serviceNameForJson = serviceNameForJson.trim().toUpperCase();
                }

                if ((!serviceNameForJson || serviceNameForJson === "SERVICIO GENERAL") && !parentDriveFolderId) {
                    let promptedServiceName = prompt("Introduce el nombre del SERVICIO (ej: AMBULANCIA, QUIROFANO) para el nuevo equipo. Se guardará en mayúsculas:");
                    if (!promptedServiceName || promptedServiceName.trim() === "") {
                        showToast("Se requiere un nombre de servicio para registrar un equipo.", 'error');
                        return;
                    }
                    serviceNameForJson = promptedServiceName.trim().toUpperCase();
                    if (!parentDriveFolderId) {
                        console.warn("[DEBUG] Nombre de servicio ingresado por prompt, pero no hay parentDriveFolderId. La carpeta de servicio se creará en la raíz de Drive del usuario o donde la API determine.");
                    }
                }
                
                if(modalEntidadJsonInput) modalEntidadJsonInput.value = entidadJson || '';
                if(modalEmpresaInput) modalEmpresaInput.value = empresa || '';
                if(modalServiceNameDisplay) modalServiceNameDisplay.textContent = serviceNameForJson || 'N/A';
                if(modalServiceKeyInput) modalServiceKeyInput.value = serviceNameForJson || '';
                if(modalParentDriveFolderIdInput) modalParentDriveFolderIdInput.value = parentDriveFolderId || '';
                
                if(formRegistrarEquipo) formRegistrarEquipo.reset();

                registrarEquipoModal.style.display = 'flex';
                console.log("[DEBUG] Modal de registro de equipo mostrada.");
                setTimeout(() => {
                    if(modalEquipoNombreInput) modalEquipoNombreInput.focus();
                }, 100);
            });
        });
    } else {
        console.warn("[DEBUG] No se encontraron botones para abrir el modal de registro o el modal mismo.");
    }

    if (btnCloseModal && registrarEquipoModal) btnCloseModal.addEventListener('click', () => { registrarEquipoModal.style.display = 'none'; if(formRegistrarEquipo) formRegistrarEquipo.reset(); console.log("[DEBUG] Modal de registro cerrada por botón X."); });
    if (btnCancelModal && registrarEquipoModal) btnCancelModal.addEventListener('click', () => { registrarEquipoModal.style.display = 'none'; if(formRegistrarEquipo) formRegistrarEquipo.reset(); console.log("[DEBUG] Modal de registro cancelada."); });
    if (registrarEquipoModal) {
        registrarEquipoModal.addEventListener('click', (event) => {
            if (event.target === registrarEquipoModal) {
                registrarEquipoModal.style.display = 'none';
                if(formRegistrarEquipo) formRegistrarEquipo.reset();
                console.log("[DEBUG] Modal de registro cerrada por clic fuera.");
            }
        });
    }

    if (formRegistrarEquipo) {
        formRegistrarEquipo.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log("[DEBUG] Formulario de registro de equipo enviado.");

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
            if (!entidadJsonParaApi) { showToast('Error interno: No se pudo determinar la entidad para el registro.', 'error'); console.error("[DEBUG] Submit Error: entidadJsonParaApi está vacío."); return; }
            if (!parentFolderIdInputVal) { showToast('Error interno: No se pudo determinar la carpeta de servicio en Drive.', 'error'); console.error("[DEBUG] Submit Error: parentFolderIdInputVal está vacío."); return; }

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

            console.log("[DEBUG] [Registrar Equipo Submit] Datos a enviar:", JSON.stringify(dataToSend, null, 2));
            showToast('Registrando equipo y creando carpeta...', 'info', 15000); // Duración ignorada

            try {
                const response = await fetch('/api/registrar_equipo_completo', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToSend)
                });
                const result = await response.json();
                console.log("[DEBUG] [Registrar Equipo Submit] Respuesta del servidor:", result);
                if (response.ok && result.success) {
                    showToast(result.message || 'Equipo registrado!', 'success', 5000); // Duración ignorada
                    registrarEquipoModal.style.display = 'none';
                    if(formRegistrarEquipo) formRegistrarEquipo.reset();
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    const errorMsg = result.error || 'Error desconocido del servidor.';
                    showToast(`Error al registrar equipo: ${errorMsg}`, 'error', 7000); // Duración ignorada
                }
            } catch (error) {
                console.error("[DEBUG] [Registrar Equipo Submit] Error en fetch:", error);
                showToast('Error de red o conexión al registrar.', 'error', 7000); // Duración ignorada
            }
        });
    } else {
        console.warn("[DEBUG] Formulario 'formRegistrarEquipo' no encontrado.");
    }

    const triggerUploadButton = document.getElementById('triggerFileUpload');
    const fileUploaderInput = document.getElementById('fileUploader');
    if (triggerUploadButton && fileUploaderInput) { 
        console.log("[DEBUG] Elementos para subida de archivos individuales encontrados.");
    } else {
        console.warn("[DEBUG] Elementos 'triggerFileUpload' o 'fileUploader' no encontrados.");
    }

    async function eliminarEquipo(folderId, elementToRemove, entidadJsonParaEliminar) {
        if (!confirm('¡ADVERTENCIA! ¿Estás seguro de que quieres eliminar este equipo y TODO su contenido? Esta acción no se puede deshacer.')) {
            console.log("[DEBUG] [Eliminar Equipo] Eliminación cancelada por el usuario.");
            return;
        }
        if (!entidadJsonParaEliminar) {
            console.error("[DEBUG] [Eliminar Equipo] Error: Falta la clave de entidad (entidad_json_key) para la eliminación.");
            showToast('Error interno: No se pudo determinar la entidad del equipo a eliminar.', 'error');
            return;
        }

        console.log(`[DEBUG] [Eliminar Equipo] Procediendo a eliminar equipo ID: ${folderId} de entidad: ${entidadJsonParaEliminar}`);
        showToast('Eliminando equipo y su contenido...', 'info');

        try {
            const payload = { folderId: folderId, entidad_json_key: entidadJsonParaEliminar };
            const response = await fetch('/delete_equipo', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            console.log("[DEBUG] [Eliminar Equipo] Respuesta del servidor:", { status: response.status, ok: response.ok, body: result });

            if (response.ok && result.success) {
                showToast(`Equipo eliminado con éxito!`, 'success', 4000); // Duración ignorada
                if (elementToRemove?.parentNode) {
                    elementToRemove.parentNode.removeChild(elementToRemove);
                }
            } else {
                let errorMessage = result.error || `Error HTTP ${response.status}.`;
                if (response.status === 404) errorMessage = 'Error: El equipo (carpeta) no fue encontrado en Drive.';
                if (response.status === 403) errorMessage = 'Error: Permisos insuficientes para eliminar este equipo.';
                showToast(`Error al eliminar el equipo: ${errorMessage}`, 'error', 8000); // Duración ignorada
            }
        } catch (error) {
            console.error('[DEBUG] [Eliminar Equipo] Error en la petición fetch:', error);
            showToast('Error de red al intentar eliminar el equipo.', 'error', 8000); // Duración ignorada
        }
    }

    function setupDeleteTeamLinks() {
        console.log("[DEBUG] Ejecutando setupDeleteTeamLinks()");
        document.querySelectorAll('.delete-team-option').forEach(link => {
            link.addEventListener('click', async (event) => {
                event.preventDefault(); event.stopPropagation();
                console.log("[DEBUG] Clic en .delete-team-option");

                const folderCardElement = event.target.closest('.folder-card');
                if (!folderCardElement) {
                    console.error("[DEBUG] [setupDeleteTeamLinks] Error: No se encontró .folder-card padre.");
                    showToast('Error interno al intentar eliminar.', 'error');
                    return;
                }

                const folderId = folderCardElement.dataset.folderId;
                const entidadJsonParaEliminar = folderCardElement.dataset.entidadJsonKey;
                console.log("[DEBUG] [setupDeleteTeamLinks] folderId:", folderId, "entidadJson:", entidadJsonParaEliminar);

                const optionsMenu = event.target.closest('.folder-options-menu');
                if (optionsMenu) optionsMenu.style.display = 'none';

                if (folderId && folderCardElement) {
                    await eliminarEquipo(folderId, folderCardElement, entidadJsonParaEliminar);
                } else {
                    console.error("[DEBUG] [setupDeleteTeamLinks] Error: No se pudo obtener folderId o folderCardElement.", {folderId, folderCardElement});
                    showToast('Error interno: No se pudo determinar qué equipo eliminar.', 'error');
                }
            });
        });
    }

    function setupFolderOptionMenus() {
        console.log("[DEBUG] Ejecutando setupFolderOptionMenus()");
        document.querySelectorAll('.folder-options-toggle').forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault(); event.stopPropagation();
                const folderCard = event.target.closest('.folder-card');
                const optionsMenu = folderCard?.querySelector('.folder-options-menu');
                document.querySelectorAll('.file-options-menu, .folder-options-menu').forEach(menu => {
                    if (menu !== optionsMenu) menu.style.display = 'none';
                });
                if (optionsMenu) {
                    optionsMenu.style.display = (optionsMenu.style.display === 'flex') ? 'none' : 'flex';
                    console.log("[DEBUG] Menú de opciones de carpeta toggleado. Visible:", optionsMenu.style.display === 'flex');
                }
            });
        });
    }
    function setupFileOptionMenus() {
        console.log("[DEBUG] Ejecutando setupFileOptionMenus()");
        document.querySelectorAll('.file-options-toggle').forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault(); event.stopPropagation();
                const fileCard = event.target.closest('.file-card');
                const optionsMenu = fileCard?.querySelector('.file-options-menu');
                document.querySelectorAll('.file-options-menu, .folder-options-menu').forEach(menu => {
                    if (menu !== optionsMenu) menu.style.display = 'none';
                });
                if (optionsMenu) {
                    optionsMenu.style.display = (optionsMenu.style.display === 'flex') ? 'none' : 'flex';
                    console.log("[DEBUG] Menú de opciones de archivo toggleado. Visible:", optionsMenu.style.display === 'flex');
                }
            });
        });
    }
    
    async function eliminarArchivoDrive(fileId, elementToRemove) { 
        console.log(`[DEBUG] Placeholder para eliminarArchivoDrive(${fileId})`);
        showToast('Funcionalidad de eliminar archivo no completamente implementada en este script de ejemplo.', 'info');
    }
    function setupDeleteOptionLinks() { 
        console.log("[DEBUG] Placeholder para setupDeleteOptionLinks(). Si es para archivos, vincular a eliminarArchivoDrive.");
    }

    document.addEventListener('click', (event) => {
        const isClickOnToggle = event.target.closest('.file-options-toggle, .folder-options-toggle');
        const isClickInsideMenu = event.target.closest('.file-options-menu, .folder-options-menu');
        const isClickOnFabToggle = toggleMenuPrincipalButton && toggleMenuPrincipalButton.contains(event.target);
        const isClickInsideFabMenu = menuPrincipal && menuPrincipal.contains(event.target);

        if (!isClickOnToggle && !isClickInsideMenu && !isClickOnFabToggle && !isClickInsideFabMenu) {
            let menuClosed = false;
            document.querySelectorAll('.file-options-menu, .folder-options-menu').forEach(menu => {
                if (menu.style.display !== 'none') {
                    menu.style.display = 'none';
                    menuClosed = true;
                }
            });
            if (menuClosed) console.log("[DEBUG] Menús de opciones de archivo/carpeta cerrados por clic fuera.");
        }
    });

    console.log("[DEBUG] Llamando a las funciones de setup al final de DOMContentLoaded.");
    setupFileOptionMenus();
    setupDeleteOptionLinks(); 
    setupFolderOptionMenus();
    setupDeleteTeamLinks();

    console.log("Todas las funciones de setup especificadas ejecutadas.");
});