export default function Header() {
  return (
    <header style={{
      backgroundColor: 'white',
      padding: '20px 40px',
      borderBottom: '1px solid #ddd',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>

      <h1 style={{
        fontSize: '28px',
        color: '#333',
        margin: '0'
      }}>
        Whiteboard
      </h1>
      
      <div>
        <button style={{
          backgroundColor: '#007bff',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '5px',
          marginRight: '10px',
          cursor: 'pointer',
          fontSize: '14px'
        }}>
          Войти
        </button>
        
        <button style={{
          backgroundColor: '#28a745',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '14px'
        }}>
          Регистрация
        </button>
      </div>
    </header>
  )
}