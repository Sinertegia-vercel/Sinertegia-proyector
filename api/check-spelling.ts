import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL requerida' })

  try {
    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SpellingBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })

    if (!pageRes.ok) return res.status(400).json({ error: `No se pudo acceder a la página (${pageRes.status})` })

    const html = await pageRes.text()

    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000)

    if (text.length < 50) return res.status(400).json({ error: 'No se pudo extraer texto suficiente de la página.' })

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Eres un experto revisor de ortografía y gramática en español. Analiza el siguiente texto extraído de una página web y lista ÚNICAMENTE los errores de ortografía y gramática que encuentres.

Para cada error usa este formato:
❌ "[palabra incorrecta]" → ✅ "[corrección]" — [breve explicación]

Si no hay errores escribe: "✅ Sin errores ortográficos detectados."
No hagas resumen, solo lista los errores directamente.

TEXTO A REVISAR:
${text}`
            }]
          }],
          generationConfig: { temperature: 0.1 }
        }),
      }
    )

    const geminiData = await geminiRes.json()
    const result = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!result) return res.status(500).json({ error: 'Gemini no devolvió respuesta.' })

    res.status(200).json({ result, chars: text.length })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error desconocido' })
  }
}
