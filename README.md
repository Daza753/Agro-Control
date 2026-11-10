# Ganaderia

Sistema de gestión agrícola y ganadera para administrar fincas, usuarios, inventarios, procesos de producción y reportes.

El frontend está construido con React, Vite y Electron y consume la API REST de Django en `backend/`. Django administra autenticación, permisos y acceso a PostgreSQL. Los módulos principales son animales, leche, inventarios, sanidad, actividades, usuarios, reportes y configuración.

Consulta el [Manual de usuario de FincaControl](guia/manual-usuario.md) para conocer los requisitos, módulos, flujos de trabajo y uso offline.

Consulta [guia/guia-postgresql-django.md](guia/guia-postgresql-django.md) para configurar el backend y PostgreSQL. Las migraciones iniciales ya fueron aplicadas en la base existente; no vuelvas a ejecutar SQL de esquemas antiguos ni uses `migrate --fake-initial` de nuevo sobre esa base.

## Generar ejecutables para Windows 11

En Windows, instala las dependencias con `npm ci`, configura `VITE_API_URL` con la dirección HTTP(S) del servicio Django que puedan alcanzar los equipos usuarios y ejecuta `npm run build:windows`. Por ejemplo, en PowerShell: `$env:VITE_API_URL = "https://api.ejemplo.com"`. No uses `localhost` ni `127.0.0.1` en un paquete que se instalará en otros computadores: esas direcciones señalan al equipo cliente. El script valida la dirección antes de generar el instalador NSIS y la versión portable x64, y usa la versión declarada en `package.json`. Los archivos quedan separados bajo `build_windows/Version_<versión>/Instalador/` y `build_windows/Version_<versión>/Portable/`; el manual se incluye en ambas carpetas y en la carpeta de versión. `build.bat` usa la misma separación dentro de `Programa Ejecutable/`.

En un equipo nuevo, el primer inicio de sesión se realiza conectado al servicio y no requiere una sesión previa en ese equipo. El inicio offline solo funciona después de autenticar la cuenta en el mismo equipo y descargar la copia offline.

Para desarrollar dentro de WSL, guarda y ejecuta una copia del proyecto en el sistema de archivos Linux (por ejemplo, `~/projects/finca-control`), no desde `/mnt/c`. En `/mnt/c`, `npm ci` puede fallar al reemplazar directorios de `node_modules` (`ENOTEMPTY`), además de que el acceso a archivos es más lento. En la copia de WSL ejecuta `npm ci` y luego `npm run dev`. Si copias el proyecto actual, excluye `node_modules` y `dist`. Conserva la copia de Windows por separado: para compilar la aplicación de Windows, ejecuta `npm ci` desde PowerShell y después `npm run build:windows`. No compartas `node_modules` entre sistemas; Rollup usa binarios nativos distintos.

## Modo offline y sincronización

El panel de conexión y los controles **Activar modo offline**, **Reanudar conexión** y **Sincronizar ahora** están siempre disponibles en la esquina inferior derecha de la aplicación. Al reanudar la conexión, los cambios compatibles se envían automáticamente a la base de datos. El panel confirma los cambios subidos y vinculados; si hay conflictos, permite comparar las versiones, renombrar o editar los datos, conservar el cambio local, usar la versión del servidor o eliminar el registro. Los cambios incompatibles y las operaciones administrativas siguen requiriendo conexión.

Los trabajadores tienen la tarjeta **Carga de datos** para registrar actividades. Si el dispositivo está sin internet, la actividad queda en su cola local; no puede ser visible en otros equipos hasta que ese dispositivo vuelva a conectarse y sincronice. Después de sincronizar, los miembros de la finca la ven en las actividades y el administrador puede consultar en **Reportes → Datos cargados por trabajadores** quién la creó, editó o eliminó y el contenido guardado. El informe se actualiza al abrirlo, volver a la ventana o cada 30 segundos.
# Agro-Control
