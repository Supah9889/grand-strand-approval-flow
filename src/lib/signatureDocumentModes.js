export const SIGNATURE_DOCUMENT_MODES = Object.freeze({
  GENERATED_TEMPLATE: 'generated_template',
  STAMP_UPLOADED_PDF: 'stamp_uploaded_pdf',
});

export const SIGNATURE_PLACEMENTS = Object.freeze({
  BOTTOM_LEFT: 'bottom_left',
  BOTTOM_RIGHT: 'bottom_right',
});

export const DEFAULT_SIGNATURE_DOCUMENT_MODE = SIGNATURE_DOCUMENT_MODES.GENERATED_TEMPLATE;
export const DEFAULT_SIGNATURE_PLACEMENT = SIGNATURE_PLACEMENTS.BOTTOM_RIGHT;

export function normalizeSignatureDocumentMode(mode) {
  return Object.values(SIGNATURE_DOCUMENT_MODES).includes(mode)
    ? mode
    : DEFAULT_SIGNATURE_DOCUMENT_MODE;
}

export function normalizeSignaturePlacement(placement) {
  return Object.values(SIGNATURE_PLACEMENTS).includes(placement)
    ? placement
    : DEFAULT_SIGNATURE_PLACEMENT;
}

export function isStampUploadedPdfMode(mode) {
  return normalizeSignatureDocumentMode(mode) === SIGNATURE_DOCUMENT_MODES.STAMP_UPLOADED_PDF;
}

// TODO: Add PDF stamping execution for stamp_uploaded_pdf after source PDF upload UI exists.
