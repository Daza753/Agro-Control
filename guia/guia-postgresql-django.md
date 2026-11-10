# Backend Django y PostgreSQL

La aplicación usa React/Vite/Electron como frontend, Django REST Framework como API y PostgreSQL como base de datos.

## Configurar el backend

Desde WSL, activa el entorno virtual y define las variables de conexión sin guardarlas en el repositorio:

```bash
cd /mnt/c/Users/exito/Downloads/agro/agro/project/backend
source "$HOME/.venvs/ganaderia-django/bin/activate"

export DB_NAME='Agro-control-Pro'
export DB_USER='admin'
export DB_HOST='172.18.50.255'
export DB_PORT='5432'
read -s -p 'Contraseña PostgreSQL: ' DB_PASSWORD
echo
export DB_PASSWORD

python manage.py check
python manage.py showmigrations
python manage.py runserver 0.0.0.0:8000
```

`backend/config/settings.py` usa esos valores de base por defecto para `DB_NAME`, `DB_USER`, `DB_HOST` y `DB_PORT`; puedes sobreescribirlos con variables de entorno. La contraseña se toma de `DB_PASSWORD`. En `read -s -p`, el texto entre comillas es solo el mensaje que aparece en pantalla; después de ejecutarlo, escribe la contraseña y pulsa Enter.

Las migraciones de este backend son las únicas que se deben aplicar para actualizar el esquema:

```bash
python manage.py migrate --plan
python manage.py migrate
```

Haz una copia de seguridad antes de aplicar migraciones en una base con datos reales. No uses `--fake` ni `--fake-initial` para ocultar errores de esquema.

La sincronización offline requiere las migraciones `finca.0005_sync_operation` y `finca.0006_activitysubmission`. La última conserva el historial de los datos de actividades creados, editados o eliminados por trabajadores para el informe del administrador. Revisa el plan y aplica las migraciones en la base real antes de distribuir la aplicación.

## Iniciar el frontend

En otra terminal WSL:

```bash
cd /mnt/c/Users/exito/Downloads/agro/agro/project
npm ci
npm run dev
```

El frontend usa `VITE_API_URL` para seleccionar la API; durante el desarrollo local, si no se configura, conecta a `http://127.0.0.1:8000`. Antes de crear un instalador o portable, configura `VITE_API_URL` con una dirección alcanzable desde todos los equipos que usarán el programa. No distribuyas un paquete que apunte a `localhost` o `127.0.0.1`: en cada equipo esas direcciones señalan al propio computador.

El empaquetado para Windows valida que `VITE_API_URL` esté configurada y rechaza direcciones loopback. Puedes definirla en el entorno de compilación o en `.env.production`. Usa HTTPS en producción. Para un equipo nuevo, el primer inicio de sesión requiere conexión al servicio, pero no una sesión previa en ese equipo.

## Preparar el backend en Render

FincaControl sigue siendo una aplicación de escritorio: Render aloja la API Django y PostgreSQL. El servicio web y la base de datos deben estar en la misma región; el servicio usa la URL interna de PostgreSQL.

1. Confirma que los cambios de esta guía, `backend/config/settings.py` y `backend/requirements.txt` estén en la rama de GitHub que conectarás a Render.
2. En Render, crea **New > Web Service**, conecta el repositorio y selecciona esa rama. Configura **Language: Python 3**, **Root Directory: `backend`** y la misma región de la base PostgreSQL.
3. Usa **Build Command** `pip install -r requirements.txt && python manage.py collectstatic --no-input`.
4. Usa **Start Command** `python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`.
5. En **Environment**, configura:
   - `DATABASE_URL`: URL **interna** de la base PostgreSQL de Render. Añádela desde la conexión de base de datos de Render; no la escribas en archivos versionados.
   - `DJANGO_SECRET_KEY`: valor aleatorio privado, distinto del secreto local.
   - `DJANGO_DEBUG`: `false`.
   - `CORS_ALLOWED_ORIGINS`: `null` para el cliente Electron empaquetado. No habilites orígenes generales.
   - `DJANGO_ALLOWED_HOSTS`: opcional; la configuración incorpora automáticamente el dominio asignado por Render mediante `RENDER_EXTERNAL_HOSTNAME`. Si lo defines, usa el host del servicio, no una URL completa.
