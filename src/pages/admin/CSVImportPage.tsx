import React, { useState } from 'react';
import { parseCSVFile, autoDetectColumns, validateCSVRows, ColumnMapping, ParseResult } from '@services/csvParserService';
import { resolveMatches, RowWithMatch } from '@services/matchingService';
import { executeImport } from '@services/importExecutionService';
import { useAuth } from '@hooks/useAuth';
import { sha256 } from '@lib/security/sha256';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'executing' | 'complete';

export default function CSVImportPage() {
  const { user } = useAuth();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping>({});
  const [matchedRows, setMatchedRows] = useState<RowWithMatch[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('spotify');

  // Step 1: File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (selectedFile.size > 10 * 1024 * 1024) {
      setFile(null);
      setError('Ukuran CSV maksimal 10 MB per import.');
      return;
    }

    try {
      setLoading(true);
      setFile(selectedFile);

      const text = await selectedFile.text();
      setCsvText(text);

      const parseResult = await parseCSVFile(selectedFile);
      if (parseResult.error) {
        setError(parseResult.error);
        setFile(null);
        return;
      }

      // Auto-detect columns
      const detectedMappings = autoDetectColumns(parseResult.headers);
      setMappings(detectedMappings);

      setParseResult({
        headers: parseResult.headers,
        mappings: detectedMappings,
        totalRows: 0,
        validRows: [],
        errors: [],
      });

      setStep('mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Column Mapping
  const handleMappingChange = (columnIndex: string, fieldName: string | null) => {
    setMappings(prev => ({
      ...prev,
      [columnIndex]: fieldName,
    }));
  };

  const handleValidateAndPreview = async () => {
    setError('');
    try {
      setLoading(true);

      if (!csvText) {
        setError('CSV text not loaded');
        return;
      }

      const result = await validateCSVRows(csvText, mappings);
      if (result.totalRows > 5000) {
        setError('CSV dibatasi 5.000 baris per import agar validasi dan pencocokan tetap aman.');
        return;
      }
      setParseResult(result);

      if (result.errors.length > 0) {
        setError(`Found ${result.errors.length} validation errors in CSV`);
      }

      // Resolve matches
      if (user && result.validRows.length > 0) {
        const matched = await resolveMatches(result.validRows, user.id);
        setMatchedRows(matched);
      }

      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate CSV');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Execute Import
  const handleExecuteImport = async () => {
    setError('');
    try {
      setLoading(true);
      setStep('executing');

      if (!file || !user || (!matchedRows.length && !(parseResult?.errors.length))) {
        setError('Missing required data for import');
        return;
      }

      // Calculate file hash
      const fileContent = await file.text();
      const fileHash = await sha256(fileContent);

      const result = await executeImport(
        file.name,
        fileHash,
        source,
        user.id,
        matchedRows,
        parseResult?.errors || []
      );

      setImportResult(result);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute import');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  // Reset to start
  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setCsvText('');
    setParseResult(null);
    setMappings({});
    setMatchedRows([]);
    setImportResult(null);
    setError('');
    setLoading(false);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">CSV Import</h1>
        <p className="text-gray-600">Upload and import streaming data from CSV files</p>
      </div>

      {/* Step Indicator */}
      <div className="card mb-8 p-6">
        <div className="flex gap-4">
          {(['upload', 'mapping', 'preview', 'executing', 'complete'] as const).map((s, idx) => (
            <div key={s} className="flex-1 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                step === s ? 'bg-blue-600' :
                ['upload', 'mapping', 'preview', 'executing', 'complete'].indexOf(step) > idx ? 'bg-green-600' :
                'bg-gray-300'
              }`}>
                {idx + 1}
              </div>
              <span className="text-sm capitalize">{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="card mb-6 p-4 bg-red-50 border border-red-200">
          <p className="text-red-700"><strong>Error:</strong> {error}</p>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="card p-8">
          <h2 className="text-xl font-bold mb-6">Upload CSV File</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="spotify">Spotify</option>
              <option value="apple_music">Apple Music</option>
              <option value="youtube">YouTube Music</option>
              <option value="tidal">TIDAL</option>
              <option value="amazon_music">Amazon Music</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:bg-gray-50 transition">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={loading}
              className="hidden"
              id="csv-input"
            />
            <label htmlFor="csv-input" className="cursor-pointer">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v24a4 4 0 004 4h24a4 4 0 004-4V20m-12-12v12m0 0l4-4m-4 4l-4-4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-gray-700 font-medium">Drop your CSV file here or click to select</p>
              <p className="text-gray-500 text-sm mt-2">Maksimal 10 MB dan 5.000 baris per import</p>
            </label>
          </div>

          {file && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm"><strong>File:</strong> {file.name}</p>
              <p className="text-sm"><strong>Size:</strong> {(file.size / 1024).toFixed(2)} KB</p>
              <button
                onClick={() => handleFileChange({ target: { files: null } } as any)}
                className="text-sm text-blue-600 hover:underline mt-2"
              >
                Change file
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Mapping */}
      {step === 'mapping' && parseResult && (
        <div className="card p-8">
          <h2 className="text-xl font-bold mb-6">Column Mapping</h2>
          <p className="text-gray-600 mb-6">Map CSV columns to streaming data fields</p>

          <div className="space-y-4 mb-8">
            {parseResult.headers.map((header, idx) => (
              <div key={idx} className="flex gap-4 items-center">
                <div className="w-32 text-sm font-medium text-gray-700 truncate">{header}</div>
                <select
                  value={mappings[idx.toString()] || ''}
                  onChange={(e) => handleMappingChange(idx.toString(), e.target.value || null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Not Mapped --</option>
                  <option value="isrc">ISRC</option>
                  <option value="upc">UPC</option>
                  <option value="platform">Platform</option>
                  <option value="territory">Territory</option>
                  <option value="reportingPeriod">Reporting Period</option>
                  <option value="streams">Streams</option>
                  <option value="revenue">Revenue</option>
                  <option value="currency">Currency</option>
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep('upload')}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Back
            </button>
            <button
              onClick={handleValidateAndPreview}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Validating...' : 'Validate & Preview'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && parseResult && (
        <div className="card p-8">
          <h2 className="text-xl font-bold mb-6">Preview & Statistics</h2>

          {/* Statistics */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Valid Rows</p>
              <p className="text-2xl font-bold text-blue-600">{parseResult.validRows.length}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Validation Errors</p>
              <p className="text-2xl font-bold text-red-600">{parseResult.errors.length}</p>
            </div>
            {matchedRows.length > 0 && (
              <>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Matched Records</p>
                  <p className="text-2xl font-bold text-green-600">{matchedRows.filter(r => r.trackId || r.releaseId).length}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Unmatched</p>
                  <p className="text-2xl font-bold text-yellow-600">{matchedRows.filter(r => !r.trackId && !r.releaseId).length}</p>
                </div>
              </>
            )}
          </div>

          {/* Validation Errors Table */}
          {parseResult.errors.length > 0 && (
            <div className="mb-8">
              <h3 className="font-bold text-red-600 mb-4">Validation Errors ({parseResult.errors.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-4 py-2">Row</th>
                      <th className="text-left px-4 py-2">Error Code</th>
                      <th className="text-left px-4 py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.errors.slice(0, 10).map((err, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="px-4 py-2 text-red-600 font-mono">{err.rowNumber}</td>
                        <td className="px-4 py-2 font-mono text-xs">{err.errorCode}</td>
                        <td className="px-4 py-2">{err.errorMessage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parseResult.errors.length > 10 && (
                  <p className="text-sm text-gray-600 mt-2">...and {parseResult.errors.length - 10} more errors</p>
                )}
              </div>
            </div>
          )}

          {/* Preview Data Table */}
          {matchedRows.length > 0 && (
            <div className="mb-8">
              <h3 className="font-bold mb-4">Data Preview (first 10 rows)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-4 py-2">ISRC</th>
                      <th className="text-left px-4 py-2">Platform</th>
                      <th className="text-left px-4 py-2">Territory</th>
                      <th className="text-right px-4 py-2">Streams</th>
                      <th className="text-right px-4 py-2">Revenue</th>
                      <th className="text-center px-4 py-2">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedRows.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="px-4 py-2 font-mono text-xs">{row.isrc}</td>
                        <td className="px-4 py-2">{row.platform}</td>
                        <td className="px-4 py-2">{row.territory}</td>
                        <td className="px-4 py-2 text-right">{row.streams.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">{row.revenue.toFixed(2)} {row.currency}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            row.trackId ? 'bg-green-100 text-green-700' :
                            row.releaseId ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {row.trackId ? 'Track' : row.releaseId ? 'Release' : 'None'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => setStep('mapping')}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Back
            </button>
            <button
              onClick={handleExecuteImport}
              disabled={loading || parseResult.validRows.length === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Importing...' : 'Execute Import'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Executing */}
      {step === 'executing' && (
        <div className="card p-8 text-center">
          <div className="inline-block mb-4">
            <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
          <h2 className="text-xl font-bold mb-2">Processing Import</h2>
          <p className="text-gray-600">Please wait while we process your CSV file...</p>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && importResult && (
        <div className="card p-8">
          <h2 className="text-xl font-bold mb-6 text-green-600">✓ Import Complete</h2>

          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Inserted Records</p>
              <p className="text-2xl font-bold text-green-600">{importResult.insertedRecords}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Duplicates</p>
              <p className="text-2xl font-bold text-yellow-600">{importResult.duplicateRows}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Errors</p>
              <p className="text-2xl font-bold text-red-600">{importResult.invalidRows + importResult.errors.length}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Import ID</p>
              <p className="text-sm font-mono text-blue-600 truncate">{importResult.importId}</p>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <p className="text-sm text-blue-700"><strong>Status:</strong> {importResult.status}</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Import Another File
            </button>
            <button
              onClick={() => window.location.href = '/admin/streaming-reports'}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              View Streaming Reports
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
