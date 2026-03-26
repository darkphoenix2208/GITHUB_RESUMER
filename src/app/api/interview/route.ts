import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

export async function POST(req: NextRequest) {
  try {
    const { repo, powerSignals } = await req.json();

    if (!repo?.name) {
      return NextResponse.json({ error: "repo is required" }, { status: 400 });
    }

    const signalContext = powerSignals?.length
      ? `Detected Advanced Patterns:\n${powerSignals.map((s: string) => `  • ${s}`).join("\n")}`
      : "No specific advanced patterns detected — focus on architecture and design decisions.";

    const grillPrompt = `You are a tough but fair senior engineering interviewer at a top quant / tech firm.

You are interviewing a candidate about their project: "${repo.name}".

Project Context:
- Description: ${repo.description || "N/A"}
- Languages: ${Object.keys(repo.languages || {}).join(", ") || "N/A"}
- Architecture: ${(repo.architecture || []).slice(0, 15).join(", ")}
${signalContext}

Task: Generate exactly 5 "Grill Questions" that probe the candidate's deep technical understanding of decisions made in this codebase.
Good questions should reference SPECIFIC patterns, libraries, or design choices from the context above.
Make them hard — the kind a Staff Engineer at Google or Jane Street would ask.

Examples of GOOD questions (be this specific):
- "You used std::mutex with std::condition_variable — walk me through how you'd handle priority inversion under high contention."
- "Your async architecture uses Promise.all for parallelism — what's your strategy if one sub-request causes a thundering herd?"

Output ONLY a JSON array of 5 question strings, no other text:
["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: grillPrompt }],
      temperature: 0.7,
      max_tokens: 1024,
    });

    let raw = response.choices[0]?.message?.content || "[]";
    // Strip any markdown fences
    raw = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

    let questions: string[];
    try {
      questions = JSON.parse(raw);
    } catch {
      // Fallback: extract lines that look like questions
      questions = raw
        .split("\n")
        .filter((line: string) => line.trim().match(/^[\d•\-]|\?$/))
        .slice(0, 5);
    }

    return NextResponse.json({ questions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate questions" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { question, answer, repo } = await req.json();

    if (!question || !answer) {
      return NextResponse.json({ error: "question and answer are required" }, { status: 400 });
    }

    const feedbackPrompt = `You are a senior engineering interviewer. A candidate answered a technical interview question.

Question: ${question}

Candidate's Answer: ${answer}

Project Context: ${repo?.name} — ${repo?.description || ""}

Evaluate this answer using the STAR-K framework:
- Situation: Did they set the context clearly?
- Task: Did they explain their specific responsibility?
- Action: Did they describe concrete technical steps with specifics?
- Result: Did they quantify or prove the outcome?
- Keyword: Did they use strong technical vocabulary specific to the domain?

Output a JSON object:
{
  "overall": "Strong/Good/Needs Work/Weak",
  "score": <1-10>,
  "starK": {
    "situation": "feedback",
    "task": "feedback",
    "action": "feedback",
    "result": "feedback",
    "keyword": "feedback"
  },
  "betterAnswer": "One sentence showing what an ideal answer would sound like",
  "missingKeywords": ["keyword1", "keyword2"]
}`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: feedbackPrompt }],
      temperature: 0.4,
      max_tokens: 1024,
    });

    let raw = response.choices[0]?.message?.content || "{}";
    raw = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

    const feedback = JSON.parse(raw);
    return NextResponse.json({ feedback });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to evaluate answer" }, { status: 500 });
  }
}
