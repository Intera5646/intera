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
  | 'studio_zone'
  | 'unknown'
  | 'combined_bathroom'
  | 'corridor'
  | 'dressing_room'
  | 'loggia'
  | 'kitchen_living'
  | 'kids_room'
  | 'laundry'
  | 'vestibule';

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
  type_hint?: 'bathroom' | 'kitchen' | 'hallway' | 'balcony' | null;
  dimensions: RoomDimensions;
  size_category: SizeCategory;
  num_photos_needed: 1 | 2;
  walls: RoomWall[];
  suggested_cameras: CameraSuggestion[];
  /**
   * Optional outline shape. If absent or `{kind:'rectangle'}` the room is
   * a simple rectangle of `dimensions.width_m × dimensions.length_m`.
   * If `{kind:'polygon'}` the room outline is `shape.points` (clockwise from
   * top-left, in millimetres from the bounding-box origin). `dimensions`
   * still holds the bounding-box width/length for backwards-compat.
   */
  shape?: RoomShape;
}

/** 2D point in millimetres from the top-left of the room's bounding box. */
export interface Point2D {
  x_mm: number;
  y_mm: number;
}

export type RoomShape =
  | { kind: 'rectangle' }
  | { kind: 'polygon'; points: Point2D[] };

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

export interface GeneralPreferences {
  style: 'modern' | 'scandinavian' | 'classic' | 'loft' | 'minimalist' | 'eclectic';
  budget: 'economy' | 'standard' | 'premium';
  defaultCeilingHeight: number;
  colorPreferences?: string;
  generalNotes?: string;
}

export interface RoomPreference {
  roomId: string;
  ceilingHeightOverride?: number;
  styleNotes?: string;
  specialRequirements?: string;
  inheritFromGeneral: boolean;
}

/** 2D floor-plan furniture item returned by /api/furniture-plan. */
export interface FurnitureItem {
  name: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  depth_mm: number;
  rotation: 0 | 90 | 180 | 270;
  color: string;
}

/** URLs for the two ControlNet conditioning images produced per room render. */
export interface ControlMaps {
  depthMapUrl: string;   // Supabase public URL — grayscale depth PNG
  lineartUrl: string;    // Supabase public URL — edge lineart PNG
  roomId: string;
  cameraIndex: number;
}

/** Camera position and target in room-space metres, used for Three.js scenes. */
export interface CameraView {
  position: { x: number; y: number; z: number };
  target:   { x: number; y: number; z: number };
  fov: number; // degrees, default 75
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

