import React from 'react'

const Contact: React.FC = () => {
  return (
    <section style={{ padding: '4rem 2rem', textAlign: 'center', color: '#fff' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Contact Me Here</h2>
      <p style={{ fontSize: '1.2rem', maxWidth: '1000px', margin: '0 auto 2rem', color: '#ccc' }}>
        I'm always open to discussing new projects, creative ideas, or opportunities. Feel free to reach out.
      </p>
      <div style={{ fontSize: '1.1rem', lineHeight: '1.8', color: '#aaa' }}>
        <p>
          <strong>Email:</strong>{' '}
          <a href="mailto:leeddustin@gmail.com" style={{ color: '#61dafb' }}>
            leeddustin@gmail.com
          </a>
        </p>
        <p>
          <strong>LinkedIn:</strong>{' '}
          <a
            href="https://linkedin.com/in/dustinlee"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#61dafb' }}
          >
            linkedin.com/in/dustinlee
          </a>
        </p>
        <p>
          <strong>Location:</strong> Based in Los Angeles, CA & Irvine, CA
        </p>
      </div>
    </section>
  )
}

export default Contact
