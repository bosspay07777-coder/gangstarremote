import "./globals.css";
export const metadata = { title: "GangstarRemote — Vibe Coding", description: "Construa apps conversando com um agente de IA" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{__html:`try{if(localStorage.theme==='light')document.documentElement.classList.replace('dark','light')}catch(e){}`}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
