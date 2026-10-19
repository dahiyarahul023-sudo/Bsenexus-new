import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Terminal, 
  Copy, 
  Check, 
  Play, 
  ExternalLink, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Code2, 
  FileJson, 
  ArrowRight,
  Database,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';
import { BseNexusLogo } from './ui/BseNexusLogo';

interface AiPluginPageProps {
  onEnterTerminal?: (tab?: string) => void;
}

export const AiPluginPage: React.FC<AiPluginPageProps> = ({ onEnterTerminal }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Playground state
  const [selectedEndpoint, setSelectedEndpoint] = useState<'filings' | 'results' | 'board-meetings' | 'company'>('filings');
  const [paramSymbol, setParamSymbol] = useState('RELIANCE');
  const [paramCategory, setParamCategory] = useState('');
  const [paramLimit, setParamLimit] = useState(5);
  const [paramDays, setParamDays] = useState(30);
  const [paramQuery, setParamQuery] = useState('Tata Motors');

  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseLatency, setResponseLatency] = useState<number | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Universal AI Plugin & Action Gateway | BSE Nexus';
    let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = 'https://bsenexus.in/plugin';
  }, []);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const executePlaygroundCall = async () => {
    setIsLoading(true);
    setApiResponse(null);
    setResponseStatus(null);
    setResponseLatency(null);

    const startTime = performance.now();
    let url = '';

    if (selectedEndpoint === 'filings') {
      const params = new URLSearchParams();
      if (paramSymbol) params.set('symbol', paramSymbol.trim());
      if (paramCategory) params.set('category', paramCategory.trim());
      params.set('limit', String(paramLimit));
      url = `/api/ai/v1/filings?${params.toString()}`;
    } else if (selectedEndpoint === 'results') {
      url = `/api/ai/v1/results?symbol=${encodeURIComponent(paramSymbol.trim() || 'RELIANCE')}`;
    } else if (selectedEndpoint === 'board-meetings') {
      const params = new URLSearchParams();
      if (paramSymbol) params.set('symbol', paramSymbol.trim());
      params.set('daysAhead', String(paramDays));
      url = `/api/ai/v1/board-meetings?${params.toString()}`;
    } else if (selectedEndpoint === 'company') {
      url = `/api/ai/v1/company?query=${encodeURIComponent(paramQuery.trim() || 'Reliance')}`;
    }

    try {
      const res = await fetch(url);
      const data = await res.json();
      const endTime = performance.now();
      setResponseStatus(res.status);
      setResponseLatency(Math.round(endTime - startTime));
      setApiResponse(data);
    } catch (err: any) {
      const endTime = performance.now();
      setResponseStatus(500);
      setResponseLatency(Math.round(endTime - startTime));
      setApiResponse({ error: err?.message || 'Network request failed' });
    } finally {
      setIsLoading(false);
    }
  };

  // Run initial test call on mount
  useEffect(() => {
    executePlaygroundCall();
  }, [selectedEndpoint]);

  const openApiUrl = 'https://bsenexus.in/api/ai/openapi.json';
  const geminiToolsUrl = 'https://bsenexus.in/api/ai/gemini-tools.json';
  const manifestUrl = 'https://bsenexus.in/.well-known/ai-plugin.json';

  const gptInstructions = `You are a financial intelligence assistant powered by live BSE Nexus data (https://bsenexus.in).
When answering questions regarding Indian stock announcements, corporate actions, quarterly financial results, dividends, or board meetings:
1. Use the getBseFilings action to query real-time disclosures by stock symbol (e.g. RELIANCE, TCS, INFY) or category.
2. Use getQuarterlyResults to fetch revenue, net profit, EBITDA, and margins.
3. Use getBoardMeetings to check upcoming board meeting dates and agendas.
4. Always include the official BSE Nexus permalink and BSE PDF link in your citation so the user can verify the original regulatory filing.`;

  const geminiSampleCode = `import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

// Fetch live BSE Nexus tool declarations
const toolsData = await fetch("${geminiToolsUrl}").then(r => r.json());

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "What are the latest corporate announcements filed by Reliance Industries today?",
  config: {
    tools: [{ functionDeclarations: toolsData.functionDeclarations }]
  }
});

console.log(response.text);`;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-[#0E1322]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <BseNexusLogo className="w-8 h-8 rounded-lg shadow-sm" />
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-white text-base">BSE Nexus</span>
                <span className="text-[10px] text-emerald-400 font-mono tracking-wider uppercase">AI Plugin Gateway</span>
              </div>
            </a>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <a href="/announcements" className="hidden sm:inline-block text-slate-400 hover:text-white transition-colors">
              Live Terminal
            </a>
            <a href="/companies" className="hidden sm:inline-block text-slate-400 hover:text-white transition-colors">
              Directory
            </a>
            <a href="/pricing" className="text-slate-400 hover:text-white transition-colors">
              Pro Plans
            </a>
            {onEnterTerminal ? (
              <button
                onClick={() => onEnterTerminal('announcements')}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
              >
                <span>Terminal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <a
                href="/"
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
              >
                <span>Terminal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16 space-y-16">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <a href="/" className="hover:text-emerald-400 transition-colors">Home</a>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-200">AI Plugin & OpenAPI Action Gateway</span>
        </div>

        {/* Hero Section */}
        <div className="space-y-6 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Bot className="w-3.5 h-3.5 text-emerald-400" />
            <span>Universal AI Integration Layer</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Connect Any AI to Real-Time BSE Corporate Filings
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            One standardized OpenAPI 3.1 action schema and Google Gemini function declarations. 
            Empower ChatGPT Custom GPTs, Gemini agents, Claude, and Telegram bots to query live regulatory announcements, quarterly results, and board meetings with zero friction.
          </p>

          {/* Quick Copy Schema URL Bar */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xl mx-auto">
            <div className="w-full flex items-center bg-[#121624] border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-300">
              <span className="text-slate-500 mr-2 select-none">Schema URL:</span>
              <span className="truncate flex-1 text-emerald-400 font-semibold">{openApiUrl}</span>
            </div>
            <button
              onClick={() => handleCopy('openapi', openApiUrl)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/10 shrink-0"
            >
              {copiedKey === 'openapi' ? <Check className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4 text-black" />}
              <span>{copiedKey === 'openapi' ? 'Copied URL!' : 'Copy OpenAPI URL'}</span>
            </button>
          </div>
        </div>

        {/* Three Step Quick Integration Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: ChatGPT */}
          <div className="p-6 rounded-2xl bg-[#121624] border border-slate-800/90 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Bot className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white">ChatGPT Custom GPT</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect your custom GPT in 30 seconds. Paste the OpenAPI URL in GPT Builder Actions with zero authentication.
              </p>
              <div className="text-xs text-slate-300 space-y-1.5 pt-2">
                <p>1. Open <strong>GPT Builder</strong> &gt; <strong>Configure</strong></p>
                <p>2. Scroll down to <strong>Actions</strong> &gt; <strong>Import from URL</strong></p>
                <p>3. Paste <code className="text-emerald-400 bg-[#0B0F19] px-1 py-0.5 rounded font-mono">/api/ai/openapi.json</code></p>
              </div>
            </div>

            <button
              onClick={() => handleCopy('gptPrompt', gptInstructions)}
              className="w-full py-2.5 px-3 rounded-lg bg-[#181D2F] border border-slate-700/80 text-xs font-semibold text-slate-200 hover:text-white hover:border-slate-600 flex items-center justify-center gap-2 transition-all"
            >
              {copiedKey === 'gptPrompt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'gptPrompt' ? 'Copied Instructions!' : 'Copy GPT Instructions'}</span>
            </button>
          </div>

          {/* Card 2: Google Gemini */}
          <div className="p-6 rounded-2xl bg-[#121624] border border-slate-800/90 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white">Google Gemini Tools</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Plug direct function declarations into the <code className="text-blue-400 font-mono">@google/genai</code> SDK for Gemini 2.5/3 Pro &amp; Flash.
              </p>
              <div className="text-xs text-slate-300 space-y-1.5 pt-2">
                <p>1. Import declarations from <code className="text-blue-400 bg-[#0B0F19] px-1 py-0.5 rounded font-mono">/api/ai/gemini-tools.json</code></p>
                <p>2. Pass to <code className="text-blue-400 font-mono">ai.models.generateContent()</code></p>
                <p>3. Gemini calls BSE Nexus functions automatically.</p>
              </div>
            </div>

            <button
              onClick={() => handleCopy('geminiCode', geminiSampleCode)}
              className="w-full py-2.5 px-3 rounded-lg bg-[#181D2F] border border-slate-700/80 text-xs font-semibold text-slate-200 hover:text-white hover:border-slate-600 flex items-center justify-center gap-2 transition-all"
            >
              {copiedKey === 'geminiCode' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code2 className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'geminiCode' ? 'Copied Node.js Snippet!' : 'Copy Gemini SDK Code'}</span>
            </button>
          </div>

          {/* Card 3: Bots & Automation */}
          <div className="p-6 rounded-2xl bg-[#121624] border border-slate-800/90 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Terminal className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white">Telegram &amp; REST Bots</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Clean, token-efficient JSON endpoints with CORS enabled for browser apps, Node, Python, and webhook automations.
              </p>
              <div className="text-xs text-slate-300 space-y-1.5 pt-2">
                <p>• CORS enabled: Call directly from any client</p>
                <p>• Strip HTML: Concise AI token footprint</p>
                <p>• Direct BSE PDF and Nexus URLs in every item</p>
              </div>
            </div>

            <button
              onClick={() => handleCopy('curlCmd', `curl -s "https://bsenexus.in/api/ai/v1/filings?symbol=RELIANCE&limit=5"`)}
              className="w-full py-2.5 px-3 rounded-lg bg-[#181D2F] border border-slate-700/80 text-xs font-semibold text-slate-200 hover:text-white hover:border-slate-600 flex items-center justify-center gap-2 transition-all font-mono"
            >
              {copiedKey === 'curlCmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'curlCmd' ? 'Copied cURL!' : 'Copy cURL Example'}</span>
            </button>
          </div>
        </div>

        {/* Interactive Live Playground Console */}
        <div className="rounded-2xl bg-[#121624] border border-slate-800 overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-slate-800 bg-[#0E1322] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-bold text-white">Interactive AI API Playground</h2>
              </div>
              <p className="text-xs text-slate-400">
                Test live queries against the BSE Nexus AI Gateway in real-time.
              </p>
            </div>

            {/* Segmented endpoint selector */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#0B0F19] border border-slate-800 rounded-xl">
              <button
                onClick={() => setSelectedEndpoint('filings')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedEndpoint === 'filings' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}
              >
                /v1/filings
              </button>
              <button
                onClick={() => setSelectedEndpoint('results')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedEndpoint === 'results' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}
              >
                /v1/results
              </button>
              <button
                onClick={() => setSelectedEndpoint('board-meetings')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedEndpoint === 'board-meetings' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}
              >
                /v1/board-meetings
              </button>
              <button
                onClick={() => setSelectedEndpoint('company')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedEndpoint === 'company' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}
              >
                /v1/company
              </button>
            </div>
          </div>

          {/* Playground Parameters Bar */}
          <div className="p-6 border-b border-slate-800/80 bg-[#121624] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {selectedEndpoint !== 'company' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Stock Symbol / Scrip Code
                  </label>
                  <input
                    type="text"
                    value={paramSymbol}
                    onChange={(e) => setParamSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. RELIANCE, TCS, 500325"
                    className="w-full bg-[#0B0F19] border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {selectedEndpoint === 'filings' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Filing Category Filter
                    </label>
                    <input
                      type="text"
                      value={paramCategory}
                      onChange={(e) => setParamCategory(e.target.value)}
                      placeholder="e.g. Board Meeting, Results"
                      className="w-full bg-[#0B0F19] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Max Results (1 - 25)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={25}
                      value={paramLimit}
                      onChange={(e) => setParamLimit(Number(e.target.value))}
                      className="w-full bg-[#0B0F19] border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </>
              )}

              {selectedEndpoint === 'board-meetings' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Lookahead Window (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={paramDays}
                    onChange={(e) => setParamDays(Number(e.target.value))}
                    className="w-full bg-[#0B0F19] border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {selectedEndpoint === 'company' && (
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Company Name / BSE Scrip Code
                  </label>
                  <input
                    type="text"
                    value={paramQuery}
                    onChange={(e) => setParamQuery(e.target.value)}
                    placeholder="e.g. Tata Motors, 500570, Infosys"
                    className="w-full bg-[#0B0F19] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Presets:</span>
                <button
                  type="button"
                  onClick={() => { setParamSymbol('RELIANCE'); setSelectedEndpoint('filings'); }}
                  className="px-2 py-0.5 rounded bg-[#0B0F19] border border-slate-800 text-[11px] text-slate-300 hover:text-emerald-400"
                >
                  Reliance Filings
                </button>
                <button
                  type="button"
                  onClick={() => { setParamSymbol('TATAMOTORS'); setSelectedEndpoint('results'); }}
                  className="px-2 py-0.5 rounded bg-[#0B0F19] border border-slate-800 text-[11px] text-slate-300 hover:text-emerald-400"
                >
                  Tata Motors Results
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedEndpoint('board-meetings'); setParamSymbol(''); }}
                  className="px-2 py-0.5 rounded bg-[#0B0F19] border border-slate-800 text-[11px] text-slate-300 hover:text-emerald-400"
                >
                  Upcoming Meetings
                </button>
              </div>

              <button
                onClick={executePlaygroundCall}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isLoading ? 'Executing...' : 'Run Query'}</span>
              </button>
            </div>
          </div>

          {/* Response Window */}
          <div className="p-6 bg-[#080B12]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-slate-400">RESPONSE PAYLOAD:</span>
                {responseStatus && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${responseStatus === 200 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                    HTTP {responseStatus}
                  </span>
                )}
                {responseLatency !== null && (
                  <span className="text-[11px] font-mono text-slate-400">
                    ⚡ {responseLatency}ms
                  </span>
                )}
              </div>

              {apiResponse && (
                <button
                  onClick={() => handleCopy('jsonPayload', JSON.stringify(apiResponse, null, 2))}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono transition-colors"
                >
                  {copiedKey === 'jsonPayload' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'jsonPayload' ? 'Copied JSON!' : 'Copy JSON'}</span>
                </button>
              )}
            </div>

            <pre className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800/90 text-xs font-mono text-emerald-400 overflow-x-auto max-h-[380px] leading-relaxed select-text">
              {isLoading ? (
                <div className="flex items-center gap-2 text-slate-400 py-6">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Fetching live data from BSE Nexus gateway...</span>
                </div>
              ) : apiResponse ? (
                JSON.stringify(apiResponse, null, 2)
              ) : (
                <span className="text-slate-600">// Click Run Query to inspect live JSON response</span>
              )}
            </pre>
          </div>
        </div>

        {/* Complete API Endpoint Reference */}
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white tracking-tight">AI Gateway Endpoint Reference</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Deterministic, cache-controlled endpoints designed for seamless language model tool use.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Endpoint 1 */}
            <div className="p-5 rounded-2xl bg-[#121624] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">GET</span>
                  <code className="text-xs font-mono font-bold text-white">/api/ai/v1/filings</code>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Rate Limit: 60/min</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Fetches real-time regulatory filings and corporate disclosures. Supports filtering by NSE/BSE symbol, scrip code, or keyword category.
              </p>
              <div className="text-[11px] font-mono text-slate-400 pt-1 space-y-1 border-t border-slate-800/80">
                <p>• <strong>symbol</strong>: (optional) e.g. <code className="text-slate-300">RELIANCE</code>, <code className="text-slate-300">500325</code></p>
                <p>• <strong>category</strong>: (optional) e.g. <code className="text-slate-300">Financial Results</code>, <code className="text-slate-300">Board Meeting</code></p>
                <p>• <strong>limit</strong>: (optional) 1 to 25 (default: 10)</p>
              </div>
            </div>

            {/* Endpoint 2 */}
            <div className="p-5 rounded-2xl bg-[#121624] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono text-[10px] font-bold">GET</span>
                  <code className="text-xs font-mono font-bold text-white">/api/ai/v1/results</code>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Rate Limit: 60/min</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Returns historical quarterly financial reports, revenue, EBITDA, net profit figures, and margin percentages for any listed scrip.
              </p>
              <div className="text-[11px] font-mono text-slate-400 pt-1 space-y-1 border-t border-slate-800/80">
                <p>• <strong>symbol</strong>: (required) e.g. <code className="text-slate-300">TATAMOTORS</code>, <code className="text-slate-300">500570</code></p>
                <p>• Returns up to 8 recent quarters of verified financials.</p>
              </div>
            </div>

            {/* Endpoint 3 */}
            <div className="p-5 rounded-2xl bg-[#121624] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-mono text-[10px] font-bold">GET</span>
                  <code className="text-xs font-mono font-bold text-white">/api/ai/v1/board-meetings</code>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Rate Limit: 60/min</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Queries upcoming scheduled meetings of company boards to approve quarterly earnings, consider dividends, bonus shares, or buybacks.
              </p>
              <div className="text-[11px] font-mono text-slate-400 pt-1 space-y-1 border-t border-slate-800/80">
                <p>• <strong>symbol</strong>: (optional) Filter for a specific stock</p>
                <p>• <strong>daysAhead</strong>: (optional) Window in days (1 to 60, default: 14)</p>
              </div>
            </div>

            {/* Endpoint 4 */}
            <div className="p-5 rounded-2xl bg-[#121624] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold">GET</span>
                  <code className="text-xs font-mono font-bold text-white">/api/ai/v1/company</code>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Rate Limit: 60/min</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Resolves stock tickers, company legal names, and official 6-digit BSE Scrip Codes for unambiguous disambiguation.
              </p>
              <div className="text-[11px] font-mono text-slate-400 pt-1 space-y-1 border-t border-slate-800/80">
                <p>• <strong>query</strong>: (required) e.g. <code className="text-slate-300">Zomato</code>, <code className="text-slate-300">543320</code>, <code className="text-slate-300">Infosys</code></p>
                <p>• Returns scrip code, sector, and BSE Nexus company URL.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Developer Trust & Policy */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-[#121624] to-[#161C2E] border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Open Developer Policy</span>
            </div>
            <h3 className="text-xl font-bold text-white">Committed to Free &amp; Open Financial Intelligence</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              BSE Nexus provides public AI endpoints to democratize access to SEBI corporate disclosures. 
              Responses are cached at the edge to ensure high throughput without overburdening exchange systems.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href={openApiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-[#0B0F19] border border-slate-700 text-xs font-semibold text-white hover:border-slate-600 flex items-center gap-1.5 transition-colors"
            >
              <span>View OpenAPI JSON</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0A0D17] py-8 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BseNexusLogo className="w-5 h-5 rounded" />
            <span>&copy; {new Date().getFullYear()} BSE Nexus • Independent BSE Disclosures Aggregator</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <a href="/announcements" className="hover:text-emerald-400 transition-colors">Live Filings</a>
            <a href="/companies" className="hover:text-emerald-400 transition-colors">Directory</a>
            <a href="/guides" className="hover:text-emerald-400 transition-colors">Guides</a>
            <a href="/privacy-policy" className="hover:text-emerald-400 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-emerald-400 transition-colors">Terms</a>
            <a href="/contact" className="hover:text-emerald-400 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
