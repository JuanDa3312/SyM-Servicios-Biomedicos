
import os
import json
from io import BytesIO

# Third-party Libraries
from flask import (
    Flask, redirect, request, session, url_for, render_template,
    make_response, g, abort, jsonify
)
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from googleapiclient.errors import HttpError
import google.auth.transport.requests
from cryptography.fernet import Fernet
from werkzeug.middleware.proxy_fix import ProxyFix
# -----------------------------------------------------------------------------
# Configuración de la Aplicación Flask
# -----------------------------------------------------------------------------

app = Flask(__name__)

# Clave secreta para la sesión de Flask.
# ¡IMPORTANTE! En producción, establecer una FLASK_SECRET_KEY segura como variable de entorno.
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(24))

# Clave para encriptar/desencriptar las credenciales en la cookie.
# ¡IMPORTANTE! En producción, establecer una FERNET_KEY segura como variable de entorno.
# NO usar Fernet.generate_key() directamente aquí en producción. Guárdala de forma segura.
# Se decodifica si se obtiene de la variable de entorno (que sería string) y luego se codifica a bytes.
try:
    fernet_key_env = os.environ.get("FERNET_KEY")
    if fernet_key_env:
        fernet_key_bytes = fernet_key_env.encode()
    else:
        # Generar solo si no está en el entorno (para desarrollo)
        print("ADVERTENCIA: Generando una FERNET_KEY temporal. Configurar FERNET_KEY en el entorno para producción.")
        fernet_key_bytes = Fernet.generate_key()
    fernet = Fernet(fernet_key_bytes)
except Exception as e:
    print(f"ERROR CRÍTICO: No se pudo inicializar Fernet. Verifica FERNET_KEY: {e}")
    # Considerar salir de la aplicación si Fernet no se puede inicializar.
    # exit(1) # Descomentar si es crítico

# -----------------------------------------------------------------------------
# Constantes y Rutas de Archivos
# -----------------------------------------------------------------------------
app.wsgi_app = ProxyFix(
    app.wsgi_app, x_for=1, x_host=1, x_proto=1, x_prefix=1
)

CREDENTIALS_COOKIE = 'google_drive_credentials' # Nombre de la cookie para credenciales de Drive
CLIENT_SECRETS_FILE = "credenciales.json"      # Archivo de secretos del cliente OAuth 2.0 de Google
SCOPES = ['https://www.googleapis.com/auth/drive'] # Alcance de permisos para Google Drive
EQUIPOS_JSON_PATH = 'static/data/equipos.json'     # Ruta al archivo JSON que almacena datos de equipos

# IDs de las carpetas raíz en Google Drive, estructurados por empresa y luego entidad.
# Ejemplo: ROOT_FOLDER_IDS['MV']['sagrado_corazon']
ROOT_FOLDER_IDS = {
    'MV': { # Nombre de la empresa o agrupación
        'sagrado_corazon': '1gW5zdALTdelgMIrd9T85ZY9D1raMClLI', # Entidad: ID de la carpeta
        'palmitos': '1oMWAdDcpZfPN-Y4Q2M8-0u9_3INOOR28',
        'vascular': '1APlTY38p411zlUrUIQGpicJYtqwaOhET',

       
    },
    'Simbiosas': { # Otra empresa o agrupación
        'EntidadA': 'ID_CARPETA_ENTIDADA', # Reemplazar con IDs reales
        'EntidadB': 'ID_CARPETA_ENTIDADB', # Reemplazar con IDs reales
    }
}

# Mapeo directo de 'entidad' (usado en la URL) al ID de su carpeta en Google Drive.
# Este diccionario podría derivarse de ROOT_FOLDER_IDS si la lógica lo permite,
# o mantenerse separado si las 'entidades' de la URL no coinciden directamente con la estructura de ROOT_FOLDER_IDS.
ENTIDADES_FOLDER_IDS = {
    'sagrado_corazon': ROOT_FOLDER_IDS['MV']['sagrado_corazon'],
    'palmitos': ROOT_FOLDER_IDS['MV']['palmitos'],
    'vascular': ROOT_FOLDER_IDS['MV']['vascular'],
    # Añadir más entidades según sea necesario, por ejemplo:
    # 'EntidadA': ROOT_FOLDER_IDS['Simbiosas']['EntidadA'],
}

# Credenciales de usuarios para el login interno de la aplicación.
# En un entorno de producción, esto debería manejarse de forma más segura (ej. base de datos con hashes).
# Credenciales de usuarios para el login interno de la aplicación.
# En un entorno de producción, esto debería manejarse de forma más segura (ej. base de datos con hashes).
USUARIOS_SEGUROS = {
    "Juan Antonio": "Juan10021",
    "Marlon": "Marlon10021",
    "Erika": "Erika53075",
    
    
}

# Nombres completos asociados a los usuarios.
NOMBRES_COMPLETOS = {
    "Juan Antonio": "Juan Antonio Ely Ramirez",
    "Marlon": "Marlon Rojano Parra",
    "Erika": "Erika Puello Bernal",
    "admin": "Administrador del Sistema"
}

# -----------------------------------------------------------------------------
# Funciones de Utilidad para Google Drive y Credenciales
# -----------------------------------------------------------------------------

def is_token_valid(creds):
    """
    Verifica si las credenciales son válidas y pueden ser usadas o refrescadas.
    Retorna:
        bool: True si las credenciales son válidas, False en caso contrario.
    """
    return creds and creds.valid

def credentials_to_dict(creds):
    """
    Convierte un objeto Credentials de Google a un diccionario serializable.
    Args:
        creds (google.oauth2.credentials.Credentials): Objeto de credenciales.
    Returns:
        dict or None: Diccionario con los datos de las credenciales, o None si creds es None.
    """
    if not creds:
        return None
    return {
        'token': creds.token,
        'refresh_token': creds.refresh_token, # Esencial para obtener nuevos access tokens.
        'token_uri': creds.token_uri,         # Necesario para el proceso de refresh.
        'client_id': creds.client_id,         # Necesario para el proceso de refresh.
        'client_secret': creds.client_secret, # Necesario para el proceso de refresh.
        'scopes': creds.scopes
    }

def save_credentials_to_cookie(response, creds_dict):
    """
    Encripta y guarda un diccionario de credenciales en una cookie HTTPOnly y segura.
    Args:
        response (flask.Response): Objeto de respuesta de Flask al cual añadir la cookie.
        creds_dict (dict): Diccionario de credenciales a guardar.
    """
    if creds_dict is None:
        print("ADVERTENCIA: Se intentó guardar credenciales None en la cookie.")
        return

    # Asegurar que todos los valores necesarios no sean None antes de guardar.
    # El refresh_token puede ser None después del primer flujo si no se solicitó 'offline'
    # o si ya se ha usado una vez sin persistirlo correctamente.
    required_keys = ['token', 'token_uri', 'client_id', 'client_secret', 'scopes']
    if not all(k in creds_dict and creds_dict[k] is not None for k in required_keys):
        # Permitir refresh_token como None, ya que a veces Google no lo devuelve si ya se otorgó
        # y el usuario no revocó permisos.
        print(f"ADVERTENCIA: Faltan campos esenciales o son None en creds_dict antes de guardar en cookie: {creds_dict}")
        # Podrías decidir no guardar si faltan campos críticos.
        # return # Descomenta si quieres evitar guardar credenciales incompletas.

    try:
        encrypted_credentials = fernet.encrypt(json.dumps(creds_dict).encode()).decode()
        # secure=True en producción (cuando no app.debug y HTTPS está habilitado).
        secure_cookie = not app.debug
        response.set_cookie(
            CREDENTIALS_COOKIE,
            encrypted_credentials,
            httponly=True,      # Previene acceso desde JavaScript en el cliente.
            secure=secure_cookie, # Solo enviar sobre HTTPS si secure_cookie es True.
            samesite='Lax'      # Protección CSRF. 'Strict' puede ser demasiado restrictivo.
        )
        # print("DEBUG: Credenciales guardadas en cookie.") # Descomentar para depuración detallada.
    except Exception as e:
        print(f"ERROR al encriptar o guardar credenciales en cookie: {e}")

def load_credentials_from_cookie():
    """
    Carga, desencripta y reconstruye el objeto Credentials desde la cookie.
    Returns:
        google.oauth2.credentials.Credentials or None: Objeto de credenciales si existe y es válido,
                                                       None en caso contrario.
    """
    encrypted_credentials = request.cookies.get(CREDENTIALS_COOKIE)
    if not encrypted_credentials:
        return None

    try:
        decrypted_bytes = fernet.decrypt(encrypted_credentials.encode())
        decrypted_json = decrypted_bytes.decode()
        creds_data = json.loads(decrypted_json)

        # ----- DEBUG PRINT -----
        print("="*30)
        print("DEBUG: Credenciales cargadas DESDE cookie (desencriptadas):")
        print(f"  Token: {'Presente' if creds_data.get('token') else 'AUSENTE'}")
        print(f"  Refresh Token: {creds_data.get('refresh_token')}") # Crucial para la persistencia.
        print(f"  Client ID: {creds_data.get('client_id')}")
        print(f"  Client Secret: {'Presente' if creds_data.get('client_secret') else 'AUSENTE'}")
        print(f"  Token URI: {creds_data.get('token_uri')}")
        print("="*30)
        # ----- FIN DEBUG PRINT -----

        # Verificar que los campos necesarios para Credentials no sean None/faltantes.
        # El refresh_token es opcional para la creación inicial del objeto, pero esencial para el refresh.
        required_keys_for_creation = ['token', 'token_uri', 'client_id', 'client_secret', 'scopes']
        if not all(k in creds_data and (creds_data[k] is not None or k == 'refresh_token') for k in required_keys_for_creation):
            print("ERROR: Faltan campos esenciales o son None en los datos desencriptados de la cookie.")
            # Si faltan campos cruciales (excepto refresh_token que puede ser None a veces),
            # no se puede crear un objeto Credentials válido.
            return None

        return Credentials(**creds_data)

    except Exception as e:
        print(f"Error al desencriptar/cargar credenciales desde cookie: {e}. La cookie podría ser inválida o la FERNET_KEY incorrecta.")
        return None

