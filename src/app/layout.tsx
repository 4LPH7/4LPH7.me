// biome-ignore-all lint/security/noDangerouslySetInnerHtml: JSON-LD needs script text; its code-owned schema is serialized with less-than signs escaped.
import type { Metadata } from "next";
import "./globals.css";
import "./site.css";
import "./site-sections.css";
import "./site-widgets.css";
import { PageLoader } from "@/components/site/PageLoader";
import { SmoothScroll } from "@/components/site/SmoothScroll";
import { TitleScramble } from "@/components/site/TitleScramble";
import { themeInitScript } from "@/lib/theme";
import { fontVariables } from "./fonts";

export const metadata: Metadata = {
  metadataBase: new URL("https://4lph7.me"),
  title: "4LPH7",
  description: "Portfolio of Arul G (4LPH7), a Coimbatore-based early-career full-stack developer exploring data, AI, fintech, and practical software.",
  alternates: {
    canonical: "/",
    types: {
      "application/ld+json": "/schema.json",
    },
  },
  openGraph: {
    type: "website",
    url: "https://4lph7.me",
    title: "ARUL G / 4LPH7",
    description: "Application security, cryptography, and practical software.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "4LPH7 engineering portfolio" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  icons: { icon: "/favicon.svg", apple: "/splash.png" },
};

const schema = {
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "ARUL G",
  "jobTitle": "Software Engineer",
  "knowsAbout": ["Application Security", "Cryptography", "Data Science"],
  "url": "https://4lph7.me",
  "sameAs": ["https://github.com/4LPH7"],
};
const schemaJson = JSON.stringify(schema).replace(/</g, "\\u003c");

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fontVariables} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="canonical" href="https://4lph7.me/" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: schemaJson }}
        />
      </head>
      <body>
        <PageLoader />
        <noscript><style>{".page-loader{display:none}"}</style></noscript>
        <a className="skip-link" href="#main">Skip to content</a>
        <SmoothScroll />
        <TitleScramble />
        {children}
      </body>
    </html>
  );
}
