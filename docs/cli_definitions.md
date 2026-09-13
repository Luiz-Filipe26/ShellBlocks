# `cli_definitions.json`

O arquivo `frontend/src/assets/data/cli_definitions.json` descreve declarativamente os elementos de linha de comando disponibilizados pelo ShellBlocks.

A partir dessas definições, o frontend pode construir blocos, apresentar informações ao usuário, validar determinadas combinações e gerar a representação textual correspondente.

Isso permite adicionar ou alterar comandos simples e outros elementos da linguagem visual principalmente por configuração, sem exigir a implementação manual de um novo componente para cada caso.

## Estrutura geral

O arquivo possui a seguinte estrutura:

```json
{
    "$schema": "./cli_schema.json",
    "commands": [],
    "operators": [],
    "controls": [],
    "categories": []
}
```

As quatro coleções representam:

* `commands`: comandos disponíveis no ShellBlocks;
* `operators`: operadores que conectam ou modificam comandos;
* `controls`: estruturas de controle;
* `categories`: organização dos elementos exibidos ao usuário.

## Comandos

Cada item de `commands` descreve um comando disponível na linguagem visual.

Exemplo simplificado:

```json
{
    "id": "ls",
    "shellCommand": "ls",
    "label": "ls",
    "description": "Lista o conteúdo de diretórios.",
    "color": "#5b80a5",
    "optionColor": "#7fbf7f",
    "options": [],
    "operands": []
}
```

### Campos de um comando

| Campo                         | Descrição                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `id`                          | Identificador interno do comando.                                                                             |
| `shellCommand`                | Texto utilizado para representar o comando no Shell gerado.                                                   |
| `label`                       | Nome apresentado na interface.                                                                                |
| `description`                 | Descrição apresentada ao usuário.                                                                             |
| `color`                       | Cor associada ao bloco do comando.                                                                            |
| `optionColor`                 | Cor utilizada pelos blocos de opção do comando, quando definida.                                              |
| `options`                     | Lista de opções aceitas pelo comando.                                                                         |
| `operands`                    | Lista de operandos aceitos pelo comando.                                                                      |
| `exclusiveOptions`            | Grupos de opções que não podem ser utilizados simultaneamente.                                                |
| `operandIdsSequenceDelimiter` | Delimitador usado para representar a sequência de identificadores de operandos durante a validação sintática. |
| `operandSyntaxRules`          | Regras adicionais para validar a ordem dos operandos.                                                         |

Nem todos os campos opcionais precisam estar presentes em todos os comandos.

## Opções

O campo `options` descreve flags e opções associadas a um comando.

Exemplo:

```json
{
    "flag": "-a",
    "longFlag": "--all",
    "description": "Mostra todas as entradas, incluindo as ocultas."
}
```

Uma opção pode também receber um argumento:

```json
{
    "flag": "--width",
    "description": "Controla a largura da saída, em caracteres.",
    "argument": {
        "type": "number",
        "label": "Largura da tela",
        "defaultValue": "80",
        "validations": [
            {
                "regex": "^[1-9][0-9]*$",
                "errorMessage": "A largura deve ser um número inteiro positivo."
            }
        ]
    }
}
```

### Campos de uma opção

| Campo         | Descrição                                                      |
| ------------- | -------------------------------------------------------------- |
| `flag`        | Representação principal da opção.                              |
| `longFlag`    | Forma longa alternativa da opção, quando disponível.           |
| `description` | Explicação apresentada ao usuário.                             |
| `argument`    | Configuração de um valor exigido pela opção, quando aplicável. |

### Argumentos de opções

Um `argument` pode conter:

| Campo          | Descrição                                                              |
| -------------- | ---------------------------------------------------------------------- |
| `type`         | Tipo do valor esperado. Atualmente são utilizados `string` e `number`. |
| `label`        | Nome apresentado para o argumento.                                     |
| `defaultValue` | Valor inicial, quando definido.                                        |
| `validations`  | Validações adicionais aplicadas ao valor.                              |

## Opções mutuamente exclusivas

O campo `exclusiveOptions` permite declarar opções que não podem aparecer simultaneamente.

Exemplo:

```json
{
    "exclusiveOptions": [
        ["-t", "-S"]
    ]
}
```

Nesse caso, `-t` e `-S` pertencem ao mesmo grupo de exclusão e não devem ser utilizadas ao mesmo tempo.

## Operandos

O campo `operands` descreve os valores posicionais aceitos por um comando.

Exemplo:

