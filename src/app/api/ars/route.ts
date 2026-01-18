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

    // Get all ARs (users with role AR)
    const ars = await prisma.user.findMany({
      where: {
        role: 'AR'
      },
      select: {
        id: true,
        nip: true,
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Check availability for each AR (not assigned to active consultations)
    const arsWithAvailability = await Promise.all(
      ars.map(async (ar: any) => {
        const activeConsultation = await prisma.consultation.findFirst({
          where: {
            arNip: ar.nip,
            status: {
              in: ['WAITING', 'IN_CONSULTATION']
            }
          }
        })

        return {
          ...ar,
          isAvailable: !activeConsultation
        }
      })
    )

    return NextResponse.json({
      ars: arsWithAvailability,
      total: arsWithAvailability.length
    })

  } catch (error) {
    console.error('Error fetching ARs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}