# ShellBlocks

Um ambiente interativo de programação visual para ensinar **linha de comando, Shell e composição de comandos**.

O **ShellBlocks** utiliza blocos visuais, em uma abordagem semelhante ao Scratch, para tornar conceitos de interfaces de linha de comando mais acessíveis. Em vez de exigir que o usuário memorize imediatamente a sintaxe textual, a estrutura dos comandos é representada visualmente, permitindo compreender como comandos, opções, operandos, operadores e estruturas de controle se relacionam.

O projeto busca funcionar como uma ponte entre programação visual e o uso direto de ambientes de linha de comando. Atualmente, o ambiente de execução e as definições disponíveis são voltados ao ecossistema Linux/Unix, mas a arquitetura não pretende limitar o ShellBlocks a uma única plataforma ou Shell.

O código correspondente aos blocos é gerado pela aplicação e pode ser executado em um ambiente isolado.

## Funcionalidades principais

* **Programação visual com Blockly:** comandos e estruturas Shell podem ser construídos através de blocos.
* **Geração de Shell em tempo real:** o workspace visual é serializado para uma representação semântica e convertido em código Shell.
* **Validação semântica:** cardinalidade, tipos de operandos, conflitos entre opções e outras restrições podem ser detectados ainda durante a construção visual.
* **Arquitetura orientada a dados:** comandos, opções, operandos, operadores e estruturas de controle são descritos declarativamente.
* **Fases educacionais:** níveis, estado da sessão e lógica de validação das fases são tratados pelo frontend.
* **Execução isolada:** os scripts são executados em containers Docker efêmeros, sem acesso à rede e com limites de CPU, memória e tempo.
* **Frontend Single File:** a SPA inteira é empacotada pelo Vite em um único arquivo HTML.
* **Artefato final único:** o build integra o frontend ao backend e gera `dist/shellblocks-server.js`.

## Arquitetura

O ShellBlocks é escrito em **TypeScript** tanto no frontend quanto no backend.

A aplicação possui uma separação simples de responsabilidades.

### Frontend

O frontend concentra a lógica específica do ShellBlocks:

* interface e integração com Blockly;
* construção dinâmica dos blocos;
* metadata semântica dos blocos;
* serialização do workspace;
* representação em AST;
* geração de Shell;
* validações e correções automáticas;
* definições de comandos;
* definições de níveis;
* execução e apresentação dos resultados;
* estado e persistência da sessão;
* lógica educacional das fases.

As definições estáticas utilizadas pela aplicação ficam diretamente no frontend, incluindo:

```text
frontend/src/assets/data/
├── cli_definitions.json
└── levels.json
```

O backend não mantém uma segunda implementação dessas regras.

### Backend

O backend é deliberadamente pequeno e possui responsabilidades de infraestrutura:

* servir a SPA compilada;
* expor `POST /api/run`;
* garantir a disponibilidade da imagem Docker usada para execução;
* executar scripts Shell em ambiente isolado;
* retornar `stdout`, `stderr` e `exitCode`.

A inteligência que determina o significado dos comandos, o funcionamento dos níveis e os critérios de uma fase permanece no frontend.

O servidor fornece essencialmente a capacidade que o navegador não pode oferecer diretamente: executar Shell real em um ambiente Linux controlado.

## Stack tecnológica

### Frontend

* TypeScript
* Google Blockly
* Vite
* HTML
* CSS

O frontend é uma SPA. Durante o build, seus scripts, estilos e assets são consolidados em um único `index.html`.

### Backend

* TypeScript
* Node.js
* Express
* Docker

O backend expõe uma API mínima e também hospeda o frontend compilado.

## Estrutura do projeto

Uma visão resumida da organização atual:

```text
.
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   │   └── data/
│   │   ├── config/
│   │   ├── core/
│   │   │   ├── persistence/
│   │   │   ├── shellblocks/
│   │   │   └── utils/
│   │   ├── pages/
│   │   │   └── features/
│   │   └── types/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── server.ts
│   │   └── types.d.ts
│   └── package.json
│
├── docs/
├── build_project.sh
├── build_project.ps1
└── dist/
    └── shellblocks-server.js
```

No frontend, `core/shellblocks` contém o núcleo reutilizável responsável pela representação e pelo funcionamento dos blocos. A camada `pages/features` concentra funcionalidades específicas da aplicação educacional, como execução, sessão e interface da página.

## Modelo do frontend

Os blocos não são tratados apenas como elementos gráficos.

O ShellBlocks mantém informação semântica associada a eles e utiliza uma representação intermediária antes da geração do Shell.

O fluxo principal é:

```text
Blockly Workspace
       ↓
metadata e representação semântica
       ↓
AST
       ↓
geração de Shell
       ↓
POST /api/run
       ↓
sandbox Docker
```

Isso separa:

* representação visual;
* semântica dos blocos;
* estrutura do programa;
* geração textual de Shell;
* execução.

## Validação

A validação estrutural e semântica ocorre no frontend, próxima ao workspace e às operações que podem alterar seu estado.

Entre as regras suportadas estão:

### Cardinalidade

Operandos podem estabelecer quantidades mínimas e máximas permitidas.

Quando uma alteração produz operandos excedentes, o ShellBlocks pode corrigir o workspace automaticamente, desconectando os blocos que violam a cardinalidade.

### Opções conflitantes

Definições de comandos podem estabelecer opções mutuamente exclusivas.

Quando uma combinação inválida é formada, o sistema pode remover o conflito e manter o comando em um estado coerente.

### Sintaxe de valores

