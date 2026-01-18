import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Helper function to get current user
async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get('cookie')
  if (!authHeader || !authHeader.includes('token=')) {
    return null
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
    return meData.user || null
  } catch (error) {
    console.error('Auth check failed:', error)
    return null
  }
}

// GET /api/chat/[id] - Get chat details and messages
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const chatId = parseInt(id)
    if (isNaN(chatId)) {
      return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 })
    }

    // Check if user is a participant in this chat
    const participant = await prisma.chatParticipant.findFirst({
      where: {
        chatId,
        userId: currentUser.id
      }
    })

    if (!participant) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get chat with messages
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
                nip: true
              }
            }
          }
        },
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          },
          orderBy: {
            sentAt: 'asc'
          }
        }
      }
    })

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    // Update last read timestamp for current user
    await prisma.chatParticipant.update({
      where: {
        id: participant.id
      },
      data: {
        lastReadAt: new Date()
      }
    })

    // Format the response
    const formattedChat = {
      id: chat.id,
      type: chat.type,
      name: chat.name || (chat.type === 'DIRECT' ?
        chat.participants.find(p => p.userId !== currentUser.id)?.user?.name :
        'Group Chat'),
      description: chat.description,
      participants: chat.participants.map(p => ({
        id: p.user.id,
        name: p.user.name,
        role: p.user.role,
        nip: p.user.nip
      })),
      messages: chat.messages.map(message => ({
        id: message.id,
        type: message.type,
        content: message.content,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileSize: message.fileSize,
        sentAt: message.sentAt,
        sender: {
          id: message.sender.id,
          name: message.sender.name,
          role: message.sender.role
        },
        isMine: message.senderId === currentUser.id
      })),
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    }

    return NextResponse.json({ chat: formattedChat })
  } catch (error) {
    console.error('Error fetching chat:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/chat/[id] - Delete a chat
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const chatId = parseInt(id)
    if (isNaN(chatId)) {
      return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 })
    }

    // Check if user is a participant in this chat
    const participant = await prisma.chatParticipant.findFirst({
      where: {
        chatId,
        userId: currentUser.id
      }
    })

    if (!participant) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete the chat (cascade will handle messages and participants)
    await prisma.chat.delete({
      where: { id: chatId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting chat:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}