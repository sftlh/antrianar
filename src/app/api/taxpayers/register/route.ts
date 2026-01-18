import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitToAR, emitToKepalaKantor } from '@/lib/socket'

export async function POST(request: NextRequest) {
  try {
    const { taxpayerId, room } = await request.json()

    if (!taxpayerId) {
      return NextResponse.json({ error: 'Taxpayer ID is required' }, { status: 400 })
    }

    if (!room || !room.trim()) {
      return NextResponse.json({ error: 'Room is required' }, { status: 400 })
    }

    // Check if taxpayer exists
    const taxpayer = await prisma.taxpayer.findUnique({
      where: { id: taxpayerId },
      select: {
        id: true,
        name: true,
        npwp: true,
        assignedArNip: true,
        assignedAr: {
          select: {
            id: true,
            name: true,
            role: true,
          }
        }
      },
    })

    if (!taxpayer) {
      return NextResponse.json({ error: 'Taxpayer not found' }, { status: 404 })
    }

    // Check if taxpayer already has an active consultation (WAITING or IN_CONSULTATION)
    const existingConsultation = await prisma.consultation.findFirst({
      where: {
        taxpayerId: taxpayerId,
        status: {
          in: ['WAITING', 'IN_CONSULTATION']
        }
      }
    })

    if (existingConsultation) {
      return NextResponse.json({ error: 'Taxpayer already has an active consultation' }, { status: 400 })
    }

    // Create new consultation using taxpayer's assigned AR NIP
    const consultation = await prisma.consultation.create({
      data: {
        taxpayerId: taxpayerId,
        arNip: taxpayer.assignedArNip,
        room: room.trim(),
        status: 'WAITING',
      },
      include: {
        taxpayer: {
          select: {
            id: true,
            npwp: true,
            name: true,
          }
        },
        ar: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    // Emit WebSocket event for real-time notification to the assigned AR
    if (taxpayer.assignedArNip) {
      emitToAR(taxpayer.assignedArNip, 'taxpayer-registered', {
        taxpayerId: taxpayer.id,
        taxpayerName: taxpayer.name,
        taxpayerNip: taxpayer.npwp,
        arNip: taxpayer.assignedArNip,
        arName: taxpayer.assignedAr?.name,
        consultationId: consultation.id,
        room: room.trim(),
        timestamp: new Date().toISOString()
      })
    }

    // Emit to Kepala Kantor for real-time stats update
    emitToKepalaKantor('taxpayer-joined-queue', {
      taxpayerId: taxpayer.id,
      taxpayerName: taxpayer.name,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      message: 'Successfully registered for consultation',
      consultation: consultation
    })
  } catch (error) {
    console.error('Error registering for consultation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}