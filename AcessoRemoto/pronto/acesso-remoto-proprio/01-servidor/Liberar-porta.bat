@echo off
netsh advfirewall firewall delete rule name="AcessoRemoto 47200" >nul 2>&1
netsh advfirewall firewall add rule name="AcessoRemoto 47200" dir=in action=allow protocol=TCP localport=47200
echo Porta 47200 liberada neste Windows.
pause
