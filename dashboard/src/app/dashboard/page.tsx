'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { 
  GitPullRequest, ShieldAlert, Activity, 
  Plus, CheckCircle2, Settings, LayoutDashboard, Loader2,
  Github, Building2, User
} from 'lucide-react';

export default function Dashboard() {
  const { data: session, status } = useSession();
  
  const [installations, setInstallations] = useState<any[]>([]);
  const [selectedInstall, setSelectedInstall] = useState<string | null>(null);
  const [repos, setRepos] = useState<any[]>([]);
  
  const [loadingInstalls, setLoadingInstalls] = useState(true);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [connectingIds, setConnectingIds] = useState<Set<number>>(new Set());

  // 1. Fetch Installations
  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/github/installations')
        .then(res => res.json())
        .then(data => {
          const installs = data.installations || [];
          setInstallations(installs);
          // Auto-select first one if exists and nothing selected
          if (installs.length > 0 && !selectedInstall) {
             loadRepos(installs[0].id);
          }
        })
        .finally(() => setLoadingInstalls(false));
    } else if (status === 'unauthenticated') {
      setLoadingInstalls(false);
    }
  }, [status]);

  // 2. Load Repos
  const loadRepos = async (installId: number) => {
    setLoadingRepos(true);
    setSelectedInstall(String(installId));

    try {
      const res = await fetch(`/api/github/repos?installationId=${installId}`);
      const data = await res.json();
      setRepos(Array.isArray(data.repositories) ? data.repositories : []);
    } catch (e) {
      console.error(e);
      setRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  };

  // 3. Connect Logic
  const connectRepo = async (repo: any) => {
    setConnectingIds(prev => new Set(prev).add(repo.id));

    try {
      const res = await fetch('/api/repos/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoId: repo.id,
          repoUrl: repo.html_url,
          installationId: selectedInstall,
          owner: repo.owner.login,
          name: repo.name
        })
      });

      const result = await res.json();
      if (res.ok) {
        setRepos(prev => prev.map(r => 
          r.id === repo.id ? { ...r, isConnected: true } : r
        ));
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      alert("Failed to connect");
    } finally {
      setConnectingIds(prev => {
        const next = new Set(prev);
        next.delete(repo.id);
        return next;
      });
    }
  };

  if (status === 'loading') return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      
      {/* SIDEBAR */}
      <aside className="w-72 bg-slate-900 text-white p-6 flex flex-col gap-8 sticky top-0 h-screen overflow-y-auto">
        <div>
           <div className="text-2xl font-bold italic text-indigo-400 mb-1">Codrel.</div>
           <div className="text-xs text-slate-500 font-mono">SENTINEL DASHBOARD</div>
        </div>
        
        {/* User Info */}
        {session?.user && (
          <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
            <img src={session.user.image!} className="w-8 h-8 rounded-full" />
            <div className="overflow-hidden">
              <div className="text-sm font-bold truncate">{session.user.name}</div>
              <div className="text-[10px] text-slate-400 truncate">{session.user.email}</div>
            </div>
          </div>
        )}

        {/* Installations List */}
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Select Scope</div>
          
          <div className="space-y-2">
            {installations.map(inst => (
              <div 
                key={inst.id}
                onClick={() => loadRepos(inst.id)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                  selectedInstall === String(inst.id) 
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/50' 
                    : 'text-slate-400 hover:bg-slate-800 border-transparent hover:text-white'
                }`}
              >
                <img src={inst.account.avatar_url} className="w-8 h-8 rounded-md bg-slate-800" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{inst.account.login}</div>
                  <div className="text-[10px] opacity-70 flex items-center gap-1">
                    {inst.account.type === 'User' ? <User size={10} /> : <Building2 size={10} />}
                    {inst.account.type}
                  </div>
                </div>
              </div>
            ))}

            {/* Add New Button */}
            <a 
              href={`https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_NAME}/installations/new`}
              target="_blank"
              className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-slate-700 text-slate-500 hover:text-indigo-400 hover:border-indigo-400/50 hover:bg-slate-800/50 transition-all text-sm group"
            >
              <div className="w-8 h-8 rounded-md bg-slate-800 flex items-center justify-center group-hover:bg-indigo-400/10">
                <Plus size={16} />
              </div>
              <span>Add Organization...</span>
            </a>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-10 overflow-y-auto h-screen">
        {!session ? (
           <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
             <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
               <ShieldAlert size={48} className="text-indigo-600 mx-auto mb-6" />
               <h1 className="text-2xl font-bold text-slate-900 mb-2">Authentication Required</h1>
               <p className="text-slate-500 mb-8">Please sign in to access your organization's security dashboard.</p>
               <button onClick={() => signIn('github')} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2">
                 <Github size={20} /> Sign In with GitHub
               </button>
             </div>
           </div>
        ) : (
          <>
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-slate-800">Repositories</h1>
              <p className="text-slate-500 mt-1">
                Viewing <span className="font-bold text-slate-900">{installations.find(i => String(i.id) === selectedInstall)?.account.login}</span>
              </p>
            </header>

            {loadingRepos ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-40 bg-white rounded-xl border border-slate-200 animate-pulse"></div>
                ))}
              </div>
            ) : repos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {repos.map(repo => (
                  <div key={repo.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-slate-800 truncate pr-2" title={repo.name}>{repo.name}</h3>
                        {repo.private && <ShieldAlert size={16} className="text-amber-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 h-8 mb-4">
                        {repo.description || "No description provided."}
                      </p>
                    </div>

                    {repo.isConnected ? (
                       <button disabled className="w-full py-2 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center gap-2">
                         <CheckCircle2 size={14} /> Active Monitor
                       </button>
                    ) : (
                      <button 
                        onClick={() => connectRepo(repo)}
                        disabled={connectingIds.has(repo.id)}
                        className="w-full py-2 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                      >
                        {connectingIds.has(repo.id) ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                        {connectingIds.has(repo.id) ? 'Connecting...' : 'Connect Sentinel'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
               <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                 <GitPullRequest size={48} className="mx-auto text-slate-300 mb-4" />
                 <h3 className="font-bold text-slate-700">No Repositories Found</h3>
                 <p className="text-xs text-slate-500 mt-1 mb-4">We couldn't find any repos for this account.</p>
                 <a href={`https://github.com/settings/installations/${selectedInstall}`} target="_blank" className="text-indigo-600 text-xs font-bold hover:underline">
                   Check GitHub Permissions &rarr;
                 </a>
               </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}