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
// 엑셀 열 너비(문자 단위) → 픽셀 근사 변환(Calibri 11 기준): px ≈ width*7 + 5
const colWidthPx = (width: number) => Math.round(width * 7 + 5);

// 워터마크 — 로고를 지정된 크기로 그리되, 캔버스에서 낮은 불투명도(12%)로
// 합성해 새 PNG를 만든다. ExcelJS의 일반 addImage()는 이미지 자체의 투명도
// 옵션을 지원하지 않으므로, 픽셀 자체에 옅은 알파를 구워 넣는 방식을 쓴다.
// 이렇게 만든 이미지는 (배경 이미지가 아닌) 일반 삽입 이미지이므로 인쇄 시에도
// 함께 출력된다.
async function buildFadedLogoImage(
  logoBuffer: ArrayBuffer,
  width: number,
  height: number
): Promise<ArrayBuffer> {
  const blob = new Blob([logoBuffer], { type: "image/png" });
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("워터마크용 캔버스 컨텍스트를 생성하지 못했습니다.");
  ctx.globalAlpha = 0.12;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("워터마크 이미지 생성에 실패했습니다."))),
      "image/png"
    );
  });
  return pngBlob.arrayBuffer();
}

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

  // 인쇄 시 내용이 잘리지 않고 세로 1페이지에 맞춰 자동 축소되도록 설정.
  // ExcelJS의 margins 단위는 inch이므로 cm 값을 인치로 환산해서 넣는다.
  const CM_TO_INCH = 1 / 2.54;
  sheet.pageSetup = {
    paperSize: 9, // A4
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: {
      top: 1.91 * CM_TO_INCH,
      bottom: 1.91 * CM_TO_INCH,
      left: 0.64 * CM_TO_INCH,
      right: 0.64 * CM_TO_INCH,
      header: 0.76 * CM_TO_INCH,
      footer: 0.76 * CM_TO_INCH,
    },
  };

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

  // 제목 — "{상호명} 견적서" (상호명은 business_profile.company_name을 그대로 사용)
  sheet.mergeCells(titleStartRow, 1, titleEndRow, 2);
  const titleCell = sheet.getCell(titleStartRow, 1);
  titleCell.value = `${businessProfile.companyName} 견적서`;
  titleCell.font = { name: FONT_NAME, bold: true, size: 21 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  // 로고 — 제목 블록(A1:B6, 사업자정보 표 왼쪽 빈 공간) 안에서 제목 기준
  // 가로/세로 모두 가운데로, 제목 텍스트와 살짝 겹치도록 배치.
  const LOGO_WATERMARK_WIDTH = 220;
  const LOGO_WATERMARK_HEIGHT = Math.round((LOGO_WATERMARK_WIDTH * 529) / 2075); // 원본 비율(2075x529) 유지
  const titleColWidthsPx = [1, 2].map((c) => colWidthPx(Number(sheet.getColumn(c).width)));
  const titleAreaWidthPx = titleColWidthsPx[0] + titleColWidthsPx[1];
  // logo.png는 "DU 아이콘 + The Designed Unseen Graphic Studio." 태그라인이 합쳐진
  // 가로로 긴 워드마크라, 진한 DU 아이콘이 이미지 왼쪽 약 절반에 몰려있고 오른쪽은
  // 옅은 텍스트다. 바운딩 박스 기준으로만 중앙 정렬하면 아이콘의 시각적 무게중심이
  // 왼쪽으로 쏠려 보이므로, 아이콘 쪽 무게중심(이미지 폭의 약 26% 지점)을 제목
  // 블록 중앙에 맞추도록 우측으로 보정한다.
  const LOGO_VISUAL_CENTER_FRACTION = 0.26;
  // 우측 보정이 과하면 이미지 오른쪽 끝이 제목 영역을 벗어나 사업자정보 표
  // 쪽으로 넘어가므로, 제목 영역 폭을 넘지 않도록 상한을 둔다.
  const maxLogoOffsetPx = Math.max(0, titleAreaWidthPx - LOGO_WATERMARK_WIDTH);
  const biasedOffsetPx = Math.min(
    maxLogoOffsetPx,
    Math.max(0, Math.round(titleAreaWidthPx / 2 - LOGO_VISUAL_CENTER_FRACTION * LOGO_WATERMARK_WIDTH))
  );
  // 위 보정이 상한(maxLogoOffsetPx)에 걸려 과하게 오른쪽으로 붙었으므로,
  // 정중앙(naive 50:50 지점)과의 차이의 1/5을 미세 조정 한 칸(step)으로 두고
  // 왼쪽으로 두 칸(step) 당긴다 — 1차 조정 후 사용자 요청으로 같은 폭만큼 한 번 더.
  const naiveCenterOffsetPx = Math.max(0, Math.round((titleAreaWidthPx - LOGO_WATERMARK_WIDTH) / 2));
  const fineTuneStepPx = Math.round((biasedOffsetPx - naiveCenterOffsetPx) / 5);
  let logoOffsetPx = biasedOffsetPx - fineTuneStepPx * 2;
  let logoCol = 0;
  for (const w of titleColWidthsPx) {
    if (logoOffsetPx < w) break;
    logoOffsetPx -= w;
    logoCol += 1;
  }

  // 세로 가운데 정렬: 제목 블록(titleStartRow~titleEndRow, 각 22pt) 전체 높이
  // 가운데에 로고를 둔다 — 제목 텍스트도 같은 블록 안에서 세로 가운데 정렬이라
  // 자연스럽게 겹쳐 보인다.
  const EMU_PER_PT = 12700;
  const titleRowHeightEMU = 22 * EMU_PER_PT;
  const titleRowCount = titleEndRow - titleStartRow + 1;
  const titleAreaHeightEMU = titleRowHeightEMU * titleRowCount;
  const logoTopOffsetEMU = Math.max(
    0,
    Math.round((titleAreaHeightEMU - LOGO_WATERMARK_HEIGHT * 9525) / 2)
  );
  const logoRowIndex = Math.min(
    titleRowCount - 1,
    Math.floor(logoTopOffsetEMU / titleRowHeightEMU)
  );
  const logoRowOffEMU = logoTopOffsetEMU - logoRowIndex * titleRowHeightEMU;

  const logoBuffer = await fetch("/img/logo.png").then((res) => res.arrayBuffer());
  const fadedLogoBuffer = await buildFadedLogoImage(
    logoBuffer,
    LOGO_WATERMARK_WIDTH,
    LOGO_WATERMARK_HEIGHT
  );
  const logoImageId = workbook.addImage({ buffer: fadedLogoBuffer, extension: "png" });
  sheet.addImage(logoImageId, {
    // ExcelJS의 ImagePosition 타입은 nativeCol/nativeColOff/nativeRow/nativeRowOff를
    // 선언하지 않지만, Anchor 생성자가 이 필드를 그대로(EMU 단위) XML에 반영하므로
    // 실제 픽셀 단위 위치를 안전하게 지정할 수 있다.
    tl: {
      nativeCol: logoCol,
      nativeColOff: logoOffsetPx * 9525,
      nativeRow: titleStartRow - 1 + logoRowIndex,
      nativeRowOff: logoRowOffEMU,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    ext: { width: LOGO_WATERMARK_WIDTH, height: LOGO_WATERMARK_HEIGHT },
  });

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

  // 계좌 정보 — 계약금 바로 아래에, 강조 배경(회색) + 굵은 글씨로 표시.
  // 계좌 정보가 하나도 입력되어 있지 않으면 빈 회색 줄만 남는 걸 피하기 위해
  // 은행명/계좌번호/예금주 중 하나라도 있을 때만 추가한다.
  if (businessProfile.bankName || businessProfile.accountNumber || businessProfile.accountHolder) {
    const accountRow = sheet.addRow([
      `${businessProfile.bankName} ${businessProfile.accountNumber}  입금자명: ${businessProfile.accountHolder}`,
    ]);
    accountRow.height = 22;
    sheet.mergeCells(accountRow.number, 1, accountRow.number, 7);
    const cell = accountRow.getCell(1);
    cell.font = { name: FONT_NAME, bold: true, size: 11 };
    cell.fill = HIGHLIGHT_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }

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
