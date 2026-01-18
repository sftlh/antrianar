import { NextResponse } from 'next/server'
import { emitToKepalaKantor } from '@/lib/socket'

export async function POST() {
  try {
    // Emit test event to Kepala Kantor
    emitToKepalaKantor('consultation-updated', {
      type: 'test_event',
      message: 'This is a test event',
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Test event emitted to Kepala Kantor'
    })
  } catch (error) {
    console.error('Error emitting test event:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to emit test event'
    }, { status: 500 })
  }
}