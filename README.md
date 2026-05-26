# Pagina para realizar mantenimientos

## Ejecutar en local

### 1. Crear el entorno virtual

```sh
python -m venv env
```

### 2. Activa el entrono virtual

- Linux y Mac

  ```sh
    source env/bin/activate
  ```

- Windows
  - cmd

  ```sh
  env\Scripts\activate.bat
  ```

  - Powershell

  ```sh
  env\Scripts\Activate.ps1
  ```

### 3. Instala las dependencias desde el archivo requirements.txt

```sh
pip install -r requirements.txt
```

### 4. Ejecutar el archivo `app.py`

```sh
python app.py
```

### Nota

Para desactivar el entorno virtual ejecuta `deactivate`
