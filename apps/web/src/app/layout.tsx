import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Cormorant_SC, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/Toast";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});
const cormorantSC = Cormorant_SC({ variable: "--font-cormorant-sc", subsets: ["latin"], weight: ["600"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://cantos.psjb.org.br"),
  title: {
    default: "Cantos · Paróquia Catedral São João Batista",
    template: "%s · Cantos PSJB",
  },
  description:
    "Repertório litúrgico da Catedral São João Batista: letras, cifras, partituras e áudios. Monte sua missa e use no tablet.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF6EE" },
    { media: "(prefers-color-scheme: dark)", color: "#1D2420" },
  ],
};

// Aplica o tema antes da pintura para evitar "flash" de tema errado.
const themeScript = `try{var p=JSON.parse(localStorage.getItem('psjb:prefs')||'{}').theme||'light';if(p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${cormorant.variable} ${cormorantSC.variable} ${inter.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
