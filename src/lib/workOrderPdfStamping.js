import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { normalizeSignaturePlacement, SIGNATURE_PLACEMENTS } from '@/lib/signatureDocumentModes';

const PAGE_MARGIN = 48;
const SIGNATURE_MAX_WIDTH = 180;
const SIGNATURE_MAX_HEIGHT = 72;
const SIGNATURE_BLOCK_HEIGHT = 120;

async function fetchArrayBuffer(url, label) {
  if (!url) throw new Error(`${label} is required.`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${label}.`);
  }

  return response.arrayBuffer();
}

async function embedSignatureImage(pdfDoc, signatureUrl) {
  const imageBytes = await fetchArrayBuffer(signatureUrl, 'signature image');

  try {
    return await pdfDoc.embedPng(imageBytes);
  } catch {
    return pdfDoc.embedJpg(imageBytes);
  }
}

function fitImage(image, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  return {
    width: image.width * scale,
    height: image.height * scale,
  };
}

function formatSignedAt(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export async function stampWorkOrderPdf({
  sourcePdfUrl,
  signatureUrl,
  signerName,
  signedAt,
  placement,
}) {
  const pdfBytes = await fetchArrayBuffer(sourcePdfUrl, 'source work order PDF');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const finalPage = pages[pages.length - 1];

  if (!finalPage) throw new Error('Source work order PDF has no pages.');

  const signatureImage = await embedSignatureImage(pdfDoc, signatureUrl);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width: pageWidth } = finalPage.getSize();
  const imageSize = fitImage(signatureImage, SIGNATURE_MAX_WIDTH, SIGNATURE_MAX_HEIGHT);
  const normalizedPlacement = normalizeSignaturePlacement(placement);

  const blockWidth = Math.max(SIGNATURE_MAX_WIDTH, 220);
  const blockX = normalizedPlacement === SIGNATURE_PLACEMENTS.BOTTOM_LEFT
    ? PAGE_MARGIN
    : Math.max(PAGE_MARGIN, pageWidth - PAGE_MARGIN - blockWidth);
  const labelY = PAGE_MARGIN + SIGNATURE_BLOCK_HEIGHT - 16;
  const signatureY = PAGE_MARGIN + 34;

  finalPage.drawText('Customer Signature', {
    x: blockX,
    y: labelY,
    size: 10,
    font: boldFont,
    color: rgb(0.12, 0.16, 0.22),
  });

  finalPage.drawImage(signatureImage, {
    x: blockX,
    y: signatureY,
    width: imageSize.width,
    height: imageSize.height,
  });

  finalPage.drawLine({
    start: { x: blockX, y: PAGE_MARGIN + 26 },
    end: { x: blockX + blockWidth, y: PAGE_MARGIN + 26 },
    thickness: 0.75,
    color: rgb(0.55, 0.58, 0.64),
  });

  finalPage.drawText(`Signed by: ${signerName || 'Customer'}`, {
    x: blockX,
    y: PAGE_MARGIN + 12,
    size: 9,
    font,
    color: rgb(0.22, 0.26, 0.32),
  });

  finalPage.drawText(`Signed: ${formatSignedAt(signedAt)}`, {
    x: blockX,
    y: PAGE_MARGIN,
    size: 9,
    font,
    color: rgb(0.22, 0.26, 0.32),
  });

  const stampedBytes = await pdfDoc.save();
  return new Blob([stampedBytes], { type: 'application/pdf' });
}
