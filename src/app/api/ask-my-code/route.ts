import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

export async function POST(req: Request) {
  try {
    const { message, history = [], repos } = await req.json();

    if (!message || !repos || !repos.length) {
      return NextResponse.json({ error: "Missing message or repos context" }, { status: 400 });
    }

    // Build the "RAG" context from the enriched repos
    const context = repos.map((r: any) => `
### Repository: ${r.name}
Description: ${r.description || "N/A"}
Languages: ${Object.keys(r.languages || {}).join(", ")}
Metrics: MI=${r.metrics?.maintainabilityIndex}, CC=${r.metrics?.cyclomaticComplexity}
Architecture Detects: ${(r.metrics?.powerSignals || []).join(", ")}
Code Snippets:
${(r.codeSnippets || []).slice(0, 3).map((snippet: string) => `\`\`\`\n${snippet}\n\`\`\``).join("\n")}
    `).join("\n---\n");

    const systemPrompt = `You are the "Digital Avatar" of an elite Senior Software Engineer whose portfolio is being reviewed.
You have been asked a question by a technical recruiter or engineering manager.
Base your entire answer strictly on the technical capabilities, architecture patterns, and code snippets provided below.
If they ask something irrelevant or outside your code context, politely steer the conversation back to your projects.

### Your Projects Context:
${context}

Tone: Humble, technical, confident, concise.
Format: Explain clearly using bullet points for dense technical data. Keep answers under 3 paragraphs unless asked to elaborate on a specific architecture.`;

    // Construct message history
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...history.map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: message }
    ] as any;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: apiMessages,
      temperature: 0.3,
      max_tokens: 1024,
    });

    return NextResponse.json({
      answer: completion.choices[0]?.message?.content || "I couldn't process that query. Please try again."
    });
  } catch (error: any) {
    console.error("Ask My Code error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate answer" }, { status: 500 });
  }
}
