import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clipboard,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileJson,
  FileKey,
  Fingerprint,
  FlaskConical,
  GitFork,
  Info,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Repeat2,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  WifiOff,
  X,
} from "lucide-react";
import type {
  AccountSummary,
  ChecklistPatch,
  PasswordOptions,
  RiskLevel,
  VaultSnapshot,
} from "../shared/contracts";

type View = "overview" | "accounts" | "generator" | "threat-model";
type ToastState = { message: string; tone?: "success" | "warning" } | null;

const EMPTY_SNAPSHOT: VaultSnapshot = {
  accounts: [],
  stats: { accounts: 0, critical: 0, weak: 0, reused: 0, exposed: 0, secured: 0, completionPercent: 0 },
  source: null,
};

const DEFAULT_OPTIONS: PasswordOptions = {
  length: 24,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  avoidAmbiguous: true,
};

function readableError(error: unknown): string {
  if (!(error instanceof Error)) return "Something went wrong. Try again.";
  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, "");
}

function App() {
  const [snapshot, setSnapshot] = useState<VaultSnapshot>(EMPTY_SNAPSHOT);
  const [view, setView] = useState<View>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [breachProgress, setBreachProgress] = useState<{ completed: number; total: number } | null>(null);

  useEffect(() => {
    void window.vaultMedic.getSnapshot().then(setSnapshot);
    return window.vaultMedic.onBreachProgress((progress) => {
      setSnapshot(progress.snapshot);
      setBreachProgress({ completed: progress.completed, total: progress.total });
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4_500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const importCsv = async () => {
    setBusy("import");
    try {
      const result = await window.vaultMedic.importCsv();
      if (!result.cancelled && result.snapshot) {
        setSnapshot(result.snapshot);
        setView("overview");
        setToast({ message: `${result.snapshot.stats.accounts} accounts opened locally.`, tone: "success" });
      }
    } catch (error) {
      setToast({ message: readableError(error), tone: "warning" });
    } finally {
      setBusy(null);
    }
  };

  const loadDemo = async () => {
    setBusy("demo");
    try {
      setSnapshot(await window.vaultMedic.loadDemo());
      setView("overview");
    } finally {
      setBusy(null);
    }
  };

  const clearVault = async () => {
    setSnapshot(await window.vaultMedic.clearVault());
    setSelectedId(null);
    setView("overview");
    setToast({ message: "Session locked and password data cleared from app memory.", tone: "success" });
  };

  const checkAll = async () => {
    setBusy("breaches");
    setBreachProgress({ completed: 0, total: snapshot.accounts.length });
    try {
      setSnapshot(await window.vaultMedic.checkBreaches());
      setToast({ message: "Compromised password check complete.", tone: "success" });
    } catch (error) {
      setToast({ message: readableError(error), tone: "warning" });
    } finally {
      setBusy(null);
      setBreachProgress(null);
    }
  };

  if (!snapshot.source) {
    return (
      <>
        <Landing onImport={importCsv} onDemo={loadDemo} busy={busy} />
        {toast && <Toast toast={toast} />}
      </>
    );
  }

  const selected = snapshot.accounts.find((account) => account.id === selectedId) ?? null;

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} snapshot={snapshot} onClear={clearVault} />
      <main className="main-stage">
        <Topbar snapshot={snapshot} onImport={importCsv} busy={busy === "import"} />
        <div className="page-wrap">
          {view === "overview" && (
            <Overview
              snapshot={snapshot}
              onSelect={setSelectedId}
              onCheckAll={checkAll}
              checking={busy === "breaches"}
              breachProgress={breachProgress}
              onExport={() => setExportOpen(true)}
              onSnapshot={setSnapshot}
              setToast={setToast}
            />
          )}
          {view === "accounts" && <Accounts snapshot={snapshot} onSelect={setSelectedId} />}
          {view === "generator" && <GeneratorPanel setToast={setToast} />}
          {view === "threat-model" && <ThreatModel />}
        </div>
      </main>
      {selected && (
        <AccountDrawer
          account={selected}
          onClose={() => setSelectedId(null)}
          onSnapshot={setSnapshot}
          setToast={setToast}
        />
      )}
      {exportOpen && (
        <ExportDialog
          onClose={() => setExportOpen(false)}
          setToast={setToast}
          onSnapshot={setSnapshot}
        />
      )}
      {toast && <Toast toast={toast} />}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-mark"><ShieldCheck size={24} strokeWidth={2.2} /></span>
      <span>VaultMedic</span>
    </div>
  );
}

function Landing({ onImport, onDemo, busy }: { onImport: () => void; onDemo: () => void; busy: string | null }) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <div className="trust-pills">
          <span><WifiOff size={14} /> Local processing</span>
          <span><LockKeyhole size={14} /> Zero telemetry</span>
          <span><GitFork size={14} /> Open source</span>
        </div>
      </header>

      <section className="landing-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse-dot" /> Your private password triage desk</div>
          <h1>Put every password on a <em>safer path.</em></h1>
          <p className="hero-lead">
            Open a browser password export, find what needs attention, and work through each rotation without
            uploading your vault or pretending every website can be automated.
          </p>
          <div className="hero-actions">
            <button className="button button-primary button-large" onClick={onImport} disabled={Boolean(busy)}>
              {busy === "import" ? <LoaderCircle className="spin" size={19} /> : <Upload size={19} />}
              Open password CSV locally
              <ArrowRight size={18} />
            </button>
            <button className="button button-quiet button-large" onClick={onDemo} disabled={Boolean(busy)}>
              {busy === "demo" ? <LoaderCircle className="spin" size={18} /> : <FlaskConical size={18} />}
              Explore safe demo
            </button>
          </div>
          <p className="microcopy"><EyeOff size={14} /> Passwords stay masked. The interface never receives your bulk CSV.</p>
        </div>

        <div className="intake-card-wrap">
          <div className="intake-card">
            <div className="intake-topline">
              <span className="status-chip"><span /> READY FOR LOCAL FILE</span>
              <FileKey size={20} />
            </div>
            <div className="drop-visual">
              <div className="file-stack file-back" />
              <div className="file-stack file-front">
                <Shield size={25} />
                <span>passwords.csv</span>
                <small>read once · memory only</small>
              </div>
            </div>
            <div className="intake-rule" />
            <div className="intake-facts">
              <div><Check size={15} /><span><strong>No upload endpoint</strong><small>Local desktop process</small></span></div>
              <div><Check size={15} /><span><strong>No credential logs</strong><small>Not even crash analytics</small></span></div>
              <div><Check size={15} /><span><strong>Prefix only breach checks</strong><small>HIBP privacy range model</small></span></div>
            </div>
          </div>
          <div className="card-caption"><ShieldCheck size={15} /> Designed for exports that should never touch a website</div>
        </div>
      </section>

      <section className="how-grid">
        <article><span>01</span><div><h3>Diagnose locally</h3><p>Surface weak, reused, and compromised passwords without sending the source file anywhere.</p></div></article>
        <article><span>02</span><div><h3>Rotate with context</h3><p>Open each site’s standard password change route and follow a realistic security checklist.</p></div></article>
        <article><span>03</span><div><h3>Move into a manager</h3><p>Generate unique replacements and explicitly export a compatible CSV when you are ready.</p></div></article>
      </section>

      <section className="threat-strip" id="threat-model">
        <div className="threat-title"><Fingerprint size={22} /><div><span>THREAT MODEL, UP FRONT</span><strong>What VaultMedic protects and what it cannot.</strong></div></div>
        <div className="threat-points">
          <p><CheckCircle2 size={17} /> Protects against accidental upload, credential analytics, and complete hash disclosure.</p>
          <p><AlertTriangle size={17} /> Cannot protect a device already controlled by malware, keyloggers, or another local user.</p>
          <p><Info size={17} /> JavaScript runtimes cannot guarantee forensic memory erasure; close the app after use.</p>
        </div>
      </section>
    </div>
  );
}

