async function loadPdfJs() {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
    }
    return pdfjsLib;
  } catch (error) {
    console.error('[BTImport] Calendar PDF parser dependency failed to load:', error);
    throw new Error('Calendar PDF parser dependency could not load in this environment.');
  }
}

async function loadPdfDocument(pdfjsLib, data) {
  try {
    return await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
  } catch (error) {
    const message = String(error?.message || error || '');
    if (!message.includes('GlobalWorkerOptions.workerSrc') && !message.toLowerCase().includes('worker')) {
      throw error;
    }

    return await pdfjsLib.getDocument({ data: data.slice(0), disableWorker: true }).promise;
  }
}

export async function extractPdfTextPages(file) {
  const pdfjsLib = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  let pdf;

  try {
    pdf = await loadPdfDocument(pdfjsLib, data);
  } catch (error) {
    console.error('[BTImport] Calendar PDF text extraction failed:', error);
    throw new Error(error?.message || 'Calendar PDF parser failed while reading the PDF text layer.');
  }

  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent({ includeMarkedContent: false });
    const items = content.items
      .map((item) => ({
        str: String(item.str || '').trim(),
        x: item.transform?.[4] || 0,
        y: item.transform?.[5] || 0,
        width: item.width || 0,
        page: pageNumber,
      }))
      .filter(item => item.str);

    pages.push({ page: pageNumber, items });
  }

  const totalItems = pages.reduce((sum, page) => sum + page.items.length, 0);
  if (totalItems === 0) {
    throw new Error('Calendar PDF text extraction returned no text. OCR is not enabled for this dry-run parser.');
  }

  return pages;
}
