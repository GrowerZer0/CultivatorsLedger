"use client";
import React, { useState } from "react";
import { Upload, FileSpreadsheet, X, AlertCircle } from "lucide-react";
export interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (parsedData: Record<string, string>[]) => void;
}
export function CSVImportModal({
  isOpen,
  onClose,
  onImportSuccess,
}: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!isOpen) return null;
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (
      selectedFile.type !== "text/csv" &&
      !selectedFile.name.toLowerCase().endsWith(".csv")
    ) {
      setError("Please select a valid .csv file.");
      setFile(null);
      return;
    }
    setError(null);
    setFile(selectedFile);
  };
  const EXCLUDE_KEYWORDS = ["outside", "outdoor", "ambient", "external"];
  const TIMESTAMP_KEYWORDS = ["timestamp", "date", "time"];
  const TEMP_KEYWORDS = ["temp"];
  const HUMIDITY_KEYWORDS = ["humid", "rh"];
  const handleProcessCSV = async () => {
  if (!file) return;
  setIsProcessing(true);
  setError(null);
  try {
    const text = await file.text();
    const lines = text
      .split(/\r\n|\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length < 2) {
      throw new Error("CSV file must contain a header row and at least one data row.");
    }
    const rawHeaders = lines[0].split(",").map((h) => h.trim());
    const normalizedHeaders = rawHeaders.map((h) =>
      h.toLowerCase().replace(/[^a-z0-9]/g, "")
    );
    // Determine column mapping ONCE from the header row, not per-cell per-row.
    let tempColIndex = -1;
    let rhColIndex = -1;
    let timestampColIndex = -1;
    normalizedHeaders.forEach((headerKey, index) => {
      const isExcluded = EXCLUDE_KEYWORDS.some((k) => headerKey.includes(k));
      if (isExcluded) return;
      if (tempColIndex === -1 && TEMP_KEYWORDS.some((k) => headerKey.includes(k))) {
        tempColIndex = index;
      }
      if (rhColIndex === -1 && HUMIDITY_KEYWORDS.some((k) => headerKey.includes(k))) {
        rhColIndex = index;
      }
      if (timestampColIndex === -1 && TIMESTAMP_KEYWORDS.some((k) => headerKey.includes(k))) {
        timestampColIndex = index;
      }
    });
    if (tempColIndex === -1 && rhColIndex === -1) {
      throw new Error(
        "Couldn't find temperature or humidity columns in this file. Check that it's an export from a supported sensor (Govee, SensorPush, AC Infinity, VIVOSUN)."
      );
    }
    // Heuristic unit normalization: growroom temps realistically run 50-100°F 
    // or 10-38°C. A raw value under 45 is almost certainly Celsius from a 
    // sensor set to metric — convert so downstream code always gets °F.
    const normalizeTemp = (raw: number): number => {
      if (raw < 45) return Math.round(((raw * 9) / 5 + 32) * 10) / 10;
      return raw;
    };
    const parsedRows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const rowData: Record<string, string> = {};
      // Keep all original columns too, in case a future feature wants them
      rawHeaders.forEach((rawHeader, index) => {
        rowData[rawHeader] = values[index] ?? "";
      });
      if (tempColIndex !== -1 && values[tempColIndex] !== undefined) {
        const rawTemp = parseFloat(values[tempColIndex]);
        if (!isNaN(rawTemp)) rowData["temp"] = String(normalizeTemp(rawTemp));
      }
      if (rhColIndex !== -1 && values[rhColIndex] !== undefined) {
        rowData["rh"] = values[rhColIndex];
      }
      if (timestampColIndex !== -1 && values[timestampColIndex] !== undefined) {
        rowData["timestamp"] = values[timestampColIndex];
      }
      parsedRows.push(rowData);
    }
    onImportSuccess(parsedRows);
    setIsProcessing(false);
    setFile(null);
    onClose();
  } catch (err: any) {
    setError(err?.message || "Failed to process the CSV file. Please check formatting.");
    setIsProcessing(false);
  }
};
  const handleModalClose = () => {
    setFile(null);
    setError(null);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-canopy/10 text-canopy dark:bg-emerald-500/10 dark:text-emerald-400">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-graphite dark:text-zinc-100">
                Import Environment Telemetry
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Upload sensor CSV exports 
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
                    Click to select or drag & drop CSV file
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                    Supports columns for Temperature and Relative Humidity
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
        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleModalClose}
            className="px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-graphite dark:hover:text-zinc-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!file || isProcessing}
            onClick={handleProcessCSV}
            className="flex items-center gap-2 rounded-xl bg-canopy dark:bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-canopy/90 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isProcessing ? "Processing..." : "Import Readings"}
          </button>
        </div>
      </div>
    </div>
  );
}