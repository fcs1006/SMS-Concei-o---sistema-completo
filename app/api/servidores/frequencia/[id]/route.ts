import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * DELETE /api/servidores/frequencia/[id]
 * Exclui servidor de frequência
 */
/**
 * PUT /api/servidores/frequencia/[id]
 * Atualiza dados de um servidor
 */
export async function PUT(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const id = params?.id || request.url.split('/').pop();

    if (!id) {
      return NextResponse.json({ error: 'ID de servidor inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { nome, funcao, matricula, nivel, situacao } = body;

    if (!nome?.trim() || !funcao?.trim() || !matricula?.trim()) {
      return NextResponse.json({ error: 'Nome, função e matrícula são obrigatórios' }, { status: 400 });
    }

    const payload: Record<string, string> = {
      nome: String(nome).trim(),
      funcao: String(funcao).trim(),
      matricula: String(matricula).trim(),
      nivel: String(nivel || '').trim(),
    };
    if (situacao !== undefined) payload.situacao = String(situacao || '').trim();

    const { data, error } = await supabase
      .from('servidores')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const id = params?.id || request.url.split('/').pop();

    if (!id) {
      return NextResponse.json(
        { error: 'ID de servidor inválido' },
        { status: 400 }
      );
    }

    // Buscar servidor
    const { data: servidor, error: getError } = await supabase
      .from('servidores')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !servidor) {
      return NextResponse.json(
        { error: 'Servidor não encontrado' },
        { status: 404 }
      );
    }

    // Deletar servidor
    const { error: deleteError } = await supabase
      .from('servidores')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Remover de escala também (se estiver)
    const matNorm = String(servidor.matricula || '').toUpperCase().trim();
    if (matNorm) {
      await supabase.from('escala').delete().eq('matricula_normalizada', matNorm);
    }

    return NextResponse.json({
      nome: servidor.nome,
      matricula: servidor.matricula,
      id: servidor.id
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
