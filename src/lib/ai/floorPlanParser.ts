export async function parseFloorPlan(imageUrl: string) {
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