def get_drive_service():
    """
    Obtiene el servicio de Google Drive autenticado.
    Intenta cargar credenciales desde la cookie. Si están expiradas y hay un refresh_token,
    la librería `google-auth` intentará refrescarlas automáticamente al construir el servicio.
    Guarda el servicio y las credenciales (potencialmente refrescadas) en el contexto `g` de Flask.

    Returns:
        googleapiclient.discovery.Resource or None: Objeto de servicio de Drive si la autenticación
                                                    es exitosa, None en caso contrario.
    """
    # Reutilizar servicio del contexto `g` si ya existe para esta petición.
    if 'drive_service' in g and g.drive_service:
        return g.drive_service

    creds = load_credentials_from_cookie()

    if not creds:
        print("DEBUG (get_drive_service): No se encontraron credenciales válidas en la cookie.")
        return None

    # La librería google-auth (usada por googleapiclient) debería manejar el refresh
    # automáticamente si `creds.valid` es False y `creds.refresh_token` está presente.
    if not creds.valid:
        print(f"DEBUG (get_drive_service): Credenciales marcadas como NO válidas (token expirado?). Refresh Token presente: {bool(creds.refresh_token)}")
        if not creds.refresh_token:
            print("ERROR (get_drive_service): Credenciales no válidas y SIN refresh token. No se puede refrescar.")
            return None # No se puede refrescar, se necesita re-autenticación completa.

    try:
        # Construir el servicio. La librería intentará el refresh si es necesario.
        service = build('drive', 'v3', credentials=creds)

        # El objeto `creds` original podría no actualizarse automáticamente después de un refresh.
        # Es más seguro obtener las credenciales del objeto transportador del servicio,
        # ya que este SÍ se actualiza tras un refresh automático.
        refreshed_creds = getattr(getattr(service, '_http', None), 'credentials', creds)

        g.drive_service = service          # Guardar servicio en el contexto de la petición.
        g.drive_credentials = refreshed_creds # Guardar credenciales (potencialmente refrescadas).

        print("DEBUG (get_drive_service): Servicio Drive construido exitosamente.")
        if creds.token != refreshed_creds.token:
             print("DEBUG (get_drive_service): El token de acceso fue refrescado.")
        return service

    except google.auth.exceptions.RefreshError as re:
        # Capturar específicamente el RefreshError.
        print(f"ERROR CRÍTICO (get_drive_service): Falló el REFRESH del token: {re}")
        print("Esto usualmente significa que el refresh_token es inválido/expirado, o faltan client_id/secret/token_uri, o el usuario revocó permisos.")
        return None # Falló el refresh, no hay servicio válido. Requiere re-autenticación.
    except Exception as e:
        print(f"ERROR construyendo el servicio de Drive: {e}")
        return None

def listar_archivos(service, folder_id, mime_type_cond):
    """
    Obtiene una lista de archivos/carpetas de una carpeta específica en Google Drive,
    ordenados alfabéticamente por nombre.

    Args:
        service (googleapiclient.discovery.Resource): Servicio de Drive autenticado.
        folder_id (str): ID de la carpeta de Google Drive a listar.
        mime_type_cond (str): Condición de tipo MIME para el query (ej. "mimeType = 'application/vnd.google-apps.folder'").

    Returns:
        list: Lista de diccionarios representando los archivos/carpetas, o lista vacía en caso de error.
    """
    query = f"'{folder_id}' in parents and {mime_type_cond} and trashed = false"
    files_list = []
    try:
        results = service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name, thumbnailLink, mimeType)', # Campos a recuperar.
            orderBy='name' # Pedir a la API que ordene por nombre.
        ).execute()
        files_list = results.get('files', [])

        # La API ya debería devolverlos ordenados con orderBy='name'.
        # Si se necesita ordenamiento personalizado o case-insensitive explícito:
        # files_sorted = sorted(files_list, key=lambda item: item.get('name', '').lower())
        # return files_sorted

        return files_list

    except HttpError as e:
        # Manejar errores específicos de la API, como permisos o carpeta no encontrada.
        if e.resp.status == 401: # Unauthorized (token inválido o expirado)
             print(f"ERROR 401 (listar_archivos): Token inválido o expirado al listar contenido de carpeta {folder_id}. Se requiere re-autenticación.")
             # Aquí se podría invalidar la sesión de Drive y redirigir a /authorize.
        elif e.resp.status == 403: # Forbidden (permisos insuficientes)
             print(f"ERROR 403 (listar_archivos): Permisos insuficientes para acceder a carpeta {folder_id}.")
        elif e.resp.status == 404: # Not Found
             print(f"ERROR 404 (listar_archivos): Carpeta {folder_id} no encontrada.")
        else:
            print(f"Error HttpError al listar archivos/carpetas (ID: {folder_id}): {e}")
        return [] # Devolver lista vacía en caso de error.
    except Exception as e:
        print(f"Error inesperado al listar archivos/carpetas (ID: {folder_id}): {e}")
        return []


def update_credentials_cookie_if_refreshed(response):
    """
    Si las credenciales de Drive en `g` fueron refrescadas durante la petición,
    actualiza la cookie con las nuevas credenciales.
    Esta función es útil para llamarla antes de enviar la respuesta al cliente.

    Args:
        response (flask.Response): El objeto de respuesta de Flask.
    """
    original_creds_from_cookie = getattr(g, '_original_creds_token_on_load', None)
    current_creds_in_g = g.get('drive_credentials')

    if current_creds_in_g:
        # Si el token actual en g es diferente al que se cargó de la cookie (si se guardó),
        # o si no había uno original (primera carga o no se guardó), actualiza.
        # Una forma más simple es simplemente actualizar siempre si hay credenciales en g,
        # asumiendo que g.drive_credentials siempre tiene el estado más reciente.
        # Lo importante es que g.drive_credentials se actualice si get_drive_service refresca.
        if original_creds_from_cookie != current_creds_in_g.token : # Comparación simplificada
            print("DEBUG: Detectado cambio en credenciales (posible refresh). Actualizando cookie.")
            creds_dict = credentials_to_dict(current_creds_in_g)
            save_credentials_to_cookie(response, creds_dict)
        # else:
        #     print("DEBUG: Credenciales en g no parecen haber cambiado, no se actualiza cookie.")
    else:
        print("ADVERTENCIA (update_credentials_cookie_if_refreshed): No hay 'drive_credentials' en g para actualizar la cookie.")

# -----------------------------------------------------------------------------
# Hooks de Aplicación Flask (Antes y Después de Peticiones)
# -----------------------------------------------------------------------------

@app.before_request
def load_user_and_credentials():
    """
    Antes de cada petición:
    - Carga las credenciales de Google Drive desde la cookie y las almacena en `g`.
    - Esto permite que `get_drive_service` pueda reutilizar las credenciales cargadas
      y también ayuda a `update_credentials_cookie_if_refreshed` a detectar cambios.
    """
    creds = load_credentials_from_cookie()
    if creds:
        g.drive_credentials = creds
        g._original_creds_token_on_load = creds.token # Guardar el token original para comparación


@app.after_request
def after_request_func(response):
    """
    Después de cada petición:
    - Intenta actualizar la cookie de credenciales si estas fueron refrescadas.
    """
    # Solo intentar actualizar si la respuesta no es un stream (ej. send_file)
    # y si hay credenciales en g.
    if hasattr(response, 'set_cookie') and g.get('drive_credentials'):
        update_credentials_cookie_if_refreshed(response)
    return response

# -----------------------------------------------------------------------------
# Funciones de Carga de Datos Locales (JSON)
# -----------------------------------------------------------------------------

def load_equipos_json(json_path=EQUIPOS_JSON_PATH):
    """
    Carga los datos de equipos desde el archivo JSON especificado.
    Maneja la creación del directorio y archivo si no existen.

    Args:
        json_path (str, optional): Ruta al archivo JSON.
                                   Defaults to EQUIPOS_JSON_PATH.
    Returns:
        dict: Diccionario con los datos de los equipos. Vacío si hay error o el archivo no existe/es inválido.
    """
    # Asegurar que el directorio existe.
    json_dir = os.path.dirname(json_path)
    if not os.path.exists(json_dir):
        try:
            os.makedirs(json_dir)
            print(f"INFO: Directorio creado: {json_dir}")
        except OSError as e:
            print(f"ERROR: No se pudo crear el directorio {json_dir}: {e}")
            return {} # No se puede proceder si el directorio no se puede crear.

    # Asegurar que el archivo JSON existe, crearlo vacío si no.
    if not os.path.exists(json_path):
        print(f"ADVERTENCIA: Archivo JSON no encontrado en {json_path}. Creando uno vacío.")
        try:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump({}, f) # Escribir un objeto JSON vacío.
            return {} # Devolver vacío ya que se acaba de crear.
        except IOError as e:
            print(f"ERROR: No se pudo crear el archivo JSON vacío en {json_path}: {e}")
            return {}

    # Intentar cargar el archivo JSON.
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            if not content:
                print(f"ADVERTENCIA: Archivo JSON vacío en {json_path}. Devolviendo diccionario vacío.")
                return {}
            datos = json.loads(content)
            if not isinstance(datos, dict):
                print(f"ADVERTENCIA: El archivo JSON {json_path} no contiene un objeto JSON raíz (diccionario). Devolviendo diccionario vacío.")
                return {}
            return datos
    except json.JSONDecodeError as e:
        print(f"ERROR al parsear {json_path}: {e}. El archivo podría estar corrupto. Devolviendo diccionario vacío.")
        return {}
    except IOError as e:
        print(f"ERROR al leer {json_path}: {e}. Devolviendo diccionario vacío.")
        return {}
    except Exception as e:
        print(f"Error inesperado al cargar {json_path}: {e}")
        return {}

