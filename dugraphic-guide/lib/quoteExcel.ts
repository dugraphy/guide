import type ExcelJS from "exceljs";
import type { BusinessProfile } from "./businessProfile";
import type { QuoteItem, QuoteType } from "./quotes";

export interface QuoteTotals {
  totalBeforeDiscount: number;
  totalAfterDiscount: number;
  discountAmount: number;
  vat: number;
  grandTotal: number;
  deposit: number;
  balance: number;
  totalBilled: number;
}

export function calcQuoteTotals(
  items: QuoteItem[],
  depositRate: number,
  vatIncluded: boolean
): QuoteTotals {
  const totalBeforeDiscount = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  const totalAfterDiscount = items.reduce((sum, it) => sum + it.discountPrice * it.qty, 0);
  const discountAmount = totalBeforeDiscount - totalAfterDiscount;
  const vat = vatIncluded ? totalAfterDiscount * 0.1 : 0;
  const grandTotal = totalAfterDiscount + vat;
  // 계약금/잔금의 기준 금액: 부가세 포함이면 합계금액, 별도면 공급가액(할인 후)
  const depositBase = vatIncluded ? grandTotal : totalAfterDiscount;
  const deposit = depositBase * (depositRate / 100);
  const balance = depositBase - deposit;
  return {
    totalBeforeDiscount,
    totalAfterDiscount,
    discountAmount,
    vat,
    grandTotal,
    deposit,
    balance,
    totalBilled: depositBase,
  };
}

const FONT_NAME = "맑은 고딕";
const LABEL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F2F2" },
};
const ITEM_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F2937" },
};
const ZEBRA_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF5F5F5" },
};
const HIGHLIGHT_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD9D9D9" },
};
const THIN_BORDER_SIDE: ExcelJS.Border = { style: "thin", color: { argb: "FFBFBFBF" } };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: THIN_BORDER_SIDE,
  bottom: THIN_BORDER_SIDE,
  left: THIN_BORDER_SIDE,
  right: THIN_BORDER_SIDE,
};
const MONEY_FORMAT = '#,##0"원"';
const QTY_FORMAT = '0"ea"';

function styleLabelCell(cell: ExcelJS.Cell, size = 11) {
  cell.font = { name: FONT_NAME, bold: true, size };
  cell.fill = LABEL_FILL;
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = THIN_BORDER;
}

function styleValueCell(cell: ExcelJS.Cell, size = 11) {
  cell.font = { name: FONT_NAME, size };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = THIN_BORDER;
}

export interface QuoteExcelInput {
  businessProfile: BusinessProfile;
  clientName: string;
  quoteDate: string;
  quoteType: QuoteType;
  items: QuoteItem[];
  depositRate: number;
  notes: string;
  vatIncluded: boolean;
}

