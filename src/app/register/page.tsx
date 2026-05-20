import Header from '@/components/registration_page/Header'
import Register from '@/components/registration_page/Register'
import Footer from '@/components/registration_page/Footer'

export default function RegisterPage() {
  return (
    <div style={{
      backgroundColor: '#f5f5f5',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Header />
      <Register />
      <Footer />
    </div>
  )
}