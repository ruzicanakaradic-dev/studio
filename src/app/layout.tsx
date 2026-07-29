import type { Metadata, Viewport } from "next";
import {
  Playfair_Display,
  Archivo,
  Cormorant_Garamond,
  Lora,
  Karla,
  Fraunces,
  EB_Garamond,
  DM_Serif_Display,
  Marcellus,
  Inter,
  Work_Sans,
  Nunito,
  Dancing_Script,
} from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-archivo",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});
const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  variable: "--font-cormorant",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
const lora = Lora({
  subsets: ["latin", "latin-ext"],
  variable: "--font-lora",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
const karla = Karla({
  subsets: ["latin", "latin-ext"],
  variable: "--font-karla",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});
const fraunces = Fraunces({ subsets: ["latin", "latin-ext"], variable: "--font-fraunces", display: "swap", weight: ["400", "500", "600", "700"] });
const ebgaramond = EB_Garamond({ subsets: ["latin", "latin-ext"], variable: "--font-ebgaramond", display: "swap", weight: ["400", "500", "600", "700"] });
const dmserif = DM_Serif_Display({ subsets: ["latin", "latin-ext"], variable: "--font-dmserif", display: "swap", weight: ["400"] });
const marcellus = Marcellus({ subsets: ["latin", "latin-ext"], variable: "--font-marcellus", display: "swap", weight: ["400"] });
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });
const worksans = Work_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-worksans", display: "swap", weight: ["400", "500", "600", "700"] });
const nunito = Nunito({ subsets: ["latin", "latin-ext"], variable: "--font-nunito", display: "swap", weight: ["400", "600", "700", "800"] });
const dancing = Dancing_Script({ subsets: ["latin", "latin-ext"], variable: "--font-dancing", display: "swap", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Ružini domaći kolači — Studio",
  description: "Studio za kreiranje Instagram i TikTok objava, story, reels i carousela.",
  applicationName: "RDK Studio",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "RDK Studio",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#63347A",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="sr"
      className={[
        archivo.variable,
        playfair.variable,
        cormorant.variable,
        lora.variable,
        karla.variable,
        fraunces.variable,
        ebgaramond.variable,
        dmserif.variable,
        marcellus.variable,
        inter.variable,
        worksans.variable,
        nunito.variable,
        dancing.variable,
      ].join(" ")}
    >
      <body>{children}</body>
    </html>
  );
}
