import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:8787/api/users/test', {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer fake-token' // Auth will fail, but if we bypass it? Wait, we can't bypass it.
      }
    });
    console.log(res.status, await res.text());
  } catch (e) {
    console.error(e);
  }
}

test();
