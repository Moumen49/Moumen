export default async function handler(req, res) {
    // Vercel handles CORS and headers a bit differently, but we can set them manually
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        const { columns } = req.body;
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) return res.status(500).json({ error: "Missing GROQ_API_KEY" });

        const smartColumns = columns.filter(c => !c.system);
        const promptContent = `You are a Javascript expert. Return ONLY a valid JSON object.
        
        DATABASE ROLES (MUST USE THESE):
        - "husband", "wife", "son", "daughter", "widow", "divorced", "abandoned".
        
        RULES:
        1. If user asks for NAME (اسم) -> return .name
        2. If user asks for DATE (تاريخ) -> return .dob
        3. If user asks "Does exist?" (هل يوجد) -> return members.some(...) ? "نعم" : "لا"
        4. Match Arabic to English roles: أرملة=widow, زوجة=wife, زوج=husband, مطلق=divorced.
        5. Use .toLowerCase() for role checks.
        
        COLUMNS:
        ${smartColumns.map(c => `- ID: ${c.id}, Description: ${c.description}`).join('\n')}
        
        JSON Format: {"logic": {"ID": "expression"}}`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "You are a JSON logic generator." },
                    { role: "user", content: promptContent }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1
            })
        });

        const data = await response.json();

        if (response.ok && data.choices?.[0]?.message?.content) {
            // Vercel's .json() automatically stringifies and sets content-type
            return res.status(200).json(JSON.parse(data.choices[0].message.content));
        }

        return res.status(500).json({ error: data.error?.message || "Groq API Error" });

    } catch (error) {
        return res.status(500).json({ error: "Server Internal Error: " + error.message });
    }
}
