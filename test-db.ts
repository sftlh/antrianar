import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const users = await prisma.user.findMany()
    console.log('Users:', users)

    const taxpayers = await prisma.taxpayer.findMany()
    console.log('Taxpayers:', taxpayers)
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()