import { Server as Server } from 'socket.io'
import { Server as NetServer } from 'http'

// Global io instance (set by server.js)
declare global {
  var io: Server | undefined
}

export function getSocketIO() {
  return global.io
}

// Helper function to emit events to AR rooms
export function emitToAR(arNip: string, event: string, data: any) {
  if (global.io) {
    global.io.to(`ar-${arNip}`).emit(event, data)
    console.log(`Emitted ${event} to AR ${arNip}:`, data)
  } else {
    console.warn('Socket.IO not initialized, cannot emit event:', event)
  }
}

// Helper function to emit events to all Kepala Kantor and Admin
export function emitToKepalaKantor(event: string, data: any) {
  if (global.io) {
    try {
      // Emit to Kepala Kantor room
      global.io.to('kepala-kantor').emit(event, data)
      console.log(`✅ Emitted ${event} to Kepala Kantor room:`, data)
      
      // Also emit to Admin room
      global.io.to('admin').emit(event, data)
      console.log(`✅ Emitted ${event} to Admin room:`, data)
    } catch (error) {
      console.error('❌ Error emitting to Kepala Kantor/Admin:', error)
    }
  } else {
    console.warn('⚠️ Socket.IO not initialized, cannot emit event:', event)
  }
}

// Helper function to emit events to all Admin users
export function emitToAdmin(event: string, data: any) {
  if (global.io) {
    try {
      global.io.to('admin').emit(event, data)
      console.log(`✅ Emitted ${event} to Admin room:`, data)
    } catch (error) {
      console.error('❌ Error emitting to Admin:', error)
    }
  } else {
    console.warn('⚠️ Socket.IO not initialized, cannot emit event:', event)
  }
}