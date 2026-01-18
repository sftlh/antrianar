async function createAdminUser() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nip: '12345678',
        password: 'admin123',
        name: 'Administrator',
        role: 'ADMIN'
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Admin user created successfully:', data);
    } else {
      console.error('Error creating admin user:', data);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

createAdminUser();