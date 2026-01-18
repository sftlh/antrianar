import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

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

// POST /api/users/[id]/reset-password - Reset user password (admin only)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const userId = parseInt(id)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const { newPassword } = await request.json()

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters long' }, { status: 400 })
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    return NextResponse.json({ message: 'Password reset successfully' })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}