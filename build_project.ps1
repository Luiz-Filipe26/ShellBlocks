# Configura o PowerShell para interromper a execução imediatamente caso ocorra qualquer erro (equivalente ao set -e)
$ErrorActionPreference = "Stop"

Write-Host "--- [1/3] Compilando o Frontend (Single File) ---" -ForegroundColor Cyan
Set-Location frontend
& npm install --silent --no-fund
& npm run build --silent
Set-Location ..

Write-Host "--- [2/3] Integrando artefatos do Frontend ao Backend ---" -ForegroundColor Cyan
# Força a criação do diretório destino caso não exista e copia o index.html
$null = New-Item -ItemType Directory -Force -Path "backend/src"
Copy-Item -Path "frontend/dist/index.html" -Destination "backend/src/index.html" -Force

Write-Host "--- [3/3] Gerando artefato final do servidor (Bundler) ---" -ForegroundColor Cyan
Set-Location backend
& npm install --silent --no-fund
& npm run build --silent
Set-Location ..

# Move o executável único consolidado para a raiz do projeto
Copy-Item -Path "backend/dist/server.js" -Destination "./shellblocks-server.js" -Force

# Verifica se está rodando no ambiente do GitHub Actions para registrar a variável
if ($env:GITHUB_ENV) {
    Add-Content -Path $env:GITHUB_ENV -Value "GENERATED_FILE_NAME=shellblocks-server.js"
    Write-Host "Registro de variável no GITHUB_ENV concluído." -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Build finalizado com sucesso." -ForegroundColor Green
Write-Host "------------------------------------------------------"
Write-Host "Artefato consolidado gerado na raiz do projeto:"
Write-Host "> ./shellblocks-server.js" -ForegroundColor Yellow
Write-Host "------------------------------------------------------"
Write-Host "Para iniciar o servidor, execute:"
Write-Host "$ node shellblocks-server.js" -ForegroundColor Cyan
