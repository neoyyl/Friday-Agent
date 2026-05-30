@echo off
title NVIDIA Rate Limiter Proxy
echo ========================================
echo   NVIDIA Rate Limiter - Port 8099
echo   40 requests per minute
echo ========================================
python "F:\AITest\Friday_Kernel\modules\rate_limiter.py" --port 8099 --target "https://integrate.api.nvidia.com/v1" --rpm 40
pause
