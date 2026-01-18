import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { emitToAR, emitToKepalaKantor } from '@/lib/socket'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY!) as {
      user: {
        id: number
        nip: string
        role: string
        name: string
      }
    }

    if (decoded.user.role !== 'AR') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { id } = await params
    const consultationId = parseInt(id)
    const { notes, room } = await request.json()

    // Verify the consultation belongs to this AR and is in IN_CONSULTATION status
    const consultation = await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        arNip: decoded.user.nip,
        status: 'IN_CONSULTATION'
      }
    })

    if (!consultation) {
      return NextResponse.json({ error: 'Consultation not found or not authorized' }, { status: 404 })
    }

    // Update consultation status to DONE
    const updatedConsultation = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: 'DONE',
        endTime: new Date(),
        notes: notes || consultation.notes,
        room: room || consultation.room
      }
    })

    // Emit WebSocket event for real-time notification
    emitToAR(decoded.user.nip, 'consultation-status-changed', {
      consultationId: updatedConsultation.id,
      status: 'DONE',
      taxpayerId: updatedConsultation.taxpayerId,
      arNip: decoded.user.nip,
      notes: updatedConsultation.notes,
      timestamp: new Date().toISOString()
    })

    // Emit to Kepala Kantor for real-time stats update
    emitToKepalaKantor('consultation-updated', {
      type: 'consultation_completed',
      consultationId: updatedConsultation.id,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({ consultation: updatedConsultation })
  } catch (error) {
    console.error('Error ending consultation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}