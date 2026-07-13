const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'anintajahsmine@gmail.com',
      password: 'wrongpassword'
    });
    console.log('SUCCESS', res.data);
  } catch (err) {
    if (err.response) {
      console.log('API RESPONSE ERROR:', err.response.status, err.response.data);
    } else {
      console.log('SYSTEM ERROR:', err.message);
    }
  }
}

test();
