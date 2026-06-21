'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function APACPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/bpa?tab=apac')
  }, [router])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9', alignItems: 'center', justifyContent: 'center', fontFamily: 'Sora, sans-serif', color: '#64748b', fontSize: '14px' }}>
      Redirecionando para o módulo BPA...
    </div>
  )
}
