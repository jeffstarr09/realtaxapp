"use client";
import { useState } from "react";

export default function Home() {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSummary(null);
    if (!files.length) return setError("Select at least one statement.");
    setBusy(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const res = await fetch("/api/unify", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.text()) || "Server error");
      const total = res.headers.get("X-Tx-Count");
      const ded = res.headers.get("X-Deductible-Count");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "realtax-unified.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      setSummary({ total, ded });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 32, marginBottom: 4 }}>RealTax</h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>
        Upload statements (PDF or CSV) from Chase, Bank of America, Amex, Wells Fargo, Citi, or Discover.
        We&apos;ll combine them into one Excel file and flag likely real-estate-agent business deductions.
      </p>
      <form onSubmit={onSubmit} style={{ marginTop: 24, padding: 24, background: "#141a32", borderRadius: 12 }}>
        <input
          type="file"
          multiple
          accept=".pdf,.csv"
          onChange={(e) => setFiles(Array.from(e.target.files))}
          style={{ display: "block", marginBottom: 16, color: "#e8ecf1" }}
        />
        {files.length > 0 && (
          <ul style={{ fontSize: 13, opacity: 0.8 }}>
            {files.map((f, i) => (
              <li key={i}>{f.name} ({Math.round(f.size / 1024)} KB)</li>
            ))}
          </ul>
        )}
        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: 8, padding: "10px 18px", background: "#4f8cff",
            color: "white", border: 0, borderRadius: 8, cursor: "pointer", fontWeight: 600,
          }}
        >
          {busy ? "Processing…" : "Unify & Download Excel"}
        </button>
        {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}
        {summary && (
          <p style={{ marginTop: 16, opacity: 0.85 }}>
            Done — {summary.total} transactions, {summary.ded} flagged as likely deductible.
          </p>
        )}
      </form>
      <details style={{ marginTop: 24, opacity: 0.8 }}>
        <summary>How flagging works</summary>
        <p>
          Rule-based: each transaction is matched against keyword lists for real-estate-agent business
          categories (MLS/dues, marketing, auto/fuel, software, education, client gifts, meals, office,
          phone/internet, travel). Because cards are mixed personal/business, we mark ambiguous items
          as &ldquo;Review&rdquo; rather than auto-deductible. The Excel file shows category, confidence, and reason.
        </p>
      </details>
    </main>
  );
}
