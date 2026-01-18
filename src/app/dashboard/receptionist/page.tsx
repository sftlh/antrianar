/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWebSocket } from '@/contexts/WebSocketContext'

interface User {
  id: number
  nip: string
  role: string
  name: string
}

interface Consultation {
  id: number
  status: string
  createdAt: string
  taxpayer: {
    id: number
    npwp: string
    name: string
  }
  assignedAr: {
    id: number
    name: string
    nip: string
  } | null
  room?: string
}

interface AR {
  id: number
  name: string
  nip: string
  isAvailable: boolean
}

interface TaxpayerWithConsultation {
  id: number
  npwp: string
  name: string
  assignedAr?: {
    name: string
    nip: string
  }
  activeConsultation?: {
    id: number
    status: string
    room?: string
    createdAt: string
    ar?: {
      name: string
    }
  }
}

export default function ReceptionistDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [ars, setArs] = useState<AR[]>([])
  const [stats, setStats] = useState({ totalConsultations: 0, completedToday: 0, activeConsultations: 0, availableARs: 0 })
  const [loading, setLoading] = useState(true)
  const [showNewConsultationForm, setShowNewConsultationForm] = useState(false)
  const [consultationsLoaded, setConsultationsLoaded] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const { socket, isConnected, joinUser, setUserOnline } = useWebSocket()

  // Room interface
  interface Room {
    id: number
    name: string
    description?: string
    isOccupied?: boolean
    hasBeenUsed?: boolean
  }

  const [rooms, setRooms] = useState<Room[]>([])

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms')
      const data = await response.json()
      setRooms(data.rooms || [])
    } catch (error) {
      console.error('Error fetching rooms:', error)
    }
  }

  // Authentication check
  useEffect(() => {
    fetch('/api/auth/me', {
      credentials: 'include'
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          if (data.user.role === 'RECEPTIONIST') {
            setUser(data.user)
            setToken(data.token)
          } else {
            const roleRoutes: Record<string, string> = {
              'KEPALA_KANTOR': '/dashboard/kepala-kantor',
              'ACCOUNT_REPRESENTATIVE': '/dashboard/ar',
              'ADMIN': '/dashboard/admin',
              'RECEPTIONIST': '/dashboard/receptionist'
            }
            const redirectPath = roleRoutes[data.user.role] || '/login'
            router.push(redirectPath)
          }
        } else {
          router.push('/login')
        }
      })
      .catch((error) => {
        console.error('auth/me error:', error)
        router.push('/login')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [router])

  // WebSocket setup for real-time updates
  useEffect(() => {
    if (socket && user && isConnected) {
      console.log('Setting up WebSocket listeners for Receptionist Dashboard')

      joinUser(user.id)
      setUserOnline(user.id, true)

      // Listen for real-time updates from AR activities
      const handleConsultationUpdated = (data: any) => {
        console.log('🎯 Received consultation-updated event in Receptionist Dashboard:', data)
        setConsultations(prev => prev.map(consultation => {
          if (consultation.id === data.consultationId) {
            const wasNotDone = consultation.status !== 'DONE'
            const isNowDone = data.status === 'DONE'
            
            // Update stats if status changed to DONE
            if (wasNotDone && isNowDone) {
              setStats(prev => ({ ...prev, completedToday: prev.completedToday + 1 }))
            }
            
            return {
              ...consultation,
              status: data.status || consultation.status,
              assignedAr: data.arId ? {
                id: data.arId,
                name: data.arName,
                nip: data.arNip
              } : consultation.assignedAr,
              room: data.room || consultation.room
            }
          }
          return consultation
        }))
        // Also refresh ARs availability
        fetchData()
        fetchRooms()
      }

      const handleConsultationDeleted = (data: any) => {
        console.log('🎯 Received consultation-deleted event in Receptionist Dashboard:', data)
        setConsultations(prev => prev.filter(consultation => consultation.id !== data.consultationId))
        fetchRooms() // Refresh rooms in case room is freed
      }

      const handleTaxpayerRegistered = (data: any) => {
        console.log('🎯 Received taxpayer-registered event in Receptionist Dashboard:', data)
        // Add new consultation to the list
        const newConsultation: Consultation = {
          id: data.consultation.id,
          status: 'WAITING',
          createdAt: data.consultation.startTime,
          taxpayer: {
            id: data.taxpayerId,
            npwp: data.taxpayerNip,
            name: data.taxpayerName
          },
          assignedAr: null,
          room: data.room
        }
        setConsultations(prev => [...prev, newConsultation])
        fetchRooms() // Refresh rooms to mark as occupied
      }

      socket.on('consultation-updated', handleConsultationUpdated)
      socket.on('consultation-deleted', handleConsultationDeleted)
      socket.on('taxpayer-registered', handleTaxpayerRegistered)

      return () => {
        console.log('🧹 Cleaning up WebSocket listeners for Receptionist Dashboard')
        socket.off('consultation-updated', handleConsultationUpdated)
        socket.off('consultation-deleted', handleConsultationDeleted)
        socket.off('taxpayer-registered', handleTaxpayerRegistered)
      }
    }
  }, [socket, user, isConnected])

  // Fetch rooms on component mount
  useEffect(() => {
    fetchRooms()
  }, [])

  // Form state for new consultation
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTaxpayer, setSelectedTaxpayer] = useState<TaxpayerWithConsultation | null>(null)
  const [showTaxpayerDropdown, setShowTaxpayerDropdown] = useState(false)
  const [isSearchingTaxpayer, setIsSearchingTaxpayer] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState('')

  // Autofill states
  const [npwpSearchResults, setNpwpSearchResults] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    if (!token) return
    try {
      // Don't set loading on refresh to avoid page flicker
      const headers = { 'Authorization': `Bearer ${token}` }
      const [consultationsRes, arsRes, statsRes] = await Promise.all([
        fetch('/api/consultations/active', { headers }),
        fetch('/api/ars', { headers }),
        fetch('/api/receptionist/stats', { headers })
      ])

      if (consultationsRes.ok) {
        const consultationsData = await consultationsRes.json()
        setConsultations(consultationsData.consultations || [])
      }

      if (arsRes.ok) {
        const arsData = await arsRes.json()
        setArs(arsData.ars || [])
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      setConsultationsLoaded(true)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }, [token])

  // Fetch data when token is available
  useEffect(() => {
    if (token) {
      fetchData()
      // Refresh data every 30 seconds
      const interval = setInterval(fetchData, 30000)
      return () => clearInterval(interval)
    }
  }, [token, fetchData])

  const handleSearchChange = async (value: string) => {
    setSearchQuery(value)
    setSelectedTaxpayer(null) // Clear selection when user types

    if (value.length >= 2 && token) {
      setIsSearchingTaxpayer(true)
      try {
        const response = await fetch(`/api/taxpayers/search?q=${encodeURIComponent(value)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (response.ok) {
          const data = await response.json()
          const filteredTaxpayers = consultationsLoaded 
            ? (data.taxpayers || []).filter((taxpayer: any) => {
                const activeCons = consultations.find(c => c.taxpayer.id === taxpayer.id && c.status !== 'DONE')
                return !activeCons // Hanya tampilkan wajib pajak yang tidak memiliki konsultasi aktif
              })
            : (data.taxpayers || []) // Jika consultations belum loaded, tampilkan semua
          setNpwpSearchResults(filteredTaxpayers)
          setShowTaxpayerDropdown(filteredTaxpayers.length > 0)
        }
      } catch (error) {
        console.error('Error searching taxpayers:', error)
      } finally {
        setIsSearchingTaxpayer(false)
      }
    } else {
      setNpwpSearchResults([])
      setShowTaxpayerDropdown(false)
    }
  }

  const handleTaxpayerSelect = (taxpayer: any) => {
    setSelectedTaxpayer(taxpayer)
    setSearchQuery(`${taxpayer.npwp} - ${taxpayer.name}`)
    setShowTaxpayerDropdown(false)
    setNpwpSearchResults([])
  }

  const handleCreateConsultation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTaxpayer) return

    if (!selectedRoom) {
      setError('Silakan pilih ruangan konsultasi')
      return
    }

    setRegistering(true)
    setError('')
    setMessage('')

    try {
      // Prepare registration data
      const registrationData: any = {
        taxpayerId: selectedTaxpayer.id,
        room: selectedRoom
      }

      const response = await fetch('/api/taxpayers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Berhasil mendaftar konsultasi! Mohon tunggu AR untuk membantu Anda.')
        // Update the taxpayer with the new consultation
        setSelectedTaxpayer({
          ...selectedTaxpayer,
          activeConsultation: {
            id: data.consultation.id,
            status: 'WAITING',
            room: selectedRoom,
            createdAt: data.consultation.startTime,
            ar: data.consultation.ar ? { name: data.consultation.ar.name } : undefined
          }
        })
        setSelectedRoom('') // Reset room selection
        fetchRooms() // Refresh rooms list to reflect the occupied room
        fetchData() // Refresh consultations
      } else {
        setError(data.error || 'Gagal mendaftar konsultasi')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat mendaftar')
    } finally {
      setRegistering(false)
    }
  }

  const handleAssignAR = async (consultationId: number, arId: string) => {
    if (!token) return

    try {
      const response = await fetch(`/api/consultations/${consultationId}/assign-ar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ arId: parseInt(arId) }),
      })

      if (response.ok) {
        fetchData() // Refresh data
      }
    } catch (error) {
      console.error('Error assigning AR:', error)
    }
  }

  const handleDeleteConsultation = async (consultationId: number) => {
    if (!token) return

    // Show confirmation dialog
    const confirmed = window.confirm('Apakah Anda yakin ingin menghapus konsultasi ini? Tindakan ini tidak dapat dibatalkan.')

    if (!confirmed) return

    try {
      const response = await fetch(`/api/consultations/${consultationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
      })

      if (response.ok) {
        fetchData() // Refresh data
        alert('Konsultasi berhasil dihapus')
      } else {
        const errorData = await response.json()
        alert(`Gagal menghapus konsultasi: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting consultation:', error)
      alert('Terjadi kesalahan saat menghapus konsultasi')
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 11) return 'Selamat Pagi'
    if (hour < 15) return 'Selamat Siang'
    if (hour < 18) return 'Selamat Sore'
    return 'Selamat Malam'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WAITING': return 'bg-amber-100 text-amber-700 border border-amber-200'
      case 'IN_CONSULTATION': return 'bg-blue-100 text-blue-700 border border-blue-200'
      case 'DONE': return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
      default: return 'bg-gray-100 text-gray-700 border border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'WAITING': return 'Menunggu'
      case 'IN_CONSULTATION': return 'Sedang Berlangsung'
      case 'DONE': return 'Selesai'
      default: return status
    }
  }

  const handleLogout = async () => {
    // Emit offline status before logout
    if (user) {
      setUserOnline(user.id, false)
      console.log('Emitted user-offline for logout:', user.id)
    }
    
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto">
             <div className="absolute inset-0 border-4 border-indigo-200 rounded-full animate-pulse"></div>
             <div className="absolute inset-2 border-4 border-t-indigo-600 border-indigo-100 rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-indigo-900 font-medium text-lg animate-pulse">Memuat dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null 
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] relative font-sans text-slate-800">
      {/* Decorative Background Elements */}
      <div className="fixed top-0 left-0 right-0 h-80 bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-600 z-0 rounded-b-[40px] shadow-2xl"></div>
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none z-0"></div>
      <div className="fixed top-0 left-0 w-[400px] h-[400px] bg-indigo-400/20 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none z-0"></div>

      {/* Navbar */}
      <nav className="relative z-10 px-8 py-6 w-full max-w-7xl mx-auto flex justify-between items-center text-white">
        <div className="flex items-center gap-5">
           <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20 shadow-lg group hover:scale-105 transition-transform duration-300">
             <svg className="w-8 h-8 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
             </svg>
           </div>
           <div>
             <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">KPP Madya Dua Surabaya</h1>
             <p className="text-indigo-100 text-sm font-medium opacity-90 tracking-wide">Receptionist Workspace</p>
           </div>
        </div>

        <div className="flex items-center gap-6">
           {user && (
             <div className="flex items-center gap-4 bg-white/10 px-5 py-2.5 rounded-full border border-white/10 backdrop-blur-md hover:bg-white/20 transition-all cursor-pointer">
                <div className="text-right hidden sm:block">
                    <p className="text-xs text-indigo-200 font-medium">{getGreeting()}</p>
                    <p className="text-sm font-bold text-white leading-tight">{user.name}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-white flex items-center justify-center text-indigo-700 font-bold text-lg shadow-inner border-2 border-white/50">
                    {user.name.charAt(0)}
                </div>
             </div>
           )}
           <button 
             onClick={handleLogout}
             className="w-10 h-10 rounded-full bg-red-500/80 hover:bg-red-500 backdrop-blur-sm text-white flex items-center justify-center transition-all shadow-lg hover:shadow-red-500/30"
             title="Logout"
           >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
             </svg>
           </button>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pb-20 mt-4">
        {/* Statistics Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
           {/* Card 1 */}
           <div className="bg-white rounded-2xl p-6 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 border border-slate-100 relative overflow-hidden group">
               <div className="absolute right-0 top-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
               <div className="relative z-10">
                   <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4 shadow-sm group-hover:rotate-6 transition-transform">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                       </svg>
                   </div>
                   <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">Menunggu</p>
                   <h3 className="text-3xl font-extrabold text-slate-800 mt-1">
                      {consultations.filter(c => c.status === 'WAITING').length}
                   </h3>
               </div>
           </div>

           {/* Card 2 */}
           <div className="bg-white rounded-2xl p-6 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 border border-slate-100 relative overflow-hidden group">
               <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
               <div className="relative z-10">
                   <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-sm group-hover:rotate-6 transition-transform">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                       </svg>
                   </div>
                   <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">Berlangsung</p>
                   <h3 className="text-3xl font-extrabold text-slate-800 mt-1">
                      {consultations.filter(c => c.status === 'IN_CONSULTATION').length}
                   </h3>
               </div>
           </div>

           {/* Card 3 */}
           <div className="bg-white rounded-2xl p-6 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 border border-slate-100 relative overflow-hidden group">
               <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
               <div className="relative z-10">
                   <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4 shadow-sm group-hover:rotate-6 transition-transform">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                       </svg>
                   </div>
                   <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">Selesai Hari Ini</p>
                   <h3 className="text-3xl font-extrabold text-slate-800 mt-1">
                      {stats.completedToday}
                   </h3>
               </div>
           </div>

           {/* Card 4 */}
           <div className="bg-white rounded-2xl p-6 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 border border-slate-100 relative overflow-hidden group">
               <div className="absolute right-0 top-0 w-32 h-32 bg-purple-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
               <div className="relative z-10">
                   <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-sm group-hover:rotate-6 transition-transform">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                       </svg>
                   </div>
                   <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">AR Tersedia</p>
                   <h3 className="text-3xl font-extrabold text-slate-800 mt-1">
                      {ars.filter(ar => ar.isAvailable).length}
                   </h3>
               </div>
           </div>
        </div>

        {/* Content Area */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white overflow-hidden flex flex-col min-h-[500px]">
           {/* Section Header */}
           <div className="px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50">
               <div>
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <span className="w-2 h-8 bg-indigo-600 rounded-full block"></span>
                    Antrian & Konsultasi
                  </h2>
                  <p className="text-slate-500 mt-1 ml-5">Kelola antrian wajib pajak dan penugasan Account Representative</p>
               </div>
               <button 
                  onClick={() => setShowNewConsultationForm(true)}
                  className="group bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex items-center gap-2 font-semibold"
               >
                  <svg className="w-5 h-5 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Konsultasi Baru
               </button>
           </div>

           {/* Table */}
           <div className="flex-1 overflow-auto">
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Wajib Pajak</th>
                      <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Penugasan AR</th>
                      <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Ruangan</th>
                      <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Waktu Dibuat</th>
                      <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {consultations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-8 py-20 text-center">
                           <div className="flex flex-col items-center justify-center opacity-40">
                              <svg className="w-24 h-24 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <h3 className="text-xl font-semibold text-slate-600">Belum ada antrian aktif</h3>
                              <p className="text-slate-400 mt-1">Buat konsultasi baru untuk memulai pelayanan hari ini.</p>
                           </div>
                        </td>
                      </tr>
                   ) : (
                      consultations.map((consultation) => (
                         <tr key={consultation.id} className="group hover:bg-slate-50 transition-colors duration-200">
                            <td className="px-8 py-5 align-middle">
                               <div>
                                  <p className="font-bold text-slate-800 text-base">{consultation.taxpayer.name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded font-mono border border-slate-200">NPWP</span>
                                    <span className="text-sm text-slate-500 font-mono tracking-wide">{consultation.taxpayer.npwp}</span>
                                  </div>
                               </div>
                            </td>
                            <td className="px-8 py-5 align-middle">
                               <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${getStatusColor(consultation.status)}`}>
                                  {getStatusText(consultation.status)}
                               </span>
                            </td>
                            <td className="px-8 py-5 align-middle">
                               {consultation.assignedAr ? (
                                  <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold border border-indigo-200">
                                         {consultation.assignedAr.name.charAt(0)}
                                      </div>
                                      <div className="text-sm font-semibold text-slate-700">
                                         {consultation.assignedAr.name}
                                      </div>
                                  </div>
                               ) : (
                                  <div className="relative">
                                    <select
                                      onChange={(e) => handleAssignAR(consultation.id, e.target.value)}
                                      className="appearance-none bg-white border border-slate-300 text-slate-700 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-3 pr-8 py-2.5 shadow-sm hover:border-indigo-400 transition-colors cursor-pointer font-medium"
                                      defaultValue=""
                                    >
                                      <option value="" disabled>Pilih AR Tersedia</option>
                                      {ars.filter(ar => ar.isAvailable).map(ar => (
                                        <option key={ar.id} value={ar.id}>
                                          {ar.name}
                                        </option>
                                      ))}
                                      {ars.filter(ar => !ar.isAvailable).map(ar => (
                                        <option key={ar.id} value={ar.id} disabled className="text-slate-400 bg-slate-50">
                                          {ar.name} (Sibuk)
                                        </option>
                                      ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                               )}
                            </td>
                            <td className="px-8 py-5 align-middle">
                               <div className="text-sm font-medium text-slate-600 bg-slate-100/50 inline-block px-3 py-1 rounded-lg">
                                  {consultation.room || '-'}
                               </div>
                            </td>
                            <td className="px-8 py-5 align-middle">
                               <span className="text-sm text-slate-500">
                                  {new Date(consultation.createdAt).toLocaleString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                               </span>
                            </td>
                            <td className="px-8 py-5 align-middle text-right">
                               <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Hapus" onClick={() => handleDeleteConsultation(consultation.id)}>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                               </div>
                            </td>
                         </tr>
                      ))
                   )}
                </tbody>
             </table>
           </div>
        </div>
      </main>

      {/* Modern Modal */}
      {showNewConsultationForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity" onClick={() => setShowNewConsultationForm(false)}></div>
          
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl relative z-10 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
             <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white rounded-t-3xl sticky top-0 z-20">
                <div>
                   <h3 className="text-xl font-bold text-slate-800">Konsultasi Baru</h3>
                   <p className="text-slate-500 text-sm mt-1">Buat tiket antrian untuk wajib pajak</p>
                </div>
                <button 
                  onClick={() => setShowNewConsultationForm(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
             </div>
             
             <div className={`p-8 ${showTaxpayerDropdown ? 'overflow-visible' : 'overflow-y-auto'}`}>
                {error && (
                  <div className="mb-6 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3 text-sm">
                      <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <span className="font-semibold block mb-1">Gagal Memproses</span>
                        {error}
                      </div>
                  </div>
                )}

                {message && (
                  <div className="mb-6 bg-green-50 border border-green-100 text-green-700 px-4 py-3 rounded-xl flex items-start gap-3 text-sm">
                      <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <span className="font-semibold block mb-1">Berhasil</span>
                        {message}
                      </div>
                  </div>
                )}

                <form onSubmit={handleCreateConsultation} className="space-y-8">
                   {/* Search Section */}
                   <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <span className="bg-indigo-100 text-indigo-600 w-5 h-5 rounded flex items-center justify-center text-xs">1</span>
                        Cari Wajib Pajak
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          onFocus={() => {
                            if (npwpSearchResults.length > 0) setShowTaxpayerDropdown(true)
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowTaxpayerDropdown(false), 200)
                          }}
                          className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                          placeholder="Masukkan NPWP atau Nama Wajib Pajak..."
                          required
                        />
                        {isSearchingTaxpayer && (
                            <div className="absolute right-3.5 top-3.5">
                                <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                        )}

                        {/* Dropdown */}
                        {showTaxpayerDropdown && npwpSearchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-slate-100 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] max-h-[300px] overflow-auto divide-y divide-slate-50">
                                {npwpSearchResults.map((taxpayer) => (
                                    <div
                                        key={taxpayer.id}
                                        onClick={() => handleTaxpayerSelect(taxpayer)}
                                        className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold text-slate-900 text-sm">{taxpayer.name}</p>
                                                <p className="text-xs text-slate-500 font-mono mt-1 bg-slate-100 inline-block px-1.5 py-0.5 rounded">{taxpayer.npwp}</p>
                                            </div>
                                            {(() => {
                                              const activeCons = consultations.find(c => c.taxpayer.id === taxpayer.id && c.status !== 'DONE')
                                              return activeCons ? (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                                  activeCons.status === 'WAITING'
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                    : activeCons.status === 'IN_CONSULTATION'
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                }`}>
                                                  {activeCons.status === 'WAITING' ? 'Menunggu' : activeCons.status === 'IN_CONSULTATION' ? 'Berlangsung' : 'Selesai'}
                                                </span>
                                              ) : null
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                      </div>
                   </div>

                   {/* Selected Taxpayer Logic */}
                   {selectedTaxpayer && (
                       <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
                           {/* Info Card */}
                           <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 relative overflow-hidden">
                               <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-indigo-50 rounded-full blur-2xl"></div>
                               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 relative z-10">Data Wajib Pajak</h4>
                               <div className="grid grid-cols-2 gap-6 relative z-10">
                                   <div>
                                       <p className="text-xs text-slate-500 mb-1">Nama Lengkap</p>
                                       <p className="font-semibold text-slate-900">{selectedTaxpayer.name}</p>
                                   </div>
                                   <div>
                                       <p className="text-xs text-slate-500 mb-1">NPWP</p>
                                       <p className="font-mono text-sm text-slate-700">{selectedTaxpayer.npwp}</p>
                                   </div>
                                   <div className="col-span-2 pt-2 border-t border-slate-200/50">
                                       <p className="text-xs text-slate-500 mb-1">Account Representative</p>
                                       <div className="flex items-center gap-2">
                                           <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                                               {(selectedTaxpayer.assignedAr?.name || '?').charAt(0)}
                                           </div>
                                           <span className="font-medium text-slate-900 text-sm">
                                             {selectedTaxpayer.assignedAr?.name || 'Belum ditugaskan'}
                                           </span>
                                       </div>
                                   </div>
                               </div>
                           </div>

                           {/* Status Logic */}
                           {(() => {
                               // Extract active consultation status
                               const activeCons = consultations.find(c => c.taxpayer.id === selectedTaxpayer.id && c.status !== 'DONE')
                               
                               if (activeCons) {
                                   return (
                                       <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-center">
                                           <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-600">
                                               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                               </svg>
                                           </div>
                                           <h3 className="text-amber-900 font-bold mb-1">Sedang Dalam Antrian</h3>
                                           <p className="text-amber-700 text-sm mb-6 max-w-xs mx-auto">
                                             Wajib pajak ini sudah memiliki antrian aktif dengan status <span className="font-bold">{getStatusText(activeCons.status)}</span>
                                           </p>
                                           <button
                                             type="button"
                                             onClick={() => {
                                                  setSearchQuery('')
                                                  setSelectedTaxpayer(null)
                                                  setShowNewConsultationForm(false)
                                             }}
                                             className="px-6 py-2.5 bg-white border border-amber-200 text-amber-700 rounded-xl text-sm font-semibold hover:bg-amber-50 transition-colors shadow-sm"
                                           >
                                             Tutup
                                           </button>
                                       </div>
                                   )
                               }

                               return (
                                   <div className="space-y-8">
                                       {/* Input Room */}
                                       <div className="space-y-3">
                                          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <span className="bg-indigo-100 text-indigo-600 w-5 h-5 rounded flex items-center justify-center text-xs">2</span>
                                            Pilih Ruangan
                                          </label>
                                          <div className="grid grid-cols-1 gap-3">
                                              <select
                                                  value={selectedRoom}
                                                  onChange={(e) => setSelectedRoom(e.target.value)}
                                                  required
                                                  className="appearance-none block w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-medium"
                                              >
                                                  <option value="">-- Pilih Ruangan Konsultasi --</option>
                                                  {rooms.filter(r => !r.isOccupied).map((room) => (
                                                      <option key={room.id} value={room.name}>
                                                          {room.name} {room.description && `- ${room.description}`}
                                                      </option>
                                                  ))}
                                              </select>
                                          </div>
                                       </div>

                                       <div className="flex gap-4 pt-4 border-t border-slate-100">
                                           <button
                                             type="button"
                                             onClick={() => setShowNewConsultationForm(false)}
                                             className="flex-1 px-6 py-3.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm"
                                           >
                                             Batal
                                           </button>
                                           <button
                                             type="submit"
                                             disabled={registering}
                                             className="flex-1 px-6 py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                           >
                                             {registering ? (
                                                <>
                                                 <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                 </svg>
                                                 Memproses...
                                                </>
                                             ) : (
                                                 'Buat Antrian'
                                             )}
                                           </button>
                                       </div>
                                   </div>
                               )
                           })()}
                       </div>
                   )}
                </form>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}