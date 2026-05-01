# Guia de Integração - APIs de Frequência

## 🎯 Objetivo

Converter o código do Google Apps Script para APIs Next.js com Supabase, mantendo a mesma funcionalidade.

## 📋 Checklist de Implementação

- [ ] **1. Criar tabelas no Supabase**
  - Executar SQL em `migrations/001_criar_tabelas_frequencia.sql`
  - Validar se todas as tabelas foram criadas

- [ ] **2. Configurar Variáveis de Ambiente**
  - `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `.env.local`: `SUPABASE_SERVICE_ROLE_KEY` (para APIs do servidor)

- [ ] **3. Importar Dados Existentes**
  - Se tem dados em Google Sheets, exportar como CSV
  - Importar no Supabase via Dashboard ou script de migration

- [ ] **4. Remover Dependências do Google Apps Script**
  - Remover referências a `PropertiesService`
  - Remover referências a `SpreadsheetApp`
  - Remover referências a `UrlFetchApp`

- [ ] **5. Integrar APIs no Frontend**
  - Atualizar `/app/frequencia/page.jsx`
  - Criar hooks customizados em `/hooks/`
  - Testar cada endpoint

- [ ] **6. Testes e Validação**
  - Testar busca de servidores
  - Testar escala (adicionar/remover)
  - Testar geração de espelho
  - Testar geração em lote
  - Testar sincronização com portal

---

## 🔄 Mapeamento: Google Apps Script → Next.js APIs

| Função Original | Novo Endpoint | Descrição |
|---|---|---|
| `buscarServidoresFrequencia()` | GET `/api/servidores/frequencia?termo=` | Lista servidores com filtro |
| `alterarEscalaServidor()` | POST `/api/escala` | Adiciona/remove da escala |
| `listarEscala()` | GET `/api/escala` | Lista escala |
| `gerarEspelhoFrequencia()` | POST `/api/frequencia/espelho` | Gera espelho individual |
| `gerarFrequenciasEmLote()` | POST `/api/frequencia/lote` | Gera em lote |
| `cadastrarServidorFrequencia()` | POST `/api/servidores/frequencia` | Cadastra servidor |
| `excluirServidorFrequencia()` | DELETE `/api/servidores/frequencia/[id]` | Exclui servidor |
| `buscarRelatorioFrequencia()` | GET `/api/relatorio` | Relatório |
| `buscarFuncoesBaseFP()` | GET `/api/funcoes` | Lista funções únicas |
| `sincronizarServidoresTransparencia()` | POST `/api/transparencia/sync` | Sincroniza portal |

---

## 💾 Integração com `/app/frequencia/page.jsx`

### Exemplo: Buscar Servidores

**Antes (Google Apps Script):**
```javascript
google.script.run.withSuccessHandler(onSuccess)
  .buscarServidoresFrequencia(termo);
```

**Depois (Next.js):**
```typescript
const { data: servidores } = await fetch(
  `/api/servidores/frequencia?termo=${termo}`
).then(r => r.json());
```

### Exemplo: Adicionar Servidor à Escala

**Antes:**
```javascript
google.script.run.withSuccessHandler(onSuccess)
  .alterarEscalaServidor({ matricula, nome }, usuario, senha);
```

**Depois:**
```typescript
const response = await fetch('/api/escala', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ matricula, nome })
});
const data = await response.json();
```

### Exemplo: Gerar Espelho

**Antes:**
```javascript
google.script.run.withSuccessHandler(onSuccess)
  .gerarEspelhoFrequencia({
    mes: 4,
    ano: 2026,
    servidorId: 123,
    diasFacultativos: []
  }, usuario, senha);
```

**Depois:**
```typescript
const response = await fetch('/api/frequencia/espelho', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mes: 4,
    ano: 2026,
    servidorId: 123,
    diasFacultativos: []
  })
});
const espelho = await response.json();
```

---

## 🪝 Hooks Customizados (Recomendado)

Criar em `/hooks/useFrequencia.ts`:

```typescript
import { useState, useCallback } from 'react';

export function useFrequencia() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarServidores = useCallback(async (termo?: string) => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/servidores/frequencia${termo ? `?termo=${termo}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erro ao buscar servidores');
      return await res.json();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const gerarEspelho = useCallback(async (dados: any) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/frequencia/espelho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
      if (!res.ok) throw new Error('Erro ao gerar espelho');
      return await res.json();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, buscarServidores, gerarEspelho };
}
```

Usar no componente:

```typescript
'use client'
import { useFrequencia } from '@/hooks/useFrequencia';

export default function Frequencia() {
  const { loading, error, buscarServidores, gerarEspelho } = useFrequencia();

  // ... resto do componente
}
```

---

## 🗄️ Estrutura de Diretórios Após Implementação

```
/app
  /api
    /escala
      route.ts
    /funcoes
      route.ts
    /frequencia
      /espelho
        route.ts
      /lote
        route.ts
    /relatorio
      route.ts
    /servidores
      /frequencia
        route.ts
        /[id]
          route.ts
    /transparencia
      /sync
        route.ts
    /utils
      constants.ts
      frequencia.ts
      helpers.ts
  frequencia
    page.jsx
  
/hooks
  useFrequencia.ts
  
/migrations
  001_criar_tabelas_frequencia.sql

API_FREQUENCIA.md
INTEGRACAO.md (este arquivo)
```

---

## 🔒 Removendo Autenticação (Se Usar PropertiesService)

**Antes:** Todas funções exigiam `usuario` e `senha`
```javascript
function gerarEspelhoFrequencia(dados, usuario, senha) {
  exigirLogin(usuario, senha);
  // ...
}
```

**Depois:** Use middleware Next.js ou verificações JWT

Criar em `/app/api/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*']
};
```

---

## 📝 Próximos Passos

1. **Executar migração SQL** no Supabase
2. **Configurar variáveis de ambiente**
3. **Criar hooks customizados**
4. **Atualizar componente frequencia/page.jsx**
5. **Testar cada API em isolation**
6. **Integrar com componentes existentes**
7. **Validar dados e tratamento de erro**

---

## 📞 Troubleshooting

### Erro: "NEXT_PUBLIC_SUPABASE_URL is undefined"
- Verificar `.env.local`
- Variável deve começar com `NEXT_PUBLIC_` para client
- Reiniciar servidor: `npm run dev`

### Erro: "Service role key missing"
- Verificar `SUPABASE_SERVICE_ROLE_KEY` em `.env.local` (não public)
- Chave deve estar apenas no servidor, não exposta ao cliente

### Erro: "RLS policy violation"
- Verificar políticas de segurança em `Supabase Dashboard > Auth > Policies`
- Ajustar claims do JWT se necessário

### Dados não sincronizam com Portal
- Verificar se API do portal está online
- Conferir `CODIGO_ORGAO_SAUDE` em constants
- Checar logs em `logs_sincronizacao`
