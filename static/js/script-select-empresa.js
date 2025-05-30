// static/js/script-select-empresa.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG (script-select-empresa.js): Script cargado y DOM listo.");

    const saludoElement = document.getElementById('saludo');
    if (saludoElement) {
        console.log("DEBUG (script-select-empresa.js): Elemento de saludo encontrado.");
    } else {
        console.warn("DEBUG (script-select-empresa.js): Elemento con ID 'saludo' no encontrado.");
    }

    // Lógica para el botón MV
    const mvBtn = document.getElementById('mvBtn');
    if (mvBtn) {
        console.log("DEBUG (script-select-empresa.js): Botón MV encontrado.");
        mvBtn.addEventListener('click', () => {
            console.log("DEBUG (script-select-empresa.js): Botón MV clickeado.");
            // Usa la nueva ruta específica para MV
            if (typeof RUTA_SELECT_ENTIDAD_MV !== 'undefined' && RUTA_SELECT_ENTIDAD_MV) {
                console.log(`DEBUG (script-select-empresa.js): Redirigiendo a ${RUTA_SELECT_ENTIDAD_MV}`);
                window.location.href = RUTA_SELECT_ENTIDAD_MV;
            } else {
                console.error("ERROR: RUTA_SELECT_ENTIDAD_MV no está definida o está vacía.");
                alert("Error de configuración para MV. Contacte al administrador.");
            }
        });
    } else {
        console.error("DEBUG (script-select-empresa.js): Botón MV (id='mvBtn') no encontrado.");
    }

    // Lógica para el botón SYMBIOSAS
    const simbiosasBtn = document.getElementById('simbiosasBtn');
    if (simbiosasBtn) {
        console.log("DEBUG (script-select-empresa.js): Botón SYMBIOSAS encontrado.");
        simbiosasBtn.addEventListener('click', () => {
            console.log("DEBUG (script-select-empresa.js): Botón SYMBIOSAS clickeado.");

            // Usa la ruta específica para Symbiosas
            if (typeof RUTA_SELECT_ENTIDAD_SYMBIOSAS !== 'undefined' && RUTA_SELECT_ENTIDAD_SYMBIOSAS) {
                console.log(`DEBUG (script-select-empresa.js): Redirigiendo (específico Symbiosas) a ${RUTA_SELECT_ENTIDAD_SYMBIOSAS}`);
                window.location.href = RUTA_SELECT_ENTIDAD_SYMBIOSAS;
            } else {
                console.error("ERROR: RUTA_SELECT_ENTIDAD_SYMBIOSAS no está definida o está vacía.");
                alert("Error de configuración para Symbiosas. Contacte al administrador.");
            }
        });
    } else {
        // MUY IMPORTANTE: Asegúrate de que este ID exista en tu HTML como se te indicó en la respuesta anterior.
        console.error("DEBUG (script-select-empresa.js): Botón SYMBIOSAS (id='simbiosasBtn') no encontrado.");
    }

    // Lógica para el botón Cerrar Sesión
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        console.log("DEBUG (script-select-empresa.js): Botón de logout encontrado.");
        logoutBtn.addEventListener('click', () => {
            console.log("DEBUG (script-select-empresa.js): Botón de logout clickeado.");
            if (typeof RUTA_LOGOUT === 'undefined' || !RUTA_LOGOUT) {
                console.error("ERROR: La variable RUTA_LOGOUT no está definida o está vacía. Asegúrate de pasarla desde la plantilla HTML.");
                window.location.href = '/logout';
                return;
            }
            console.log(`DEBUG (script-select-empresa.js): Redirigiendo a ${RUTA_LOGOUT}...`);
            window.location.href = RUTA_LOGOUT;
        });
    } else {
        console.error("DEBUG (script-select-empresa.js): Elemento 'logoutBtn' no encontrado.");
    }

    // Lógica para evitar regresar a la página anterior (login) con el botón "Atrás"
    if (window.history && window.history.pushState) {
        console.log("DEBUG (script-select-empresa.js): Manipulando historial para evitar 'Atrás' al login.");
        window.history.pushState(null, document.title, window.location.href);
        window.addEventListener("popstate", function () {
            console.log("DEBUG (script-select-empresa.js): Evento popstate detectado. Re-añadiendo URL actual al historial.");
            window.history.pushState(null, document.title, window.location.href);
        });
    } else {
        console.warn("DEBUG (script-select-empresa.js): API History pushState no soportada por este navegador.");
    }

    console.log("DEBUG (script-select-empresa.js): Listeners y manipulaciones de historial configurados (si aplica).");
});