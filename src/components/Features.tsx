import FeatureCard from './FeatureCard'

export default function Features() {
  return (
    <section style={{
      padding: '60px 40px',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '30px'
      }}>
        <FeatureCard 
          title="Создание заметок"
          description="Добавляйте текстовые заметки, списки дел и важные мысли. Организуйте информацию визуально на виртуальной доске."
        />
        
        <FeatureCard 
          title="Организация идей"
          description="Группируйте связанные заметки, создавайте категории и структурируйте свои мысли логично."
        />

        <FeatureCard 
          title="Быстрый доступ"
          description="Все ваши заметки в одном месте. Быстро находите нужную информацию и редактируйте на ходу."
        />
      </div>
    </section>
  )
}