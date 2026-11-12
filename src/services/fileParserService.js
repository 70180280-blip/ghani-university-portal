/**
 * File Parser Service
 * 
 * Supports:
 * - PDF (pdf-parse / PDFParse) with scanned PDF detection
 * - Excel spreadsheets (.xlsx, .xls, .csv via xlsx)
 * - PowerPoint presentations (.pptx via officeparser)
 * - Image files (.png, .jpg, .jpeg, .webp) sent directly to Gemini multimodal
 */

const fs = require('fs');
const path = require('path');
const pdfModule = require('pdf-parse');
const XLSX = require('xlsx');
const officeparser = require('officeparser');

/**
 * Helper to extract all text strings from officeparser AST
 */
function extractTextFromOffice(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) {
    return node.map(extractTextFromOffice).filter(Boolean).join('\n');
  }
  let str = node.text || '';
  if (node.children && Array.isArray(node.children)) {
    const childText = extractTextFromOffice(node.children);
    if (childText && !str.includes(childText)) {
      str = str ? `${str}\n${childText}` : childText;
    }
  }
  return str;
}

/**
 * Extract raw text content from uploaded file based on its extension
 * @param {string} filePath 
 * @param {string} originalName 
 * @param {string} mimeType 
 * @returns {Promise<{ text: string, fileType: string, isScanned?: boolean, buffer?: Buffer, mimeType?: string, pages?: number, sheets?: string[] }>}
 */
async function parseUploadedFile(filePath, originalName = '', mimeType = '') {
  const ext = path.extname(originalName || filePath).toLowerCase();

  // 1. Image Files (.png, .jpg, .jpeg, .webp) - Scanned files sent directly to Gemini
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext) || mimeType.startsWith('image/')) {
    const buffer = fs.readFileSync(filePath);
    return {
      text: '',
      fileType: 'image',
      isScanned: true,
      buffer,
      mimeType: mimeType || (ext === '.png' ? 'image/png' : 'image/jpeg')
    };
  }

  // 2. PDF Documents
  if (ext === '.pdf' || mimeType.includes('pdf')) {
    const dataBuffer = fs.readFileSync(filePath);
    try {
      let fullText = '';
      if (typeof pdfModule === 'function') {
        const data = await pdfModule(dataBuffer);
        fullText = data.text || '';
      } else if (pdfModule.PDFParse) {
        const parser = new pdfModule.PDFParse({ data: dataBuffer });
        await parser.load();
        const textResult = await parser.getText();
        await parser.destroy();
        fullText = typeof textResult === 'string' ? textResult : (textResult.text || '');
      }

      // Check if scanned PDF (text is essentially empty or less than 20 characters)
      if (fullText.trim().length < 20) {
        return {
          text: fullText,
          fileType: 'pdf',
          isScanned: true,
          buffer: dataBuffer,
          mimeType: 'application/pdf'
        };
      }

      return {
        text: fullText,
        fileType: 'pdf',
        isScanned: false
      };
    } catch (err) {
      // If parsing failed, treat as scanned document for Gemini vision
      return {
        text: '',
        fileType: 'pdf',
        isScanned: true,
        buffer: dataBuffer,
        mimeType: 'application/pdf'
      };
    }
  }

  // 3. Excel spreadsheets (.xlsx, .xls, .csv)
  if (ext === '.xlsx' || ext === '.xls' || ext === '.csv' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    try {
      const workbook = XLSX.readFile(filePath);
      let combinedText = '';
      const sheetSummaries = [];

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const csvContent = XLSX.utils.sheet_to_csv(worksheet);
        combinedText += `--- SHEET: ${sheetName} ---\n${csvContent}\n\n`;
        sheetSummaries.push(sheetName);
      }

      return {
        text: combinedText,
        fileType: 'excel',
        sheets: sheetSummaries,
        isScanned: false
      };
    } catch (err) {
      throw new Error(`Failed to parse Excel spreadsheet: ${err.message}`);
    }
  }

  // 4. PowerPoint Presentations (.pptx)
  if (ext === '.pptx' || ext === '.ppt' || mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    try {
      const parsedData = await officeparser.parseOffice(filePath);
      let rawText = '';
      if (typeof parsedData === 'string') {
        rawText = parsedData;
      } else if (parsedData && parsedData.content) {
        rawText = extractTextFromOffice(parsedData.content);
      } else {
        rawText = JSON.stringify(parsedData);
      }

      return {
        text: rawText,
        fileType: 'powerpoint',
        isScanned: false
      };
    } catch (err) {
      throw new Error(`Failed to parse PowerPoint presentation: ${err.message}`);
    }
  }

  // 5. Plain Text fallback
  if (ext === '.txt' || ext === '.tsv') {
    const text = fs.readFileSync(filePath, 'utf8');
    return {
      text,
      fileType: 'text',
      isScanned: false
    };
  }

  throw new Error(`Unsupported file format '${ext}'. Please upload PDF, Excel (.xlsx, .xls, .csv), PowerPoint (.pptx), or Image (.png, .jpg).`);
}

module.exports = {
  parseUploadedFile
};
