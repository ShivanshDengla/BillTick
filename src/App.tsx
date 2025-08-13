import { useCallback, useEffect, useRef, useState } from 'react'
import Modal from './components/Modal'
import Sidebar from './components/Sidebar'
import SignUp from './components/SignUp'
import ForgotPassword from './components/ForgotPassword'
import ResetPassword from './components/ResetPassword'
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'


// New: session type to capture individual work sessions with notes
type Session = {
  id: number
  durationSeconds: number
  notes: string
  startedAt?: number
  endedAt: number
}

type Project = {
  id: number
  name: string
  notes: string
  total: number // seconds
  running: boolean
  rate?: number
  startTime?: number
  sessions: Session[]
}

export default function LightTimerApp() {
  // Add print-specific CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body * {
          visibility: hidden;
        }
        .print-only, .print-only * {
          visibility: visible !important;
        }
        .print-only {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [projects, setProjects] = useState<Project[]>([
    { id: 1, name: 'Website Redesign', notes: 'Company Name', total: 0, running: false, sessions: [] },
    { id: 2, name: 'Logo Suite', notes: 'Brand pack', total: 0, running: false, sessions: [] },
    { id: 3, name: 'Consult Hour', notes: 'Client call & notes', total: 0, running: false, sessions: [] },
  ])

  const [rate, setRate] = useState<number>(20)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [modal, setModal] = useState<null | 'addProject' | 'deleteProject' | 'setRate'>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const tickRef = useRef<number | null>(null)
  const touchStartRef = useRef<number | null>(null)
  // New: control session notes modal
  const [sessionNotesModal, setSessionNotesModal] = useState<{ projectId: number; sessionId: number } | null>(null)
  // New: control inline editing of project names and notes
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingNotes, setEditingNotes] = useState('')
  const [editingField, setEditingField] = useState<'name' | 'notes' | null>(null)

  // Authentication state
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState<string>('')
  const [authSuccess, setAuthSuccess] = useState<string>('')
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [authView, setAuthView] = useState<'signin' | 'signup' | 'forgot' | 'reset'>('signin')
  const [showAuthModal, setShowAuthModal] = useState(false)
  // Billing modal state
  const [invoiceModal, setInvoiceModal] = useState<{ projectId: number } | null>(null)

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

  // Authentication effect
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      
      // Handle password recovery event
      if (event === 'PASSWORD_RECOVERY') {
        setAuthView('reset')
        setShowAuthModal(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])



  function startTimer(id: number) {
    const now = Date.now()
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, running: true, startTime: now } : p))
    )
  }

  function stopTimer(id: number) {
    const now = Date.now()
    let createdSessionRef: { projectId: number; sessionId: number } | null = null
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === id && p.running && p.startTime) {
          const delta = Math.round((now - p.startTime) / 1000) // seconds
          const sessionId = Date.now()
          const newSession: Session = {
            id: sessionId,
            durationSeconds: delta,
            notes: '',
            startedAt: p.startTime,
            endedAt: now,
          }
          createdSessionRef = { projectId: id, sessionId }
          // Don't add to total here - total will be calculated from sessions
          return { ...p, running: false, startTime: undefined, sessions: [...p.sessions, newSession] }
        }
        return p
      })
    )
    // Prompt for notes right after stopping
    if (createdSessionRef) {
      setSessionNotesModal(createdSessionRef)
    }
  }

  function addProject(name: string, notes: string, rate?: number) {
    const newProject = { id: Date.now(), name, notes, total: 0, running: false, rate: rate || undefined, sessions: [] }
    setProjects((prev) => [...prev, newProject])
    setCurrentIndex(projects.length)
    setModal(null)
  }

  function deleteProject() {
    if (selectedProjectId === null) return
    const projectIndex = projects.findIndex((p) => p.id === selectedProjectId)

    setProjects((prev) => prev.filter((p) => p.id !== selectedProjectId))
    
    // Adjust currentIndex to ensure it points to a valid project
    setCurrentIndex((prevIndex) => {
      const newLength = projects.length - 1
      if (newLength === 0) return 0
      if (prevIndex >= newLength) return newLength - 1
      if (prevIndex > projectIndex) return prevIndex - 1
      return prevIndex
    })
    
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

  // New: save session notes and duration
  function handleSaveSessionNotes(projectId: number, sessionId: number, notes: string, newDurationSeconds?: number) {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p
        const session = p.sessions.find((s) => s.id === sessionId)
        if (!session) return p
        
        let updatedSession = { ...session, notes }
        
        // If duration changed, update session duration
        if (newDurationSeconds !== undefined && newDurationSeconds !== session.durationSeconds) {
          updatedSession = { ...updatedSession, durationSeconds: newDurationSeconds }
        }
        
        return {
          ...p,
          sessions: p.sessions.map((s) => (s.id === sessionId ? updatedSession : s)),
        }
      })
    )
  }

  // New: delete session
  function handleDeleteSession(projectId: number, sessionId: number) {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p
        const session = p.sessions.find((s) => s.id === sessionId)
        if (!session) return p
        return {
          ...p,
          sessions: p.sessions.filter((s) => s.id !== sessionId),
        }
      })
    )
  }

  // New: start editing project field
  function startEditingProjectField(projectId: number, field: 'name' | 'notes', currentValue: string) {
    setEditingProjectId(projectId)
    setEditingField(field)
    if (field === 'name') {
      setEditingName(currentValue)
    } else {
      setEditingNotes(currentValue)
    }
  }

  // New: save edited project field
  function saveEditedProjectField() {
    if (editingProjectId === null || editingField === null) return
    
    if (editingField === 'name' && !editingName.trim()) return
    
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== editingProjectId) return p
        
        if (editingField === 'name') {
          return { ...p, name: editingName.trim() }
        } else {
          return { ...p, notes: editingNotes.trim() }
        }
      })
    )
    
    setEditingProjectId(null)
    setEditingField(null)
    setEditingName('')
    setEditingNotes('')
  }

  // New: cancel editing project field
  function cancelEditingProjectField() {
    setEditingProjectId(null)
    setEditingField(null)
    setEditingName('')
    setEditingNotes('')
  }



  // Authentication functions
  async function handleSignIn(email: string, password: string) {
    setAuthError('')
    setAuthSuccess('')
    setIsAuthSubmitting(true)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        // Provide more user-friendly error messages
        if (error.message.includes('Invalid login credentials')) {
          setAuthError('Invalid login credentials.')
        } else if (error.message.includes('Email not confirmed')) {
          setAuthError('Please check your email and click the confirmation link before signing in.')
        } else {
          setAuthError(error.message)
        }
      } else {
        setAuthSuccess('Signed in successfully!')
        setAuthView('signin')
        setShowAuthModal(false)
      }
    } catch (err) {
      setAuthError('An unexpected error occurred. Please try again.')
    } finally {
      setIsAuthSubmitting(false)
    }
  }

  async function handleSignOut() {
    setAuthError('')
    setAuthSuccess('')
    setAuthView('signin')
    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthError('Error signing out: ' + error.message)
    }
  }

  function formatSeconds(totalSeconds: number) {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // New: compact duration formatter for chips like 2h, 45m, 1h 05m
  function formatDurationShort(totalSeconds: number) {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins.toString().padStart(2, '0')}m`
    if (hrs > 0) return `${hrs}h`
    return `${mins}m`
  }

  function projectCurrentElapsed(p: Project) {
    if (!p.running || !p.startTime) return 0
    const now = Date.now()
    const delta = Math.round((now - p.startTime) / 1000)
    return delta
  }

  function projectTotalCompleted(p: Project) {
    return p.sessions.reduce((acc, s) => acc + s.durationSeconds, 0)
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
      
      // Check if user is currently typing in an input field
      const activeElement = document.activeElement
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true'
      )
      
      // Only allow arrow key navigation when not typing
      if (!isTyping) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          prevProject()
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          nextProject()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [modal, nextProject, prevProject])

  const totalSeconds = projects.reduce((acc, p) => acc + projectTotalCompleted(p), 0)
  const totalEarnings = projects.reduce((acc, p) => {
    const projectRate = p.rate ?? rate
    const earnings = (projectTotalCompleted(p) / 3600) * projectRate
    return acc + earnings
  }, 0)

  const projectColors = ['bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-fuchsia-500', 'bg-rose-500', 'bg-indigo-500'];
  const cardColors = ['bg-sky-50', 'bg-emerald-50', 'bg-amber-50', 'bg-fuchsia-50', 'bg-rose-50', 'bg-indigo-50'];

  function handleSidebarProjectClick(projectId: number) {
    const projectIndex = projects.findIndex((p) => p.id === projectId);
    if (projectIndex !== -1) {
      setCurrentIndex(projectIndex);
    }
  }

  return (
    <div className="h-screen bg-gray-50 text-gray-900 font-sans flex">
      {authLoading ? (
        <div className="w-full flex items-center justify-center">
          <div className="text-lg">Loading...</div>
        </div>
      ) : (
        <>
          <Sidebar 
            projects={projects} 
            projectColors={projectColors} 
            onProjectClick={handleSidebarProjectClick}
            user={user}
            onSignOut={handleSignOut}
          />
          <div className="flex-grow flex flex-col pl-20">
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
                  <div className="text-xs text-gray-600">Default Rate / hr</div>
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
                  {!user && (
                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                      Sign In
                    </button>
                  )}
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
                      className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-20 text-gray-500 hover:text-gray-900 transition-all duration-200 focus:outline-none z-10 group"
                      aria-label="Previous project"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-10 w-10 group-hover:h-12 group-hover:w-12 transition-all duration-200"
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
                          cardColors[i % cardColors.length]
                        }`}
                        style={{
                          transform: `translateX(${(i - currentIndex) * 110}%) scale(${i === currentIndex ? 1 : 0.9})`,
                          opacity: i === currentIndex ? 1 : 0.4,
                          zIndex: i === currentIndex ? 10 : 1,
                          transitionProperty: 'transform, opacity',
                        }}
                        role="group"
                      >
                        {/* Header */}
                        <header className="flex items-start justify-between">
                          <div>
                            {editingProjectId === p.id && editingField === 'name' ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      saveEditedProjectField()
                                    } else if (e.key === 'Escape') {
                                      cancelEditingProjectField()
                                    }
                                  }}
                                  onBlur={saveEditedProjectField}
                                  className="text-xl font-bold text-gray-800 bg-transparent border-b-2 border-blue-500 focus:outline-none focus:border-blue-600 px-1 py-0"
                                  autoFocus
                                />
                                <button
                                  onClick={saveEditedProjectField}
                                  className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                                  aria-label="Save name"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={cancelEditingProjectField}
                                  className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                                  aria-label="Cancel edit"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <h3 
                                className="text-xl font-bold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors px-1 py-1 rounded hover:bg-blue-50"
                                onClick={() => startEditingProjectField(p.id, 'name', p.name)}
                                title="Click to edit project name"
                              >
                                {p.name}
                              </h3>
                            )}
                            {editingProjectId === p.id && editingField === 'notes' ? (
                              <div className="flex items-center gap-2 mt-1">
                                <input
                                  type="text"
                                  value={editingNotes}
                                  onChange={(e) => setEditingNotes(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      saveEditedProjectField()
                                    } else if (e.key === 'Escape') {
                                      cancelEditingProjectField()
                                    }
                                  }}
                                  onBlur={saveEditedProjectField}
                                  className="text-sm text-gray-500 bg-transparent border-b-2 border-blue-500 focus:outline-none focus:border-blue-600 px-1 py-0"
                                  autoFocus
                                />
                                <button
                                  onClick={saveEditedProjectField}
                                  className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                                  aria-label="Save notes"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={cancelEditingProjectField}
                                  className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                                  aria-label="Cancel edit"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <p 
                                className="text-sm text-gray-500 mt-1 cursor-pointer hover:text-blue-600 transition-colors px-1 py-1 rounded hover:bg-blue-50"
                                onClick={() => startEditingProjectField(p.id, 'notes', p.notes)}
                                title="Click to edit project notes"
                              >
                                {p.notes}
                              </p>
                            )}
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
                          className="text-center flex flex-col justify-center items-center cursor-pointer mt-8"
                          onClick={() => (p.running ? stopTimer(p.id) : startTimer(p.id))}
                        >
                          <div className="text-5xl font-mono tracking-tighter text-gray-800">
                            {formatSeconds(projectCurrentElapsed(p))}
                          </div>
                          <div className="text-lg font-semibold text-gray-600">
                            ${((projectCurrentElapsed(p) / 3600) * (p.rate ?? rate)).toFixed(2)}
                          </div>
                          {/* Total completed time - smaller and below */}
                          {projectTotalCompleted(p) > 0 && (
                            <div className="text-sm text-gray-500 mt-2">
                              Total: {formatSeconds(projectTotalCompleted(p))}
                            </div>
                          )}
                        </div>

                        {/* Sessions chips - bigger and more evident, click to edit details */}
                        <div className="mt-4 flex-1 min-h-0">
                          {p.sessions.length > 0 ? (
                            <div className="h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent relative">
                              <div className="flex flex-wrap gap-3 pb-2">
                                {[...p.sessions].reverse().map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSessionNotesModal({ projectId: p.id, sessionId: s.id })
                                    }}
                                    className="px-4 py-2 text-sm font-medium rounded-lg bg-white/80 border-2 border-gray-300 text-gray-800 hover:bg-white hover:border-blue-500 hover:shadow-md transition-all duration-200 cursor-pointer flex-shrink-0"
                                    aria-label="Edit session details"
                                    title={s.notes ? `Click to edit: ${s.notes}` : 'Click to add notes'}
                                  >
                                    {formatDurationShort(s.durationSeconds)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                              No sessions yet
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <footer className="mt-auto">
                          {!p.running && (
                            <div className="mb-2 grid grid-cols-2 gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setInvoiceModal({ projectId: p.id })
                                }}
                                className="col-span-2 py-2 rounded-lg border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300"
                              >
                                Bill
                              </button>
                            </div>
                          )}
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
                      className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-20 text-gray-500 hover:text-gray-900 transition-all duration-200 focus:outline-none z-10 group"
                      aria-label="Next project"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-10 w-10 group-hover:h-12 group-hover:w-12 transition-all duration-200"
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
          {/* New: Session notes modal */}
          {sessionNotesModal && (() => {
            const proj = projects.find((p) => p.id === sessionNotesModal.projectId)
            const sess = proj?.sessions.find((s) => s.id === sessionNotesModal.sessionId)
            return (
              <SessionNotesModal
                isOpen={!!sessionNotesModal}
                onClose={() => setSessionNotesModal(null)}
                initialNotes={sess?.notes ?? ''}
                onSave={(notes, durationSeconds) => {
                  handleSaveSessionNotes(sessionNotesModal.projectId, sessionNotesModal.sessionId, notes, durationSeconds)
                  setSessionNotesModal(null)
                }}
                onDelete={() => {
                  handleDeleteSession(sessionNotesModal.projectId, sessionNotesModal.sessionId)
                  setSessionNotesModal(null)
                }}
                sessionDurationSeconds={sess?.durationSeconds ?? 0}
              />
            )
          })()}

          {/* Invoice modal */}
          {invoiceModal && (() => {
            const proj = projects.find((p) => p.id === invoiceModal.projectId)
            if (!proj) return null
            return (
              <InvoiceModal
                isOpen={!!invoiceModal}
                onClose={() => setInvoiceModal(null)}
                project={proj}
                defaultRate={rate}
              />
            )
          })()}

          {/* Authentication Modal */}
          {showAuthModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
                {authView === 'signin' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 text-center">
                        Sign in to BillTick
                      </h2>
                      <p className="mt-2 text-center text-sm text-gray-600">
                        Welcome back! Please sign in to your account
                      </p>
                    </div>
                    
                    {/* Error/Success Messages */}
                    {authError && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <div className="text-sm text-red-800">{authError}</div>
                      </div>
                    )}
                    {authSuccess && (
                      <div className="bg-green-50 border border-green-200 rounded-md p-4">
                        <div className="text-sm text-green-800">{authSuccess}</div>
                      </div>
                    )}

                    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                      <div className="space-y-4">
                        <input
                          type="email"
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Email address"
                          id="email"
                          disabled={isAuthSubmitting}
                          onChange={() => {
                            if (authError || authSuccess) {
                              setAuthError('')
                              setAuthSuccess('')
                            }
                          }}
                        />
                        <input
                          type="password"
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Password"
                          id="password"
                          disabled={isAuthSubmitting}
                          onChange={() => {
                            if (authError || authSuccess) {
                              setAuthError('')
                              setAuthSuccess('')
                            }
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setAuthView('forgot')}
                          className="text-sm text-indigo-600 hover:text-indigo-500"
                        >
                          Forgot your password?
                        </button>
                      </div>

                      <div className="flex space-x-4">
                        <button
                          type="button"
                          onClick={() => {
                            const email = (document.getElementById('email') as HTMLInputElement).value
                            const password = (document.getElementById('password') as HTMLInputElement).value
                            if (!email || !password) {
                              setAuthError('Please enter both email and password')
                              return
                            }
                            handleSignIn(email, password)
                          }}
                          disabled={isAuthSubmitting}
                          className="flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAuthSubmitting ? 'Signing in...' : 'Sign in'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthView('signup')}
                          disabled={isAuthSubmitting}
                          className="flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Sign up
                        </button>
                      </div>
                    </form>

                    <button
                      onClick={() => setShowAuthModal(false)}
                      className="w-full py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                
                {authView === 'signup' && (
                  <SignUp 
                    onBack={() => setAuthView('signin')}
                    onSuccess={() => {
                      setAuthView('signin')
                      setShowAuthModal(false)
                    }}
                  />
                )}
                
                {authView === 'forgot' && (
                  <ForgotPassword 
                    onBack={() => setAuthView('signin')}
                  />
                )}
                
                {authView === 'reset' && (
                  <ResetPassword 
                    onSuccess={() => {
                      setAuthView('signin')
                      setShowAuthModal(false)
                      // Sign out the user after successful password reset
                      supabase.auth.signOut()
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
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
  onAdd: (name: string, notes: string, rate?: number) => void
}) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [rate, setRate] = useState<number | undefined>(undefined)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onAdd(name, notes, rate)
    setName('')
    setNotes('')
    setRate(undefined)
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
            Client Name
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
        <div>
          <label htmlFor="projectRate" className="text-sm font-medium text-gray-700 block mb-1">
            Hourly Rate ($)
          </label>
          <input
            type="number"
            id="projectRate"
            value={rate || ''}
            onChange={(e) => setRate(Number(e.target.value) || undefined)}
            className="w-full p-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-300"
            placeholder="e.g., 25"
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

// New: modal for adding/editing session notes
function SessionNotesModal({
  isOpen,
  onClose,
  initialNotes,
  onSave,
  onDelete,
  sessionDurationSeconds,
}: {
  isOpen: boolean
  onClose: () => void
  initialNotes: string
  onSave: (notes: string, durationSeconds?: number) => void
  onDelete: () => void
  sessionDurationSeconds: number
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [durationMinutes, setDurationMinutes] = useState(Math.round(sessionDurationSeconds / 60))

  useEffect(() => {
    setNotes(initialNotes)
    setDurationMinutes(Math.round(sessionDurationSeconds / 60))
  }, [initialNotes, sessionDurationSeconds])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Convert minutes back to seconds and save both notes and duration
    const newDurationSeconds = durationMinutes * 60
    onSave(notes.trim(), newDurationSeconds)
  }

  const seconds = sessionDurationSeconds
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const durationLabel = hrs > 0 ? `${hrs}h ${mins.toString().padStart(2, '0')}m` : `${mins}m`
  const isEditing = initialNotes.trim() !== ''

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `Edit Session (${durationLabel})` : `What did you work on? (${durationLabel})`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Duration editing section */}
        <div>
          <label htmlFor="sessionDuration" className="text-sm font-medium text-gray-700 block mb-1">
            Duration (minutes)
          </label>
          <input
            type="number"
            id="sessionDuration"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full p-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-300"
            placeholder="Enter duration in minutes"
            min="1"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Current: {Math.floor(sessionDurationSeconds / 60)}m • New: {durationMinutes}m
          </p>
        </div>

        {/* Notes section */}
        <div>
          <label htmlFor="sessionNotes" className="text-sm font-medium text-gray-700 block mb-1">
            {isEditing ? 'Session notes' : 'Add a short note'}
          </label>
          <textarea
            id="sessionNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-300"
            placeholder={isEditing ? "Update your session notes..." : "Summarize what you got done..."}
            rows={4}
          />
        </div>

        <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onDelete}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800"
          >
            {isEditing ? 'Cancel' : 'Skip'}
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white"
          >
            {isEditing ? 'Update' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// New: Invoice modal for selecting sessions and previewing a bill
function InvoiceModal({
  isOpen,
  onClose,
  project,
  defaultRate,
}: {
  isOpen: boolean
  onClose: () => void
  project: Project
  defaultRate: number
}) {
  const [billedTo, setBilledTo] = useState(project.notes || 'Company Name')
  const [payTo, setPayTo] = useState('Your Name')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [payUsing, setPayUsing] = useState('Payment Method')
  const [payInfo, setPayInfo] = useState('Link/Account Info')
  const [rate, setRate] = useState<number>(project.rate ?? defaultRate)
  const [selected, setSelected] = useState<Set<number>>(new Set(project.sessions.map(s => s.id)))
  const [notesEdits, setNotesEdits] = useState<Record<number, string>>({})
  const [hoursEdits, setHoursEdits] = useState<Record<number, number>>({})
  const [showPreview, setShowPreview] = useState(true)

  function toggleAll(selectAll: boolean) {
    if (selectAll) {
      setSelected(new Set(project.sessions.map(s => s.id)))
    } else {
      setSelected(new Set())
    }
  }

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function getHoursFor(sessionId: number, durationSeconds: number) {
    const override = hoursEdits[sessionId]
    return override !== undefined ? override : +(durationSeconds / 3600).toFixed(2)
  }

  const selectedSessions = project.sessions.filter(s => selected.has(s.id))
  const totalHours = selectedSessions.reduce((acc, s) => acc + getHoursFor(s.id, s.durationSeconds), 0)
  const totalAmount = totalHours * rate

  function handlePrint() {
    window.print()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Invoice" maxWidthClass="max-w-4xl">
      {/* Print-only invoice - hidden on screen, shown when printing */}
      <div className="hidden print:block print-only">
        <div className="bg-white p-8">
          <div className="w-full text-gray-900">
            <div className="flex justify-end">
              <h2 className="text-4xl tracking-widest">INVOICE</h2>
            </div>
            <div className="mt-10 text-sm">
              <div className="space-y-4">
                <div className="flex items-baseline"><div className="font-semibold tracking-widest text-gray-600 w-24">BILLED TO:</div><div className="flex-1">{billedTo}</div></div>
                <div className="flex items-baseline"><div className="font-semibold tracking-widest text-gray-600 w-24">PAY TO:</div><div className="flex-1">{payTo}</div></div>
                <div className="flex items-baseline"><div className="font-semibold tracking-widest text-gray-600 w-24">DATE:</div><div className="flex-1">{new Date(date).toLocaleDateString()}</div></div>
                <div className="flex items-start"><div className="font-semibold tracking-widest text-gray-600 w-24">PAY USING:</div><div className="flex-1"><div>{payUsing}</div>{payInfo && <div className="text-gray-500 mt-1">• {payInfo}</div>}</div></div>
              </div>
            </div>

            <div className="mt-10">
              <div className="grid grid-cols-[1fr_120px_140px] gap-x-8 text-sm font-semibold tracking-widest text-gray-600">
                <div>DESCRIPTION</div>
                <div>HOURS</div>
                <div>AMOUNT</div>
              </div>
              <div className="mt-2 divide-y">
                {selectedSessions.map((s) => {
                  const hours = getHoursFor(s.id, s.durationSeconds)
                  const amount = hours * rate
                  const desc = (notesEdits[s.id] ?? s.notes) || 'Item'
                  return (
                    <div key={s.id} className="grid grid-cols-[1fr_120px_140px] gap-x-8 py-3 text-sm">
                      <div className="truncate pr-2">{desc}</div>
                      <div className="text-center ml-16">{hours}</div>
                      <div className="text-right">${amount.toFixed(2)}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-between items-center mt-16">
              <div className="tracking-widest text-gray-700">TOTAL</div>
              <div className="text-right">
                <div className="text-sm tracking-widest text-gray-600">{totalHours.toFixed(0)} hrs</div>
                <div className="text-xl font-semibold">${totalAmount.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Screen-only form - hidden when printing */}
      <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Billed To</label>
              <input className="w-full border border-gray-300 rounded-md p-2" value={billedTo} onChange={(e) => setBilledTo(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pay To</label>
              <input className="w-full border border-gray-300 rounded-md p-2" value={payTo} onChange={(e) => setPayTo(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" className="w-full border border-gray-300 rounded-md p-2" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rate ($/hr)</label>
              <input type="number" step="0.01" min="0" className="w-full border border-gray-300 rounded-md p-2" value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Pay Using</label>
              <input className="w-full border border-gray-300 rounded-md p-2" value={payUsing} onChange={(e) => setPayUsing(e.target.value)} />
              <input className="w-full border border-gray-300 rounded-md p-2 mt-2" value={payInfo} onChange={(e) => setPayInfo(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2 text-sm">
              <input id="selectAllSessions" type="checkbox" className="h-4 w-4" checked={selected.size === project.sessions.length && project.sessions.length > 0} onChange={(e) => toggleAll(e.target.checked)} />
              <label htmlFor="selectAllSessions" className="text-gray-700">Select all</label>
            </div>
            <button className="text-sm text-indigo-600" onClick={() => setShowPreview((v) => !v)}>{showPreview ? 'Hide preview' : 'Show preview'}</button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[24px_1fr_100px_110px] gap-x-4 items-center bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
              <div></div>
              <div>Description</div>
              <div>Hours</div>
              <div className="text-right">Amount</div>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y">
              {project.sessions.map((s) => {
                const checked = selected.has(s.id)
                const hours = getHoursFor(s.id, s.durationSeconds)
                const rowAmount = +(hours * rate).toFixed(2)
                return (
                  <div key={s.id} className={`grid grid-cols-[24px_1fr_100px_110px] gap-x-4 items-center px-3 py-2 ${checked ? 'bg-blue-50' : ''}`}>
                    <input type="checkbox" className="h-4 w-4" checked={checked} onChange={() => toggleOne(s.id)} />
                    <input
                      className="border border-gray-300 rounded-md p-2 text-sm w-full"
                      value={notesEdits[s.id] ?? s.notes}
                      onChange={(e) => setNotesEdits((m) => ({ ...m, [s.id]: e.target.value }))}
                      placeholder="Description / notes"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      className="border border-gray-300 rounded-md p-2 text-sm w-24"
                      value={hours}
                      onChange={(e) => setHoursEdits((m) => ({ ...m, [s.id]: Number(e.target.value) }))}
                    />
                    <div className="text-right text-sm font-medium">${rowAmount.toFixed(2)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-gray-600">{selected.size} sessions selected</div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Total Hours</div>
              <div className="text-lg font-semibold">{totalHours.toFixed(2)} hrs</div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <div className="text-right mr-auto">
              <div className="text-sm text-gray-500">Total</div>
              <div className="text-xl font-bold">${totalAmount.toFixed(2)}</div>
            </div>
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800">Close</button>
            <button onClick={handlePrint} className="px-4 py-2 rounded-lg bg-indigo-600 text-white">Print / Save PDF</button>
          </div>
        </div>

        {showPreview && (
          <div className="bg-white border rounded-xl p-8 overflow-auto shadow-sm print:hidden">
            <div className="w-full text-gray-900">
              <div className="flex justify-end">
                <h2 className="text-4xl tracking-widest">INVOICE</h2>
              </div>
              <div className="mt-10 text-sm">
                <div className="space-y-4">
                  <div className="flex items-baseline"><div className="font-semibold tracking-widest text-gray-600 w-24">BILLED TO:</div><div className="flex-1">{billedTo}</div></div>
                  <div className="flex items-baseline"><div className="font-semibold tracking-widest text-gray-600 w-24">PAY TO:</div><div className="flex-1">{payTo}</div></div>
                  <div className="flex items-baseline"><div className="font-semibold tracking-widest text-gray-600 w-24">DATE:</div><div className="flex-1">{new Date(date).toLocaleDateString()}</div></div>
                  <div className="flex items-start"><div className="font-semibold tracking-widest text-gray-600 w-24">PAY USING:</div><div className="flex-1"><div>{payUsing}</div>{payInfo && <div className="text-gray-500 mt-1">• {payInfo}</div>}</div></div>
                </div>
              </div>

              <div className="mt-10">
                <div className="grid grid-cols-[1fr_120px_140px] gap-x-8 text-sm font-semibold tracking-widest text-gray-600">
                  <div>DESCRIPTION</div>
                  <div>HOURS</div>
                  <div>AMOUNT</div>
                </div>
                <div className="mt-2 divide-y">
                  {selectedSessions.map((s) => {
                    const hours = getHoursFor(s.id, s.durationSeconds)
                    const amount = hours * rate
                    const desc = (notesEdits[s.id] ?? s.notes) || 'Item'
                    return (
                                             <div key={s.id} className="grid grid-cols-[1fr_120px_140px] gap-x-8 py-3 text-sm">
                         <div className="truncate pr-2">{desc}</div>
                         <div className="text-center ml-16">{hours}</div>
                         <div className="text-right">${amount.toFixed(2)}</div>
                       </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-between items-center mt-16">
                <div className="tracking-widest text-gray-700">TOTAL</div>
                <div className="text-right">
                  <div className="text-sm tracking-widest text-gray-600">{totalHours.toFixed(0)} hrs</div>
                  <div className="text-xl font-semibold">${totalAmount.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
