
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Checking Contact data...')
  
  const totalContacts = await prisma.contact.count()
  console.log(`Total contacts in database: ${totalContacts}`)

  const contacts = await prisma.contact.findMany({
    take: 5,
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      taxpayer: true
    }
  })

  console.log('Recent 5 contacts:')
  contacts.forEach(c => {
    console.log(`- ID: ${c.id}, Name: ${c.name}, PID: ${c.taxpayerId} (Taxpayer: ${c.taxpayer.name}), Phone: ${c.phoneNumber || '-'}, Email: ${c.email || '-'}`)
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
