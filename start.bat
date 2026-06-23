@echo off
setlocal
echo ============================================
echo  Chess Analysis Server
echo ============================================
echo.

REM Run inside the dedicated conda environment "chess-analysis"
set CONDA=C:\ProgramData\miniconda3\condabin\conda.bat

REM Download Stockfish if it's missing
if not exist "%~dp0stockfish\stockfish.exe" (
    echo [*] Stockfish not found - attempting automatic download...
    call "%CONDA%" run -n chess-analysis python "%~dp0setup_stockfish.py"
    echo.
)

REM Build the React frontend if it hasn't been built yet
if not exist "%~dp0frontend\dist\index.html" (
    echo [*] Frontend not built - installing deps and building ^(needs Node 18+^)...
    call npm --prefix "%~dp0frontend" install
    call npm --prefix "%~dp0frontend" run build
    echo.
)

echo Starting server at http://localhost:8000
echo Press Ctrl+C to stop.
echo.
call "%CONDA%" run -n chess-analysis --no-capture-output python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
