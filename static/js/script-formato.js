// Mapa para guardar el estado de inicialización y las instancias del canvas/context por tipo de formulario
const firmaState = {
    correctivo: { initialized: false, canvas: null, ctx: null, isEditing: false },
    preventivo: { initialized: false, canvas: null, ctx: null, isEditing: false }
};

// --- Función Principal para Mostrar/Ocultar Formularios ---
function mostrarFormulario() {
    var tipo = document.getElementById("tipoMantenimiento").value;
    var formCorrectivo = document.getElementById("formCorrectivo");
    var formPreventivo = document.getElementById("formPreventivo");
    var fotoInputElement = document.getElementById('fotoInput');
    var previewElement = document.getElementById('preview');

    // Ocultar ambos formularios inicialmente
    if (formCorrectivo) formCorrectivo.style.display = "none";
    if (formPreventivo) formPreventivo.style.display = "none";

    // Mostrar el formulario seleccionado
    if (tipo === "correctivo" && formCorrectivo) {
        formCorrectivo.style.display = "block";
        // Configurar listener para previsualización de fotos solo si no existe ya
        if (fotoInputElement && previewElement && !fotoInputElement.hasAttribute('data-listener-added')) {
            fotoInputElement.addEventListener('change', function(event) {
                if (!previewElement) return;
                previewElement.innerHTML = ''; // Limpiar imágenes anteriores
                const files = event.target.files;
                for (let i = 0; i < files.length; i++) {
                    let reader = new FileReader();
                    reader.onload = function(e) {
                        let img = document.createElement('img');
                        img.src = e.target.result;
                        img.style.maxWidth = '500px';
                        img.style.maxHeight = '500px';
                        img.style.height = 'auto';
                        img.style.margin = '5px';
                        img.style.border = '1px solid #ddd';
                        img.style.borderRadius = '4px';
                        img.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        previewElement.appendChild(img);
                    }
                    reader.readAsDataURL(files[i]);
                }
            });
            fotoInputElement.setAttribute('data-listener-added', 'true');
            console.log("Listener para fotos añadido.");
        }
        // Inicializar la firma para el formulario correctivo si no se ha hecho
        if (!firmaState.correctivo.initialized) {
            inicializarFirma('correctivo');
        }


    } else if (tipo === "preventivo" && formPreventivo) {
        formPreventivo.style.display = "block";
        // Inicializar la firma para el formulario preventivo si no se ha hecho
        if (!firmaState.preventivo.initialized) {
            inicializarFirma('preventivo');
        }
    }
}


