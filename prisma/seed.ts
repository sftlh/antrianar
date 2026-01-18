import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding data...')

  // Seed AR users
  const arUsers = [
    {
      nip: '12345678',
      password: '$2b$10$hashedpassword1', // In production, use proper hashing
      role: 'AR' as const,
      name: 'Ahmad Santoso',
    },
    {
      nip: '87654321',
      password: '$2b$10$hashedpassword2', // In production, use proper hashing
      role: 'AR' as const,
      name: 'Siti Nurhaliza',
    },
    {
      nip: '11223344',
      password: '$2b$10$hashedpassword3', // In production, use proper hashing
      role: 'AR' as const,
      name: 'Budi Setiawan',
    },
    {
      nip: '55667788',
      password: '$2b$10$hashedpassword4', // In production, use proper hashing
      role: 'AR' as const,
      name: 'Maya Sari',
    },
  ]

  for (const user of arUsers) {
    await prisma.user.upsert({
      where: { nip: user.nip },
      update: {},
      create: user,
    })
  }

  // Seed kepala kantor user
  await prisma.user.upsert({
    where: { nip: '99999999' },
    update: {},
    create: {
      nip: '99999999',
      password: '$2b$10$hashedpassword5',
      role: 'KEPALA_KANTOR' as const,
      name: 'Dr. Hendro Wicaksono',
    },
  })

  // Seed admin user
  await prisma.user.upsert({
    where: { nip: '11111111' },
    update: {},
    create: {
      nip: '11111111',
      password: '$2b$10$hashedpassword6',
      role: 'ADMIN' as const,
      name: 'Admin Sistem',
    },
  })

  // Seed rooms
  const rooms = [
    {
      name: 'Ruang 101',
      description: 'Ruangan konsultasi utama',
    },
    {
      name: 'Ruang 102',
      description: 'Ruangan konsultasi kedua',
    },
    {
      name: 'Ruang 103',
      description: 'Ruangan konsultasi ketiga',
    },
  ]

  for (const room of rooms) {
    await prisma.room.upsert({
      where: { name: room.name },
      update: {},
      create: room,
    })
  }

  // Seed taxpayer data with AR assignments
  const taxpayers = [
    {
      npwp: '1234567890123456',
      name: 'Ahmad Susanto',
      assignedArNip: '12345678', // Ahmad Santoso
    },
    {
      npwp: '2345678901234567',
      name: 'Siti Nurhaliza',
      assignedArNip: '87654321', // Siti Nurhaliza
    },
    {
      npwp: '3456789012345678',
      name: 'Budi Santoso',
      assignedArNip: '12345678', // Ahmad Santoso
    },
  ]

  for (const taxpayer of taxpayers) {
    await prisma.taxpayer.upsert({
      where: { npwp: taxpayer.npwp },
      update: {
        assignedArNip: taxpayer.assignedArNip, // Update existing records
      },
      create: {
        npwp: taxpayer.npwp,
        name: taxpayer.name,
        assignedArNip: taxpayer.assignedArNip,
      },
    })
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })