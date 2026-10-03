@echo off
setlocal
cd /d "%~dp0"

where java >nul 2>nul
if errorlevel 1 (
  echo ERROR: Instale Java 17 o configure JAVA_HOME y PATH.
  pause
  exit /b 1
)
where mvn >nul 2>nul
if errorlevel 1 (
  echo ERROR: Maven no esta instalado o no esta en PATH.
  echo Alternativa: importe esta carpeta como proyecto Maven en STS/Eclipse.
  echo Ejecute Maven - Update Project y despues MinkaMarketApplication.
  pause
  exit /b 1
)
if not exist "src\main\resources\application.properties" (
  echo ERROR: Falta src\main\resources\application.properties.
  pause
  exit /b 1
)

echo Minka Market - PostgreSQL
echo PostgreSQL debe estar iniciado. No se necesita Docker.
echo Se cargara .env si existe en esta carpeta.
echo.
call mvn clean spring-boot:run
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo El arranque fallo. Revise el ultimo Caused by de la consola.
  echo No se han borrado tablas ni datos mediante este script.
  pause
)
exit /b %EXIT_CODE%