Operandos e opções podem possuir regras próprias de validação, incluindo restrições de formato e mensagens específicas de erro.

### Tipos e conexões

Os blocos carregam informação suficiente para restringir encaixes incompatíveis e representar diferenças semânticas entre elementos do Shell.

## Arquitetura orientada a dados

Grande parte do comportamento do ShellBlocks é definido declarativamente.

`cli_definitions.json` descreve conceitos como:

* comandos;
* opções;
* operandos;
* cardinalidades;
* validações;
* operadores;
* estruturas de controle;
* metadata de apresentação e geração.

A partir dessas definições, o frontend constrói os blocos e aplica o comportamento correspondente.

Isso permite ampliar a linguagem visual sem precisar implementar manualmente um novo componente para cada comando simples.

## Fases e níveis

Os níveis ficam em:

```text
frontend/src/assets/data/levels.json
```

A lógica educacional da fase também pertence ao frontend.

Quando uma fase precisa executar comandos ou verificar efeitos no ambiente Linux, o frontend envia ao mesmo endpoint de execução os scripts necessários.

O backend não conhece conceitos como "fase concluída" ou "nível correto". Ele apenas executa o que recebeu e retorna o resultado.

## Referência dos arquivos de configuração

Os formatos dos principais arquivos JSON usados para configurar e personalizar o ShellBlocks são documentados separadamente:

* [`cli_definitions.json`](docs/cli_definitions.md)
* [`levels.json`](docs/levels.md)

Esses documentos descrevem a estrutura, os campos disponíveis e o comportamento associado a cada formato, servindo como referência para configurar ou estender o ShellBlocks sem alterar diretamente sua implementação.

## API de execução

O backend possui um único endpoint de aplicação:

```http
POST /api/run
```

A requisição pode conter:

```ts
{
    userScript,
    setupCommands,
    verificationScript
}
```

Cada parte possui uma responsabilidade distinta:

* `setupCommands`: prepara o estado inicial necessário para a execução;
* `userScript`: script produzido pelo usuário;
* `verificationScript`: script opcional utilizado para verificar o estado resultante.

A decisão sobre quais scripts devem ser enviados pertence ao frontend.

A resposta segue a estrutura:

```ts
interface ExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
```

## Sandbox de execução

Cada chamada utiliza um novo container Docker baseado em Alpine Linux.

A imagem inclui Bash e utilitários utilizados pelos exercícios, como:

* GNU coreutils;
* grep;
* sed;
* awk;
* Python;
* curl;
* ping.

A execução utiliza atualmente:

```text
rede:    desabilitada
memória: 100 MB
CPU:     0.5
timeout: 30 segundos
```

O container é iniciado com `--rm`, portanto é descartado após a execução.

### Imagem Docker

Na inicialização, o backend verifica se existe uma imagem chamada:

```text
blockly-shell-env
```

Caso ela ainda não exista, o próprio servidor realiza seu build.

A definição da imagem está embutida no backend, portanto não é necessário manter um `Dockerfile` separado apenas para o sandbox.

O servidor também realiza uma pequena execução de aquecimento durante a inicialização.

## Build

O projeto possui scripts de build para Linux/macOS e PowerShell:

```text
build_project.sh
build_project.ps1
```

No Linux/macOS:

```sh
./build_project.sh
```

O processo principal possui três etapas.

### 1. Build do frontend

As dependências são instaladas e o Vite compila a aplicação.

O plugin Single File utilizado pelo projeto consolida a SPA em:

```text
frontend/dist/index.html
```

Esse arquivo contém o frontend necessário para executar a aplicação.

### 2. Integração com o backend

O HTML compilado é copiado para uma área intermediária de build do backend:

```text
backend/build/frontend/index.html
```

O backend importa esse arquivo diretamente:

```ts
import frontendPage from "../build/frontend/index.html";
```

As rotas que não correspondem à API recebem esse HTML, permitindo que o mesmo processo Node hospede a SPA.

### 3. Build do backend

O backend é compilado e empacotado em:

```text
backend/dist/server.js
```

O script de build copia então esse resultado para o diretório de distribuição do projeto:

```text
dist/shellblocks-server.js
```

O artefato final da aplicação é, portanto:

```text
./dist/shellblocks-server.js
```

## Executando

### Pré-requisitos

Para executar o artefato final são necessários:

* Node.js;
* Docker Engine.

O Docker deve estar instalado, em execução e acessível pelo usuário que inicia o ShellBlocks.

Depois do build:

```sh
node dist/shellblocks-server.js
```

Por padrão, o servidor utiliza:

```text
http://localhost:7000
```

A porta pode ser alterada através da variável de ambiente `PORT`.

## Desenvolvimento

Para desenvolver o projeto são necessários:

* Node.js;
* npm;
* Docker Engine.

Frontend e backend possuem seus próprios `package.json` e `tsconfig.json`.

O frontend concentra a maior parte da lógica da aplicação. O backend deve permanecer uma camada pequena responsável por hospedagem e execução isolada.

## Objetivo do projeto

O ShellBlocks não pretende substituir o terminal.

Seu objetivo é funcionar como uma ponte entre programação visual e uso real da linha de comando.

O usuário trabalha com os mesmos conceitos que posteriormente encontrará no Shell textual:

* comandos;
* argumentos;
* opções;
* pipes;
* composição;
* estruturas de controle;
* efeitos sobre o sistema de arquivos.

A diferença está na interface inicial: a estrutura e a semântica dos comandos podem ser compreendidas visualmente antes que toda a sintaxe precise ser memorizada.
