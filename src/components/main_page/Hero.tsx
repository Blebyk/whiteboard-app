import Link from 'next/link'

export default function Hero() {
  return (
    <main style={{
      padding: '60px 40px',
      textAlign: 'center',
      flex: 1
    }}>
      <h1 style={{
        fontSize: '48px',
        color: '#333',
        marginBottom: '20px',
        fontWeight: 'bold'
      }}>
        Создавайте и делитесь досками
      </h1>
      
      <p style={{
        fontSize: '20px',
        color: '#666',
        marginBottom: '40px',
        maxWidth: '600px',
        margin: '0 auto 40px auto',
        lineHeight: '1.6'
      }}>
        Совместная работа стала проще. Добавляйте заметки, 
        чтобы команда синхронизировалась по всем задачам.
      </p>

      <Link href='/register' style={{textDecoration: 'none' }}>
        <button style={{
          backgroundColor: '#007bff',
          color: 'white',
          padding: '15px 30px',
          border: 'none',
          borderRadius: '8px',
          fontSize: '18px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}>
          Начать работу
        </button>
      </Link>
    </main>
  )
}