function Sidebar({
  view,
  setView,
  snapshot,
  onClear,
}: {
  view: View;
  setView: (view: View) => void;
  snapshot: VaultSnapshot;
  onClear: () => void;
}) {
  const links: Array<{ id: View; label: string; icon: ReactNode }> = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard size={18} /> },
    { id: "accounts", label: "Accounts", icon: <ListChecks size={18} /> },
    { id: "generator", label: "Generator", icon: <WandSparkles size={18} /> },
    { id: "threat-model", label: "Threat model", icon: <Shield size={18} /> },
  ];
  return (
    <aside className="sidebar">
      <Brand compact />
      <div className="local-seal"><span><WifiOff size={14} /> LOCAL SESSION</span><small>No cloud sync</small></div>
      <nav>
        <p className="nav-label">WORKSPACE</p>
        {links.map((link) => (
          <button key={link.id} className={view === link.id ? "nav-link active" : "nav-link"} onClick={() => setView(link.id)}>
            {link.icon}<span>{link.label}</span>
            {link.id === "accounts" && <b>{snapshot.stats.accounts}</b>}
          </button>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <div className="privacy-mini">
        <LockKeyhole size={17} />
        <div><strong>Secrets in memory</strong><small>Closing clears this session.</small></div>
      </div>
      <button className="nav-link lock-button" onClick={onClear}><LogOut size={17} /> Lock &amp; clear</button>
      <p className="version">VaultMedic v0.1.4 · MIT</p>
    </aside>
  );
}

function Topbar({ snapshot, onImport, busy }: { snapshot: VaultSnapshot; onImport: () => void; busy: boolean }) {
  return (
    <header className="topbar">
      <div>
        <span className="topbar-label">CURRENT SESSION</span>
        <strong>{snapshot.source?.fileName}</strong>
        {snapshot.source?.isDemo && <span className="demo-badge">SAFE DEMO</span>}
      </div>
      <div className="topbar-actions">
        <span className="memory-state"><span /> {snapshot.stats.accounts} accounts in memory</span>
        <button className="button button-quiet button-small" onClick={onImport} disabled={busy}>
          {busy ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />} Replace import
        </button>
      </div>
    </header>
  );
}

function Overview({
  snapshot,
  onSelect,
  onCheckAll,
  checking,
  breachProgress,
  onExport,
  onSnapshot,
  setToast,
}: {
  snapshot: VaultSnapshot;
  onSelect: (id: string) => void;
  onCheckAll: () => void;
  checking: boolean;
  breachProgress: { completed: number; total: number } | null;
  onExport: () => void;
  onSnapshot: (snapshot: VaultSnapshot) => void;
  setToast: (toast: ToastState) => void;
}) {
  const priority = [...snapshot.accounts]
    .sort((a, b) => riskRank(a.risk) - riskRank(b.risk) || b.findings.length - a.findings.length)
    .slice(0, 6);
  const trashSource = async () => {
    try {
      onSnapshot(await window.vaultMedic.trashSource());
      setToast({ message: "Source CSV moved to your system Trash.", tone: "success" });
    } catch (error) {
      setToast({ message: readableError(error), tone: "warning" });
    }
  };

  return (
    <div className="page-content">
      <div className="page-heading-row">
        <div><span className="eyebrow dark">PASSWORD HEALTH</span><h1>Your rotation plan</h1><p>Start with the accounts where one change removes the most risk.</p></div>
        <div className="heading-actions">
          <button className="button button-secondary" onClick={onCheckAll} disabled={checking}>
            {checking ? <LoaderCircle size={17} className="spin" /> : <ShieldAlert size={17} />}
            {checking && breachProgress ? `Checking ${breachProgress.completed}/${breachProgress.total}` : "Check with HIBP"}
          </button>
          <button className="button button-primary" onClick={onExport}><Download size={17} /> Export for manager</button>
        </div>
      </div>

      {snapshot.source && !snapshot.source.isDemo && !snapshot.source.sourceInTrash && (
        <div className="source-warning">
          <div className="warning-icon"><AlertTriangle size={18} /></div>
          <div><strong>Your original CSV is still readable on disk.</strong><span>Move it to Trash after you have a verified password manager import.</span></div>
          <button className="button button-warning" onClick={trashSource}><Trash2 size={16} /> Move source to Trash</button>
        </div>
      )}

      <div className="metrics-grid">
        <MetricCard tone="red" icon={<ShieldAlert size={20} />} label="Critical first" value={snapshot.stats.critical} note="compromised or very weak" />
        <MetricCard tone="orange" icon={<Repeat2 size={20} />} label="Password reuse" value={snapshot.stats.reused} note="accounts share a password" />
        <MetricCard tone="blue" icon={<KeyRound size={20} />} label="Weak passwords" value={snapshot.stats.weak} note="need a generated replacement" />
        <ProgressCard snapshot={snapshot} />
      </div>

      <div className="dashboard-grid">
        <section className="panel priority-panel">
          <div className="panel-heading"><div><span>TRIAGE QUEUE</span><h2>Highest priority accounts</h2></div><span className="privacy-note"><EyeOff size={14} /> Passwords masked</span></div>
          <div className="account-list">
            {priority.map((account) => <AccountRow key={account.id} account={account} onSelect={onSelect} />)}
          </div>
        </section>
        <section className="panel next-steps-panel">
          <div className="panel-heading"><div><span>SAFE WORKFLOW</span><h2>How to rotate</h2></div></div>
          <ol className="workflow-list">
            <li><span>1</span><div><strong>Generate a unique replacement</strong><p>Stage it in memory before opening the site.</p></div></li>
            <li><span>2</span><div><strong>Change it on the website</strong><p>VaultMedic opens the standard security route; you stay in control.</p></div></li>
            <li><span>3</span><div><strong>Add MFA or a passkey</strong><p>Prefer options that resist phishing where supported.</p></div></li>
            <li><span>4</span><div><strong>Save it in your manager</strong><p>Import the explicit export, verify it, then delete the CSV.</p></div></li>
          </ol>
          <div className="realism-note"><Info size={16} /><p><strong>No “rotate all” button.</strong> Sites use different forms, CAPTCHAs, MFA, and recovery rules. VaultMedic assists; it does not impersonate you.</p></div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ tone, icon, label, value, note }: { tone: string; icon: ReactNode; label: string; value: number; note: string }) {
  return <article className={`metric-card tone-${tone}`}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function ProgressCard({ snapshot }: { snapshot: VaultSnapshot }) {
  const style = { "--progress": `${snapshot.stats.completionPercent * 3.6}deg` } as CSSProperties;
  return (
    <article className="metric-card progress-card">
      <div className="progress-ring" style={style}><span>{snapshot.stats.completionPercent}%</span></div>
      <div><span>Rotation progress</span><strong>{snapshot.stats.secured}<small> / {snapshot.stats.accounts}</small></strong><small>accounts fully secured</small></div>
    </article>
  );
}

function AccountRow({ account, onSelect }: { account: AccountSummary; onSelect: (id: string) => void }) {
  return (
    <button className="account-row" onClick={() => onSelect(account.id)}>
      <SiteAvatar account={account} />
      <div className="account-identity"><strong>{account.name}</strong><span>{account.username || "No username"} · {account.hostname}</span></div>
      <div className="account-flags">
        {account.breachState === "exposed" && <span className="flag flag-red"><ShieldAlert size={13} /> Exposed</span>}
        {account.reusedCount > 1 && <span className="flag flag-orange"><Repeat2 size={13} /> Reused ×{account.reusedCount}</span>}
        {account.hasReplacement && <span className="flag flag-mint"><Sparkles size={13} /> Replacement ready</span>}
        {account.secured && <span className="flag flag-green"><CheckCircle2 size={13} /> Secured</span>}
        {!account.findings.length && !account.secured && <span className="flag flag-neutral">Looks strong</span>}
      </div>
      <div className="mini-progress"><span>{account.completedSteps}/4</span><div><i style={{ width: `${account.completedSteps * 25}%` }} /></div></div>
      <RiskBadge risk={account.risk} />
      <ChevronRight size={17} className="row-chevron" />
    </button>
  );
}

function SiteAvatar({ account }: { account: AccountSummary }) {
  const letter = (account.name || account.hostname || "?").charAt(0).toUpperCase();
  const color = [...account.hostname].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
  return <span className={`site-avatar avatar-${color}`}>{letter}</span>;
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const label = risk === "healthy" ? "Healthy" : risk.charAt(0).toUpperCase() + risk.slice(1);
  return <span className={`risk-badge risk-${risk}`}><span />{label}</span>;
}

function Accounts({ snapshot, onSelect }: { snapshot: VaultSnapshot; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "critical" | "reused" | "exposed" | "secured">("all");
  const filtered = useMemo(() => snapshot.accounts.filter((account) => {
    const matchesQuery = `${account.name} ${account.username} ${account.hostname}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" ||
      (filter === "critical" && account.risk === "critical") ||
      (filter === "reused" && account.reusedCount > 1) ||
      (filter === "exposed" && account.breachState === "exposed") ||
      (filter === "secured" && account.secured);
    return matchesQuery && matchesFilter;
  }), [snapshot.accounts, query, filter]);

  return (
    <div className="page-content">
      <div className="page-heading-row"><div><span className="eyebrow dark">ACCOUNT INVENTORY</span><h1>Every account, one plan</h1><p>Identifiers are shown so you can tell accounts apart; passwords stay masked.</p></div></div>
      <section className="panel accounts-panel">
        <div className="accounts-toolbar">
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search website or username" /></label>
          <div className="filter-tabs">
            {(["all", "critical", "reused", "exposed", "secured"] as const).map((item) => (
              <button key={item} onClick={() => setFilter(item)} className={filter === item ? "active" : ""}>{item}</button>
            ))}
          </div>
          <span className="result-count">{filtered.length} of {snapshot.stats.accounts}</span>
        </div>
        <div className="table-head"><span>Account</span><span>Findings</span><span>Checklist</span><span>Risk</span><span /></div>
        <div className="account-list account-list-full">
          {filtered.map((account) => <AccountRow key={account.id} account={account} onSelect={onSelect} />)}
          {filtered.length === 0 && <div className="empty-filter"><Search size={24} /><strong>No matching accounts</strong><span>Try another search or filter.</span></div>}
        </div>
      </section>
    </div>
  );
}

function GeneratorPanel({ setToast }: { setToast: (toast: ToastState) => void }) {
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [generated, setGenerated] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true);
    try {
      const result = await window.vaultMedic.generatePassword(options);
      setGenerated(result.value);
      setRevealed(false);
    } catch (error) {
      setToast({ message: readableError(error), tone: "warning" });
    } finally { setBusy(false); }
  };
  const copy = async () => {
    if (!generated) return;
    const result = await window.vaultMedic.copyGenerated(generated);
    setToast({ message: `Copied. Clipboard clears in ${result.clearsInSeconds} seconds.`, tone: "success" });
  };
  return (
    <div className="page-content generator-page">
      <div className="page-heading-row"><div><span className="eyebrow dark">CRYPTOGRAPHIC GENERATOR</span><h1>Make a password worth keeping</h1><p>Generated with the operating system’s cryptographic random source. Nothing is saved automatically.</p></div></div>
      <div className="generator-layout">
        <section className="panel generator-output-panel">
          <div className="generator-orbit"><div><KeyRound size={36} /></div></div>
          <span className="field-label">NEW PASSWORD</span>
          <div className="generated-output">
            <code>{generated ? (revealed ? generated : "•".repeat(Math.min(generated.length, 28))) : "Generate when ready"}</code>
            {generated && <button onClick={() => setRevealed(!revealed)} aria-label={revealed ? "Hide password" : "Reveal password"}>{revealed ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
          </div>
          <div className="strength-line"><span><ShieldCheck size={16} /> {generated ? "Strong, unique, and stored for this session only" : "No secret generated yet"}</span><div>{[0,1,2,3].map((bar) => <i className={generated ? "on" : ""} key={bar} />)}</div></div>
          <div className="generator-actions"><button className="button button-primary" onClick={generate} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{generated ? "Generate another" : "Generate password"}</button><button className="button button-secondary" onClick={copy} disabled={!generated}><Copy size={17} /> Copy for 45s</button></div>
          <p className="clipboard-warning"><Clipboard size={15} /> Other apps may read the clipboard. VaultMedic clears it if the value is still unchanged.</p>
        </section>
        <GeneratorControls options={options} setOptions={setOptions} />
      </div>
    </div>
  );
}

function GeneratorControls({ options, setOptions }: { options: PasswordOptions; setOptions: (options: PasswordOptions) => void }) {
  const toggles: Array<{ key: keyof PasswordOptions; label: string; sample: string }> = [
    { key: "lowercase", label: "Lowercase", sample: "a through z" },
    { key: "uppercase", label: "Uppercase", sample: "A through Z" },
    { key: "numbers", label: "Numbers", sample: "2 through 9" },
    { key: "symbols", label: "Symbols", sample: "!@#$" },
    { key: "avoidAmbiguous", label: "Avoid ambiguous", sample: "I l O 0" },
  ];
  return (
    <section className="panel generator-controls">
      <span className="panel-kicker">RECIPE</span><h2>Password settings</h2>
      <div className="length-control"><div><label htmlFor="length">Length</label><strong>{options.length}</strong></div><input id="length" type="range" min="12" max="64" value={options.length} onChange={(event) => setOptions({ ...options, length: Number(event.target.value) })} /><div className="range-labels"><span>12</span><span>64</span></div></div>
      <div className="toggle-list">
        {toggles.map((toggle) => <label key={toggle.key}><span><strong>{toggle.label}</strong><small>{toggle.sample}</small></span><input type="checkbox" checked={Boolean(options[toggle.key])} onChange={(event) => setOptions({ ...options, [toggle.key]: event.target.checked })} /><i /></label>)}
      </div>
      <div className="entropy-note"><Fingerprint size={18} /><div><strong>Uniform random selection</strong><p>Every enabled character is selected with a cryptographically secure random index.</p></div></div>
    </section>
  );
}

function ThreatModel() {
  return (
    <div className="page-content">
      <div className="page-heading-row"><div><span className="eyebrow dark">SECURITY BOUNDARIES</span><h1>Threat model</h1><p>A useful security tool should say exactly what it trusts.</p></div></div>
      <div className="threat-model-grid">
        <section className="panel threat-hero-panel"><div className="big-shield"><ShieldCheck size={42} /></div><span>CORE PROMISE</span><h2>Your imported passwords are never transmitted.</h2><p>CSV parsing, strength analysis, reuse matching, generation, and report creation happen inside the desktop app. There is no account system, telemetry SDK, advertising, or analytics endpoint.</p><div className="boundary-flow"><span>Your CSV</span><ArrowRight size={16} /><span>App memory</span><ArrowRight size={16} /><span>Findings</span></div></section>
        <section className="panel threat-list-panel"><span className="panel-kicker">IN SCOPE</span><h2>VaultMedic defends against</h2><ul className="check-list"><li><CheckCircle2 />Accidentally uploading a plaintext export to a web service</li><li><CheckCircle2 />Sending complete passwords or complete hashes during breach checks</li><li><CheckCircle2 />Credential values appearing in product analytics or application logs</li><li><CheckCircle2 />A compromised renderer directly reading the imported file</li><li><CheckCircle2 />Silent navigation to remote content inside the app window</li></ul></section>
        <section className="panel threat-list-panel danger"><span className="panel-kicker">OUT OF SCOPE</span><h2>VaultMedic cannot defend against</h2><ul className="check-list"><li><AlertTriangle />Malware, keyloggers, screen capture, or an already compromised operating system</li><li><AlertTriangle />Another local user who can read your original browser export</li><li><AlertTriangle />Software that monitors the clipboard after you explicitly copy a secret</li><li><AlertTriangle />A malicious or compromised website opened in your normal browser</li><li><AlertTriangle />Forensic recovery guarantees from a JavaScript runtime that manages memory automatically</li></ul></section>
        <section className="panel hibp-panel"><div className="hibp-prefix"><code>A94A8</code><span>ONLY THIS PREFIX LEAVES</span></div><div><span className="panel-kicker">PWNED PASSWORDS</span><h2>How the privacy range model works</h2><p>VaultMedic creates a SHA1 hash locally, sends only the first five hexadecimal characters, requests padded results, then compares suffixes in memory. HIBP never receives the complete password or complete hash.</p><div className="privacy-tags"><span>TLS only</span><span>Response padding</span><span>Manual action</span><span>Memory cache</span></div></div></section>
      </div>
    </div>
  );
}

function AccountDrawer({ account, onClose, onSnapshot, setToast }: { account: AccountSummary; onClose: () => void; onSnapshot: (snapshot: VaultSnapshot) => void; setToast: (toast: ToastState) => void }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [showGenerated, setShowGenerated] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setRevealed(null); setGenerated(null); setShowGenerated(false); setManual("");
  }, [account.id]);

  useEffect(() => {
    if (!revealed) return;
    const timeout = setTimeout(() => setRevealed(null), 10_000);
    return () => clearTimeout(timeout);
  }, [revealed]);

  const reveal = async () => {
    try { setRevealed((await window.vaultMedic.revealPassword(account.id)).value); }
    catch (error) { setToast({ message: readableError(error), tone: "warning" }); }
  };
  const copy = async () => {
    const result = await window.vaultMedic.copyPassword(account.id);
    setToast({ message: `Copied. Clipboard clears in ${result.clearsInSeconds} seconds.`, tone: "success" });
  };
  const generate = async () => {
    setBusy("generate");
    try {
      const result = await window.vaultMedic.generateForAccount(account.id, DEFAULT_OPTIONS);
      setGenerated(result.generated.value);
      setShowGenerated(false);
      onSnapshot(result.snapshot);
      setToast({ message: "Unique replacement staged in memory.", tone: "success" });
    } catch (error) { setToast({ message: readableError(error), tone: "warning" }); }
    finally { setBusy(null); }
  };
  const saveManual = async () => {
    setBusy("manual");
    try { onSnapshot(await window.vaultMedic.setReplacement(account.id, manual)); setManual(""); setToast({ message: "Replacement staged in memory.", tone: "success" }); }
    catch (error) { setToast({ message: readableError(error), tone: "warning" }); }
    finally { setBusy(null); }
  };
  const checkBreach = async () => {
    setBusy("breach");
    try { onSnapshot(await window.vaultMedic.checkAccountBreach(account.id)); }
    finally { setBusy(null); }
  };
  const update = async (patch: ChecklistPatch) => onSnapshot(await window.vaultMedic.updateChecklist(account.id, patch));
  const open = async (url: string | null) => { if (url) await window.vaultMedic.openExternal(url); };

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="account-drawer">
        <div className="drawer-header"><div className="drawer-account"><SiteAvatar account={account} /><div><span>{account.hostname}</span><h2>{account.name}</h2><p>{account.username || "No username"}</p></div></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
        <div className="drawer-scroll">
          <div className="drawer-risk"><RiskBadge risk={account.risk} /><span>{account.findings.length ? `${account.findings.length} findings need review` : "No password health findings"}</span><strong>{account.completedSteps}/4 steps</strong></div>

          <section className="drawer-section"><div className="section-title"><span>CURRENT SECRET</span>{account.hasReplacement && <b><Sparkles size={12} /> Replacement staged</b>}</div><div className="secret-field"><code>{revealed ?? "••••••••••••••••••"}</code><button onClick={reveal} title="Reveal for 10 seconds">{revealed ? <EyeOff size={17} /> : <Eye size={17} />}</button><button onClick={copy} title="Copy and clear in 45 seconds"><Copy size={17} /></button></div><p className="section-help">Reveal automatically hides after 10 seconds. Copy clears only if the clipboard is unchanged.</p></section>

          <section className="drawer-section"><div className="section-title"><span>FINDINGS</span><button className="text-button" onClick={checkBreach} disabled={busy === "breach"}>{busy === "breach" ? <LoaderCircle className="spin" size={14} /> : <ShieldAlert size={14} />} {account.breachState === "unknown" ? "Check breach data" : "Check again"}</button></div>{account.findings.length ? <div className="finding-list">{account.findings.map((finding, index) => <div className={`finding finding-${finding.severity}`} key={`${finding.code}-${index}`}><span>{finding.severity === "critical" ? <ShieldAlert size={16} /> : <AlertTriangle size={16} />}</span><div><strong>{finding.label}</strong><p>{finding.detail}</p></div></div>)}</div> : <div className="all-clear"><CheckCircle2 size={18} /><span><strong>No local weakness detected</strong><small>Run the breach check before treating it as clear.</small></span></div>}</section>

          <section className="drawer-section replacement-section"><div className="section-title"><span>UNIQUE REPLACEMENT</span></div><button className="button button-primary full-button" onClick={generate} disabled={Boolean(busy)}>{busy === "generate" ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} Generate &amp; stage 24 characters</button>{generated && <div className="generated-mini"><code>{showGenerated ? generated : "•".repeat(24)}</code><button onClick={() => setShowGenerated(!showGenerated)}>{showGenerated ? <EyeOff size={16} /> : <Eye size={16} />}</button><button onClick={() => void window.vaultMedic.copyGenerated(generated).then(() => setToast({ message: "Copied; clipboard clears in 45 seconds.", tone: "success" }))}><Copy size={16} /></button></div>}<div className="or-divider"><span>or enter your own</span></div><div className="manual-secret"><input type="password" value={manual} onChange={(event) => setManual(event.target.value)} placeholder="At least 12 characters" autoComplete="new-password" /><button onClick={saveManual} disabled={manual.length < 12 || Boolean(busy)}>Stage</button></div>{account.hasReplacement && <button className="discard-link" onClick={() => void window.vaultMedic.discardReplacement(account.id).then(onSnapshot)}>Discard staged replacement</button>}</section>

          <section className="drawer-section"><div className="section-title"><span>ROTATION CHECKLIST</span></div><div className="checklist"><ChecklistItem checked={account.checklist.passwordUpdated} onChange={(value) => update({ passwordUpdated: value })} title="Password changed on site" detail="Complete the site's own authentication flow." /><ChecklistItem checked={account.checklist.mfaReviewed} onChange={(value) => update({ mfaReviewed: value })} title="MFA reviewed" detail={account.mfaRecommendation} /><ChecklistItem checked={account.checklist.passkeyReviewed} onChange={(value) => update({ passkeyReviewed: value })} title={account.passkeyKnown ? "Passkey added or reviewed" : "Passkey support checked"} detail={account.passkeyRecommendation} /><ChecklistItem checked={account.checklist.managerUpdated} onChange={(value) => update({ managerUpdated: value })} title="Password manager updated" detail="Verify the new credential works before deleting exports." /></div></section>
        </div>
        <div className="drawer-footer"><button className="button button-secondary" onClick={() => open(account.websiteUrl)} disabled={!account.websiteUrl}><ExternalLink size={16} /> Open website</button><button className="button button-primary" onClick={() => open(account.changePasswordUrl)} disabled={!account.changePasswordUrl}><KeyRound size={16} /> Open password change page</button></div>
      </aside>
    </div>
  );
}

function ChecklistItem({ checked, onChange, title, detail }: { checked: boolean; onChange: (value: boolean) => void; title: string; detail: string }) {
  return <label className={checked ? "check-item checked" : "check-item"}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="custom-check">{checked ? <Check size={14} /> : <Circle size={14} />}</span><span><strong>{title}</strong><small>{detail}</small></span></label>;
}

function ExportDialog({ onClose, setToast, onSnapshot }: { onClose: () => void; setToast: (toast: ToastState) => void; onSnapshot: (snapshot: VaultSnapshot) => void }) {
  const [includeUnchanged, setIncludeUnchanged] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const exportPasswords = async () => {
    setBusy("passwords");
    try {
      const result = await window.vaultMedic.exportPasswordManagerCsv(includeUnchanged);
      if (!result.cancelled) { setToast({ message: `${result.fileName} saved. Import it, verify it, then delete it.`, tone: "warning" }); onClose(); }
    } catch (error) { setToast({ message: readableError(error), tone: "warning" }); }
    finally { setBusy(null); }
  };
  const exportReport = async () => {
    setBusy("report");
    try { const result = await window.vaultMedic.exportSecurityReport(); if (!result.cancelled) setToast({ message: `${result.fileName} saved without passwords.`, tone: "success" }); }
    finally { setBusy(null); }
  };
  return (
    <div className="modal-backdrop"><div className="export-modal"><button className="modal-close icon-button" onClick={onClose}><X size={20} /></button><div className="modal-icon"><Download size={25} /></div><span className="panel-kicker">EXPLICIT EXPORT</span><h2>Move your results safely</h2><p>Choose the artifact you need. VaultMedic never exports in the background.</p><div className="export-choice danger-choice"><div><FileKey size={22} /><span><strong>Password manager CSV</strong><small>Compatible columns: name, URL, username, password, note.</small></span></div><label><input type="checkbox" checked={includeUnchanged} onChange={(event) => setIncludeUnchanged(event.target.checked)} /><i /> Include unchanged imported passwords</label><div className="export-warning"><AlertTriangle size={16} /><span>This file contains readable passwords. Import it immediately, verify the result, then delete it.</span></div><button className="button button-primary full-button" onClick={exportPasswords} disabled={Boolean(busy)}>{busy === "passwords" ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />} Save plaintext CSV</button></div><div className="export-choice"><div><FileJson size={22} /><span><strong>Password free security report</strong><small>Findings and checklist progress only. Safe to keep for your records.</small></span></div><button className="button button-secondary full-button" onClick={exportReport} disabled={Boolean(busy)}>{busy === "report" ? <LoaderCircle className="spin" size={17} /> : <FileJson size={17} />} Save JSON report</button></div><button className="text-button modal-cancel" onClick={onClose}>Cancel</button></div></div>
  );
}

function Toast({ toast }: { toast: NonNullable<ToastState> }) {
  return <div className={`toast ${toast.tone === "warning" ? "toast-warning" : ""}`}>{toast.tone === "warning" ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}<span>{toast.message}</span></div>;
}

function riskRank(risk: RiskLevel): number {
  return { critical: 0, high: 1, medium: 2, healthy: 3 }[risk];
}

export default App;
