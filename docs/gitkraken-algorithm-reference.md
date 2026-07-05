# Referencia: Algoritmo de Layout do GitKraken (extraido do render.bundle.js)

> Fonte: `docs/app-extracted/src/render/static/entryPoints/main/render.bundle.js` (~12MB, minificado)
> Extraido via engenharia reversa do app.asar v12.2.1

---

## Localizacoes no bundle (offsets aproximados)

| Funcao | Offset | Descricao |
|---|---|---|
| `nextAvailableColumn` | ~11865670 | Encontra menor coluna livre |
| `getColumns(row)` | ~12165361 | Atribuicao de coluna para cada commit |
| `loadRowsbySha` | ~12167644 | Orquestra processamento de todas as rows |
| `loadEdgesBySha` | ~12159203 | Calcula edges apos colunas definidas |
| `getStartingEdgesByColumn` | proximo de loadEdgesBySha | Cria edges de cada row para seus pais |
| `getColumnColorByColumn` | ~12172436 | Mapeia coluna -> cor CSS |
| `getFinalEdgeStateForGraphAndRow` | proximo de loadEdgesBySha | Estado final das edges por row |

---

## Estruturas de estado (resetadas a cada processRows)

```
columnsUsed: { [colIndex]: true }          // bitmap esparso de colunas ocupadas
reserverInfoBySha: { [sha]: { type, newestDate, column } }  // reserva de coluna por filho
columnsToFreeWhenFound: { [sha]: [colIndices] }             // liberacao adiada
hasMergeNodeChildBySha: { [sha]: true }                     // tracking de merge nodes
pinnedBranchShas: Set<string>                               // SHAs da branch pinada (sempre col 0)
```

---

## Algoritmo de atribuicao de colunas

### nextAvailableColumn(columnsUsed, hasPinnedBranch)
```
col = hasPinnedBranch ? 1 : 0
while columnsUsed[col]: col++
columnsUsed[col] = true
return col
```
Sempre retorna a MENOR coluna livre. Simples.

### getColumns(row) — logica principal

**1. Liberar colunas adiadas**
```
if columnsToFreeWhenFound[row.sha]:
  for each col in columnsToFreeWhenFound[row.sha]:
    delete columnsUsed[col]
```

**2. Determinar coluna desta row**
```
if isPinnedBranch: column = 0
elif reserverInfoBySha[sha].column exists: column = reservado (filho ja reservou)
else: column = nextAvailableColumn()
```

**3. Reservar colunas para cada pai**

Para cada pai (parentIdx 0..N):

- **Primeiro pai (parentIdx=0)**: herda a coluna atual (`column`)
  - Se ja tem reserva de OUTRO filho em coluna DIFERENTE:
    - Se reserva existente > column atual: **ROUBO** — pai recebe coluna menor, antiga vai para deferredFrees
    - Se reserva existente <= column: mantem existente, column atual vai para deferredFrees
    - Condicao extra: `!hasMergeNodeChildBySha[parentSha]` (merge nodes nao sofrem roubo)
  
- **Pais secundarios (parentIdx>0)**: `nextAvailableColumn()` — **sempre menor coluna livre**
  - Se pai ja tem reserva: nao faz nada (mantem existente)
  - Se nao tem: aloca nova coluna

---

## Diferencas criticas vs nosso algoritmo (gitshark)

### 1. Alocacao de pais secundarios (CORRIGIDO)
- **GitKraken**: `nextAvailableColumn()` — menor coluna livre, comecando do 0
- **Nosso (antes)**: `allocLane(p, lane)` — busca outward do merge, preferindo direita
- **Fix**: removido `nearLane` → `allocLane(p)` usa first-fit igual GitKraken

### 2. Column stealing (NAO implementado, impacto baixo)
- GitKraken: quando dois filhos reservam colunas diferentes para o mesmo primeiro pai, o com coluna MENOR vence
- Nosso: `matches[0]` pega o mais a esquerda naturalmente, efeito similar

### 3. Liberacao de colunas
- GitKraken: `columnsToFreeWhenFound` — adiada ate o SHA aparecer
- Nosso: duplicatas liberadas imediatamente ao encontrar o commit (`matches[i>0] = null`)
- Efeito pratico similar

### 4. Pinned branch
- GitKraken: branch "pinada" sempre ocupa coluna 0, outras comecam da 1
- Nosso: nao implementado (nao necessario por enquanto)

---

## Sistema de cores

### Paleta (10 cores, ciclo modular)
```
0: #15A0BF (ciano)     5: #CD0101 (vermelho)
1: #0669F7 (azul)      6: #F25D2E (laranja)
2: #8E00C2 (roxo)      7: #F2CA33 (amarelo)
3: #C517B6 (magenta)   8: #7BD938 (verde)
4: #D90171 (rosa)      9: #2ECE9D (verde-agua)
```

Cor = `PALETTE[coluna % 10]`

### Variantes (blend com bg #1c1e23)
- **default** (chip bg normal): `blend(color, bg, 0.25)`
- **active** (branch atual): `blend(color, bg, 0.50)`
- **detail** (linhas, circulos): cor cheia da paleta

Formula: `result[i] = color[i] * mix + bg[i] * (1 - mix)`

### CSS vars do GitKraken
```
--column-{N}-color          cor da coluna N
--graph-color-{N}-f10       cor com 10% opacidade
--graph-color-{N}-f50       cor com 50% opacidade
--graph-row-height: 22px
--font-size: 62.5%          base rem
```

---

## Renderizacao de edges (nosso commit-graph.tsx)

### Tipos de elbow
- **First-parent crossing lanes** (`e.r === cL`): bottom-elbow (vertical na coluna do filho, curva na row do pai, horizontal)
- **Merge edge** (`e.r !== cL`): top-elbow (horizontal na row do merge, curva, vertical na coluna da branch)

### Parametros SVG
- `R_MAX = 10` — raio maximo do quarter-circle (Q bezier)
- `ROW_H = 22px`, `ROW_STRIDE = 28px` (22 + 6 gap)
- `LANE_W = 22px`, `GRAPH_PAD = 14px`
- Branch atual: `stroke-width="2.6"`, demais: `"2"`

---

## Arquivos relevantes no gitshark

| Arquivo | Responsabilidade |
|---|---|
| `electron/main.ts` | `computeLayout()` — algoritmo de lanes + edges |
| `src/sections/workspace/commit-graph/commit-graph.tsx` | Renderizacao SVG do grafo |
| `src/sections/workspace/commit-graph/commit-graph-ref-labels.tsx` | Chips de ref (branch/tag) |
| `src/sections/workspace/commit-graph/utils.ts` | Constantes, `chipBg()`, `laneX()`, `rowY()` |
| `src/sections/workspace/commit-graph/commit-graph-types.ts` | Types do componente |
| `src/sections/workspace/commit-graph/commit-graph-row.tsx` | Componente de row |
| `src/types/electron.ts` | Types do payload (RepoPayload, SlimCommit, etc) |
