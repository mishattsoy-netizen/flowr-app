async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/admin/revalidate', {
      method: 'POST'
    });
    console.log(res.status, await res.text());
  } catch (e) {
    console.error(e);
  }
}
test();
