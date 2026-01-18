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

    return NextResponse.json({
      consultations,
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

export async function POST(request: NextRequest) {
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

    // Only RECEPTIONIST can create consultations
    if (decoded.user.role !== 'RECEPTIONIST') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { npwp, name, assignedArId, room } = body

    // Get AR nip if assignedArId is provided
    let arNip: string | null = null
    if (assignedArId) {
      const ar = await prisma.user.findUnique({
        where: { id: parseInt(assignedArId) },
        select: { nip: true }
      })
      if (ar) {
        arNip = ar.nip
      }
    }

    // Create or find taxpayer
    let taxpayer = await prisma.taxpayer.findUnique({
      where: { npwp }
    })

    if (!taxpayer) {
      taxpayer = await prisma.taxpayer.create({
        data: {
          npwp,
          name
        }
      })
    }

    // Create consultation
    const consultation = await prisma.consultation.create({
      data: {
        taxpayerId: taxpayer.id,
        status: 'WAITING',
        room: room || null,
        arNip: arNip
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
      }
    })

    // Emit WebSocket event for real-time updates
    if (global.io) {
      global.io.emit('consultation-created', {
        consultation: {
          id: consultation.id,
          status: consultation.status,
          taxpayer: consultation.taxpayer,
          assignedAr: consultation.ar,
          room: consultation.room,
          createdAt: consultation.createdAt
        }
      })
    }

    return NextResponse.json({
      consultation,
      message: 'Consultation created successfully'
    })

  } catch (error) {
    console.error('Error creating consultation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}