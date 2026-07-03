"use client";

import { createReactBlockSpec } from "@blocknote/react";

interface Package {
  name: string;
  price: string;
  features: string[];
  featured: boolean;
}

const DEFAULT_PACKAGES: Package[] = [
  {
    name: "베이직",
    price: "가격을 입력하세요",
    features: ["항목을 입력하세요", "항목을 입력하세요", "항목을 입력하세요"],
    featured: false,
  },
  {
    name: "스탠다드",
    price: "가격을 입력하세요",
    features: ["항목을 입력하세요", "항목을 입력하세요", "항목을 입력하세요"],
    featured: true,
  },
  {
    name: "프리미엄",
    price: "가격을 입력하세요",
    features: ["항목을 입력하세요", "항목을 입력하세요", "항목을 입력하세요"],
    featured: false,
  },
];

function parsePackages(raw: string): Package[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // fall through to default
  }
  return DEFAULT_PACKAGES;
}

function PricingCardsRenderer({
  block,
  editor,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  block: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any;
}) {
  const packages = parsePackages(block.props.packages as string);

  const save = (next: Package[]) => {
    editor.updateBlock(block.id, { props: { packages: JSON.stringify(next) } });
  };

  const updatePackage = (index: number, patch: Partial<Package>) => {
    save(packages.map((pkg, i) => (i === index ? { ...pkg, ...patch } : pkg)));
  };

  const updateFeature = (index: number, featureIndex: number, value: string) => {
    updatePackage(index, {
      features: packages[index].features.map((f, i) => (i === featureIndex ? value : f)),
    });
  };

  return (
    <div
      contentEditable={false}
      className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full my-1"
    >
      {packages.map((pkg, i) => (
        <div
          key={i}
          className={`relative rounded-lg border bg-[var(--bg)] p-4 transition-shadow hover:shadow-md ${
            pkg.featured ? "border-[var(--accent)]" : "border-[var(--border)]"
          }`}
        >
          {pkg.featured && (
            <span className="absolute -top-2.5 left-4 rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs text-white">
              추천
            </span>
          )}
          <input
            value={pkg.name}
            disabled={!editor.isEditable}
            onChange={(e) => updatePackage(i, { name: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
            className="mb-1 w-full bg-transparent text-sm font-semibold text-[var(--fg)] outline-none"
          />
          <input
            value={pkg.price}
            disabled={!editor.isEditable}
            onChange={(e) => updatePackage(i, { price: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
            className="mb-3 w-full bg-transparent text-sm text-[var(--accent)] outline-none"
          />
          <div className="flex flex-col gap-1">
            {pkg.features.map((feature, fi) => (
              <div key={fi} className="flex items-start gap-1.5">
                <span className="mt-0.5 text-[var(--fg-muted)]">•</span>
                <input
                  value={feature}
                  disabled={!editor.isEditable}
                  onChange={(e) => updateFeature(i, fi, e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--fg-muted)] outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const PricingCardsSpecFactory = createReactBlockSpec(
  {
    type: "pricingCards" as const,
    propSchema: {
      // Package[] 를 JSON 문자열로 저장 — BlockNote propSchema 값은
      // 원시 타입만 허용되기 때문.
      packages: { default: JSON.stringify(DEFAULT_PACKAGES) },
    },
    content: "none" as const,
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, editor }: any) => (
      <PricingCardsRenderer block={block} editor={editor} />
    ),
  }
);

export const pricingCardsSpec = PricingCardsSpecFactory();
