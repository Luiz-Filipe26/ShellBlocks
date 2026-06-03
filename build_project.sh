#!/bin/bash
set -e

echo "--- [1/3] Compilando o Frontend (Single File) ---"
cd frontend
npm install --silent --no-fund
npm run build --silent
cd ..

echo "--- [2/3] Integrando artefatos do Frontend ao Backend ---"
cp frontend/dist/index.html backend/src/index.html

echo "--- [3/3] Gerando artefato final do servidor (Bundler) ---"
cd backend
npm install --silent --no-fund
npm run build --silent
cd ..

cp backend/dist/server.js ./shellblocks-server.js

if [ -n "$GITHUB_ENV" ]; then
    echo "GENERATED_FILE_NAME=shellblocks-server.js" >> "$GITHUB_ENV"
    echo "Registro de variável no GITHUB_ENV concluído."
fi

echo ""
echo "✅ Build finalizado com sucesso."
echo "------------------------------------------------------"
echo "Artefato consolidado gerado na raiz do projeto:"
echo "> ./shellblocks-server.js"
echo "------------------------------------------------------"
echo "Para iniciar o servidor, execute:"
echo "$ node shellblocks-server.js"