# -----------------------------------------------------------------------------
# Rutas de Autenticación y Sesión de Usuario (Login Interno)
# -----------------------------------------------------------------------------

@app.route('/')
def raiz():
    """
    Ruta raíz. Redirige a la página de inicio de sesión.
    """
    print("DEBUG (ruta /): Redirigiendo a /login.")
    return redirect(url_for('inicio_sesion_pagina')) # Cambiado para más claridad

@app.route('/login', methods=['GET'])
def inicio_sesion_pagina():
    """
    Muestra la página de inicio de sesión.
    Si el usuario ya está logueado, redirige a la selección de empresa.
    """
    if session.get('logged_in'):
        print("DEBUG (ruta /login): Usuario ya logueado, redirigiendo a /select-empresa.")
        return redirect(url_for('select_empresa_pagina'))
    print("DEBUG (ruta /login): Acceso a la página de inicio de sesión.")
    return render_template('login.html')

@app.route('/login_backend', methods=['POST'])
def login_backend_procesar():
    """
    Procesa la petición de inicio de sesión enviada por el cliente (AJAX).
    Si el login es exitoso, redirige a una ruta que verificará la autenticación de Google Drive.
    """
    data = request.get_json()
    if not data:
        print("DEBUG (/login_backend): Petición inválida (no JSON).")
        return jsonify({'success': False, 'error': 'Petición inválida.'}), 400

    username = data.get('username', '').strip()
    password = data.get('password', '')

    print(f"DEBUG (/login_backend): Intento de login para usuario: '{username}'")

    if username in USUARIOS_SEGUROS and USUARIOS_SEGUROS[username] == password:
        session['logged_in'] = True
        session['username'] = username
        session['nombre_completo'] = NOMBRES_COMPLETOS.get(username, username)
        print(f"DEBUG (/login_backend): Inicio de sesión interno exitoso para '{username}'.")
        
        # En lugar de redirigir directamente a select_empresa,
        # redirigimos a una ruta que manejará el flujo de Google Auth.
        return jsonify({
            'success': True,
            'message': 'Inicio de sesión exitoso. Verificando conexión con Google Drive...',
            'redirect_url': url_for('iniciar_flujo_google_o_continuar') # Nueva ruta
        }), 200
    else:
        print(f"DEBUG (/login_backend): Login interno fallido para '{username}'")
        return jsonify({'success': False, 'error': 'Usuario o contraseña incorrectos.'}), 401

@app.route('/iniciar_flujo_google_o_continuar')
def iniciar_flujo_google_o_continuar():
    """
    Esta ruta se visita después de un login interno exitoso.
    Verifica si el usuario necesita autenticarse con Google Drive.
    Si no, lo redirige a la página de selección de empresa.
    Si sí, guarda el destino (selección de empresa) y lo redirige al flujo de OAuth de Google.
    """
    if not session.get('logged_in'):
        # Si por alguna razón llega aquí sin estar logueado internamente, lo mandamos al login.
        return redirect(url_for('inicio_sesion_pagina'))

    print("DEBUG (/iniciar_flujo_google_o_continuar): Verificando servicio de Google Drive.")
    drive_service = get_drive_service() # Esta función intenta cargar credenciales de la cookie

    destino_final_despues_de_logins = url_for('select_empresa_pagina') # Página a la que ir después de todo

    if drive_service:
        print("DEBUG (/iniciar_flujo_google_o_continuar): Servicio Drive ya disponible. Redirigiendo a destino final.")
        return redirect(destino_final_despues_de_logins)
    else:
        print("DEBUG (/iniciar_flujo_google_o_continuar): Servicio Drive NO disponible. Iniciando flujo de autorización de Google.")
        # Guardar la URL a la que queremos ir DESPUÉS de que Google nos autentique.
        session['target_url_after_auth'] = destino_final_despues_de_logins
        
        # Crear una respuesta de redirección y borrar la cookie de credenciales por si estaba corrupta/inválida.
        response = make_response(redirect(url_for('authorize_google_drive'))) # Ruta que inicia OAuth con Google
        response.delete_cookie(CREDENTIALS_COOKIE) # Limpiar cookie potencialmente mala.
        session.pop('state', None) # Limpiar estado OAuth anterior si existiera.
        return response

@app.route('/logout')
def logout():
    """
    Cierra la sesión del usuario interno y borra la cookie de credenciales de Drive.
    Redirige a la página de inicio de sesión.
    """
    username_logged_out = session.get('username', 'Usuario Desconocido')
    print(f"DEBUG (/logout): Cerrando sesión para '{username_logged_out}'.")

    # Crear respuesta para redirigir y modificar cookies/sesión.
    response = make_response(redirect(url_for('inicio_sesion_pagina')))

    # Limpiar cookie de Google Drive.
    response.delete_cookie(CREDENTIALS_COOKIE)

    # Limpiar variables de sesión relacionadas con el login interno.
    session.pop('logged_in', None)
    session.pop('username', None)
    session.pop('nombre_completo', None)

    # Limpiar variables de sesión relacionadas con OAuth de Google.
    session.pop('state', None) # Estado de OAuth.

    # Limpiar variables del contexto `g` de Flask.
    g.pop('drive_service', None)
    g.pop('drive_credentials', None)
    g.pop('_original_creds_token_on_load', None)


    print("DEBUG (/logout): Sesión cerrada, cookie de Drive borrada. Redirigiendo a /login.")
    return response

# -----------------------------------------------------------------------------
# Rutas de Flujo OAuth2 con Google Drive
# -----------------------------------------------------------------------------

@app.route('/authorize')
def authorize_google_drive():
    """
    Inicia el flujo de autorización OAuth2 con Google.
    Redirige al usuario a la página de consentimiento de Google.
    """
    # Verificar si ya tenemos credenciales válidas para evitar flujo innecesario.
    # Sin embargo, esta ruta usualmente se llama cuando se detecta que no hay credenciales.
    # drive_service = get_drive_service()
    # if drive_service:
    #     print("DEBUG (/authorize): Ya hay un servicio de Drive válido. Redirigiendo a 'servicios_drive'.")
    #     return redirect(url_for('servicios_drive')) # Asumiendo que 'servicios_drive' es la página principal post-auth.

    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=url_for('oauth2callback_google_drive', _external=True) # _external=True para URL absoluta.
    )
    # `access_type='offline'` es crucial para obtener un refresh_token.
    # `prompt='consent'` fuerza la pantalla de consentimiento cada vez (útil para debug, quitar en producción).
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true'
        # prompt='consent' # Descomentar solo para depuración si se necesita forzar la re-autorización.
    )
    session['state'] = state # Guardar 'state' para verificar en el callback y prevenir CSRF.
    print(f"DEBUG (/authorize): Redirigiendo a URL de autorización de Google. State: {state}")
    return redirect(authorization_url)

# Asegúrate de tener estas importaciones si no están ya en la parte superior de tu archivo
from flask import session, request, url_for, redirect, make_response, g
from google_auth_oauthlib.flow import Flow
# Asumo que tienes definidas: CLIENT_SECRETS_FILE, SCOPES, credentials_to_dict, save_credentials_to_cookie
# y las rutas 'authorize_google_drive', 'servicios_drive', 'select_entidad_pagina'.

