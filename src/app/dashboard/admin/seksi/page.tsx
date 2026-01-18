'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Seksi {
  id: number
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  users: {
    id: number
    nip: string
    name: string
    role: string
  }[]
  _count: {
    users: number
  }
}

interface User {
  id: number
  nip: string
  role: string
  name: string
}

export default function AdminSeksiPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [seksi, setSeksi] = useState<Seksi[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSeksi, setEditingSeksi] = useState<Seksi | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  // Fetch seksi data
  const fetchSeksi = async () => {
    try {
      const response = await fetch('/api/seksi')
      if (response.ok) {
        const data = await response.json()
        setSeksi(data.seksi || [])
      }
    } catch (error) {
      console.error('Error fetching seksi:', error)
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const authRes = await fetch('/api/auth/me')
        const authData = await authRes.json()

        if (authData.user) {
          if (authData.user.role === 'ADMIN') {
            setUser(authData.user)
            await fetchSeksi()
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

  const handleCreateSeksi = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/seksi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await fetchSeksi()
        setShowCreateModal(false)
        setFormData({ name: '', description: '' })
      } else {
        const error = await response.json()
        alert(error.error || 'Gagal membuat seksi')
      }
    } catch (error) {
      console.error('Error creating seksi:', error)
      alert('Terjadi kesalahan saat membuat seksi')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSeksi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSeksi) return

    setSubmitting(true)

    try {
      const response = await fetch(`/api/seksi/${editingSeksi.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await fetchSeksi()
        setShowEditModal(false)
        setEditingSeksi(null)
        setFormData({ name: '', description: '' })
      } else {
        const error = await response.json()
        alert(error.error || 'Gagal mengupdate seksi')
      }
    } catch (error) {
      console.error('Error updating seksi:', error)
      alert('Terjadi kesalahan saat mengupdate seksi')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSeksi = async (seksiId: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus seksi ini?')) return

    try {
      const response = await fetch(`/api/seksi/${seksiId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchSeksi()
      } else {
        const error = await response.json()
        alert(error.error || 'Gagal menghapus seksi')
      }
    } catch (error) {
      console.error('Error deleting seksi:', error)
      alert('Terjadi kesalahan saat menghapus seksi')
    }
  }

  const openEditModal = (seksi: Seksi) => {
    setEditingSeksi(seksi)
    setFormData({
      name: seksi.name,
      description: seksi.description || ''
    })
    setShowEditModal(true)
  }

  const getTotalUsers = () => seksi.reduce((acc, curr) => acc + curr._count.users, 0)
  const getActiveSeksi = () => seksi.filter(s => s.isActive).length

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium animate-pulse">Memuat Data Seksi...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 relative selection:bg-violet-100 selection:text-violet-900 font-sans">
      {/* Abstract Background Decoration */}
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-violet-50/80 to-transparent pointer-events-none"></div>
      <div className="fixed top-20 right-0 p-12 opacity-5 pointer-events-none overflow-hidden z-0">
         <svg className="w-96 h-96 text-violet-900" fill="currentColor" viewBox="0 0 200 200">
            <path d="M45.5,0.8C59.9,3.6,73.5,9,85.6,18.5C97.7,28,108.3,41.6,108.9,56.7C109.5,71.8,100,88.4,87.3,100.8C74.6,113.2,58.7,121.5,42.8,122.9C26.9,124.3,11,118.8,-2.6,109.9C-16.2,101,-27.5,88.7,-35.3,74.7C-43.1,60.7,-47.4,45,-49.2,29.8C-51,14.6,-50.2,-0.1,-43.3,-11.2C-36.4,-22.3,-23.4,-29.8,-9.4,-31.2C4.6,-32.6,19.6,-27.9,31.1,-20.5" transform="translate(100 100)" />
         </svg>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm support-backdrop-blur:bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-6">
              <Link href="/dashboard/admin" className="group flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all">
                <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="font-medium">Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
              <div className="flex items-center gap-3">
                 <div className="w-9 h-9 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                 </div>
                 <h1 className="text-xl font-bold text-slate-900 tracking-tight">Manajemen Seksi</h1>
              </div>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-200 font-medium"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Tambah Seksi
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
           <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
               <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <svg className="w-20 h-20 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
               </div>
               <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Seksi</p>
                  <h3 className="text-3xl font-bold text-slate-800">{seksi.length}</h3>
               </div>
               <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
               </div>
           </div>
           
           <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
               <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <svg className="w-20 h-20 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"/></svg>
               </div>
               <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Seksi Aktif</p>
                  <h3 className="text-3xl font-bold text-slate-800">{getActiveSeksi()}</h3>
               </div>
               <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
               </div>
           </div>
           
           <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
               <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <svg className="w-20 h-20 text-violet-600" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
               </div>
               <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Unit/Pengguna</p>
                  <h3 className="text-3xl font-bold text-slate-800">{getTotalUsers()}</h3>
               </div>
               <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
               </div>
           </div>
        </div>

        {/* Seksi Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {seksi.map((item) => (
            <div key={item.id} className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:shadow-violet-500/10 hover:border-violet-200 transition-all duration-300 relative overflow-hidden flex flex-col h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-100 to-indigo-50 text-violet-600 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 group-hover:text-violet-700 transition-colors">{item.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                       <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${
                        item.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                         <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${item.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                         {item.isActive ? 'Aktif' : 'Non-Aktif'}
                       </span>
                    </div>
                  </div>
                </div>
                
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 flex gap-1 bg-white p-1 rounded-lg shadow-sm border border-slate-100">
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-md transition-colors"
                    title="Edit Seksi"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteSeksi(item.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Hapus Seksi"
                    disabled={item._count.users > 0}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex-grow">
                <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">
                  {item.description || <span className="text-slate-400 italic">Tidak ada deskripsi</span>}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-auto flex items-center justify-between text-xs font-medium text-slate-500">
                <div className="flex items-center gap-1.5 max-w-[60%] truncate" title="Jumlah Pengguna">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="truncate">{item._count.users} Anggota Team</span>
                </div>
                <div title="Tanggal Dibuat">
                   {new Date(item.createdAt).toLocaleDateString('id-ID', { year: '2-digit', month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>
          ))}

           {/* Add New Card (Ghost) */}
           <button
             onClick={() => setShowCreateModal(true)} 
             className="group bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:border-violet-400 hover:bg-violet-50/50 transition-all duration-300 min-h-[220px]"
           >
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                 <svg className="w-7 h-7 text-slate-400 group-hover:text-violet-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                 </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-600 group-hover:text-violet-700 transition-colors">Tambah Seksi Baru</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Buat grup baru untuk mengorganisir pengguna sistem</p>
           </button>
        </div>

        {/* Empty State (Not needed if ghost card is always there, but good to keep as backup logic) */}
        {seksi.length === 0 && (
          <div className="text-center py-20 hidden">
             {/* Hiddden because of the ghost card above, but can be used if we want a full empty page feel differently */}
          </div>
        )}
      </main>

      {/* Create Seksi Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-0 shadow-2xl border border-slate-100 overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h2 className="text-xl font-bold text-slate-800">Buat Seksi Baru</h2>
               <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
            </div>
            
            <form onSubmit={handleCreateSeksi} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Nama Seksi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all placeholder:text-slate-400"
                    placeholder="Contoh: Seksi Pengawasan I"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Deskripsi
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all placeholder:text-slate-400 min-h-[100px]"
                    placeholder="Jelaskan tugas dan fungsi seksi ini (opsional)"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-8 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setFormData({ name: '', description: '' })
                  }}
                  className="flex-1 px-4 py-2.5 text-slate-600 font-medium bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                       <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                       Memproses...
                    </span>
                  ) : 'Buat Seksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Seksi Modal */}
      {showEditModal && editingSeksi && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl max-w-md w-full p-0 shadow-2xl border border-slate-100 overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h2 className="text-xl font-bold text-slate-800">Edit Seksi</h2>
               <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
            </div>

            <form onSubmit={handleEditSeksi} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Nama Seksi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all placeholder:text-slate-400"
                    placeholder="Nama seksi"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Deskripsi
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all placeholder:text-slate-400 min-h-[100px]"
                    placeholder="Deskripsi seksi"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-8 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingSeksi(null)
                    setFormData({ name: '', description: '' })
                  }}
                  className="flex-1 px-4 py-2.5 text-slate-600 font-medium bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                       <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                       Menyimpan...
                    </span>
                  ) : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}