'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Contact {
  id: number
  name: string
  email?: string
  phoneNumber?: string
  scanKTP?: string
  createdAt: string
}

interface Taxpayer {
  id: number
  npwp: string
  name: string
  contacts: Contact[]
}

interface User {
  id: number
  nip: string
  role: string
  name: string
}

export default function ARContactsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [taxpayers, setTaxpayers] = useState<Taxpayer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          if (data.user.role === 'AR') {
            setUser(data.user)
            fetchContacts()
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

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/ar/contacts')
      const data = await res.json()
      setTaxpayers(data.taxpayers || [])
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }

  const filteredTaxpayers = taxpayers.filter(tp => 
    tp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    tp.npwp.includes(searchTerm) ||
    tp.contacts.some(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50 relative font-sans text-slate-800">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none sticky top-0"></div>
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-blue-50/80 to-transparent pointer-events-none"></div>

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/dashboard/ar" className="flex items-center gap-4 group hover:opacity-80 transition-opacity">
               <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-xl group-hover:scale-105 transition-transform">
                 AR
               </div>
               <div>
                  <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Dashboard AR</h1>
                  <p className="text-xs text-slate-500 font-medium mt-1">KPP Madya Dua Surabaya</p>
               </div>
            </Link>
            
            <div className="flex items-center gap-4 bg-slate-50/80 px-4 py-2 rounded-full border border-slate-200/60 backdrop-blur-sm">
               <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-700">{user.name}</p>
                  <p className="text-xs text-slate-500 font-medium">NIP. {user.nip}</p>
               </div>
               <button
                onClick={handleLogout}
                className="group flex items-center justify-center w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all duration-200 shadow-sm"
                title="Keluar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
                <Link href="/dashboard/ar" className="text-sm text-slate-500 hover:text-blue-600 mb-2 inline-flex items-center gap-1 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Kembali ke Dashboard
                </Link>
                <h2 className="text-2xl font-bold text-slate-800">Daftar Kontak Wajib Pajak</h2>
                <p className="text-slate-500 mt-1">Kelola data PIC dan riwayat kontak wajib pajak Anda.</p>
            </div>
            
            <div className="w-full sm:w-72 relative">
                <input 
                    type="text" 
                    placeholder="Cari Nama/NPWP/PIC..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                />
                <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
        </div>

        <div className="space-y-6">
            {filteredTaxpayers.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">Tidak ada data ditemukan</h3>
                    <p className="text-slate-500 mt-1">Belum ada wajib pajak yang ditugaskan atau sesuai pencarian.</p>
                </div>
            ) : (
                filteredTaxpayers.map((tp) => (
                    <div key={tp.id} className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-slate-100 transition-all hover:shadow-md">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                            <div className="md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-6">
                                <h3 className="font-bold text-lg text-slate-800">{tp.name}</h3>
                                <p className="font-mono text-slate-500 bg-slate-50 inline-block px-2 py-0.5 rounded text-sm mt-1">{tp.npwp}</p>
                                
                                <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    Total PIC: {tp.contacts.length}
                                </div>
                            </div>
                            
                            <div className="md:w-2/3">
                                {tp.contacts.length > 0 ? (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {tp.contacts.map((contact) => (
                                            <div key={contact.id} className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 relative group">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg shadow-sm border border-slate-100">
                                                        👤
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-slate-800 text-sm truncate">{contact.name}</p>
                                                        
                                                        {contact.phoneNumber && (
                                                            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
                                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                                </svg>
                                                                {contact.phoneNumber}
                                                            </div>
                                                        )}
                                                        
                                                        {contact.email && (
                                                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                                </svg>
                                                                {contact.email}
                                                            </div>
                                                        )}
                                                        
                                                        <p className="text-[10px] text-slate-400 mt-2">Dibuat: {new Date(contact.createdAt).toLocaleDateString('id-ID')}</p>
                                                    </div>
                                                </div>
                                                
                                                {contact.scanKTP && (
                                                    <a 
                                                        href={contact.scanKTP} 
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-3 flex items-center justify-center gap-2 w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                        Lihat Scan KTP
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                        <p className="text-sm text-slate-500 font-medium">Belum ada data kontak</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
      </main>
    </div>
  )
}
