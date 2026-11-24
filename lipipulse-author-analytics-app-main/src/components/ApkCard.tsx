"use client";

import { motion } from "framer-motion";
import { Terminal, GitBranch, Package, Smartphone } from "lucide-react";
import { Card } from "@/components/ui";

const STEPS = [
  {
    icon: GitBranch,
    title: "1 · GitHub वर code टाका",
    lines: [
      "github.com वर नवीन repository बनवा (Public, उदा. lipipulse)",
      "हा project त्यामध्ये push करा — upload ZIP पण चालेल",
      "repo → Actions tab उघडा",
    ],
  },
  {
    icon: Terminal,
    title: "2 · GitHub Actions APK build करेल",
    lines: [
      "Actions → “Build Android APK” workflow निवडा",
      "“Run workflow” दाबा (पहिल्या push वर आपोआप चालेल)",
      "सुमारे 6–10 मिनिटं लागतात — Java + Android SDK server वरच",
    ],
  },
  {
    icon: Package,
    title: "3 · APK download करा",
    lines: [
      "पूर्ण झाल्यावर त्या run खाली “Artifacts” दिसेल",
      "lipipulse-apk वर टॅप करा → ZIP download होईल",
      "ZIP उघडा → आत app-debug.apk आहे",
    ],
  },
  {
    icon: Smartphone,
    title: "4 · फोनवर install करा",
    lines: [
      "APK फोनमध्ये पाठवा (WhatsApp/Drive) किंवा फोनवरच download करा",
      "APK वर टॅप करा → “Install unknown app” allow करा",
      "Install → LipiPulse icon home screenवर — खरंच offline app",
    ],
  },
];

export default function ApkCard() {
  return (
    <>
      <Card i={0} className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-pill text-ink">
            <Smartphone size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold">Real APK — via GitHub Actions</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
              GitHub वर push केल्यावर GitHub चा server आपोआप <span className="font-medium text-ink">Capacitor + Gradle</span> ने APK बनवेल. तुम्हाला PC,
              Android Studio किंवा Flutter हवंच नाही — फक्त GitHub account.
            </p>
          </div>
        </div>

        <div className="mt-3.5 space-y-2.5">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.06 * i }}
                className="rounded-[16px] bg-pill p-3"
              >
                <p className="flex items-center gap-2 text-[13px] font-semibold">
                  <Icon size={13} className="shrink-0 text-accent" />
                  {s.title}
                </p>
                <ul className="mt-1.5 space-y-1 pl-[21px]">
                  {s.lines.map((l) => (
                    <li key={l} className="list-disc text-[12px] leading-snug text-muted marker:text-[#C9C9C4]">
                      {l}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-3 rounded-[14px] bg-warn px-3 py-2.5 text-[11.5px] leading-relaxed text-warnink">
          APK मध्ये Gemini स्कॅन तुमच्या स्वतःच्या API key ने <b>फोनवरच</b> होतो — server लागत नाही. Install केल्यावर Insights → Gemini vision मध्ये key
          paste करा. Key शिवाय स्कॅन offline demo दाखवेल.
        </p>
      </Card>
    </>
  );
}