6. Despliega el servicio y revisa los logs. La URL pública HTTPS del servicio será la dirección de la API. Configura `VITE_API_URL` con esa URL HTTPS al compilar el cliente Windows 2.1.2.

El servicio crea el esquema al iniciarse ejecutando las migraciones Django. Para pasar los registros PostgreSQL locales, primero respalda la base origen y verifica el archivo de respaldo; luego importa los datos a la base de Render de acuerdo con su versión de PostgreSQL. No pegues la URL de base de datos, contraseña ni clave Django en GitHub ni en el instalador.

Una PostgreSQL Free de Render es temporal y expira a los 30 días; su instancia web Free también puede detenerse por inactividad. Comprueba el plan y sus fechas en Render según el uso que decidas darle.

Instala dependencias en el mismo sistema operativo donde ejecutarás Node. WSL y Windows no deben compartir una instalación de `node_modules`, porque incluyen binarios nativos diferentes.

## Trabajo sin conexión

- Cada usuario debe iniciar sesión con internet en cada dispositivo al menos una vez. Mientras haya conexión, se descargan en ese navegador o equipo las copias de las fincas a las que tiene acceso.
- La aplicación puede mostrar esos datos y guardar cambios operativos pendientes sin conexión. Al recuperar internet, intenta sincronizarlos automáticamente; el indicador de la aplicación informa cambios pendientes, rechazos y conflictos.
- El módulo **Carga de datos** permite al trabajador guardar actividades aun sin conexión. El resto de la finca las verá cuando el dispositivo sincronice; el administrador consulta el historial por trabajador en **Reportes → Datos cargados por trabajadores**.
- El navegador solicita almacenamiento persistente y las escrituras de la cola local esperan confirmación de IndexedDB antes de reportarse guardadas. Esto está diseñado para conservar datos al cerrar/abrir la aplicación y tras reiniciar normalmente el equipo, pero ningún almacenamiento en un único dispositivo puede garantizar los datos ante fallo físico del disco, daño del sistema de archivos, borrado del perfil/datos del sitio, desinstalación o pérdida/robo del equipo. No limpies los datos del navegador ni desinstales Electron con cambios pendientes.
- Si el mismo registro fue modificado en el servidor y en el dispositivo offline, el sistema conserva ambas versiones para que el usuario resuelva el conflicto. No borres los datos locales pendientes antes de resolverlos.
- Crear o eliminar usuarios, cambiar contraseñas o permisos y eliminar fincas requiere conexión.
- En navegador, la primera carga debe realizarse online y la aplicación debe servirse desde `localhost` o HTTPS para almacenar el shell offline. Los datos se guardan en el almacenamiento local del navegador, no cifrados en reposo; usa dispositivos confiables y protegidos.
- Si el token expira mientras el dispositivo está desconectado, los cambios permanecen en la cola, pero será necesario iniciar sesión con internet antes de sincronizarlos.
- La aplicación Electron empaquetada usa el origen `null`; si defines `CORS_ALLOWED_ORIGINS` en el servidor, incluye `null` para permitir que Electron se conecte. Esto permite solicitudes desde otros documentos con origen opaco: mantén JWT, HTTPS en producción y no habilites CORS para `null` si no distribuyes Electron.

## Verificaciones

```bash
cd /mnt/c/Users/exito/Downloads/agro/agro/project/backend
python manage.py test --settings=config.test_settings
python manage.py makemigrations --check --dry-run --settings=config.test_settings
```

Para producción, configura secretos y hosts permitidos en el entorno de despliegue y sirve Django con un servidor WSGI/ASGI de producción, no con `runserver`.
