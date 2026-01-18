'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useWebSocket } from '@/contexts/WebSocketContext'

interface QueueItem {
  id: number
  taxpayerId: number
  taxpayerName: string
  taxpayerNpwp: string
  registrationTime: string
  status: string
  room: string | null
  arName: string | null
  arNip: string | null
  assignedArName: string | null
  assignedArNip: string | null
  arLastChecked: string | null
  startTime: string | null
  estimatedWaitTime: number
}

interface User {
  id: number
  nip: string
  role: string
  name: string
}

export default function AntrianKonsultasiPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()
  const { socket, isConnected, joinUser, setUserOnline } = useWebSocket()

  // Fetch consultation queue
  const fetchQueue = async () => {
    try {
      setRefreshing(true)
      const response = await fetch('/api/kepala-seksi/consultations/queue')
      if (response.ok) {
        const data = await response.json()
        setQueue(data.queue || [])
      }
    } catch (error) {
      console.error('Error fetching queue:', error)
    } finally {
      setRefreshing(false)
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
            await fetchQueue()
          } else {
            router.push(`/dashboard/${authData.user.role.toLowerCase().replace('_', '-')}`)
          }
        } else {
          router.push('/login')
        }
      } catch (error) {
        console.error('Error initializing page:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router])

  // WebSocket setup for real-time updates
  useEffect(() => {
    if (socket && user && isConnected) {
      console.log('Setting up WebSocket listeners for Kepala Seksi Antrian Konsultasi')

      joinUser(user.id)
      setUserOnline(user.id, true)

      // Listen for real-time updates
      const handleConsultationDeleted = () => {
        console.log('🎯 Received consultation-deleted event in Kepala Seksi Antrian Konsultasi')
        fetchQueue()
      }

      socket.on('consultation-deleted', handleConsultationDeleted)

      return () => {
        console.log('🧹 Cleaning up WebSocket listeners for Kepala Seksi Antrian Konsultasi')
        socket.off('consultation-deleted', handleConsultationDeleted)
      }
    }
  }, [socket, user, isConnected])

  // Auto refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchQueue, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatWaitTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'waiting':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
            </svg>
            Menunggu
          </span>
        )
      case 'in_consultation':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            Dalam Konsultasi
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium animate-pulse">Memuat Antrian Konsultasi...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/kepala-seksi" className="flex items-center gap-3 text-slate-600 hover:text-slate-900 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="font-medium">Kembali ke Dashboard</span>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={fetchQueue}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {refreshing ? 'Memuat...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Antrian Konsultasi</h1>
          <p className="text-slate-600">Pantau dan kelola antrian konsultasi wajib pajak di seksi Anda</p>
        </div>

        {/* Queue Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Menunggu</p>
                <p className="text-2xl font-bold text-slate-900">
                  {queue.filter(item => item.status === 'waiting').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Dalam Konsultasi</p>
                <p className="text-2xl font-bold text-slate-900">
                  {queue.filter(item => item.status === 'in_consultation').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Total Antrian</p>
                <p className="text-2xl font-bold text-slate-900">{queue.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Queue Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Daftar Antrian</h2>
          </div>

          {queue.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 text-slate-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Tidak ada antrian</h3>
              <p className="text-slate-500">Saat ini tidak ada wajib pajak dalam antrian konsultasi.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Wajib Pajak
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      AR Ditugaskan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Ruangan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Waktu Registrasi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Estimasi Tunggu
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {queue.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-slate-900">{item.taxpayerName}</div>
                          <div className="text-sm text-slate-500">{item.taxpayerNpwp}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.assignedArName ? (
                          <div>
                            <div className="text-sm font-medium text-slate-900">{item.assignedArName}</div>
                            <div className="text-sm text-slate-500">{item.assignedArNip}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">Belum ditugaskan</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-900">{item.room || 'Belum ditentukan'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-900">{formatTime(item.registrationTime)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-900">{formatWaitTime(item.estimatedWaitTime)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}