/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // Verify authentication - check header first, then cookie
    let token: string | undefined
    const authHeader = request.headers.get('authorization')

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else {
      // Try to get token from cookie
      token = request.cookies.get('token')?.value
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.SECRET_KEY!) as any

    // Allow access for RECEPTIONIST and KEPALA_KANTOR
    if (!['RECEPTIONIST', 'KEPALA_KANTOR'].includes(decoded.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get active consultations (waiting and in_progress)
    const consultations = await prisma.consultation.findMany({
      where: {
        status: {
          in: ['WAITING', 'IN_CONSULTATION']
        }
      },
      include: {
        taxpayer: {
          select: {
            id: true,
            npwp: true,
            name: true
          }
        },
        ar: {
          select: {
            id: true,
            name: true,
            nip: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Transform ar to assignedAr for frontend compatibility
    const transformedConsultations = consultations.map(consultation => ({
      ...consultation,
      assignedAr: consultation.ar,
      ar: undefined
    }))

    return NextResponse.json({
      consultations: transformedConsultations,
      total: consultations.length
    })

  } catch (error) {
    console.error('Error fetching active consultations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}