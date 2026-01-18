/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useWebSocket } from '@/contexts/WebSocketContext'

interface User {
  id: number
  nip: string
  role: string
  name: string
}

interface Taxpayer {
  id: number
  npwp: string
  name: string
  createdAt: string
  consultationId: number
  consultationStatus: string
  room?: string
  startTime?: string
  notes?: string
}

export default function ARDashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [assignedConsultations, setAssignedConsultations] = useState<Taxpayer[]>([])
  const [endingConsultation, setEndingConsultation] = useState<{id: number, notes: string, room: string} | null>(null)
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [notificationCount, setNotificationCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [newlyAssigned, setNewlyAssigned] = useState<Set<number>>(new Set())
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const notificationRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { socket, isConnected, joinARRoom, joinUser, setUserOnline } = useWebSocket()

  const fetchAssignedConsultations = async () => {
    try {
      const res = await fetch('/api/ar/consultations')
      const data = await res.json()
      setAssignedConsultations(data.taxpayers || [])
      // Clear newly assigned indicators when data is refreshed
      setNewlyAssigned(new Set())
    } catch (error) {
      console.error('Error fetching assigned consultations:', error)
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          if (data.user.role === 'AR') {
            setUser(data.user)
            // Load consultations immediately
            fetchAssignedConsultations()
            // Join WebSocket room for this AR (will happen when socket connects)
            joinARRoom(data.user.nip)
            // Check in the AR when they view their dashboard
            fetch('/api/ar/check-in', { method: 'POST' })
              .catch((error) => {
                console.error('Error checking in:', error)
              })
          } else {
            router.push(`/dashboard/${data.user.role.toLowerCase().replace('_', '-')}`)
          }
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  // Join AR room when socket connects
  useEffect(() => {
    if (user && isConnected) {
      console.log('Socket connected, joining AR room for:', user.nip)
      joinARRoom(user.nip)
      
      // Also join user room for chat notifications
      joinUser(user.id)
      // Emit online status when entering dashboard
      setUserOnline(user.id, true)
      console.log('Emitted user-online for AR:', user.id)
    }
  }, [user, isConnected, joinARRoom, joinUser, setUserOnline])

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user) {
        setUserOnline(user.id, false)
        console.log('Emitted user-offline for page unload:', user.id)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [user, setUserOnline])

  // WebSocket event listeners for real-time updates
  useEffect(() => {
    if (!socket || !user) return

    console.log('Setting up WebSocket listeners for AR:', user.nip)

    const handleNewTaxpayerAssigned = (data: any) => {
      console.log('New taxpayer assigned:', data)
      fetchAssignedConsultations()

      // Mark as newly assigned
      setNewlyAssigned(prev => new Set([...prev, data.taxpayerId]))

      // Auto-remove "new" badge after 30 seconds
      setTimeout(() => {
        setNewlyAssigned(prev => {
          const newSet = new Set(prev)
          newSet.delete(data.taxpayerId)
          return newSet
        })
      }, 30000)

      // Add notification
      const notification = {
        id: Date.now(),
        type: 'new-taxpayer',
        title: 'Wajib Pajak Baru Ditugaskan',
        message: `${data.taxpayerName} (${data.taxpayerNip}) telah ditugaskan untuk konsultasi.`,
        timestamp: new Date(),
        icon: 'user-plus',
        data: data
      }
      setNotifications(prev => [notification, ...prev])

      // Show browser notification
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            tag: 'new-taxpayer'
          })
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico',
                tag: 'new-taxpayer'
              })
            }
          })
        }
      }

      // Increment notification count
      setNotificationCount(prev => prev + 1)
    }

    const handleConsultationStatusChanged = (data: any) => {
      console.log('Consultation status changed:', data)
      fetchAssignedConsultations()

      // Add notification for consultation updates
      const notification = {
        id: Date.now(),
        type: 'consultation-update',
        title: 'Status Konsultasi Berubah',
        message: `Konsultasi dengan ${data.taxpayerName || 'wajib pajak'} telah ${data.status === 'DONE' ? 'selesai' : 'diperbarui'}.`,
        timestamp: new Date(),
        icon: 'clipboard-check',
        data: data
      }
      setNotifications(prev => [notification, ...prev])
      setNotificationCount(prev => prev + 1)
    }

    const handleConsultationDeleted = (data: any) => {
      console.log('Consultation deleted:', data)
      
      // Remove the deleted consultation from assigned consultations
      setAssignedConsultations(prev => 
        prev.filter(consultation => consultation.consultationId !== data.consultationId)
      )

      // Add notification for consultation deletion
      const notification = {
        id: Date.now(),
        type: 'consultation-deleted',
        title: 'Konsultasi Dibatalkan',
        message: `Konsultasi telah dibatalkan oleh receptionist.`,
        timestamp: new Date(),
        icon: 'x-circle',
        data: data
      }
      setNotifications(prev => [notification, ...prev])
      setNotificationCount(prev => prev + 1)
    }

    const handleTaxpayerRegistered = (data: any) => {
      console.log('Taxpayer registered:', data)

      // Refresh the consultations list to show the newly registered taxpayer
      fetchAssignedConsultations()

      // Mark as newly assigned
      setNewlyAssigned(prev => new Set([...prev, data.taxpayerId]))

      // Auto-remove "new" badge after 30 seconds
      setTimeout(() => {
        setNewlyAssigned(prev => {
          const newSet = new Set(prev)
          newSet.delete(data.taxpayerId)
          return newSet
        })
      }, 30000)

      // Add notification for new registration
      const notification = {
        id: Date.now(),
        type: 'taxpayer-registered',
        title: 'Wajib Pajak Terdaftar',
        message: `${data.taxpayerName} (${data.taxpayerNip}) telah mendaftar untuk konsultasi di ruangan ${data.room}.`,
        timestamp: new Date(),
        icon: 'user-check',
        data: data
      }
      setNotifications(prev => [notification, ...prev])

      // Show browser notification
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            tag: 'taxpayer-registered'
          })
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico',
                tag: 'taxpayer-registered'
              })
            }
          })
        }
      }

      // Increment notification count
      setNotificationCount(prev => prev + 1)
    }

    const handleChatMessage = (data: any) => {
      console.log('AR Dashboard received chat message:', data)
      
      // Store unread message count per chat in localStorage
      const unreadCounts = JSON.parse(localStorage.getItem('unreadChatCounts') || '{}') as Record<string, number>
      unreadCounts[data.chatId] = (unreadCounts[data.chatId] || 0) + 1
      localStorage.setItem('unreadChatCounts', JSON.stringify(unreadCounts))
      
      // Update total unread count in localStorage (will be read by chat page)
      const totalUnread = Object.values(unreadCounts).reduce((sum: number, count: number) => sum + count, 0)
      localStorage.setItem('totalUnreadChatCount', totalUnread.toString())
      
      // Trigger storage event for other tabs
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'totalUnreadChatCount',
        newValue: totalUnread.toString()
      }))

      // Show browser notification for chat messages
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('Pesan Chat Baru', {
            body: `Pesan baru dari ${data.sender?.name || 'pengguna'}: ${data.content?.substring(0, 50)}${data.content?.length > 50 ? '...' : ''}`,
            icon: '/favicon.ico',
            tag: 'chat-message'
          })
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              new Notification('Pesan Chat Baru', {
                body: `Pesan baru dari ${data.sender?.name || 'pengguna'}: ${data.content?.substring(0, 50)}${data.content?.length > 50 ? '...' : ''}`,
                icon: '/favicon.ico',
                tag: 'chat-message'
              })
            }
          })
        }
      }

      // Play notification sound
      if (document.hidden) {
        const audio = new Audio('/notification.mp3')
        audio.volume = 0.3
        audio.play().catch(() => {
          // Fallback: create a simple beep sound
          const beep = new AudioContext()
          const oscillator = beep.createOscillator()
          const gainNode = beep.createGain()
          oscillator.connect(gainNode)
          gainNode.connect(beep.destination)
          oscillator.frequency.value = 800
          gainNode.gain.setValueAtTime(0.1, beep.currentTime)
          oscillator.start(beep.currentTime)
          oscillator.stop(beep.currentTime + 0.1)
        })
      }

      // Note: Chat messages are NOT added to the general notifications system
      // They only appear as badges on the chat button
    }

    socket.on('new-taxpayer-assigned', handleNewTaxpayerAssigned)
    socket.on('consultation-status-changed', handleConsultationStatusChanged)
    socket.on('consultation-deleted', handleConsultationDeleted)
    socket.on('taxpayer-registered', handleTaxpayerRegistered)
    socket.on('chat-message', handleChatMessage)

    return () => {
      console.log('Cleaning up WebSocket listeners for AR:', user.nip)
      socket.off('new-taxpayer-assigned', handleNewTaxpayerAssigned)
      socket.off('consultation-status-changed', handleConsultationStatusChanged)
      socket.off('consultation-deleted', handleConsultationDeleted)
      socket.off('taxpayer-registered', handleTaxpayerRegistered)
      socket.off('chat-message', handleChatMessage)
    }
  }, [socket, user])

  const handleLogout = async () => {
    // Emit offline status before logout
    if (user) {
      setUserOnline(user.id, false)
      console.log('Emitted user-offline for logout:', user.id)
    }
    
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const clearNotifications = () => {
    setNotificationCount(0)
    setNotifications([])
  }

  const handleStartConsultation = async (consultationId: number) => {
    try {
      const res = await fetch(`/api/consultations/${consultationId}/start`, {
        method: 'POST',
      })
      if (res.ok) {
        fetchAssignedConsultations()
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Konsultasi Dimulai', {
            body: 'Konsultasi telah dimulai.',
          })
        }
      }
    } catch (error) {
      console.error('Error starting consultation:', error)
    }
  }

  const handleEndConsultation = async (consultationId: number, notes?: string, room?: string) => {
    try {
      const res = await fetch(`/api/consultations/${consultationId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes, room }),
      })
      if (res.ok) {
        fetchAssignedConsultations()
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Konsultasi Selesai', {
            body: 'Konsultasi telah diselesaikan.',
          })
        }
      }
    } catch (error) {
      console.error('Error ending consultation:', error)
    }
  }

  useEffect(() => {
    if (user?.role === 'AR' && 'Notification' in window) {
      Notification.requestPermission()
    }
  }, [user])

  // Sync unread chat count from localStorage
  useEffect(() => {
    const updateUnreadCount = () => {
      const count = parseInt(localStorage.getItem('totalUnreadChatCount') || '0')
      setUnreadChatCount(count)
    }

    // Initial load
    updateUnreadCount()

    // Listen for storage changes (from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'totalUnreadChatCount') {
        updateUnreadCount()
      }
    }

    // Listen for focus events (for same tab updates)
    const handleFocus = () => {
      updateUnreadCount()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 relative font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none sticky top-0"></div>
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-blue-50/80 to-transparent pointer-events-none"></div>

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-xl transform transition-transform hover:scale-105">
                 AR
               </div>
               <div>
                  <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Dashboard AR</h1>
                  <p className="text-xs text-slate-500 font-medium mt-1">KPP Madya Dua Surabaya</p>
               </div>
            </div>
            
            <div className="flex items-center gap-4 bg-slate-50/80 px-4 py-2 rounded-full border border-slate-200/60 backdrop-blur-sm">
              <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-700">{user.name}</p>
                  <p className="text-xs text-slate-500 font-medium">NIP. {user.nip}</p>
              </div>
              <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>
              
              {/* WebSocket Connection Status */}
              <div className="flex items-center gap-2 mr-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                <span className="text-xs text-slate-500 hidden md:inline">
                  {isConnected ? 'Online' : 'Offline'}
                </span>
              </div>
              
              {/* Notifications Bell */}
              <div className="relative mr-2" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="group flex items-center justify-center w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-blue-500 hover:border-blue-100 hover:bg-blue-50 transition-all duration-200 shadow-sm relative"
                  title="Notifikasi"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM15 17H9a6 6 0 01-6-6V9a6 6 0 0110.29-4.12L15 9v8z" />
                  </svg>
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-bounce">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </button>
                
                {/* Notification Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50 max-h-96 overflow-hidden">
                    <div className="p-4 border-b border-slate-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-800">Notifikasi</h3>
                        {notifications.length > 0 && (
                          <button
                            onClick={clearNotifications}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Tandai semua dibaca
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center">
                          <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-5 5v-5zM15 17H9a6 6 0 01-6-6V9a6 6 0 0110.29-4.12L15 9v8z" />
                          </svg>
                          <p className="text-sm text-slate-500">Belum ada notifikasi</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {notifications.slice(0, 10).map((notification) => (
                            <div key={notification.id} className="p-4 hover:bg-slate-50 transition-colors">
                              <div className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                  notification.type === 'new-taxpayer' 
                                    ? 'bg-blue-100 text-blue-600' 
                                    : notification.type === 'taxpayer-registered'
                                    ? 'bg-green-100 text-green-600'
                                    : 'bg-purple-100 text-purple-600'
                                }`}>
                                  {notification.icon === 'user-plus' && (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                  )}
                                  {notification.icon === 'clipboard-check' && (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  )}
                                  {notification.icon === 'user-check' && (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-800">{notification.title}</p>
                                  <p className="text-xs text-slate-600 mt-1">{notification.message}</p>
                                  <p className="text-xs text-slate-400 mt-1">
                                    {notification.timestamp.toLocaleTimeString('id-ID', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {notifications.length > 10 && (
                      <div className="p-3 border-t border-slate-200 text-center">
                        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                          Lihat semua notifikasi
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Chat Button */}
              <Link
                href="/dashboard/ar/chat"
                className="group flex items-center justify-center w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-green-500 hover:border-green-100 hover:bg-green-50 transition-all duration-200 shadow-sm mr-2 relative"
                title="Live Chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {unreadChatCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  </div>
                )}
              </Link>
              
              <button
                onClick={() => {
                  clearNotifications()
                  router.push('/dashboard/ar/notes')
                }}
                className="group flex items-center justify-center w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-blue-500 hover:border-blue-100 hover:bg-blue-50 transition-all duration-200 shadow-sm mr-2 relative"
                title="Lihat Catatan"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              
              <button
                onClick={handleLogout}
                className="group flex items-center justify-center w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all duration-200 shadow-sm"
                title="Keluar"
              >
                <svg className="w-5 h-5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8 relative z-10 flex-grow">
        <div className="px-4 py-2 sm:px-0 space-y-12">
          
          {/* Section: Consultation Management */}
          <section className="animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
                 <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        Konsultasi Anda
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">
                            {assignedConsultations.length}
                        </span>
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Kelola wajib pajak yang sedang Anda tangani saat ini.</p>
                 </div>
            </div>

            {assignedConsultations.length === 0 ? (
                <div className="bg-white/60 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center transition-all hover:bg-white hover:border-slate-300">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">Belum ada konsultasi aktif</h3>
                    <p className="text-slate-500 mt-1">Tunggu konsultasi baru ditugaskan kepada Anda.</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {assignedConsultations.map((consultation) => (
                        <div key={consultation.consultationId} className="group bg-white rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12)] hover:-translate-y-1 transition-all duration-300 relative">
                             {/* New notification badge */}
                             {newlyAssigned.has(consultation.id) && (
                               <div className="absolute top-3 right-3 z-10">
                                 <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-500 text-white shadow-lg animate-pulse">
                                   <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                   </svg>
                                   BARU
                                 </span>
                               </div>
                             )}
                             
                             {/* Status Bar */}
                             <div className={`h-1.5 w-full ${consultation.consultationStatus === 'WAITING' ? 'bg-yellow-400' : 'bg-blue-500'}`}></div>
                             {/* Status Bar */}
                             <div className={`h-1.5 w-full ${consultation.consultationStatus === 'WAITING' ? 'bg-yellow-400' : 'bg-blue-500'}`}></div>
                             
                             <div className="p-6">
                                {/* Header badge */}
                                <div className="flex justify-between items-start mb-5">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase shadow-sm ${
                                        consultation.consultationStatus === 'WAITING'
                                            ? 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                                            : 'bg-blue-50 text-blue-700 border border-blue-100'
                                    }`}>
                                        {consultation.consultationStatus === 'WAITING' ? (
                                             <><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-2 animate-pulse"></span>Menunggu</>
                                        ) : (
                                             <><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2 animate-pulse"></span>Berjalan</>
                                        )}
                                    </span>
                                    
                                    {consultation.room && (
                                        <div className="flex items-center text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                                            <svg className="w-3.5 h-3.5 mr-1.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                            {consultation.room}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Content */}
                                <div className="flex items-start gap-4 mb-6">
                                     <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center border border-slate-100 shadow-inner group-hover:scale-105 transition-transform duration-300">
                                        <span className="text-lg font-bold text-slate-600">
                                            {consultation.name.charAt(0).toUpperCase()}
                                        </span>
                                     </div>
                                     <div className="min-w-0 flex-1">
                                        <h3 className="text-lg font-bold text-slate-900 truncate" title={consultation.name}>
                                            {consultation.name}
                                        </h3>
                                        <div className="flex items-center mt-1">
                                            <svg className="w-3.5 h-3.5 text-slate-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0c0 .883-.393 1.627-1.006 2.155" />
                                            </svg>
                                            <p className="text-sm font-mono text-slate-500 truncate">
                                                {consultation.npwp}
                                            </p>
                                        </div>
                                     </div>
                                </div>
                                
                                {/* Info details if started */}
                                 {consultation.startTime && (
                                    <div className="mb-6 bg-slate-50/80 rounded-xl p-3 border border-slate-100">
                                        <div className="mb-3">
                                            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Waktu Mulai</div>
                                            <div className="text-sm font-medium text-slate-800 flex items-center">
                                                <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {new Date(consultation.startTime).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} WIB
                                            </div>
                                        </div>
                                        
                                        <div className="pt-3 border-t border-slate-200/60">
                                            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Durasi Berjalan</div>
                                            <div className="text-sm font-medium text-slate-800 flex items-center">
                                                <svg className="w-4 h-4 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {(() => {
                                                    const start = new Date(consultation.startTime as string).getTime()
                                                    const now = currentTime.getTime()
                                                    const diff = Math.max(0, now - start)
                                                    const hours = Math.floor(diff / (1000 * 60 * 60))
                                                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                                                    
                                                    if (hours > 0) return `${hours} jam ${minutes} menit`
                                                    return `${minutes} menit`
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                 )}

                                {/* Action Buttons */}
                                <div className="mt-auto pt-2">
                                    {consultation.consultationStatus === 'WAITING' ? (
                                        <button
                                            onClick={() => handleStartConsultation(consultation.consultationId)}
                                            className="w-full group/btn relative flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all duration-200 active:scale-[0.98] overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
                                            <svg className="w-5 h-5 opacity-90 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="relative z-10">Mulai Konsultasi</span>
                                        </button>
                                    ) : endingConsultation?.id === consultation.consultationId ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Ruangan</label>
                                                <input
                                                    type="text"
                                                    value={endingConsultation.room}
                                                    onChange={(e) => setEndingConsultation({...endingConsultation, room: e.target.value})}
                                                    className="w-full bg-slate-200 cursor-not-allowed px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="Masukkan ruangan"
                                                    readOnly
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Catatan Konsultasi</label>
                                                <textarea
                                                    value={endingConsultation.notes}
                                                    onChange={(e) => setEndingConsultation({...endingConsultation, notes: e.target.value})}
                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                                    rows={3}
                                                    placeholder="Tambahkan catatan konsultasi..."
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEndingConsultation(null)}
                                                    className="flex-1 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                                >
                                                    Batal
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleEndConsultation(endingConsultation.id, endingConsultation.notes, endingConsultation.room)
                                                        setEndingConsultation(null)
                                                    }}
                                                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
                                                >
                                                    Selesaikan
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setEndingConsultation({id: consultation.consultationId, notes: '', room: consultation.room || ''})}
                                            className="w-full group/btn relative flex items-center justify-center gap-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] shadow-sm"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Selesaikan Sesi
                                        </button>
                                    )}
                                </div>
                             </div>
                        </div>
                    ))}
                </div>
            )}
          </section>

        </div>
      </main>
      
      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
         <div className="w-full h-px bg-slate-200 mb-6 w-1/3 mx-auto opacity-50"></div>
         <p className="text-xs text-slate-400 font-medium">
             &copy; {new Date().getFullYear()} Sistem Monitoring Layanan KPP Madya Dua Surabaya
         </p>
      </footer>
    </div>
  )
}