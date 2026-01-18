'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useWebSocket } from '@/contexts/WebSocketContext'

interface User {
  id: number
  nip: string
  role: string
  name: string
  seksiId?: number
  seksi?: {
    id: number
    name: string
  }
}

interface Stats {
  totalConsultations: number
  activeConsultations: number
  completedToday: number
  waitingTaxpayers: number
  totalARs: number
  activeARs: number
  totalSeksi: number
  totalUsers: number
  consultationsBySeksi: { name: string; count: number }[]
  weeklyTrends: { date: string; fullDate: string; count: number }[]
}

interface RecentConsultation {
  id: number
  taxpayer: {
    name: string
    npwp: string
  }
  ar: {
    name: string
    seksi: {
      name: string
    }
  }
  status: string
  createdAt: string
  endTime?: string
}

export default function KepalaKantorDashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>({
    totalConsultations: 0,
    activeConsultations: 0,
    completedToday: 0,
    waitingTaxpayers: 0,
    totalARs: 0,
    activeARs: 0,
    totalSeksi: 0,
    totalUsers: 0,
    consultationsBySeksi: [],
    weeklyTrends: []
  })
  const [recentConsultations, setRecentConsultations] = useState<RecentConsultation[]>([])
  const router = useRouter()
  const { socket, isConnected, joinUser, joinKepalaKantorRoom, setUserOnline } = useWebSocket()
  
  // Refs to track if listeners are registered
  const listenersRegistered = useRef(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const fetchStats = useCallback(async () => {
    if (!token) return
    try {
      setIsUpdating(true)
      console.log('Fetching stats...')
      const res = await fetch('/api/kepala-kantor/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await res.json()
      if (data.stats) {
        console.log('Stats updated:', data.stats)
        setStats(prevStats => ({ ...prevStats, ...data.stats }))
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [token])

  const fetchRecentConsultations = useCallback(async () => {
    if (!token) return
    try {
      setIsUpdating(true)
      console.log('Fetching recent consultations...')
      const res = await fetch('/api/kepala-kantor/consultations/recent', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await res.json()
      console.log('Recent consultations updated:', data.consultations?.length || 0, 'items')
      setRecentConsultations(data.consultations || [])
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error fetching recent consultations:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [token])

  useEffect(() => {
    console.log('useEffect []: Starting auth check')
    fetch('/api/auth/me', {
      credentials: 'include'
    })
      .then((res) => {
        console.log('auth/me response status:', res.status)
        return res.json()
      })
      .then((data) => {
        console.log('auth/me response data:', data)
        if (data.user) {
          if (data.user.role === 'KEPALA_KANTOR') {
            console.log('Setting user and token')
            setUser(data.user)
            setToken(data.token)
          } else {
            console.log('User role not KEPALA_KANTOR:', data.user.role)
            router.push(`/dashboard/${data.user.role.toLowerCase().replace('_', '-')}`)
          }
        } else {
          console.log('No user in response, redirecting to login')
          router.push('/login')
        }
      })
      .catch((error) => {
        console.error('auth/me error:', error)
        router.push('/login')
      })
      .finally(() => {
        console.log('Auth check completed, setting loading to false')
        setLoading(false)
      })
  }, [router])

  // Fetch data when token is available
  useEffect(() => {
    console.log('useEffect [token]: token changed to:', token ? 'present' : 'null')
    if (token) {
      console.log('useEffect [token]: Fetching initial data')
      fetchStats()
      fetchRecentConsultations()
    }
  }, [token, fetchStats, fetchRecentConsultations])

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

  // WebSocket connection and real-time updates
  useEffect(() => {
    console.log('🔍 WebSocket useEffect check:', {
      socket: !!socket,
      isConnected,
      user: !!user,
      token: !!token,
      listenersRegistered: listenersRegistered.current
    })

    if (socket && isConnected && user && token && !listenersRegistered.current) {
      console.log('✅ Setting up WebSocket listeners...')
      
      joinUser(user.id)
      joinKepalaKantorRoom()
      setUserOnline(user.id, true)

      // Listen for real-time updates
      const handleConsultationUpdated = () => {
        console.log('🎯 Received consultation-updated event in Kepala Kantor dashboard')
        fetchStats()
        fetchRecentConsultations()
      }

      const handleConsultationDeleted = () => {
        console.log('🎯 Received consultation-deleted event in Kepala Kantor dashboard')
        fetchStats()
        fetchRecentConsultations()
      }

      const handleTaxpayerJoinedQueue = () => {
        console.log('🎯 Received taxpayer-joined-queue event in Kepala Kantor dashboard')
        fetchStats()
      }

      socket.on('consultation-updated', handleConsultationUpdated)
      socket.on('consultation-deleted', handleConsultationDeleted)
      socket.on('taxpayer-joined-queue', handleTaxpayerJoinedQueue)
      
      listenersRegistered.current = true
      console.log('✅ WebSocket listeners registered')

      return () => {
        console.log('🧹 Cleaning up WebSocket listeners...')
        socket.off('consultation-updated', handleConsultationUpdated)
        socket.off('consultation-deleted', handleConsultationDeleted)
        socket.off('taxpayer-joined-queue', handleTaxpayerJoinedQueue)
        listenersRegistered.current = false
      }
    } else if (!listenersRegistered.current) {
      console.log('⏳ Waiting for WebSocket setup...', {
        socket: !!socket,
        isConnected,
        user: !!user,
        token: !!token
      })
    }
  }, [socket, isConnected, user, token, joinUser, joinKepalaKantorRoom, setUserOnline, fetchStats, fetchRecentConsultations])

  const handleLogout = async () => {
    // Emit offline status before logout
    if (user) {
      setUserOnline(user.id, false)
      console.log('Emitted user-offline for logout:', user.id)
    }

    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const handleTestWebSocket = async () => {
    try {
      console.log('🧪 Testing WebSocket event emission...')
      const response = await fetch('/api/test-websocket', { method: 'POST' })
      const result = await response.json()
      console.log('Test result:', result)
      alert(result.message || result.error)
    } catch (error) {
      console.error('Test failed:', error)
      alert('Test failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'bg-yellow-100 text-yellow-800'
      case 'IN_CONSULTATION':
        return 'bg-blue-100 text-blue-800'
      case 'DONE':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'Menunggu'
      case 'IN_CONSULTATION':
        return 'Sedang Dilayani'
      case 'DONE':
        return 'Selesai'
      default:
        return status
    }
  }

  // Chart Calculations
  const maxWeeklyCount = Math.max(...(stats.weeklyTrends?.map(t => t.count) || [0]), 5)
  const chartHeight = 150
  const chartWidth = 600
  const xStep = stats.weeklyTrends?.length > 1 ? chartWidth / (stats.weeklyTrends.length - 1) : chartWidth
  
  const polylinePoints = stats.weeklyTrends?.map((t, i) => {
    const x = i * xStep
    const y = chartHeight - ((t.count / maxWeeklyCount) * (chartHeight - 20)) - 10 // 20px padding
    return `${x},${y}`
  }).join(' ') || ''

  // Area fill path (closed loop for gradient fill)
  const areaPath = stats.weeklyTrends?.length > 0 
    ? `M${polylinePoints} L${chartWidth},${chartHeight} L0,${chartHeight} Z` 
    : ''

  const maxSeksiCount = Math.max(...(stats.consultationsBySeksi?.map(s => s.count) || [0]), 1)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header with glassmorphism */}
      <header className="relative z-10 backdrop-blur-md bg-white/80 border-b border-white/20 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-xl font-bold">KK</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Dashboard Kepala Kantor
                </h1>
                <p className="text-sm text-gray-600">KPP Madya Dua Surabaya</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.nip}</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-xs text-gray-500">{isConnected ? 'Live' : 'Offline'}</span>
                </div>
                {isUpdating && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-xs text-blue-500">Updating...</span>
                  </div>
                )}
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-700 shadow-xl text-white">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-10 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-white opacity-10 blur-3xl"></div>
          
          <div className="relative px-8 py-10 flex flex-col md:flex-row items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">Selamat Datang, {user.name}</h2>
              <p className="text-blue-100 text-lg">
                Berikut adalah ringkasan kinerja kantor hari ini, {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.
              </p>
              {lastUpdate && (
                <p className="text-blue-200 text-sm mt-1">
                  Terakhir diperbarui: {lastUpdate.toLocaleTimeString('id-ID')}
                </p>
              )}
            </div>
            <div className="mt-6 md:mt-0 flex space-x-4">
              <div className="text-center px-6 py-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
                <span className="block text-2xl font-bold">{stats.waitingTaxpayers}</span>
                <span className="text-xs text-blue-200 uppercase tracking-wider">Menunggu</span>
              </div>
              <div className="text-center px-6 py-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
                <span className="block text-2xl font-bold">{stats.activeConsultations}</span>
                <span className="text-xs text-blue-200 uppercase tracking-wider">Aktif</span>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 flex items-center space-x-4 hover:shadow-xl transition-shadow duration-300">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Pengunjung</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.totalConsultations}</h3>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 flex items-center space-x-4 hover:shadow-xl transition-shadow duration-300">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium">Selesai Hari Ini</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.completedToday}</h3>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 flex items-center space-x-4 hover:shadow-xl transition-shadow duration-300">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium">Total AR Aktif</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.activeARs}</h3>
              <p className="text-xs text-gray-400 mt-1">dari {stats.totalARs} total AR</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 flex items-center space-x-4 hover:shadow-xl transition-shadow duration-300">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Seksi</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.totalSeksi}</h3>
            </div>
          </div>
        </div>

        {/* Charts & Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Weekly Trends Chart */}
          <div className="bg-white rounded-2xl shadow-xl col-span-2 border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Tren Kunjungan Mingguan</h3>
                <p className="text-sm text-gray-500">Aktivitas konsultasi 7 hari terakhir</p>
              </div>
              <div className="flex space-x-2">
                <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Live
                </span>
              </div>
            </div>
            <div className="p-6 relative">
              <div className="h-64 w-full">
                {stats.weeklyTrends?.length > 0 ? (
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
                     {/* Grid lines */}
                      {[0, 1, 2, 3, 4].map(i => (
                        <line 
                          key={i}
                          x1="0" 
                          y1={i * (chartHeight / 4)} 
                          x2={chartWidth} 
                          y2={i * (chartHeight / 4)} 
                          stroke="#f3f4f6" 
                          strokeWidth="1" 
                        />
                     ))}
                     
                     {/* Area Fill */}
                     <path
                        d={areaPath}
                        fill="url(#gradientArea)"
                        className="opacity-20"
                     />
                     
                     {/* Line Path */}
                     <polyline
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="3"
                        points={polylinePoints}
                        className="transition-all duration-1000 ease-in-out"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                     />

                     {/* Data Points */}
                     {stats.weeklyTrends.map((t, i) => {
                        const x = i * xStep
                        const y = chartHeight - ((t.count / maxWeeklyCount) * (chartHeight - 20)) - 10
                        return (
                          <g key={i} className="group">
                             <circle cx={x} cy={y} r="4" fill="#fff" stroke="#4f46e5" strokeWidth="2" className="cursor-pointer hover:r-6 transition-all" />
                             {/* Tooltip on hover (simplified with just text for now) */}
                             <text x={x} y={y - 15} textAnchor="middle" fontSize="12" fill="#1f2937" className="opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                               {t.count}
                             </text>
                             <text x={x} y={chartHeight + 20} textAnchor="middle" fontSize="10" fill="#9ca3af">
                               {t.date}
                             </text>
                          </g>
                        )
                     })}
                     
                     <defs>
                        <linearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.5" />
                           <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                        </linearGradient>
                     </defs>
                  </svg>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    Tidak ada data mingguan
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seksi Performance Bar Chart */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
             <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">Performa Seksi</h3>
                <p className="text-sm text-gray-500">Total konsultasi per seksi</p>
             </div>
             <div className="p-6 space-y-5 overflow-y-auto max-h-[300px] custom-scrollbar">
                {stats.consultationsBySeksi?.length > 0 ? (
                  stats.consultationsBySeksi.map((seksi, idx) => (
                    <div key={idx} className="relative">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700 truncate max-w-[70%]">{seksi.name}</span>
                        <span className="text-sm font-bold text-gray-900">{seksi.count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-2.5 rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: `${(seksi.count / maxSeksiCount) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-8">Belum ada data seksi</div>
                )}
             </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Aktivitas Terbaru</h3>
              <p className="text-sm text-gray-500">Monitoring real-time konsultasi</p>
            </div>
            <button 
              onClick={fetchRecentConsultations}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              title="Refresh"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wajib Pajak</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Layanan</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waktu</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentConsultations.length > 0 ? (
                  recentConsultations.map((consultation) => (
                    <tr key={consultation.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold">
                              {consultation.taxpayer.name.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{consultation.taxpayer.name}</div>
                            <div className="text-sm text-gray-500">{consultation.taxpayer.npwp}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{consultation.ar.seksi.name}</div>
                        <div className="text-xs text-gray-500">AR: {consultation.ar.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(consultation.status)}`}>
                          {getStatusText(consultation.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {consultation.status === 'DONE' && consultation.endTime
                          ? formatDate(consultation.endTime)
                          : formatDate(consultation.createdAt)
                        }
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                      Belum ada aktivitas konsultasi hari ini
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}