import React from 'react'
import ProjectCard from './projectCards'

const projects = [
  {
    title: 'MovieMate',
    desc: 'Find a movie, rate the movie, and share it with others.',
    url: 'https://github.com/dustinlgit/MovieMate',
  },
  {
    title: 'wing-it',
    desc: 'A swipe based way for you to find your next travel destination.',
    url: 'https://github.com/dustinlgit/wing-it',
  },
  {
    title: 'financify',
    desc: 'Figure out your finances and budget them accordingly.',
    url: 'https://github.com/dustinlgit/financify',
  },
  {
    title: 'derivative calculator',
    desc: 'A fully functional derivative calculator made with C++.',
    url: 'https://github.com/dustinlgit/derivative-calculator',
  },
  { title: 'ai bot', desc: '', url: '' },
  { title: 'trading bot', desc: '', url: '' },
]

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
