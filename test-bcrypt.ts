import bcrypt from 'bcryptjs'

const hash = '$2b$10$gYo9AGeTFnUMiAlyEr009.wcB1lbHHfkve1dgpXJ.MUEdk0UErTOO'

async function test() {
  const isValid = await bcrypt.compare('password', hash)
  console.log('Password valid:', isValid)
}

test()