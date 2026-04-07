export const metadata = { title: "RealTax — Unified Statements" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#0b1020", color: "#e8ecf1" }}>
        {children}
      </body>
    </html>
  );
}
