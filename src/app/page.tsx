import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="relative min-h-screen bg-[#030303] flex flex-col items-center justify-center p-6 sm:p-24 overflow-hidden font-sans text-neutral-50 selection:bg-emerald-500/30">
      
      {/* Dynamic Background Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/15 blur-[120px] rounded-full pointer-events-none mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/15 blur-[120px] rounded-full pointer-events-none mix-blend-screen animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] pointer-events-none mix-blend-overlay"></div>
      
      <div className="relative z-10 max-w-5xl w-full flex flex-col items-center text-center space-y-12">
        {/* Status Badge */}
        <div className="inline-flex items-center justify-center space-x-2 px-4 py-1.5 rounded-full border border-white/5 bg-white/5 backdrop-blur-xl shadow-2xl transition-all hover:bg-white/10 cursor-default">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span className="text-sm font-medium tracking-wide text-neutral-300">Phase 1: Architecture Parsing Active</span>
        </div>
        
        {/* Main Title Area */}
        <div className="space-y-6">
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tighter text-white drop-shadow-sm">
            Transform <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 drop-shadow-lg">Repositories</span><br/>
            Into Resumes
          </h1>
          
          <p className="text-xl sm:text-2xl text-neutral-400 max-w-3xl mx-auto leading-relaxed font-light">
            Our AI-driven pipeline mathematically aligns your GitHub architecture with Job Descriptions, instantly generating precision ATS-friendly LaTeX bullet points.
          </p>
        </div>

        {/* Feature Grid / Social Proof */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl py-8">
          
          <div className="flex flex-col items-center p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm transition-all hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-1 shadow-xl">
            <div className="p-3 bg-neutral-900 rounded-lg mb-4 border border-white/5 shadow-inner">
              <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
            </div>
            <h3 className="text-lg font-semibold text-neutral-200 mb-2">Deep Parsing</h3>
            <p className="text-sm text-neutral-500 leading-relaxed max-w-[200px]">Analyzes READMEs, codebase languages, & repo structures.</p>
          </div>

          <div className="flex flex-col items-center p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm transition-all hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-1 shadow-xl">
            <div className="p-3 bg-neutral-900 rounded-lg mb-4 border border-white/5 shadow-inner">
              <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <h3 className="text-lg font-semibold text-neutral-200 mb-2">LaTeX Output</h3>
            <p className="text-sm text-neutral-500 leading-relaxed max-w-[200px]">Generates strict, compile-ready LaTeX for Overleaf.</p>
          </div>

          <div className="flex flex-col items-center p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm transition-all hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-1 shadow-xl">
            <div className="p-3 bg-neutral-900 rounded-lg mb-4 border border-white/5 shadow-inner">
              <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <h3 className="text-lg font-semibold text-neutral-200 mb-2">ATS Optimized</h3>
            <p className="text-sm text-neutral-500 leading-relaxed max-w-[200px]">Matches technical keywords to bypass automated HR filters.</p>
          </div>

        </div>

        {/* Call to Action Module */}
        <div className="pt-4 flex flex-col items-center space-y-5">
          <form
            action={async () => {
              "use server"
              await signIn("github", { redirectTo: "/dashboard" })
            }}
          >
            <button className="group relative inline-flex items-center justify-center px-10 py-5 font-bold text-black transition-all duration-300 bg-white rounded-full hover:scale-105 hover:bg-neutral-200 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 focus:ring-offset-black">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
              <span className="text-lg tracking-tight">Connect GitHub HQ</span>
              <svg className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </form>
          
          <div className="flex items-center space-x-2 text-xs text-neutral-600 font-medium">
            <svg className="w-4 h-4 text-emerald-500/70" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
            <span>Read-only access to public repositories.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
