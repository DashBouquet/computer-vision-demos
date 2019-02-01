const endpoint = 'http://127.0.0.1:8085';
const settings = {
  method: 'POST',
  cache: 'no-cache',
  mode: 'cors',
  headers: {
    'Content-Type': 'application/json'
  }
};

export async function createTrainImage(imageData) {
  return fetch(`${endpoint}/trainImage`, {
    ...settings,
    body: JSON.stringify({ imageData })
  }).then((response) => {
    console.log(response.statusText);
    return response.json();
  });
}