// --- Función Separada para Inicializar el Canvas de la Firma ---
// Ahora recibe el tipo de mantenimiento ('correctivo' o 'preventivo')
function inicializarFirma(tipoMantenimiento) {
    const canvasId = `firmaCanvas${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`; // Construye el ID: firmaCanvasCorrectivo o firmaCanvasPreventivo
    const canvas = document.getElementById(canvasId);

    if (!canvas) {
        console.warn(`Elemento canvas con ID '${canvasId}' no encontrado.`);
        return;
    }

    // Evitar reinicializar si ya se hizo para este tipo
    if (firmaState[tipoMantenimiento].initialized) {
        console.log(`Canvas de firma para ${tipoMantenimiento} ya inicializado.`);
        return;
    }


    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.warn("No se pudo obtener el contexto 2D del canvas.");
        return;
    }

    // Almacenar el canvas y context en el estado global
    firmaState[tipoMantenimiento].canvas = canvas;
    firmaState[tipoMantenimiento].ctx = ctx;


    // Ajustar tamaño inicial (puede ser necesario recalcular si el contenedor cambia de tamaño)
    try {
        // Usa offsetParent para obtener el tamaño del contenedor visible si es necesario
        canvas.width = canvas.offsetWidth > 0 ? canvas.offsetWidth : 300;
        canvas.height = canvas.offsetHeight > 0 ? canvas.offsetHeight : 150;
        // Limpiar el canvas después de redimensionar
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch (e) {
        console.error(`Error ajustando tamaño inicial del canvas para ${tipoMantenimiento}:`, e);
        canvas.width = 300; canvas.height = 150;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }


    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';

    let drawing = false;
    // isEditing ahora se maneja en el estado global firmaState[tipoMantenimiento].isEditing

    // --- Funciones auxiliares para dibujo (anidadas) ---
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
            // Usar el estado isEditing del tipo de mantenimiento actual
            if (e.type === 'touchstart') e.preventDefault();
            if (!firmaState[tipoMantenimiento].isEditing) return;
            drawing = true;
            const pos = this.getEventPos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            canvas.removeAttribute('data-empty');
        },
        draw: function(e) {
             // Usar el estado isEditing del tipo de mantenimiento actual
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


    // --- Añadir Event Listeners al Canvas ---
    // Es importante remover listeners antes de añadir para evitar duplicados si la inicialización se llamara varias veces (aunque con la bandera inicializada, esto no debería pasar)
    canvas.removeEventListener('mousedown', drawingUtils.start);
    canvas.removeEventListener('mousemove', drawingUtils.draw);
    canvas.removeEventListener('mouseup', drawingUtils.stop);
    canvas.removeEventListener('mouseleave', drawingUtils.stop);
    canvas.removeEventListener('touchstart', drawingUtils.start);
    canvas.removeEventListener('touchmove', drawingUtils.draw);
    canvas.removeEventListener('touchend', drawingUtils.stop);

    // Añadir los listeners con bind para mantener el contexto 'drawingUtils'
    canvas.addEventListener('mousedown', drawingUtils.start.bind(drawingUtils));
    canvas.addEventListener('mousemove', drawingUtils.draw.bind(drawingUtils));
    canvas.addEventListener('mouseup', drawingUtils.stop.bind(drawingUtils));
    canvas.addEventListener('mouseleave', drawingUtils.stop.bind(drawingUtils));
    canvas.addEventListener('touchstart', drawingUtils.start.bind(drawingUtils), { passive: false });
    canvas.addEventListener('touchmove', drawingUtils.draw.bind(drawingUtils), { passive: false });
    canvas.addEventListener('touchend', drawingUtils.stop.bind(drawingUtils));

    // Marcar como inicializado para este tipo de mantenimiento
    firmaState[tipoMantenimiento].initialized = true;

    // Establecer el estado inicial de los botones y mensaje para este tipo de mantenimiento
    clearSignature(tipoMantenimiento); // Llamar a clearSignature pasando el tipo
    console.log(`Canvas de firma para ${tipoMantenimiento} inicializado.`);
}


