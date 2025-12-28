'use client';

import React, { useState, useEffect } from 'react';
import { 
  GitPullRequest, ShieldAlert, Activity, 
  Plus, RefreshCw, CheckCircle2, ExternalLink, Settings, LayoutDashboard, Loader2,
  AlertTriangle
} from 'lucide-react';

export default function Dashboard() {
  const [installations, setInstallations] = useState<any[]>([]);
  const [selectedInstall, setSelectedInstall] = useState<string | null>(null);
  const [repos, setRepos] = useState<any[]>([]);
  
  // UI States
  const [loadingInstalls, setLoadingInstalls] = useState(true);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [connectingIds, setConnectingIds] = useState<Set<number>>(new Set());

  // 1. Load All Installations (Accounts where App is installed)
  useEffect(() => {
    async function fetchInstallations() {
      try {
        console.log("🔄 Fetching Installations...");
        const res = await fetch('/api/github/installations');
        const data = await res.json();
        
        console.log("✅ Installations:", data);
        setInstallations(data.installations || []);
        
        // Auto-select the first installation if available
        if (data.installations && data.installations.length > 0) {
           loadRepos(data.installations[0].id);
        }
      } catch (err) {
        console.error("❌ Failed to load installations:", err);
      } finally {
        setLoadingInstalls(false);
      }
    }
    fetchInstallations();
  }, []);

  // 2. Load Repos for a specific User/Org
  const loadRepos = async (installId: number) => {
    setLoadingRepos(true);
    setSelectedInstall(String(installId));
    console.log(`🔄 Fetching repos for Install ID: ${installId}`);

    try {
      const res = await fetch(`/api/github/repos?installationId=${installId}`);
      const data = await res.json();
      
      console.log("✅ Repos Loaded:", data);
      
      if (Array.isArray(data.repositories)) {
        setRepos(data.repositories);
      } else {
        setRepos([]);
        console.warn("⚠️ API returned no repository array", data);
      }
    } catch (e) {
      console.error("❌ Repo Fetch Error:", e);
      setRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  };

  // 3. Connect/Ingest Logic
  const connectRepo = async (repo: any) => {
    // Optimistic UI: Immediately show spinner
    setConnectingIds(prev => new Set(prev).add(repo.id));

    try {
      console.log(`🔌 Connecting ${repo.full_name}...`);
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
        console.log("✅ Connection Success:", result);
        // Update local state to show "Active Monitor" instantly
        setRepos(prev => prev.map(r => 
          r.id === repo.id ? { ...r, isConnected: true } : r
        ));
      } else {
        alert(`Failed: ${result.error}`);
      }
    } catch (err) {
      console.error("❌ Connect Error:", err);
      alert("Failed to connect repo. Check console.");
    } finally {
      setConnectingIds(prev => {
        const next = new Set(prev);
        next.delete(repo.id);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white p-6 flex flex-col gap-8 sticky top-0 h-screen">
        <div className="text-2xl font-bold italic text-indigo-400">Codrel.</div>
        
        <nav className="space-y-2">
          <div className="flex items-center gap-3 text-indigo-400 bg-indigo-400/10 p-3 rounded-lg cursor-pointer font-medium border border-indigo-400/20">
            <LayoutDashboard size={20} /> Repository Manager
          </div>
          <div className="flex items-center gap-3 text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-lg cursor-pointer transition-colors font-medium">
            <Activity size={20} /> Ingestion Logs
          </div>
          <div className="flex items-center gap-3 text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-lg cursor-pointer transition-colors font-medium">
            <Settings size={20} /> Configuration
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800">
           <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-3">System Status</div>
           <div className="flex items-center gap-2 text-emerald-400 text-sm">
             <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
             Workers Online
           </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-10 overflow-y-auto h-screen">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Repository Management</h1>
            <p className="text-slate-500 mt-1">Select an account to view and protect its repositories.</p>
          </div>
          
          <a 
            href={`https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_NAME}/installations/new`}
            target="_blank"
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus size={18} /> Add New Account
          </a>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: ACCOUNTS (Installations) */}
          <div className="lg:col-span-4 h-fit">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Connected Accounts</h2>
              
              {loadingInstalls ? (
                 <div className="flex items-center justify-center py-8 text-slate-400">
                   <Loader2 className="animate-spin mr-2" /> Loading...
                 </div>
              ) : installations.length > 0 ? (
                <div className="space-y-2">
                  {installations.map(inst => (
                    <div 
                      key={inst.id}
                      onClick={() => loadRepos(inst.id)}
                      className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer border transition-all ${
                        selectedInstall === String(inst.id) 
                          ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 shadow-sm' 
                          : 'border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <img src={inst.account.avatar_url} className="w-10 h-10 rounded-full border border-slate-200" />
                      <div>
                        <div className="font-semibold text-slate-800 leading-tight">{inst.account.login}</div>
                        <div className="text-xs text-slate-400 capitalize">{inst.account.type.toLowerCase()} Account</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <div className="text-slate-400 font-medium text-sm mb-2">No accounts connected</div>
                  <p className="text-xs text-slate-400 mb-4">Install the Sentinel App on your GitHub account to get started.</p>
                  <a 
                    href={`https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_NAME}/installations/new`}
                    target="_blank"
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    Install Now &rarr;
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: REPOSITORIES */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Repositories</h2>
                 {repos.length > 0 && <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded">{repos.length} found</span>}
              </div>
              
              {loadingRepos ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Loader2 className="animate-spin mb-3 text-indigo-600" size={32} /> 
                  <span className="text-sm font-medium">Fetching repositories from GitHub...</span>
                </div>
              ) : repos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {repos.map(repo => {
                    const isConnecting = connectingIds.has(repo.id);
                    const isConnected = repo.isConnected || false; 

                    return (
                      <div key={repo.id} className="p-5 border border-slate-100 rounded-xl hover:shadow-md transition-shadow group flex flex-col justify-between bg-slate-50/50">
                        <div className="mb-4">
                          <div className="flex justify-between items-start mb-1">
                            <div className="font-bold text-slate-800 text-lg truncate pr-2" title={repo.name}>{repo.name}</div>
                            {repo.private && <ShieldAlert size={16} className="text-amber-500/50 shrink-0" title="Private Repo" />}
                          </div>
                          <div className="text-xs text-slate-400 line-clamp-2 h-8">
                            {repo.description || "No description provided."}
                          </div>
                        </div>

                        {isConnected ? (
                           <button disabled className="w-full py-2.5 text-sm font-bold rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center gap-2 cursor-default">
                             <CheckCircle2 size={16} /> Active Monitor
                           </button>
                        ) : (
                          <button 
                            onClick={() => connectRepo(repo)}
                            disabled={isConnecting}
                            className="w-full py-2.5 text-sm font-bold rounded-lg bg-slate-900 text-white hover:bg-indigo-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                          >
                            {isConnecting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                            {isConnecting ? 'Ingesting...' : 'Connect Sentinel'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-80 text-slate-300">
                  {selectedInstall ? (
                    <>
                      <GitPullRequest size={48} className="mb-4 opacity-20" />
                      <div className="text-slate-500 font-medium">No repositories found.</div>
                      <div className="text-xs text-slate-400 mt-2 max-w-xs text-center">
                        If you have repos, make sure you granted 
                        <span className="font-bold text-slate-500"> "All repositories"</span> access in the GitHub App settings.
                      </div>
                      <a 
                        href={`https://github.com/settings/installations/${selectedInstall}`}
                        target="_blank"
                        className="mt-4 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1"
                      >
                        <Settings size={12} /> Check Permissions
                      </a>
                    </>
                  ) : (
                    <>
                      <LayoutDashboard size={48} className="mb-4 opacity-20" />
                      <div className="text-slate-400">Select an account from the left to view repos.</div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}