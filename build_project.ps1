$ErrorActionPreference = "Stop"

Write-Host "--- Limpando artefatos de builds anteriores ---" -ForegroundColor Cyan

@(
    "frontend/dist",
    "backend/build",
    "backend/dist",
    "dist"
) | ForEach-Object {
    if (Test-Path $_) {
        Remove-Item -Recurse -Force $_
    }
}

$null = New-Item -ItemType Directory -Force -Path "backend/build/frontend"
$null = New-Item -ItemType Directory -Force -Path "dist"

Write-Host "--- [1/3] Compilando o Frontend (Single File) ---" -ForegroundColor Cyan
Set-Location frontend
& npm install --silent --no-fund
& npm run build --silent
Set-Location ..

Write-Host "--- [2/3] Integrando artefatos do Frontend ao Backend ---" -ForegroundColor Cyan
Copy-Item -Path "frontend/dist/index.html" -Destination "backend/build/frontend/index.html" -Force

Write-Host "--- [3/3] Gerando artefato final do servidor (Bundler) ---" -ForegroundColor Cyan
Set-Location backend
& npm install --silent --no-fund
& npm run build --silent
Set-Location ..

Copy-Item -Path "backend/dist/server.js" -Destination "dist/shellblocks-server.js" -Force

if ($env:GITHUB_ENV) {
    Add-Content -Path $env:GITHUB_ENV -Value "GENERATED_ARTIFACT_PATH=dist/shellblocks-server.js"
    Write-Host "Registro de variável no GITHUB_ENV concluído." -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Build finalizado com sucesso." -ForegroundColor Green
Write-Host "------------------------------------------------------"
Write-Host "Artefato consolidado gerado em:"
Write-Host "> ./dist/shellblocks-server.js" -ForegroundColor Yellow
Write-Host "------------------------------------------------------"
Write-Host "Para iniciar o servidor, execute:"
Write-Host "$ node dist/shellblocks-server.js" -ForegroundColor Cyan
