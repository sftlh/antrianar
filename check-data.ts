import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkData() {
  const activeARs = await prisma.user.count({
    where: {
      role: 'AR',
      consultations: {
        some: {
          status: 'IN_CONSULTATION'
        }
      }
    }
  })
  console.log('Active ARs:', activeARs)

  const totalARs = await prisma.user.count({ where: { role: 'AR' } })
  console.log('Total ARs:', totalARs)

  const consultations = await prisma.consultation.findMany({
    include: { ar: true, taxpayer: true }
  })
  console.log('Consultations:')
  consultations.forEach((c: any) => {
    console.log(`- Status: ${c.status}, AR: ${c.ar?.name || 'None'}, Taxpayer: ${c.taxpayer.name}`)
  })
}

checkData()
  .catch(console.error)
  .finally(() => prisma.$disconnect())