import { execSync } from "child_process";

const DOCKERFILE_CONTENT = `
FROM alpine:latest
RUN apk add --no-cache bash coreutils grep sed gawk python3 curl iputils
RUN adduser -D -u 1000 aluno
USER aluno
WORKDIR /home/aluno
CMD ["/bin/bash"]
`;

export function ensureDockerImageExists(): void {
    console.log("[Docker] Verificando se a imagem 'blockly-shell-env' existe...");
    
    try {
        const checkImage = execSync("docker images -q blockly-shell-env").toString().trim();
        
        if (checkImage.length > 0) {
            console.log("[Docker] Imagem encontrada! Pronta para uso.");
            return;
        }

        console.log("[Docker] Imagem não encontrada. Iniciando build automático...");
        
        execSync("docker build -t blockly-shell-env -", {
            input: DOCKERFILE_CONTENT.trim(),
            stdio: ["pipe", "inherit", "inherit"]
        });

        console.log("[Docker] Imagem compilada com sucesso direto da memória RAM!");

    } catch (error: any) {
        console.error("[Docker] ERRO CRÍTICO ao preparar ambiente Docker:", error.message);
        process.exit(1);
    }
}
