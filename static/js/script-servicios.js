document.addEventListener('DOMContentLoaded', () => {
    // === Código para el Botón Flotante y Menú Desplegable ===

    // Obtener referencias a los elementos del botón y el menú
    const menuPrincipal = document.getElementById('menuOpciones');
    const toggleMenuPrincipalButton = document.querySelector('.btn-add-inside');

    // Verificar que ambos elementos existan en la página
    if (toggleMenuPrincipalButton && menuPrincipal) {

        // --- Listener para el clic en el botón flotante ---
        // Este código reemplaza el onclick="toggleMenu()" en el HTML.
        // Es una práctica más moderna y limpia usar addEventListener.
        toggleMenuPrincipalButton.addEventListener('click', (event) => {
            // Detener la propagación del evento para que el clic en el botón no llegue al listener del documento
            event.stopPropagation(); 

            // Cierra otros menús contextuales de carpeta/archivo si están abiertos (si los hay en esta página)
            // Esto es útil si compartes estilos y JS entre páginas
            document.querySelectorAll('.folder-options-menu, .file-options-menu').forEach(menu => {
                menu.style.display = 'none';
            });

            // Alternar la visibilidad del menú principal añadiendo/quitando una clase
            menuPrincipal.classList.toggle('menu-visible'); 
        });

        // --- Listener para clics en el documento ---
        // Cierra el menú si el clic ocurrió fuera del menú mismo y fuera del botón
        document.addEventListener('click', (event) => {
            // Verificar si el clic no fue dentro del menú AND no fue en el botón toggle
            if (!menuPrincipal.contains(event.target) && !toggleMenuPrincipalButton.contains(event.target)) {
                // Si el menú está visible, lo oculta
                if (menuPrincipal.classList.contains('menu-visible')) {
                    menuPrincipal.classList.remove('menu-visible');
                }
            }
        });

        // --- Opcional: Cerrar menú al hacer clic en una opción ---
        // Si quieres que el menú se cierre automáticamente después de hacer clic en uno de sus enlaces
        menuPrincipal.querySelectorAll('.menu-opcion').forEach(opcion => {
            // Asegurarse de no interferir si una opción tiene un comportamiento JS específico (como triggerFileUpload)
            // Aunque en tu snippet de servicios, las opciones son solo enlaces.
            if (opcion.id !== 'triggerFileUpload') { 
                 opcion.addEventListener('click', () => {
                     // Retrasa el cierre un poco para que la navegación (si target="_blank") o otra acción tenga tiempo
                    setTimeout(() => menuPrincipal.classList.remove('menu-visible'), 50); 
                });
            }
        });


    } else {
        console.warn("Advertencia: Elementos del menú principal flotante (+ o menú) no encontrados en el DOM. El script de menú no se configuró.");
    }

    // === Fin: Código para el Botón Flotante y Menú Desplegable ===

    // --- Aquí iría el resto del JavaScript específico de la página de servicios si lo tienes ---
    // Por ejemplo, si esta página lista servicios con cards y quieres que sean clickeables:
    /*
    const serviceCards = document.querySelectorAll('.folder-card'); // Si los servicios se listan con esta clase
    serviceCards.forEach(card => {
        card.addEventListener('click', () => {
            // Lógica para navegar a la carpeta de servicio /carpeta/ID_DEL_SERVICIO
            const serviceId = card.dataset.folderId; // Si guardas el ID en data-folder-id
            if (serviceId) {
                 window.location.href = `/carpeta/${serviceId}`;
            }
        });
    });
    */

    // --- Si tienes funciones globales (como showToast), puedes definirlas aquí o fuera del DOMContentLoaded ---
    // function showToast(...) { ... } 

}); // Fin de DOMContentLoaded


// --- Nota: Si usas este script.js también en la página /carpeta, ten cuidado con selectores duplicados o lógica que solo debe correr en una página. Podrías necesitar checks como:
// if (document.body.classList.contains('services-page')) { ... codigo de servicios ... }
// if (document.body.classList.contains('folder-page')) { ... codigo de carpeta ... }
// o usar archivos JS separados.