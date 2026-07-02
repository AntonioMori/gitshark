@echo off
chcp 65001 >nul
echo ============================================
echo  GitGraph - gerador do executavel (.exe)
echo ============================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo ERRO: Python nao encontrado no PATH.
    echo Instale em https://www.python.org/downloads/ marcando "Add to PATH".
    pause
    exit /b 1
)

echo [1/2] Instalando PyInstaller...
python -m pip install --upgrade pyinstaller

echo.
echo [2/2] Gerando o executavel...
python -m PyInstaller --onefile --noconsole --name GitGraph ^
    --hidden-import tkinter --hidden-import tkinter.filedialog ^
    gitgraph.py

echo.
if exist dist\GitGraph.exe (
    echo ============================================
    echo  Pronto! Executavel gerado em:
    echo    dist\GitGraph.exe
    echo.
    echo  Pode copiar esse .exe para onde quiser e
    echo  criar um atalho na area de trabalho.
    echo ============================================
) else (
    echo Algo deu errado - verifique as mensagens acima.
)
pause
