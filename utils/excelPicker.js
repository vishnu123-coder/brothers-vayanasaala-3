import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';

// Opens the phone's file picker and returns the parsed workbook.
// Uses '*/*' because many Android file managers label .xlsx files with an
// odd MIME type and would hide them from a stricter filter.
export async function pickWorkbook() {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const name = (asset.name || '').toLowerCase();
  if (name && !/\.(xlsx|xls|csv)$/.test(name)) {
    throw new Error('Please choose an Excel file (.xlsx, .xls) or a .csv file.');
  }

  const b64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const workbook = XLSX.read(b64, { type: 'base64' });
  return { workbook, fileName: asset.name || 'file' };
}

// Real exports often contain small "summary" sheets next to the main list —
// pick the sheet with the most data rows.
export function bestSheetRows(workbook) {
  let bestName = workbook.SheetNames[0];
  let bestRows = [];
  for (const name of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '' });
    if (rows.length > bestRows.length) {
      bestRows = rows;
      bestName = name;
    }
  }
  return { sheetName: bestName, rows: bestRows };
}

export function sheetByName(workbook, name) {
  const actual = workbook.SheetNames.find((n) => n.toLowerCase() === name.toLowerCase());
  return actual ? XLSX.utils.sheet_to_json(workbook.Sheets[actual], { defval: null }) : [];
}

export { XLSX };
