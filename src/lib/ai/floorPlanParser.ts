export type FloorPlanParseResult = {
  rooms: Array<{ type: string; area: number }>;
  totalArea: number;
  shape: string;
  width: number;
  length: number;
  ceilingHeight: number;
  walls?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
};

export async function parseFloorPlan(imageUrl: string): Promise<FloorPlanParseResult> {
  console.log('parseFloorPlan: stub mode, imageUrl:', imageUrl);
  return {
    rooms: [{ type: 'living_room', area: 20 }],
    totalArea: 20,
    shape: 'rectangular',
    width: 4,
    length: 5,
    ceilingHeight: 2.7,
  };
}
