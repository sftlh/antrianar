'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<{ name: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user)
        }
      })
      .catch(() => {
        // User not authenticated, acceptable for landing page
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-slate-800 font-sans selection:bg-indigo-100">
      {/* Navigation */}
      <nav className="fixed w-full z-10 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
                A
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">Antrian<span className="text-indigo-600">AR</span></span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/notice-board" target="_blank" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors hidden sm:block">
                Papan Pengumuman
              </Link>
              {user ? (
                <Link
                  href="/dashboard"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-full text-sm font-medium transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="text-indigo-600 hover:text-white border border-indigo-600 hover:bg-indigo-600 px-5 py-2 rounded-full text-sm font-medium transition-all"
                >
                  Login Petugas
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-medium mb-8 animate-fade-in-up">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Sistem Manajemen Antrian Real-time
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
            Antrian Pengawasan <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">KPP Madya Dua Surabaya</span>
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Sederhanakan proses konsultasi untuk Wajib Pajak dan Account Representative. 
            Antrian efisien, notifikasi real-time, dan manajemen tanpa hambatan.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-xl shadow-indigo-200 transition-all transform hover:-translate-y-1 hover:shadow-2xl flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              Daftar Konsultasi
            </Link>
            <Link
              href="/notice-board"
              target="_blank"
              className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-lg shadow-lg shadow-slate-100 transition-all transform hover:-translate-y-1 hover:shadow-xl flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Lihat Papan Antrian
            </Link>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="bg-white py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Dirancang untuk Efisiensi</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Sistem komprehensif yang menghubungkan Wajib Pajak dengan Account Representative secara lancar.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {/* Card 1 */}
            <div className="group relative p-8 bg-slate-50 rounded-2xl hover:bg-white border border-slate-100 hover:border-indigo-100 transition-all duration-300 hover:shadow-xl">
              <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center mb-6 text-indigo-600 group-hover:scale-110 transition-transform duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Untuk Wajib Pajak</h3>
              <p className="text-slate-600 leading-relaxed mb-6">
                Daftar cepat menggunakan NPWP Anda. Cek status antrian dan dapatkan notifikasi saat giliran Anda tiba.
              </p>
              <Link href="/register" className="text-indigo-600 font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center">
                Daftar Sekarang <span className="ml-1">→</span>
              </Link>
            </div>

            {/* Card 2 */}
            <div className="group relative p-8 bg-slate-50 rounded-2xl hover:bg-white border border-slate-100 hover:border-purple-100 transition-all duration-300 hover:shadow-xl">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-6 text-purple-600 group-hover:scale-110 transition-transform duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                  <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Kelola Antrian</h3>
              <p className="text-slate-600 leading-relaxed mb-6">
                Dashboard real-time untuk Account Representative (AR) mengelola konsultasi dan memantau progres.
              </p>
              {user ? (
                 <Link href="/dashboard" className="text-purple-600 font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center">
                 Ke Dashboard <span className="ml-1">→</span>
               </Link>
              ) : (
                <Link href="/login" className="text-purple-600 font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center">
                  Login Petugas <span className="ml-1">→</span>
                </Link>
              )}
            </div>

            {/* Card 3 */}
            <div className="group relative p-8 bg-slate-50 rounded-2xl hover:bg-white border border-slate-100 hover:border-cyan-100 transition-all duration-300 hover:shadow-xl">
              <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center mb-6 text-cyan-600 group-hover:scale-110 transition-transform duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Papan Pengumuman Langsung</h3>
              <p className="text-slate-600 leading-relaxed mb-6">
                Tampilkan antrian di layar besar dengan pengumuman suara otomatis untuk Wajib Pajak yang menunggu.
              </p>
              <Link href="/notice-board" target="_blank" className="text-cyan-600 font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center">
                Buka Papan <span className="ml-1">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center bg-">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="w-6 h-6 bg-slate-200 rounded-md flex items-center justify-center text-slate-500 font-bold text-xs">
              A
            </div>
            <span className="font-semibold text-slate-700">AntrianAR</span>
          </div>
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Hak Cipta Dilindungi.
          </p>
        </div>
      </footer>
    </div>
  )
}
