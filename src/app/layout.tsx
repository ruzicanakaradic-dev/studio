import type { Metadata, Viewport } from "next";
import { Playfair_Display, Archivo, Cormorant_Garamond, Lora, Karla } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Ružini domaći kolači — Studio",
  description: "Studio za kreiranje Instagram i TikTok objava, story, reels i carousela.",
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
      className={`${archivo.variable} ${playfair.variable} ${cormorant.variable} ${lora.variable} ${karla.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