@app.route('/oauth2callback')
def oauth2callback_google_drive():
    """
    Callback de Google después de que el usuario autoriza (o niega) el acceso.
    Intercambia el código de autorización por tokens de acceso y refresh.
    Guarda las credenciales en una cookie segura y redirige al usuario a su destino original.
    """
    stored_state = session.pop('state', None) # Obtiene y elimina 'state' de la sesión
    request_state = request.args.get('state')

    # 1. Verificar el parámetro 'state' para mitigar CSRF.
    if not stored_state or not request_state or stored_state != request_state:
        print(f"ERROR (oauth2callback): Discrepancia en 'state'. Sesión: {stored_state}, Petición: {request_state}")
        # No es necesario limpiar 'state' de nuevo, ya se hizo con pop.
        return "Error de 'state mismatch' durante la autorización. Por favor, <a href=\"{{ url_for('authorize_google_drive') }}\">inténtalo de nuevo</a>.", 400

    # 'state' validado y eliminado.

    # 2. Construir el flujo y obtener tokens.
    try:
        flow = Flow.from_client_secrets_file(
            CLIENT_SECRETS_FILE, # Constante con la ruta a tu archivo de secretos
            scopes=SCOPES,       # Constante con los alcances de Google Drive
            redirect_uri=url_for('oauth2callback_google_drive', _external=True)
        )
        # Usar la URL completa de la respuesta de autorización.
        flow.fetch_token(authorization_response=request.url)
    except Exception as e:
        print(f"Error al obtener el token en oauth2callback: {e}")
        return f"Error al obtener el token de autorización de Google: {e}. <a href=\"{{ url_for('authorize_google_drive') }}\">Reintentar autorización</a>.", 400

    # 3. Credenciales obtenidas.
    new_credentials = flow.credentials # Este es el objeto Credentials

    # ----- DEBUG PRINT para verificar el refresh_token -----
    if new_credentials:
        creds_dict_debug = credentials_to_dict(new_credentials) # Asumo que tienes esta función
        print("="*30)
        print("DEBUG: Credenciales obtenidas en oauth2callback:")
        print(f"  Access Token: {'Presente' if creds_dict_debug.get('token') else 'AUSENTE'}")
        print(f"  Refresh Token: {creds_dict_debug.get('refresh_token')}") # ¡Crucial!
        print(f"  Client ID: {creds_dict_debug.get('client_id')}")
        print(f"  Client Secret: {'Presente' if creds_dict_debug.get('client_secret') else 'AUSENTE'}")
        print(f"  Token URI: {creds_dict_debug.get('token_uri')}")
        print("="*30)
    # ----- FIN DEBUG PRINT -----

    # 4. Actualizar credenciales en el contexto 'g' para que el hook after_request las guarde.
    # Esto es vital para la persistencia de la sesión de Drive.
    g.drive_credentials = new_credentials
    # Forzar la actualización de la cookie en `after_request` indicando que el token ha cambiado.
    # Puedes hacerlo invalidando la caché del token original o asegurándote de que
    # `update_credentials_cookie_if_refreshed` compare correctamente.
    # Una forma simple es limpiar el token original guardado en `g` si lo usas para comparación.
    if hasattr(g, '_original_creds_token_on_load'):
        g._original_creds_token_on_load = None # Para asegurar que se detecte como "refrescado"

    # 5. Determinar la URL de redirección final.
    redirect_url_final = session.pop('target_url_after_auth', None)

    if not redirect_url_final:
        # Fallback si 'target_url_after_auth' no se usó o no se encontró
        target_entidad = session.pop('target_entidad_after_auth', None)
        if target_entidad:
            try:
                redirect_url_final = url_for('servicios_drive', entidad=target_entidad)
            except Exception as e: # Captura errores de url_for si la ruta o params son incorrectos
                print(f"ERROR (oauth2callback): No se pudo generar URL para 'servicios_drive' con entidad '{target_entidad}': {e}")
                redirect_url_final = None # Fuerza el siguiente fallback
    
    if not redirect_url_final:
        # Si aún no hay URL específica, redirigir a una página por defecto
        print("DEBUG (oauth2callback): No se encontró target_url_after_auth ni target_entidad_after_auth válida. Redirigiendo a página por defecto (select_entidad_pagina).")
        try:
            redirect_url_final = url_for('select_entidad_pagina') # O la que consideres tu página principal post-auth
        except Exception as e:
            print(f"ERROR (oauth2callback): No se pudo generar URL para 'select_entidad_pagina'. Redirigiendo a la raíz: {e}")
            redirect_url_final = url_for('raiz') # O una ruta raíz segura

    print(f"DEBUG (oauth2callback): Autenticación exitosa. Redirigiendo a: {redirect_url_final}")
    
    # Crear la respuesta. La cookie de credenciales se guardará mediante el hook `after_request`
    # porque hemos actualizado `g.drive_credentials`.
    # No es necesario llamar a save_credentials_to_cookie directamente aquí si `after_request` está bien configurado.
    response = make_response(redirect(redirect_url_final))
    
    # Si NO estás usando un hook after_request para guardar la cookie, descomenta la siguiente línea:
    # if new_credentials:
    #     creds_dict_to_save = credentials_to_dict(new_credentials)
    #     save_credentials_to_cookie(response, creds_dict_to_save) # Asumo que tienes estas funciones

    return response



# -----------------------------------------------------------------------------
# Rutas Principales de la Aplicación (Contenido y Funcionalidad)
# -----------------------------------------------------------------------------

@app.route('/select-empresa', methods=['GET'])
def select_empresa_pagina():
    """
    Muestra la página para seleccionar la empresa.
    Requiere que el usuario interno esté logueado.
    """
    if not session.get('logged_in'):
        print("DEBUG (ruta /select-empresa): Usuario no logueado, redirigiendo a /login.")
        return redirect(url_for('inicio_sesion_pagina'))

    username = session.get('username', 'Usuario Desconocido')
    print(f"DEBUG (ruta /select-empresa): Acceso a la página de selección de empresa para '{username}'.")
    return render_template('select-empresa.html', username=username)

@app.route('/select-entidad', methods=['GET'])
def select_entidad_pagina():
    """
    Muestra la página para seleccionar la entidad (ej. 'sagrado_corazon', 'palmitos').
    Requiere que el usuario interno esté logueado.
    Aquí podrías pasar las entidades disponibles al template si es necesario.
    """
    if not session.get('logged_in'):
        print("DEBUG (ruta /select-entidad): Usuario no logueado, redirigiendo a /login.")
        return redirect(url_for('inicio_sesion_pagina'))

    username = session.get('username', 'Usuario Desconocido')
    # Pasar las entidades disponibles desde ENTIDADES_FOLDER_IDS al template
    # para que el usuario pueda seleccionarlas.
    # entidades_disponibles = list(ENTIDADES_FOLDER_IDS.keys())
    print(f"DEBUG (ruta /select-entidad): Acceso para '{username}'.")
    return render_template('select-entidad.html', username=username) # entidades=entidades_disponibles

@app.route('/Conet_Drive', methods=['GET'])
def servicios_drive():
    """
    Muestra los servicios (carpetas principales) de Drive para una entidad específica.
    Requiere autenticación de Google Drive.
    """
    if not session.get('logged_in'):
        print("DEBUG (ruta /Conet_Drive): Usuario interno no logueado. Redirigiendo a /login.")
        return redirect(url_for('inicio_sesion_pagina'))

    entidad_seleccionada = request.args.get('entidad')
    if not entidad_seleccionada or entidad_seleccionada not in ENTIDADES_FOLDER_IDS:
        print(f"ERROR (ruta /Conet_Drive): Entidad '{entidad_seleccionada}' no válida o no especificada.")
        abort(400, description="Entidad no válida o no especificada.")

    folder_id_raiz_entidad = ENTIDADES_FOLDER_IDS[entidad_seleccionada]
    print(f"DEBUG (ruta /Conet_Drive): Intentando acceder a entidad '{entidad_seleccionada}', Folder ID: {folder_id_raiz_entidad}")

    # 1. Obtener el servicio de Google Drive UNA SOLA VEZ
    service = get_drive_service()

    # 2. Si no hay servicio (requiere autenticación con Drive)
    if not service:
        print("DEBUG (ruta /Conet_Drive): Servicio Drive no disponible. Redirigiendo a /authorize.")
        
        # Guardar la URL completa a la que el usuario intentaba acceder. Es más robusto.
        session['target_url_after_auth'] = url_for('servicios_drive', entidad=entidad_seleccionada, _external=True)
        # Alternativamente, si tu oauth2callback está diseñado para usar 'target_entidad_after_auth':
        # session['target_entidad_after_auth'] = entidad_seleccionada 
        # Pero usar la URL completa es a menudo más flexible.

        response = make_response(redirect(url_for('authorize_google_drive')))
        response.delete_cookie(CREDENTIALS_COOKIE) # Buena práctica limpiar cookies potencialmente inválidas
        session.pop('state', None) # Limpiar estado OAuth anterior si existiera
        return response

    # 3. Si el servicio está disponible, proceder a obtener datos de Drive
    nombre_carpeta_obtenido_de_drive = "Nombre de Entidad Desconocido" # Valor por defecto
    try:
        file_metadata = service.files().get(fileId=folder_id_raiz_entidad, fields="name").execute()
        nombre_carpeta_obtenido_de_drive = file_metadata.get('name', nombre_carpeta_obtenido_de_drive)
        print(f"DEBUG (ruta /Conet_Drive): Nombre de la entidad ({folder_id_raiz_entidad}): {nombre_carpeta_obtenido_de_drive}")
    except HttpError as e:
        print(f"ERROR HttpError obteniendo nombre de carpeta {folder_id_raiz_entidad}: {e.resp.status} - {e._get_reason()}")
        if e.resp.status == 404:
            nombre_carpeta_obtenido_de_drive = f"Entidad '{entidad_seleccionada}' (ID: {folder_id_raiz_entidad}) no encontrada en Drive."
            # Podrías considerar abort(404) aquí si es crítico
        else:
            nombre_carpeta_obtenido_de_drive = f"Error al cargar nombre de '{entidad_seleccionada}'"
    except Exception as e:
        print(f"ERROR inesperado obteniendo nombre de carpeta {folder_id_raiz_entidad}: {e}")
        nombre_carpeta_obtenido_de_drive = "Error al cargar nombre de la entidad"

    # 4. Listar carpetas (servicios) dentro de la carpeta raíz de la entidad.
    mime_condition_carpetas = "mimeType = 'application/vnd.google-apps.folder'"
    carpetas_servicios = listar_archivos(service, folder_id_raiz_entidad, mime_condition_carpetas)

    # 5. Renderizar la plantilla.
    return render_template(
        'servicios.html',
        folders=carpetas_servicios,
        entidad=entidad_seleccionada,
        nombre_de_ese=nombre_carpeta_obtenido_de_drive
    )

