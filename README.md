
# GitGraph — Graph de commits estilo GitKraken

App local e gratuito para visualizar o histórico de repositórios git com o layout do GitKraken: **branches/tags à esquerda, grafo colorido no meio, mensagem do commit à direita** — agora com **abas para até 5 repositórios** e botão para abrir pastas pelo **Explorador de Arquivos do Windows**.

Um único arquivo Python, sem dependências externas — só **Python 3.8+** (com tkinter, que já vem no instalador oficial do Windows) e **git** no PATH.

## Como usar

```bash
python gitgraph.py                 # abre a interface no navegador
python gitgraph.py C:\repos\x      # abre já com um repositório carregado
```

Na interface:

- **Abrir repositório** (ou `Ctrl+O`) → abre o seletor de pastas nativo do Windows
- Cada repositório vira uma **aba** (máximo de **5**); clique para alternar, `Ctrl+Tab` circula entre elas
- Abrir um repositório que já está em uma aba apenas alterna para ela (e recarrega os dados)
- **Atualizar** (ou `F5`) recarrega o repositório da aba ativa após novos commits
- **✕** na aba fecha o repositório
- Clique em um commit para ver detalhes (autor, data, hash copiável, refs)
- Fechar a aba do navegador encerra o app automaticamente

## Gerando o executável (.exe)

1. Coloque `gitgraph.py` e `build_exe.bat` na mesma pasta
2. Dê dois cliques em `build_exe.bat`
3. O executável fica em `dist\GitGraph.exe` — copie para onde quiser e crie um atalho

O `.exe` é autocontido (não precisa de Python instalado na máquina que for usá-lo), mas o **git** continua sendo necessário no PATH.

## O que ele mostra

- Lanes coloridas por branch, com curvas de merge/branch no estilo GitKraken
- Chips de branch: local (computador), remota (nuvem) e tags (etiqueta)
- Branch atual com ✓ e anel ao redor do commit do HEAD
- Linha `// WIP` no topo quando há alterações não commitadas
- Merges como nós vazados; commits normais com as iniciais do autor
- Barra de status com total de commits, branches locais e caminho do repositório

## Arquitetura (resumo)

O script sobe um servidor HTTP apenas em `127.0.0.1` (porta automática) e abre a interface no navegador padrão. O botão de abrir dispara o diálogo nativo via tkinter no lado do servidor; o grafo é calculado em Python (`git log --all --topo-order` + algoritmo de lanes) e renderizado em SVG no navegador. Um heartbeat encerra o processo quando a página é fechada — sem processos órfãos.
