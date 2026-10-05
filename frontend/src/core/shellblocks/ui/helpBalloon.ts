import "./helpBalloon.css";
import * as CLI from "../types/cli";

let closeCurrentHelp: (() => void) | null = null;

/**
 * Mostra um balão de ajuda posicionado ao lado de um elemento SVG.
 */
export function showHelpBalloon(
    baloonHtml: string,
    sourceElement: SVGElement,
): void {
    closeCurrentHelp?.();

    const balloon = document.createElement("div");
    balloon.className = "help-balloon";
    balloon.innerHTML = baloonHtml;
    document.body.appendChild(balloon);
    const listeners = new AbortController();
    const { signal } = listeners;
    closeCurrentHelp = () => { listeners.abort(); balloon.remove(); closeCurrentHelp = null; };

    const position = (): void => {
        const margin = 8;
        const rect = sourceElement.getBoundingClientRect();
        balloon.style.maxWidth = `${Math.max(0, window.innerWidth - margin * 2)}px`;
        balloon.style.maxHeight = `${Math.max(0, window.innerHeight - margin * 2)}px`;
        const box = balloon.getBoundingClientRect();
        const right = rect.right + margin;
        const left = right + box.width <= window.innerWidth - margin ? right : rect.left - box.width - margin;
        balloon.style.left = `${window.scrollX + Math.max(margin, Math.min(left, window.innerWidth - box.width - margin))}px`;
        balloon.style.top = `${window.scrollY + Math.max(margin, Math.min(rect.top, window.innerHeight - box.height - margin))}px`;
    };
    position();
    window.addEventListener("resize", position, { signal });

    const closeListener = (event: Event): void => {
        const target = event.target as Node;
        if (balloon.contains(target) || sourceElement.contains(target)) return;
        closeCurrentHelp?.();
    };

    // Evita fechar o balão no mesmo clique que o abriu
    requestAnimationFrame(() =>
        document.addEventListener("click", closeListener, { capture: true, signal }),
    );
}

export function buildCommandHelpHTML(
    commandDefinition: CLI.CliDefinitions["commands"][number],
): string {
    const descriptionHtml = parseDescriptionToHtml(
        commandDefinition.description,
    );

    let html = `
        <h3 class="help-balloon__title">${commandDefinition.label}</h3>
        <div class="help-balloon__desc">${descriptionHtml}</div>
    `;

    if (commandDefinition.options.length > 0) {
        html += `
            <strong class="help-balloon__subtitle">Opções disponíveis:</strong>
            <ul class="help-balloon__list">
        `;

        for (const option of commandDefinition.options) {
            const longFlag = option.longFlag
                ? ` (<code>${option.longFlag}</code>)`
                : "";
            html += `
                <li>
                    <code>${option.flag}</code>${longFlag}:
                    <span class="help-balloon__text">${option.description}</span>
                </li>
            `;
        }
        html += "</ul>";
    }

    if (commandDefinition.operands.length > 0) {
        html += `
            <strong class="help-balloon__subtitle">Operandos (valores ou alvos):</strong>
            <ul class="help-balloon__list">
        `;

        for (const operand of commandDefinition.operands) {
            html += `
                <li>
                    <strong>${operand.label}</strong>:
                    <span class="help-balloon__text">${operand.description}</span>
                    <br>Quantidade: ${formatCardinality(operand.cardinality)}.${operand.optionalWithImplicitInput ? " O mínimo é dispensado quando este comando recebe entrada implícita, como pelo pipe." : ""}
                </li>
            `;
        }
        html += "</ul>";
    }

    return html;
}

/**
 * Converte texto simples com quebras de linha e hifens em HTML estruturado.
 */
function parseDescriptionToHtml(text: string): string {
    if (!text) return "";

    const lines = text.split("\n");
    let html = "";
    let inList = false;

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        if (trimmed.startsWith("- ")) {
            if (!inList) {
                html += '<ul class="help-balloon__list">';
                inList = true;
            }
            html += `<li>${trimmed.substring(2)}</li>`;
        } else {
            if (inList) {
                html += "</ul>";
                inList = false;
            }

            if (trimmed.length > 0) {
                html += trimmed;
                if (index < lines.length - 1) html += "<br>";
            }
        }
    });

    if (inList) html += "</ul>";

    return html;
}

export function formatCardinality({ min, max }: CLI.CLICardinality): string {
    if (max === "unlimited") return `${min} ou mais`;
    if (min === max) return String(min);
    if (min === 0 && max === 1) return "0 ou 1";
    return `de ${min} a ${max}`;
}
