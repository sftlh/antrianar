import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addTestConsultations() {
  console.log('Adding test consultations...')

  // Get existing taxpayers and ARs
  const taxpayers = await prisma.taxpayer.findMany({ take: 2 })
  const ars = await prisma.user.findMany({ where: { role: 'AR' }, take: 2 })

  if (taxpayers.length === 0 || ars.length === 0) {
    console.log('No taxpayers or ARs found. Run seed first.')
    return
  }

  // Create consultations
  await prisma.consultation.createMany({
    data: [
      {
        taxpayerId: taxpayers[0].id,
        arNip: ars[0].nip,
        status: 'IN_CONSULTATION',
        room: 'Ruang 101',
        startTime: new Date(),
      },
      {
        taxpayerId: taxpayers[1].id,
        arNip: ars[1].nip,
        status: 'IN_CONSULTATION',
        room: 'Ruang 102',
        startTime: new Date(),
      },
      {
        taxpayerId: taxpayers[0].id,
        status: 'WAITING',
        startTime: new Date(),
      },
    ],
  })

  console.log('Test consultations added!')
}

addTestConsultations()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })