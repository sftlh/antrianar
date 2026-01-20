import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/rooms - Get all rooms (admin gets all, others get active only)
export async function GET(request: NextRequest) {
  try {
    // Check if this is an admin request
    const authHeader = request.headers.get('cookie')
    let isAdmin = false

    if (authHeader && authHeader.includes('token=')) {
      try {
        // Use internal URL for API-to-API calls
        const internalUrl = process.env.NODE_ENV === 'production' 
          ? 'http://localhost:3001' 
          : (process.env.NEXTAUTH_URL || 'http://localhost:3001')
        
        const meResponse = await fetch(`${internalUrl}/api/auth/me`, {
          headers: { cookie: authHeader }
        })
        const meData = await meResponse.json()
        isAdmin = meData.user?.role === 'ADMIN'
      } catch (error) {
        // If auth check fails, treat as non-admin
        console.error('Auth check failed:', error)
      }
    }

    const rooms = await prisma.room.findMany({
      where: isAdmin ? {} : { isActive: true }, // Admin gets all rooms, others get active only
      orderBy: { name: 'asc' },
    })

    const activeConsultations = await prisma.consultation.findMany({
      where: {
        status: {
          in: ['WAITING', 'IN_CONSULTATION']
        },
        room: { not: null }
      },
      select: { room: true }
    })

    const allConsultations = await prisma.consultation.findMany({
      where: { room: { not: null } },
      select: { room: true }
    })

    const occupiedRooms = new Set(activeConsultations.map(c => c.room))
    const usedRooms = new Set(allConsultations.map(c => c.room))

    const roomsWithStatus = rooms.map(room => ({
      ...room,
      isOccupied: occupiedRooms.has(room.name),
      hasBeenUsed: usedRooms.has(room.name)
    }))

    return NextResponse.json({ rooms: roomsWithStatus })
  } catch (error) {
    console.error('Error fetching rooms:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/rooms - Create a new room (admin only)
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const authHeader = request.headers.get('cookie')
    if (!authHeader || !authHeader.includes('token=')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use internal URL for API-to-API calls
    const internalUrl = process.env.NODE_ENV === 'production' 
      ? 'http://localhost:3001' 
      : (process.env.NEXTAUTH_URL || 'http://localhost:3001')
    
    const meResponse = await fetch(`${internalUrl}/api/auth/me`, {
      headers: { cookie: authHeader }
    })
    const meData = await meResponse.json()
    if (!meData.user || meData.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { name, description } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 })
    }

    const room = await prisma.room.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    })

    return NextResponse.json({ room })
  } catch (error) {
    console.error('Error creating room:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}