#!/bin/bash
set -e

echo "--- Limpando artefatos de builds anteriores ---"
rm -rf frontend/dist backend/build backend/dist dist
mkdir -p backend/build/frontend dist

echo "--- [1/3] Compilando o Frontend (Single File) ---"
cd frontend
npm install --silent --no-fund
npm run build --silent
cd ..

echo "--- [2/3] Integrando artefatos do Frontend ao Backend ---"
cp frontend/dist/index.html backend/build/frontend/index.html

echo "--- [3/3] Gerando artefato final do servidor (Bundler) ---"
cd backend
npm install --silent --no-fund
npm run build --silent
cd ..

cp backend/dist/server.js dist/shellblocks-server.js

if [ -n "$GITHUB_ENV" ]; then
    echo "GENERATED_ARTIFACT_PATH=dist/shellblocks-server.js" >> "$GITHUB_ENV"
    echo "Registro de variável no GITHUB_ENV concluído."
fi

echo ""
echo "✅ Build finalizado com sucesso."
echo "------------------------------------------------------"
echo "Artefato consolidado gerado em:"
echo "> ./dist/shellblocks-server.js"
echo "------------------------------------------------------"
echo "Para iniciar o servidor, execute:"
echo "$ node dist/shellblocks-server.js"