@app.route('/carpeta/<folder_id>')
def ver_equipos(folder_id):
    """
    Muestra el contenido de una carpeta específica en Drive (equipos o subcarpetas de equipos).
    Requiere autenticación de Google Drive.
    """
    if not session.get('logged_in'):
        return redirect(url_for('inicio_sesion_pagina'))

    service = get_drive_service()
    if not service:
        print(f"DEBUG (ruta /carpeta/{folder_id}): No hay servicio Drive. Redirigiendo a /authorize.")
        # Aquí también podríamos guardar el folder_id para redirigir de vuelta
        # session['target_folder_after_auth'] = folder_id
        response = make_response(redirect(url_for('authorize_google_drive')))
        response.delete_cookie(CREDENTIALS_COOKIE)
        session.pop('state', None)
        return response

    # Obtener información de la carpeta actual (nombre).
    try:
        folder_info = service.files().get(fileId=folder_id, fields="id, name").execute()
        nombre_carpeta_actual = folder_info.get('name', 'Carpeta Desconocida')
    except HttpError as e:
        print(f"Error HttpError obteniendo info de carpeta {folder_id}: {e}")
        if e.resp.status == 404:
            abort(404, f"La carpeta con ID {folder_id} no fue encontrada.")
        else:
            abort(500, "Error al obtener información de la carpeta desde Google Drive.")
    except Exception as e: # Otros errores genéricos
        print(f"Error inesperado obteniendo info de carpeta {folder_id}: {e}")
        abort(500, "Error inesperado al obtener información de la carpeta.")


    # Listar subcarpetas y archivos dentro de la carpeta actual.
    mime_condition_carpetas = "mimeType = 'application/vnd.google-apps.folder'"
    mime_condition_archivos = "mimeType != 'application/vnd.google-apps.folder'"

    subcarpetas = listar_archivos(service, folder_id, mime_condition_carpetas)
    archivos_en_carpeta = listar_archivos(service, folder_id, mime_condition_archivos)

    tiene_solo_archivos = not subcarpetas and archivos_en_carpeta

    # La actualización de la cookie de credenciales se maneja en `after_request`.
    return render_template(
        'equipos.html', # Asumo que equipos.html puede mostrar tanto subcarpetas como archivos.
        carpetas=subcarpetas,
        archivos=archivos_en_carpeta,
        tiene_solo_archivos=tiene_solo_archivos,
        nombre_carpeta=nombre_carpeta_actual,
        folder_id=folder_id
    )

# -----------------------------------------------------------------------------
# Rutas de Gestión de Equipos (JSON y Drive)
# -----------------------------------------------------------------------------

@app.route('/Filtro-Equipos', methods=['GET'])
def filtro():
    """
    Muestra la página de filtro de equipos y los resultados filtrados.
    Los datos de los equipos se cargan desde el JSON local.
    Opcionalmente, puede requerir autenticación de Drive si alguna acción posterior lo necesita.
    """
    # Opcional: Verificar autenticación de Drive si es estrictamente necesario para esta página.
    # service = get_drive_service()
    # if not service:
    #     print("DEBUG (ruta /Filtro-Equipos): No autenticado con Drive. Redirigiendo a /authorize.")
    #     # Guardar la intención de ir a filtros si es necesario
    #     # session['redirect_after_auth_to'] = url_for('filtro_equipos_pagina')
    #     response = make_response(redirect(url_for('authorize_google_drive')))
    #     return response

    print("DEBUG (ruta /Filtro-Equipos): Acceso a página de filtro.")

    # 1. Cargar todos los datos de equipos desde el archivo JSON.
    all_equipos_data_from_json = load_equipos_json() # Usa EQUIPOS_JSON_PATH por defecto.
    if not all_equipos_data_from_json: # load_equipos_json devuelve {} en error o vacío.
        print("ADVERTENCIA (/Filtro-Equipos): No se cargaron datos de equipos del JSON o el archivo está vacío/corrupto.")
        # No es necesario que sea un error fatal, puede mostrar 0 equipos.

    # 2. Aplanar los datos: Recolectar todos los equipos de todos los servicios en una sola lista.
    all_items_flat = []
    for service_label, items_in_service_dict in all_equipos_data_from_json.items():
        if isinstance(items_in_service_dict, dict):
            for drive_item_id, equipo_details_dict in items_in_service_dict.items():
                if isinstance(equipo_details_dict, dict):
                    item_for_filter = equipo_details_dict.copy()
                    item_for_filter['drive_id'] = drive_item_id # ID de la carpeta del equipo en Drive.
                    item_for_filter['service_label'] = service_label # Etiqueta del servicio (ej. "Mantenimiento HUV", "Biomédicos")
                    item_for_filter['display_name'] = equipo_details_dict.get('nombre', f'Equipo ID: {drive_item_id[:6]}...')
                    all_items_flat.append(item_for_filter)
                else:
                    print(f"ADVERTENCIA (/Filtro-Equipos): Item inválido (no es dict) encontrado en JSON bajo '{service_label}' con clave '{drive_item_id}'. Ignorando.")
        else:
            print(f"ADVERTENCIA (/Filtro-Equipos): Entrada inválida (no es dict) encontrada en JSON para la clave de servicio '{service_label}'. Esperaba un diccionario de equipos.")

    total_equipos_count = len(all_items_flat)

    # 3. Obtener los parámetros de filtro desde la URL (request.args).
    filter_nombre = request.args.get('nombre', '').strip().lower()
    filter_marca_modelo = request.args.get('marca_modelo', '').strip().lower()
    filter_service_label_json = request.args.get('service_label', '').strip().lower() # Etiqueta del servicio del JSON.
    filter_serie = request.args.get('serie', '').strip().lower()
    # 'ubicacion' parece haber sido eliminada, mantener así.

    current_filters_for_template = {
        'nombre': request.args.get('nombre', ''), # Mantener el valor original para el template.
        'marca_modelo': request.args.get('marca_modelo', ''),
        'service_label': request.args.get('service_label', ''),
        'serie': request.args.get('serie', '')
    }

    # 4. Aplicar los filtros.
    filtered_items = []
    filters_are_active = any([filter_nombre, filter_marca_modelo, filter_service_label_json, filter_serie])

    if filters_are_active:
        for item in all_items_flat:
            match = True # Asumir que coincide inicialmente.
            if filter_nombre and filter_nombre not in str(item.get('nombre', '')).lower():
                match = False
            if match and filter_marca_modelo and filter_marca_modelo not in str(item.get('marca_modelo', '')).lower():
                match = False
            if match and filter_service_label_json and filter_service_label_json not in str(item.get('service_label', '')).lower(): # Comparar con 'service_label' del item.
                match = False
            if match and filter_serie and filter_serie not in str(item.get('serie', '')).lower():
                match = False

            if match:
                filtered_items.append(item)
    else:
        # Si no hay filtros activos, mostrar todos los ítems.
        filtered_items = all_items_flat

    filtered_equipos_count = len(filtered_items)

    # 5. Opcional: Ordenar los resultados filtrados (ej. por nombre).
    filtered_items_sorted = sorted(filtered_items, key=lambda item: item.get('display_name', '').lower())

    # 6. Renderizar la plantilla. La cookie se maneja en `after_request`.
    return render_template(
        'filtro.html',
        equipos=filtered_items_sorted,
        total_equipos_count=total_equipos_count,
        filtered_equipos_count=filtered_equipos_count,
        current_filters=current_filters_for_template
    )

@app.route('/formato_mantenimiento')
def formato_mantenimiento():
    """
    Muestra un formato de mantenimiento en blanco.
    Requiere autenticación de Drive (para asegurar consistencia en el flujo de usuario).
    """
    if not session.get('logged_in'):
        return redirect(url_for('inicio_sesion_pagina'))

    service = get_drive_service()
    if not service:
        print("DEBUG (ruta /formato_mantenimiento): No hay servicio Drive. Redirigiendo a /authorize.")
        response = make_response(redirect(url_for('authorize_google_drive')))
        # No es necesario borrar cookie aquí, get_drive_service lo maneja si falla el refresh.
        return response

    # Determinar la firma del usuario logueado.
    username_session = session.get('username', 'default').lower()
    nombre_responsable_session = session.get('nombre_completo', 'Usuario del Sistema') # Usar nombre completo.

    # Construir ruta relativa a la firma para el template.
    # Asume que las firmas están en 'static/images/firma-USERNAME.jpg'.
    firma_filename = f'firma-{username_session}.jpg'
    firma_path_in_static = os.path.join('images', firma_filename) # Ruta relativa a 'static'
    firma_absolute_path = os.path.join(app.static_folder, firma_path_in_static)

    if os.path.exists(firma_absolute_path):
        firma_relativa_para_template = firma_path_in_static.replace(os.sep, '/') # Asegurar separadores web.
    else:
        # Firma por defecto si la del usuario no existe.
        print(f"ADVERTENCIA: Firma no encontrada para '{username_session}' en '{firma_absolute_path}'. Usando firma por defecto.")
        firma_relativa_para_template = 'images/firma-marlon.jpg' # Asumiendo que esta es la de Marlon.

    print(f"DEBUG (/formato_mantenimiento): Usuario: {username_session}, Firma relativa: {firma_relativa_para_template}")

    # La cookie se maneja en `after_request`.
    return render_template(
        'formato-preventivo-correctivo.html', # Nombre del template para el formato.
        firma=firma_relativa_para_template,
        nombre_responsable=nombre_responsable_session
    )

