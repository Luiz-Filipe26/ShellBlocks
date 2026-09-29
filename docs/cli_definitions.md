# `cli_definitions.json`

O arquivo `frontend/src/assets/data/cli_definitions.json` descreve os comandos,
operadores, controles e categorias disponíveis no ShellBlocks. O JSON Schema do
formato fica no mesmo diretório, em `cli_schema.json`.

O arquivo é uma interface de configuração: coleções vazias e valores com default
natural podem ser omitidos. Antes de criar o workspace, o ShellBlocks valida a
estrutura, as referências e as demais invariantes e produz um modelo interno
normalizado. Definições inválidas não são aplicadas nem salvas como customização.

## Estrutura geral

```json
{
    "$schema": "./cli_schema.json",
    "commands": [],
    "operators": [],
    "controls": [],
    "categories": []
}
```

`commands` e `categories` são obrigatórios. `operators` e `controls` podem ser
omitidos.

Identificadores de comandos, operadores, controles, operandos e slots usam:

```regex
^[A-Za-z0-9_-]+$
```

IDs de comandos, operadores e controles são únicos entre as três coleções. IDs
de operandos são únicos no comando; nomes de slots são únicos no operador ou
controle. Os IDs do JSON são identidades de domínio. Os tipos técnicos
registrados no Blockly recebem namespaces internos e não devem ser escritos no
arquivo.

## Comandos

Exemplo mínimo:

```json
{
    "id": "pwd",
    "shellCommand": "pwd",
    "label": "pwd",
    "color": "#5b80a5"
}
```

| Campo | Obrigatório | Significado |
| --- | --- | --- |
| `id` | sim | Identidade estável e explícita do comando. |
| `shellCommand` | sim | Texto emitido para iniciar o comando no Shell. |
| `label` | sim | Nome mostrado na interface. |
| `color` | sim | Cor-base do bloco em hexadecimal `#RRGGBB`. |
| `description` | não | Ajuda textual. Ausência equivale a `""`. |
| `optionColor` | não | Cor dos blocos de option; herda `color` quando ausente. |
| `options` | não | Options aceitas; ausência equivale a `[]`. |
| `exclusiveOptions` | não | Grupos de options mutuamente exclusivas; ausência equivale a `[]`. |
| `operands` | não | Operandos posicionais; ausência equivale a `[]`. |
| `operandIdsSequenceDelimiter` | condicional | Delimitador da sequência usada pelas regras sintáticas. |
| `operandSyntaxRules` | não | Regras ordenadas de combinação e ordem; ausência equivale a `[]`. |

`id` e `shellCommand` são independentes: alterar a grafia gerada não deve mudar
a identidade do comando ou seus blocos.

## Options

```json
{
    "flag": "--width",
    "longFlag": "--output-width",
    "description": "Controla a largura da saída.",
    "argument": {
        "type": "number",
        "label": "Largura",
        "defaultValue": "80",
        "allowEmptyValue": false,
        "validations": [
            {
                "regex": "^[1-9][0-9]*$",
                "errorMessage": "Use um inteiro positivo."
            }
        ]
    }
}
```

`flag` é obrigatória, identifica a option e é a grafia emitida no Shell.
`longFlag` é somente um alias informativo mostrado na interface; não é
selecionável e não é usado em referências. `description` é opcional e equivale a
`""` quando omitida.

Quando `argument` existe, a option exige um valor textual. Dentro de `argument`,
`type` e `label` são obrigatórios;
`defaultValue`, `allowEmptyValue` e `validations` seguem o contrato comum de
valores escalares descrito abaixo.

Flags canônicas devem ser únicas no comando. Nenhuma `flag` ou `longFlag` pode
colidir com outra grafia de option do mesmo comando.

### Exclusividade

```json
{
    "exclusiveOptions": [
        ["-t", "-S"]
    ]
}
```

Cada grupo possui ao menos duas flags canônicas distintas e todas devem existir
no comando. Aliases `longFlag` não são aceitos nessas referências. Uma option
pode integrar mais de um grupo.

