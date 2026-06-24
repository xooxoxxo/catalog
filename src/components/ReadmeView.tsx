import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Repo } from "../types";

export function ReadmeView({ repo }: { repo: Repo }) {
  const [md, setMd] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setMd(null); setErr(false);
    invoke<string>("gh_readme", { owner: repo.owner, repo: repo.name }).then(setMd).catch(() => setErr(true));
  }, [repo.full_name]);

  const open = (url?: string) => { if (url) invoke("open_url", { url }).catch(() => {}); };

  if (err) return <p className="status">No README found for this repo.</p>;
  if (md === null) return <p className="status">Loading README…</p>;
  return (
    <div className="readme-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ href, children }) => <a href={href} onClick={(e) => { e.preventDefault(); open(href); }}>{children}</a> }}
      >{md}</ReactMarkdown>
    </div>
  );
}
