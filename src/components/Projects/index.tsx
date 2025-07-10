import React from 'react'
import ProjectCard from './projectCards'
import { projects } from './projectData'

const Projects: React.FC = () => {
  return (
    <section style={{ padding: '4rem 2rem' }}>
      <h2
        style={{
          fontSize: '2rem',
          textAlign: 'center',
          marginBottom: '2rem',
          color: '#fff',
        }}
      >
        Projects
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(450px, 450px))',
          gap: '1.5rem',
          justifyContent: 'center',
        }}
      >
        {projects.map((project, index) => (
          <ProjectCard key={index} project={project} />
        ))}
      </div>
    </section>
  )
}

export default Projects
