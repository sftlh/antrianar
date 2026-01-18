import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUser() {
  const user = await prisma.user.findUnique({ where: { id: 8 } })
  console.log('User ID 8:', user)
}

checkUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect())