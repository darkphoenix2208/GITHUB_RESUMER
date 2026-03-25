import { auth } from "@/auth";
import { fetchUserGitHubData } from "@/lib/github";
import { redirect } from "next/navigation";
import JDForm from "@/components/JDForm";

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
      githubData = await fetchUserGitHubData(accessToken);
    } else {
      error = "No GitHub access token found. Please sign in again.";
    }
  } catch (err: any) {
    error = err.message || "Failed to fetch GitHub data";
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-center pb-6 border-b border-neutral-800">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-neutral-400 mt-1">Welcome, {session.user?.name}</p>
          </div>
          <form
            action={async () => {
              "use server"
              const { signOut } = await import("@/auth");
              await signOut();
            }}
          >
            <button type="submit" className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-md text-sm font-medium transition-colors">
              Sign Out
            </button>
          </form>
        </header>

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-500 rounded-md text-red-200">
            {error}
          </div>
        )}

        {githubData && (
          <div className="space-y-12">
            
            <JDForm repos={githubData.repos} />
            
            <div className="space-y-6">
              <h2 className="text-xl font-semibold border-b border-neutral-800 pb-2">Your Full Repository Context (Ingested Data)</h2>
              <div className="grid gap-6">
              {githubData.repos.map((repo) => (
                <div key={repo.name} className="p-6 bg-neutral-900 border border-neutral-800 rounded-lg shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-emerald-400">
                        <a href={repo.url} target="_blank" rel="noreferrer" className="hover:underline">{repo.name}</a>
                      </h3>
                      <p className="text-sm text-neutral-400 mt-1">{repo.description || "No description provided."}</p>
                    </div>
                    <div className="text-right text-xs text-neutral-500">
                      <div>⭐ {repo.stars}</div>
                      <div>{new Date(repo.updatedAt || "").toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold uppercase text-neutral-500 mb-2">Architecture</h4>
                      <ul className="text-sm space-y-1 text-neutral-300">
                        {repo.architecture.slice(0, 5).map(item => (
                          <li key={item}>{item}</li>
                        ))}
                        {repo.architecture.length > 5 && <li className="text-neutral-500">...and more</li>}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase text-neutral-500 mb-2">Languages</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(repo.languages || {}).map(([lang, bytes]) => (
                          <span key={lang} className="text-xs px-2 py-1 bg-neutral-800 rounded-md text-neutral-300 border border-neutral-700">
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-neutral-800">
                     <h4 className="text-xs font-semibold uppercase text-neutral-500 mb-2">README Preview</h4>
                     <p className="text-sm text-neutral-400 whitespace-pre-wrap font-mono bg-neutral-950 p-3 rounded overflow-x-auto">
                        {repo.readme || "No README content."}
                     </p>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