```json
{
    "id": "directory",
    "label": "Diretório",
    "description": "Diretório para o qual navegar.",
    "color": "#a67f5f",
    "type": "folder",
    "defaultValue": "~",
    "cardinality": {
        "min": 1,
        "max": 1
    }
}
```

### Campos de um operando

| Campo          | Descrição                                |
| -------------- | ---------------------------------------- |
| `id`           | Identificador interno do operando.       |
| `label`        | Nome apresentado na interface.           |
| `description`  | Explicação apresentada ao usuário.       |
| `color`        | Cor associada ao bloco, quando definida. |
| `type`         | Tipo semântico do valor.                 |
| `defaultValue` | Valor inicial, quando definido.          |
| `cardinality`  | Quantidade mínima e máxima permitida.    |
| `validations`  | Validações adicionais do valor.          |

Os tipos atualmente utilizados para operandos são:

```text
string
number
file
folder
```

## Cardinalidade

A cardinalidade define quantas ocorrências de um determinado operando são permitidas.

Exemplo:

```json
{
    "cardinality": {
        "min": 1,
        "max": "unlimited"
    }
}
```

`min` determina a quantidade mínima exigida.

`max` pode receber um número ou `"unlimited"` quando não existe um limite superior definido pelo formato.

Por exemplo:

```json
{
    "min": 1,
    "max": 1
}
```

representa exatamente uma ocorrência, enquanto:

```json
{
    "min": 0,
    "max": "unlimited"
}
```

representa um operando opcional e repetível.

## Validações de valores

Operandos e argumentos de opções podem declarar validações baseadas em expressão regular.

Exemplo:

```json
{
    "validations": [
        {
            "regex": "^[1-9][0-9]*$",
            "errorMessage": "A largura deve ser um número inteiro positivo."
        }
    ]
}
```

Cada validação possui:

| Campo          | Descrição                                      |
| -------------- | ---------------------------------------------- |
| `regex`        | Expressão regular que o valor deve satisfazer. |
| `errorMessage` | Mensagem exibida quando a validação falha.     |

Essas validações representam restrições declaradas pelo próprio elemento e são aplicadas pelo frontend.

## Ordem dos operandos

Alguns comandos possuem mais de um tipo de operando e precisam restringir a ordem em que eles aparecem.

Para esses casos são utilizados:

```json
{
    "operandIdsSequenceDelimiter": "-",
    "operandSyntaxRules": []
}
```

O ShellBlocks representa a sequência dos operandos por seus identificadores, separados pelo valor definido em `operandIdsSequenceDelimiter`.

Por exemplo, em um comando com operandos `source` e `destination`, uma sequência pode ser representada como:

```text
source-source-destination-
```

As regras em `operandSyntaxRules` são então avaliadas sobre essa representação.

Exemplo:

```json
{
    "regexPattern": "(source-)+destination-",
    "errorMessage": null
}
```

Uma regra com `errorMessage: null` representa uma sequência válida.

Também podem ser declaradas regras que identificam erros específicos:

```json
{
    "regexPattern": "destination-(source-)+",
    "errorMessage": "O 'Destino' deve ser sempre o último bloco do comando cp."
}
```

Isso permite que o ShellBlocks forneça uma mensagem específica para determinadas construções inválidas.

## Operadores

O campo `operators` descreve elementos que combinam comandos ou modificam seu fluxo.

Entre os operadores atualmente definidos estão:

```text
|
>
>>
&&
||
&
```

Exemplo simplificado:

```json
{
    "id": "pipe",
    "label": "| (Pipe)",
    "description": "Redireciona a saída do comando anterior para a entrada do próximo.",
    "color": "#b1745b",
    "slots": [
        {
            "name": "A",
            "type": "statement",
            "check": "command"
        },
        {
            "name": "B",
            "type": "statement",
            "check": "command",
            "symbol": "|",
            "symbolPlacement": "before"
        }
    ],
    "slotsWithImplicitData": ["B"]
}
```

### Campos de um operador

| Campo                   | Descrição                                                               |
| ----------------------- | ----------------------------------------------------------------------- |
| `id`                    | Identificador interno do operador.                                      |
| `label`                 | Nome apresentado na interface.                                          |
| `description`           | Descrição do comportamento do operador.                                 |
| `color`                 | Cor associada ao bloco.                                                 |
| `slots`                 | Entradas que compõem o operador.                                        |
| `slotsWithImplicitData` | Slots que recebem dados implicitamente de outro elemento da composição. |

## Slots de operadores

Cada slot descreve uma posição ocupada por outro elemento.

Exemplo:

