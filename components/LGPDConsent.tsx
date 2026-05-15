'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export default function LGPDConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Verifica se o usuário já deu o consentimento
    const consent = localStorage.getItem('lgpd_consent_v1')
    if (!consent) {
      // Pequeno atraso para não assustar o usuário assim que a página carrega
      const timer = setTimeout(() => setShow(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  function handleAccept() {
    localStorage.setItem('lgpd_consent_v1', 'true')
    setShow(false)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '20px 28px',
            maxWidth: '900px',
            width: '100%',
            boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            flexWrap: 'wrap'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(6, 182, 212, 0.2))',
              padding: '12px',
              borderRadius: '14px',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(37, 99, 235, 0.2)'
            }}>
              <ShieldCheck size={28} />
            </div>

            <div style={{ flex: 1, minWidth: '280px' }}>
              <h4 style={{
                color: 'white',
                margin: '0 0 4px',
                fontSize: '16px',
                fontWeight: '700',
                fontFamily: 'Plus Jakarta Sans, sans-serif'
              }}>
                Aviso de Privacidade e LGPD
              </h4>
              <p style={{
                color: '#94a3b8',
                fontSize: '13px',
                margin: 0,
                lineHeight: '1.6'
              }}>
                A SMS Conceição preza pela segurança dos seus dados de saúde. Utilizamos cookies essenciais para o funcionamento do sistema em conformidade com a Lei Geral de Proteção de Dados (LGPD). Ao continuar navegando, você declara estar ciente de nossa <Link href="/privacidade" style={{ color: '#3b82f6', textDecoration: 'underline', fontWeight: '600' }}>Política de Privacidade</Link> e nossos <Link href="/termos" style={{ color: '#3b82f6', textDecoration: 'underline', fontWeight: '600' }}>Termos de Uso</Link>.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleAccept}
                className="btn-primary"
                style={{
                  padding: '12px 28px',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 8px 20px rgba(37, 99, 235, 0.3)'
                }}
              >
                ESTOU CIENTE E CONCORDO
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
