import * as Blockly from "blockly";
import type { CLIValidation, CLIValueType } from "../types/cli";

/** The hint belongs to the view; getValue/getText and serialization stay unchanged. */
export class TextValueField extends Blockly.FieldTextInput {
    constructor(value: string, private readonly placeholder: string) {
        super(value);
    }

    protected override getDisplayText_(): string {
        return this.getValue() === "" ? this.placeholder : super.getDisplayText_();
    }

    protected override render_(): void {
        super.render_();
        this.textElement_?.classList.toggle("shellblocks-placeholder", this.getValue() === "");
    }

    protected override widgetCreate_(): HTMLInputElement | HTMLTextAreaElement {
        const input = super.widgetCreate_();
        input.placeholder = this.placeholder;
        input.classList.add("shellblocks-value-editor");
        return input;
    }
}

export function valuePlaceholder(label: string | undefined, type: CLIValueType): string {
    const contextualHints: Record<string, string> = {
        origem: "Digite a origem",
        destino: "Digite o destino",
        padrão: "Digite o padrão",
        url: "Digite a URL",
        endereço: "Digite o endereço",
        pid: "Digite o PID",
        coluna: "Digite a coluna",
        contagem: "Digite a contagem",
        "largura da tela": "Digite a largura",
    };
    const name = label?.replace(/:$/, "").toLocaleLowerCase("pt-BR");
    if (name && contextualHints[name]) return contextualHints[name];
    return type === "file" || type === "folder" ? "Digite o caminho" : type === "number" ? "Digite um número" : "Digite o texto";
}

export function valueTooltip(
    type: CLIValueType,
    description: string = "",
    allowEmptyValue: boolean = true,
    validations: readonly CLIValidation[] = [],
): string {
    const typeLabel = { string: "texto", number: "número", file: "caminho", folder: "caminho de diretório" }[type];
    return [description, `Valor esperado: ${typeLabel}.`, "Clique no campo para digitar.", ...(allowEmptyValue ? [] : ["O valor não pode ser vazio."]), ...validations.map((rule) => `Validação: ${rule.errorMessage}`)].filter(Boolean).join("\n");
}
