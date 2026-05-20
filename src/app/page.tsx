import Header from '@/components/main_page/Header'
import Hero from '@/components/main_page/Hero'
import Features from '@/components/main_page/Features'
import Footer from '@/components/main_page/Footer'

export default function MainPage() {
  return (
    <div style={{
      backgroundColor: '#f5f5f5',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Header />
      <Hero />
      <Features />
      <Footer />
    </div>
  )
}