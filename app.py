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

from flask import request
from werkzeug.middleware.proxy_fix import ProxyFix


# -----------------------------------------------------------------------------
# Configuración de la Aplicación Flask
# -----------------------------------------------------------------------------

app = Flask(__name__)

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Clave secreta para la sesión de Flask.
# ¡IMPORTANTE! En producción, establecer una FLASK_SECRET_KEY segura como variable de entorno.
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(24))

# Clave para encriptar/desencriptar las credenciales en la cookie.
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

CREDENTIALS_COOKIE = 'google_drive_credentials' # Nombre de la cookie para credenciales de Drive
CLIENT_SECRETS_FILE = "credenciales.json"      # Archivo de secretos del cliente OAuth 2.0 de Google
SCOPES = ['https://www.googleapis.com/auth/drive'] # Alcance de permisos para Google Drive
#EQUIPOS_JSON_PATH = 'static/data/equipos.json'     # Ruta al archivo JSON que almacena datos de equipos

# IDs de las carpetas raíz en Google Drive, estructurados por empresa y luego entidad.
# Ejemplo: ROOT_FOLDER_IDS['MV']['sagrado_corazon']
ROOT_FOLDER_IDS = {
    'MV': { # Nombre de la empresa o agrupación
        'sagrado_corazon': '1gW5zdALTdelgMIrd9T85ZY9D1raMClLI', # Entidad: ID de la carpeta
        'palmitos': '1oMWAdDcpZfPN-Y4Q2M8-0u9_3INOOR28',
        'vascular': '1APlTY38p411zlUrUIQGpicJYtqwaOhET',

       
    },
    'Simbiosas': { # Otra empresa o agrupación
        'ayapel': '1qB1H3PJ8luryntO7lRzD1lS50xXy0Msb', # Reemplazar con IDs reales
        
    }
}

