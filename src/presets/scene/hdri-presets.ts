/**
 * Scene HDRI Presets
 *
 * Preset configurations for 3D environment backgrounds from Poly Haven
 * These are equirectangular HDR images that rotate with the camera
 */

export interface SceneHdriPreset {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
  category: 'outdoor' | 'indoor' | 'studio' | 'night' | 'abstract';
}

// Using 1k resolution for thumbnails/preview, 2k for actual use (good balance of quality/size)
const BASE_URL = 'https://dl.polyhaven.org/file/ph-assets/HDRIs';

export const sceneHdriPresets: SceneHdriPreset[] = [
  // Outdoor - Nature
  {
    id: 'autumn-forest',
    name: 'Autumn Forest',
    url: `${BASE_URL}/hdr/2k/autumn_forest_04_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/autumn_forest_04.jpg`,
    category: 'outdoor',
  },
  {
    id: 'meadow',
    name: 'Meadow',
    url: `${BASE_URL}/hdr/2k/meadow_2_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/meadow_2.jpg`,
    category: 'outdoor',
  },
  {
    id: 'kloofendal-sunrise',
    name: 'Kloofendal Sunrise',
    url: `${BASE_URL}/hdr/2k/kloofendal_48d_partly_cloudy_puresky_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/kloofendal_48d_partly_cloudy_puresky.jpg`,
    category: 'outdoor',
  },
  {
    id: 'quarry',
    name: 'Quarry',
    url: `${BASE_URL}/hdr/2k/quarry_04_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/quarry_04.jpg`,
    category: 'outdoor',
  },
  {
    id: 'snowy-field',
    name: 'Snowy Field',
    url: `${BASE_URL}/hdr/2k/snowy_field_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/snowy_field.jpg`,
    category: 'outdoor',
  },
  {
    id: 'venice-sunset',
    name: 'Venice Sunset',
    url: `${BASE_URL}/hdr/2k/venice_sunset_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/venice_sunset.jpg`,
    category: 'outdoor',
  },
  {
    id: 'sunflowers',
    name: 'Sunflowers',
    url: `${BASE_URL}/hdr/2k/sunflowers_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/sunflowers.jpg`,
    category: 'outdoor',
  },
  {
    id: 'abandoned-parking',
    name: 'Abandoned Parking',
    url: `${BASE_URL}/hdr/2k/abandoned_parking_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/abandoned_parking.jpg`,
    category: 'outdoor',
  },
  {
    id: 'brown-photostudio',
    name: 'Brown Photostudio',
    url: `${BASE_URL}/hdr/2k/brown_photostudio_02_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/brown_photostudio_02.jpg`,
    category: 'studio',
  },

  // Indoor / Studio
  {
    id: 'studio-small-03',
    name: 'Studio Small',
    url: `${BASE_URL}/hdr/2k/studio_small_03_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/studio_small_03.jpg`,
    category: 'studio',
  },
  {
    id: 'photo-studio-loft',
    name: 'Photo Studio Loft',
    url: `${BASE_URL}/hdr/2k/photo_studio_loft_hall_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/photo_studio_loft_hall.jpg`,
    category: 'studio',
  },
  {
    id: 'empty-warehouse',
    name: 'Empty Warehouse',
    url: `${BASE_URL}/hdr/2k/empty_warehouse_01_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/empty_warehouse_01.jpg`,
    category: 'indoor',
  },
  {
    id: 'modern-buildings',
    name: 'Modern Buildings',
    url: `${BASE_URL}/hdr/2k/modern_buildings_2_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/modern_buildings_2.jpg`,
    category: 'outdoor',
  },
  {
    id: 'industrial-sunset',
    name: 'Industrial Sunset',
    url: `${BASE_URL}/hdr/2k/industrial_sunset_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/industrial_sunset.jpg`,
    category: 'outdoor',
  },

  // Night / Space
  {
    id: 'moonlit-golf',
    name: 'Moonlit Golf',
    url: `${BASE_URL}/hdr/2k/moonlit_golf_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/moonlit_golf.jpg`,
    category: 'night',
  },
  {
    id: 'kloppenheim',
    name: 'Kloppenheim Night',
    url: `${BASE_URL}/hdr/2k/kloppenheim_06_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/kloppenheim_06.jpg`,
    category: 'night',
  },
  {
    id: 'moonless-golf',
    name: 'Moonless Golf',
    url: `${BASE_URL}/hdr/2k/moonless_golf_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/moonless_golf.jpg`,
    category: 'night',
  },
  {
    id: 'dikhololo-night',
    name: 'Dikhololo Night',
    url: `${BASE_URL}/hdr/2k/dikhololo_night_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/dikhololo_night.jpg`,
    category: 'night',
  },
  {
    id: 'rural-asphalt-road',
    name: 'Rural Road Night',
    url: `${BASE_URL}/hdr/2k/rural_asphalt_road_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/rural_asphalt_road.jpg`,
    category: 'night',
  },

  // Sky / Clouds
  {
    id: 'blue-sky',
    name: 'Blue Sky',
    url: `${BASE_URL}/hdr/2k/kloofendal_48d_partly_cloudy_puresky_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/kloofendal_48d_partly_cloudy_puresky.jpg`,
    category: 'outdoor',
  },
  {
    id: 'evening-road',
    name: 'Evening Road',
    url: `${BASE_URL}/hdr/2k/evening_road_01_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/evening_road_01.jpg`,
    category: 'outdoor',
  },
  {
    id: 'shanghai-bund',
    name: 'Shanghai Bund',
    url: `${BASE_URL}/hdr/2k/shanghai_bund_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/shanghai_bund.jpg`,
    category: 'outdoor',
  },
  {
    id: 'rosendal-plains',
    name: 'Rosendal Plains',
    url: `${BASE_URL}/hdr/2k/rosendal_plains_2_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/rosendal_plains_2.jpg`,
    category: 'outdoor',
  },
  {
    id: 'syferfontein',
    name: 'Syferfontein',
    url: `${BASE_URL}/hdr/2k/syferfontein_1d_clear_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/syferfontein_1d_clear.jpg`,
    category: 'outdoor',
  },
  {
    id: 'clarens-midday',
    name: 'Clarens Midday',
    url: `${BASE_URL}/hdr/2k/clarens_midday_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/clarens_midday.jpg`,
    category: 'outdoor',
  },
  {
    id: 'dam-wall',
    name: 'Dam Wall',
    url: `${BASE_URL}/hdr/2k/dam_wall_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/dam_wall.jpg`,
    category: 'outdoor',
  },
  {
    id: 'drakensberg-solitary',
    name: 'Drakensberg',
    url: `${BASE_URL}/hdr/2k/drakensberg_solitary_mountain_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/drakensberg_solitary_mountain.jpg`,
    category: 'outdoor',
  },
  {
    id: 'lebombo',
    name: 'Lebombo',
    url: `${BASE_URL}/hdr/2k/lebombo_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/lebombo.jpg`,
    category: 'outdoor',
  },
  {
    id: 'spruit-sunrise',
    name: 'Spruit Sunrise',
    url: `${BASE_URL}/hdr/2k/spruit_sunrise_2k.hdr`,
    thumbnail: `${BASE_URL}/extra/Tonemapped%20JPG/spruit_sunrise.jpg`,
    category: 'outdoor',
  },
];
