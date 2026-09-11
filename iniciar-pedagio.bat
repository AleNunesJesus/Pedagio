@echo off
title Pedagio - Servidor de Desenvolvimento
cd /d "%~dp0app"

start "" http://localhost:3001

call npm run dev

pause
