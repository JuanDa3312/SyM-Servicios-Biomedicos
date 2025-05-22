// static/js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const mensajeError = document.getElementById('error-message');

    if (loginForm && mensajeError) {
        console.log("DEBUG (login.js): Login form y error message encontrados.");

        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault(); // Evitar el envío tradicional del formulario

            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');

            if (!usernameInput || !passwordInput) {
                console.error("DEBUG (login.js): Inputs de username o password no encontrados.");
                mensajeError.textContent = "Error interno: elementos del formulario faltantes.";
                mensajeError.style.color = "red";
                return;
            }

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (!username || !password) {
                mensajeError.textContent = "Por favor, ingrese usuario y contraseña.";
                mensajeError.style.color = "red";
                console.log("DEBUG (login.js): Campos de usuario/contraseña vacíos.");
                return;
            }

            try {
                mensajeError.textContent = "Verificando credenciales...";
                mensajeError.style.color = "gray";
                console.log(`DEBUG (login.js): Enviando credenciales para usuario: '${username}'...`);

                const response = await fetch('/login_backend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const result = await response.json();
                console.log("DEBUG (login.js): Respuesta del backend recibida:", result);

                if (response.ok && result.success) {
                    mensajeError.style.color = "green";
                    mensajeError.textContent = result.message || "Inicio de sesión exitoso.";
                    console.log("DEBUG (login.js): Inicio de sesión reportado como exitoso por el backend.");

                    if (result.redirect_url) {
                        console.log(`DEBUG (login.js): Redireccionando (reemplazando historial) a: ${result.redirect_url}`);
                        // *** CAMBIO AQUÍ ***
                        // Usamos replace para que la página de login no quede en el historial
                        window.location.replace(result.redirect_url);
                    } else {
                        console.warn("DEBUG (login.js): Inicio de sesión exitoso, pero sin redirect_url.");
                        mensajeError.textContent = "Inicio de sesión exitoso, pero sin redirección. Contacte al administrador.";
                    }
                } else {
                    console.log(`DEBUG (login.js): Login reportado como fallido. Error: ${result.error}`);
                    mensajeError.style.color = "red";
                    mensajeError.textContent = result.error || "Error desconocido al iniciar sesión.";
                }

            } catch (error) {
                console.error("DEBUG (login.js): Error en la petición fetch:", error);
                mensajeError.style.color = "red";
                mensajeError.textContent = "Error de conexión con el servidor. Intente de nuevo más tarde.";
            }
        });
    } else {
        console.error("DEBUG (login.js): Elementos del DOM 'loginForm' o 'error-message' no encontrados al cargar.");
    }
});