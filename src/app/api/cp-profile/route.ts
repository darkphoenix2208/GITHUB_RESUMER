import { NextRequest, NextResponse } from "next/server";

// ── CODEFORCES ────────────────────────────────────────────────────────────────
async function fetchCodeforces(handle: string) {
  const res = await fetch(
    `https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) throw new Error(`Codeforces API error: ${res.status}`);
  const json = await res.json();
  if (json.status !== "OK") throw new Error(json.comment || "Codeforces error");
  const u = json.result[0];
  return {
    handle: u.handle,
    rating: u.rating || 0,
    maxRating: u.maxRating || 0,
    rank: u.rank || "unrated",
    maxRank: u.maxRank || "unrated",
    contribution: u.contribution || 0,
  };
}

// ── LEETCODE (public GraphQL) ─────────────────────────────────────────────────
async function fetchLeetCode(username: string) {
  const query = `
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile { ranking }
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
    }
  `;
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { username } }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`LeetCode API error: ${res.status}`);
  const json = await res.json();
  const user = json.data?.matchedUser;
  if (!user) throw new Error(`LeetCode user "${username}" not found`);

  const stats: Record<string, number> = {};
  for (const s of user.submitStats?.acSubmissionNum || []) {
    stats[s.difficulty] = s.count;
  }
  return {
    username: user.username,
    ranking: user.profile?.ranking || 0,
    easy: stats["Easy"] || 0,
    medium: stats["Medium"] || 0,
    hard: stats["Hard"] || 0,
    total: stats["All"] || 0,
  };
}

// ── LaTeX injection helper ────────────────────────────────────────────────────
export function buildCPLatex(cf: any, lc: any): string {
  const lines: string[] = [];
  lines.push(`\\resumeSubHeadingListStart`);

  if (cf) {
    const ratingLine = `${cf.maxRank} (Peak: ${cf.maxRating}, Current: ${cf.rating})`;
    lines.push(`  \\resumeSubheading{Codeforces}{}{${ratingLine}}{}`);
    lines.push(`  \\resumeItemListStart`);
    lines.push(`    \\resumeItem{Achieved \\textbf{${cf.maxRank}} rating of \\textbf{${cf.maxRating}} on Codeforces, demonstrating expertise in competitive algorithms and data structures.}`);
    lines.push(`  \\resumeItemListEnd`);
  }

  if (lc) {
    lines.push(`  \\resumeSubheading{LeetCode}{}{${lc.total} Problems Solved (${lc.hard} Hard)}{Rank: ${lc.ranking.toLocaleString()}}`);
    lines.push(`  \\resumeItemListStart`);
    lines.push(`    \\resumeItem{Solved \\textbf{${lc.hard}} Hard-difficulty problems on LeetCode (${lc.medium} Medium, ${lc.easy} Easy), demonstrating strong algorithmic problem-solving ability.}`);
    lines.push(`  \\resumeItemListEnd`);
  }

  lines.push(`\\resumeSubHeadingListEnd`);
  return lines.join("\n");
}

// ── Route handlers ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { cfHandle, lcHandle } = await req.json();
    const results: any = {};
    const errors: any = {};

    await Promise.allSettled([
      cfHandle
        ? fetchCodeforces(cfHandle).then((d) => (results.cf = d)).catch((e) => (errors.cf = e.message))
        : Promise.resolve(),
      lcHandle
        ? fetchLeetCode(lcHandle).then((d) => (results.lc = d)).catch((e) => (errors.lc = e.message))
        : Promise.resolve(),
    ]);

    // Generate LaTeX section only for qualifying profiles
    const cfQualifies = results.cf && results.cf.maxRating >= 1400;
    const lcQualifies = results.lc && results.lc.hard >= 30;

    const cpLatex =
      cfQualifies || lcQualifies
        ? `\\section{Competitive Programming \\& Algorithmic Proficiency}\n` +
          buildCPLatex(cfQualifies ? results.cf : null, lcQualifies ? results.lc : null)
        : null;

    return NextResponse.json({ cf: results.cf, lc: results.lc, cpLatex, errors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