# Mapeo directo de 'entidad' (usado en la URL) al ID de su carpeta en Google Drive.
# Este diccionario podría derivarse de ROOT_FOLDER_IDS si la lógica lo permite,
# o mantenerse separado si las 'entidades' de la URL no coinciden directamente con la estructura de ROOT_FOLDER_IDS.
ENTIDADES_FOLDER_IDS = {
    'sagrado_corazon': ROOT_FOLDER_IDS['MV']['sagrado_corazon'],
    'palmitos': ROOT_FOLDER_IDS['MV']['palmitos'],
    'vascular': ROOT_FOLDER_IDS['MV']['vascular'],
    'ayapel': ROOT_FOLDER_IDS['Simbiosas']['ayapel'],
}
DATOS_CLIENTE_POR_ENTIDAD = {

    'sagrado_corazon': {
        'nombre_cliente': 'ESE SAGRADO CORAZÓN DE JESUS',
        'direccion_cliente': 'Calle 12 No. 8-99 B/Nazareth, Valencia, Colombia',
        'ciudad_cliente': 'VALENCIA'
    },

    'vascular': {
        'nombre_cliente': 'UNIDAD MEDICA VASCULAR', # Ejemplo
        'direccion_cliente': 'CALLE 26 # 6 – 36', # Ejemplo
        'ciudad_cliente': 'Montería' # Ejemplo
    },

    'palmitos': {
        'nombre_cliente': 'ESE CENTRO DE SALUD DE LOS PALMITOS', # Ejemplo
        'direccion_cliente': 'CRA 11 # 02 -12 Los Palmitos, Sucre', # Ejemplo
        'ciudad_cliente': 'LOS PALMITOS, SUCRE' # Ejemplo
    },
    
    'ayapel': {
        'nombre_cliente': 'ESE HOSPITAL SAN JORGE DE AYAPEL', # Ejemplo
        'direccion_cliente': 'Calle Principal, Ayapel, Córdoba', # Ejemplo
        'ciudad_cliente': 'AYAPEL' # Ejemplo
    }
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

def load_equipos_json(entidad_nombre):
    """
    Carga los datos de equipos desde un archivo JSON específico para la entidad.
    Maneja la creación del directorio y archivo si no existen.
    """
    if not entidad_nombre:
        print("ERROR CRÍTICO (load_equipos_json): Nombre de entidad no proporcionado.")
        return {} # O lanzar una excepción

    # Construir la ruta del archivo JSON dinámicamente
    json_filename = f"equipos_{entidad_nombre.lower().replace(' ', '_')}.json" # ej: equipos_sagrado_corazon.json
    json_path = os.path.join('static', 'data', json_filename) # Asumiendo que 'static/data/' es tu directorio

    print(f"DEBUG (load_equipos_json): Intentando cargar JSON desde: {json_path}")

    json_dir = os.path.dirname(json_path)
    if not os.path.exists(json_dir):
        try:
            os.makedirs(json_dir)
            print(f"INFO: Directorio creado: {json_dir}")
        except OSError as e:
            print(f"ERROR: No se pudo crear el directorio {json_dir}: {e}")
            return {}

    if not os.path.exists(json_path):
        print(f"ADVERTENCIA: Archivo JSON no encontrado en {json_path} para la entidad '{entidad_nombre}'. Creando uno vacío.")
        try:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump({}, f) 
            return {}
        except IOError as e:
            print(f"ERROR: No se pudo crear el archivo JSON vacío en {json_path}: {e}")
            return {}

    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            if not content:
                print(f"ADVERTENCIA: Archivo JSON vacío en {json_path}. Devolviendo diccionario vacío.")
                return {}
            datos = json.loads(content)
            if not isinstance(datos, dict):
                print(f"ADVERTENCIA: El archivo JSON {json_path} no contiene un objeto JSON raíz. Devolviendo diccionario vacío.")
                return {}
            return datos
    except json.JSONDecodeError as e:
        print(f"ERROR al parsear {json_path}: {e}. Devolviendo diccionario vacío.")
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

@app.route('/select-entidad-mv', methods=['GET']) # RUTA ESPECÍFICA PARA MV
def select_entidad_pagina_mv():
    """
    Muestra la página para seleccionar la entidad para la empresa MV.
    Requiere que el usuario interno esté logueado.
    """
    if not session.get('logged_in'):
        print("DEBUG (ruta /select-entidad-mv): Usuario no logueado, redirigiendo a /login.")
        return redirect(url_for('inicio_sesion_pagina'))

    username = session.get('username', 'Usuario Desconocido')
    nombre_completo = session.get('nombre_completo', username)


    # Pasamos el diccionario completo de entidades de MV
    entidades_para_mostrar = ROOT_FOLDER_IDS.get('MV', {})

    # Puedes pasar aquí las entidades específicas de MV si las necesitas en el template
    # entidades_mv = ROOT_FOLDER_IDS.get('MV', {})
    print(f"DEBUG (ruta /select-entidad-mv): Acceso para '{username}' en MV.")
    # render_template('select-entidad.html' podría ser una plantilla genérica
    # o una específica como 'select-entidad-mv.html' si la UI es distinta.
    # Si es la misma, necesitarás enviar la `empresa_seleccionada` para filtrar.
    return render_template(
        'select-entidad-mv.html',
        username=nombre_completo,
        empresa_seleccionada='MV'
        # Puedes pasar las entidades específicas si las quieres renderizar de forma diferente.
        # entidades_disponibles=list(ROOT_FOLDER_IDS['MV'].keys())
    )


@app.route('/select-entidad-symbiosas', methods=['GET']) # RUTA ESPECÍFICA PARA SYMBIOSAS
def select_entidad_pagina_symbiosas():
    """
    Muestra la página para seleccionar la entidad para la empresa SYMBIOSAS.
    Requiere que el usuario interno esté logueado.
    """
    if not session.get('logged_in'):
        print("DEBUG (ruta /select-entidad-symbiosas): Usuario no logueado, redirigiendo a /login.")
        return redirect(url_for('inicio_sesion_pagina'))

    username = session.get('username', 'Usuario Desconocido')
    nombre_completo = session.get('nombre_completo', username)


    # Pasamos el diccionario completo de entidades de Symbiosas
    entidades_para_mostrar = ROOT_FOLDER_IDS.get('Simbiosas', {})

    # Aquí es donde pasarías los IDs de las carpetas de Symbiosas.
    # La lógica en el frontend (select-entidad.html y su JS)
    # necesitará saber que está en el contexto de Symbiosas para usar los IDs correctos.
    print(f"DEBUG (ruta /select-entidad-symbiosas): Acceso para '{username}' en SYMBIOSAS.")
    return render_template(
        'select-entidad-symbiosas.html', # Podría ser la misma plantilla si el JS maneja el ID
        username=nombre_completo,
        empresa_seleccionada='Simbiosas'
        # entidades_disponibles=list(ROOT_FOLDER_IDS['Simbiosas'].keys()) # Si las pasas para renderizar
    )

#Servicios 
@app.route('/Conet_Drive', methods=['GET'])
def servicios_drive():
    """
    Muestra los servicios (carpetas principales) de Drive para una entidad específica.
    Requiere autenticación de Google Drive y renderiza un HTML diferente por empresa.
    """
    if not session.get('logged_in'):
        print("DEBUG (ruta /Conet_Drive): Usuario interno no logueado. Redirigiendo a /login.")
        return redirect(url_for('inicio_sesion_pagina'))

    entidad_seleccionada = request.args.get('entidad')
    if not entidad_seleccionada or entidad_seleccionada not in ENTIDADES_FOLDER_IDS:
        print(f"ERROR (ruta /Conet_Drive): Entidad '{entidad_seleccionada}' no válida o no especificada.")
        abort(400, description="Entidad no válida o no especificada.")

    # ---  Determinar la empresa y la plantilla a renderizar ---
    empresa_de_entidad = None
    for empresa, entidades_data in ROOT_FOLDER_IDS.items():
        if entidad_seleccionada in entidades_data:
            empresa_de_entidad = empresa
            break
    
    if empresa_de_entidad == 'MV':
        plantilla_a_renderizar = 'servicios_mv.html'
        print(f"DEBUG (ruta /Conet_Drive): Entidad '{entidad_seleccionada}' pertenece a MV. Usando plantilla '{plantilla_a_renderizar}'.")
    elif empresa_de_entidad == 'Simbiosas':
        plantilla_a_renderizar = 'servicios_symbiosas.html'
        print(f"DEBUG (ruta /Conet_Drive): Entidad '{entidad_seleccionada}' pertenece a Simbiosas. Usando plantilla '{plantilla_a_renderizar}'.")
    else:
        print(f"ERROR (ruta /Conet_Drive): No se pudo determinar la empresa para la entidad '{entidad_seleccionada}'.")
        abort(500, description="Error interno: Empresa de la entidad no definida.")
    # --- FIN DE LA NUEVA LÓGICA ---

    folder_id_raiz_entidad = ENTIDADES_FOLDER_IDS[entidad_seleccionada]
    print(f"DEBUG (ruta /Conet_Drive): Intentando acceder a entidad '{entidad_seleccionada}', Folder ID: {folder_id_raiz_entidad}")

    # 1. Obtener el servicio de Google Drive UNA SOLA VEZ
    service = get_drive_service()

    # 2. Si no hay servicio (requiere autenticación con Drive)
    if not service:
        print("DEBUG (ruta /Conet_Drive): Servicio Drive no disponible. Redirigiendo a /authorize.")
        
        # Guardar la URL completa a la que el usuario intentaba acceder. Es más robusto.
        session['target_url_after_auth'] = url_for('servicios_drive', entidad=entidad_seleccionada, _external=True)
        response = make_response(redirect(url_for('authorize_google_drive')))
        response.delete_cookie(CREDENTIALS_COOKIE)
        session.pop('state', None)
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
        else:
            nombre_carpeta_obtenido_de_drive = f"Error al cargar nombre de '{entidad_seleccionada}'"
    except Exception as e:
        print(f"ERROR inesperado obteniendo nombre de carpeta {folder_id_raiz_entidad}: {e}")
        nombre_carpeta_obtenido_de_drive = "Error al cargar nombre de la entidad"

    # 4. Listar carpetas (servicios) dentro de la carpeta raíz de la entidad.
    mime_condition_carpetas = "mimeType = 'application/vnd.google-apps.folder'"
    carpetas_servicios = listar_archivos(service, folder_id_raiz_entidad, mime_condition_carpetas)

  

    # 5. Renderizar la plantilla determinada.
    return render_template(
        plantilla_a_renderizar, # << CAMBIO CLAVE AQUÍ >> Usamos la variable de la plantilla
        folders=carpetas_servicios,
        entidad=entidad_seleccionada,
        nombre_de_ese=nombre_carpeta_obtenido_de_drive,
        # También puedes pasar la empresa a la plantilla si la necesitas allí
        empresa_actual=empresa_de_entidad, 
        entidad_raiz_json=entidad_seleccionada
    )

#Ver equipos (carpetas y archivos) en una carpeta específica de Drive
@app.route('/carpeta/<folder_id>')
def ver_equipos(folder_id):


    # --- INICIO DE TU LÓGICA EXISTENTE ---
    if not session.get('logged_in'):
        return redirect(url_for('inicio_sesion_pagina'))

    service = get_drive_service()
    if not service:
        # ... (tu lógica de redirección a authorize_google_drive) ...
        # Es buena idea añadir el parámetro 'empresa' a la URL de redirección si lo tienes aquí
        # para que se conserve después de la autorización de Google.
        empresa_param_para_auth = request.args.get('empresa')
        target_url_after_auth = url_for('ver_equipos', folder_id=folder_id, empresa=empresa_param_para_auth, _external=True)
        session['target_url_after_auth'] = target_url_after_auth
        response = make_response(redirect(url_for('authorize_google_drive')))
        response.delete_cookie(CREDENTIALS_COOKIE)
        session.pop('state', None)
        return response


    try:
        folder_info = service.files().get(fileId=folder_id, fields="id, name").execute()
        nombre_carpeta_actual = folder_info.get('name', 'Carpeta Desconocida')
    except HttpError as e:
        # ... (tu manejo de HttpError) ...
        abort(500, "Error al obtener información de la carpeta desde Google Drive.")
    except Exception as e:
        # ... (tu manejo de Exception) ...
        abort(500, "Error inesperado al obtener información de la carpeta.")

    mime_condition_carpetas = "mimeType = 'application/vnd.google-apps.folder'"
    mime_condition_archivos = "mimeType != 'application/vnd.google-apps.folder'"

    subcarpetas = listar_archivos(service, folder_id, mime_condition_carpetas)
    archivos_en_carpeta = listar_archivos(service, folder_id, mime_condition_archivos)
    tiene_solo_archivos = not subcarpetas and archivos_en_carpeta
    # --- FIN DE TU LÓGICA EXISTENTE ---

    # ***** LA PARTE IMPORTANTE *****
    # 1. Obtener 'empresa_actual' de los parámetros de la URL:
    empresa_actual = request.args.get('empresa')  

    entidad_json_key = request.args.get('entidad_json_key') # Recibir la clave de entidad para JSON

    # 2. La variable 'entidad_actual' que ya usabas para JS (parece ser el nombre de la carpeta o entidad específica)
    entidad_para_js = nombre_carpeta_actual 
    print(f"DEBUG EN VER_EQUIPOS: folder_id='{folder_id}', empresa_actual='{empresa_actual}', entidad_json_key LEIDO DE URL='{entidad_json_key}'")

    # 3. Pasar AMBAS variables (empresa_actual y entidad_actual) a la plantilla:
    return render_template(
        'equipos.html', 
        carpetas=subcarpetas,
        archivos=archivos_en_carpeta,
        tiene_solo_archivos=tiene_solo_archivos,
        nombre_carpeta=nombre_carpeta_actual, # Este es el nombre de la carpeta que estás viendo
        folder_id=folder_id,
        entidad_actual=entidad_para_js,       # Lo usas para data-attributes y JS
        empresa_actual=empresa_actual,         # ¡ESTA ES LA NUEVA VARIABLE PARA EL TEMA!
        entidad_raiz_para_json=entidad_json_key #Para pasarlo al enlace de mantenimiento
    )

# -----------------------------------------------------------------------------
# Rutas de Gestión de Equipos (JSON y Drive)
# -----------------------------------------------------------------------------
@app.route('/Filtro-Equipos', methods=['GET']) # Tu ruta se llama 'filtro' en url_for
def filtro():
    # --- NUEVO: Obtener entidad y empresa de la URL ---
    entidad_actual_clave = request.args.get('entidad')
    empresa_actual = request.args.get('empresa')

    if not entidad_actual_clave:
        # Opción: Si no hay entidad, mostrar un error o redirigir a una página de selección.
        # Por ahora, vamos a abortar o podrías renderizar una plantilla diferente.
        abort(400, description="Debe especificar una entidad para filtrar.")
    
    if not empresa_actual:
        # Intentar deducir la empresa de la entidad si es posible, o establecer un default/error
        # Esta lógica de deducción dependerá de tu estructura de datos (ej. ROOT_FOLDER_IDS)
        # Por simplicidad, asumiremos que 'empresa' siempre se pasa o hay un default.
        # Si no se pasa, el theming podría usar 'mv' por defecto en el HTML.
        # O podrías hacer esto:
        # empresa_actual = 'mv' # O la lógica para encontrarla a partir de entidad_actual_clave
        print(f"ADVERTENCIA: Parámetro 'empresa' no recibido para la página de filtro de entidad '{entidad_actual_clave}'. El tema podría no aplicarse correctamente.")


    # --- NUEVO: Cargar datos del cliente para el título de la página ---
    datos_cliente = DATOS_CLIENTE_POR_ENTIDAD.get(entidad_actual_clave.lower(), {})
    nombre_display_entidad = datos_cliente.get('nombre_cliente', entidad_actual_clave.replace('_', ' ').title())

    # --- MODIFICADO: Cargar JSON específico de la entidad ---
    # Usamos la función load_equipos_json que ahora acepta entidad_nombre
    equipos_de_la_entidad = load_equipos_json(entidad_actual_clave) 
    
    if not equipos_de_la_entidad:
        print(f"ADVERTENCIA (/Filtro-Equipos): No se cargaron datos para la entidad '{entidad_actual_clave}' o el archivo está vacío/corrupto.")

    # Aplanar los datos de la entidad actual (similar a como lo hacías antes pero solo para una entidad)
    all_items_flat = []
    for service_label, items_in_service_dict in equipos_de_la_entidad.items():
        if isinstance(items_in_service_dict, dict):
            for drive_item_id, equipo_details_dict in items_in_service_dict.items():
                if isinstance(equipo_details_dict, dict):
                    item_for_filter = equipo_details_dict.copy()
                    item_for_filter['drive_id'] = drive_item_id
                    item_for_filter['service_label'] = service_label
                    item_for_filter['display_name'] = equipo_details_dict.get('nombre', f'Equipo ID: {drive_item_id[:6]}...')
                    all_items_flat.append(item_for_filter)
    
    total_equipos_count = len(all_items_flat)

    # Lógica de filtrado (se mantiene igual, pero opera sobre all_items_flat de la entidad actual)
    filter_nombre = request.args.get('nombre', '').strip().lower()
    filter_marca_modelo = request.args.get('marca_modelo', '').strip().lower()
    filter_service_label_json = request.args.get('service_label', '').strip().lower()
    filter_serie = request.args.get('serie', '').strip().lower()

    current_filters_for_template = {
        'nombre': request.args.get('nombre', ''),
        'marca_modelo': request.args.get('marca_modelo', ''),
        'service_label': request.args.get('service_label', ''),
        'serie': request.args.get('serie', '')
    }

    filtered_items = []
    filters_are_active = any([filter_nombre, filter_marca_modelo, filter_service_label_json, filter_serie])

    if filters_are_active:
        for item in all_items_flat:
            match = True
            if filter_nombre and filter_nombre not in str(item.get('nombre', '')).lower():
                match = False
            if match and filter_marca_modelo and filter_marca_modelo not in str(item.get('marca_modelo', '')).lower():
                match = False
            if match and filter_service_label_json and filter_service_label_json not in str(item.get('service_label', '')).lower():
                match = False
            if match and filter_serie and filter_serie not in str(item.get('serie', '')).lower():
                match = False
            if match:
                filtered_items.append(item)
    else:
        filtered_items = all_items_flat

    filtered_equipos_count = len(filtered_items)
    filtered_items_sorted = sorted(filtered_items, key=lambda item: item.get('display_name', '').lower())

    return render_template(
        'filtro.html',
        equipos=filtered_items_sorted,
        total_equipos_count=total_equipos_count,
        filtered_equipos_count=filtered_equipos_count,
        current_filters=current_filters_for_template,
        empresa_actual=empresa_actual,  # Para theming (favicon, logo, body class)
        entidad_actual_nombre=entidad_actual_clave, # Para el título y para pasarlo al form action
        nombre_display_entidad=nombre_display_entidad # Nombre legible de la entidad para el header
    )


@app.route('/formato_mantenimiento')
def formato_mantenimiento():
    """
    Muestra un formato de mantenimiento en blanco.
    Requiere autenticación de Drive (para asegurar consistencia en el flujo de usuario).
    """
    if not session.get('logged_in'):
        return redirect(url_for('inicio_sesion_pagina'))
    
    # Obtener el parámetro 'empresa' de la URL
    empresa_actual = request.args.get('empresa') 
    service = get_drive_service()
    if not service:
        print("DEBUG (ruta /formato_mantenimiento): No hay servicio Drive. Redirigiendo a /authorize.")
        
        # --- MODIFICACIÓN PARA CONSERVAR 'empresa' TRAS AUTORIZACIÓN ---
        # Guardar la URL completa a la que el usuario intentaba acceder, incluyendo 'empresa'
        target_url_with_params = url_for('formato_mantenimiento', empresa=empresa_actual, _external=True)
        session['target_url_after_auth'] = target_url_with_params
        # --- FIN MODIFICACIÓN ---
        
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
        nombre_responsable=nombre_responsable_session,
        empresa_actual=empresa_actual
    )



