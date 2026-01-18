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

export default function AdminDashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [stats, setStats] = useState({ taxpayerCount: 0, roomCount: 0, userCount: 0 })
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const router = useRouter()
  const { isConnected, joinAdminRoom, joinUser, setUserOnline, socket } = useWebSocket()

  useEffect(() => {
    // Clock timer
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const authRes = await fetch('/api/auth/me')
        const authData = await authRes.json()

        if (authData.user) {
          if (authData.user.role === 'ADMIN') {
            setUser(authData.user)
            
            // Fetch stats only if user is ADMIN
            const statsRes = await fetch('/api/admin/stats')
            if (statsRes.ok) {
              const statsData = await statsRes.json()
              setStats(statsData)
            }
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

  // Join admin room when user is authenticated and socket is connected
  useEffect(() => {
    if (user && isConnected) {
      console.log('🔗 Joining admin room and user room for notifications:', user.id)
      joinAdminRoom()
      joinUser(user.id)
      setUserOnline(user.id, true)
      console.log('✅ Admin dashboard connected to WebSocket rooms')
    }
  }, [user, isConnected, joinAdminRoom, joinUser, setUserOnline])

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

  useEffect(() => {
    if (user?.role === 'ADMIN' && 'Notification' in window) {
      Notification.requestPermission()
    }
  }, [user])

  // Listen for notifications
  useEffect(() => {
    if (!socket) return

    const handleTaxpayerJoinedQueue = (data: any) => {
      console.log('Admin received taxpayer-joined-queue notification:', data)
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'taxpayer-joined-queue',
        message: `Wajib Pajak ${data.taxpayerName} telah bergabung ke antrian`,
        timestamp: new Date(),
        data
      }])
    }

    const handleConsultationUpdated = (data: any) => {
      console.log('Admin received consultation-updated notification:', data)
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'consultation-updated',
        message: `Konsultasi ${data.status} untuk ${data.taxpayerName}`,
        timestamp: new Date(),
        data
      }])
    }

    const handleChatMessage = (data: any) => {
      console.log('Admin Dashboard received chat message:', data)
      
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
          })
        }
      }
    }

    socket.on('taxpayer-joined-queue', handleTaxpayerJoinedQueue)
    socket.on('consultation-updated', handleConsultationUpdated)
    socket.on('chat-message', handleChatMessage)

    return () => {
      socket.off('taxpayer-joined-queue', handleTaxpayerJoinedQueue)
      socket.off('consultation-updated', handleConsultationUpdated)
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
    setNotifications([])
  }

  const handleDownloadConsultations = async () => {
    try {
      const response = await fetch('/api/admin/consultations/export', {
        credentials: 'include'
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `riwayat_konsultasi_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        console.error('Failed to download consultations')
        alert('Gagal mengunduh riwayat konsultasi')
      }
    } catch (error) {
      console.error('Error downloading consultations:', error)
      alert('Terjadi kesalahan saat mengunduh riwayat konsultasi')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium animate-pulse">Memuat Dashboard Admin...</p>
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
               <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-lg shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white font-bold">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                 </svg>
               </div>
               <div>
                 <h1 className="text-xl font-bold tracking-tight text-slate-800">Admin Console</h1>
                 <p className="text-xs text-slate-500 font-medium">Sistem Monitoring Layanan</p>
               </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Notifications */}
              <div className="relative">
                
                {/* Notification Dropdown */}
                {notifications.length > 0 && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
                    <div className="p-4 border-b border-slate-200">
                      <h3 className="text-sm font-semibold text-slate-800">Notifikasi</h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.slice(-5).reverse().map((notification) => (
                        <div key={notification.id} className="p-3 border-b border-slate-100 hover:bg-slate-50">
                          <p className="text-sm text-slate-700">{notification.message}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {notification.timestamp.toLocaleTimeString('id-ID', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                    {notifications.length > 5 && (
                      <div className="p-3 text-center border-t border-slate-200">
                        <button 
                          onClick={() => setNotifications([])}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Tandai semua dibaca
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chat Button */}
              <Link
                href="/dashboard/admin/chat"
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

              <div className="hidden md:block text-right">
                <p className="text-sm font-semibold text-slate-700">{currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</p>
                <p className="text-xs text-slate-500">{currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-700">{user.name}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                    Administrator
                  </span>
                </div>
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
            <h2 className="text-3xl font-bold text-slate-800">Selamat datang kembali, Pak Admin!</h2>
            <p className="text-slate-500 mt-2 max-w-2xl">
              Berikut adalah ringkasan status sistem dan pintasan cepat untuk mengelola layanan antrian dan konsultasi hari ini.
            </p>
        </div>

        {/* Quick Stats Grid (Mockup for Visuals) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade-in-up delay-100">
             {/* Stat 1 */}
             <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded-full">+4.5%</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">{stats.taxpayerCount}</h3>
                <p className="text-sm text-slate-500">Total Wajib Pajak Terdaftar</p>
             </div>
             
             {/* Stat 2 */}
             <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Aktif</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">{stats.roomCount}</h3>
                <p className="text-sm text-slate-500">Ruangan Konsultasi</p>
             </div>

             {/* Stat 3 */}
             <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                 <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">Normal</span>
                 </div>
                 <h3 className="text-2xl font-bold text-slate-800">Online</h3>
                 <p className="text-sm text-slate-500">Status Sistem</p>
             </div>
        </div>

        {/* Feature Grid */}
        <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">Menu Utama</h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-fade-in-up delay-200">
            
            {/* Card: Upload Taxpayers */}
            <Link href="/dashboard/admin/upload-taxpayers" className="group">
                <div className="h-full bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                         <svg className="w-24 h-24 text-indigo-600" fill="currentColor" viewBox="0 0 20 20"><path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z"/></svg>
                    </div>
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">Import Data WP</h3>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">Unggah database Wajib Pajak menggunakan file CSV untuk update data massal.</p>
                    <span className="inline-flex items-center text-sm font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                        Mulai Upload 
                        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </span>
                </div>
            </Link>

            {/* Card: Manage Rooms */}
            <Link href="/dashboard/admin/rooms" className="group">
                 <div className="h-full bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-pink-500 hover:shadow-lg hover:shadow-pink-500/10 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <svg className="w-24 h-24 text-pink-600" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>
                    </div>
                    <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-pink-600 transition-colors">Kelola Ruangan</h3>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">Tambah, edit, atau nonaktifkan ruangan konsultasi beserta loket layanan.</p>
                    <span className="inline-flex items-center text-sm font-semibold text-pink-600 group-hover:translate-x-1 transition-transform">
                        Atur Ruangan
                        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </span>
                </div>
            </Link>

             {/* Card: Manage Seksi */}
             <Link href="/dashboard/admin/seksi" className="group">
                 <div className="h-full bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <svg className="w-24 h-24 text-violet-600" fill="currentColor" viewBox="0 0 20 20"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
                    </div>
                    <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-violet-600 transition-colors">Manajemen Seksi</h3>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">Kelola seksi-seksi dalam sistem untuk mengorganisir pengguna berdasarkan bagian.</p>
                    <span className="inline-flex items-center text-sm font-semibold text-violet-600 group-hover:translate-x-1 transition-transform">
                        Kelola Seksi
                        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </span>
                </div>
            </Link>

             {/* Card: User Management */}
             <Link href="/dashboard/admin/users" className="group">
                 <div className="h-full bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <svg className="w-24 h-24 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </div>
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-emerald-600 transition-colors">Manajemen User</h3>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">Kelola akun, reset password, dan hak akses pengguna sistem.</p>
                    <span className="inline-flex items-center text-sm font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform">
                        Kelola User
                        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </span>
                </div>
            </Link>

            {/* Card: Download Consultation History */}
            <div className="group cursor-pointer" onClick={handleDownloadConsultations}>
                <div className="h-full bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <svg className="w-24 h-24 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                    </div>
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-amber-600 transition-colors">Riwayat Konsultasi</h3>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">Unduh laporan lengkap semua riwayat konsultasi dan layanan yang telah dilakukan.</p>
                    <span className="inline-flex items-center text-sm font-semibold text-amber-600 group-hover:translate-x-1 transition-transform">
                        Unduh Laporan
                        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </span>
                </div>
            </div>

        </div>

      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-4 text-center">
         <div className="w-1/3 mx-auto h-px bg-slate-200 mb-6"></div>
         <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
            Build with 
            <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/></svg> 
            KPP Madya Dua Surabaya &copy; {new Date().getFullYear()}
         </p>
      </footer>
    </div>
  )
}