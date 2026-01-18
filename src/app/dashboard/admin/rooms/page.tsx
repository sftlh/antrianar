'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface User {
  id: number
  nip: string
  role: string
  name: string
}

interface Room {
  id: number
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  isOccupied?: boolean
  hasBeenUsed?: boolean
}

export default function AdminRoomsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [rooms, setRooms] = useState<Room[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const router = useRouter()

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          if (data.user.role === 'ADMIN') {
            setUser(data.user)
            fetchRooms()
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

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms', { credentials: 'include' })
      const data = await response.json()
      if (response.ok) {
        setRooms(data.rooms || [])
      }
    } catch (error) {
      console.error('Error fetching rooms:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const url = editingRoom ? `/api/rooms/${editingRoom.id}` : '/api/rooms'
      const method = editingRoom ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(editingRoom ? 'Ruangan berhasil diperbarui' : 'Ruangan berhasil ditambahkan')
        setFormData({ name: '', description: '' })
        setShowAddForm(false)
        setEditingRoom(null)
        fetchRooms()
      } else {
        setError(data.error || 'Terjadi kesalahan')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat menyimpan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (room: Room) => {
    setEditingRoom(room)
    setFormData({ name: room.name, description: room.description || '' })
    setShowAddForm(true)
  }

  const handleDelete = async (roomId: number) => {
    if (!confirm('Apakah Anda yakin ingin menonaktifkan ruangan ini?')) return

    try {
      const response = await fetch(`/api/rooms/${roomId}`, { method: 'DELETE', credentials: 'include' })
      if (response.ok) {
        setMessage('Ruangan berhasil dinonaktifkan')
        fetchRooms()
      } else {
        setError('Gagal menonaktifkan ruangan')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat menonaktifkan ruangan')
    }
  }

  const handleToggleActive = async (room: Room) => {
    const action = room.isActive ? 'menonaktifkan' : 'mengaktifkan'
    if (!confirm(`Apakah Anda yakin ingin ${action} ruangan ini?`)) return

    try {
      const response = await fetch(`/api/rooms/${room.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: room.name,
          description: room.description || '',
          isActive: !room.isActive
        }),
        credentials: 'include',
      })
      if (response.ok) {
        setMessage(`Ruangan berhasil di${action}`)
        fetchRooms()
      } else {
        const errorData = await response.json()
        setError(errorData.error || `Gagal ${action} ruangan`)
      }
    } catch (err) {
      setError(`Terjadi kesalahan saat ${action} ruangan`)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 relative font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Abstract Background Decoration */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none"></div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
               <Link href="/dashboard/admin" className="group flex items-center gap-4 transition-opacity hover:opacity-80">
                 <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-lg shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white font-bold group-hover:scale-105 transition-transform">
                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                   </svg>
                 </div>
                 <div>
                   <h1 className="text-xl font-bold tracking-tight text-slate-800">Admin Console</h1>
                   <p className="text-xs text-slate-500 font-medium">Manajemen Ruangan</p>
                 </div>
               </Link>
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
        
        {/* Page Header & Actions */}
        <div className="md:flex md:items-center md:justify-between mb-8 animate-fade-in-up">
            <div>
                 <nav className="flex mb-1" aria-label="Breadcrumb">
                  <ol className="flex items-center space-x-2">
                    <li><Link href="/dashboard/admin" className="text-slate-400 hover:text-slate-500 transition-colors"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg></Link></li>
                    <li className="text-slate-300">/</li>
                    <li><span className="text-sm font-medium text-indigo-600 select-none">Manajemen Ruangan</span></li>
                  </ol>
                </nav>
                <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
                  Daftar Ruangan
                </h2>
            </div>
            <div className="mt-4 flex md:ml-4 md:mt-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(!showAddForm)
                    setEditingRoom(null)
                    setFormData({ name: '', description: '' })
                  }}
                  className={`group inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-lg transition-all duration-200 ${showAddForm ? 'bg-slate-600 hover:bg-slate-700 shadow-slate-500/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30 hover:-translate-y-0.5'}`}
                >
                  {showAddForm ? (
                    <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        Batal
                    </>
                  ) : (
                    <>
                        <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Tambah Ruangan Baru
                    </>
                  )}
                </button>
            </div>
        </div>

        {error && (
            <div className="rounded-xl bg-red-50 p-4 mb-6 border border-red-100 animate-fade-in">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Gagal Memproses</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
        )}

        {message && (
            <div className="rounded-xl bg-green-50 p-4 mb-6 border border-green-100 animate-fade-in">
               <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">{message}</p>
                </div>
              </div>
            </div>
        )}

        {showAddForm && (
            <div className="bg-white/80 backdrop-blur-sm shadow-xl shadow-slate-200/50 rounded-2xl p-6 mb-8 border border-slate-100 animate-fade-in-up">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                {editingRoom ? 'Edit Data Ruangan' : 'Input Ruangan Baru'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nama Ruangan <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="block w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        placeholder="Contoh: Ruang Konsultasi 1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi <span className="text-slate-400 text-xs font-normal">(Opsional)</span></label>
                      <input
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="block w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        placeholder="Keterangan fungsi ruangan"
                      />
                    </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-wait transition-all"
                  >
                    {submitting ? 'Menyimpan...' : (editingRoom ? 'Simpan Perubahan' : 'Simpan Data')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
                      setEditingRoom(null)
                      setFormData({ name: '', description: '' })
                    }}
                    className="inline-flex justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition-all"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
        )}

        <div className="bg-white/80 backdrop-blur-sm shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden border border-slate-100">
           <div className="min-w-full divide-y divide-slate-100">
              {rooms.length === 0 ? (
                <div className="px-6 py-12 text-center">
                    <div className="mx-auto h-12 w-12 text-slate-400 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-slate-900">Belum ada ruangan</h3>
                    <p className="mt-1 text-sm text-slate-500">Mulai dengan menambahkan ruangan baru untuk layanan.</p>
                </div>
              ) : (
                <ul role="list" className="divide-y divide-slate-100">
                  {rooms.map((room) => (
                    <li key={room.id} className="group hover:bg-slate-50 transition-colors duration-150">
                      <div className="px-6 py-5 flex items-center justify-between sm:px-8">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="text-lg font-semibold text-slate-900 truncate">{room.name}</h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              room.isActive 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' 
                                : 'bg-rose-50 text-rose-700 border-red-200/50'
                            }`}>
                               <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${room.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                              {room.isActive ? 'Aktif' : 'Nonaktif'}
                            </span>
                            {room.isOccupied && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/50">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                Sedang Digunakan
                              </span>
                            )}
                          </div>
                          {room.description && (
                            <p className="text-sm text-slate-500 mb-2">{room.description}</p>
                          )}
                          <div className="flex items-center text-xs text-slate-400 gap-4">
                              <span className="flex items-center">
                                  <svg className="mr-1.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  Dibuat: {new Date(room.createdAt).toLocaleDateString()}
                              </span>
                              {room.hasBeenUsed && (
                                  <span className="flex items-center text-indigo-400">
                                      <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                      Pernah Digunakan
                                  </span>
                              )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => handleEdit(room)}
                            className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                            title="Edit Ruangan"
                          >
                             <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <div className="h-6 w-px bg-slate-200"></div>
                          <button
                            onClick={() => handleToggleActive(room)}
                            className={`inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                              room.isActive 
                                ? 'bg-rose-500 hover:bg-rose-600 focus:ring-rose-500' 
                                : 'bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-500'
                            }`}
                          >
                            {room.isActive ? (
                                <>
                                    <svg className="mr-1.5 -ml-0.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                    Nonaktifkan
                                </>
                            ) : (
                                <>
                                    <svg className="mr-1.5 -ml-0.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Aktifkan
                                </>
                            )}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
           </div>
        </div>
      </main>
    </div>
  )
}