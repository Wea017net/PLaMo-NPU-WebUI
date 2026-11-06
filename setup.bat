@echo off
title PLaMo NPU WebUI Setup
rem Usage: setup.bat [-Variants cw] [-SkipModel]
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
pause