## Operandos e cardinalidade

```json
{
    "id": "directory",
    "label": "Diretório",
    "description": "Diretório de destino.",
    "type": "folder",
    "defaultValue": "~",
    "cardinality": {
        "min": 1,
        "max": 1
    }
}
```

`id`, `label`, `type` e `cardinality` são obrigatórios. `description` equivale a
`""` quando omitida. `color` é opcional e herda a cor do comando.

A cardinalidade é individual por tipo de operando:

- `min` é inteiro maior ou igual a zero;
- `max` é inteiro maior ou igual a um ou a string `"unlimited"`;
- um `max` finito deve ser maior ou igual a `min`.

A contagem considera os blocos presentes, independentemente do texto de seus
campos. Não existem contagens mínimas agregadas de options ou operandos.

Um operando pode declarar:

```json
{
    "optionalWithImplicitInput": true
}
```

Quando entrada implícita realmente alcança o comando, essa propriedade reduz
somente o mínimo efetivo daquele operando para zero. O máximo não muda, nenhum
operando virtual é criado e as regras sintáticas continuam avaliando somente os
operandos explicitamente presentes.

## Valores escalares

Argumentos de options, operandos e slots `value` de operadores compartilham o
mesmo modelo. Seus tipos semânticos são:

```text
string
number
file
folder
```

Todos os valores armazenados continuam sendo strings. `valueType`/`type` não
aplica automaticamente validação numérica, de arquivo ou de diretório e não
seleciona widgets especiais.

`defaultValue` é uma string opcional e equivale a `""` quando omitida.
`allowEmptyValue` é opcional e seu default é `true`. Assim, string vazia é um
valor real e, por padrão, válido. Quando `allowEmptyValue` é `false`, o bloco
registra erro de validação, sem impedir a edição do campo.

Um valor vazio válido é preservado na AST e emitido como argumento Shell vazio
(`''`), em vez de desaparecer da geração.

### Validações por regex

```json
{
    "validations": [
        {
            "regex": "^[1-9][0-9]*$",
            "errorMessage": "Use um inteiro positivo."
        }
    ]
}
```

`validations` pode ser omitido e equivale a `[]`. Cada regex precisa compilar e
cada mensagem precisa ser não vazia. A aplicação usa a semântica normal de
`RegExp.test()`: correspondência parcial é permitida, e o autor inclui `^` e `$`
quando deseja correspondência integral. Todas as regras declaradas são
avaliadas; elas registram erros, mas não rejeitam a digitação.

## Regras sintáticas de operandos

Comandos que restringem combinações ou ordem podem codificar a sequência de IDs
e avaliá-la com regras ordenadas:

```json
{
    "operandIdsSequenceDelimiter": ">",
    "operandSyntaxRules": [
        {
            "regexPattern": "(source>)+destination>",
            "errorMessage": null
        },
        {
            "regexPattern": "destination>(source>)+",
            "errorMessage": "O destino deve ser o último operando."
        }
    ]
}
```

O delimitador é acrescentado literalmente depois de cada ID, inclusive o
último. A sequência de um `source` seguido de `destination` é, portanto:

```text
source>destination>
```

O delimitador deve ser não vazio e não pode conter letras, dígitos, `_`, `-` ou
`:`, mas não precisa ser `>`. Se possuir significado especial em regex, o autor
deve escapá-lo no `regexPattern`.

Quando há regras, o delimitador é obrigatório e deve existir ao menos uma regra
de aceitação. As regras usam *first match wins*:

- `errorMessage: null` aceita a sequência;
- uma string não vazia produz o erro específico;
- se nenhuma regra casar, o ShellBlocks produz o erro genérico de combinação.

Cada pattern é aplicado à expressão inteira como se fosse envolvido por
`^(?: ... )$`. Esse comportamento é diferente das regex de validação de valores.

## Operadores

```json
{
    "id": "pipe",
    "label": "| (Pipe)",
    "description": "Conecta a saída à entrada do próximo comando.",
    "color": "#b1745b",
    "slots": [
        {
            "name": "A",
            "type": "statement"
        },
        {
            "name": "B",
            "type": "statement",
            "symbol": "|",
            "symbolPlacement": "before"
        }
    ],
    "slotsWithImplicitData": ["B"]
}
```

