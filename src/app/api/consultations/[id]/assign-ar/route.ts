/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Only RECEPTIONIST can assign ARs
    if (decoded.user.role !== 'RECEPTIONIST') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const consultationId = parseInt(id)
    if (isNaN(consultationId)) {
      return NextResponse.json({ error: 'Invalid consultation ID' }, { status: 400 })
    }

    const body = await request.json()
    const { arId } = body

    if (!arId) {
      return NextResponse.json({ error: 'AR ID is required' }, { status: 400 })
    }

    // Get AR nip from ID
    const ar = await prisma.user.findUnique({
      where: { id: parseInt(arId) },
      select: { nip: true, name: true }
    })

    if (!ar) {
      return NextResponse.json({ error: 'AR not found' }, { status: 404 })
    }

    // Check if consultation exists
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        taxpayer: {
          select: {
            id: true,
            npwp: true,
            name: true
          }
        }
      }
    })

    if (!consultation) {
      return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })
    }

    // Update consultation with assigned AR
    const updatedConsultation = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        arNip: ar.nip,
        status: 'WAITING' // Ensure status is waiting when AR is assigned
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
      global.io.emit('consultation-updated', {
        consultation: {
          id: updatedConsultation.id,
          status: updatedConsultation.status,
          taxpayer: updatedConsultation.taxpayer,
          assignedAr: updatedConsultation.ar,
          room: updatedConsultation.room,
          createdAt: updatedConsultation.createdAt
        }
      })
    }

    return NextResponse.json({
      consultation: {
        id: updatedConsultation.id,
        status: updatedConsultation.status,
        taxpayer: updatedConsultation.taxpayer,
        assignedAr: updatedConsultation.ar,
        room: updatedConsultation.room,
        createdAt: updatedConsultation.createdAt
      },
      message: 'AR assigned successfully'
    })

  } catch (error) {
    console.error('Error assigning AR:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}