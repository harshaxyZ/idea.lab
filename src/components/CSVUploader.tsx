"use client";

import { useState, useRef } from "react";
import { auth } from "@/lib/firebase";
import { parseCSV, CSVRow } from "@/lib/csvParser";
import { Upload, FileText, AlertTriangle, CheckCircle2, X } from "lucide-react";

interface CSVUploaderProps {
  onUploadComplete: () => void;
}

export default function CSVUploader({ onUploadComplete }: CSVUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<CSVRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([]);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parseCSV(text);
      setPreview(result.rows);
      setParseErrors(result.errors);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!preview || preview.length === 0) return;
    setIsUploading(true);
    setUploadResult(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const idToken = await user.getIdToken(true);

      const res = await fetch("/api/admin/upload-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          students: preview.map((row) => ({
            usn: row.usn,
            name: row.name,
            email: row.email,
            phone: row.phone,
            branch: row.branch,
            section: row.section,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setUploadResult({ success: true, message: `Successfully imported ${preview.length} students.` });
      setPreview(null);
      setParseErrors([]);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      onUploadComplete();
    } catch (err) {
      setUploadResult({ success: false, message: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setParseErrors([]);
    setFileName("");
    setUploadResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* File Input */}
      <div
        style={{
          border: "1.5px dashed var(--line)",
          padding: "32px",
          textAlign: "center",
          cursor: "pointer",
          transition: "border-color 0.2s",
        }}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const file = e.dataTransfer.files[0];
          if (file && fileRef.current) {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileRef.current.files = dt.files;
            fileRef.current.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }}
      >
        <Upload style={{ width: 32, height: 32, color: "var(--muted)", margin: "0 auto 12px" }} />
        <p style={{ fontWeight: 700, fontSize: "13px", color: "var(--ink)", marginBottom: "4px" }}>
          {fileName || "Click or drag CSV file here"}
        </p>
        <p style={{ fontSize: "11px", color: "var(--muted)" }}>
          Required columns: Name, USN, Mobile, Email — Branch &amp; Section auto-derived from USN
        </p>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileChange} style={{ display: "none" }} />
      </div>

      {/* Parse Errors */}
      {parseErrors.length > 0 && (
        <div style={{ padding: "16px", border: "1.5px solid var(--red)", background: "rgba(232, 52, 26, 0.06)" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--red)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <AlertTriangle style={{ width: 14, height: 14 }} /> Parse Errors ({parseErrors.length})
          </p>
          <div style={{ maxHeight: "150px", overflow: "auto" }}>
            {parseErrors.map((err, i) => (
              <p key={i} style={{ fontSize: "12px", color: "var(--red)", padding: "2px 0" }}>
                Row {err.row}: {err.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>
              <FileText style={{ width: 12, height: 12, display: "inline", marginRight: "4px" }} />
              Preview ({preview.length} rows)
            </p>
            <button onClick={handleClear} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "10px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
              <X style={{ width: 12, height: 12 }} /> Clear
            </button>
          </div>

          <div style={{ overflow: "auto", maxHeight: "300px", border: "1.5px solid var(--ink)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--paper2)", borderBottom: "1.5px solid var(--ink)" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Name</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>USN</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Mobile</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Email</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Branch</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((row, i) => (
                  <tr key={row.usn} style={{ borderBottom: "1px solid var(--line)", background: i % 2 === 0 ? "var(--paper)" : "var(--paper2)" }}>
                    <td style={{ padding: "6px 12px" }}>{row.name}</td>
                    <td style={{ padding: "6px 12px", fontFamily: "monospace", fontSize: "11px" }}>{row.usn}</td>
                    <td style={{ padding: "6px 12px", fontSize: "11px" }}>{row.phone}</td>
                    <td style={{ padding: "6px 12px", fontSize: "11px" }}>{row.email}</td>
                    <td style={{ padding: "6px 12px" }}>{row.branch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 50 && (
            <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px", textAlign: "center" }}>
              Showing first 50 of {preview.length} rows
            </p>
          )}

          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="btn-primary w-full"
            style={{ marginTop: "16px", padding: "14px" }}
          >
            {isUploading ? <><div className="spinner" /> Uploading...</> : `Upload ${preview.length} Students`}
          </button>
        </div>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <div style={{
          padding: "14px 16px", fontSize: "12px", fontWeight: 600,
          background: uploadResult.success ? "rgba(16, 185, 129, 0.08)" : "rgba(232, 52, 26, 0.08)",
          color: uploadResult.success ? "#059669" : "var(--red)",
          border: `1.5px solid ${uploadResult.success ? "#059669" : "var(--red)"}`,
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          {uploadResult.success ? <CheckCircle2 style={{ width: 16, height: 16 }} /> : <AlertTriangle style={{ width: 16, height: 16 }} />}
          {uploadResult.message}
        </div>
      )}
    </div>
  );
}
