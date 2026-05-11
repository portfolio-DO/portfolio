import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "MaturAI — Twoja Platforma Maturalna Premium",
  description:
    "Przygotuj się do matury z AI. Ocenianie rozprawek jak egzaminator CKE, zadania matematyczne i notatki syntetyzujące.",
  keywords: ["matura", "AI", "rozprawka", "matematyka", "CKE", "egzamin"],
  authors: [{ name: "MaturAI" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1a2235",
              color: "#e8edf5",
              border: "1px solid #2a3d5c",
              borderRadius: "10px",
              fontSize: "14px",
              fontFamily: "'DM Sans', sans-serif",
            },
            success: {
              iconTheme: { primary: "#10b981", secondary: "#1a2235" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#1a2235" },
            },
          }}
        />
      </body>
    </html>
  );
}
