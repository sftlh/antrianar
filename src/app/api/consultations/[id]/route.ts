/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Only RECEPTIONIST can delete consultations
    if (decoded.user.role !== 'RECEPTIONIST') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const consultationId = parseInt(id)

    if (isNaN(consultationId)) {
      return NextResponse.json({ error: 'Invalid consultation ID' }, { status: 400 })
    }

    // Check if consultation exists and is in WAITING status (only allow deletion of waiting consultations)
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { id: true, status: true, taxpayerId: true }
    })

    if (!consultation) {
      return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })
    }

    // Only allow deletion of WAITING consultations
    if (consultation.status !== 'WAITING') {
      return NextResponse.json({
        error: 'Cannot delete consultation that is already in progress or completed'
      }, { status: 400 })
    }

    // Delete the consultation
    await prisma.consultation.delete({
      where: { id: consultationId }
    })

    // Emit WebSocket event for real-time updates
    if (global.io) {
      global.io.emit('consultation-deleted', {
        consultationId,
        taxpayerId: consultation.taxpayerId
      })
    }

    return NextResponse.json({
      message: 'Consultation deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting consultation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}