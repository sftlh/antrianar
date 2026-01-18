import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create sample users
  const users = [
    { nip: '12345678', name: 'John AR', role: 'AR', password: 'password' },
    { nip: '87654321', name: 'Jane Kepala Kantor', role: 'KEPALA_KANTOR', password: 'password' },
    { nip: '11223344', name: 'Bob Kepala Seksi', role: 'KEPALA_SEKSI', password: 'password' },
    { nip: '44332211', name: 'Alice Admin', role: 'ADMIN', password: 'password' },
    { nip: '55667788', name: 'Charlie Pelaksana', role: 'PELAKSANA', password: 'password' },
  ]

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10)
    await prisma.user.upsert({
      where: { nip: user.nip },
      update: {},
      create: {
        nip: user.nip,
        name: user.name,
        role: user.role as any,
        password: hashedPassword,
      },
    })
  }

  console.log('Sample users created')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })