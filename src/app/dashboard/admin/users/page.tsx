'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface User {
  id: number
  nip: string
  name: string
  role: string
  seksiId?: number | null
  seksi?: {
    id: number
    name: string
  } | null
  lastCheckedAt?: string
  createdAt: string
  updatedAt: string
  _count?: {
    consultations: number
    assignedTaxpayers: number
  }
}

interface Seksi {
  id: number
  name: string
  description?: string
  isActive: boolean
}

interface UserFormData {
  nip: string
  name: string
  role: string
  seksiId?: number | null
  password?: string
}

export default function AdminUsersPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [seksiList, setSeksiList] = useState<Seksi[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<UserFormData>({ nip: '', name: '', role: 'PELAKSANA', seksiId: null })
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
            fetchUsers()
            fetchSeksi()
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

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users', { credentials: 'include' })
      const data = await response.json()
      if (response.ok) {
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchSeksi = async () => {
    try {
      const response = await fetch('/api/seksi', { credentials: 'include' })
      const data = await response.json()
      if (response.ok) {
        setSeksiList(data.seksi || [])
      }
    } catch (error) {
      console.error('Error fetching seksi:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(editingUser ? 'User berhasil diperbarui' : 'User berhasil ditambahkan')
        setFormData({ nip: '', name: '', role: 'PELAKSANA', seksiId: null })
        setShowAddForm(false)
        setEditingUser(null)
        fetchUsers()
      } else {
        setError(data.error || 'Terjadi kesalahan')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat menyimpan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({ nip: user.nip, name: user.name, role: user.role, seksiId: user.seksiId || null })
    setShowAddForm(true)
  }

  const handleDelete = async (user: User) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus user ${user.name}? Tindakan ini tidak dapat dibatalkan.`)) return

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (response.ok) {
        setMessage('User berhasil dihapus')
        fetchUsers()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Gagal menghapus user')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat menghapus user')
    }
  }

  const handleResetPassword = async (userId: number, userName: string) => {
    const newPassword = prompt(`Masukkan password baru untuk ${userName}:`)
    if (!newPassword || newPassword.length < 6) {
      if (newPassword !== null) {
        alert('Password harus minimal 6 karakter')
      }
      return
    }

    try {
      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
        credentials: 'include',
      })
      if (response.ok) {
        setMessage('Password berhasil direset')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Gagal reset password')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat reset password')
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-50 text-red-700 border-red-200/50'
      case 'KEPALA_KANTOR': return 'bg-purple-50 text-purple-700 border-purple-200/50'
      case 'KEPALA_SEKSI': return 'bg-blue-50 text-blue-700 border-blue-200/50'
      case 'AR': return 'bg-indigo-50 text-indigo-700 border-indigo-200/50'
      case 'PELAKSANA': return 'bg-green-50 text-green-700 border-green-200/50'
      default: return 'bg-gray-50 text-gray-700 border-gray-200/50'
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'KEPALA_KANTOR': return 'Kepala Kantor'
      case 'KEPALA_SEKSI': return 'Kepala Seksi'
      case 'AR': return 'Account Representative'
      case 'PELAKSANA': return 'Pelaksana'
      case 'ADMIN': return 'Administrator'
      default: return role
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium animate-pulse">Memuat...</p>
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
                   <p className="text-xs text-slate-500 font-medium">Manajemen User</p>
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
                    <li><span className="text-sm font-medium text-indigo-600 select-none">Manajemen User</span></li>
                  </ol>
                </nav>
                <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
                  Daftar User Sistem
                </h2>
                <p className="mt-1 text-sm text-slate-500">Kelola akun pengguna, hak akses, dan status keaktifan user.</p>
            </div>
            <div className="mt-4 flex md:ml-4 md:mt-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(!showAddForm)
                    setEditingUser(null)
                    setFormData({ nip: '', name: '', role: 'PELAKSANA', seksiId: null })
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
                        Tambah User Baru
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
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                </div>
                {editingUser ? 'Edit Data User' : 'Input User Baru'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">NIP <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={formData.nip}
                        onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                        className="block w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        placeholder="Masukkan NIP (9 digit)"
                        maxLength={9}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="block w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        placeholder="Nama lengkap user"
                      />
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Role/Jabatan <span className="text-red-500">*</span></label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="block w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      >
                        <option value="PELAKSANA">Pelaksana</option>
                        <option value="AR">Account Representative</option>
                        <option value="KEPALA_SEKSI">Kepala Seksi</option>
                        <option value="KEPALA_KANTOR">Kepala Kantor</option>
                        <option value="ADMIN">Administrator</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Seksi</label>
                      <select
                        value={formData.seksiId || ''}
                        onChange={(e) => setFormData({ ...formData, seksiId: e.target.value ? parseInt(e.target.value) : null })}
                        className="block w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      >
                        <option value="">Tidak ada seksi</option>
                        {seksiList.filter(s => s.isActive).map((seksi) => (
                          <option key={seksi.id} value={seksi.id}>{seksi.name}</option>
                        ))}
                      </select>
                    </div>
                </div>
                {!editingUser && (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Password Default <span className="text-red-500">*</span></label>
                      <input
                        type="password"
                        required={!editingUser}
                        value={formData.password || ''}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="block w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        placeholder="Password awal"
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-wait transition-all"
                  >
                    {submitting ? 'Menyimpan...' : (editingUser ? 'Simpan Perubahan' : 'Simpan User')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
                      setEditingUser(null)
                      setFormData({ nip: '', name: '', role: 'PELAKSANA', seksiId: null })
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
              {users.length === 0 ? (
                <div className="px-6 py-12 text-center">
                    <div className="mx-auto h-12 w-12 text-slate-400 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-slate-900">Belum ada user</h3>
                    <p className="mt-1 text-sm text-slate-500">Mulai dengan menambahkan user baru ke sistem.</p>
                </div>
              ) : (
                <ul role="list" className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <li key={user.id} className="group hover:bg-slate-50 transition-colors duration-150">
                      <div className="px-6 py-5 flex items-center justify-between sm:px-8">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="text-lg font-semibold text-slate-900 truncate">{user.name}</h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                              {getRoleDisplayName(user.role)}
                            </span>
                            {user.seksi && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200/50">
                                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                {user.seksi.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center text-xs text-slate-400 gap-4">
                              <span className="flex items-center">
                                  <svg className="mr-1.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" /></svg>
                                  NIP: {user.nip}
                              </span>
                              <span className="flex items-center">
                                  <svg className="mr-1.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  Dibuat: {new Date(user.createdAt).toLocaleDateString()}
                              </span>
                              {user.lastCheckedAt && (
                                  <span className="flex items-center text-indigo-400">
                                      <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                      Check-in terakhir: {new Date(user.lastCheckedAt).toLocaleDateString()}
                                  </span>
                              )}
                              {user._count && (
                                <>
                                  <span className="flex items-center text-blue-400">
                                      <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                      Konsultasi: {user._count.consultations}
                                  </span>
                                  <span className="flex items-center text-green-400">
                                      <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                      Wajib Pajak: {user._count.assignedTaxpayers}
                                  </span>
                                </>
                              )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => handleEdit(user)}
                            className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                            title="Edit User"
                          >
                             <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            onClick={() => handleResetPassword(user.id, user.name)}
                            className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-slate-400 hover:bg-amber-50 hover:text-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
                            title="Reset Password"
                          >
                             <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                          </button>
                          <div className="h-6 w-px bg-slate-200"></div>
                          <button
                            onClick={() => handleDelete(user)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                            title="Hapus User"
                          >
                            <svg className="mr-1.5 -ml-0.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Hapus
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