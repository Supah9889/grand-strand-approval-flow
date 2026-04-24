/**
 * Parses a CSV string into an array of objects.
 * Handles quoted fields, commas inside quotes, and Windows/Unix line endings.
 */
export function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? '';
    });
    rows.push(obj);
  }

  return { headers, rows };
}

function parseLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * APP_FIELDS: the canonical fields the app uses.
 * label = display name, key = entity field, required = must be mapped.
 */
export const APP_FIELDS = [
  { key: 'address',        label: 'Address',              required: true  },
  { key: 'customer_name',  label: 'Customer Name',        required: true  },
  { key: 'description',    label: 'Job Description',      required: true  },
  { key: 'price',          label: 'Price',                required: true  },
  { key: 'status',         label: 'Status',               required: false },
  { key: 'buildertrend_id',label: 'Buildertrend ID',      required: false },
  { key: 'email',          label: 'Email',                required: false },
  { key: 'phone',          label: 'Phone',                required: false },
];

/**
 * Auto-suggest column mappings by fuzzy-matching CSV headers to app field labels/keys.
 */
export function autoMapColumns(csvHeaders) {
  const mapping = {};
  APP_FIELDS.forEach(({ key, label }) => {
    const candidates = [key, label, label.toLowerCase()];
    const match = csvHeaders.find(h => {
      const hn = h.toLowerCase().replace(/[\s_-]/g, '');
      return candidates.some(c => hn === c.toLowerCase().replace(/[\s_-]/g, ''));
    }) || csvHeaders.find(h => {
      const hn = h.toLowerCase();
      return candidates.some(c => hn.includes(c.toLowerCase().replace(/[\s_-]/g, '')));
    });
    mapping[key] = match || '';
  });
  return mapping;
}

/**
 * Apply mapping to rows → array of job objects.
 */
export function applyMapping(rows, mapping) {
  return rows.map(row => {
    const job = {};
    APP_FIELDS.forEach(({ key }) => {
      const col = mapping[key];
      if (col && row[col] !== undefined) {
        job[key] = row[col];
      }
    });
    // Coerce price to number
    if (job.price) {
      job.price = parseFloat(String(job.price).replace(/[^0-9.]/g, '')) || 0;
    }
    // Normalize status
    if (job.status) {
      const s = job.status.toLowerCase();
      job.status = ['pending', 'approved', 'archived'].includes(s) ? s : 'pending';
    } else {
      job.status = 'pending';
    }
    return job;
  });
}

/**
 * Detect duplicates against existing jobs.
 * Returns array of same length as mappedRows: each entry = null | existingJob
 */
export function detectDuplicates(mappedRows, existingJobs) {
  return mappedRows.map(row => {
    return existingJobs.find(j => {
      const addressMatch = j.address?.toLowerCase().trim() === row.address?.toLowerCase().trim();
      const nameMatch = j.customer_name?.toLowerCase().trim() === row.customer_name?.toLowerCase().trim();
      const btMatch = row.buildertrend_id && j.buildertrend_id &&
        j.buildertrend_id.trim() === row.buildertrend_id.trim();
      return btMatch || (addressMatch && nameMatch);
    }) || null;
  });
}