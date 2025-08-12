import { useCallback, useEffect, useRef, useState } from 'react'
import Modal from './components/Modal'
import Sidebar from './components/Sidebar'


type Project = {
  id: number
  name: string
  notes: string
  total: number // seconds
  running: boolean
  rate?: number
  startTime?: number
}

export default function LightTimerApp() {
  const [projects, setProjects] = useState<Project[]>([
    { id: 1, name: 'Website Redesign', notes: 'Landing + blog', total: 0, running: false },
    { id: 2, name: 'Logo Suite', notes: 'Brand pack', total: 0, running: false },
    { id: 3, name: 'Consult Hour', notes: 'Client call & notes', total: 0, running: false },
  ])

  const [rate, setRate] = useState<number>(20)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [modal, setModal] = useState<null | 'addProject' | 'deleteProject' | 'setRate'>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const tickRef = useRef<number | null>(null)
  const touchStartRef = useRef<number | null>(null)

  useEffect(() => {
    tickRef.current = window.setInterval(() => {
      // trigger re-render while running to update timers
      setProjects((prev) => prev.map((p) => ({ ...p })))
    }, 1000)

    return () => {
      if (tickRef.current !== null) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
    }
  }, [])

  function startTimer(id: number) {
    const now = Date.now()
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, running: true, startTime: now } : p))
    )
  }

  function stopTimer(id: number) {
    const now = Date.now()
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === id && p.running && p.startTime) {
          const delta = Math.round((now - p.startTime) / 1000) // seconds
          return { ...p, running: false, total: p.total + delta, startTime: undefined }
        }
        return p
      })
    )
  }

  function addProject(name: string, notes: string) {
    const newProject = { id: Date.now(), name, notes, total: 0, running: false }
    setProjects((prev) => [...prev, newProject])
    setCurrentIndex(projects.length)
    setModal(null)
  }

  function deleteProject() {
    if (selectedProjectId === null) return
    const projectIndex = projects.findIndex((p) => p.id === selectedProjectId)

    setProjects((prev) => prev.filter((p) => p.id !== selectedProjectId))
    setModal(null)
    setSelectedProjectId(null)
  }

  function setProjectRate(newRate: number) {
    if (selectedProjectId === null) return
    setProjects((prev) =>
      prev.map((p) => (p.id === selectedProjectId ? { ...p, rate: newRate } : p))
    )
    setModal(null)
    setSelectedProjectId(null)
  }

  function formatSeconds(totalSeconds: number) {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  function projectCurrentElapsed(p: Project) {
    if (!p.running || !p.startTime) return p.total
    const now = Date.now()
    const delta = Math.round((now - p.startTime) / 1000)
    return p.total + delta
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartRef.current = e.touches[0].clientX
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartRef.current === null) return
    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStartRef.current - touchEnd
    if (diff > 50) {
      nextProject()
      touchStartRef.current = null
    }

    if (diff < -50) {
      prevProject()
      touchStartRef.current = null
    }
  }

  const nextProject = useCallback(() => {
    if (projects.length < 2) return
    setCurrentIndex((prev) => (prev === projects.length - 1 ? 0 : prev + 1))
  }, [projects.length])

  const prevProject = useCallback(() => {
    if (projects.length < 2) return
    setCurrentIndex((prev) => (prev === 0 ? projects.length - 1 : prev - 1))
  }, [projects.length])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (modal) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevProject()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        nextProject()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [modal, nextProject, prevProject])

  const totalSeconds = projects.reduce((acc, p) => acc + projectCurrentElapsed(p), 0)
  const totalEarnings = projects.reduce((acc, p) => {
    const projectRate = p.rate ?? rate
    const earnings = (projectCurrentElapsed(p) / 3600) * projectRate
    return acc + earnings
  }, 0)

  const projectColors = ['bg-sky-50', 'bg-emerald-50', 'bg-amber-50', 'bg-fuchsia-50', 'bg-rose-50', 'bg-indigo-50'];

  function handleSidebarProjectClick(projectId: number) {
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex !== -1) {
      setCurrentIndex(projectIndex);
    }
  }

  return (
    <div className="h-screen bg-gray-50 text-gray-900 font-sans flex">
      <Sidebar 
        projects={projects} 
        projectColors={projectColors} 
        onProjectClick={handleSidebarProjectClick}
      />
      <div className="flex-grow flex flex-col pl-16">
        {/* Header */}
        <header className="sticky top-0 bg-white border-b border-gray-200 z-20">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">BillTick</h1>
              <p className="text-sm text-gray-500">
                Start a timer on projects, track hours, and bill with ease.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-600">Rate / hr</div>
              <input
                aria-label="Hourly rate"
                type="number"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value) || 0)}
                className="w-20 p-2 rounded-md border border-gray-200 bg-gray-50 text-sm"
              />
              <button
                onClick={() => setModal('addProject')}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                + New
              </button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-grow flex flex-col items-center w-full px-4 py-6 gap-8">
          {/* Overview card */}
          <section className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 w-full max-w-4xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Total tracked</div>
                <div className="text-2xl font-medium">{formatSeconds(totalSeconds)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Estimated earnings</div>
                <div className="text-xl font-semibold">${totalEarnings.toFixed(2)}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Tip: Tap a project to start a timer. Tap again to stop. Use desktop keyboard shortcuts later (coming soon).
            </div>
          </section>

          {/* Projects carousel */}
          <section className="relative w-full max-w-sm mx-auto flex items-center justify-center flex-grow pb-8">
            {projects.length > 1 && (
              <button
                onClick={prevProject}
                className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-16 bg-white/50 hover:bg-white rounded-full p-3 shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 z-10"
                aria-label="Previous project"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            <div
              className="overflow-hidden relative h-full w-full"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
            >
              {projects.map((p, i) => (
                <article
                  key={p.id}
                  className={`absolute top-0 left-0 w-full h-full rounded-2xl p-6 border border-gray-200 shadow-xl transition-all duration-500 ease-in-out flex flex-col ${
                    projectColors[i % projectColors.length]
                  }`}
                  style={{
                    transform: `translateX(${(i - currentIndex) * 110}%) scale(${
                      i === currentIndex ? 1 : 0.9
                    })`,
                    opacity: i === currentIndex ? 1 : 0.4,
                    zIndex: i === currentIndex ? 10 : 1,
                    transitionProperty: 'transform, opacity',
                  }}
                  role="group"
                >
                  {/* Header */}
                  <header className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{p.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{p.notes}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedProjectId(p.id)
                          setModal('setRate')
                        }}
                        className="p-2 rounded-full text-gray-400 hover:bg-black/10 hover:text-gray-600 transition-colors"
                        aria-label="Set project rate"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 01 0 7H6"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedProjectId(p.id)
                          setModal('deleteProject')
                        }}
                        className="p-2 rounded-full text-gray-400 hover:bg-black/10 hover:text-gray-600 transition-colors"
                        aria-label="Delete project"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
                  </header>

                  {/* Body */}
                  <div
                    className="my-auto text-center flex flex-col justify-center items-center cursor-pointer"
                    onClick={() => (p.running ? stopTimer(p.id) : startTimer(p.id))}
                  >
                    <div className="text-5xl font-mono tracking-tighter text-gray-800">
                      {formatSeconds(projectCurrentElapsed(p))}
                    </div>
                    <div className="text-lg font-semibold text-gray-600">
                      ${((projectCurrentElapsed(p) / 3600) * (p.rate ?? rate)).toFixed(2)}
                    </div>
                  </div>

                  {/* Footer */}
                  <footer className="mt-auto">
                    {p.running ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          stopTimer(p.id)
                        }}
                        className="w-full py-3 rounded-lg bg-red-500 text-white text-lg font-semibold shadow-lg hover:bg-red-600 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400"
                        aria-pressed={p.running}
                      >
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          startTimer(p.id)
                        }}
                        className="w-full py-3 rounded-lg bg-green-600 text-white text-lg font-semibold shadow-lg hover:bg-green-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-400"
                      >
                        Start
                      </button>
                    )}
                  </footer>
                </article>
              ))}
            </div>

            {projects.length > 1 && (
              <button
                onClick={nextProject}
                className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-16 bg-white/50 hover:bg-white rounded-full p-3 shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 z-10"
                aria-label="Next project"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </section>
        </main>
      </div>

      {/* Modals */}
      <AddProjectModal
        isOpen={modal === 'addProject'}
        onClose={() => setModal(null)}
        onAdd={addProject}
      />
      <DeleteProjectModal
        isOpen={modal === 'deleteProject'}
        onClose={() => setModal(null)}
        onDelete={deleteProject}
        projectName={projects.find((p) => p.id === selectedProjectId)?.name || ''}
      />
      <SetRateModal
        isOpen={modal === 'setRate'}
        onClose={() => setModal(null)}
        onSetRate={setProjectRate}
        currentRate={
          projects.find((p) => p.id === selectedProjectId)?.rate ?? rate
        }
      />
    </div>
  )
}

function AddProjectModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean
  onClose: () => void
  onAdd: (name: string, notes: string) => void
}) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onAdd(name, notes)
    setName('')
    setNotes('')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Project">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="projectName" className="text-sm font-medium text-gray-700 block mb-1">
            Project Name
          </label>
          <input
            type="text"
            id="projectName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-300"
            placeholder="e.g., Website Redesign"
            required
          />
        </div>
        <div>
          <label htmlFor="projectNotes" className="text-sm font-medium text-gray-700 block mb-1">
            Notes (Optional)
          </label>
          <input
            type="text"
            id="projectNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-300"
            placeholder="e.g., Client, specific tasks"
          />
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white"
          >
            Add Project
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DeleteProjectModal({
  isOpen,
  onClose,
  onDelete,
  projectName,
}: {
  isOpen: boolean
  onClose: () => void
  onDelete: () => void
  projectName: string
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Project">
      <p>
        Are you sure you want to delete the project{' '}
        <strong className="font-semibold">{projectName}</strong>? This action is
        irreversible.
      </p>
      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="px-4 py-2 rounded-lg bg-red-600 text-white"
        >
          Delete
        </button>
      </div>
    </Modal>
  )
}

function SetRateModal({
  isOpen,
  onClose,
  onSetRate,
  currentRate,
}: {
  isOpen: boolean
  onClose: () => void
  onSetRate: (newRate: number) => void
  currentRate: number
}) {
  const [newRate, setNewRate] = useState(currentRate)

  useEffect(() => {
    setNewRate(currentRate)
  }, [currentRate])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newRate >= 0) {
      onSetRate(newRate)
    } else {
      alert('Please enter a valid, non-negative rate.')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set Hourly Rate">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="projectRate" className="text-sm font-medium text-gray-700 block mb-1">
            Hourly Rate ($)
          </label>
          <input
            type="number"
            id="projectRate"
            value={newRate}
            onChange={(e) => setNewRate(Number(e.target.value))}
            className="w-full p-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-300"
            placeholder="e.g., 25"
            required
            min="0"
            step="0.01"
          />
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white"
          >
            Set Rate
          </button>
        </div>
      </form>
    </Modal>
  )
}
