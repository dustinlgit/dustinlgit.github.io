import React from 'react'
import { useOnScreen } from '../../hooks/useOnScreen'

interface Project {
  title: string
  desc: string
  url: string
}

const ProjectCard: React.FC<{ project: Project }> = ({ project }) => {
  const [ref, visible] = useOnScreen()

  const baseStyle: React.CSSProperties = {
    backgroundColor: '#1e1e1e',
    padding: '1rem',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    color: '#eee',
    textAlign: 'left',
    fontSize: '1.3rem',
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0) scale(1)' : 'translateY(50px) scale(0.95)',
    transition: 'opacity 1.2s ease, transform 1.2s ease',
    willChange: 'transform',
  }

  return (
    <div
      ref={ref}
      style={baseStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)'
        e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = visible
          ? 'translateY(0) scale(1)'
          : 'translateY(50px) scale(0.95)'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'
      }}
    >
      <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{project.title}</h3>
      <p style={{ color: '#aaa' }}>{project.desc}</p>
      {project.url && (
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#61dafb', textDecoration: 'underline' }}
        >
          View on GitHub
        </a>
      )}
    </div>
  )
}

export default ProjectCard
