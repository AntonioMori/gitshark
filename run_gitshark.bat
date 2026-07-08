@echo off
cd /d "%~dp0"
if not exist "out" (
    echo Compiling application for the first time...
    call npm run build
)
echo Starting GitShark...
start /b npx electron .
