@echo off
title PLaMo Translate NPU Server
rem Usage: start-plamo-npu.bat [-Model cw^|g128] [-NoBrowser]
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-plamo-npu.ps1" %*
