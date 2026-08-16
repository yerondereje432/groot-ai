const apiKey = process.env.GEMINI_API_KEY || "";
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

fetch(url)
  .then(r => r.json())
  .then(data => {
    console.log(data.models.map((m: any) => m.name + ' - ' + m.supportedGenerationMethods.join(',')));
  })
  .catch(console.error);
