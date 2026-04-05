import { useState, useCallback } from 'react';

interface ServidorFrequencia {
  id: number;
  nome: string;
  matricula: string;
  lotacao: string;
  funcao: string;
}

interface EspelhoFrequencia {
  nome: string;
  matricula: string;
  lotacao: string;
  funcao: string;
  mesReferencia: string;
  periodoInicio: string;
  periodoFim: string;
  tipoPeriodo: string;
  cnpj: string;
  dias: Array<{ dia: number; marcador: string; tipoMarcador: string }>;
  emEscala: boolean;
}

interface RelatorioResponse {
  geral: Array<{ nome: string; funcao: string }>;
  prestador: Array<{ nome: string; funcao: string }>;
}

interface SyncResponse {
  competencia: string;
  origem: string;
  totalPortal: number;
  totalInseridos: number;
  totalAtualizados: number;
  totalIgnorados: number;
  totalInativos: number;
}

export function useFrequencia() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Buscar servidores
  const buscarServidores = useCallback(
    async (termo?: string): Promise<ServidorFrequencia[]> => {
      try {
        setLoading(true);
        setError(null);
        const url = `/api/servidores/frequencia${termo ? `?termo=${encodeURIComponent(termo)}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao buscar servidores');
        }
        return await res.json();
      } catch (err) {
        const msg = (err as Error).message;
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Cadastrar servidor
  const cadastrarServidor = useCallback(
    async (dados: {
      nome: string;
      matricula: string;
      funcao: string;
      nivel?: string;
      lotacao?: string;
    }) => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/servidores/frequencia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados)
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao cadastrar servidor');
        }
        return await res.json();
      } catch (err) {
        const msg = (err as Error).message;
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Excluir servidor
  const excluirServidor = useCallback(async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/servidores/frequencia/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao excluir servidor');
      }
      return await res.json();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Listar escala
  const listarEscala = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/escala');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao listar escala');
      }
      return await res.json();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Alterar escala
  const alterarEscala = useCallback(
    async (dados: { matricula: string; nome?: string; remover?: boolean }) => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/escala', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados)
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao alterar escala');
        }
        return await res.json();
      } catch (err) {
        const msg = (err as Error).message;
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Gerar espelho individual
  const gerarEspelho = useCallback(
    async (dados: {
      mes: number;
      ano: number;
      servidorId?: number;
      matricula?: string;
      tipoPeriodo?: string;
      diasFacultativos?: Array<{ dia: number; descricao?: string }>;
    }): Promise<EspelhoFrequencia> => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/frequencia/espelho', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados)
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao gerar espelho');
        }
        return await res.json();
      } catch (err) {
        const msg = (err as Error).message;
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Gerar espelhos em lote
  const gerarEspelhoLote = useCallback(
    async (dados: {
      mes: number;
      ano: number;
      modo: 'branco' | 'preenchida';
      tipoPeriodo?: string;
      diasFacultativos?: Array<{ dia: number; descricao?: string }>;
    }) => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/frequencia/lote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados)
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao gerar lote');
        }
        return await res.json();
      } catch (err) {
        const msg = (err as Error).message;
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Buscar funções únicas
  const buscarFuncoes = useCallback(async (): Promise<string[]> => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/funcoes');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao buscar funções');
      }
      return await res.json();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Buscar relatório
  const buscarRelatorio = useCallback(async (): Promise<RelatorioResponse> => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/relatorio');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao buscar relatório');
      }
      return await res.json();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Sincronizar com portal
  const sincronizarPortal = useCallback(
    async (ano?: number, mes?: number): Promise<SyncResponse> => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/transparencia/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ano, mes })
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erro ao sincronizar');
        }
        return await res.json();
      } catch (err) {
        const msg = (err as Error).message;
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    buscarServidores,
    cadastrarServidor,
    excluirServidor,
    listarEscala,
    alterarEscala,
    gerarEspelho,
    gerarEspelhoLote,
    buscarFuncoes,
    buscarRelatorio,
    sincronizarPortal
  };
}
