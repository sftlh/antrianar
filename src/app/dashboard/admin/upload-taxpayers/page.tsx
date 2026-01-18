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

export default function UploadTaxpayersPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setMessage('')
      setError('')
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Silakan pilih file CSV.')
      return
    }

    setUploading(true)
    setMessage('')
    setError('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/taxpayers/bulk-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`Berhasil mengunggah ${data.insertedCount} Wajib Pajak.`)
        setFile(null)
        // Reset file input
        const fileInput = document.getElementById('file') as HTMLInputElement
        if (fileInput) fileInput.value = ''
      } else {
        setError(data.error || 'Gagal mengunggah data.')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat mengunggah.')
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadTemplate = () => {
    const csvContent = 'npwp,name,ar_nip\n0123456789012345,PT Suka Maju,123456789\n9876543210987654,Budi Santoso,987654321'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_wajib_pajak.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
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
                   <p className="text-xs text-slate-500 font-medium">Unggah Data Wajib Pajak</p>
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
        
        {/* Page Header */}
        <div className="md:flex md:items-center md:justify-between mb-8 animate-fade-in-up">
            <div>
                 <nav className="flex mb-1" aria-label="Breadcrumb">
                  <ol className="flex items-center space-x-2">
                    <li><Link href="/dashboard/admin" className="text-slate-400 hover:text-slate-500 transition-colors"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg></Link></li>
                    <li className="text-slate-300">/</li>
                    <li><span className="text-sm font-medium text-indigo-600 select-none">Unggah Data</span></li>
                  </ol>
                </nav>
                <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
                  Unggah Data Wajib Pajak
                </h2>
                <p className="mt-1 text-sm text-slate-500">Unggah file CSV berisi data Wajib Pajak untuk memperbarui database.</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Upload Section */}
            <div className="bg-white/80 backdrop-blur-sm shadow-xl shadow-slate-200/50 rounded-2xl p-6 border border-slate-100 animate-fade-in-up">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                </div>
                Form Upload CSV
              </h3>
              
              <form onSubmit={handleUpload} className="space-y-6">
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 transition-colors hover:border-indigo-400 bg-slate-50/50">
                    <div className="flex flex-col items-center justify-center text-center">
                         <div className="mb-4 text-indigo-500">
                             <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                         </div>
                         <label htmlFor="file" className="cursor-pointer">
                            <span className="mt-2 block text-sm font-semibold text-indigo-600 hover:text-indigo-500">Pilih file CSV</span>
                            <span className="mt-1 block text-xs text-slate-500">{file ? file.name : 'atau drag & drop file di sini'}</span>
                            <input
                              id="file"
                              name="file"
                              type="file"
                              accept=".csv"
                              onChange={handleFileChange}
                              className="sr-only"
                              required
                            />
                         </label>
                    </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="inline-flex justify-center items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-wait transition-all w-full sm:w-auto"
                  >
                    {uploading ? (
                        <>
                             <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                             Mengunggah...
                        </>
                    ) : 'Unggah Data'}
                  </button>
                </div>
              </form>
            </div>

            {/* Instruction & Template Section */}
             <div className="space-y-6">
                <div className="bg-white/80 backdrop-blur-sm shadow-xl shadow-slate-200/50 rounded-2xl p-6 border border-slate-100 animate-fade-in-up delay-100">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Panduan Format Data</h3>
                   <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden mb-4">
                    <div className="flex border-b border-slate-200 bg-slate-100 px-4 py-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Format Kolom CSV</span>
                    </div>
                    <pre className="p-4 text-sm text-slate-700 font-mono overflow-x-auto whitespace-pre">
    {`npwp,name,ar_nip
    0123456789012345,PT Suka Maju,123456789
    9876543210987654,Budi Santoso,987654321`}
                    </pre>
                  </div>
                  
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-6">
                     <div className="flex gap-3">
                         <div className="flex-shrink-0 text-amber-500">
                             <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                         </div>
                         <div className="text-sm text-amber-800 space-y-2">
                            <p className="font-semibold">Catatan Penting:</p>
                             <ul className="list-disc pl-4 space-y-1">
                                <li>Kolom <strong>ar_nip</strong> bersifat opsional.</li>
                                <li><strong>ar_nip</strong> kosong = WP tidak ditugaskan ke AR.</li>
                                <li>Format NIP AR harus <strong>9 digit</strong>.</li>
                                <li>NPWP: 15 atau 16 digit (tanpa tanda baca).</li>
                              </ul>
                         </div>
                     </div>
                  </div>

                  <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-slate-300 shadow-sm text-sm font-semibold rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
                      </svg>
                      Unduh Template CSV
                    </button>
                </div>
             </div>
        </div>
      </main>
    </div>
  )
}