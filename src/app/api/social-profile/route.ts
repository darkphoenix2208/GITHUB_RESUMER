import { NextRequest, NextResponse } from "next/server";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWakaTime(apiKey: string) {
  try {
    const encoded = Buffer.from(apiKey).toString("base64");
    const res = await fetch("https://wakatime.com/api/v1/users/current/stats/last_year", {
      headers: { Authorization: `Basic ${encoded}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const stats = data.data;
    return {
      totalSeconds: stats.total_seconds || 0,
      totalHours: Math.round((stats.total_seconds || 0) / 3600),
      dailyAvgHours: Math.round(((stats.daily_average || 0) / 3600) * 10) / 10,
      topLanguages: (stats.languages || []).slice(0, 4).map((l: any) => l.name),
    };
  } catch {
    return null;
  }
}

async function fetchKaggle(username: string) {
  try {
    // Kaggle public profile page — extract tier from HTML
    const res = await fetch(`https://www.kaggle.com/${username}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract tier badge (Novice / Contributor / Expert / Master / Grandmaster)
    const tierMatch = html.match(/"performanceTier"\s*:\s*"([^"]+)"/i)
      || html.match(/class="[^"]*tier[^"]*"[^>]*>([A-Za-z]+)/);
    const tier = tierMatch?.[1] || "Contributor";

    // Gold/Silver/Bronze medal counts
    const goldMatch = html.match(/"goldMedals"\s*:\s*(\d+)/);
    const silverMatch = html.match(/"silverMedals"\s*:\s*(\d+)/);
    const bronzeMatch = html.match(/"bronzeMedals"\s*:\s*(\d+)/);

    return {
      tier,
      gold: parseInt(goldMatch?.[1] || "0"),
      silver: parseInt(silverMatch?.[1] || "0"),
      bronze: parseInt(bronzeMatch?.[1] || "0"),
      qualifies: ["Expert", "Master", "Grandmaster"].includes(tier),
    };
  } catch {
    return null;
  }
}

async function fetchStackOverflow(username: string) {
  try {
    const url = `https://api.stackexchange.com/2.3/users?inname=${encodeURIComponent(username)}&site=stackoverflow&order=desc&sort=reputation&pagesize=1&filter=default`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    const user = data.items?.[0];
    if (!user) return null;

    const rep = user.reputation || 0;
    // Top 10% ≈ reputation ≥ 10,000 (rough heuristic)
    const qualifies = rep >= 10000;
    return {
      displayName: user.display_name,
      reputation: rep,
      goldBadges: user.badge_counts?.gold || 0,
      silverBadges: user.badge_counts?.silver || 0,
      bronzeBadges: user.badge_counts?.bronze || 0,
      profileUrl: user.link,
      qualifies,
    };
  } catch {
    return null;
  }
}

// ── LaTeX Section Builder ─────────────────────────────────────────────────────

function buildSocialLatex(
  wakatime: Awaited<ReturnType<typeof fetchWakaTime>>,
  kaggle: Awaited<ReturnType<typeof fetchKaggle>>,
  so: Awaited<ReturnType<typeof fetchStackOverflow>>,
): string | null {
  const bullets: string[] = [];

  if (wakatime && wakatime.totalHours > 50) {
    bullets.push(`\\resumeItem{Logged \\textbf{${wakatime.totalHours}+ hours} of verified IDE coding time (WakaTime) across ${wakatime.topLanguages.join(", ")} projects, averaging ${wakatime.dailyAvgHours} hrs/day.}`);
  }

  if (kaggle?.qualifies) {
    const medals = [
      kaggle.gold > 0 ? `${kaggle.gold}\\textcolor{gold}{\\boldsymbol{\\star}}` : null,
      kaggle.silver > 0 ? `${kaggle.silver} silver` : null,
      kaggle.bronze > 0 ? `${kaggle.bronze} bronze` : null,
    ].filter(Boolean).join(", ");
    bullets.push(`\\resumeItem{Kaggle \\textbf{${kaggle.tier}} — earned ${medals || "competition"} medals in ML/data science competitions.}`);
  }

  if (so?.qualifies) {
    bullets.push(`\\resumeItem{Stack Overflow reputation \\textbf{${so.reputation.toLocaleString()}} (top 10\\% globally) with ${so.goldBadges} gold, ${so.silverBadges} silver, ${so.bronzeBadges} bronze badges — recognized expert in ${so.displayName ? "community Q\\&A" : "engineering topics"}.}`);
  }

  if (bullets.length === 0) return null;

  return [
    "\\resumeSection{Community \\& Open Source}",
    "\\resumeItemListStart",
    ...bullets,
    "\\resumeItemListEnd",
  ].join("\n");
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { wakatimeKey, kaggleUser, soUser } = await req.json();

    const [wakatime, kaggle, so] = await Promise.all([
      wakatimeKey ? fetchWakaTime(wakatimeKey) : Promise.resolve(null),
      kaggleUser   ? fetchKaggle(kaggleUser)    : Promise.resolve(null),
      soUser       ? fetchStackOverflow(soUser) : Promise.resolve(null),
    ]);

    const socialLatex = buildSocialLatex(wakatime, kaggle, so);

    return NextResponse.json({ wakatime, kaggle, so, socialLatex });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