@app.route('/Mantenimiento/<folder_id>', methods=['GET', 'POST'])
def mantenimiento(folder_id):
    """
    Muestra/Procesa el formulario de mantenimiento para un equipo específico (identificado por folder_id).
    Carga/Guarda datos del equipo desde/hacia el JSON local.
    Requiere autenticación de Drive.
    """
    if not session.get('logged_in'):
        return redirect(url_for('inicio_sesion_pagina'))

    service = get_drive_service()
    if not service:
        print(f"DEBUG (ruta /Mantenimiento/{folder_id}): No hay servicio Drive. Redirigiendo a /authorize.")
        # session['redirect_after_auth_to'] = url_for('mantenimiento_equipo', folder_id=folder_id) # Guardar destino.
        response = make_response(redirect(url_for('authorize_google_drive')))
        return response

    # Cargar datos JSON de todos los equipos.
    # load_equipos_json maneja creación de archivo/directorio si no existen.
    datos_json_todos_equipos = load_equipos_json()

    # Buscar el equipo específico y su servicio (etiqueta JSON).
    equipo_encontrado_dict = None
    servicio_del_equipo_json_key = None
    for servicio_key, items_en_servicio_dict in datos_json_todos_equipos.items():
        if isinstance(items_en_servicio_dict, dict) and folder_id in items_en_servicio_dict:
            equipo_encontrado_dict = items_en_servicio_dict[folder_id]
            servicio_del_equipo_json_key = servicio_key
            break

    # Manejo si el equipo no se encuentra en el JSON.
    if equipo_encontrado_dict is None:
        print(f"ADVERTENCIA (/Mantenimiento): Equipo con ID {folder_id} no encontrado en {EQUIPOS_JSON_PATH}.")
        # Opción 1: Mostrar error 404.
        # abort(404, f"Registro del equipo ID {folder_id} no encontrado en el sistema local.")
        # Opción 2: Crear una entrada temporal para permitir el registro (si el POST lo maneja).
        #           Esto requiere que el formulario permita ingresar todos los datos necesarios.
        equipo_encontrado_dict = {
            "nombre": "Equipo Nuevo (No Registrado en JSON)",
            "dependencia": "", "marca_modelo": "", "serie": "", "ubicacion": ""
            # Añadir otros campos que el template `mantenimiento.html` espere.
        }
        # Si se crea temporalmente, servicio_del_equipo_json_key será None.
        # El POST necesitará manejar esto para asignar un servicio o crear uno.
        print(f"DEBUG (/Mantenimiento): Se usará una plantilla de equipo nuevo para {folder_id} ya que no está en JSON.")


    # --- Procesar Petición POST (Guardar Cambios) ---
    if request.method == 'POST':
        if servicio_del_equipo_json_key is None:
            # Si el equipo era nuevo (no en JSON) y se está guardando.
            # Se necesita decidir a qué 'servicio_key' asignarlo.
            # Podría venir del formulario, o usar uno por defecto/genérico.
            # Aquí asumimos que el frontend podría enviar 'service_key_for_json' o se asigna a "Sin Servicio".
            servicio_del_equipo_json_key = request.form.get('service_key_for_json', "Sin Servicio Registrado")
            if servicio_del_equipo_json_key not in datos_json_todos_equipos:
                datos_json_todos_equipos[servicio_del_equipo_json_key] = {}
            # Asegurar que la entrada para este folder_id existe bajo el servicio_key.
            datos_json_todos_equipos[servicio_del_equipo_json_key].setdefault(folder_id, {})
            print(f"DEBUG (POST /Mantenimiento): Equipo {folder_id} será añadido/actualizado bajo el servicio JSON '{servicio_del_equipo_json_key}'.")

        try:
            # Actualizar los datos del equipo en el diccionario `datos_json_todos_equipos`.
            target_equipo_dict_in_json = datos_json_todos_equipos[servicio_del_equipo_json_key][folder_id]

            target_equipo_dict_in_json['nombre'] = request.form.get('nombre', target_equipo_dict_in_json.get('nombre'))
            target_equipo_dict_in_json['dependencia'] = request.form.get('dependencia', target_equipo_dict_in_json.get('dependencia'))
            target_equipo_dict_in_json['marca_modelo'] = request.form.get('marca_modelo', target_equipo_dict_in_json.get('marca_modelo'))
            target_equipo_dict_in_json['serie'] = request.form.get('serie', target_equipo_dict_in_json.get('serie'))
            target_equipo_dict_in_json['ubicacion'] = request.form.get('ubicacion', target_equipo_dict_in_json.get('ubicacion'))
            # ... añadir otros campos del formulario aquí ...

            # Guardar el diccionario completo `datos_json_todos_equipos` de nuevo en el archivo JSON.
            with open(EQUIPOS_JSON_PATH, 'w', encoding='utf-8') as f:
                json.dump(datos_json_todos_equipos, f, ensure_ascii=False, indent=4)
            print(f"DEBUG (POST /Mantenimiento): Datos JSON actualizados y GUARDADOS para {folder_id} en {EQUIPOS_JSON_PATH}")

            # Redirigir a la misma página (GET) después del POST (Patrón Post/Redirect/Get).
            # Esto evita reenvíos de formulario si el usuario recarga la página.
            return redirect(url_for('mantenimiento_equipo', folder_id=folder_id))

        except IOError as e:
            print(f"ERROR (POST /Mantenimiento): IOError al guardar datos JSON en {EQUIPOS_JSON_PATH}: {e}")
            # Renderizar de nuevo la página con un mensaje de error.
            # El `equipo_encontrado_dict` aquí sería el que se intentó guardar.
            # La cookie se actualiza en `after_request`.
            return render_template('mantenimiento.html',
                                   equipo=target_equipo_dict_in_json, # Mostrar los datos que se intentaron guardar.
                                   folder_id=folder_id,
                                   error_message="ERROR AL GUARDAR los cambios en el archivo local.",
                                   # ... pasar firma y nombre_responsable de nuevo ...
                                   )
        except Exception as e:
            print(f"Error inesperado procesando POST en /Mantenimiento para {folder_id}: {e}")
            # Renderizar de nuevo con error.
            return render_template('mantenimiento.html',
                                   equipo=equipo_encontrado_dict, # Datos antes del intento de POST.
                                   folder_id=folder_id,
                                   error_message=f"Error inesperado al procesar los datos: {type(e).__name__}.",
                                   # ... pasar firma y nombre_responsable de nuevo ...
                                  )

    # --- Lógica para Petición GET (Mostrar Formulario) ---
    username_session = session.get('username', 'default').lower()
    nombre_responsable_session = session.get('nombre_completo', 'Usuario del Sistema')
    firma_filename = f'firma-{username_session}.jpg'
    firma_path_in_static = os.path.join('images', firma_filename)
    firma_absolute_path = os.path.join(app.static_folder, firma_path_in_static)
    firma_relativa_para_template = firma_path_in_static.replace(os.sep, '/') \
        if os.path.exists(firma_absolute_path) else 'images/firma-marlon.jpg' # Firma por defecto

    print(f"DEBUG (GET /Mantenimiento): Mostrando formulario para equipo {folder_id}. Usuario: {username_session}, Firma: {firma_relativa_para_template}")

    # La cookie se actualiza en `after_request`.
    return render_template(
        'mantenimiento.html',
        equipo=equipo_encontrado_dict, # Datos del equipo cargados del JSON (o plantilla nueva).
        folder_id=folder_id,
        firma=firma_relativa_para_template,
        nombre_responsable=nombre_responsable_session
    )


# -----------------------------------------------------------------------------
# Rutas API para Interacciones con Google Drive y JSON (usadas por AJAX)
# -----------------------------------------------------------------------------

@app.route('/upload_pdf_to_drive', methods=['POST'])
def upload_pdf_to_drive_api():
    """
    API endpoint para subir un archivo PDF a una carpeta específica en Google Drive.
    Usado por AJAX desde el frontend.
    Requiere autenticación de Drive.
    """
    # 1. Verificar autenticación y obtener servicio Drive.
    service = get_drive_service()
    if not service:
        print("DEBUG (upload_pdf_to_drive): No autorizado o sesión Drive inválida.")
        return jsonify({'success': False, 'error': 'No autorizado o sesión de Drive inválida. Por favor, re-autentíquese.'}), 401

    # 2. Obtener archivo PDF y metadatos del request.
    if 'pdfFile' not in request.files:
        return jsonify({'success': False, 'error': 'No se encontró el archivo PDF (campo "pdfFile") en la petición.'}), 400

    uploaded_file = request.files['pdfFile']
    file_content_bytes = uploaded_file.read() # Leer contenido del archivo.
    mime_type = 'application/pdf' # Asumimos que es PDF.

    # Nombre de archivo y carpeta destino desde el formulario.
    desired_filename = request.form.get('fileName', uploaded_file.filename or "documento_sin_nombre.pdf")
    target_drive_folder_id = request.form.get('folderId') # ID de la carpeta en Drive donde se subirá.

    if not target_drive_folder_id:
        return jsonify({'success': False, 'error': 'Falta el ID de la carpeta de destino (campo "folderId").'}), 400

    print(f"DEBUG (upload_pdf_to_drive): Intentando subir '{desired_filename}' a la carpeta Drive ID: '{target_drive_folder_id}'")

    # 3. Preparar metadatos y media para la API de Drive.
    file_metadata_drive = {
        'name': desired_filename,
        'parents': [target_drive_folder_id] # `parents` debe ser una lista.
    }
    media_body_upload = MediaIoBaseUpload(
        BytesIO(file_content_bytes), # Contenido del archivo como stream en memoria.
        mimetype=mime_type,
        resumable=True # Recomendado para subidas robustas.
    )

    # 4. Ejecutar la subida.
    try:
        print(f"DEBUG: Llamando a service.files().create para '{desired_filename}'...")
        created_file_info = service.files().create(
            body=file_metadata_drive,
            media_body=media_body_upload,
            fields='id, name, webViewLink' # Campos a devolver en la respuesta.
        ).execute()
        print(f"DEBUG: Archivo subido con éxito a Drive. ID: {created_file_info.get('id')}, Nombre: {created_file_info.get('name')}")

        # Crear respuesta JSON de éxito. La cookie se actualiza en `after_request`.
        return jsonify({
            'success': True,
            'fileId': created_file_info.get('id'),
            'fileName': created_file_info.get('name'),
            'viewLink': created_file_info.get('webViewLink')
        }), 200 # 200 OK o 201 Created.

    except google.auth.exceptions.RefreshError as re:
        print(f"ERROR CRÍTICO (upload_pdf_to_drive): Falló el REFRESH del token durante la subida: {re}")
        return jsonify({'success': False, 'error': 'Falló la renovación de la sesión de Drive. Por favor, re-autentíquese.'}), 401
    except HttpError as he:
        error_content = he.content.decode('utf-8') if he.content else "{}"
        error_details = {}
        try:
            error_details = json.loads(error_content).get('error', {})
        except json.JSONDecodeError:
            pass

        status_code = he.resp.status
        error_message_api = error_details.get('message', f"Error de API de Drive no especificado (Status: {status_code}).")

        print(f"ERROR HttpError ({status_code}) subiendo archivo a Drive: {error_message_api}. Detalles: {error_content}")
        return jsonify({'success': False, 'error': f"Error al subir a Drive ({status_code}): {error_message_api}"}), status_code

    except Exception as e:
        print(f"ERROR inesperado subiendo archivo a Drive: {type(e).__name__} - {e}")
        return jsonify({'success': False, 'error': f"Ocurrió un error inesperado en el servidor al subir el archivo: {type(e).__name__}"}), 500


