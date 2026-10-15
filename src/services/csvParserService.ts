import { apiGet } from '@lib/api/client';
import { sha256 } from '@lib/security/sha256';

// Types
export interface ParsedRow {
  isrc: string;
  upc?: string;
  platform: string;
  territory: string;
  reportingPeriod: string;
  streams: number;
  revenue: number;
  currency: string;
  sourceRowHash: string;
  rawRow: string;
}

export interface ValidationError {
  rowNumber: number;
  errorCode: string;
  errorMessage: string;
  rawRow: string;
}

export interface ColumnMapping {
  [key: string]: string | null; // CSV column index -> field name
}

export interface ParseResult {
  headers: string[];
  mappings: ColumnMapping;
  totalRows: number;
  validRows: ParsedRow[];
  errors: ValidationError[];
}

// Column pattern recognition
const COLUMN_PATTERNS = {
  isrc: /^(isrc|track_code|recording_code)$/i,
  upc: /^(upc|album_code|release_code|ean|barcode)$/i,
  platform: /^(platform|store|source|service|streaming_service)$/i,
  territory: /^(territory|country|region|market|geo)$/i,
  reportingPeriod: /^(reporting.?period|date|month|period|report_date)$/i,
  streams: /^(streams|plays|listens|stream_count)$/i,
  revenue: /^(revenue|earnings|amount|payout|income)$/i,
  currency: /^(currency|curr|currency_code)$/i,
};

/**
 * Parse CSV file and detect columns
 */
export async function parseCSVFile(file: File): Promise<{ headers: string[]; error?: string }> {
  try {
    if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
      throw new Error('Invalid file format. Only CSV files are supported.');
    }

    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File size exceeds 50MB limit');
    }

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    const headers = lines[0].split(',').map(h => h.trim());

    if (headers.length === 0) {
      throw new Error('CSV file has no headers');
    }

    return { headers };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse CSV file';
    return { headers: [], error: message };
  }
}

/**
 * Auto-detect column mappings
 */
export function autoDetectColumns(headers: string[]): ColumnMapping {
  const mappings: ColumnMapping = {};

  headers.forEach((header, index) => {
    const headerLower = header.toLowerCase().trim();
    let matched = false;

    for (const [fieldName, pattern] of Object.entries(COLUMN_PATTERNS)) {
      if (pattern.test(headerLower)) {
        mappings[index.toString()] = fieldName;
        matched = true;
        break;
      }
    }

    if (!matched) {
      mappings[index.toString()] = null;
    }
  });

  return mappings;
}

/**
 * Validate and extract rows from CSV text
 */
