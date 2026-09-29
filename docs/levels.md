# `levels.json`

`frontend/src/assets/data/levels.json` define os níveis educacionais do ShellBlocks, incluindo sua apresentação, preparação do ambiente, verificação e ordem de exibição.

## Estrutura

```json
{
    "levels": [],
    "levelOrder": []
}
```

* `levels`: definições dos níveis.
* `levelOrder`: sequência em que os níveis são apresentados, referenciada pelos respectivos `id`.

A ordem dos objetos em `levels` não define a progressão.

## Níveis

Cada item de `levels` possui a seguinte estrutura:

```json
{
    "id": "03_mkdir",
    "title": "Operandos (Alvos)",
    "summary": "Crie uma nova pasta definindo um operando.",
    "fullGuideHtml": "<h1>Ação e Reação (Operandos)</h1><p>...</p>",
    "setupScript": "rm -rf *",
    "verificationScript": "if [ -d projetos ]; then echo 'OK'; exit 0; else exit 1; fi",
    "difficulty": "tutorial"
}
```

| Campo                | Descrição                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `id`                 | Identificador único do nível, utilizado também por `levelOrder`.                            |
| `title`              | Título apresentado ao usuário.                                                              |
| `summary`            | Descrição curta do objetivo do nível.                                                       |
| `fullGuideHtml`      | Guia completo da atividade, armazenado como HTML.                                           |
| `setupScript`        | Script Shell opcional que prepara o ambiente antes do script do usuário.                    |
| `verificationScript` | Script opcional executado após o script do usuário para verificar o resultado da atividade. |
| `difficulty`         | Classificação do nível. Atualmente: `tutorial`, `training` ou `challenge`.                  |

## Execução do nível

Quando utilizados, os scripts de um nível seguem conceitualmente esta sequência:

```text
setupScript
      ↓
script do usuário
      ↓
verificationScript
```

`setupScript` cria o estado inicial necessário para a atividade, podendo criar
arquivos e diretórios, iniciar processos ou preparar serviços locais. Ele roda
em um processo Shell separado do script do aluno. Efeitos externos, como o
filesystem e processos iniciados, permanecem; diretório atual, variáveis locais,
aliases e outros estados internos da Shell não são compartilhados.

`verificationScript` verifica o estado produzido pelo usuário. Um código de
saída `0` indica sucesso; outros códigos indicam falha. A verificação pode
inspecionar diretamente o ambiente ou consultar a saída do script do usuário
no arquivo cujo caminho é fornecido pela variável:

```text
SHELLBLOCKS_LAST_CMD_OUT_FILE
```

Quando o objetivo também depende da construção utilizada, o Shell gerado pelo
workspace fica disponível ao verificador em:

```text
SHELLBLOCKS_USER_SCRIPT_FILE
```

Esse arquivo é recriado pelo executor depois do script do usuário e antes da
verificação, preservando exatamente o texto enviado para execução.

O diretório de trabalho final da shell do aluno fica disponível ao verificador
em `SHELLBLOCKS_FINAL_CWD`. Os demais estados internos da shell não são
compartilhados entre os estágios.

Por exemplo:

```sh
grep -q 'relatorio.txt' "$SHELLBLOCKS_LAST_CMD_OUT_FILE"
```

ou:

```sh
[ -f backup.txt ]
```

`verificationScript` é opcional: existem níveis que não o definem.

Os três estágios possuem resultados independentes. Uma falha em `setupScript`
interrompe a execução antes do script do usuário e da
verificação. O código de saída do script do usuário é preservado, mas não
determina sozinho a conclusão do nível: quando existe, o resultado de
`verificationScript` é o critério pedagógico. Assim, uma verificação pode
confirmar o objetivo mesmo que o último comando do aluno tenha retornado um
código diferente de zero.

Um nível sem `verificationScript` não é concluído automaticamente. No modo
sandbox não há verificação pedagógica nem progressão de nível; somente o
resultado do script do usuário é apresentado.

## Conteúdo educacional

`fullGuideHtml` contém diretamente o conteúdo HTML apresentado ao usuário. Como o HTML está armazenado dentro de uma string JSON, caracteres como aspas devem seguir o escaping normal de JSON.

Exemplo:

```json
{
    "fullGuideHtml": "<div class=\"terminal-display\">$ ls</div>"
}
```

## Dificuldade

Os valores atualmente utilizados em `difficulty` são:

| Valor       | Uso                                                 |
| ----------- | --------------------------------------------------- |
| `tutorial`  | Introdução guiada a comandos e conceitos.           |
| `training`  | Exercícios de aplicação dos conceitos apresentados. |
| `challenge` | Problemas que combinam múltiplos recursos.          |

## Ordem dos níveis

`levelOrder` contém os identificadores dos níveis na ordem de apresentação:

```json
{
    "levelOrder": [
        "01_ls_basics",
        "02_ls_options",
        "03_mkdir"
    ]
}
```

Cada entrada deve corresponder ao `id` de um item de `levels`.

Ao adicionar um nível que deve fazer parte da progressão, portanto, é necessário:

1. adicionar sua definição a `levels`;
2. adicionar seu `id` à posição desejada em `levelOrder`.

## Exemplo

```json
{
    "id": "example_mkdir",
    "title": "Criando uma pasta",
    "summary": "Crie uma pasta chamada exemplo.",
    "fullGuideHtml": "<h1>Criando uma pasta</h1><p>Use <strong>mkdir</strong> para criar a pasta <code>exemplo</code>.</p>",
    "setupScript": "rm -rf *",
    "verificationScript": "if [ -d exemplo ]; then echo 'OK'; exit 0; else echo 'A pasta exemplo não foi encontrada.'; exit 1; fi",
    "difficulty": "tutorial"
}
```

Seu identificador deve então ser incluído em `levelOrder`.

A definição da atividade pertence ao frontend. O backend apenas executa os scripts recebidos e retorna seus resultados; ele não interpreta conceitos como nível, dificuldade ou conclusão da atividade.

---

[← Voltar ao README principal](../README.md)
