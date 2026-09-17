export const ministryPdfAssetKeys = {
  pharmacy: {
    front: "ministry-pharmacy-front_3d76d2a8.jpg",
    back: "ministry-pharmacy-back_f1bff011.jpg",
  },
  warehouse: {
    front: "ministry-warehouse-front-new_85a339f3.jpg",
    back: "ministry-warehouse-back_fa9fb19f.jpg",
  },
} as const;

export type MinistryPdfTemplateKind = keyof typeof ministryPdfAssetKeys;
export type MinistryPdfCardSide = keyof (typeof ministryPdfAssetKeys)[MinistryPdfTemplateKind];

export function getMinistryPdfAssetKey(template: MinistryPdfTemplateKind, side: MinistryPdfCardSide) {
  return ministryPdfAssetKeys[template][side];
}