@app.route('/delete_file_from_drive', methods=['POST'])
def delete_file_from_drive_api():
    """
    API endpoint para eliminar (mover a la papelera) un archivo específico de Google Drive.
    Usado por AJAX. Requiere autenticación de Drive.
    """
    service = get_drive_service()
    if not service:
        print("DEBUG (delete_file_from_drive): No autorizado o sesión Drive inválida.")
        return jsonify({'success': False, 'error': 'No autorizado o sesión de Drive inválida. Por favor, re-autentíquese.'}), 401

    request_data = request.get_json() or request.form
    file_id_to_delete = request_data.get('fileId')

    if not file_id_to_delete:
        print("ADVERTENCIA (delete_file_from_drive): No se recibió 'fileId'.")
        return jsonify({'success': False, 'error': 'Falta el ID del archivo a eliminar (campo "fileId").'}), 400

    print(f"DEBUG (delete_file_from_drive): Intentando eliminar archivo Drive con ID: '{file_id_to_delete}'")

    try:
        # La API de Drive `delete` mueve el archivo a la papelera. No lo borra permanentemente.
        # Para borrado permanente, se necesitarían otros pasos o permisos.
        service.files().delete(fileId=file_id_to_delete).execute()
        # Una respuesta exitosa de `delete` no tiene cuerpo (HTTP 204 No Content).
        print(f"DEBUG: Archivo {file_id_to_delete} movido a la papelera de Drive con éxito.")

        # La cookie se actualiza en `after_request`.
        return jsonify({'success': True, 'message': 'Archivo movido a la papelera de Google Drive.'}), 200 # 200 OK.

    except HttpError as he:
        error_content = he.content.decode('utf-8') if he.content else "{}"
        error_details = {}
        try:
            error_details = json.loads(error_content).get('error', {})
        except json.JSONDecodeError:
            pass

        status_code = he.resp.status
        error_message_api = error_details.get('message', f"Error de API de Drive no especificado (Status: {status_code}).")
        error_reason_api = error_details.get('errors', [{}])[0].get('reason', 'unknownReason')

        if status_code == 404:
            error_message_user = f'El archivo con ID {file_id_to_delete} no fue encontrado en Drive.'
        elif status_code == 403:
            error_message_user = f'No tienes permiso para eliminar el archivo con ID {file_id_to_delete} de Drive.'
        else:
            error_message_user = f'Error de la API de Drive ({status_code}) al eliminar: {error_message_api}'

        print(f"ERROR HttpError ({status_code}) al eliminar {file_id_to_delete} de Drive. Razón: {error_reason_api}. Mensaje API: {error_message_api}. Contenido: {error_content}")
        return jsonify({'success': False, 'error': error_message_user}), status_code

    except google.auth.exceptions.RefreshError as re:
        print(f"ERROR CRÍTICO (delete_file_from_drive): Falló el REFRESH del token durante la eliminación: {re}")
        return jsonify({'success': False, 'error': 'Falló la renovación de la sesión de Drive. Por favor, re-autentíquese.'}), 401
    except Exception as e:
        print(f"ERROR inesperado al eliminar archivo {file_id_to_delete} de Drive: {type(e).__name__} - {e}")
        return jsonify({'success': False, 'error': f'Ocurrió un error inesperado en el servidor al eliminar el archivo: {type(e).__name__}'}), 500


@app.route('/api/registrar_equipo_completo', methods=['POST'])
def api_registrar_equipo_completo():
    """
    API endpoint para registrar un equipo completo:
    1. Crea una carpeta para el equipo en Google Drive.
    2. Guarda los detalles del equipo (incluyendo el ID de la carpeta de Drive) en el JSON local.
    Requiere autenticación de Drive. La dependencia se asigna automáticamente al nombre del servicio (service_key).
    """
    drive_service = get_drive_service()
    if not drive_service:
        print("DEBUG (api/registrar_equipo_completo): No autenticado o servicio Drive no disponible.")
        return jsonify({'success': False, 'error': 'No autenticado o servicio Drive no disponible. Por favor, re-autentíquese.'}), 401

    data = request.get_json()
    if not data:
        print("DEBUG (api/registrar_equipo_completo): Petición inválida (no JSON).")
        return jsonify({'success': False, 'error': 'Petición inválida (no JSON).'}), 400

    # service_key_for_json: La etiqueta bajo la cual se guardará en el JSON (ej. "Biomédicos HUV").
    service_key_for_json = data.get('service_key_for_json')
    # parent_drive_folder_id: ID de la carpeta en Drive que representa al 'servicio' (ej. la carpeta "Biomédicos HUV" en Drive).
    # Si no se provee, se intentará buscar.
    parent_drive_folder_id_from_request = data.get('parent_drive_folder_id')
    equipo_details_from_request = data.get('equipo_details') # {nombre, marca_modelo, serie, ubicacion}

    if not service_key_for_json or not equipo_details_from_request or not equipo_details_from_request.get('nombre'):
        error_msg = "Faltan datos: 'service_key_for_json' o 'equipo_details' (incluyendo 'nombre') son requeridos."
        print(f"DEBUG (api/registrar_equipo_completo): {error_msg} Datos recibidos: {data}")
        return jsonify({'success': False, 'error': error_msg}), 400

    if not isinstance(equipo_details_from_request, dict):
        print(f"ERROR (api/registrar_equipo_completo): 'equipo_details' no es un diccionario. Recibido: {equipo_details_from_request}")
        return jsonify({'success': False, 'error': "Formato de 'equipo_details' inesperado."}), 400

    # Asignar dependencia automáticamente al nombre del servicio (etiqueta JSON).
    equipo_details_to_save = equipo_details_from_request.copy()
    equipo_details_to_save['dependencia'] = service_key_for_json
    print(f"DEBUG (api/registrar_equipo_completo): Dependencia establecida automáticamente a '{service_key_for_json}'.")

    equipo_nombre_para_carpeta_drive = equipo_details_to_save.get('nombre', 'Equipo Sin Nombre').strip()
    final_parent_drive_folder_id_for_equipo = parent_drive_folder_id_from_request

    # Si el frontend no proporcionó `parent_drive_folder_id`, buscarlo en Drive por `service_key_for_json`.
    # Esto asume que hay una carpeta en Drive cuyo nombre coincide con `service_key_for_json`
    # y que esta carpeta es hija de alguna carpeta raíz general (ej. la de la entidad).
    # Esta lógica necesita saber cuál es la "carpeta raíz general" para buscar dentro de ella.
    # Por ahora, el código original busca dentro de `ROOT_FOLDER_ID` (que no está bien definido para este contexto).
    # Para que esto funcione, el frontend DEBE enviar `parent_drive_folder_id` que es el ID de la carpeta del servicio.
    # O, la variable `parent_folder_id = request.form.get('folderId') or request.args.get('folderId')` del código original
    # debe ser el ID de la carpeta del servicio (ej. "Biomédicos HUV" en Drive).
    # Asumiremos que `parent_drive_folder_id_from_request` es el ID correcto de la carpeta del servicio en Drive.

    if not final_parent_drive_folder_id_for_equipo:
        # Esta lógica de búsqueda es compleja y depende de una estructura de carpetas predefinida.
        # Es más robusto si el frontend envía directamente el ID de la carpeta padre del servicio en Drive.
        # El código original tenía una búsqueda basada en ROOT_FOLDER_ID, lo cual es ambiguo aquí.
        # Se necesita el ID de la carpeta de servicio (ej. "Biomédicos HUV") para crear el equipo dentro.
        print(f"ERROR (api/registrar_equipo_completo): No se proporcionó 'parent_drive_folder_id' (ID de la carpeta del servicio en Drive). No se puede crear el equipo.")
        return jsonify({'success': False, 'error': "Falta el ID de la carpeta de servicio en Drive para crear el equipo."}), 400
        # --- Bloque de búsqueda de carpeta de servicio (si se decide implementar y `ROOT_FOLDER_ID` está bien definido) ---
        # print(f"DEBUG ... Buscando carpeta de servicio '{service_key_for_json}' en Drive...")
        # try:
        #     # Query para buscar la carpeta del servicio por nombre DENTRO de una carpeta raíz de la entidad (necesitaríamos ese ID).
        #     # query = (f"'{ID_CARPETA_RAIZ_ENTIDAD_ACTUAL}' in parents and " # ID_CARPETA_RAIZ_ENTIDAD_ACTUAL debe obtenerse de algún lado.
        #     #          f"mimeType = 'application/vnd.google-apps.folder' and "
        #     #          f"name = '{service_key_for_json.replace("'", "\\'")}' and trashed = false")
        #     # ... ejecutar query ...
        #     # if found: final_parent_drive_folder_id_for_equipo = found_id
        #     # else: error
        # except HttpError as e: ...
        # except Exception as e: ...
        # --- Fin bloque de búsqueda ---

    # 1. Crear la carpeta en Google Drive para el nuevo equipo.
    new_drive_folder_id_equipo = None
    try:
        folder_metadata_drive = {
            'name': equipo_nombre_para_carpeta_drive,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [final_parent_drive_folder_id_for_equipo] # Carpeta del servicio.
        }
        print(f"DEBUG (api/registrar_equipo_completo): Creando carpeta Drive '{equipo_nombre_para_carpeta_drive}' dentro de '{final_parent_drive_folder_id_for_equipo}'...")
        created_folder_drive = drive_service.files().create(body=folder_metadata_drive, fields='id, name').execute()
        new_drive_folder_id_equipo = created_folder_drive.get('id')
        print(f"DEBUG: Carpeta Drive para equipo creada: ID={new_drive_folder_id_equipo}, Nombre={created_folder_drive.get('name')}")
    except HttpError as he:
        # ... (manejo de HttpError similar a upload_pdf_to_drive_api) ...
        print(f"HttpError al crear carpeta Drive para equipo: {he}")
        return jsonify({'success': False, 'error': f"Error de API ({he.resp.status}) al crear carpeta en Drive: {he._get_reason()}"}), getattr(he.resp, 'status', 500)

    except Exception as e:
        print(f"Error inesperado al crear carpeta Drive para equipo: {e}")
        return jsonify({'success': False, 'error': 'Error inesperado al crear la carpeta del equipo en Drive.'}), 500

    if not new_drive_folder_id_equipo: # Si la creación falló y no lanzó excepción (poco probable).
        return jsonify({'success': False, 'error': 'Falló la creación de la carpeta en Drive por una razón desconocida.'}), 500

    # 2. Guardar los detalles del equipo en equipos.json.
    json_file_path = EQUIPOS_JSON_PATH # Usar la constante global.
    try:
        current_json_data_all_equipos = load_equipos_json(json_file_path) # Carga segura.
        # Asegurar que la clave del servicio exista.
        current_json_data_all_equipos.setdefault(service_key_for_json, {})
        # Guardar los detalles del equipo (que ya incluyen la dependencia).
        current_json_data_all_equipos[service_key_for_json][new_drive_folder_id_equipo] = equipo_details_to_save

        with open(json_file_path, 'w', encoding='utf-8') as f:
            json.dump(current_json_data_all_equipos, f, ensure_ascii=False, indent=4)
        print(f"DEBUG: Datos guardados en {json_file_path} para equipo ID {new_drive_folder_id_equipo} bajo servicio '{service_key_for_json}'. Detalles: {equipo_details_to_save}")

    except IOError as e:
        print(f"IOError al guardar en {json_file_path}: {e}")
        # ROLLBACK: Si falla el guardado en JSON, se podría intentar eliminar la carpeta de Drive recién creada.
        # Esta lógica de rollback puede ser compleja. Por ahora, solo se informa el error.
        # try:
        #     drive_service.files().delete(fileId=new_drive_folder_id_equipo).execute()
        #     print(f"ROLLBACK: Carpeta Drive {new_drive_folder_id_equipo} eliminada debido a fallo en guardado JSON.")
        # except Exception as rb_err:
        #     print(f"ERROR en ROLLBACK: No se pudo eliminar carpeta Drive {new_drive_folder_id_equipo}: {rb_err}")
        return jsonify({'success': False, 'error': f'Carpeta creada en Drive (ID: {new_drive_folder_id_equipo}), pero falló el guardado en JSON local: {e}'}), 500
    except Exception as e:
        print(f"Error inesperado al guardar en {json_file_path}: {e}")
        return jsonify({'success': False, 'error': f'Carpeta creada en Drive (ID: {new_drive_folder_id_equipo}), pero ocurrió un error inesperado al guardar en JSON local: {type(e).__name__}'}), 500

    # La cookie se actualiza en `after_request`.
    return jsonify({
        'success': True,
        'message': f'Equipo "{equipo_details_to_save.get("nombre")}" registrado y carpeta creada en Drive.',
        'new_drive_folder_id': new_drive_folder_id_equipo,
        'equipo_details_saved': equipo_details_to_save,
        'service_key_for_json': service_key_for_json
    }), 201 # 201 Created.

