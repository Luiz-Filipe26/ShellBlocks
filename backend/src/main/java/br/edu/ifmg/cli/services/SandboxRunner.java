package br.edu.ifmg.cli.services;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import br.edu.ifmg.cli.models.ExecutionResult;

public class SandboxRunner {

    private static final int TIMEOUT_SECONDS = 30;
    private static final Logger logger = LoggerFactory.getLogger(SandboxRunner.class);
    private static final String LOG_FILE = "/tmp/last_cmd_out"; 

    private final String dockerPrefix;

    public SandboxRunner(String dockerPrefix) {
        this.dockerPrefix = dockerPrefix;
    }

    public ExecutionResult run(String userScript, List<String> setupCommands, String verificationScript) {
        try {
            StringBuilder fullScript = new StringBuilder();

            if (setupCommands != null && !setupCommands.isEmpty()) {
                fullScript.append("{ ");
                for (String cmd : setupCommands)
                    fullScript.append(cmd).append(" ; ");
                fullScript.append(" } > /dev/null 2>&1 && ");
            }

            fullScript.append("{ ").append(userScript).append(" ; } > " + LOG_FILE + " 2>&1 ; ");
            fullScript.append("cat " + LOG_FILE + " ; ");
            String verify = (verificationScript != null && !verificationScript.isBlank())
                    ? verificationScript
                    : "exit 0";
            fullScript.append("\n").append(verify);

            var command = new ArrayList<String>();
            String commandBeggining = this.dockerPrefix
                + " run --rm --net none --memory 100m --cpus 0.5 blockly-shell-env bash -c";
            command.addAll(Arrays.asList(commandBeggining.split("\\s+")));
            command.add(fullScript.toString());

            ProcessBuilder pb = new ProcessBuilder(command);
            Process process = pb.start();

            boolean finished = process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);

            String stdout, stderr;
            int exitCode;

            if (!finished) {
                process.destroyForcibly();
                stdout = "";
                stderr = "⏱️ Tempo esgotado! Seu comando demorou muito.";
                exitCode = 124;
            } else {
                stdout = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
                stderr = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
                exitCode = process.exitValue();

                if (exitCode >= 125)
                    stderr = "\n[ERRO SISTEMA] Exit " + exitCode + "\n" + stderr;
            }

            return new ExecutionResult(stdout, stderr, exitCode);

        } catch (Exception e) {
            logger.error("Erro interno no SandboxRunner", e);
            return new ExecutionResult("", "Erro Interno: " + e.getMessage(), 1);
        }
    }
}
