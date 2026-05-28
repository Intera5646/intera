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