`id`, `label`, `color` e `slots` são obrigatórios. `description` equivale a
`""`. `slots` deve possuir ao menos um item. Todos os slots modelados são
obrigatórios para a integridade do operador.

Há dois tipos distintos de slot:

- `statement`: uma conexão para comandos e composições ShellBlocks;
- `value`: um slot textual, sem conexão para outro bloco.

Um statement slot não declara `check`: o core define a conexão executável. Um
value slot declara `valueType` e pode usar `defaultValue`, `allowEmptyValue` e
`validations` conforme o contrato comum de valores escalares.

Exemplo de redirecionamento:

```json
{
    "name": "DESTINATION",
    "type": "value",
    "valueType": "file",
    "allowEmptyValue": false,
    "symbol": ">",
    "symbolPlacement": "before"
}
```

Se `symbol` existir, `symbolPlacement` é obrigatório e aceita `before` ou
`after`. Se `symbol` não existir, `symbolPlacement` também não pode existir.

`slotsWithImplicitData` pode ser omitido e equivale a `[]`. Cada item deve
referenciar, sem duplicação, um statement slot do próprio operador. O conteúdo
colocado nesse slot recebe dados implicitamente, como stdin no lado direito de
um pipe. A propagação também considera composições de pipes encadeadas.
Em operadores aninhados, o primeiro slot `statement` é o caminho pelo qual a
entrada implícita recebida da composição externa é propagada ao conteúdo do
operador. Portanto, a ordem dos slots `statement` é semanticamente relevante
para essa propagação.

## Controles

```json
{
    "id": "if_statement",
    "shellCommand": "if",
    "label": "if",
    "color": "#dbaa25",
    "syntaxEnd": "fi",
    "slots": [
        {
            "name": "CONDITION",
            "label": "Se (comando):",
            "syntaxPrefix": "",
            "obligatory": true
        },
        {
            "name": "ELSE",
            "label": "Senão (else):",
            "syntaxPrefix": "else ",
            "breakLineBefore": true,
            "obligatory": false
        }
    ]
}
```

`id`, `shellCommand`, `label`, `color`, `syntaxEnd` e `slots` são obrigatórios.
`syntaxEnd` não pode ser vazio e `slots` deve possuir ao menos um item.

Slots de controles são sempre statement inputs e não declaram `type`, `check`,
`symbol` ou `symbolPlacement`. Cada slot exige `name` e `obligatory`.
`syntaxPrefix` e `label` são opcionais. `breakLineBefore` é opcional e equivale a
`false`; quando verdadeiro, a quebra é gerada antes do prefixo e do conteúdo do
slot.

## Categorias

```json
{
    "name": "Fluxo",
    "entities": ["pipe", "redirect_out"]
}
```

`entities` pode referenciar comandos, operadores e controles. Ela pode ser
omitida e equivale a `[]`.

- uma referência inexistente torna a configuração inválida;
- repetir a mesma entidade na mesma categoria é inválido;
- uma entidade pode aparecer em várias categorias;
- uma entidade sem categoria é válida, mas produz warning de configuração.

## Validação e customizações

O JSON Schema verifica shape, tipos e restrições locais. O validador semântico
verifica relações como unicidade, referências, colisões de flags, cardinalidade,
slots implícitos, cobertura de categorias e compilação das regex.

O mesmo processo é aplicado ao arquivo oficial, a uploads e a definições
recuperadas do armazenamento local. Erros de configuração rejeitam o conjunto
inteiro. Warnings, como entidade sem categoria, permitem o uso da configuração.

Erros de configuração pertencem à definição carregada e podem impedir seu uso.
Já erros como cardinalidade ausente, slot vazio, valor inválido e combinação
sintática inválida pertencem aos blocos do workspace e são reportados pelo
mecanismo de validação dos blocos.

---

[← Voltar ao README principal](../README.md)
