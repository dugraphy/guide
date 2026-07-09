// 표 블록: BlockNote 코어의 table 블록(node_modules/@blocknote/core/src/blocks/Table/block.ts)을
// 기반으로 두 가지를 더한 커스텀 버전이다.
//
// 1. 컬럼 너비 드래그 리사이즈는 BlockNote/prosemirror-tables에 이미 내장되어 있다
//    (columnResizing 플러그인, TableContent.columnWidths로 자동 저장/복원됨) — 그대로 재사용.
// 2. 행 높이 드래그 리사이즈는 BlockNote에 없는 기능이라 직접 구현했다. BlockNote의 표 콘텐츠
//    타입(rows/cells)은 고정 스키마라 행(row) 단위로 임의 데이터를 끼워 넣을 수 없으므로, 대신
//    표 블록 자신의 prop(`rowHeights`, 행 인덱스로 정렬된 숫자 배열을 JSON 문자열로 저장 — 다른
//    커스텀 블록들의 tabs/items prop과 동일한 패턴)에 저장한다.
//
//    주의: propSchema → PM 노드 attrs 자동 배선은 BlockNote가 노드를 직접 생성해주는 블록에서만
//    일어난다(schema/blocks/createSpec.ts의 addNodeAndExtensionsToSpec, node가 없을 때만
//    propsToAttributes를 addAttributes로 붙여준다). table 블록처럼 자체 tiptap 노드를 넘기는
//    경우(createBlockSpecFromTiptapNode)는 이 자동 배선을 안 타서, rowHeights를 실제 PM 속성으로
//    쓰려면 TiptapTableNode 자신의 addAttributes()에 propsToAttributes(...)를 직접 붙여야 한다
//    — 안 그러면 setNodeMarkup으로 넣은 값이 스키마에 없는 속성이라 조용히 버려진다.
//
// 코어의 table 블록 자체를 감싸거나 확장할 수 있는 공개 API가 없어(테이블 prop 스키마가
// createTableBlockSpec() 내부에 고정되어 있음), tiptap 노드 정의는 코어 소스를 그대로 옮겨왔다.
import { Extension, Node, callOrReturn, getExtensionField, mergeAttributes } from "@tiptap/core";
import { DOMParser, Fragment, Node as PMNode, Schema } from "prosemirror-model";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import {
  CellSelection,
  TableView,
  columnResizing,
  goToNextCell,
  isInTable,
  moveCellForward,
  nextCell,
  selectionCell,
  tableEditing,
} from "prosemirror-tables";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { EditorView } from "prosemirror-view";
import type { NodeView } from "prosemirror-view";
import {
  createBlockSpecFromTiptapNode,
  createDefaultBlockDOMOutputSpec,
  createExtension,
  defaultProps,
  mergeCSSClasses,
  camelToDataKebab,
  propsToAttributes,
  EMPTY_CELL_WIDTH,
  type BlockConfig,
  type TableContent,
} from "@blocknote/core";

const RESIZE_MIN_WIDTH = 35;
const ROW_RESIZE_MIN_HEIGHT = 24;
// 핸들이 드래그 가능한 히트 영역 두께(px). 실제로 보이는 선은 CSS에서 더 얇게 그린다.
const ROW_HANDLE_HIT_HEIGHT = 8;

export const resizableTablePropSchema = {
  textColor: defaultProps.textColor,
  // 행별 높이(px). 인덱스 = 행 번호, 값이 없으면(undefined) 해당 행은 자동 높이.
  rowHeights: { default: "" },
};

