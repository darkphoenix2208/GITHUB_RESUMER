import { auth } from "@/auth";
import { fetchUserReposBasic } from "@/lib/github";
import { redirect } from "next/navigation";
import DashboardWorkspace from "@/components/DashboardWorkspace";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  // @ts-ignore
  const accessToken = session.accessToken;

  let githubData = null;
  let error = null;

  try {
    if (accessToken) {
      const data = await fetchUserReposBasic(accessToken);
      // Tag each repo with the accessToken for on-demand deep fetching in actions.ts
      githubData = {
        ...data,
        repos: data.repos.map((r) => ({ ...r, _accessToken: accessToken })),
      };
    } else {
      error = "No GitHub access token found. Please sign in again.";
    }
  } catch (err: any) {
    error = err.message || "Failed to fetch GitHub data";
  }

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-50 font-sans selection:bg-emerald-500/30">
      
      {/* Fixed Background Glow */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/8 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        
        {/* Premium Header */}
        <header className="flex justify-between items-center pb-4 border-b border-white/5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 p-[1.5px] shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-[#030303] rounded-[10px] flex items-center justify-center font-black text-base text-emerald-400">
                {session.user?.name?.charAt(0).toUpperCase() || "R"}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white">RepoResumer</h1>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold tracking-widest uppercase">
                  Live
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-medium">Welcome, {session.user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {githubData && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900 px-3 py-2 rounded-full border border-white/5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"></path></svg>
                <span>{githubData.repos.length} repos ingested</span>
              </div>
            )}
            <form
              action={async () => {
                "use server"
                const { signOut } = await import("@/auth");
                await signOut();
              }}
            >
              <button type="submit" className="px-4 py-2 bg-zinc-900 border border-white/5 hover:bg-zinc-800 rounded-full text-xs font-semibold transition-all text-zinc-300 hover:text-white">
                Sign Out
              </button>
            </form>
          </div>
        </header>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 flex items-center gap-3 text-sm font-medium">
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        {githubData ? (
          <DashboardWorkspace repos={githubData.repos} />
        ) : !error ? (
          <div className="flex items-center justify-center h-64 text-zinc-600">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Loading your repository context...
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
