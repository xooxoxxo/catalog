import { useEffect, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { GithubLogo, Heart, FileText, ArrowSquareOut } from "@phosphor-icons/react";

const REPO = "https://github.com/xooxoxxo/catalog";
const KOFI = "https://ko-fi.com/xovision";

export function About() {
  const [version, setVersion] = useState("");
  useEffect(() => { getVersion().then(setVersion).catch(() => {}); }, []);
  const open = (url: string) => invoke("open_url", { url }).catch(() => {});

  const link = (url: string, icon: ReactNode, label: string) => (
    <button className="about-link" onClick={() => open(url)}>
      {icon}<span>{label}</span><ArrowSquareOut size={12} weight="bold" />
    </button>
  );

  return (
    <div className="about">
      <div className="about-head">
        <span className="about-name">catalog{version && <span className="about-ver mono"> v{version}</span>}</span>
        <span className="about-by">by <button className="about-org" onClick={() => open("https://xo.vision")}>XO Vision</button></span>
      </div>
      <div className="about-links">
        {link(REPO, <GithubLogo size={15} />, "Repository")}
        {link(`${REPO}/blob/main/LICENSE`, <FileText size={15} />, "MIT License")}
        {link(KOFI, <Heart size={15} weight="fill" />, "Support on Ko-fi")}
      </div>
    </div>
  );
}
