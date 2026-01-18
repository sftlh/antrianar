/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

// Valid roles array
const validRoles = ['AR', 'KEPALA_KANTOR', 'KEPALA_SEKSI', 'ADMIN', 'PELAKSANA', 'RECEPTIONIST']

// Helper function to check if user is admin
async function isAdmin(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('cookie')
  if (!authHeader || !authHeader.includes('token=')) {
    return false
  }

  try {
    // Use internal URL for API-to-API calls
    const internalUrl = process.env.NODE_ENV === 'production' 
      ? 'http://localhost:3000' 
      : (process.env.NEXTAUTH_URL || 'http://localhost:3000')
    
    const meResponse = await fetch(`${internalUrl}/api/auth/me`, {
      headers: { cookie: authHeader }
    })
    const meData = await meResponse.json()
    return meData.user?.role === 'ADMIN'
  } catch (error) {
    console.error('Auth check failed:', error)
    return false
  }
}

// PUT /api/users/[id] - Update user (admin only)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const userId = parseInt(id)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const { nip, password, name, role, seksiId } = await request.json()

    // Validate required fields (password is optional for updates)
    if (!nip || !name || !role) {
      return NextResponse.json({ error: 'NIP, name, and role are required' }, { status: 400 })
    }

    // Validate NIP format (9 digits)
    if (!/^\d{9}$/.test(nip)) {
      return NextResponse.json({ error: 'NIP must be exactly 9 digits' }, { status: 400 })
    }

    // Validate role
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if NIP is already taken by another user
    if (nip !== existingUser.nip) {
      const nipExists = await prisma.user.findUnique({
        where: { nip },
      })
      if (nipExists) {
        return NextResponse.json({ error: 'NIP already exists' }, { status: 400 })
      }
    }

    // Prepare update data
    const updateData: any = {
      nip,
      name,
      role,
      seksiId: seksiId || null,
    }

    // Only update password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 12)
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        nip: true,
        name: true,
        role: true,
        seksiId: true,
        lastCheckedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            consultations: true,
            assignedTaxpayers: true,
          },
        },
      },
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/users/[id] - Delete user (admin only)
// Note: This permanently deletes the user. In a production system,
// you might want to implement soft delete with an isActive field
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const userId = parseInt(id)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            consultations: true,
            assignedTaxpayers: true,
          },
        },
      },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has active consultations or assigned taxpayers
    if (existingUser._count.consultations > 0 || existingUser._count.assignedTaxpayers > 0) {
      return NextResponse.json({
        error: 'Cannot delete user with active consultations or assigned taxpayers'
      }, { status: 400 })
    }

    // Delete user
    await prisma.user.delete({
      where: { id: userId },
    })

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}