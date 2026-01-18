import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT /api/rooms/[id] - Update a room (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and admin role
    const authHeader = request.headers.get('cookie')
    if (!authHeader || !authHeader.includes('token=')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use internal URL for API-to-API calls
    const internalUrl = process.env.NODE_ENV === 'production' 
      ? 'http://localhost:3000' 
      : (process.env.NEXTAUTH_URL || 'http://localhost:3000')
    
    const meResponse = await fetch(`${internalUrl}/api/auth/me`, {
      headers: { cookie: authHeader }
    })
    const meData = await meResponse.json()
    if (!meData.user || meData.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const roomId = parseInt(id)

    const { name, description, isActive } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 })
    }

    const room = await prisma.room.update({
      where: { id: roomId },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    return NextResponse.json({ room })
  } catch (error) {
    console.error('Error updating room:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/rooms/[id] - Deactivate a room (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and admin role
    const authHeader = request.headers.get('cookie')
    if (!authHeader || !authHeader.includes('token=')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use internal URL for API-to-API calls
    const internalUrl = process.env.NODE_ENV === 'production' 
      ? 'http://localhost:3000' 
      : (process.env.NEXTAUTH_URL || 'http://localhost:3000')
    
    const meResponse = await fetch(`${internalUrl}/api/auth/me`, {
      headers: { cookie: authHeader }
    })
    const meData = await meResponse.json()
    if (!meData.user || meData.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const roomId = parseInt(id)

    // Soft delete by deactivating
    const room = await prisma.room.update({
      where: { id: roomId },
      data: { isActive: false },
    })

    return NextResponse.json({ message: 'Room deactivated successfully' })
  } catch (error) {
    console.error('Error deactivating room:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}