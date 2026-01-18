'use client'

import { useState } from 'react'

export default function ReceptionistPage() {
  const [npwp, setNpwp] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/taxpayers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npwp, name }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Wajib Pajak berhasil ditambahkan!')
        setNpwp('')
        setName('')
      } else {
        setMessage(data.error || 'Gagal menambahkan Wajib Pajak')
      }
    } catch (err) {
      setMessage('Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Resepsionis - Tambah Wajib Pajak
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Masukkan detail Wajib Pajak untuk menambahkan ke antrian.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="npwp" className="sr-only">
                NPWP
              </label>
              <input
                id="npwp"
                name="npwp"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="NPWP"
                value={npwp}
                onChange={(e) => setNpwp(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="name" className="sr-only">
                Nama
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Nama Lengkap"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          {message && (
            <div className={`text-sm text-center ${message.includes('berhasil') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Menambahkan...' : 'Tambah Wajib Pajak'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}