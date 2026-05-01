@echo off
echo ==============================================
echo   Iniciando atualizacao do sistema (Vercel)
echo ==============================================
echo.

set /p msg="Digite o que voce alterou (ex: corrigido erro na tela x): "

if "%msg%"=="" (
    set msg="Atualizacao do sistema"
)

echo.
echo [1/3] Adicionando arquivos...
git add .

echo [2/3] Salvando alteracoes...
git commit -m "%msg%"

echo [3/3] Enviando para o servidor...
git push origin main:master

echo.
echo ==============================================
echo   Pronto! Aguarde 1 a 2 minutos para vercel
echo   atualizar o sistema no ar.
echo ==============================================
pause
