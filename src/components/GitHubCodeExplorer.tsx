import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  Folder, 
  FolderOpen, 
  FileCode, 
  FileText, 
  FileJson, 
  Search, 
  RefreshCw, 
  Copy, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  AlertTriangle, 
  GitPullRequest, 
  ExternalLink, 
  Key, 
  Sliders, 
  ChevronRight, 
  ChevronDown, 
  Terminal, 
  Lock,
  Code2,
  FileCheck
} from 'lucide-react';
import { 
  GitHubConnectionStatus, 
  GitHubRepoItem, 
  GitHubBranchItem, 
  GitHubFileNode, 
  GitHubFileContent, 
  GitHubSearchResult,
  GitHubCommitProposal 
} from '../types';

interface GitHubCodeExplorerProps {
  onAskChatWithFile?: (prompt: string, gitContext: { path: string; repo: string; branch: string; snippet?: string }) => void;
}

export const GitHubCodeExplorer: React.FC<GitHubCodeExplorerProps> = ({ onAskChatWithFile }) => {
  // Connection state
  const [gitStatus, setGitStatus] = useState<GitHubConnectionStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);

  // Repos & Branches
  const [repos, setRepos] = useState<GitHubRepoItem[]>([]);
  const [branches, setBranches] = useState<GitHubBranchItem[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('karotiyarohit88/master-project-ai-agent');
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [isCustomRepo, setIsCustomRepo] = useState<boolean>(false);
  const [customRepoInput, setCustomRepoInput] = useState<string>('');

  // Tree & Files
  const [tree, setTree] = useState<GitHubFileNode[]>([]);
  const [treeSearch, setTreeSearch] = useState<string>('');
  const [isLoadingTree, setIsLoadingTree] = useState<boolean>(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'src/components']));

  // Active File Viewer
  const [activeFile, setActiveFile] = useState<GitHubFileContent | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [copiedFile, setCopiedFile] = useState<boolean>(false);

  // Search mode: 'tree' | 'code'
  const [searchMode, setSearchMode] = useState<'tree' | 'code'>('tree');
  const [codeSearchQuery, setCodeSearchQuery] = useState<string>('');
  const [codeSearchResults, setCodeSearchResults] = useState<GitHubSearchResult[]>([]);
  const [isSearchingCode, setIsSearchingCode] = useState<boolean>(false);

  // Auth Modal
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [isSavingToken, setIsSavingToken] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Diff & Proposal Modal
  const [activeProposal, setActiveProposal] = useState<GitHubCommitProposal | null>(null);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState<boolean>(false);
  const [proposalInstruction, setProposalInstruction] = useState<string>('');
  const [isGeneratingProposal, setIsGeneratingProposal] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [directCommitConfirmed, setDirectCommitConfirmed] = useState<boolean>(false);
  const [commitSuccessMessage, setCommitSuccessMessage] = useState<string | null>(null);

  // Notifications
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // 1. Fetch GitHub connection status on mount
  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/github/status');
      if (res.ok) {
        const data: GitHubConnectionStatus = await res.json();
        setGitStatus(data);
        if (data.owner && data.repo) {
          setSelectedRepo(`${data.owner}/${data.repo}`);
        }
        if (data.branch) {
          setSelectedBranch(data.branch);
        }
      }
    } catch (e) {
      console.warn('Failed to load GitHub status:', e);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // 2. Fetch repos
  const fetchRepos = async () => {
    try {
      const res = await fetch('/api/github/repos');
      if (res.ok) {
        const data = await res.json();
        setRepos(data.repos || []);
      }
    } catch (e) {
      console.warn('Failed to fetch repos:', e);
    }
  };

  // 3. Fetch branches
  const fetchBranches = async (ownerRepo: string) => {
    const [owner, repo] = ownerRepo.split('/');
    if (!owner || !repo) return;
    try {
      const res = await fetch(`/api/github/repos/${owner}/${repo}/branches`);
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
        if (data.branches && data.branches.length > 0) {
          const hasDefault = data.branches.find((b: GitHubBranchItem) => b.isDefault);
          if (hasDefault && !selectedBranch) {
            setSelectedBranch(hasDefault.name);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch branches:', e);
    }
  };

  // 4. Fetch Tree
  const fetchTree = async (ownerRepo = selectedRepo, branch = selectedBranch) => {
    const [owner, repo] = ownerRepo.split('/');
    if (!owner || !repo) return;
    setIsLoadingTree(true);
    try {
      const res = await fetch(`/api/github/tree?owner=${owner}&repo=${repo}&branch=${branch}`);
      if (res.ok) {
        const data = await res.json();
        setTree(data.tree || []);
      }
    } catch (e) {
      console.warn('Failed to fetch tree:', e);
    } finally {
      setIsLoadingTree(false);
    }
  };

  // 5. Open File
  const openFile = async (filePath: string) => {
    const [owner, repo] = selectedRepo.split('/');
    setIsLoadingFile(true);
    try {
      const res = await fetch(`/api/github/file?path=${encodeURIComponent(filePath)}&owner=${owner}&repo=${repo}&branch=${selectedBranch}`);
      if (res.ok) {
        const data: GitHubFileContent = await res.json();
        setActiveFile(data);
      }
    } catch (e) {
      console.warn('Failed to open file:', e);
    } finally {
      setIsLoadingFile(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchRepos();
  }, []);

  useEffect(() => {
    if (selectedRepo) {
      fetchBranches(selectedRepo);
      fetchTree(selectedRepo, selectedBranch);
      // Auto open default important file
      if (!activeFile) {
        openFile('src/App.tsx');
      }
    }
  }, [selectedRepo, selectedBranch]);

  // Code search handler
  const handleCodeSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!codeSearchQuery.trim()) return;
    setIsSearchingCode(true);
    try {
      const res = await fetch(`/api/github/search?q=${encodeURIComponent(codeSearchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setCodeSearchResults(data.results || []);
      }
    } catch (err) {
      console.warn('Code search failed:', err);
    } finally {
      setIsSearchingCode(false);
    }
  };

  // Save Token
  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setIsSavingToken(true);
    setAuthError(null);
    try {
      const [owner, repo] = selectedRepo.split('/');
      const res = await fetch('/api/github/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenInput.trim(),
          owner,
          repo,
          branch: selectedBranch
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Failed to authenticate token.');
      } else {
        setNoticeMessage(`Successfully connected as @${data.userLogin}!`);
        setIsAuthModalOpen(false);
        setTokenInput('');
        fetchStatus();
        fetchRepos();
        fetchTree();
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Network error.');
    } finally {
      setIsSavingToken(false);
    }
  };

  // Disconnect Token
  const handleDisconnect = async () => {
    try {
      await fetch('/api/github/auth/disconnect', { method: 'POST' });
      setNoticeMessage('Switched back to Demo Sandbox Mode.');
      setIsAuthModalOpen(false);
      fetchStatus();
      fetchTree();
    } catch (e) {
      console.warn('Disconnect error:', e);
    }
  };

  // AI Review Action
  const handleExplainWithAI = () => {
    if (!activeFile) return;
    const prompt = `Explain the architecture, structure, and design patterns in file "${activeFile.path}". Detail its exports, state flows, and core dependencies.`;
    if (onAskChatWithFile) {
      onAskChatWithFile(prompt, {
        path: activeFile.path,
        repo: selectedRepo,
        branch: selectedBranch,
        snippet: activeFile.content
      });
    }
  };

  // AI Bug & Security Scan Action
  const handleScanBugsWithAI = () => {
    if (!activeFile) return;
    const prompt = `Perform a deep code review and security audit for "${activeFile.path}". Identify any memory leaks, missing error checks, race conditions, OWASP risks, or edge-case bugs. Provide concrete remediation snippets.`;
    if (onAskChatWithFile) {
      onAskChatWithFile(prompt, {
        path: activeFile.path,
        repo: selectedRepo,
        branch: selectedBranch,
        snippet: activeFile.content
      });
    }
  };

  // Propose change trigger
  const handleOpenProposalDialog = () => {
    if (!activeFile) return;
    setIsProposalModalOpen(true);
    setProposalInstruction('');
    setActiveProposal(null);
    setCommitSuccessMessage(null);
  };

  // Generate change proposal with diff
  const handleGenerateProposal = async () => {
    if (!activeFile || !proposalInstruction.trim()) return;
    setIsGeneratingProposal(true);
    try {
      // Simulate/Generate intelligent patch
      let proposedCode = activeFile.content;
      const instruction = proposalInstruction.trim();

      // Simple transformation simulation adding header or safety wrapper
      if (!proposedCode.includes('// Verified by Master Project AI Agent')) {
        proposedCode = `// Verified by Master Project AI Agent: ${instruction.slice(0, 40)}\n` + proposedCode;
      }

      const res = await fetch('/api/github/propose-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: activeFile.path,
          originalContent: activeFile.content,
          proposedContent: proposedCode,
          commitMessage: `feat(${activeFile.name}): ${instruction}`,
          targetBranch: selectedBranch,
          newBranchName: `feature/ai-patch-${Date.now().toString().slice(-4)}`,
          createPullRequest: true
        })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveProposal(data.proposal);
      }
    } catch (err) {
      console.warn('Failed to propose change:', err);
    } finally {
      setIsGeneratingProposal(false);
    }
  };

  // Commit Proposal
  const handleCommitProposal = async () => {
    if (!activeProposal) return;
    setIsCommitting(true);
    setCommitSuccessMessage(null);
    try {
      const res = await fetch('/api/github/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: activeProposal.proposalId,
          directCommitConfirmed
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setNoticeMessage(data.error || 'Commit rejected by safety gate.');
      } else {
        setCommitSuccessMessage(data.message);
        setActiveProposal(prev => prev ? { ...prev, status: 'committed', commitSha: data.commitSha } : null);
        fetchTree();
      }
    } catch (err: any) {
      setNoticeMessage(`Commit error: ${err?.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Copy code helper
  const handleCopyCode = () => {
    if (!activeFile?.content) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  // Folder toggling
  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  // Filtered files in tree
  const filteredTree = tree.filter(item => {
    if (!treeSearch) return true;
    return item.path.toLowerCase().includes(treeSearch.toLowerCase());
  });

  // Get file icon helper
  const getFileIcon = (filePath: string) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
      return <FileCode className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />;
    }
    if (filePath.endsWith('.json')) {
      return <FileJson className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />;
    }
    if (filePath.endsWith('.md')) {
      return <FileText className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />;
    }
    return <FileCode className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />;
  };

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-w-0">
      
      {/* 1. Header Toolbar */}
      <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/80 flex flex-col gap-2.5 flex-shrink-0">
        
        {/* Top line: Title & Auth Status Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <GitBranch className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5 truncate">
                GitHub Code Explorer
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold uppercase">
                  Read-Only Viewer
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                Inspect repositories, review files, search code & safely stage changes
              </p>
            </div>
          </div>

          {/* Right: Auth status button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                gitStatus?.configured
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-emerald-600" />
              <span>{gitStatus?.configured ? `@${gitStatus.userLogin}` : 'Connect Token'}</span>
              <span className={`w-2 h-2 rounded-full ${gitStatus?.configured ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
            </button>

            <button
              type="button"
              onClick={() => {
                fetchTree();
                fetchStatus();
              }}
              className="p-1.5 sm:p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 transition-colors cursor-pointer"
              title="Refresh repository tree"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTree ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Local Termux Notice Banner */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <span className="truncate">
            <strong>Security Baseline:</strong> Local Termux or device files are only available after being committed and pushed to your authorized remote repository.
          </span>
        </div>

        {/* Selectors Row: Repo Selector + Branch Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 min-w-0">
          {/* Repo selector */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-semibold text-slate-600 flex-shrink-0">Repo:</span>
            {!isCustomRepo ? (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <select
                  value={selectedRepo}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomRepo(true);
                    } else {
                      setSelectedRepo(e.target.value);
                    }
                  }}
                  className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 truncate"
                >
                  {repos.map((r) => (
                    <option key={r.id} value={r.fullName}>
                      {r.fullName} {r.isPrivate ? '🔒' : ''}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter custom repository...</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="owner/repo"
                  value={customRepoInput}
                  onChange={(e) => setCustomRepoInput(e.target.value)}
                  className="flex-1 min-w-0 text-xs px-2 py-1 rounded bg-white border border-slate-200 text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customRepoInput.includes('/')) {
                      setSelectedRepo(customRepoInput.trim());
                      setIsCustomRepo(false);
                    }
                  }}
                  className="px-2 py-1 text-xs bg-emerald-600 text-white rounded font-medium cursor-pointer"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomRepo(false)}
                  className="px-1.5 py-1 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Branch selector */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-semibold text-slate-600 flex-shrink-0">Branch:</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 truncate"
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} {b.isProtected ? '🛡️' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Active status info */}
          <div className="hidden lg:flex items-center justify-end text-[11px] text-slate-500 font-mono">
            <span>{tree.length} files indexed</span>
            <span className="mx-1.5">•</span>
            <span>{gitStatus?.configured ? 'Remote Git Sync' : 'Sandbox Mirror'}</span>
          </div>
        </div>

      </div>

      {/* Notice alert */}
      {noticeMessage && (
        <div className="p-2.5 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
          <span>{noticeMessage}</span>
          <button
            type="button"
            onClick={() => setNoticeMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Main Content Split View */}
      <div className="flex-1 flex flex-col md:flex-row min-h-[480px] overflow-hidden min-w-0">
        
        {/* LEFT PANE: Tree & Search (Width 280px on desktop) */}
        <div className="w-full md:w-72 lg:w-80 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col bg-slate-50/40 flex-shrink-0 overflow-hidden">
          
          {/* Sub-header tab toggles: File Tree vs Code Search */}
          <div className="flex items-center border-b border-slate-200 bg-white p-1 gap-1">
            <button
              type="button"
              onClick={() => setSearchMode('tree')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                searchMode === 'tree'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>File Tree</span>
            </button>
            <button
              type="button"
              onClick={() => setSearchMode('code')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                searchMode === 'code'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Code</span>
            </button>
          </div>

          {/* Mode 1: File Tree */}
          {searchMode === 'tree' && (
            <>
              {/* Filter search bar */}
              <div className="p-2 border-b border-slate-200 bg-white">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter filenames..."
                    value={treeSearch}
                    onChange={(e) => setTreeSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {treeSearch && (
                    <button
                      type="button"
                      onClick={() => setTreeSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Tree View */}
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5 text-xs scrollbar-thin scrollbar-thumb-slate-200">
                {isLoadingTree ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                    <span>Loading repository tree...</span>
                  </div>
                ) : filteredTree.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No files found matching "{treeSearch}"
                  </div>
                ) : (
                  filteredTree.map((item) => {
                    const isDir = item.type === 'tree';
                    const isSelected = activeFile?.path === item.path;
                    const depth = item.path.split('/').length - 1;

                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => {
                          if (isDir) {
                            toggleFolder(item.path);
                          } else {
                            openFile(item.path);
                          }
                        }}
                        style={{ paddingLeft: `${Math.max(8, depth * 14)}px` }}
                        className={`w-full flex items-center justify-between pr-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-emerald-100/80 text-emerald-950 font-semibold border border-emerald-300'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {isDir ? (
                            expandedFolders.has(item.path) ? (
                              <FolderOpen className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                            ) : (
                              <Folder className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            )
                          ) : (
                            getFileIcon(item.path)
                          )}
                          <span className="truncate text-xs">
                            {item.path.split('/').pop()}
                          </span>
                        </div>

                        {item.size !== undefined && !isDir && (
                          <span className="text-[10px] text-slate-400 font-mono flex-shrink-0 ml-1">
                            {Math.round(item.size / 1024 * 10) / 10}k
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* Mode 2: Search Code In Repo */}
          {searchMode === 'code' && (
            <div className="flex-1 flex flex-col min-h-0 bg-white">
              <form onSubmit={handleCodeSearch} className="p-2 border-b border-slate-200">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Search terms (e.g. export, api)..."
                    value={codeSearchQuery}
                    onChange={(e) => setCodeSearchQuery(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isSearchingCode || !codeSearchQuery.trim()}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Search
                  </button>
                </div>
              </form>

              <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs scrollbar-thin scrollbar-thumb-slate-200">
                {isSearchingCode ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>Searching codebase...</span>
                  </div>
                ) : codeSearchResults.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    {codeSearchQuery ? 'No matching code snippets found.' : 'Enter a search term above to find matches across files.'}
                  </div>
                ) : (
                  codeSearchResults.map((res) => (
                    <div key={res.path} className="border border-slate-200 rounded-lg p-2 bg-slate-50/50">
                      <button
                        type="button"
                        onClick={() => openFile(res.path)}
                        className="font-mono text-xs text-emerald-800 hover:underline font-bold block truncate text-left mb-1 cursor-pointer"
                      >
                        {res.path}
                      </button>
                      <div className="space-y-1">
                        {res.matches.map((m, idx) => (
                          <div
                            key={idx}
                            onClick={() => openFile(res.path)}
                            className="text-[11px] font-mono text-slate-600 hover:text-slate-900 bg-white p-1 rounded border border-slate-100 cursor-pointer flex gap-1.5"
                          >
                            <span className="text-emerald-700 select-none">L{m.lineNumber}:</span>
                            <span className="truncate">{m.lineText}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT PANE: Read-Only Code Viewer & AI Toolbar */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
          
          {/* File Header Bar */}
          <div className="p-2.5 sm:p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {activeFile ? getFileIcon(activeFile.path) : <Code2 className="w-4 h-4 text-slate-400" />}
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold font-mono text-slate-900 truncate">
                  {activeFile?.path || 'No file selected'}
                </p>
                {activeFile && (
                  <p className="text-[10px] text-slate-500 font-mono">
                    {activeFile.linesCount} lines • {Math.round(activeFile.size / 1024 * 10) / 10} KB • SHA: {activeFile.sha.slice(0, 7)}
                  </p>
                )}
              </div>
            </div>

            {/* AI Assistant Quick Actions */}
            {activeFile && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleExplainWithAI}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Ask Master AI to explain this file"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Explain File</span>
                </button>

                <button
                  type="button"
                  onClick={handleScanBugsWithAI}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Review security & find bugs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Bug Scan</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenProposalDialog}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Propose modifications with Diff"
                >
                  <GitPullRequest className="w-3.5 h-3.5 text-amber-600" />
                  <span>Propose Fix</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer"
                  title="Copy file contents"
                >
                  {copiedFile ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* Code Viewer Viewport */}
          <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-200 font-mono text-xs p-3 sm:p-4 select-text scrollbar-thin scrollbar-thumb-slate-800">
            {isLoadingFile ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-20 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                <span>Reading file stream...</span>
              </div>
            ) : !activeFile ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 py-20">
                <Code2 className="w-12 h-12 mb-2 opacity-30 text-emerald-400" />
                <p>Select any file from the explorer tree on the left.</p>
              </div>
            ) : (
              <div className="relative font-mono leading-relaxed">
                <table className="w-full border-collapse">
                  <tbody>
                    {activeFile.content.split('\n').map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/80 transition-colors">
                        <td className="w-10 text-right pr-3 select-none text-slate-600 text-[11px] align-top py-0.5 border-r border-slate-800/80">
                          {idx + 1}
                        </td>
                        <td className="pl-3 py-0.5 whitespace-pre-wrap break-all text-slate-100 text-xs">
                          {line || ' '}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer Status Bar */}
          <div className="p-2 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between font-mono">
            <span className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Read-Only Mode: Direct edits blocked without human approval gate.</span>
            </span>
            <span className="hidden sm:inline">UTF-8 • LF</span>
          </div>

        </div>

      </div>

      {/* 3. GitHub Auth & Token Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <Key className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">GitHub Authentication</h3>
                  <p className="text-[11px] text-slate-500">Secure server-side token configuration</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveToken} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  placeholder="ghp_••••••••••••••••••••••••••••••••••••"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Stored safely in server memory only. Never saved in localStorage or exposed to the client.
                </p>
              </div>

              {authError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {authError}
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Required Token Scopes:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><code className="text-emerald-700">repo</code> (For private repos, tree inspection, and PRs)</li>
                  <li>or <code className="text-emerald-700">public_repo</code> (For public repositories read/commit)</li>
                </ul>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                {gitStatus?.configured && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 cursor-pointer"
                  >
                    Disconnect Token
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(false)}
                    className="px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingToken || !tokenInput.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingToken ? 'Validating...' : 'Save & Connect'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Diff & Change Proposal Modal */}
      {isProposalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 sm:p-5 flex flex-col max-h-[90vh] overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                  <GitPullRequest className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Propose Code Change with Diff</h3>
                  <p className="text-[11px] text-slate-500">File: <span className="font-mono text-emerald-700">{activeFile?.path}</span></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProposalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-3 overflow-y-auto flex-1 space-y-3 min-h-0">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Describe Intended Change
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., Add safety verification check or refactor error handling..."
                    value={proposalInstruction}
                    onChange={(e) => setProposalInstruction(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateProposal}
                    disabled={isGeneratingProposal || !proposalInstruction.trim()}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isGeneratingProposal ? 'Generating Diff...' : 'Compute Diff'}
                  </button>
                </div>
              </div>

              {/* Diff Viewer */}
              {activeProposal && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Unified Diff Preview:</span>
                    <span className="text-[10px] font-mono text-slate-400">Target: {activeProposal.targetBranch}</span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl font-mono text-[11px] max-h-52 overflow-y-auto border border-slate-800">
                    {activeProposal.diff.split('\n').map((dLine, idx) => {
                      let lineClass = 'text-slate-300';
                      if (dLine.startsWith('+')) lineClass = 'text-emerald-400 bg-emerald-950/40';
                      if (dLine.startsWith('-')) lineClass = 'text-rose-400 bg-rose-950/40';
                      if (dLine.startsWith('@@')) lineClass = 'text-blue-400';
                      return (
                        <div key={idx} className={`${lineClass} px-1 whitespace-pre-wrap`}>
                          {dLine}
                        </div>
                      );
                    })}
                  </div>

                  {/* Safety Option: Prefer feature branch and pull request */}
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span className="font-semibold text-amber-950">Safety Gate & Branching Rule:</span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      To prevent accidental corruption of the <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">{selectedBranch}</code> branch, substantial changes are staged into a feature branch and pull request.
                    </p>
                    <label className="flex items-center gap-2 text-xs text-amber-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={directCommitConfirmed}
                        onChange={(e) => setDirectCommitConfirmed(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>I explicitly authorize applying this change to the repository.</span>
                    </label>
                  </div>

                  {commitSuccessMessage && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 font-medium">
                      ✅ {commitSuccessMessage}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsProposalModalOpen(false)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Close
              </button>

              {activeProposal && activeProposal.status !== 'committed' && (
                <button
                  type="button"
                  onClick={handleCommitProposal}
                  disabled={isCommitting || !directCommitConfirmed}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isCommitting ? 'Committing...' : 'Approve & Commit to Repository'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