@app.route('/delete_equipo', methods=['POST'])
def delete_equipo_api():
    """
    API endpoint para eliminar un equipo:
    1. Mueve la carpeta del equipo a la papelera en Google Drive.
    2. Elimina la entrada del equipo del archivo JSON local.
    Requiere autenticación de Drive.
    """
    service = get_drive_service()
    if not service:
        print("DEBUG (delete_equipo): No autorizado o sesión Drive inválida.")
        return jsonify({'success': False, 'error': 'No autorizado o sesión de Drive inválida. Por favor, re-autentíquese.'}), 401

    data = request.get_json() or request.form
    # El ID de la carpeta del equipo a eliminar en Drive (también es la clave en el JSON).
    folder_id_equipo_to_delete = data.get('folderId') or data.get('fileId') # Aceptar 'fileId' por consistencia con delete_file.

    if not folder_id_equipo_to_delete:
        return jsonify({'success': False, 'error': 'Falta el ID del equipo (carpeta) a eliminar (campo "folderId" o "fileId").'}), 400

    print(f"DEBUG (delete_equipo): Intentando eliminar equipo con Folder ID (Drive/JSON): '{folder_id_equipo_to_delete}'")

    # 1. Mover carpeta a la papelera en Google Drive.
    try:
        # Para mover a la papelera, se actualiza el atributo 'trashed'.
        service.files().update(
            fileId=folder_id_equipo_to_delete,
            body={'trashed': True} # Marcar como en la papelera.
        ).execute()
        print(f"DEBUG: Carpeta del equipo {folder_id_equipo_to_delete} movida a la papelera de Drive.")
    except HttpError as he:
        # ... (manejo de HttpError similar a delete_file_from_drive_api, adaptando mensajes para "equipo (carpeta)") ...
        status_code = he.resp.status
        error_message_api = json.loads(he.content.decode()).get('error', {}).get('message', 'Error de API desconocido.')
        user_message = f"Error de Google Drive ({status_code}) al intentar mover la carpeta del equipo a la papelera: {error_message_api}"
        if status_code == 404:
            user_message = f"El equipo (carpeta con ID {folder_id_equipo_to_delete}) no fue encontrado en Google Drive."
        elif status_code == 403:
             user_message = f"No tienes permiso para eliminar este equipo (carpeta con ID {folder_id_equipo_to_delete}) de Google Drive."

        print(f"ERROR HttpError ({status_code}) eliminando equipo (carpeta) {folder_id_equipo_to_delete} de Drive: {he}")
        return jsonify({'success': False, 'error': user_message}), status_code
    except google.auth.exceptions.RefreshError as re:
        print(f"ERROR CRÍTICO (delete_equipo): Falló el REFRESH del token: {re}")
        return jsonify({'success': False, 'error': 'Su sesión de Drive ha expirado o es inválida. Por favor, re-autentíquese.'}), 401
    except Exception as e:
        print(f"ERROR inesperado eliminando equipo (carpeta) {folder_id_equipo_to_delete} de Drive: {e}")
        return jsonify({'success': False, 'error': f'Ocurrió un error inesperado al eliminar el equipo de Drive: {type(e).__name__}'}), 500

    # 2. Eliminar la entrada del equipo del archivo JSON local.
    json_file_path = EQUIPOS_JSON_PATH
    try:
        current_json_data_all_equipos = load_equipos_json(json_file_path)
        if not isinstance(current_json_data_all_equipos, dict): # Debería ser dict por load_equipos_json.
            current_json_data_all_equipos = {}

        equipo_found_in_json_and_deleted = False
        # Iterar para encontrar y eliminar la entrada del equipo.
        for service_key, equipos_in_service_dict in current_json_data_all_equipos.items():
            if isinstance(equipos_in_service_dict, dict) and folder_id_equipo_to_delete in equipos_in_service_dict:
                del current_json_data_all_equipos[service_key][folder_id_equipo_to_delete]
                equipo_found_in_json_and_deleted = True
                # Opcional: si el service_key queda vacío después de eliminar, también eliminarlo.
                # if not current_json_data_all_equipos[service_key]:
                #     del current_json_data_all_equipos[service_key]
                break # Asumimos que el folder_id es único globalmente como clave de equipo.

        if equipo_found_in_json_and_deleted:
            # Guardar cambios en el archivo JSON.
            # Usar escritura atómica (escribir a temporal y luego reemplazar).
            temp_json_path = json_file_path + '.temp'
            with open(temp_json_path, 'w', encoding='utf-8') as f:
                json.dump(current_json_data_all_equipos, f, ensure_ascii=False, indent=4)
            os.replace(temp_json_path, json_file_path) # Movida atómica.
            print(f"DEBUG: Entrada del equipo {folder_id_equipo_to_delete} eliminada del JSON local.")
        else:
            # La carpeta se eliminó de Drive, pero no se encontró en el JSON.
            # Esto podría ser una inconsistencia, pero no necesariamente un error fatal para esta operación.
            print(f"ADVERTENCIA: Equipo (carpeta) {folder_id_equipo_to_delete} eliminado de Drive, pero no se encontró su entrada en el JSON local.")

    except (IOError, json.JSONDecodeError) as e: # Errores al manipular el JSON.
        print(f"ERROR al actualizar JSON después de eliminar equipo {folder_id_equipo_to_delete} de Drive: {e}")
        # La carpeta en Drive SÍ fue eliminada (o movida a papelera).
        # Devolver éxito parcial o un error que indique esto.
        return jsonify({
            'success': False, # O True con una advertencia.
            'error': f'Equipo eliminado de Drive, pero falló la actualización del registro local: {e}'
        }), 500 # Error del servidor.
    except Exception as e: # Otros errores inesperados.
        print(f"ERROR inesperado actualizando JSON para equipo {folder_id_equipo_to_delete}: {e}")
        return jsonify({
            'success': False,
            'error': f'Equipo eliminado de Drive, pero ocurrió un error inesperado actualizando el registro local: {type(e).__name__}'
        }), 500

    # La cookie se actualiza en `after_request`.
    return jsonify({'success': True, 'message': 'Equipo enviado a la papelera en Drive y eliminado del registro local.'}), 200


# -----------------------------------------------------------------------------
# Bloque Principal de Ejecución
# -----------------------------------------------------------------------------

if __name__ == '__main__':
    
    app.run(host='0.0.0.0', debug=True)
    