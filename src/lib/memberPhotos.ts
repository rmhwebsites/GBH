/**
 * Maps member names to their profile photo URLs from gbhinvestments.com/partners.
 * Uses first-name matching with full-name overrides for ambiguous cases.
 */

const MEMBER_PHOTOS: Record<string, string> = {
  // Exact full-name matches (highest priority)
  "Ryan Huffman":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/682cb4036db5fd3a221df65b_june-7-2024-49.jpg",
  "Will Tucker":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/68bf37f7ee6b2a700ddf950e_Will%20Tucker%20Headshot.jpg",
  "Lohan Heyns":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/682cb193197e37928b2f0501_IMG_3777.JPG",
  "Cates Greene":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/68ade526902a5d278c8ab6d6_IMG_6151.jpeg",
  "Ethan Bezner":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/68ade56aa12cc91ba68afbb3_IMG_9858.jpeg",
  "Jack Fishpaw":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/682cb3224e572b3519d9296c_IMG_8461.JPG",
  "Mark Taubner":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/682cb7fb2f09452258f62743_IMG_2280.jpeg",
  "Patrick Bryan":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/68bf795845d86422b3862a81_IMG_3597.jpg",
  "Canon Brooks":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/68ade61f333ca56a6c038dfd_portrait.jpeg",
  "Tom McArtor":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/68bf5ecdc0e592144a71dcaa__MG_8416.JPG",
  "Henry Smith":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/68ade680bc65af392b8582c6_IMG_1735.JPG",
  "Theodore Moores":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/68bf36f043058dc7f7b46918_IMG_4956.JPG",
  "Jonathan Jarrett":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/68bf39ff066fb60c6f8f2619_20241014_Corsair%20Society%20Headshots_044.jpeg",
  "James Oxley":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/68bf38678d7e576b112e9b8c_vantine_hi_res_2742273.JPG",
  "William Kimbro":
    "https://cdn.prod.website-files.com/67e43b853b67f5c129d0e544/68ad217946629c5e943f24de_IMG_0031.JPG",
};

/**
 * Get the profile photo URL for a member by their full name.
 * Returns null if no photo is found.
 */
export function getMemberPhotoUrl(fullName: string): string | null {
  // Try exact match first
  if (MEMBER_PHOTOS[fullName]) {
    return MEMBER_PHOTOS[fullName];
  }

  // Try case-insensitive match
  const lower = fullName.toLowerCase();
  for (const [name, url] of Object.entries(MEMBER_PHOTOS)) {
    if (name.toLowerCase() === lower) {
      return url;
    }
  }

  return null;
}

/**
 * Get initials from a name (fallback when no photo)
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get a deterministic color for an avatar based on the name
 */
export function getAvatarColor(name: string): string {
  const colors = [
    "#CE9C5C", // gold
    "#4A90D9", // blue
    "#50C878", // emerald
    "#E8725C", // coral
    "#9B6DB7", // purple
    "#F5A623", // amber
    "#45B7D1", // teal
    "#D4637A", // rose
    "#6BB56B", // green
    "#C4A35A", // wheat
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
