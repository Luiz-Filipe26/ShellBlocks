import "./helpBalloon.css";
import * as CLI from "../types/cli";

let currentHelpBalloon: HTMLDivElement | null = null;

/**
 * Mostra um balão de ajuda posicionado ao lado de um elemento SVG.
 */
export function showHelpBalloon(
    baloonHtml: string,
    sourceElement: SVGElement,
): void {
    if (currentHelpBalloon) {
        currentHelpBalloon.remove();
        currentHelpBalloon = null;
    }

    const balloon = document.createElement("div");
    balloon.className = "help-balloon";
    balloon.innerHTML = baloonHtml;
    document.body.appendChild(balloon);
    currentHelpBalloon = balloon;

    const rect = sourceElement.getBoundingClientRect();
    balloon.style.left = `${window.scrollX + rect.right + 5}px`;
    balloon.style.top = `${window.scrollY + rect.top}px`;

    const closeListener = (event: Event): void => {
        const target = event.target as Node;
        if (currentHelpBalloon?.contains(target)) return;
        if (sourceElement.contains(target)) return;
        currentHelpBalloon?.remove();
        currentHelpBalloon = null;
        document.removeEventListener("click", closeListener, true);
    };

    // Evita fechar o balão no mesmo clique que o abriu
    requestAnimationFrame(() =>
        document.addEventListener("click", closeListener, true),
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
