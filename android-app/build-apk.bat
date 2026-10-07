@echo off
rem Rebuilds GuessTheCountry.apk from the game files one folder up.
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0"
call npm run sync-web || exit /b 1
call npx cap sync android || exit /b 1
cd android
call gradlew.bat assembleDebug || exit /b 1
copy /y app\build\outputs\apk\debug\app-debug.apk ..\..\GuessTheCountry.apk
