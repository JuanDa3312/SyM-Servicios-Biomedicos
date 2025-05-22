// static/js/script-select-empresa.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG (script-select-empresa.js): Script cargado y DOM listo.");

    // Lógica para el saludo (sin cambios, ya estaba bien)
    const saludoElement = document.getElementById('saludo');
    if (saludoElement) {
        console.log("DEBUG (script-select-empresa.js): Elemento de saludo encontrado.");
        // El texto del saludo se asume que es establecido por Jinja2 en el HTML.
    } else {
        console.warn("DEBUG (script-select-empresa.js): Elemento con ID 'saludo' no encontrado.");
    }

    // Función genérica para manejar la selección de empresa
    function manejarSeleccionEmpresa(empresaKey) {
        if (typeof RUTA_SELECT_ENTIDAD === 'undefined') {
            console.error("ERROR: La variable RUTA_SELECT_ENTIDAD no está definida. Asegúrate de pasarla desde la plantilla HTML.");
            // Fallback a una ruta hardcodeada (no recomendado para producción)
            window.location.href = '/select-entidad?empresa=' + encodeURIComponent(empresaKey);
            return;
        }
        const urlDestino = RUTA_SELECT_ENTIDAD + '?empresa=' + encodeURIComponent(empresaKey);
        console.log(`DEBUG (script-select-empresa.js): Redirigiendo a ${urlDestino}`);
        window.location.href = urlDestino;
    }

    // Lógica para el botón MV
    const mvBtn = document.getElementById('mvBtn');
    if (mvBtn) {
        console.log("DEBUG (script-select-empresa.js): Botón MV encontrado.");
        mvBtn.addEventListener('click', (e) => {
            // e.preventDefault(); // No es estrictamente necesario para un <button type="button"> que solo redirige
            console.log("DEBUG (script-select-empresa.js): Botón MV clickeado.");
            manejarSeleccionEmpresa('MV'); // 'MV' debe coincidir con la clave en ROOT_FOLDER_IDS
        });
    } else {
        console.error("DEBUG (script-select-empresa.js): Botón MV (id='mvBtn') no encontrado.");
    }

    // Lógica para el botón SYMBIOSAS
    const simbiosasBtn = document.getElementById('simbiosasBtn'); // Asumiendo id="simbiosasBtn"
    if (simbiosasBtn) {
        console.log("DEBUG (script-select-empresa.js): Botón SYMBIOSAS encontrado.");
        simbiosasBtn.addEventListener('click', (e) => {
            // e.preventDefault();
            console.log("DEBUG (script-select-empresa.js): Botón SYMBIOSAS clickeado.");
            manejarSeleccionEmpresa('Simbiosas'); // 'Simbiosas' debe coincidir con la clave en ROOT_FOLDER_IDS
                                                 // Ajusta si tu clave es 'SYMBIOSAS' (todo mayúsculas)
        });
    } else {
        console.error("DEBUG (script-select-empresa.js): Botón SYMBIOSAS (id='simbiosasBtn') no encontrado.");
    }

    // Lógica para el botón Cerrar Sesión
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        console.log("DEBUG (script-select-empresa.js): Botón de logout encontrado.");
        logoutBtn.addEventListener('click', (e) => {
            // e.preventDefault();
            console.log("DEBUG (script-select-empresa.js): Botón de logout clickeado.");
            if (typeof RUTA_LOGOUT === 'undefined') {
                console.error("ERROR: La variable RUTA_LOGOUT no está definida. Asegúrate de pasarla desde la plantilla HTML.");
                window.location.href = '/logout'; // Fallback
                return;
            }
            console.log(`DEBUG (script-select-empresa.js): Redirigiendo a ${RUTA_LOGOUT}...`);
            window.location.href = RUTA_LOGOUT;
        });
    } else {
        console.error("DEBUG (script-select-empresa.js): Elemento 'logoutBtn' no encontrado.");
    }

    // Lógica para evitar regresar a la página anterior (login) con el botón "Atrás"
    // (Sin cambios, ya estaba funcional para su propósito)
    if (window.history && window.history.pushState) { // Verificar si pushState está disponible
        console.log("DEBUG (script-select-empresa.js): Manipulando historial para evitar 'Atrás' al login.");
        window.history.pushState(null, document.title, window.location.href); // Añade el estado actual
        window.addEventListener("popstate", function (event) {
            // Cuando el usuario intenta navegar hacia atrás, lo "atrapamos" y lo volvemos a empujar al estado actual.
            console.log("DEBUG (script-select-empresa.js): Evento popstate detectado. Re-añadiendo URL actual al historial.");
            window.history.pushState(null, document.title, window.location.href);
        });
    } else {
        console.warn("DEBUG (script-select-empresa.js): API History pushState no soportada por este navegador.");
    }

    console.log("DEBUG (script-select-empresa.js): Listeners y manipulaciones de historial configurados (si aplica).");
});