```json
{
    "name": "B",
    "type": "statement",
    "check": "command",
    "symbol": "|",
    "symbolPlacement": "before"
}
```

Os campos atualmente utilizados são:

| Campo             | Descrição                                                                            |
| ----------------- | ------------------------------------------------------------------------------------ |
| `name`            | Identificador do slot.                                                               |
| `type`            | Forma de conexão. Atualmente são utilizados `statement` e `value`.                   |
| `check`           | Tipo de elemento aceito no slot.                                                     |
| `symbol`          | Texto inserido na geração do Shell para esse slot.                                   |
| `symbolPlacement` | Define se `symbol` aparece antes (`before`) ou depois (`after`) do conteúdo do slot. |

Por exemplo, o operador de redirecionamento utiliza um slot de comando e um slot de valor do tipo `file`.

## Estruturas de controle

O campo `controls` descreve estruturas de controle representáveis visualmente.

Atualmente o arquivo contém estruturas como `if` e `while`.

Exemplo simplificado:

```json
{
    "id": "if_statement",
    "shellCommand": "if",
    "label": "if",
    "description": "Executa comandos condicionalmente baseado no sucesso de um comando teste.",
    "color": "#dbaa25",
    "syntaxEnd": "fi",
    "slots": []
}
```

### Campos de uma estrutura de controle

| Campo          | Descrição                                                      |
| -------------- | -------------------------------------------------------------- |
| `id`           | Identificador interno.                                         |
| `shellCommand` | Comando ou palavra-chave que inicia a estrutura.               |
| `label`        | Nome apresentado na interface.                                 |
| `description`  | Descrição apresentada ao usuário.                              |
| `color`        | Cor do bloco.                                                  |
| `syntaxEnd`    | Texto utilizado para encerrar a estrutura na geração do Shell. |
| `slots`        | Partes que compõem a estrutura.                                |

## Slots de estruturas de controle

Os slots das estruturas de controle possuem informações adicionais relacionadas à geração de sintaxe.

Exemplo:

```json
{
    "name": "DO",
    "type": "statement",
    "check": "command",
    "label": "Então faça (then):",
    "syntaxPrefix": "; then",
    "obligatory": true
}
```

Campos utilizados:

| Campo             | Descrição                                               |
| ----------------- | ------------------------------------------------------- |
| `name`            | Identificador interno do slot.                          |
| `type`            | Forma de conexão do slot.                               |
| `check`           | Tipo de elemento permitido.                             |
| `label`           | Texto apresentado na interface.                         |
| `syntaxPrefix`    | Texto gerado antes do conteúdo do slot.                 |
| `breakLineBefore` | Indica se deve haver uma quebra de linha antes do slot. |
| `obligatory`      | Indica se o slot é obrigatório.                         |

## Categorias

O campo `categories` controla a organização dos elementos na interface.

Exemplo:

```json
{
    "name": "Diretórios",
    "commands": [
        "ls",
        "cd",
        "mkdir"
    ]
}
```

Cada categoria possui:

| Campo      | Descrição                                               |
| ---------- | ------------------------------------------------------- |
| `name`     | Nome apresentado ao usuário.                            |
| `commands` | Identificadores dos elementos pertencentes à categoria. |

Apesar do nome `commands`, essa lista também pode referenciar operadores e estruturas de controle.

Por exemplo, as categorias de fluxo e lógica podem conter identificadores como:

```text
pipe
redirect_out
and
if_statement
while_loop
```

## Exemplo: adicionando um comando simples

Um comando simples pode ser definido diretamente em `commands`.

Por exemplo:

```json
{
    "id": "pwd",
    "shellCommand": "pwd",
    "label": "pwd",
    "description": "Exibe o diretório de trabalho atual.",
    "color": "#5b80a5",
    "optionColor": "#7fbf7f",
    "options": [],
    "operands": []
}
```

Para que ele seja apresentado em uma categoria existente, seu identificador também deve ser incluído na categoria desejada:

```json
{
    "name": "Diretórios",
    "commands": [
        "ls",
        "cd",
        "mkdir",
        "pwd"
    ]
}
```

A definição exata necessária depende do comportamento do elemento. Recursos que exigem lógica não representável pelo formato declarativo podem exigir alterações no código do ShellBlocks.

## Localização

O arquivo utilizado atualmente pela aplicação está em:

```text
frontend/src/assets/data/cli_definitions.json
```

Esta documentação descreve o formato utilizado pela versão atual do ShellBlocks. Alterações no modelo de dados devem ser refletidas neste documento.

---

[← Voltar ao README principal](../README.md)
