/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useWebSocket } from '@/contexts/WebSocketContext'

interface User {
  id: number
  nip: string
  role: string
  name: string
}

interface Consultation {
  id: number
  taxpayerName: string
  taxpayerNpwp: string
  arName: string
  room: string
  status: string
  startTime: string
  endTime?: string
  duration?: number
}

interface SectionStats {
  totalConsultations: number
  activeConsultations: number
  completedToday: number
  waitingTaxpayers: number
  totalARs: number
  avgConsultationTime: number
}

export default function KepalaSeksiDashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [stats, setStats] = useState<SectionStats>({
    totalConsultations: 0,
    activeConsultations: 0,
    completedToday: 0,
    waitingTaxpayers: 0,
    totalARs: 0,
    avgConsultationTime: 0
  })
  const [recentConsultations, setRecentConsultations] = useState<Consultation[]>([])
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const router = useRouter()
  const { socket, isConnected, joinUser, setUserOnline } = useWebSocket()

  // Clock timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Sync unread chat count
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'totalUnreadChatCount') {
        setUnreadChatCount(parseInt(e.newValue || '0'))
      }
    }
    window.addEventListener('storage', handleStorageChange)
    setUnreadChatCount(parseInt(localStorage.getItem('totalUnreadChatCount') || '0'))
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const fetchSectionStats = async () => {
    try {
      const [statsRes, consultationsRes] = await Promise.all([
        fetch('/api/kepala-seksi/stats'),
        fetch('/api/kepala-seksi/consultations/recent')
      ])

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      if (consultationsRes.ok) {
        const consultationsData = await consultationsRes.json()
        setRecentConsultations(consultationsData.consultations || [])
      }
    } catch (error) {
      console.error('Error fetching section data:', error)
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const authRes = await fetch('/api/auth/me')
        const authData = await authRes.json()

        if (authData.user) {
          if (authData.user.role === 'KEPALA_SEKSI') {
            setUser(authData.user)
            await fetchSectionStats()
          } else {
            router.push(`/dashboard/${authData.user.role.toLowerCase().replace('_', '-')}`)
          }
        } else {
          router.push('/login')
        }
      } catch (error) {
        console.error('Error initializing dashboard:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router])

  // Join user room and set online when socket connects
  useEffect(() => {
    if (user && isConnected) {
      console.log('Joining user room for kepala seksi:', user.id)
      joinUser(user.id)
      setUserOnline(user.id, true)
      console.log('Set user online for kepala seksi page:', user.id)
    }
  }, [user, isConnected, joinUser, setUserOnline])

  // Handle page unload - set offline
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user) {
        setUserOnline(user.id, false)
        console.log('Set user offline when leaving kepala seksi page:', user.id)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (user) {
        setUserOnline(user.id, false)
        console.log('Set user offline on kepala seksi page unmount:', user.id)
      }
    }
  }, [user, setUserOnline])

  // WebSocket event listeners for chat notifications
  useEffect(() => {
    if (!socket || !user) return

    console.log('Setting up WebSocket listeners for kepala seksi chat notifications:', user.nip)

    const handleChatMessage = (data: any) => {
      console.log('Kepala Seksi Dashboard received chat message:', data)

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

    socket.on('chat-message', handleChatMessage)

    return () => {
      console.log('Cleaning up WebSocket listeners for kepala seksi chat notifications:', user.nip)
      socket.off('chat-message', handleChatMessage)
    }
  }, [socket, user])

  const handleLogout = async () => {
    if (user) {
      setUserOnline(user.id, false)
      console.log('Set user offline for logout:', user.id)
    }

    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium animate-pulse">Memuat Dashboard Kepala Seksi...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 relative font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Abstract Background Decoration */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none"></div>
      <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none overflow-hidden">
        <svg className="w-96 h-96 text-indigo-900" fill="currentColor" viewBox="0 0 200 200">
          <path fillRule="evenodd" d="M100 0C44.77 0 0 44.77 0 100s44.77 100 100 100 100-44.77 100-100S155.23 0 100 0zM40 100c0-33.14 26.86-60 60-60s60 26.86 60 60-26.86 60-60 60-60-26.86-60-60z" opacity="0.5"/>
        </svg>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-cyan-600 rounded-lg shadow-lg shadow-blue-500/30 flex items-center justify-center text-white font-bold">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                 </svg>
               </div>
               <div>
                 <h1 className="text-xl font-bold tracking-tight text-slate-800">Dashboard Kepala Seksi</h1>
                 <p className="text-xs text-slate-500 font-medium">Monitoring Seksional</p>
               </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden md:block text-right">
                <p className="text-sm font-semibold text-slate-700">{currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</p>
                <p className="text-xs text-slate-500">{currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-700">{user.name}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    Kepala Seksi
                  </span>
                </div>
                <Link href="/dashboard/ar/chat" className="group relative p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {unreadChatCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </div>
                  )}
                </Link>
                <button
                  onClick={handleLogout}
                  className="group relative p-2 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  title="Keluar"
                >
                  <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in-up">
            <h2 className="text-3xl font-bold text-slate-800">Selamat datang kembali, Pak Kepala Seksi!</h2>
            <p className="text-slate-500 mt-2 max-w-2xl">
              Pantau performa seksi Anda, kelola konsultasi, dan koordinasikan dengan tim Account Representative.
            </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade-in-up delay-100">
             {/* Stat 1: Active Consultations */}
             <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded-full">Aktif</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">{stats.activeConsultations}</h3>
                <p className="text-sm text-slate-500">Konsultasi Berlangsung</p>
             </div>

             {/* Stat 2: Completed Today */}
             <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-full">Hari Ini</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">{stats.completedToday}</h3>
                <p className="text-sm text-slate-500">Konsultasi Selesai</p>
             </div>

             {/* Stat 3: Waiting Taxpayers */}
             <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                 <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <span className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-full">Menunggu</span>
                 </div>
                 <h3 className="text-2xl font-bold text-slate-800">{stats.waitingTaxpayers}</h3>
                 <p className="text-sm text-slate-500">Wajib Pajak Antri</p>
             </div>
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade-in-up delay-200">
             {/* Stat 4: Total ARs */}
             <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Total</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">{stats.totalARs}</h3>
                <p className="text-sm text-slate-500">Account Representative</p>
             </div>

             {/* Stat 5: Total Consultations */}
             <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">Bulanan</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">{stats.totalConsultations}</h3>
                <p className="text-sm text-slate-500">Total Konsultasi</p>
             </div>

             {/* Stat 6: Average Time */}
             <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                 <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">Rata-rata</span>
                 </div>
                 <h3 className="text-2xl font-bold text-slate-800">{formatDuration(stats.avgConsultationTime)}</h3>
                 <p className="text-sm text-slate-500">Waktu Konsultasi</p>
             </div>
        </div>

        {/* Feature Grid */}
        <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">Menu Utama</h3>
        <div className="grid gap-6 md:grid-cols-2 animate-fade-in-up delay-300">

            {/* Card: Live Chat */}
            <Link href="/dashboard/ar/chat" className="group relative">
                <div className="h-full bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-green-500 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <svg className="w-24 h-24 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/></svg>
                    </div>
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 relative">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {unreadChatCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                {unreadChatCount > 99 ? '99+' : unreadChatCount}
                            </div>
                        )}
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-green-600 transition-colors">Live Chat</h3>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">Komunikasi real-time dengan tim Account Representative untuk koordinasi seksi.</p>
                    <span className="inline-flex items-center text-sm font-semibold text-green-600 group-hover:translate-x-1 transition-transform">
                        Buka Chat
                        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </span>
                </div>
            </Link>

            {/* Card: Consultation Queue */}
            <Link href="/dashboard/kepala-seksi/antrian-konsultasi" className="group">
                <div className="h-full bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <svg className="w-24 h-24 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                    </div>
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-amber-600 transition-colors">Antrian Konsultasi</h3>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">Kelola dan pantau antrian konsultasi wajib pajak di seksi Anda.</p>
                    <span className="inline-flex items-center text-sm font-semibold text-amber-600 group-hover:translate-x-1 transition-transform">
                        Kelola Antrian
                        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </span>
                </div>
            </Link>

        </div>

        {/* Recent Consultations */}
        <div className="mt-8 animate-fade-in-up delay-400">
          <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">Konsultasi Terbaru</h3>
          <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Wajib Pajak</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">AR</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ruangan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Durasi</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Waktu Mulai</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {recentConsultations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        <div className="flex flex-col items-center">
                          <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <p>Belum ada konsultasi hari ini</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    recentConsultations.map((consultation) => (
                      <tr key={consultation.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">{consultation.taxpayerName}</div>
                          <div className="text-sm text-slate-500">{consultation.taxpayerNpwp}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{consultation.arName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{consultation.room}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            consultation.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : consultation.status === 'active'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {consultation.status === 'completed' ? 'Selesai' :
                             consultation.status === 'active' ? 'Aktif' : 'Menunggu'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          {consultation.duration ? formatDuration(consultation.duration) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {new Date(consultation.startTime).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-4 text-center">
         <div className="w-1/3 mx-auto h-px bg-slate-200 mb-6"></div>
         <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
            Build with 
            <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/></svg> 
            by AntrianAR Team &copy; {new Date().getFullYear()}
         </p>
      </footer>
    </div>
  )
}