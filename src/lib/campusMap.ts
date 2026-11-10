// Fictional campus laid out around a fixed center point so the Leaflet map
// has something real to plot. Replace with your actual campus's coordinates.
export const CAMPUS_CENTER: [number, number] = [18.5246, 73.8786]; // Pune, as a placeholder campus

export const LOCATION_COORDS: Record<string, [number, number]> = {
  "Block A": [18.5256, 73.8776],
  "Block B": [18.5256, 73.8796],
  "Block C": [18.5236, 73.8796],
  "Block D": [18.5236, 73.8776],
  "Lab 1": [18.5248, 73.8781],
  "Lab 2": [18.5248, 73.8791],
  "Lab 3": [18.5244, 73.8791],
  "Lab 4": [18.5244, 73.8781],
  "Library": [18.5252, 73.8786],
  "Auditorium": [18.5240, 73.8786],
  "Cafeteria": [18.5246, 73.8801],
  "Canteen": [18.5246, 73.8801],
  "Hostel A": [18.5230, 73.8770],
  "Hostel B": [18.5230, 73.8802],
  "Main Building": [18.5246, 73.8786],
  "Admin Block": [18.5250, 73.8790],
  "Unspecified": CAMPUS_CENTER,
};

export function coordsFor(location: string): [number, number] {
  return LOCATION_COORDS[location] || CAMPUS_CENTER;
}
