export interface Item {
  id: string;
  name: string;
  source: string;
  source_detail: string | null;
  version: string | null;
  exec_path: string | null;
  homepage: string | null;
  raw_desc: string | null;
  installed_on_request: boolean | null;
}

export interface Enrichment {
  alias: string;
  description: string;
  tags: string[];
  favorite: boolean;
  hidden: boolean;
  notes: string;
  llm_confirmed: boolean;
}

export interface EnrichedItem {
  id: string;
  name: string;
  source: string;
  source_detail: string | null;
  version: string | null;
  exec_path: string | null;
  homepage: string | null;
  raw_desc: string | null;
  installed_on_request: boolean | null;
  display_name: string;
  description: string | null;
  tags: string[];
  favorite: boolean;
  hidden: boolean;
  notes: string;
  llm_confirmed: boolean;
  has_enrichment: boolean;
}

export interface Suggestion {
  description: string;
  tags: string[];
}

export interface Provider {
  command: string;
  args: string[];
  stdin: boolean;
  requires_online: boolean;
}

export interface Config {
  active: string;
  providers: Record<string, Provider>;
  github_client_id: string;
  active_theme: string;
  nvd_api_key: string;
}

export interface Update {
  id: string;
  current: string;
  latest: string;
}

export interface Shadow { name: string; winner: string; shadowed_by: string[] }
export interface BrokenLink { path: string; target: string }
export interface DoctorReport { shadowed: Shadow[]; broken_symlinks: BrokenLink[]; bad_path_dirs: string[] }

export interface UpdateProgress { source: string; status: "checking" | "done"; count: number }

export interface DiskInfo {
  id: string;
  size_bytes: number | null;
  last_used: string | null;
  removable: boolean;
  reason: string | null;
}

export interface DiskProgress { done: number; total: number }

export interface ExportFile { name: string; content: string; executable: boolean }

export interface VulnInfo { id: string; aliases: string[]; summary: string; severity: string; fixed: string | null; url: string }
export interface SecurityFinding { item_id: string; package: string; version: string; ecosystem: string; vulns: VulnInfo[] }
export interface SecurityProgress { done: number; total: number }
export interface NvdProgress { done: number; total: number }

export interface Dep { name: string; present: boolean; powers: string; install: string }

export interface DeviceCode { device_code: string; user_code: string; verification_uri: string; interval: number }
export interface GithubStatus { connected: boolean; login: string | null; avatar_url: string | null }

export interface Repo { full_name: string; name: string; owner: string; description: string | null; language: string | null; stars: number; html_url: string }
