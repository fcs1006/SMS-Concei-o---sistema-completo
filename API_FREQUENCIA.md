# APIs de Frequência — Documentação

Todas as APIs estão em `/app/api/` e implementam a lógica do Google Apps Script em Next.js com Supabase.

## 🔌 Endpoints Principais

### 1. **Escala de Servidores**

#### GET `/api/escala`
Lista todos os servidores em escala.

```typescript
GET /api/escala
Response: Array<{ matricula, nome, matricula_normalizada }>
```

#### POST `/api/escala`
Adiciona ou remove servidor da escala.

```typescript
POST /api/escala
Body: { matricula: string, nome?: string, remover?: boolean }
Response: { matricula, nome, emEscala, acao }
```

---

### 2. **Servidores de Frequência**

#### GET `/api/servidores/frequencia`
Lista servidores com filtro opcional por termo.

```typescript
GET /api/servidores/frequencia?termo=busca
Response: Array<{ id, nome, matricula, lotacao, funcao }>
```

#### POST `/api/servidores/frequencia`
Cadastra novo servidor.

```typescript
POST /api/servidores/frequencia
Body: {
  nome: string,
  matricula: string,
  funcao: string,
  nivel?: string,
  lotacao?: string
}
Response: { id, nome, matricula, funcao, nivel, lotacao, ativo }
```

#### DELETE `/api/servidores/frequencia/[id]`
Exclui servidor e remove de escala.

```typescript
DELETE /api/servidores/frequencia/123
Response: { id, nome, matricula }
```

---

### 3. **Frequência — Espelho Individual**

#### POST `/api/frequencia/espelho`
Gera espelho de frequência para um servidor.

```typescript
POST /api/frequencia/espelho
Body: {
  mes: number (1-12),
  ano: number,
  servidorId?: number,
  matricula?: string,
  tipoPeriodo?: 'mes_inteiro' | 'competencia_23_22',
  diasFacultativos?: Array<{ dia: number, descricao?: string }>
}
Response: {
  nome, matricula, lotacao, funcao,
  mesReferencia, periodoInicio, periodoFim,
  tipoPeriodo, cnpj, dias, emEscala
}
```

As datas retornadas estão em formato **DD/MM/YYYY**.

---

### 4. **Frequência — Lote**

#### POST `/api/frequencia/lote`
Gera frequências para todos os servidores (filtrados por escala).

```typescript
POST /api/frequencia/lote
Body: {
  mes: number (1-12),
  ano: number,
  modo: 'branco' | 'preenchida',
  tipoPeriodo?: 'mes_inteiro' | 'competencia_23_22',
  diasFacultativos?: Array<{ dia: number, descricao?: string }>
}
Response: {
  modo, criterio, total, totalBase,
  mesReferencia, tipoPeriodo,
  espelhos: Array<[objeto frequência]>
}
```

- **modo='branco'**: gera folhas em branco para servidores em escala
- **modo='preenchida'**: gera folhas preenchidas para servidores NÃO em escala

---

### 5. **Funções Únicas**

#### GET `/api/funcoes`
Lista todas as funções/cargos únicos de servidores ativos.

```typescript
GET /api/funcoes
Response: Array<string>
```

---

### 6. **Relatório de Frequência**

#### GET `/api/relatorio`
Separar servidores ativos de prestadores para relatório.

```typescript
GET /api/relatorio
Response: {
  geral: Array<{ nome, funcao }>,
  prestador: Array<{ nome, funcao }>
}
```

---

### 7. **Sincronização com Portal de Transparência**

#### POST `/api/transparencia/sync`
Sincroniza servidores do portal com base local.

```typescript
POST /api/transparencia/sync
Body: { ano?: number, mes?: number }
Response: {
  competencia,
  origem,
  totalPortal,
  totalInseridos,
  totalAtualizados,
  totalIgnorados,
  totalInativos
}
```

**Regras de sync:**
- ✅ Insere novos servidores encontrados
- ✅ Atualiza dados de quem já existe
- ✅ Marca como INATIVO quem sumiu
- 🔒 PRESTADORES (NIVEL = PRESTADOR) nunca são alterados

---

## 📁 Estrutura de Utilidades

### `/app/api/utils/constants.ts`
Configurações de frequência, transparência e chaves.

### `/app/api/utils/helpers.ts`
Funções utilitárias:
- `normalizarTexto()` — Remove acentos, espaços e converte para maiúscula
- `formatarDataBr()` — Formata para DD/MM/YYYY
- `encontrarIndiceColuna()` — Busca coluna por sinônimos
- `normalizarDiasFacultativos()` — Normaliza lista de dias
- `calcularDomingoPascoa()` — Calcula Páscoa pelo algoritmo de Computus
- `adicionarDias()` — Soma dias a uma data
- `obterFeriadosNacionaisFallback()` — Retorna feriados fixos e móveis
- `fetchJsonApi()` — Fetch com tratamento de erro

### `/app/api/utils/frequencia.ts`
Funções especializadas:
- `montarPeriodoFrequencia()` — Monta período (mes_inteiro ou competencia_23_22)
- `montarGradePeriodoFrequencia()` — Cria grade com feriados, fins de semana, facultativos
- `ehEscala()` — Verifica se servidor está em escala
- `limparMarcadoresDias()` — Remove marcadores de dias

---

## 🔐 Autenticação

As APIs usam `SUPABASE_SERVICE_ROLE_KEY` (servidor) para acesso ao banco.  
No cliente, use `createClient()` com `NEXT_PUBLIC_SUPABASE_URL` e chave pública.

---

## 📊 Modelos de Dados (Supabase)

### Tabela `servidores`
```
id: number (PK)
nome: string
matricula: string
funcao: string
lotacao: string
nivel: string (PRESTADOR | vazio)
status: string (ATIVO | INATIVO)
tipoVinculo: string
dataAdmissao: string
situacao: string
obs: string
ativo: boolean
criadoEm: timestamp
atualizadoEm: timestamp
```

### Tabela `escala`
```
id: number (PK)
matricula: string
matricula_normalizada: string (chave de busca)
nome: string
criadoEm: timestamp
```

---

## 🚀 Próximos Passos

1. Criar tabelas no Supabase (Migration SQL)
2. Integrar APIs no componente `/app/frequencia/page.jsx`
3. Adicionar hooks customizados para consumir as APIs
