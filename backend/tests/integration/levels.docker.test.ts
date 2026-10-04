import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SANDBOX_EXECUTION_TIMEOUT_MS } from "@shellblocks/shared/config/sandbox";
import { parseGameData } from "../../../frontend/src/pages/features/session/gameDataParser";
import { ensureDockerImageExists } from "@/services/dockerService";
import { runInSandbox } from "@/services/sandboxRunner";

const gameData = parseGameData(JSON.parse(readFileSync(
    new URL("../../../frontend/src/assets/data/levels.json", import.meta.url),
    "utf8",
)));
const suiteLabel = `shellblocks.test-levels=${randomUUID()}`;

interface MissionCase {
    levelId: string;
    behavior: string;
    script: string;
    completed: boolean;
}

const cases: MissionCase[] = [
    { levelId: "02_ls_options", behavior: "aceita a listagem com tamanho legível", script: "ls -l -h", completed: true },
    { levelId: "02_ls_options", behavior: "rejeita a listagem sem tamanho", script: "ls", completed: false },
    { levelId: "04_cd", behavior: "aceita cd para a pasta preparada sem exigir saída", script: "cd ./projetos", completed: true },
    { levelId: "04_cd", behavior: "rejeita permanecer no diretório inicial", script: "ls", completed: false },
    { levelId: "05_cp", behavior: "aceita uma cópia completa e preserva o original", script: "cp ./plano.txt ./backup.txt", completed: true },
    { levelId: "05_cp", behavior: "rejeita uma cópia vazia", script: "touch backup.txt", completed: false },
    { levelId: "05_cp", behavior: "rejeita mover o original", script: "mv plano.txt backup.txt", completed: false },
    { levelId: "07_grep", behavior: "aceita somente a linha de erro", script: "grep ERRO server.log", completed: true },
    { levelId: "07_grep", behavior: "aceita a linha de erro numerada", script: "grep -n ERRO ./server.log", completed: true },
    { levelId: "07_grep", behavior: "rejeita WARN junto da linha de erro", script: "grep -v INFO server.log", completed: false },
    { levelId: "07_grep", behavior: "rejeita ausência da linha de erro", script: "grep INEXISTENTE server.log", completed: false },
    { levelId: "08_redirect", behavior: "aceita salvar a listagem completa", script: "ls > inventario.txt", completed: true },
    { levelId: "08_redirect", behavior: "aceita salvar a listagem detalhada", script: "ls -lh > inventario.txt", completed: true },
    { levelId: "08_redirect", behavior: "rejeita uma listagem sem caixa_B.doc", script: "ls caixa_A.doc > inventario.txt", completed: false },
    { levelId: "08_redirect", behavior: "rejeita um inventário vazio", script: "touch inventario.txt", completed: false },
    { levelId: "09_pipe", behavior: "aceita a composição cat e grep", script: "cat nomes.txt | grep Ana", completed: true },
    { levelId: "09_pipe", behavior: "aceita caminho equivalente, quoting e comentário", script: "# Filtrar nomes\ncat './nomes.txt' | grep 'Ana'\n", completed: true },
    { levelId: "09_pipe", behavior: "aceita a filtragem numerada", script: "cat nomes.txt | grep -n Ana", completed: true },
    { levelId: "09_pipe", behavior: "aceita numeração de cat e grep sem confundi-la com outros nomes", script: "cat -n nomes.txt | grep -n Ana", completed: true },
    { levelId: "09_pipe", behavior: "não exige preservar o arquivo depois do pipe", script: "cat nomes.txt | grep Ana\nrm nomes.txt", completed: true },
    { levelId: "09_pipe", behavior: "rejeita obter o resultado sem pipe", script: "grep Ana nomes.txt", completed: false },
    { levelId: "09_pipe", behavior: "rejeita grep que lê arquivo em vez da entrada do pipe", script: "cat nomes.txt | grep Ana nomes.txt", completed: false },
    { levelId: "09_pipe", behavior: "rejeita um pipe que seleciona outros nomes", script: "cat nomes.txt | grep Carlos", completed: false },
    { levelId: "10_ping", behavior: "aceita quatro respostas do destino solicitado", script: "ping -c 4 127.0.0.1", completed: true },
    { levelId: "10_ping", behavior: "rejeita apenas uma resposta", script: "ping -c 1 127.0.0.1", completed: false },
    { levelId: "10_ping", behavior: "rejeita cinco respostas", script: "ping -c 5 127.0.0.1", completed: false },
    { levelId: "11_curl", behavior: "aceita o conteúdo servido", script: "curl -s http://127.0.0.1:8000/sucesso.txt", completed: true },
    { levelId: "11_curl", behavior: "rejeita uma resposta HTTP 404", script: "curl -s http://127.0.0.1:8000/inexistente.txt", completed: false },
    { levelId: "11_curl", behavior: "rejeita somente uma palavra do conteúdo", script: "echo PARABENS", completed: false },
    { levelId: "12_ps", behavior: "prepara o processo antes da listagem", script: "ps", completed: true },
    { levelId: "12_ps", behavior: "aceita outra apresentação da listagem", script: "ps aux", completed: true },
    { levelId: "12_ps", behavior: "rejeita o nome presente somente no comando de limpeza", script: "echo '123 aluno 0:00 pkill -f servidor_oculto'", completed: false },
    { levelId: "12_ps", behavior: "rejeita ausência da listagem", script: "true", completed: false },
    { levelId: "13_background", behavior: "aceita ping ativo em segundo plano", script: "ping 127.0.0.1 &", completed: true },
    { levelId: "13_background", behavior: "aceita contagem que ainda deixa ping ativo", script: "ping -c 4 127.0.0.1 &", completed: true },
    { levelId: "13_background", behavior: "rejeita ping encerrado mesmo se restar um zombie", script: "ping -c 1 127.0.0.1 &", completed: false },
    { levelId: "13_background", behavior: "rejeita ping concluído em primeiro plano", script: "ping -c 1 127.0.0.1", completed: false },
    { levelId: "14_organizar", behavior: "aceita mover ambos os logs", script: "mkdir logs\nmv erro.log acesso.log logs", completed: true },
    { levelId: "14_organizar", behavior: "rejeita acesso.log deixado na origem", script: "mkdir logs\ncp erro.log acesso.log logs\nrm erro.log", completed: false },
    { levelId: "14_organizar", behavior: "rejeita somente copiar os logs", script: "mkdir logs\ncp erro.log acesso.log logs", completed: false },
    { levelId: "15_limpeza", behavior: "aceita listar e depois remover", script: "ls\nrm senhas_antigas.txt", completed: true },
    { levelId: "15_limpeza", behavior: "aceita a listagem detalhada antes da remoção", script: "ls -lh\nrm senhas_antigas.txt", completed: true },
    { levelId: "15_limpeza", behavior: "rejeita apagar antes de tentar listar", script: "rm senhas_antigas.txt\nls senhas_antigas.txt", completed: false },
    { levelId: "15_limpeza", behavior: "rejeita apagar sem listar", script: "rm senhas_antigas.txt", completed: false },
    { levelId: "16_processamento", behavior: "aceita salvar somente CRITICO e remover a origem", script: "grep CRITICO servidor.log > erros.txt\nrm servidor.log", completed: true },
    { levelId: "16_processamento", behavior: "aceita salvar a linha crítica numerada", script: "grep -n CRITICO servidor.log > erros.txt\nrm servidor.log", completed: true },
    { levelId: "16_processamento", behavior: "rejeita copiar também INFO e WARN", script: "cp servidor.log erros.txt\nrm servidor.log", completed: false },
    { levelId: "16_processamento", behavior: "rejeita manter o arquivo original", script: "grep CRITICO servidor.log > erros.txt", completed: false },
    { levelId: "17_deploy", behavior: "aceita baixar, salvar e mover o programa", script: "mkdir app\ncurl -s http://127.0.0.1:8000/vendas.py > vendas.py\nmv vendas.py app", completed: true },
    { levelId: "17_deploy", behavior: "rejeita instalar uma resposta HTTP 404", script: "mkdir app\ncurl -s http://127.0.0.1:8000/inexistente.py > vendas.py\nmv vendas.py app", completed: false },
    { levelId: "18_challenge_security", behavior: "aceita obtenção e filtragem por pipe", script: "curl http://127.0.0.1:8000/boletim.txt | grep ERRO > incidentes.txt", completed: true },
    { levelId: "18_challenge_security", behavior: "aceita filtragem direta de arquivo intermediário", script: "curl http://127.0.0.1:8000/boletim.txt > boletim.tmp\ngrep ERRO boletim.tmp > incidentes.txt", completed: true },
    { levelId: "18_challenge_security", behavior: "aceita cat e grep sobre arquivo intermediário", script: "curl http://127.0.0.1:8000/boletim.txt > boletim.tmp\ncat boletim.tmp | grep ERRO > incidentes.txt", completed: true },
    { levelId: "18_challenge_security", behavior: "rejeita o boletim inteiro", script: "curl http://127.0.0.1:8000/boletim.txt > incidentes.txt", completed: false },
    { levelId: "18_challenge_security", behavior: "rejeita arquivo vazio", script: "touch incidentes.txt", completed: false },
    { levelId: "18_challenge_security", behavior: "rejeita somente a palavra ERRO", script: "echo ERRO > incidentes.txt", completed: false },
    { levelId: "18_challenge_security", behavior: "rejeita relatório parcial", script: "curl http://127.0.0.1:8000/boletim.txt | grep recibo > incidentes.txt", completed: false },
    { levelId: "18_challenge_security", behavior: "rejeita perda de uma ocorrência repetida", script: "curl http://127.0.0.1:8000/boletim.txt | grep ERRO | head -n 2 > incidentes.txt", completed: false },
    { levelId: "18_challenge_security", behavior: "rejeita duplicação adicional", script: "curl http://127.0.0.1:8000/boletim.txt | grep ERRO > incidentes.txt\necho \"ERRO: Falha no pagamento 103\" >> incidentes.txt", completed: false },
    { levelId: "18_challenge_security", behavior: "rejeita registros reordenados", script: "curl http://127.0.0.1:8000/boletim.txt | grep ERRO > parcial.tmp\nsed -n 2p parcial.tmp > incidentes.txt\nsed -n 1p parcial.tmp >> incidentes.txt\nsed -n 3p parcial.tmp >> incidentes.txt", completed: false },
    { levelId: "18_challenge_security", behavior: "rejeita numeração adicional", script: "curl http://127.0.0.1:8000/boletim.txt | grep -n ERRO > incidentes.txt", completed: false },
    { levelId: "18_challenge_security", behavior: "rejeita títulos adicionais", script: "echo \"Relatório de incidentes\" > incidentes.txt\ncurl http://127.0.0.1:8000/boletim.txt | grep ERRO >> incidentes.txt", completed: false },
    { levelId: "18_challenge_security", behavior: "rejeita nomes de arquivo adicionados", script: "curl http://127.0.0.1:8000/boletim.txt > a.tmp\ncp a.tmp b.tmp\ngrep ERRO a.tmp b.tmp > incidentes.txt", completed: false },
    { levelId: "18_challenge_security", behavior: "rejeita resposta HTTP de erro", script: "curl http://127.0.0.1:8000/inexistente.txt > incidentes.txt", completed: false },
    { levelId: "18_challenge_security", behavior: "rejeita resultado apenas no stdout", script: "curl http://127.0.0.1:8000/boletim.txt | grep ERRO", completed: false },
    { levelId: "18_challenge_security", behavior: "rejeita diretório no lugar do relatório", script: "mkdir incidentes.txt", completed: false },
    { levelId: "18_challenge_security", behavior: "mantém a expectativa original se a fonte servida for alterada", script: "echo ERRO > /tmp/shellblocks-level-18-source/boletim.txt\ncurl http://127.0.0.1:8000/boletim.txt > incidentes.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "aceita backup por cópia e atualização direta", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp", completed: true },
    { levelId: "19_challenge_deploy", behavior: "aceita download intermediário, movimento e relatório por pipe", script: "mkdir backup\nmkdir relatorios\ncurl http://127.0.0.1:8000/config-nova.txt > nova.tmp\ncp config.txt backup/config.txt\nmv nova.tmp config.txt\ncat operacao.log | grep ERRO > relatorios/erros.txt\nrm cache.tmp", completed: true },
    { levelId: "19_challenge_deploy", behavior: "aceita preservar a versão anterior por movimento", script: "mkdir backup relatorios\nmv config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp", completed: true },
    { levelId: "19_challenge_deploy", behavior: "aceita outra ordem para operações independentes e arquivos intermediários", script: "mkdir relatorios\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\nmkdir backup\ncat config.txt > backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > nova.tmp\ncp nova.tmp config.txt", completed: true },
    { levelId: "19_challenge_deploy", behavior: "rejeita backup ausente", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\nrm backup/config.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita backup com a versão nova", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\ncp config.txt backup/config.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita backup vazio", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\necho -n \"\" > backup/config.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita backup incompleto", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\necho versao=1 > backup/config.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita configuração vazia", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\necho -n \"\" > config.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita configuração antiga", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\ncp backup/config.txt config.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita configuração parcial", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\necho versao=2 > config.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita configuração com resposta HTTP de erro", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\ncurl http://127.0.0.1:8000/inexistente.txt > config.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita relatório com o log inteiro", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\ncp operacao.log relatorios/erros.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita relatório parcial", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\ngrep relatório operacao.log > relatorios/erros.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita perda da repetição", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\ngrep ERRO operacao.log | head -n 2 > relatorios/erros.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita repetição adicional", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\necho \"ERRO: Falha na sincronização\" >> relatorios/erros.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita mudança de ordem", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\ngrep ERRO operacao.log > parcial.tmp\nsed -n 2p parcial.tmp > relatorios/erros.txt\nsed -n 1p parcial.tmp >> relatorios/erros.txt\nsed -n 3p parcial.tmp >> relatorios/erros.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita mudança de texto", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\nsed -i s/Falha/Falhou/g relatorios/erros.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita numeração no relatório", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\ngrep -n ERRO operacao.log > relatorios/erros.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita remoção do log protegido", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\nrm operacao.log", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita alteração do log protegido", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\necho INFO >> operacao.log", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita remoção do arquivo informativo", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\nrm leia-me.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita alteração do arquivo informativo", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\necho alterado > leia-me.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita permanência do temporário", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\ntouch cache.tmp", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita temporário convertido em diretório", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\nmkdir cache.tmp", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita arquivo em lugar da pasta de backup", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\nrm -r backup\ntouch backup", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita arquivo em lugar da pasta de relatórios", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\nrm -r relatorios\ntouch relatorios", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita diretório em lugar da configuração", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\nrm config.txt\nmkdir config.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita diretório em lugar do backup", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\nrm backup/config.txt\nmkdir backup/config.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita diretório em lugar do relatório", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\nrm relatorios/erros.txt\nmkdir relatorios/erros.txt", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita apenas pastas sem entregas", script: "mkdir backup relatorios\nrm cache.tmp", completed: false },
    { levelId: "19_challenge_deploy", behavior: "rejeita expectativas derivadas de uma origem alterada", script: "mkdir backup relatorios\ncp config.txt backup/config.txt\ncurl http://127.0.0.1:8000/config-nova.txt > config.txt\ngrep ERRO operacao.log > relatorios/erros.txt\nrm cache.tmp\necho ERRO > operacao.log\ngrep ERRO operacao.log > relatorios/erros.txt", completed: false },
];

describe("missões maduras no sandbox real", () => {
    beforeAll(() => {
        execFileSync("docker", ["info"], { stdio: "pipe" });
        ensureDockerImageExists(["Dockerfile.sandbox", "runner.sandbox.js"].map((name) => ({
            name,
            content: readFileSync(new URL(`../../src/docker/${name}`, import.meta.url), "utf8"),
        })));
    });

    afterAll(() => {
        const remaining = execFileSync("docker", [
            "ps", "-a", "--filter", `label=${suiteLabel}`, "--format", "{{.Names}}",
        ], { encoding: "utf8" }).trim();
        expect(remaining, "containers das missões devem ser removidos").toBe("");
    });

    // Allow the executor's timeout and container cleanup to finish before Vitest interrupts it.
    it.each(cases)("$levelId: $behavior", async ({ levelId, script, completed }) => {
        const level = gameData.levels.find((item) => item.id === levelId);
        if (!level?.setupScript || !level.verificationScript) {
            throw new Error(`Missão sem preparação/verificação: ${levelId}`);
        }
        const result = await runInSandbox({
            setupScript: level.setupScript,
            userScript: script,
            verificationScript: level.verificationScript,
        }, { containerLabel: suiteLabel });
        expect(result.status).toBe("completed");
        if (result.status !== "completed") throw new Error(JSON.stringify(result));
        expect(result.setup?.exitCode).toBe(0);
        expect(result.verification, JSON.stringify(result)).not.toBeNull();
        expect(result.verification?.exitCode, JSON.stringify(result)).toBe(completed ? 0 : 1);

        if (!completed && (levelId === "18_challenge_security" || levelId === "19_challenge_deploy")) {
            const feedback = Buffer.from(result.verification!.stdoutBase64, "base64").toString()
                + Buffer.from(result.verification!.stderrBase64, "base64").toString();
            expect(feedback.trim(), "a falha deve explicar o contrato não satisfeito").not.toBe("");
        }

        if (levelId === "04_cd" && completed) {
            expect(result.execution.stdoutBase64).toBe("");
        }
        if (levelId === "11_curl" && !completed) {
            const feedback = Buffer.from(result.verification!.stdoutBase64, "base64").toString();
            expect(feedback).not.toMatch(/tempo|novamente/i);
        }
        if (levelId === "12_ps" && completed) {
            const listing = Buffer.from(result.execution.stdoutBase64, "base64").toString();
            expect(listing).toContain("servidor_oculto");
            expect(listing).not.toContain("pkill");
        }
    }, SANDBOX_EXECUTION_TIMEOUT_MS + 10_000);
});
