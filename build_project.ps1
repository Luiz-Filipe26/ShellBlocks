# Equivalente ao 'set -e' (para o script parar se algum comando falhar)
$ErrorActionPreference = "Stop"

Write-Host "--- [1/3] Construindo o Frontend ---"
Set-Location frontend
npm install --silent --no-fund
npm run build --silent
if ($LASTEXITCODE -ne 0) { throw "O build do Frontend falhou!" }
Set-Location ..

Write-Host "--- [2/3] Integrando Frontend ao Backend ---"
# Remove a pasta public se ela existir e cria uma nova limpa
if (Test-Path "backend/src/main/resources/public") {
    Remove-Item -Recurse -Force "backend/src/main/resources/public"
}
New-Item -ItemType Directory -Force -Path "backend/src/main/resources/public" | Out-Null
Copy-Item -Recurse -Force "frontend/dist/*" "backend/src/main/resources/public/"

Write-Host "--- [3/3] Compilando e Gerando JAR ---"
Set-Location backend
mvn -B clean package

# Busca o arquivo JAR ignorando o "original-"
$JarPath = Get-ChildItem "target/*.jar" | Where-Object { $_.Name -notmatch "original-" } | Select-Object -First 1
$JarFile = $JarPath.Name

Set-Location ..

# Copia o JAR para a raiz
Copy-Item $JarPath.FullName .

# Nota: Windows/PowerShell não usa 'chmod +x'. O arquivo já é executável via java.

# Integração com o GitHub Actions
if ($env:GITHUB_ENV) {
    Add-Content -Path $env:GITHUB_ENV -Value "GENERATED_JAR_NAME=$JarFile"
    Write-Host "⚙️ Enviando nome do JAR para o ambiente do GitHub Actions."
}

Write-Host ""
Write-Host "✅ SUCESSO!"
Write-Host "------------------------------------------------------"
Write-Host "O executável foi gerado na raiz do projeto:"
Write-Host "> ./$JarFile"
Write-Host "------------------------------------------------------"
Write-Host "Para rodar, apenas digite:"
Write-Host "java -jar $JarFile"
