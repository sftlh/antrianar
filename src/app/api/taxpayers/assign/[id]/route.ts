import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { emitToAR } from '@/lib/socket'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const taxpayerId = parseInt(id)

    // Find the active consultation for this taxpayer
    const consultation = await prisma.consultation.findFirst({
      where: {
        taxpayerId: taxpayerId,
        status: 'WAITING',
      },
    })

    if (!consultation) {
      return NextResponse.json({ error: 'No active consultation found for this taxpayer' }, { status: 404 })
    }

    // Update consultation status and assign AR to taxpayer
    await prisma.consultation.update({
      where: { id: consultation.id },
      data: {
        status: 'IN_CONSULTATION',
      },
    })

    // Update taxpayer to assign the AR
    const taxpayer = await prisma.taxpayer.update({
      where: { id: taxpayerId },
      data: {
        assignedArNip: decoded.user.nip,
      },
      include: {
        assignedAr: true,
      },
    })

    // Emit WebSocket event for real-time notification
    emitToAR(decoded.user.nip, 'new-taxpayer-assigned', {
      taxpayerId: taxpayer.id,
      taxpayerName: taxpayer.name,
      taxpayerNip: taxpayer.npwp,
      arNip: decoded.user.nip,
      arName: decoded.user.name,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({ message: 'Taxpayer assigned successfully', taxpayer })
  } catch (error) {
    console.error('Error assigning taxpayer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}