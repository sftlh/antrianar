import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitToAR, emitToKepalaKantor } from '@/lib/socket'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    let body: any = {}
    
    // Check Content-Type to decide how to parse
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      body = {
        taxpayerId: parseInt(formData.get('taxpayerId') as string),
        room: formData.get('room') as string,
        contactName: formData.get('contactName') as string,
        contactEmail: formData.get('contactEmail') as string,
        contactPhone: formData.get('contactPhone') as string,
        contactScan: formData.get('contactScan'),
        existingContactId: formData.get('existingContactId') ? parseInt(formData.get('existingContactId') as string) : undefined
      }
    } else {
      body = await request.json()
    }

    const { taxpayerId, room, contactName, contactEmail, contactPhone, contactScan, existingContactId } = body

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

    // Handle File Upload if exists
    let scanPath: string | null = null
    if (contactScan && (contactScan as File).size > 0) {
      // Basic validation for file type could be added here
      const file = contactScan as File
      const buffer = Buffer.from(await file.arrayBuffer())
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      const filename = `${uniqueSuffix}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      
      const uploadDir = join(process.cwd(), 'public', 'uploads')
      const filePath = join(uploadDir, filename)
      
      await mkdir(uploadDir, { recursive: true })
      await writeFile(filePath, buffer)
      scanPath = `/uploads/${filename}`
    }

    // Use transaction to create consultation and contact
    const consultation = await prisma.$transaction(async (tx) => {
      let contactId = existingContactId

      // Create Contact if info is provided and not using existing one
      if (!contactId && contactName) {
        const newContact = await tx.contact.create({
          data: {
            taxpayerId: taxpayerId,
            name: contactName,
            email: contactEmail || null,
            phoneNumber: contactPhone || null,
            scanKTP: scanPath || null
          }
        })
        contactId = newContact.id
      }
      
      // If using existing contact but new file is uploaded, update scan
      if (contactId && scanPath && existingContactId) {
          await tx.contact.update({
              where: { id: contactId },
              data: { scanKTP: scanPath }
          })
      }

      // Create new consultation
      return await tx.consultation.create({
        data: {
          taxpayerId: taxpayerId,
          arNip: taxpayer.assignedArNip,
          room: room.trim(),
          status: 'WAITING',
          contactId: contactId,
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