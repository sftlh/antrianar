/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Taxpayer {
  id: number
  npwp: string
  name: string
  createdAt: string
  assignedAr?: {
    name: string
    nip: string
  }
}

interface Room {
  id: number
  name: string
  description?: string
  isOccupied?: boolean
  hasBeenUsed?: boolean
}

interface Consultation {
  id: number
  status: string
  room?: string
  createdAt: string
  ar?: {
    name: string
  }
}

interface TaxpayerWithConsultation extends Taxpayer {
  activeConsultation?: Consultation
}

export default function RegisterPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TaxpayerWithConsultation[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [taxpayer, setTaxpayer] = useState<TaxpayerWithConsultation | null>(null)
  const [loading, setLoading] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoom, setSelectedRoom] = useState('')
  const [isSelected, setIsSelected] = useState(false)
  const router = useRouter()

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms')
      const data = await response.json()
      setRooms(data.rooms || [])
    } catch (error) {
      console.error('Error fetching rooms:', error)
    }
  }

  useEffect(() => {
    // Fetch available rooms
    fetchRooms()
  }, [])

  // Search taxpayers when query changes
  useEffect(() => {
    const searchTaxpayers = async () => {
      if (searchQuery.length < 2 || isSelected) {
        setSearchResults([])
        setShowDropdown(false)
        return
      }

      setLoading(true)
      try {
        const response = await fetch(`/api/taxpayers/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await response.json()

        if (response.ok) {
          setSearchResults(data.taxpayers || [])
          setShowDropdown(true)
        } else {
          setSearchResults([])
          setShowDropdown(false)
        }
      } catch (err) {
        console.error('Error searching taxpayers:', err)
        setSearchResults([])
        setShowDropdown(false)
      } finally {
        setLoading(false)
      }
    }

    const debounceTimer = setTimeout(searchTaxpayers, 300) // Debounce search
    return () => clearTimeout(debounceTimer)
  }, [searchQuery, isSelected])

  const handleTaxpayerSelect = (selectedTaxpayer: TaxpayerWithConsultation) => {
    setTaxpayer(selectedTaxpayer)
    setSearchQuery(`${selectedTaxpayer.npwp} - ${selectedTaxpayer.name}`)
    setShowDropdown(false)
    setIsSelected(true)
    setError('')
  }

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setIsSelected(false) // Reset when user types
    if (taxpayer && e.target.value !== `${taxpayer.npwp} - ${taxpayer.name}`) {
      setTaxpayer(null) // Clear selection if user starts typing something different
    }
  }

  const handleRegister = async () => {
    if (!taxpayer) return

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
        taxpayerId: taxpayer.id,
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
        setTaxpayer({
          ...taxpayer,
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
      } else {
        setError(data.error || 'Gagal mendaftar konsultasi')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat mendaftar')
    } finally {
      setRegistering(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'text-yellow-600 bg-yellow-100'
      case 'IN_CONSULTATION':
        return 'text-blue-600 bg-blue-100'
      case 'DONE':
        return 'text-green-600 bg-green-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'Menunggu konsultasi'
      case 'IN_CONSULTATION':
        return 'Sedang konsultasi'
      case 'DONE':
        return 'Konsultasi selesai'
      default:
        return status
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[url('/bg-pattern.svg')] bg-cover">
      <div className="max-w-md w-full mx-auto space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100 backdrop-blur-sm bg-opacity-95 transition-all duration-300 hover:shadow-2xl">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-6 transition-transform duration-300">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 tracking-tight">
            Pendaftaran Konsultasi
          </h2>
          <p className="mt-2 text-sm text-gray-600 max-w-sm mx-auto">
            Selamat datang di KPP Madya Dua Surabaya. Silakan masukkan NPWP untuk mendaftar konsultasi.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="relative group">
            <label htmlFor="search" className="block text-sm font-semibold text-gray-700 mb-1 pl-1">
              Cari Wajib Pajak
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors duration-200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                id="search"
                name="search"
                type="text"
                autoComplete="off"
                value={searchQuery}
                onChange={handleSearchInputChange}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 sm:text-sm shadow-sm"
                placeholder="Ketik NPWP (min 2 angka) atau nama..."
              />
            </div>

            {/* Dropdown for search results */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-20 mt-2 w-full bg-white shadow-2xl max-h-60 rounded-xl py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm transform transition-all duration-200 origin-top animate-in fade-in slide-in-from-top-2">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="cursor-pointer select-none relative py-3 pl-4 pr-9 hover:bg-indigo-50 transition-colors duration-150 border-b border-gray-50 last:border-0"
                    onClick={() => handleTaxpayerSelect(result)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{result.name}</span>
                        <span className="text-xs text-gray-500 font-mono mt-0.5">{result.npwp}</span>
                        {result.assignedAr && (
                          <span className="text-xs text-indigo-600 mt-0.5">AR: {result.assignedAr.name}</span>
                        )}
                      </div>
                      {result.activeConsultation && (
                        <span className={`mt-2 sm:mt-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          result.activeConsultation.status === 'WAITING'
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            : result.activeConsultation.status === 'IN_CONSULTATION'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-green-50 text-green-700 border-green-200'
                        }`}>
                          {result.activeConsultation.status === 'WAITING'
                            ? 'Menunggu'
                            : result.activeConsultation.status === 'IN_CONSULTATION'
                            ? 'Sedang Konsultasi'
                            : 'Selesai'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showDropdown && searchResults.length === 0 && searchQuery.length >= 2 && !loading && (
              <div className="absolute z-20 mt-2 w-full bg-white shadow-lg rounded-xl py-4 px-4 text-sm text-gray-500 text-center border border-gray-100">
                <p>Tidak ada Wajib Pajak ditemukan</p>
              </div>
            )}
          </div>

          {loading && (
            <div className="flex justify-center items-center py-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
              <span className="ml-2 text-sm text-gray-500">Mencari data...</span>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-4 border border-red-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Terdapat kesalahan</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {message && (
          <div className="rounded-xl bg-green-50 p-4 border border-green-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Berhasil</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>{message}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {taxpayer && (
          <div className="bg-gradient-to-br from-white to-gray-50 shadow-md rounded-2xl p-6 border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="border-b border-gray-100 pb-4 mb-4">
               <h3 className="text-lg font-bold text-gray-900">Informasi Wajib Pajak</h3>
               <p className="text-xs text-gray-500 mt-1">Pastikan data berikut sudah benar</p>
            </div>
            
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900 flex items-center">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 mr-2"></span>
                  {taxpayer.name}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">NPWP</dt>
                <dd className="mt-1 text-sm font-mono font-medium text-gray-700 bg-gray-100 rounded px-2 py-1 inline-block border border-gray-200">
                  {taxpayer.npwp}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account Representative</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {taxpayer.activeConsultation ? (taxpayer.activeConsultation.ar?.name || 'Belum ditugaskan') : (taxpayer.assignedAr ? taxpayer.assignedAr.name : 'Belum ditugaskan')}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</dt>
                <dd className="mt-1">
                  {taxpayer.activeConsultation ? (
                    <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-colors">
                      <div className={`absolute top-0 left-0 w-1 h-full ${
                        taxpayer.activeConsultation.status === 'WAITING' ? 'bg-yellow-400' :
                        taxpayer.activeConsultation.status === 'IN_CONSULTATION' ? 'bg-blue-400' : 'bg-green-400'
                      }`}></div>
                      <div className="pl-3">
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            taxpayer.activeConsultation.status === 'WAITING' ? 'bg-yellow-100 text-yellow-800' :
                            taxpayer.activeConsultation.status === 'IN_CONSULTATION' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {getStatusText(taxpayer.activeConsultation.status)}
                          </span>
                          <span className="text-xs text-gray-400">ID: #{taxpayer.activeConsultation.id}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mt-2">
                           AR: {taxpayer.activeConsultation.ar?.name || 'Belum ditugaskan'}
                        </p>
                        {taxpayer.activeConsultation.room && (
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center">
                            <span className="mr-1">📍</span> {taxpayer.activeConsultation.room}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Belum terdaftar konsultasi
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            {taxpayer.activeConsultation?.status === 'WAITING' && (
              <div className="mt-6 bg-yellow-50 rounded-lg p-4 border border-yellow-100">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Menunggu Giliran</h3>
                    <p className="mt-1 text-sm text-yellow-700">
                       Silakan menunggu di ruang tunggu. Anda akan dipanggil oleh AR {taxpayer.activeConsultation.ar?.name || 'yang ditugaskan'}.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {taxpayer.activeConsultation?.status === 'IN_CONSULTATION' && (
              <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-100">
                 <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">Sedang Berlangsung</h3>
                    <p className="mt-1 text-sm text-blue-700">
                      Anda sedang dalam sesi konsultasi dengan {taxpayer.activeConsultation.ar?.name || 'AR yang ditugaskan'}.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {taxpayer.activeConsultation?.status === 'DONE' && (
              <div className="mt-6 bg-green-50 rounded-lg p-4 border border-green-100">
                 <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Selesai</h3>
                    <p className="mt-1 text-sm text-green-700">
                      Sesi konsultasi Anda telah selesai. Terima kasih telah menggunakan layanan ini.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!taxpayer.activeConsultation && (
              <div className="mt-8 space-y-5 border-t border-gray-100 pt-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 pl-1">
                    Pilih Ruangan Konsultasi <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedRoom}
                      onChange={(e) => setSelectedRoom(e.target.value)}
                      required
                      className="block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl shadow-sm bg-gray-50 cursor-pointer hover:bg-white transition-colors"
                    >
                      <option value="">-- Pilih Ruangan --</option>
                      {rooms.filter(r => !r.isOccupied).map((room) => (
                        <option key={room.id} value={room.name}>
                          {room.name} {room.description && `— ${room.description}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleRegister}
                  disabled={registering}
                  className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {registering ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sedang Mendaftar...
                    </span>
                  ) : 'Daftar Konsultasi Sekarang'}
                </button>
              </div>
            )}
          </div>
        )}
        
        <div className="text-center mt-8">
           <p className="text-xs text-gray-400">
             &copy; {new Date().getFullYear()} Sistem Antrian Pelayanan Pajak. <br/>Melayani dengan profesionalisme dan integritas.
           </p>
        </div>
      </div>
    </div>
  )
}