function parseRowHeights(raw: unknown): (number | undefined)[] {
  if (typeof raw !== "string" || !raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const TiptapTableHeader = Node.create<{
  HTMLAttributes: Record<string, any>;
}>({
  name: "tableHeader",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  content: "tableContent+",

  addAttributes() {
    return {
      colspan: {
        default: 1,
      },
      rowspan: {
        default: 1,
      },
      colwidth: {
        default: null,
        parseHTML: (element) => {
          const colwidth = element.getAttribute("colwidth");
          const value = colwidth
            ? colwidth.split(",").map((width) => parseInt(width, 10))
            : null;

          return value;
        },
      },
    };
  },

  tableRole: "header_cell",

  isolating: true,

  parseHTML() {
    return [
      {
        tag: "th",
        getContent: (node, schema) =>
          parseTableContent(node as HTMLElement, schema),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "th",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});

const TiptapTableCell = Node.create<{
  HTMLAttributes: Record<string, any>;
}>({
  name: "tableCell",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  content: "tableContent+",

  addAttributes() {
    return {
      colspan: {
        default: 1,
      },
      rowspan: {
        default: 1,
      },
      colwidth: {
        default: null,
        parseHTML: (element) => {
          const colwidth = element.getAttribute("colwidth");
          const value = colwidth
            ? colwidth.split(",").map((width) => parseInt(width, 10))
            : null;

          return value;
        },
      },
    };
  },

  tableRole: "cell",

  isolating: true,

  parseHTML() {
    return [
      {
        tag: "td",
        getContent: (node, schema) =>
          parseTableContent(node as HTMLElement, schema),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "td",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});

const TiptapTableNode = Node.create({
  name: "table",
  content: "tableRow+",
  group: "blockContent",
  tableRole: "table",

  marks: "deletion insertion modification",
  isolating: true,

  // table 블록은 자체 tiptap 노드를 넘기는 방식(createBlockSpecFromTiptapNode)이라 BlockNote의
  // propSchema → attrs 자동 배선을 안 받는다 — resizableTablePropSchema(rowHeights 포함)를
  // 여기서 직접 붙여줘야 setNodeMarkup으로 넣은 값이 실제 PM 속성으로 유지된다.
  addAttributes() {
    return propsToAttributes(resizableTablePropSchema);
  },

  parseHTML() {
    return [
      {
        tag: "table",
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const domOutputSpec = createDefaultBlockDOMOutputSpec(
      this.name,
      "table",
      {
        ...(this.options.domAttributes?.blockContent || {}),
        ...HTMLAttributes,
      },
      this.options.domAttributes?.inlineContent || {},
    );

    const colGroup = document.createElement("colgroup");
    for (const tableCell of node.children[0].children) {
      const colWidths: null | (number | undefined)[] =
        tableCell.attrs["colwidth"];

      if (colWidths) {
        for (const colWidth of tableCell.attrs["colwidth"]) {
          const col = document.createElement("col");
          if (colWidth) {
            col.style = `width: ${colWidth}px`;
          }

          colGroup.appendChild(col);
        }
      } else {
        colGroup.appendChild(document.createElement("col"));
      }
    }

    domOutputSpec.dom.firstChild?.appendChild(colGroup);

    return domOutputSpec;
  },

  // 이 노드뷰는 columnResizing 플러그인에 필요하다(기본적으로 플러그인이 자체 노드뷰를 붙이면
  // renderHTML로 만든 blockContent 래퍼가 사라지므로, BlockNoteTableView가 TableView를 감싸서
  // 그 래퍼 구조를 유지한다). 컬럼 리사이즈에 더해, 행 높이 드래그 핸들도 여기서 관리한다.
  addNodeView() {
    return ({ node, HTMLAttributes, view, getPos }) => {
      class ResizableBlockNoteTableView extends TableView {
        tableEl: HTMLTableElement;
        tableWrapperEl: HTMLElement;
        rowResizeContainer: HTMLDivElement;
        rowHeights: (number | undefined)[] = [];
        private cleanupDrag: (() => void) | null = null;
        private destroyed = false;
        private syncScheduled = false;
        private resizeObserver: ResizeObserver | null = null;

        constructor(
          public node: PMNode,
          public cellMinWidth: number,
          public blockContentHTMLAttributes: Record<string, string>,
          private view: EditorView,
          private getPos: () => number | undefined,
        ) {
          super(node, cellMinWidth);

          const blockContent = document.createElement("div");
          blockContent.className = mergeCSSClasses(
            "bn-block-content",
            blockContentHTMLAttributes.class,
          );
          blockContent.setAttribute("data-content-type", "table");
          for (const [attribute, value] of Object.entries(
            blockContentHTMLAttributes,
          )) {
            if (attribute !== "class") {
              blockContent.setAttribute(attribute, value);
            }
          }

          const tableWrapper = this.dom;
          this.tableWrapperEl = tableWrapper;
          this.tableEl = tableWrapper.firstChild as HTMLTableElement;

          const tableWrapperInner = document.createElement("div");
          tableWrapperInner.className = "tableWrapper-inner";
          tableWrapperInner.appendChild(tableWrapper.firstChild!);

          tableWrapper.appendChild(tableWrapperInner);

          blockContent.appendChild(tableWrapper);
          const floatingContainer = document.createElement("div");
          floatingContainer.className = "table-widgets-container";
          floatingContainer.style.position = "relative";
          tableWrapper.appendChild(floatingContainer);

          this.rowResizeContainer = document.createElement("div");
          this.rowResizeContainer.className = "bn-row-resize-widgets-container";
          tableWrapper.appendChild(this.rowResizeContainer);

          this.dom = blockContent;

          this.rowHeights = parseRowHeights(node.attrs.rowHeights);
          // 생성자 시점에는 아직 PM이 contentDOM(행/셀)을 채우기 전이라 this.tableEl.rows가
          // 비어 있다 — 다음 프레임으로 미뤄서 실제 행이 렌더링된 뒤에 핸들 위치를 계산한다.
          // 행 높이 자체는 RowHeightDecorationsExtension의 데코레이션이 선언적으로 적용하므로
          // 여기서 직접 DOM에 쓸 필요가 없다(그렇게 하면 표와 무관한 트랜잭션으로 tr/td DOM이
          // 재생성될 때마다 조용히 사라진다 — 실제로 겪은 문제).
          this.scheduleSync();

          this.resizeObserver = new ResizeObserver(() => this.scheduleSync());
          this.resizeObserver.observe(this.tableEl);
        }

        ignoreMutation(record: MutationRecord): boolean {
          return (
            !(record.target as HTMLElement).closest(".tableWrapper-inner") ||
            super.ignoreMutation(record)
          );
        }

        update(updatedNode: PMNode): boolean {
          if (updatedNode.type.name !== "table") {
            return false;
          }

          if (!super.update(updatedNode)) {
            return false;
          }

          for (const [propName, propSpec] of Object.entries(
            resizableTablePropSchema,
          )) {
            const attrName = camelToDataKebab(propName);
            const value = updatedNode.attrs[propName];
            if (value !== propSpec.default) {
              this.dom.setAttribute(attrName, String(value));
            } else {
              this.dom.removeAttribute(attrName);
            }
          }

          this.rowHeights = parseRowHeights(updatedNode.attrs.rowHeights);
          this.scheduleSync();

          return true;
        }

        destroy() {
          this.destroyed = true;
          this.cleanupDrag?.();
          this.resizeObserver?.disconnect();
        }

        // 핸들 위치 재계산을 다음 애니메이션 프레임으로 모아서(coalesce) 실행한다 — PM이
        // contentDOM(행/셀)을 채우기 전에 레이아웃을 읽는 문제를 피하고, getBoundingClientRect
        // 호출도 실제 페인트 직전 안정된 상태에서 한 번만 하게 된다.
        private scheduleSync() {
          if (this.syncScheduled || this.destroyed) {
            return;
          }
          this.syncScheduled = true;
          requestAnimationFrame(() => {
            this.syncScheduled = false;
            if (this.destroyed) {
              return;
            }
            this.renderRowHandles();
          });
        }

        private renderRowHandles() {
          this.rowResizeContainer.innerHTML = "";
          const rows = Array.from(this.tableEl.rows);
          const containerTop = this.tableWrapperEl.getBoundingClientRect().top;

          rows.forEach((tr, i) => {
            const rect = tr.getBoundingClientRect();
            const top = rect.bottom - containerTop;

            const handle = document.createElement("div");
            handle.className = "bn-row-resize-handle";
            handle.style.top = `${top - ROW_HANDLE_HIT_HEIGHT / 2}px`;
            handle.addEventListener("mousedown", (e) =>
              this.startRowResize(e, i),
            );

            const line = document.createElement("div");
            line.className = "bn-row-resize-handle-line";
            handle.appendChild(line);

            this.rowResizeContainer.appendChild(handle);
          });
        }

        private startRowResize(e: MouseEvent, rowIndex: number) {
          e.preventDefault();
          e.stopPropagation();

          const tr = this.tableEl.rows[rowIndex];
          if (!tr) {
            return;
          }

          const startY = e.clientY;
          const startHeight = tr.getBoundingClientRect().height;

          const onMove = (ev: MouseEvent) => {
            const nextHeight = Math.max(
              ROW_RESIZE_MIN_HEIGHT,
              Math.round(startHeight + ev.clientY - startY),
            );
            tr.style.height = `${nextHeight}px`;
            this.renderRowHandles();
          };

          const onUp = (ev: MouseEvent) => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            this.cleanupDrag = null;

            const finalHeight = Math.max(
              ROW_RESIZE_MIN_HEIGHT,
              Math.round(startHeight + ev.clientY - startY),
            );
            this.commitRowHeight(rowIndex, finalHeight);
          };

          document.body.style.cursor = "row-resize";
          document.body.style.userSelect = "none";
          // window 레벨로 듣는다 — prosemirror-tables의 컬럼 리사이즈(win.addEventListener)와
          // 동일한 스코프. 탭 서브 에디터 안에서는 TabPane이 이 이벤트들을 window로 다시
          // 디스패치해주는데(부모 에디터 TableHandles의 hover 처리와 충돌하지 않도록 원본은
          // stopPropagation 시킴), document가 아니라 window에 붙여야 그 재전달을 받는다.
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
          this.cleanupDrag = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
        }

        private commitRowHeight(rowIndex: number, height: number) {
          const pos = this.getPos();
          if (pos === undefined) {
            return;
          }
          const currentNode = this.view.state.doc.nodeAt(pos);
          if (!currentNode || currentNode.type.name !== "table") {
            return;
          }

          const heights = parseRowHeights(currentNode.attrs.rowHeights);
          heights[rowIndex] = height;

          const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
            ...currentNode.attrs,
            rowHeights: JSON.stringify(heights),
          });
          this.view.dispatch(tr);
        }
      }

      return new ResizableBlockNoteTableView(
        node,
        EMPTY_CELL_WIDTH,
        {
          ...(this.options.domAttributes?.blockContent || {}),
          ...HTMLAttributes,
        },
        view,
        getPos,
      ) as NodeView;
    };
  },
});

const TiptapTableParagraph = Node.create({
  name: "tableParagraph",
  group: "tableContent",
  content: "inline*",

  parseHTML() {
    return [
      {
        tag: "p",
        getAttrs: (element) => {
          if (typeof element === "string" || !element.textContent) {
            return false;
          }

          if (!element.closest("[data-content-type]")) {
            return false;
          }

          const parent = element.parentElement;

          if (parent === null) {
            return false;
          }

          if (parent.tagName === "TD" || parent.tagName === "TH") {
            return {};
          }

          return false;
        },
        node: "tableParagraph",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", HTMLAttributes, 0];
  },
});

const TiptapTableRow = Node.create<{
  HTMLAttributes: Record<string, any>;
}>({
  name: "tableRow",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  content: "(tableCell | tableHeader)+",

  tableRole: "row",
  marks: "deletion insertion modification",
  parseHTML() {
    return [{ tag: "tr" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "tr",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },
});

function parseTableContent(node: HTMLElement, schema: Schema) {
  const parser = DOMParser.fromSchema(schema);

  const parsedContent = parser.parse(node, {
    topNode: schema.nodes.blockGroup.create(),
  });
  const extractedContent: PMNode[] = [];

  parsedContent.content.descendants((child) => {
    if (child.isInline) {
      extractedContent.push(child);
      return false;
    }

    return undefined;
  });

  return Fragment.fromArray(extractedContent);
}

export type ResizableTableBlockConfig = BlockConfig<
  "table",
  {
    textColor: {
      default: "default";
    };
    rowHeights: {
      default: "";
    };
  },
  "table"
>;

// 행 높이는 데코레이션으로 적용한다 — tr/td는 (table 노드와 달리) 커스텀 노드뷰가 없어서
// BlockNote/tiptap의 기본 자식 조정(reconciliation) 로직이 관리하는데, 이 로직은 우리 테이블과
// 무관한 트랜잭션(예: 다른 확장의 위치 추적용 메타 트랜잭션)에도 자주 다시 그려진다. 그때마다
// tr에 직접 준 style.height 같은 명령형 DOM 변경은 조용히 사라진다 — 실제로 겪은 버그. 데코레이션은
// PM이 그 조정 과정 자체에서 매번 다시 계산해 붙여주므로 재조정에도 안전하게 살아남는다.
const rowHeightDecorationsPluginKey = new PluginKey("resizable-table-row-heights");

const RowHeightDecorationsExtension = Extension.create({
  name: "ResizableTableRowHeightDecorations",

  addProseMirrorPlugins: () => {
    return [
      new Plugin({
        key: rowHeightDecorationsPluginKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];

            state.doc.descendants((node, pos) => {
              if (node.type.name !== "table") {
                return;
              }

              const heights = parseRowHeights(node.attrs.rowHeights);
              if (heights.length === 0) {
                return;
              }

              node.forEach((rowNode, rowOffset, i) => {
                const height = heights[i];
                if (!height) {
                  return;
                }
                const from = pos + 1 + rowOffset;
                const to = from + rowNode.nodeSize;
                decorations.push(
                  Decoration.node(from, to, {
                    style: `height: ${height}px`,
                  }),
                );
              });
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

// prosemirror-tables는 각 노드의 `tableRole`(table/row/cell/header_cell)로 표 구조를 인식한다.
// tiptap의 Node.create({ tableRole: ... })는 표준 필드가 아니라서, extendNodeSchema로 직접
// PM NodeSpec에 실어줘야 실제로 적용된다 — 코어의 TableExtension.ts와 동일.
const ResizableTableExtension = Extension.create({
  name: "ResizableBlockNoteTableExtension",

  addProseMirrorPlugins: () => {
    return [
      columnResizing({
        cellMinWidth: RESIZE_MIN_WIDTH,
        defaultCellMinWidth: EMPTY_CELL_WIDTH,
        // BlockNoteTableView와 동일한 커스텀 노드뷰(행 리사이즈 핸들 포함)를 쓰므로 null로 둔다.
        View: null,
      }),
      tableEditing(),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        if (!isInTable(this.editor.state)) {
          return false;
        }

        return this.editor.commands.command(({ state, dispatch }) => {
          const $cell = selectionCell(state);
          const $nextCell = $cell ? nextCell($cell, "vert", 1) : null;

          if ($nextCell && dispatch) {
            dispatch(
              state.tr
                .setSelection(
                  TextSelection.between($nextCell, moveCellForward($nextCell)),
                )
                .scrollIntoView(),
            );
          }

          return true;
        });
      },
      Backspace: () => {
        const selection = this.editor.state.selection;
        const selectionIsEmpty = selection.empty;
        const selectionIsAtStartOfNode = selection.$head.parentOffset === 0;
        const selectionIsInTableParagraphNode =
          selection.$head.node().type.name === "tableParagraph";

        return (
          selectionIsEmpty &&
          selectionIsAtStartOfNode &&
          selectionIsInTableParagraphNode
        );
      },
      Tab: () => {
        return this.editor.commands.command(({ state, dispatch, view }) =>
          goToNextCell(1)(state, dispatch, view),
        );
      },
      "Shift-Tab": () => {
        return this.editor.commands.command(({ state, dispatch, view }) =>
          goToNextCell(-1)(state, dispatch, view),
        );
      },
    };
  },

  extendNodeSchema(extension) {
    const context = {
      name: extension.name,
      options: extension.options,
      storage: extension.storage,
    };

    return {
      tableRole: callOrReturn(
        getExtensionField(extension, "tableRole", context),
      ),
    };
  },
});

export const createResizableTableBlockSpec = () =>
  createBlockSpecFromTiptapNode(
    { node: TiptapTableNode, type: "table", content: "table" },
    resizableTablePropSchema,
    [
      createExtension({
        key: "table-extensions",
        tiptapExtensions: [
          ResizableTableExtension,
          RowHeightDecorationsExtension,
          TiptapTableParagraph,
          TiptapTableHeader,
          TiptapTableCell,
          TiptapTableRow,
        ],
      }),
      createExtension({
        key: "table-keyboard-delete",
        keyboardShortcuts: {
          Backspace: ({ editor }) => {
            if (!(editor.prosemirrorState.selection instanceof CellSelection)) {
              return false;
            }

            const block = editor.getTextCursorPosition().block;
            const content = block.content as TableContent<any, any>;

            let numCells = 0;
            for (const row of content.rows) {
              for (const cell of row.cells) {
                if (
                  ("type" in cell && cell.content.length > 0) ||
                  (!("type" in cell) && cell.length > 0)
                ) {
                  return false;
                }

                numCells++;
              }
            }

            let selectionNumCells = 0;
            editor.prosemirrorState.selection.forEachCell(() => {
              selectionNumCells++;
            });

            if (selectionNumCells < numCells) {
              return false;
            }

            editor.transact(() => {
              const selectionBlock =
                editor.getPrevBlock(block) || editor.getNextBlock(block);
              if (selectionBlock) {
                editor.setTextCursorPosition(block);
              }

              editor.removeBlocks([block]);
            });

            return true;
          },
        },
      }),
    ],
  );

declare module "@tiptap/core" {
  interface NodeConfig {
    tableRole?: string;
  }
}
