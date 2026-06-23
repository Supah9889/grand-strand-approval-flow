/**
 * Safe ESX File Inspector
 *
 * This utility safely inspects ESX (Xactimate export) files at a surface level only.
 * It treats the file as a user-provided export and does NOT:
 * - Decrypt or bypass any protections
 * - Access Xactimate local databases
 * - Import pricing libraries
 * - Modify the original file
 *
 * Purpose: Identify what fields are readable from the export so reviewers can
 * manually map content to draft work orders before relying on automatic classification.
 */

/**
 * Inspect an ESX file (XML-based text export from Xactimate)
 * @param {string} fileText - Raw text content of the ESX file
 * @returns {object} Inspection result with readable fields, extracted line items, notes
 */
export function inspectEsxFile(fileText) {
  const result = {
    readableFields: [],
    unreadableFields: [],
    extractedLineItems: [],
    extractionNotes: [],
    hasEncryption: false,
  };

  if (!fileText || typeof fileText !== 'string') {
    result.extractionNotes.push('File is empty or not valid text.');
    return result;
  }

  // Check for encryption signatures (without attempting to decrypt)
  if (fileText.includes('encrypted') || fileText.includes('cipher') || fileText.includes('RSA')) {
    result.hasEncryption = true;
    result.unreadableFields.push('Encrypted content detected');
    result.extractionNotes.push('This file contains encrypted sections. Only readable (plaintext) fields will be extracted.');
  }

  // Attempt to parse as XML (ESX files are typically XML exports)
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(fileText, 'application/xml');

    if (doc.documentElement.nodeName === 'parsererror') {
      result.extractionNotes.push('File is not valid XML. Attempting basic text extraction.');
      return extractFromPlainText(fileText, result);
    }

    // Safe XML traversal — extract visible elements only
    result.extractedLineItems = extractLineItemsFromXml(doc);
    result.readableFields = Array.from(new Set(
      result.extractedLineItems.flatMap(item => Object.keys(item))
    ));

    if (result.extractedLineItems.length === 0) {
      result.extractionNotes.push('No line items found in XML structure.');
    } else {
      result.extractionNotes.push(`Extracted ${result.extractedLineItems.length} line items with ${result.readableFields.length} field types.`);
    }
  } catch (e) {
    result.extractionNotes.push(`XML parsing failed: ${e.message}. Attempting plain text extraction.`);
    return extractFromPlainText(fileText, result);
  }

  return result;
}

/**
 * Extract line items from XML structure (safe, non-destructive)
 */
function extractLineItemsFromXml(doc) {
  const items = [];

  // Common ESX/Xactimate XML element patterns
  const patterns = [
    { selector: 'LineItem', fields: ['description', 'code', 'quantity', 'unit', 'unitPrice', 'totalPrice', 'category'] },
    { selector: 'Item', fields: ['name', 'desc', 'qty', 'price', 'lineNo'] },
    { selector: 'Work', fields: ['description', 'scope', 'laborCategory', 'hours', 'rate'] },
  ];

  for (const pattern of patterns) {
    const elements = doc.querySelectorAll(pattern.selector);
    for (const el of elements) {
      const item = {};
      // Extract only visible text/attribute content
      for (const field of pattern.fields) {
        const child = el.querySelector(field);
        if (child?.textContent) {
          item[field] = child.textContent.trim();
        } else if (el.getAttribute(field)) {
          item[field] = el.getAttribute(field);
        }
      }
      // Also capture any direct child text nodes
      Array.from(el.children).forEach(child => {
        if (child.textContent && !item[child.tagName]) {
          item[child.tagName] = child.textContent.trim();
        }
      });
      if (Object.keys(item).length > 0) {
        items.push(item);
      }
    }
  }

  return items;
}

/**
 * Fallback: extract line items from plain text (CSV-like or delimited format)
 */
function extractFromPlainText(fileText, result) {
  const lines = fileText.split('\n');
  const items = [];

  // Look for lines with common work description patterns
  const descriptionPatterns = [
    /(?:description|desc|work|scope|detail)[\s:]*(.+)/i,
    /^(.{20,})[\s,]+(qty|quantity|hrs?|hours)[\s:]*(\d+)/i,
  ];

  for (const line of lines) {
    if (line.trim().length < 5) continue;

    const item = {};
    let hasContent = false;

    // Try to extract structured fields
    if (line.includes(',') || line.includes('\t')) {
      const fields = line.split(/[,\t]+/).map(f => f.trim());
      if (fields.length >= 2) {
        item.description = fields[0];
        item.quantity = fields[1];
        hasContent = true;
        result.readableFields = Array.from(new Set([...result.readableFields, 'description', 'quantity']));
      }
    } else {
      // Try pattern matching
      for (const pattern of descriptionPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          item.description = match[1].substring(0, 100);
          hasContent = true;
          if (!result.readableFields.includes('description')) {
            result.readableFields.push('description');
          }
          break;
        }
      }
    }

    if (hasContent) {
      items.push(item);
    }
  }

  result.extractedLineItems = items;
  result.extractionNotes.push(`Plain text extraction: found ${items.length} potential line items.`);
  return result;
}

/**
 * Summarize extraction for reviewer
 */
export function summarizeExtraction(inspection) {
  return {
    totalLineItems: inspection.extractedLineItems.length,
    readableFieldCount: inspection.readableFields.length,
    unreadableFieldCount: inspection.unreadableFields.length,
    hasEncryption: inspection.hasEncryption,
    readableFields: inspection.readableFields,
    unreadableFields: inspection.unreadableFields,
    notes: inspection.extractionNotes.join('\n'),
    sampleLineItem: inspection.extractedLineItems[0] || null,
  };
}