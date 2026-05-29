export interface WallFeature {
  type: 'door' | 'window';
  position_from_start_m: number;
  width_m: number;
  leads_to_room_id?: string;
}

export interface RoomWall {
  id: string;
  length_m: number;
  features: WallFeature[];
}

export interface CameraSuggestion {
  camera_at_wall_id: string;
  facing_wall_id: string;
  description: string;
}

export type RoomType =
  | 'kitchen'
  | 'bedroom'
  | 'living'
  | 'bathroom'
  | 'wc'
  | 'hallway'
  | 'balcony'
  | 'storage'
  | 'studio_zone';

export type SizeCategory = 'small' | 'medium' | 'large';

export interface RoomDimensions {
  width_m: number;
  length_m: number;
  height_m: number;
}

export interface GeometryRoom {
  id: string;
  name: string;
  type: RoomType;
  dimensions: RoomDimensions;
  size_category: SizeCategory;
  num_photos_needed: 1 | 2;
  walls: RoomWall[];
  suggested_cameras: CameraSuggestion[];
}

export interface RoomInfo {
  id: string;
  name: string;
  approximate_size: SizeCategory;
  windows: 'yes' | 'no';
  natural_light: 'high' | 'medium' | 'low';
  connected_to: string[];
}

export interface ApartmentGeometry {
  is_bti_plan: boolean;
  apartment: {
    total_area_m2: number;
    ceiling_height_m: number;
    orientation: 'north' | 'south' | 'east' | 'west' | 'unknown';
  };
  rooms: GeometryRoom[];
}

/** A piece of furniture anchored to a wall, represented as an AABB in room space. */
export interface FurnitureObject {
  id: string;
  /** Human-readable type: "sofa", "bed", "wardrobe", "kitchen_run", etc. */
  type: string;
  /** Wall the back of the furniture is against: W1 (back), W2 (right), W3 (front), W4 (left) */
  anchorWallId: string;
  /** 0.0 = left/near end of wall, 1.0 = right/far end */
  positionAlongWall: number;
  /** Size along the anchored wall (metres) */
  widthM: number;
  /** How far the piece protrudes into the room (metres) */
  depthM: number;
  /** Height of the piece from the floor (metres) */
  heightM: number;
  /** Vertical offset from the floor — for wall-mounted items (e.g. upper cabinets) */
  yOffsetM?: number;
  /** Optional description of what the piece faces */
  facing?: string;
}

