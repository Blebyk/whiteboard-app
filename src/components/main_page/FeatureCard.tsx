interface FeatureCardProps {
  title: string;
  description: string;
}

export default function FeatureCard({ title, description }: FeatureCardProps) {
  return (
    <div style={{
      backgroundColor: 'white',
      padding: '30px',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{
        fontSize: '24px',
        color: '#333',
        marginBottom: '15px'
      }}>
        {title}
      </h3>
      
      <p style={{
        fontSize: '16px',
        color: '#666',
        lineHeight: '1.5'
      }}>
        {description}
      </p>
    </div>
  )
}