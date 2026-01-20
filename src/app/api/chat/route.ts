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
      ? 'http://localhost:3001' 
      : (process.env.NEXTAUTH_URL || 'http://localhost:3001')
    
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

// GET /api/chat - Get user's chats
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all chats where the user is a participant
    const chats = await prisma.chat.findMany({
      where: {
        participants: {
          some: {
            userId: currentUser.id
          }
        }
      },
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
          orderBy: {
            sentAt: 'desc'
          },
          take: 1, // Get latest message
          include: {
            sender: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    // Format the response
    const formattedChats = chats.map(chat => {
      const otherParticipants = chat.participants.filter(p => p.userId !== currentUser.id)
      const latestMessage = chat.messages[0]

      return {
        id: chat.id,
        type: chat.type,
        name: chat.name || (chat.type === 'DIRECT' ? otherParticipants[0]?.user?.name : 'Group Chat'),
        description: chat.description,
        participants: chat.participants.map(p => ({
          id: p.user.id,
          name: p.user.name,
          role: p.user.role,
          nip: p.user.nip
        })),
        latestMessage: latestMessage ? {
          content: latestMessage.content,
          sender: latestMessage.sender.name,
          sentAt: latestMessage.sentAt
        } : null,
        messageCount: chat._count.messages,
        updatedAt: chat.updatedAt
      }
    })

    return NextResponse.json({ chats: formattedChats })
  } catch (error) {
    console.error('Error fetching chats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/chat - Create a new chat
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, participantIds, name, description } = await request.json()

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return NextResponse.json({ error: 'At least one participant is required' }, { status: 400 })
    }

    // Add current user to participants if not already included
    const allParticipantIds = [...new Set([...participantIds, currentUser.id])]

    // For direct chats, ensure only 2 participants
    if (type === 'DIRECT' && allParticipantIds.length !== 2) {
      return NextResponse.json({ error: 'Direct chats must have exactly 2 participants' }, { status: 400 })
    }

    // Check if direct chat already exists between these users
    if (type === 'DIRECT') {
      const existingChat = await prisma.chat.findFirst({
        where: {
          type: 'DIRECT',
          participants: {
            every: {
              userId: {
                in: allParticipantIds
              }
            }
          },
          AND: {
            participants: {
              none: {
                userId: {
                  notIn: allParticipantIds
                }
              }
            }
          }
        }
      })

      if (existingChat) {
        return NextResponse.json({ error: 'Direct chat already exists between these users' }, { status: 400 })
      }
    }

    // Create the chat
    const chat = await prisma.chat.create({
      data: {
        type,
        name: type === 'GROUP' ? name : null,
        description: type === 'GROUP' ? description : null,
        createdById: currentUser.id,
        participants: {
          create: allParticipantIds.map(userId => ({
            userId
          }))
        }
      },
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
        }
      }
    })

    return NextResponse.json({ chat }, { status: 201 })
  } catch (error) {
    console.error('Error creating chat:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}