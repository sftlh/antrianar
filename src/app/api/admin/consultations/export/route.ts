/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Helper function to check if user is admin
async function isAdmin(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('cookie')
  if (!authHeader || !authHeader.includes('token=')) {
    return false
  }

  try {
    // Use internal URL for API-to-API calls
    const internalUrl = process.env.NODE_ENV === 'production' 
      ? 'http://localhost:3000' 
      : (process.env.NEXTAUTH_URL || 'http://localhost:3000')
    
    const meResponse = await fetch(`${internalUrl}/api/auth/me`, {
      headers: { cookie: authHeader }
    })
    const meData = await meResponse.json()
    return meData.user?.role === 'ADMIN'
  } catch (error) {
    console.error('Auth check failed:', error)
    return false
  }
}

// GET /api/admin/consultations/export - Export all consultation history as CSV
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Fetch all consultations with related data
    const consultations = await prisma.consultation.findMany({
      include: {
        taxpayer: {
          select: {
            name: true,
            npwp: true,
          }
        },
        ar: {
          select: {
            name: true,
            nip: true,
            role: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Create CSV header
    const headers = [
      'ID Konsultasi',
      'Status',
      'Nama Wajib Pajak',
      'NPWP',
      'Nama AR',
      'NIP AR',
      'Role AR',
      'Ruangan',
      'Waktu Dibuat',
      'Waktu Mulai',
      'Waktu Selesai',
      'Durasi (menit)',
      'Catatan'
    ]

    // Create CSV rows
    const rows = consultations.map((consultation: any) => {
      const startTime = consultation.startTime ? new Date(consultation.startTime) : null
      const endTime = consultation.endTime ? new Date(consultation.endTime) : null
      const duration = startTime && endTime ? Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)) : null

      return [
        consultation.id,
        consultation.status,
        consultation.taxpayer?.name || '',
        consultation.taxpayer?.npwp || '',
        consultation.ar?.name || '',
        consultation.ar?.nip || '',
        consultation.ar?.role || '',
        consultation.room || '',
        new Date(consultation.createdAt).toLocaleString('id-ID'),
        startTime ? startTime.toLocaleString('id-ID') : '',
        endTime ? endTime.toLocaleString('id-ID') : '',
        duration || '',
        consultation.notes || ''
      ]
    })

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map(row => row.map((field: any) => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    // Create response with CSV file
    const response = new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="riwayat_konsultasi_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })

    return response
  } catch (error) {
    console.error('Error exporting consultations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}