'use client';

import React, { useState } from "react";
import { Upload, FileSpreadsheet, X, AlertCircle, Loader2, Check } from "lucide-react";

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export function CSVImportModal({ isOpen, onClose, onImportSuccess }: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<string[][]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError("Please select a valid .csv file.");
      setFile(null);
      setFileContent(null);
      return;
    }

    setError(null);
    setFile(selectedFile);
    setResult(null);
    setShowResult(false);

    try {
      // Read the file content once and store it
      const text = await selectedFile.text();
      setFileContent(text);
      
      const lines = text
        .split(/\r\n|\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length < 2) {
        setError("CSV file must contain a header row and at least one data row.");
        return;
      }

      const headerRow = lines[0].split(",").map((h) => h.trim());
      setHeaders(headerRow);

      const previewRows = lines.slice(1, 4).map((line) =>
        line.split(",").map((v) => v.trim())
      );
      setPreview(previewRows);

    } catch (err) {
      setError("Failed to read file. Please make sure it's a valid CSV.");
      setFile(null);
      setFileContent(null);
    }
  };

  const handleImport = async () => {
    if (!file || !fileContent) {
      setError("No file to import. Please select a CSV file first.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);
    setShowResult(false);

    try {
      // Create a new File object from the stored content
      const blob = new Blob([fileContent], { type: 'text/csv' });
      const newFile = new File([blob], file.name, { type: 'text/csv' });

      const formData = new FormData();
      formData.append("file", newFile);

      const response = await fetch("/api/import/csv", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Import failed");
      }

      setResult(result);
      setShowResult(true);

      // Build summary message
      let message = `✅ Import successful!\n\n`;
      message += `📊 ${result.imported} weight records imported\n`;
      message += `📝 ${result.totalRows} rows processed\n`;
      message += `🌱 ${result.plantsUpdated || 0} plants updated with latest weight\n\n`;
      message += `🌱 Plant Mapping:\n`;
      
      if (result.columnMapping) {
        result.columnMapping.forEach((col: any) => {
          const statusIcon = col.status === 'matched' ? '✅' : '🌱';
          const statusText = col.status === 'matched' 
            ? `→ ${col.matchedPlant}` 
            : `→ NEW: "${col.plantName}" created`;
          message += `  ${statusIcon} "${col.column}" ${statusText}\n`;
        });
      }

      if (result.errors && result.errors.length > 0) {
        message += `\n⚠️ ${result.errors.length} rows had errors (skipped)`;
      }

      alert(message);

      // Force a full page reload to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 500);

      onImportSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to import CSV.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModalClose = () => {
    setFile(null);
    setFileContent(null);
    setHeaders([]);
    setPreview([]);
    setError(null);
    setResult(null);
    setShowResult(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl transition-all max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-canopy/10 text-canopy dark:bg-emerald-500/10 dark:text-emerald-400">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-graphite dark:text-zinc-100">
                Import Data
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Upload CSV with weight data
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Upload Dropzone */}
        <div className="mt-6">
          <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer border-zinc-300 dark:border-zinc-700 hover:border-canopy dark:hover:border-emerald-500 bg-mist/30 dark:bg-zinc-800/40 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
              <Upload className="size-8 mb-2 text-zinc-400 dark:text-zinc-500" />
              {file ? (
                <p className="text-sm font-bold text-canopy dark:text-emerald-400 truncate max-w-xs">
                  {file.name}
                </p>
              ) : (
                <>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 font-semibold">
                    Click to select CSV file
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                    Columns with "lb" or "weight" become plants
                  </p>
                </>
              )}
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          {error && (
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-rose-500">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Preview */}
        {preview.length > 0 && !showResult && (
          <div className="mt-6 border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <h4 className="text-sm font-semibold text-graphite dark:text-zinc-200 mb-2">
              Preview (first 3 rows)
            </h4>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr>
                    {headers.map((h, i) => {
                      const isWeight = h.toLowerCase().includes('lb') || h.toLowerCase().includes('weight');
                      return (
                        <th
                          key={i}
                          className={`px-3 py-2 text-left font-medium whitespace-nowrap ${
                            isWeight ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {h}
                          {isWeight && ' 🌱'}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr
                      key={i}
                      className="border-t border-zinc-100 dark:border-zinc-800"
                    >
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="px-3 py-2 text-zinc-700 dark:text-zinc-300"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              💡 Columns marked with 🌱 will be imported as separate plants
            </p>
          </div>
        )}

        {/* Import Summary */}
        {showResult && result && (
          <div className="mt-6 border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Check className="size-4" />
                <span className="font-semibold">Import Complete</span>
              </div>
              <div className="mt-2 text-sm space-y-1 text-emerald-600 dark:text-emerald-300">
                <p>📊 {result.imported} weight records imported</p>
                <p>🌱 {result.plantsUpdated || 0} plants updated with latest weight</p>
                {result.columnMapping && (
                  <div className="mt-2 text-xs space-y-1">
                    {result.columnMapping.map((col: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <span>{col.status === 'matched' ? '✅' : '🌱'}</span>
                        <span>"{col.column}" → {col.status === 'matched' ? col.matchedPlant : `${col.plantName} (new)`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleModalClose}
            className="px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-graphite dark:hover:text-zinc-100 transition-colors"
          >
            {showResult ? "Close" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={!file || isProcessing || showResult}
            onClick={handleImport}
            className="flex items-center gap-2 rounded-xl bg-canopy dark:bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-canopy/90 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Check className="size-4" />
                Import Data
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