export async function buildQuoteWorkbook(input: QuoteExcelInput): Promise<ExcelJS.Workbook> {
  const { businessProfile, clientName, quoteDate, quoteType, items, depositRate, notes, vatIncluded } =
    input;
  const totals = calcQuoteTotals(items, depositRate, vatIncluded);
  void quoteType;

  const { default: ExcelJSRuntime } = await import("exceljs");
  const workbook = new ExcelJSRuntime.Workbook();
  const sheet = workbook.addWorksheet("견적서");
  sheet.columns = [
    { width: 8 },
    { width: 30 },
    { width: 13 },
    { width: 13 },
    { width: 18 },
    { width: 24 },
    { width: 13 },
  ];

  // ── 1. 상단: 좌측 큰 제목 + 우측 사업자정보 표 (6행에 걸쳐 나란히) ──
  const bizRows = [
    ["사업자번호(주민등록번호)", businessProfile.businessNumber],
    ["상호", businessProfile.companyName],
    ["대표자", businessProfile.ownerName],
    ["주소", businessProfile.address],
    ["전화번호", businessProfile.phone],
    ["E-mail", businessProfile.email],
  ] as const;
  const titleStartRow = sheet.rowCount + 1;
  bizRows.forEach(([label, value]) => {
    const row = sheet.addRow(["", "", label, "", value, "", ""]);
    sheet.mergeCells(row.number, 3, row.number, 4);
    sheet.mergeCells(row.number, 5, row.number, 7);
    styleLabelCell(row.getCell(3));
    styleValueCell(row.getCell(5));
    row.height = 22;
  });
  const titleEndRow = sheet.rowCount;

  // 로고를 왼쪽에, "견적서" 제목을 오른쪽에 배치 — 둘 다 titleStartRow~titleEndRow
  // (사업자정보 표와 같은 6행 범위) 안에서 세로 중앙 정렬한다.
  const EMU_PER_PX = 9525;
  const EMU_PER_PT = 12700;

  // 주어진 오프셋(EMU)이 몇 번째 구간(행/열)의 몇 EMU 지점에 해당하는지 찾는다.
  function locateOffset(sizesEMU: number[], targetEMU: number): { index: number; remainder: number } {
    let index = 0;
    let remaining = targetEMU;
    for (const size of sizesEMU) {
      if (remaining < size || index === sizesEMU.length - 1) break;
      remaining -= size;
      index += 1;
    }
    return { index, remainder: Math.max(0, Math.round(remaining)) };
  }

  const logoBuffer = await fetch("/img/logo.png").then((res) => res.arrayBuffer());
  const logoImageId = workbook.addImage({ buffer: logoBuffer, extension: "png" });
  const LOGO_HEIGHT = 30;
  const LOGO_WIDTH = Math.round((LOGO_HEIGHT * 2075) / 529); // 원본 로고 비율(2075x529) 유지

  // 세로 중앙 정렬: titleStartRow~titleEndRow(6행, 각 22pt) 전체 높이 가운데에 로고를 둔다.
  const titleRowHeightsEMU = bizRows.map(() => 22 * EMU_PER_PT);
  const titleAreaHeightEMU = titleRowHeightsEMU.reduce((sum, h) => sum + h, 0);
  const logoTopOffsetEMU = Math.max(0, Math.round((titleAreaHeightEMU - LOGO_HEIGHT * EMU_PER_PX) / 2));
  const { index: logoRowIndex, remainder: logoRowOffEMU } = locateOffset(
    titleRowHeightsEMU,
    logoTopOffsetEMU
  );

  sheet.addImage(logoImageId, {
    // ExcelJS의 ImagePosition 타입은 nativeCol/nativeColOff/nativeRow/nativeRowOff를
    // 선언하지 않지만, Anchor 생성자가 이 필드를 그대로(EMU 단위) XML에 반영하므로
    // 실제 픽셀 단위 위치를 안전하게 지정할 수 있다.
    tl: {
      nativeCol: 0,
      nativeColOff: 0,
      nativeRow: titleStartRow - 1 + logoRowIndex,
      nativeRowOff: logoRowOffEMU,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    ext: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
  });

  // 제목 — 로고와 같은 6행 범위(cols1-2) 안에서, 로고 폭만큼 들여쓰기(indent)해
  // 로고 바로 옆에 붙어 보이도록 좁은 간격만 남긴다. (오른쪽 정렬은 셀 전체
  // 폭 기준이라 로고와 제목 사이가 지나치게 벌어져 보여 좌측 정렬+indent로 변경)
  sheet.mergeCells(titleStartRow, 1, titleEndRow, 2);
  const titleCell = sheet.getCell(titleStartRow, 1);
  titleCell.value = "견적서";
  titleCell.font = { name: FONT_NAME, bold: true, size: 21 };
  // indent 1레벨 ≈ 3자 폭(약 21px). 로고 폭(118px) + 약간의 여백만큼만 들여쓴다.
  const titleIndentLevel = Math.round((LOGO_WIDTH + 8) / 21);
  titleCell.alignment = { horizontal: "left", vertical: "middle", indent: titleIndentLevel };

  sheet.addRow([]);

  // ── 2. 중단: 업체명/견적일자 표 + 안내 문구 ──
  const clientRow = sheet.addRow(["업체명", "", clientName, "", "견적일자", quoteDate, ""]);
  sheet.mergeCells(clientRow.number, 1, clientRow.number, 2);
  sheet.mergeCells(clientRow.number, 3, clientRow.number, 4);
  sheet.mergeCells(clientRow.number, 6, clientRow.number, 7);
  styleLabelCell(clientRow.getCell(1));
  styleValueCell(clientRow.getCell(3));
  styleLabelCell(clientRow.getCell(5));
  styleValueCell(clientRow.getCell(6));
  clientRow.height = 22;

  const noticeRow = sheet.addRow(["아래와 같이 견적합니다."]);
  sheet.mergeCells(noticeRow.number, 1, noticeRow.number, 7);
  noticeRow.getCell(1).font = { name: FONT_NAME, bold: true, size: 12 };
  noticeRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

  sheet.addRow([]);

  // ── 3. 품목 표 ──
  const vatLabel = vatIncluded ? "부가세 포함" : "부가세 별도";
  const itemsHeaderRow = sheet.addRow(["No", "품목", "단가", "할인단가", "수량", `공급가(${vatLabel})`, "비고"]);
  itemsHeaderRow.height = 24;
  for (let c = 1; c <= 7; c++) {
    const cell = itemsHeaderRow.getCell(c);
    cell.font = { name: FONT_NAME, bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = ITEM_HEADER_FILL;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = THIN_BORDER;
  }

  const itemRows = items.map((item, i) =>
    sheet.addRow([
      i + 1,
      item.name,
      item.unitPrice,
      item.discountPrice,
      item.qty,
      item.discountPrice * item.qty,
      item.note,
    ])
  );
  itemRows.forEach((row, i) => {
    row.height = 22;
    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.border = THIN_BORDER;
      cell.font = { name: FONT_NAME, size: 11 };
      cell.alignment = {
        horizontal: c === 2 || c === 7 ? "center" : "right",
        vertical: "middle",
        wrapText: c === 2 || c === 7,
      };
      if (i % 2 === 1) cell.fill = ZEBRA_FILL;
    }
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(3).numFmt = MONEY_FORMAT;
    row.getCell(4).numFmt = MONEY_FORMAT;
    row.getCell(5).numFmt = QTY_FORMAT;
    row.getCell(6).numFmt = MONEY_FORMAT;
  });

  sheet.addRow([]);

  // ── 4. 합계 영역 (참고 이미지의 ⑥~⑪ 구성) ──
  function pairRow3(
    label1: string,
    value1: number,
    label2: string,
    value2: number,
    label3: string,
    value3: number
  ) {
    const row = sheet.addRow(["", "", "", "", "", "", ""]);
    row.height = 26;
    sheet.mergeCells(row.number, 1, row.number, 2);
    row.getCell(1).value = label1;
    row.getCell(3).value = value1;
    row.getCell(4).value = label2;
    row.getCell(5).value = value2;
    row.getCell(6).value = label3;
    row.getCell(7).value = value3;
    styleLabelCell(row.getCell(1), 10);
    styleValueCell(row.getCell(3), 13);
    styleLabelCell(row.getCell(4), 10);
    styleValueCell(row.getCell(5), 13);
    styleLabelCell(row.getCell(6), 10);
    styleValueCell(row.getCell(7), 13);
    [3, 5, 7].forEach((c) => {
      row.getCell(c).numFmt = MONEY_FORMAT;
      row.getCell(c).alignment = { horizontal: "right", vertical: "middle" };
    });
    return row;
  }

  function pairRow2(label1: string, value1: number, label2: string, value2: number) {
    const row = sheet.addRow(["", "", "", "", "", "", ""]);
    row.height = 22;
    sheet.mergeCells(row.number, 1, row.number, 2);
    sheet.mergeCells(row.number, 3, row.number, 4);
    sheet.mergeCells(row.number, 6, row.number, 7);
    row.getCell(1).value = label1;
    row.getCell(3).value = value1;
    row.getCell(5).value = label2;
    row.getCell(6).value = value2;
    styleLabelCell(row.getCell(1));
    styleValueCell(row.getCell(3));
    styleLabelCell(row.getCell(5));
    styleValueCell(row.getCell(6));
    [3, 6].forEach((c) => {
      row.getCell(c).numFmt = MONEY_FORMAT;
      row.getCell(c).alignment = { horizontal: "right", vertical: "middle" };
    });
    return row;
  }

  pairRow3(
    "⑥ 총 공급가액(할인 전)",
    totals.totalBeforeDiscount,
    "⑦ 할인 금액",
    totals.discountAmount,
    "⑧ 총 공급가액(할인 후)",
    totals.totalAfterDiscount
  );

  if (vatIncluded) {
    pairRow2("부가세(10%)", totals.vat, "합계금액", totals.grandTotal);
  }

  pairRow2(
    `⑨ 계약금(${depositRate}%)`,
    totals.deposit,
    "⑩ 잔금",
    totals.balance
  );

  const grandRow = sheet.addRow(["", "", "", "", "", "", ""]);
  grandRow.height = 26;
  sheet.mergeCells(grandRow.number, 1, grandRow.number, 2);
  sheet.mergeCells(grandRow.number, 3, grandRow.number, 7);
  grandRow.getCell(1).value = "⑪ 총 청구액";
  grandRow.getCell(3).value = totals.totalBilled;
  [1, 3].forEach((c) => {
    const cell = grandRow.getCell(c);
    cell.font = { name: FONT_NAME, bold: true, size: 12 };
    cell.fill = HIGHLIGHT_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: c === 1 ? "center" : "right", vertical: "middle" };
  });
  grandRow.getCell(3).numFmt = MONEY_FORMAT;

  sheet.addRow([]);

  // ── 5. 안내사항 ──
  const noticeHeaderRow = sheet.addRow(["안내사항"]);
  sheet.mergeCells(noticeHeaderRow.number, 1, noticeHeaderRow.number, 7);
  noticeHeaderRow.getCell(1).font = { name: FONT_NAME, bold: true, size: 14 };
  noticeHeaderRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

  const noteLines = notes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  // notes 원본에 이미 "1. " 같은 번호가 붙어 있으면 중복으로 번호를 매기지 않는다.
  const alreadyNumbered = noteLines.length > 0 && /^\d+[.)]\s*/.test(noteLines[0]);
  noteLines.forEach((line, i) => {
    const text = alreadyNumbered ? line : `${i + 1}. ${line}`;
    const row = sheet.addRow([text]);
    sheet.mergeCells(row.number, 1, row.number, 7);
    const cell = row.getCell(1);
    cell.font = { name: FONT_NAME, size: 11 };
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    row.height = 20;
  });

  return workbook;
}

// exceljs는 900KB가 넘는 무거운 라이브러리라, 다운로드 버튼을 누를 때만
// 동적으로 불러온다 (/quotes, /quotes/new, /quotes/[id]/edit의 초기
// 번들에는 포함되지 않는다).
export async function downloadQuoteExcel(input: QuoteExcelInput): Promise<void> {
  const workbook = await buildQuoteWorkbook(input);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `견적서_${input.clientName}_${input.quoteDate}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
