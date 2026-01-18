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

// GET /api/users - Get all users (admin only)
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        nip: true,
        name: true,
        role: true,
        seksiId: true,
        seksi: {
          select: {
            id: true,
            name: true,
          },
        },
        lastCheckedAt: true,
        createdAt: true,
        updatedAt: true,
        // Don't include password in response
        _count: {
          select: {
            consultations: true,
            assignedTaxpayers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/users - Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { nip, password, name, role, seksiId } = await request.json()

    if (!nip || !password || !name || !role) {
      return NextResponse.json({ error: 'NIP, password, name, and role are required' }, { status: 400 })
    }

    // Validate NIP format (9 digits)
    if (!/^\d{9}$/.test(nip)) {
      return NextResponse.json({ error: 'NIP must be exactly 9 digits' }, { status: 400 })
    }

    // Validate role
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Check if NIP already exists
    const existingUser = await prisma.user.findUnique({
      where: { nip },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'NIP already exists' }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const newUser = await prisma.user.create({
      data: {
        nip,
        password: hashedPassword,
        name,
        role,
        seksiId: seksiId || null,
      },
      select: {
        id: true,
        nip: true,
        name: true,
        role: true,
        seksiId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ user: newUser }, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}