// --- Funciones para los botones (modificadas para recibir el tipo de mantenimiento) ---
window.startSignature = function(tipoMantenimiento) {
    const state = firmaState[tipoMantenimiento];
    if (!state || !state.canvas || !state.ctx) return;

    state.isEditing = true;
    document.getElementById(`clearButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = false;
    document.getElementById(`saveButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = false;
    document.getElementById(`editButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = true;
    document.getElementById(`startButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = true;
    document.getElementById(`message${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).textContent = 'Dibuje su firma en el recuadro...';
    state.canvas.setAttribute('data-empty', 'true');
};

window.clearSignature = function(tipoMantenimiento) {
    const state = firmaState[tipoMantenimiento];
    if (!state || !state.canvas || !state.ctx) return;

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
    const state = firmaState[tipoMantenimiento];
    if (!state || !state.canvas || !state.ctx) return;

    state.isEditing = false;
    document.getElementById(`editButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = false;
    document.getElementById(`saveButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = true;

    const blank = document.createElement('canvas');
    blank.width = state.canvas.width; blank.height = state.canvas.height;
    if (state.canvas.toDataURL() !== blank.toDataURL()) {
        state.canvas.removeAttribute('data-empty');
        document.getElementById(`message${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).textContent = 'Firma guardada. Presione "Editar" para modificar.';
    } else {
        document.getElementById(`message${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).textContent = 'Firma guardada (vacía). Presione "Editar" para modificar.';
        state.canvas.setAttribute('data-empty', 'true');
    }
};

window.enableEditing = function(tipoMantenimiento) {
    const state = firmaState[tipoMantenimiento];
    if (!state || !state.canvas || !state.ctx) return;

    state.isEditing = true;
    document.getElementById(`editButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = true;
    document.getElementById(`saveButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = false;
    document.getElementById(`clearButton${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).disabled = false;
    document.getElementById(`message${tipoMantenimiento.charAt(0).toUpperCase() + tipoMantenimiento.slice(1)}`).textContent = 'Modo de edición activado. Puede modificar la firma.';
};

// Resto de tu código para generarYSubirPdfADrive...

// Función asíncrona para generar un PDF a partir de un formulario y subirlo a Google Drive
async function generarYSubirPdfADrive(formId) {
    const element = document.getElementById(formId);
    const botonSubir = document.querySelector(`button[onclick*="generarYSubirPdfADrive('${formId}'"]`);
    const statusDiv = document.getElementById('uploadStatus');
    const targetFolderId = document.body.dataset.folderId;

    if (!element) {
        console.error(`Error: Elemento con ID '${formId}' no encontrado.`);
        if (statusDiv) {
            statusDiv.textContent = 'Error: No se pudo encontrar el formulario para generar el PDF.';
            statusDiv.className = 'text-danger';
        }
        return;
    }

    let tipoMantenimiento;
    let nombreCampoEquipoNombre;
    let nombreCampoFecha;

    if (formId === 'formCorrectivo') {
        tipoMantenimiento = 'CORRECTIVO';
        nombreCampoEquipoNombre = 'equipo_nombre_corr';
        nombreCampoFecha = 'fecha_corr';
    } else if (formId === 'formPreventivo') {
        tipoMantenimiento = 'PREVENTIVO';
        nombreCampoEquipoNombre = 'equipo_nombre_prev';
        nombreCampoFecha = 'fecha_prev';
    }

    const equipoNombreInput = element.querySelector(`input[name="${nombreCampoEquipoNombre}"]`);
    const fechaInput = element.querySelector(`input[name="${nombreCampoFecha}"]`);

    if (!equipoNombreInput || !fechaInput) {
        console.error('Error: Faltan campos requeridos en el formulario.');
        if (statusDiv) {
            statusDiv.textContent = 'Error: Faltan campos requeridos en el formulario.';
            statusDiv.className = 'text-danger';
        }
        if (botonSubir) botonSubir.disabled = false;
        return;
    }

    let equipoNombre = equipoNombreInput.value.trim();
    let fechaValor = fechaInput.value;

    if (!equipoNombre || !fechaValor) {
        if (statusDiv) {
            statusDiv.textContent = 'Error: El nombre del equipo y la fecha no pueden estar vacíos.';
            statusDiv.className = 'text-danger';
        }
        if (botonSubir) botonSubir.disabled = false;
        return;
    }

    let equipoNombreLimpio = equipoNombre.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
    if (equipoNombreLimpio.length > 30) equipoNombreLimpio = equipoNombreLimpio.substring(0, 30);
    if (!equipoNombreLimpio) equipoNombreLimpio = 'nombre_invalido';

    const nombreArchivo = `${tipoMantenimiento.toUpperCase()}-${equipoNombreLimpio}-${fechaValor}.pdf`;
    console.log(`Nombre de archivo generado: ${nombreArchivo}`);

    // --- INICIO: MODIFICACIONES PARA OCULTAR Y CAMBIAR ANCHO TEMPORALMENTE ---

    // 9. Ocultar temporalmente elementos que no quieres que aparezcan en el PDF
    const elementsToHide = element.querySelectorAll('.no-print');
    // Almacena el estado original de display para poder restaurarlo de forma segura
    const originalDisplay = {};
    elementsToHide.forEach(el => {
        originalDisplay[el] = el.style.display; // Guarda el estilo original
        el.style.display = 'none'; // Oculta el elemento usando estilo en línea
    });

    // Aplicar temporalmente el ancho del 80% al elemento del formulario
    // Guarda el ancho original del formulario (puede estar definido en línea o ser vacío si no lo está)
    const originalFormWidth = element.style.width;
    // Aplica el ancho del 80% para la generación del PDF
    element.style.width = '80%';
     // Si necesitas ajustar box-sizing, descomenta las siguientes líneas:
     // const originalBoxSizing = element.style.boxSizing;
     // element.style.boxSizing = 'border-box';

    // --- FIN: MODIFICACIONES PARA OCULTAR Y CAMBIAR ANCHO TEMPORALMENTE ---


    // 10. Definir las opciones para la generación del PDF (esta constante NO SE MODIFICA según tu indicación)
    const options = {
        margin: [10, 0, 0, 0],
        filename: nombreArchivo,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, logging: false, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: [300, 520], orientation: 'portrait' }, // <--- SE MANTIENE EXACTAMENTE IGUAL
        pagebreak: { mode: ['css', 'avoid-all'] }
    };

    // 11. Generar el PDF
    try {
        console.log("Generando PDF como Blob...");
        // La librería html2pdf capturará el 'element' con el ancho del 80% aplicado
        const pdfBlob = await html2pdf().from(element).set(options).outputPdf('blob');
        console.log("PDF generado como Blob.");

        // --- INICIO: RESTAURAR ESTILOS DESPUÉS DE GENERAR EL PDF (ÉXITO) ---

        // Restaurar el ancho original del formulario
        element.style.width = originalFormWidth;
        // Si ajustaste box-sizing, restáuralo:
        // element.style.boxSizing = originalBoxSizing;

        // Restaurar la visibilidad original de los elementos que se ocultaron
        elementsToHide.forEach(el => {
            el.style.display = originalDisplay[el];
        });

        // --- FIN: RESTAURAR ESTILOS DESPUÉS DE GENERAR EL PDF (ÉXITO) ---


        // 13. Preparar los datos para enviar al servidor (backend)
        const formData = new FormData();
        formData.append('pdfFile', pdfBlob, nombreArchivo);
        formData.append('fileName', nombreArchivo);

        if (targetFolderId && targetFolderId !== 'None' && targetFolderId !== '') {
            formData.append('folderId', targetFolderId);
            console.log(`Enviando a carpeta ID: ${targetFolderId}`);
        }

        // 14. Enviar el PDF al backend usando Fetch API
        console.log("Enviando PDF al backend (/upload_pdf_to_drive)...");
        const response = await fetch('/upload_pdf_to_drive', {
            method: 'POST',
            body: formData
        });

        // 15. Manejar la respuesta del servidor
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                console.log(`PDF subido exitosamente. ID: ${result.fileId}, Nombre: ${result.fileName}`);
                alert(`¡Éxito! Archivo "${result.fileName}" subido a Google Drive.`);

                // 16. Limpiar y restablecer la interfaz después del éxito
                try {
                    if (element && typeof element.reset === 'function') {
                        console.log(`Limpiando formulario: #${element.id}`);
                        element.reset();
                    }
                    const formCorrectivo = document.getElementById('formCorrectivo');
                    const formPreventivo = document.getElementById('formPreventivo');
                    const tipoMantenimientoSelect = document.getElementById('tipoMantenimiento');
                    if (formCorrectivo) formCorrectivo.style.display = 'none';
                    if (formPreventivo) formPreventivo.style.display = 'none';
                    if (tipoMantenimientoSelect) tipoMantenimientoSelect.selectedIndex = 0;
                    console.log("Vista restablecida al menú de selección.");
                } catch (resetError) {
                    console.error("Error al restablecer la vista:", resetError);
                    alert("Archivo subido, pero ocurrió un error al restablecer el formulario. Selecciona manualmente el tipo de mantenimiento.");
                }
            } else {
                console.error('Error reportado por el backend:', result.error);
                if (statusDiv) {
                    statusDiv.textContent = `Error del servidor al subir: ${result.error || 'Error desconocido'}`;
                    statusDiv.className = 'text-danger';
                }
            }
        } else {
            console.error(`Error HTTP ${response.status}: ${response.statusText}`);
            let errorText = response.statusText;
            try {
                const errorBody = await response.json();
                if (errorBody && errorBody.error) errorText = errorBody.error;
            } catch (e) { /* Ignorar si no es JSON */ }
            if (statusDiv) {
                statusDiv.textContent = `Error ${response.status} al contactar el servidor: ${errorText}`;
                statusDiv.className = 'text-danger';
            }
            if (response.status === 401) {
                alert("Tu sesión ha expirado. Serás redirigido para autenticarte de nuevo.");
                window.location.href = '/authorize';
            }
        }
    } catch (err) {
        console.error(`Error inesperado en generarYSubirPdfADrive:`, err);
        if (statusDiv) {
            statusDiv.textContent = 'Error inesperado durante la generación o envío del PDF.';
            statusDiv.className = 'text-danger';
        }

        // --- INICIO: RESTAURAR ESTILOS DESPUÉS DE UN ERROR ---

        // Restaurar ancho original en caso de error
        element.style.width = originalFormWidth;
         // Si ajustaste box-sizing, restáuralo:
         // element.style.boxSizing = originalBoxSizing;

        // Restaurar visibilidad de elementos ocultos en caso de error
         elementsToHide.forEach(el => {
            el.style.display = originalDisplay[el];
        });

        // --- FIN: RESTAURAR ESTILOS DESPUÉS DE UN ERROR ---

    } finally {
        // 17. Código que se ejecuta siempre al final (haya éxito o error)
        if (botonSubir) botonSubir.disabled = false; // Re-habilita el botón
        console.log("Proceso de generación y subida finalizado.");
    }
}