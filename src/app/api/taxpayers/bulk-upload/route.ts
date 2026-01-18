import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import Papa from 'papaparse'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('cookie')
    if (!authHeader || !authHeader.includes('token=')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role (simplified, in production use proper session validation)
    // For now, assume if authenticated, check role
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

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be CSV' }, { status: 400 })
    }

    const csvText = await file.text()

    // Parse CSV
    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    })

    if (parseResult.errors.length > 0) {
      return NextResponse.json({ error: 'Invalid CSV format' }, { status: 400 })
    }

    const data = parseResult.data as { npwp: string; name: string; ar_name?: string; ar_nip?: string }[]

    // Validate data
    const validData: { npwp: string; name: string; assignedArNip: string | null }[] = []
    const errors: string[] = []
    const arCache = new Map() // Cache AR lookups

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      if (!row.npwp || !row.name) {
        errors.push(`Row ${i + 1}: Missing npwp or name`)
        continue
      }
      if (row.npwp.length !== 16 || !/^\d+$/.test(row.npwp)) {
        errors.push(`Row ${i + 1}: Invalid NPWP format (must be 16 digits)`)
        continue
      }

      let assignedArId: number | null = null
      let assignedArNip: string | null = null

      // Handle AR assignment
      if (row.ar_name || row.ar_nip) {
        const arKey = row.ar_name ? `name:${row.ar_name.trim()}` : `nip:${row.ar_nip!.trim()}`
        
        if (arCache.has(arKey)) {
          const cachedAr = arCache.get(arKey)
          assignedArId = cachedAr.id
          assignedArNip = cachedAr.nip
        } else {
          let ar: { id: number; nip: string } | null = null
          if (row.ar_name) {
            ar = await prisma.user.findFirst({
              where: { 
                name: row.ar_name.trim(),
                role: 'AR'
              },
              select: { id: true, nip: true }
            })
          } else if (row.ar_nip) {
            ar = await prisma.user.findUnique({
              where: { nip: row.ar_nip.trim() },
              select: { id: true, nip: true }
            })
          }

          if (ar) {
            assignedArId = ar.id
            assignedArNip = ar.nip
            arCache.set(arKey, { id: ar.id, nip: ar.nip })
          } else {
            const arIdentifier = row.ar_name || row.ar_nip
            errors.push(`Row ${i + 1}: AR not found (${arIdentifier})`)
            continue
          }
        }
      }

      validData.push({
        npwp: row.npwp,
        name: row.name.trim(),
        assignedArNip: assignedArNip,
      })
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: `Validation errors: ${errors.join(', ')}` }, { status: 400 })
    }

    if (validData.length === 0) {
      return NextResponse.json({ error: 'No valid data to upload' }, { status: 400 })
    }

    // Bulk insert
    const result = await prisma.taxpayer.createMany({
      data: validData,
      skipDuplicates: true, // Skip if NPWP already exists
    })

    return NextResponse.json({
      message: 'Bulk upload successful',
      insertedCount: result.count,
      totalProcessed: validData.length,
    })
  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}