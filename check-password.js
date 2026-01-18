const bcrypt = require('bcryptjs');

const stored = '$2a$12$g26gEojJLSxB2CNFR7ZoLebfuabFnQqwj0d2MWAbiUe.t16HgECXu';
const input = '$2b$10$hashedpassword5';

console.log('Stored hash:', stored);
console.log('Input string:', input);
console.log('Are they equal?', stored === input);

// Try bcrypt compare
try {
  const isValid = bcrypt.compareSync(input, stored);
  console.log('bcrypt compare result:', isValid);
} catch (error) {
  console.error('bcrypt error:', error.message);
}

// Try with different input
const input2 = 'password';
try {
  const isValid2 = bcrypt.compareSync(input2, stored);
  console.log('password compare result:', isValid2);
} catch (error) {
  console.error('bcrypt error:', error.message);
}