export async function validateCSVRows(
  csvText: string,
  mappings: ColumnMapping,
  maxRows: number = 100000
): Promise<ParseResult> {
  try {
    const lines = csvText.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      throw new Error('CSV file must have headers and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim());

    // Verify required columns are mapped
    const requiredFields = ['isrc', 'platform', 'territory', 'reportingPeriod', 'streams'];
    const mappedFields = Object.values(mappings).filter(f => f !== null) as string[];

    for (const required of requiredFields) {
      if (!mappedFields.includes(required)) {
        throw new Error(`Required column not mapped: ${required}`);
      }
    }

    const validRows: ParsedRow[] = [];
    const errors: ValidationError[] = [];
    let processedRows = 0;

    // Process data rows (skip header)
    for (let i = 1; i < Math.min(lines.length, maxRows + 1); i++) {
      const line = lines[i].trim();
      if (!line) continue;

      processedRows++;

      try {
        const values = parseCSVLine(line);
        const row = await extractRow(values, mappings);

        // Validate individual fields
        const validation = validateRow(row);
        if (validation.error) {
          errors.push({
            rowNumber: i,
            errorCode: validation.errorCode || 'VALIDATION_ERROR',
            errorMessage: validation.error,
            rawRow: line,
          });
        } else {
          validRows.push(row);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid row format';
        errors.push({
          rowNumber: i,
          errorCode: 'PARSE_ERROR',
          errorMessage: message,
          rawRow: line,
        });
      }
    }

    if (processedRows >= maxRows) {
      throw new Error(`CSV exceeds maximum ${maxRows} rows`);
    }

    return {
      headers,
      mappings,
      totalRows: processedRows,
      validRows,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to validate CSV rows';
    throw new Error(message);
  }
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Extract row data using column mappings
 */
async function extractRow(values: string[], mappings: ColumnMapping): Promise<ParsedRow> {
  const rowData: Record<string, any> = {};
  const rawRow = values.join(',');

  // Extract fields based on mappings
  for (const [columnIndex, fieldName] of Object.entries(mappings)) {
    if (fieldName && parseInt(columnIndex) < values.length) {
      rowData[fieldName] = values[parseInt(columnIndex)];
    }
  }

  // Create row with defaults
  const row: ParsedRow = {
    isrc: rowData.isrc || '',
    upc: rowData.upc || undefined,
    platform: rowData.platform || '',
    territory: rowData.territory || '',
    reportingPeriod: rowData.reportingPeriod || '',
    streams: rowData.streams ? parseInt(rowData.streams) : 0,
    revenue: rowData.revenue ? parseFloat(rowData.revenue) : 0,
    currency: rowData.currency ? rowData.currency.toUpperCase() : 'USD',
    sourceRowHash: '',
    rawRow,
  };

  // Calculate source row hash for deduplication
  const hashInput = `${row.isrc}|${row.platform}|${row.territory}|${row.reportingPeriod}|${row.streams}`;
  row.sourceRowHash = await sha256(hashInput);

  return row;
}

/**
 * Validate individual row fields
 */
function validateRow(row: ParsedRow): { error?: string; errorCode?: string } {
  // ISRC validation
  if (!row.isrc || row.isrc.length !== 12) {
    return {
      error: `ISRC must be exactly 12 characters, got ${row.isrc?.length || 0}`,
      errorCode: 'INVALID_ISRC',
    };
  }
  if (!/^[A-Z0-9]{12}$/.test(row.isrc)) {
    return { error: 'ISRC must contain only alphanumeric characters', errorCode: 'INVALID_ISRC' };
  }

  // UPC validation (optional)
  if (row.upc) {
    if (row.upc.length < 12 || row.upc.length > 20) {
      return {
        error: `UPC must be 12-20 characters, got ${row.upc.length}`,
        errorCode: 'INVALID_UPC',
      };
    }
    if (!/^\d+$/.test(row.upc)) {
      return { error: 'UPC must contain only digits', errorCode: 'INVALID_UPC' };
    }
  }

  // Platform validation
  if (!row.platform || row.platform.length === 0) {
    return { error: 'Platform is required', errorCode: 'INVALID_PLATFORM' };
  }

  // Territory validation
  if (!row.territory || row.territory.length !== 2) {
    return {
      error: `Territory must be 2-character ISO code, got ${row.territory?.length || 0}`,
      errorCode: 'INVALID_TERRITORY',
    };
  }
  if (!/^[A-Z]{2}$/.test(row.territory)) {
    return { error: 'Territory must be uppercase 2-letter code', errorCode: 'INVALID_TERRITORY' };
  }

  // Reporting period validation
  if (!row.reportingPeriod) {
    return { error: 'Reporting period is required', errorCode: 'INVALID_DATE' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.reportingPeriod)) {
    return {
      error: `Reporting period must be YYYY-MM-DD format`,
      errorCode: 'INVALID_DATE',
    };
  }

  // Parse and validate the date parts
  const [year, month, day] = row.reportingPeriod.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  // Check if the parsed date matches the input (catches invalid dates like Feb 30)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { error: 'Reporting period is not a valid date', errorCode: 'INVALID_DATE' };
  }

  // Streams validation
  if (!Number.isInteger(row.streams) || row.streams < 0) {
    return { error: 'Streams must be non-negative integer', errorCode: 'INVALID_STREAMS' };
  }

  // Revenue validation
  if (typeof row.revenue !== 'number' || row.revenue < 0) {
    return { error: 'Revenue must be non-negative decimal', errorCode: 'INVALID_REVENUE' };
  }
  if (row.revenue > 999999.999999) {
    return { error: 'Revenue exceeds maximum value', errorCode: 'INVALID_REVENUE' };
  }

  // Currency validation
  if (!/^[A-Z]{3}$/.test(row.currency)) {
    return { error: 'Currency must be 3-letter ISO code', errorCode: 'INVALID_CURRENCY' };
  }

  return {};
}

/**
 * Match track by ISRC and owner
 */
export async function matchTrackByISRC(isrc: string): Promise<{ trackId?: string; releaseId?: string; error?: string }> {
  try {
    // Query track by ISRC (admin can see all tracks)
    const response = await apiGet<any>(`/api/tracks?isrc=${encodeURIComponent(isrc)}&limit=1`);
    const track = response.data?.data?.[0];
    return track ? { trackId: track.id, releaseId: track.release_id } : {};
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to match track';
    return { error: message };
  }
}

/**
 * Match release by UPC and owner
 */
export async function matchReleaseByUPC(upc: string): Promise<{ releaseId?: string; error?: string }> {
  try {
    const response = await apiGet<any>(`/api/releases/by-upc?upc=${encodeURIComponent(upc)}`);
    return response.data?.id ? { releaseId: response.data.id } : {};
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to match release';
    return { error: message };
  }
}

/**
 * Check for duplicate in existing streaming records
 */
export async function checkDuplicate(
  reportId: string,
  sourceRowHash: string
): Promise<{ isDuplicate: boolean; error?: string }> {
  try {
    void reportId;
    const response = await apiGet<any>(`/api/streaming/duplicate?source_row_hash=${encodeURIComponent(sourceRowHash)}`);
    return { isDuplicate: response.data?.is_duplicate === true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check duplicate';
    return { isDuplicate: false, error: message };
  }
}
