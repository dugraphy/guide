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

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F2F2" },
};
const THIN_BORDER_SIDE: ExcelJS.Border = { style: "thin", color: { argb: "FFCCCCCC" } };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: THIN_BORDER_SIDE,
  bottom: THIN_BORDER_SIDE,
  left: THIN_BORDER_SIDE,
  right: THIN_BORDER_SIDE,
};
const MONEY_FORMAT = "#,##0";

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

// exceljs는 900KB가 넘는 무거운 라이브러리라, 다운로드 버튼을 누를 때만
// 동적으로 불러온다 (/quotes, /quotes/new, /quotes/[id]/edit의 초기
// 번들에는 포함되지 않는다).
export async function downloadQuoteExcel(input: QuoteExcelInput): Promise<void> {
  const { businessProfile, clientName, quoteDate, quoteType, items, depositRate, notes, vatIncluded } =
    input;
  const totals = calcQuoteTotals(items, depositRate, vatIncluded);

  const { default: ExcelJSRuntime } = await import("exceljs");
  const workbook = new ExcelJSRuntime.Workbook();
  const sheet = workbook.addWorksheet("견적서");
  sheet.columns = [
    { width: 16 },
    { width: 26 },
    { width: 12 },
    { width: 12 },
    { width: 8 },
    { width: 16 },
    { width: 20 },
  ];

  const labelCells: ExcelJS.Cell[] = []; // 굵게 + 배경색만 (테두리 없음)

  const titleRow = sheet.addRow(["견적서"]);
  sheet.addRow([]);
  const bizRow1 = sheet.addRow(["상호", businessProfile.companyName, "", "사업자번호", businessProfile.businessNumber]);
  const bizRow2 = sheet.addRow(["대표자", businessProfile.ownerName, "", "전화번호", businessProfile.phone]);
  const bizRow3 = sheet.addRow(["주소", businessProfile.address, "", "이메일", businessProfile.email]);
  sheet.addRow([]);
  const clientRow = sheet.addRow(["의뢰인명", clientName, "", "견적일자", quoteDate]);
  const typeRow = sheet.addRow(["견적유형", quoteType]);
  [bizRow1, bizRow2, bizRow3, clientRow].forEach((row) => {
    labelCells.push(row.getCell(1), row.getCell(4));
  });
  labelCells.push(typeRow.getCell(1));
  sheet.addRow([]);

  const vatLabel = vatIncluded ? "부가세 포함" : "부가세 별도";
  const itemsHeaderRow = sheet.addRow(["No", "품목", "단가", "할인단가", "수량", `공급가(${vatLabel})`, "비고"]);
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
  sheet.addRow([]);

  const totalsRows: ExcelJS.Row[] = [];
  totalsRows.push(sheet.addRow(["총 공급가액(할인 전)", totals.totalBeforeDiscount]));
  totalsRows.push(sheet.addRow(["할인 금액", totals.discountAmount]));
  totalsRows.push(sheet.addRow(["총 공급가액(할인 후)", totals.totalAfterDiscount]));
  if (vatIncluded) {
    totalsRows.push(sheet.addRow(["부가세(10%)", totals.vat]));
    totalsRows.push(sheet.addRow(["합계금액", totals.grandTotal]));
  }
  totalsRows.push(sheet.addRow([`계약금 (${depositRate}%)`, totals.deposit]));
  totalsRows.push(sheet.addRow(["잔금", totals.balance]));
  totalsRows.push(sheet.addRow(["총 청구액", totals.totalBilled]));
  sheet.addRow([
    vatIncluded ? "* 부가세(10%)가 포함된 금액입니다." : "* 상기 금액은 부가세 별도입니다.",
  ]);
  sheet.addRow([]);
  sheet.addRow(["안내사항"]);
  notes.split("\n").forEach((line) => sheet.addRow([line]));

  // 제목 셀: 여러 열 병합 + 크게
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 7);
  const titleCell = titleRow.getCell(1);
  titleCell.font = { bold: true, size: 18 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  // 라벨 셀(사업자정보/견적정보) — 굵게 + 연한 회색 배경
  labelCells.forEach((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });

  // 품목표: 헤더 굵게+배경색, 전체(헤더+본문) 테두리, 금액 열 천단위 콤마
  for (let c = 1; c <= 7; c++) {
    const cell = itemsHeaderRow.getCell(c);
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = THIN_BORDER;
  }
  itemRows.forEach((row) => {
    for (let c = 1; c <= 7; c++) {
      row.getCell(c).border = THIN_BORDER;
    }
    // 단가(3) / 할인단가(4) / 공급가(6)
    [3, 4, 6].forEach((c) => {
      row.getCell(c).numFmt = MONEY_FORMAT;
    });
  });

  // 합계 영역: 금액 열(2번째 컬럼) 천단위 콤마
  totalsRows.forEach((row) => {
    row.getCell(2).numFmt = MONEY_FORMAT;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `견적서_${clientName}_${quoteDate}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