#Mantenimiento de Equipos (Formulario y JSON)
@app.route('/Mantenimiento/<folder_id>', methods=['GET', 'POST'])
def mantenimiento(folder_id):
    if not session.get('logged_in'):
        return redirect(url_for('inicio_sesion_pagina'))

    # --- NUEVO: Obtener la entidad propietaria del JSON ---
    entidad_json_clave = request.args.get('entidad_json') # ej: 'sagrado_corazon', 'ayapel'
    if not entidad_json_clave:
        print(f"ERROR (ruta /Mantenimiento/{folder_id}): Falta el parámetro 'entidad_json' en la URL.")
        abort(400, description="Falta la clave de entidad para el archivo JSON.")
    # --- FIN NUEVO ---

    service = get_drive_service()
    if not service:
        # ... (tu lógica de redirección a authorize, considera pasar entidad_json_clave también) ...
        target_url_with_params = url_for('mantenimiento', folder_id=folder_id, entidad_json=entidad_json_clave, _external=True) # MODIFICADO
        session['target_url_after_auth'] = target_url_with_params
        response = make_response(redirect(url_for('authorize_google_drive')))
        return response

    # --- MODIFICADO: Cargar JSON específico de la entidad ---
    # La función ahora espera el nombre de la entidad para construir la ruta del archivo.
    datos_json_entidad_especifica = load_equipos_json(entidad_json_clave)
    # --- FIN MODIFICADO ---

    equipo_encontrado_dict = None
    servicio_del_equipo_json_key = None # La clave de "servicio" dentro del JSON de la entidad
    
    # Buscar el equipo dentro del JSON de la entidad específica
    for servicio_key, items_en_servicio_dict in datos_json_entidad_especifica.items():
        if isinstance(items_en_servicio_dict, dict) and folder_id in items_en_servicio_dict:
            equipo_encontrado_dict = items_en_servicio_dict[folder_id]
            servicio_del_equipo_json_key = servicio_key
            break

    if equipo_encontrado_dict is None:
        print(f"ADVERTENCIA (/Mantenimiento): Equipo ID {folder_id} no encontrado en JSON de entidad '{entidad_json_clave}'.")
        equipo_encontrado_dict = {
            "nombre": "Equipo Nuevo (No Registrado en JSON)",
            "dependencia": "", "marca_modelo": "", "serie": "", "ubicacion": ""
        }
        print(f"DEBUG (/Mantenimiento): Se usará plantilla de equipo nuevo para {folder_id} en JSON de entidad '{entidad_json_clave}'.")

    if request.method == 'POST':
        if servicio_del_equipo_json_key is None:
            servicio_del_equipo_json_key = request.form.get('service_key_for_json', "Sin Servicio Registrado")
            if servicio_del_equipo_json_key not in datos_json_entidad_especifica:
                datos_json_entidad_especifica[servicio_del_equipo_json_key] = {}
            datos_json_entidad_especifica[servicio_del_equipo_json_key].setdefault(folder_id, {})
        
        try:
            target_equipo_dict_in_json = datos_json_entidad_especifica[servicio_del_equipo_json_key][folder_id]
            # ... (tu lógica para actualizar target_equipo_dict_in_json con request.form.get) ...
            target_equipo_dict_in_json['nombre'] = request.form.get('nombre', target_equipo_dict_in_json.get('nombre'))
            target_equipo_dict_in_json['dependencia'] = request.form.get('dependencia', target_equipo_dict_in_json.get('dependencia'))
            target_equipo_dict_in_json['marca_modelo'] = request.form.get('marca_modelo', target_equipo_dict_in_json.get('marca_modelo'))
            target_equipo_dict_in_json['serie'] = request.form.get('serie', target_equipo_dict_in_json.get('serie'))
            target_equipo_dict_in_json['ubicacion'] = request.form.get('ubicacion', target_equipo_dict_in_json.get('ubicacion'))


            # --- MODIFICADO: Guardar en el JSON específico de la entidad ---
            json_filename_to_save = f"equipos_{entidad_json_clave.lower().replace(' ', '_')}.json"
            json_path_to_save = os.path.join('static', 'data', json_filename_to_save)
            
            with open(json_path_to_save, 'w', encoding='utf-8') as f:
                json.dump(datos_json_entidad_especifica, f, ensure_ascii=False, indent=4)
            print(f"DEBUG (POST /Mantenimiento): Datos JSON actualizados y GUARDADOS para {folder_id} en {json_path_to_save}")
            # --- FIN MODIFICADO ---

            # MODIFICADO: Pasar entidad_json_clave en la redirección
            return redirect(url_for('mantenimiento', folder_id=folder_id, entidad_json=entidad_json_clave)) 
        except Exception as e:
            # ... (tu manejo de errores, asegúrate de pasar entidad_json_clave si renderizas de nuevo) ...
            print(f"Error inesperado procesando POST en /Mantenimiento para {folder_id}, entidad {entidad_json_clave}: {e}")
            # ... Renderizar de nuevo con error_message y entidad_json=entidad_json_clave ...


    # Para GET (mostrar formulario)
    # ... (tu lógica para firma, nombre_responsable) ...
    username_session = session.get('username', 'default').lower()
    nombre_responsable_session = session.get('nombre_completo', 'Usuario del Sistema')
    firma_filename = f'firma-{username_session}.jpg'
    firma_path_in_static = os.path.join('images', firma_filename)
    firma_absolute_path = os.path.join(app.static_folder, firma_path_in_static)
    firma_relativa_para_template = firma_path_in_static.replace(os.sep, '/') \
        if os.path.exists(firma_absolute_path) else 'images/firma-marlon.jpg'


    datos_del_cliente_especifico = DATOS_CLIENTE_POR_ENTIDAD.get(entidad_json_clave.lower(), {
        'nombre_cliente': 'Cliente no especificado',
        'direccion_cliente': 'Dirección no especificada',
        'ciudad_cliente': 'Ciudad no especificada'
    })

    empresa_actual_desde_url = request.args.get('empresa')
    return render_template(
        'mantenimiento.html',
        equipo=equipo_encontrado_dict, 
        folder_id=folder_id,
        firma=firma_relativa_para_template,
        nombre_responsable=nombre_responsable_session,
        entidad_json_actual=entidad_json_clave, # Para que la plantilla lo sepa si es necesario
        cliente_data=datos_del_cliente_especifico,
        empresa_actual=empresa_actual_desde_url
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
    2. Guarda los detalles del equipo en el JSON local específico de la entidad.
    """
    drive_service = get_drive_service()
    if not drive_service:
        return jsonify({'success': False, 'error': 'No autenticado o servicio Drive no disponible.'}), 401

    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'Petición inválida (no JSON).'}), 400

    # --- OBTENER DATOS DEL PAYLOAD ---
    entidad_json_clave = data.get('entidad_json_key') # Clave de la entidad para el archivo JSON
    service_key_for_json = data.get('service_key_for_json') # Nombre del servicio (para la estructura interna del JSON)
    parent_drive_folder_id_from_request = data.get('parent_drive_folder_id') # ID de la carpeta de servicio en Drive
    equipo_details_from_request = data.get('equipo_details')

    # --- VALIDACIONES ---
    if not entidad_json_clave:
        return jsonify({'success': False, 'error': "Falta la clave de entidad (entidad_json_key) para el registro."}), 400
    if not service_key_for_json or not equipo_details_from_request or not equipo_details_from_request.get('nombre'):
        return jsonify({'success': False, 'error': "Faltan datos: 'service_key_for_json' o 'equipo_details' (con 'nombre') son requeridos."}), 400
    if not parent_drive_folder_id_from_request:
         print(f"ADVERTENCIA (api/registrar_equipo_completo): No se proporcionó 'parent_drive_folder_id'. La carpeta en Drive podría no crearse en el lugar esperado o fallar.")
         # Considera si esto debe ser un error fatal:
         # return jsonify({'success': False, 'error': "Falta el ID de la carpeta de servicio en Drive para crear el equipo."}), 400


    equipo_details_to_save = equipo_details_from_request.copy()
    equipo_details_to_save['dependencia'] = service_key_for_json # La dependencia es el nombre del servicio

    equipo_nombre_para_carpeta_drive = equipo_details_to_save.get('nombre', 'Equipo Sin Nombre').strip()
    
    # 1. Crear la carpeta en Google Drive
    new_drive_folder_id_equipo = None
    try:
        folder_metadata_drive = {
            'name': equipo_nombre_para_carpeta_drive,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_drive_folder_id_from_request] if parent_drive_folder_id_from_request else []
        }
        print(f"DEBUG (api/registrar_equipo_completo): Creando carpeta Drive '{equipo_nombre_para_carpeta_drive}' dentro de '{parent_drive_folder_id_from_request}' para entidad '{entidad_json_clave}'...")
        created_folder_drive = drive_service.files().create(body=folder_metadata_drive, fields='id, name').execute()
        new_drive_folder_id_equipo = created_folder_drive.get('id')
        if not new_drive_folder_id_equipo: # Doble chequeo
            raise Exception("La API de Drive no devolvió un ID para la carpeta creada.")
        print(f"DEBUG: Carpeta Drive para equipo creada: ID={new_drive_folder_id_equipo}, Nombre={created_folder_drive.get('name')}")
    except HttpError as he:
        print(f"HttpError al crear carpeta Drive para equipo: {he}")
        return jsonify({'success': False, 'error': f"Error de API ({he.resp.status}) al crear carpeta en Drive: {he._get_reason()}"}), getattr(he.resp, 'status', 500)
    except Exception as e:
        print(f"Error inesperado al crear carpeta Drive para equipo: {e}")
        return jsonify({'success': False, 'error': f'Error inesperado ({type(e).__name__}) al crear la carpeta del equipo en Drive.'}), 500

    # 2. Guardar los detalles del equipo en el JSON específico de la entidad.
    try:
        # Cargar el JSON de la entidad específica
        json_data_entidad_actual = load_equipos_json(entidad_json_clave) # Usa la función modificada
        
        json_data_entidad_actual.setdefault(service_key_for_json, {})
        json_data_entidad_actual[service_key_for_json][new_drive_folder_id_equipo] = equipo_details_to_save

        # Construir la ruta del archivo JSON para guardar
        json_filename_to_save = f"equipos_{entidad_json_clave.lower().replace(' ', '_')}.json"
        json_path_to_save = os.path.join('static', 'data', json_filename_to_save) # Asume 'static/data/'

        with open(json_path_to_save, 'w', encoding='utf-8') as f:
            json.dump(json_data_entidad_actual, f, ensure_ascii=False, indent=4)
        print(f"DEBUG: Datos guardados en {json_path_to_save} para equipo ID {new_drive_folder_id_equipo}")

    except Exception as e:
        print(f"Error al guardar en JSON para entidad '{entidad_json_clave}': {e}")
        # ROLLBACK: Si falla el guardado en JSON, intentar eliminar la carpeta de Drive recién creada.
        try:
            drive_service.files().delete(fileId=new_drive_folder_id_equipo).execute()
            print(f"ROLLBACK: Carpeta Drive {new_drive_folder_id_equipo} eliminada debido a fallo en guardado JSON.")
        except Exception as rb_err:
            print(f"ERROR en ROLLBACK de Drive: No se pudo eliminar carpeta Drive {new_drive_folder_id_equipo}: {rb_err}")
        return jsonify({'success': False, 'error': f'Carpeta creada en Drive, pero falló el guardado en JSON local para la entidad {entidad_json_clave}: {type(e).__name__}'}), 500

    return jsonify({
        'success': True,
        'message': f'Equipo "{equipo_details_to_save.get("nombre")}" registrado en entidad "{entidad_json_clave}" y carpeta creada en Drive.',
        'new_drive_folder_id': new_drive_folder_id_equipo,
        'equipo_details_saved': equipo_details_to_save
    }), 201


@app.route('/delete_equipo', methods=['POST'])
def delete_equipo_api():
    """
    API endpoint para eliminar un equipo:
    1. Mueve la carpeta del equipo a la papelera en Google Drive.
    2. Elimina la entrada del equipo del archivo JSON local específico de la entidad.
    """
    service = get_drive_service()
    if not service:
        return jsonify({'success': False, 'error': 'No autenticado o sesión Drive inválida.'}), 401

    data = request.get_json() or request.form
    folder_id_equipo_to_delete = data.get('folderId') or data.get('fileId')
    
    # --- NUEVO: Recibir la clave de la entidad para el JSON ---
    entidad_json_clave = data.get('entidad_json_key')
    # --- FIN NUEVO ---

    if not folder_id_equipo_to_delete:
        return jsonify({'success': False, 'error': 'Falta el ID del equipo (carpeta) a eliminar.'}), 400
    if not entidad_json_clave: # ¡Validación crucial!
        return jsonify({'success': False, 'error': "Falta la clave de entidad (entidad_json_key) para la eliminación."}), 400

    print(f"DEBUG (delete_equipo): Intentando eliminar equipo Folder ID: '{folder_id_equipo_to_delete}' de la entidad '{entidad_json_clave}'")

    # 1. Mover carpeta a la papelera en Google Drive.
    try:
        service.files().update(
            fileId=folder_id_equipo_to_delete,
            body={'trashed': True}
        ).execute()
        print(f"DEBUG: Carpeta del equipo {folder_id_equipo_to_delete} movida a la papelera de Drive.")
    except HttpError as he:
        # ... (tu manejo de HttpError se mantiene, es robusto) ...
        status_code = he.resp.status
        error_message_api = "Error de API desconocido."
        try:
            error_content = he.content.decode('utf-8')
            error_details = json.loads(error_content).get('error', {})
            error_message_api = error_details.get('message', f"Error de API de Drive no especificado (Status: {status_code}).")
        except: # Ignorar errores de parseo del contenido del error
            pass
        user_message = f"Error de Google Drive ({status_code}) al intentar mover la carpeta del equipo a la papelera: {error_message_api}"
        if status_code == 404: user_message = f"El equipo (carpeta ID {folder_id_equipo_to_delete}) no fue encontrado en Google Drive."
        elif status_code == 403: user_message = f"No tienes permiso para eliminar este equipo (carpeta ID {folder_id_equipo_to_delete}) de Google Drive."
        print(f"ERROR HttpError ({status_code}) eliminando equipo (carpeta) {folder_id_equipo_to_delete} de Drive: {he}")
        return jsonify({'success': False, 'error': user_message}), status_code
    except Exception as e: # Otros errores, incluyendo google.auth.exceptions.RefreshError
        print(f"ERROR inesperado/auth eliminando equipo (carpeta) {folder_id_equipo_to_delete} de Drive: {e}")
        if isinstance(e, google.auth.exceptions.RefreshError):
            return jsonify({'success': False, 'error': 'Su sesión de Drive ha expirado o es inválida. Por favor, re-autentíquese.'}), 401
        return jsonify({'success': False, 'error': f'Ocurrió un error inesperado al eliminar el equipo de Drive: {type(e).__name__}'}), 500

    # 2. Eliminar la entrada del equipo del archivo JSON local específico de la entidad.
    try:
        # Cargar el JSON de la entidad específica
        json_data_entidad_actual = load_equipos_json(entidad_json_clave)
        
        equipo_found_in_json_and_deleted = False
        for service_key, equipos_in_service_dict in list(json_data_entidad_actual.items()): # Usar list() para poder modificar el dict mientras se itera
            if isinstance(equipos_in_service_dict, dict) and folder_id_equipo_to_delete in equipos_in_service_dict:
                del json_data_entidad_actual[service_key][folder_id_equipo_to_delete]
                equipo_found_in_json_and_deleted = True
                # Opcional: si el service_key queda vacío después de eliminar, también eliminarlo.
                if not json_data_entidad_actual[service_key]:
                    del json_data_entidad_actual[service_key]
                break 

        if equipo_found_in_json_and_deleted:
            # Construir la ruta del archivo JSON para guardar
            json_filename_to_save = f"equipos_{entidad_json_clave.lower().replace(' ', '_')}.json"
            json_path_to_save = os.path.join('static', 'data', json_filename_to_save)
            
            # Usar escritura atómica (escribir a temporal y luego reemplazar).
            temp_json_path = json_path_to_save + '.temp'
            with open(temp_json_path, 'w', encoding='utf-8') as f:
                json.dump(json_data_entidad_actual, f, ensure_ascii=False, indent=4)
            os.replace(temp_json_path, json_path_to_save)
            print(f"DEBUG: Entrada del equipo {folder_id_equipo_to_delete} eliminada del JSON en {json_path_to_save}.")
        else:
            print(f"ADVERTENCIA: Equipo (carpeta) {folder_id_equipo_to_delete} eliminado de Drive, pero no se encontró su entrada en el JSON de la entidad '{entidad_json_clave}'.")

    except Exception as e:
        print(f"ERROR al actualizar JSON para entidad '{entidad_json_clave}' después de eliminar equipo {folder_id_equipo_to_delete} de Drive: {e}")
        return jsonify({
            'success': False, 
            'error': f'Equipo eliminado de Drive, pero falló la actualización del registro local para la entidad {entidad_json_clave}: {type(e).__name__}'
        }), 500

    return jsonify({'success': True, 'message': f'Equipo de entidad "{entidad_json_clave}" enviado a la papelera en Drive y eliminado del registro local.'}), 200



# -----------------------------------------------------------------------------
# Bloque Principal de Ejecución
# -----------------------------------------------------------------------------

if __name__ == '__main__':
    
    app.run(host='0.0.0.0', debug=True)
    