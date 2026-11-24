"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Download, Share, Smartphone } from "lucide-react";
import { Button, Card, SectionTitle } from "@/components/ui";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Registers the offline service worker once per page load. */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  // Inside the Capacitor APK there is no service worker — data is already fully local.
  if ((window as unknown as { Capacitor?: unknown }).Capacitor) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    /* offline shell unavailable — app still works online */
  });
}

type Platform = "android" | "ios" | "desktop";

export default function InstallCard() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("android");

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) setPlatform("ios");
    else if (/android/i.test(ua)) setPlatform("android");
    else setPlatform("desktop");

    if (window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } finally {
      setDeferred(null);
    }
  }

  const steps: Record<Platform, { title: string; lines: string[] }> = {
    android: {
      title: "Android · Chrome",
      lines: [
        "Chrome मध्ये ही page उघडा",
        "वरच्या मेनूवर ⋮ टॅप करा",
        "“Install app” किंवा “Add to Home screen” निवडा",
        "“Install” → icon Home screenवर दिसेल",
      ],
    },
    ios: {
      title: "iPhone · Safari",
      lines: [
        "Safari मध्ये ही page उघडा",
        "खालच्या Share बटणावर (↑) टॅप करा",
        "खाली सरकवून “Add to Home Screen” निवडा",
        "“Add” → app icon मिळेल",
      ],
    },
    desktop: {
      title: "Desktop · Chrome / Edge",
      lines: [
        "Address barच्या जवळ install icon (⬇) क्लिक करा",
        "किंवा⋮ मेनू → “Install LipiPulse”",
        "Install → dock / start menuमध्ये app स्वतंत्र उघडेल",
      ],
    },
  };

  const guide = steps[platform];

  return (
    <>
      <SectionTitle>Install on phone</SectionTitle>
      <Card i={0} className="p-4">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] ${
              installed ? "bg-posbg text-pos" : "bg-[#EDEDFF] text-accent"
            }`}
          >
            {installed ? <Check size={18} strokeWidth={2.6} /> : <Smartphone size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold">
              {installed ? "LipiPulse installed" : "LipiPulse is a PWA — no APK needed"}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
              {installed
                ? "Full-screen app, offline database, share-sheet import from Pratilipi."
                : "Install it like an app: full-screen, home-screen icon, works offline. Data stays in this device."}
            </p>
          </div>
        </div>

        {!installed && (
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" onClick={() => void install()} disabled={!deferred}>
              <Download size={15} className="mr-2 inline" />
              {deferred ? "Install now" : "Use browser menu below"}
            </Button>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-3.5 rounded-[16px] bg-pill p-3.5"
        >
          <p className="eyebrow flex items-center gap-1.5">
            <Share size={11} /> {guide.title}
          </p>
          <ol className="mt-2 space-y-1.5">
            {guide.lines.map((line, i) => (
              <li key={i} className="flex gap-2.5 text-[12.5px] leading-snug text-ink">
                <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface text-[10px] font-bold tnum text-accent">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">{line}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-hair pt-2.5 text-[11px] leading-relaxed text-muted">
            Install केल्यावर address bar दिसणार नाही — खरंच app सारखं उघडेल आणि internet नसतानाही तुमचं offline database उपलब्ध राहील.
          </p>
        </motion.div>
      </Card>
    </>
  );
}
