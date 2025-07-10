// src/components/Hero.tsx
import React from 'react'

const Hero: React.FC = () => {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: '800px' }}>
        <h1 style={{ fontSize: '3rem', margin: 0 }}>Dustin Lee</h1>
        <p
          style={{
            fontSize: '1.25rem',
            color: '#555',
            marginTop: '1rem',
          }}
        >
          Software Engineer
        </p>
      </div>
    </section>
  )
}

export default Hero
