'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          // Redirect to role-specific dashboard
          let rolePath = data.user.role.toLowerCase().replace('_', '-')
          
          // Handle special cases
          if (data.user.role === 'RECEPTIONIST') {
            rolePath = 'receptionist'
          }
          
          router.push(`/dashboard/${rolePath}`)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-gray-600">Mengalihkan ke dashboard Anda...</p>
      </div>
    </div>
  )
}