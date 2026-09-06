"use client";

import { useEffect, useMemo, useState } from "react";

type Props = { botPublicUrl?: string };

export default function SalaarEmbed({ botPublicUrl }: Props) {
  const [open, setOpen] = useState(false);

  const bot = useMemo(() => {
    if (!botPublicUrl) return null;
    try {
      const url = new URL(botPublicUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return { origin: url.origin, src: `${url.href.replace(/\/$/, "")}/embed` };
    } catch {
      return null;
    }
  }, [botPublicUrl]);

  useEffect(() => {
    if (!bot) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== bot.origin) return;
      if (event.data?.type !== "primehub-salaar-resize") return;
      setOpen(Boolean(event.data.open));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [bot]);

  if (!bot) return null;

  return (
    <iframe
      src={bot.src}
      title="Salaar · PrimeHubMaal help"
      className="fixed bottom-0 right-0 z-[90] border-0 bg-transparent transition-[width,height] duration-200"
      style={{
        width: open ? "min(440px, 100vw)" : "190px",
        height: open ? "min(760px, 100vh)" : "92px",
      }}
      sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      allow="clipboard-write"
    />
  );
}
